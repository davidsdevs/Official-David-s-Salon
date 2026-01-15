// Cloud Functions for David's Salon Management System
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
let bucketRef = null;

const getBucket = () => {
  if (bucketRef) return bucketRef;
  const explicitBucket = getEnv('BACKUP_BUCKET');
  const appBucket = admin.app().options?.storageBucket;
  const projectId = admin.app().options?.projectId || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const fallbackBucket = projectId ? `${projectId}.appspot.com` : '';
  const bucketName = explicitBucket || appBucket || fallbackBucket;
  if (!bucketName) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cloud Storage bucket is not configured. Set BACKUP_BUCKET (recommended) or configure Firebase storageBucket for Admin SDK.'
    );
  }
  bucketRef = admin.storage().bucket(bucketName);
  return bucketRef;
};

const getEnv = (key) => {
  const direct = process.env[key];
  if (direct) return direct;
  const legacyKey = key.toLowerCase().replace(/__/g, '.');
  try {
    const cfg = functions.config();
    const parts = legacyKey.split('.');
    let cur = cfg;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object') return '';
      cur = cur[p];
    }
    return typeof cur === 'string' ? cur : '';
  } catch (e) {
    return '';
  }
};

const SETTINGS_DOC = 'systemSettings/databaseBackup';

const toPlain = (value) => {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(toPlain);

  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().toISOString();
      } catch (e) {
        return String(value);
      }
    }

    if (value.latitude != null && value.longitude != null) {
      return { latitude: value.latitude, longitude: value.longitude };
    }

    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = toPlain(v);
    }
    return out;
  }

  return value;
};

const exportDocWithSubcollections = async (docSnap) => {
  const data = docSnap.data() || {};
  const plain = toPlain(data);

  const subcollections = await docSnap.ref.listCollections();
  if (!subcollections.length) return plain;

  const subs = {};
  for (const sub of subcollections) {
    subs[sub.id] = await exportCollection(sub);
  }
  return { ...plain, _subcollections: subs };
};

const exportCollection = async (colRef) => {
  const snapshot = await colRef.get();
  const out = {};
  for (const docSnap of snapshot.docs) {
    out[docSnap.id] = await exportDocWithSubcollections(docSnap);
  }
  return out;
};

const exportFirestore = async () => {
  const collections = await db.listCollections();
  const root = {};
  for (const col of collections) {
    root[col.id] = await exportCollection(col);
  }
  return root;
};

const encryptString = (plaintext, passphrase) => {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: 'aes-256-gcm',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
};

const isDue = (schedule, lastSuccessAt, now) => {
  const sched = (schedule || 'off').toLowerCase();
  if (sched === 'off') return false;
  if (!lastSuccessAt) return true;

  const last = lastSuccessAt.toDate ? lastSuccessAt.toDate() : new Date(lastSuccessAt);
  if (!(last instanceof Date) || Number.isNaN(last.getTime())) return true;

  if (sched === 'daily') {
    return now.getTime() - last.getTime() >= 24 * 60 * 60 * 1000;
  }

  if (sched === 'weekly') {
    return now.getTime() - last.getTime() >= 7 * 24 * 60 * 60 * 1000;
  }

  if (sched === 'monthly') {
    const lastMonth = `${last.getUTCFullYear()}-${last.getUTCMonth()}`;
    const curMonth = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
    if (lastMonth === curMonth) return false;
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return now.getUTCDate() === end.getUTCDate();
  }

  return false;
};

const requireSystemAdmin = async (context) => {
  const uid = context?.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.data() || {};
  const roles = Array.isArray(userData.roles) ? userData.roles : [];
  const role = userData.role || '';
  const ok =
    roles.includes('systemAdmin') ||
    roles.includes('system_admin') ||
    roles.includes('system-admin') ||
    role === 'systemAdmin' ||
    role === 'system_admin' ||
    role === 'system-admin';
  if (!ok) {
    throw new functions.https.HttpsError('permission-denied', 'System admin access required');
  }

  return { uid, userData };
};

const sendBrevoEmail = async ({ to, subject, text, attachments = [] }) => {
  const apiKey = getEnv('BREVO_API_KEY');
  const fromEmail = getEnv('BREVO_FROM_EMAIL') || 'noreply@davidsalon.com';
  const fromName = getEnv('BREVO_FROM_NAME') || "David's Salon";

  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'BREVO_API_KEY is not configured');
  }

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: to }],
    subject,
    textContent: text,
    ...(attachments.length ? { attachment: attachments } : {})
  };

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Brevo API error: ${resp.status} - ${body}`);
  }
};

const runBackupInternal = async ({ triggeredByUid = '', force = false, email = true, passphraseOverride = '' } = {}) => {
  const now = new Date();
  const settingsRef = db.doc(SETTINGS_DOC);
  const settingsSnap = await settingsRef.get();
  const settings = settingsSnap.data() || {};

  const schedule = (settings.schedule || 'off').toLowerCase();
  const recipientEmail = settings.recipientEmail || getEnv('BACKUP_RECIPIENT_EMAIL');
  const lastSuccessAt = settings.lastSuccessAt || null;
  const passphrase = String(passphraseOverride || getEnv('BACKUP_PASSPHRASE') || '').trim();

  if (!passphrase) {
    await settingsRef.set(
      {
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRunStatus: 'error',
        lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        lastErrorMessage: 'BACKUP_PASSPHRASE is not configured'
      },
      { merge: true }
    );
    throw new functions.https.HttpsError('failed-precondition', 'Backup passphrase is required. Provide one in the UI for manual exports, or set BACKUP_PASSPHRASE for scheduled backups.');
  }

  if (email && !recipientEmail) {
    await settingsRef.set(
      {
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRunStatus: 'error',
        lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        lastErrorMessage: 'recipientEmail is not configured'
      },
      { merge: true }
    );
    throw new functions.https.HttpsError('failed-precondition', 'recipientEmail is not configured');
  }

  if (!force && !isDue(schedule, lastSuccessAt, now)) {
    await settingsRef.set(
      {
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRunStatus: 'skipped'
      },
      { merge: true }
    );
    return { status: 'skipped' };
  }

  await settingsRef.set(
    {
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunStatus: 'running',
      lastTriggeredBy: triggeredByUid || ''
    },
    { merge: true }
  );

  try {
    const snapshot = await exportFirestore();
    const json = JSON.stringify({ generatedAt: now.toISOString(), data: snapshot });

    const encrypted = encryptString(json, passphrase);
    const encryptedJson = JSON.stringify(encrypted);
    const encryptedBuffer = Buffer.from(encryptedJson, 'utf8');
    const fileNameDate = now.toISOString().replace(/[:.]/g, '-');
    const fileName = `db-backup-${fileNameDate}.enc.json`;
    const storagePath = `backups/${fileName}`;

    const bucket = getBucket();
    await bucket.file(storagePath).save(encryptedBuffer, {
      contentType: 'application/json',
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=0, no-transform'
      }
    });

    if (email) {
      const subjectDate = now.toISOString().slice(0, 10);
      const subject = `[System Backup] Current Database Report - ${subjectDate}`;

      const ATTACHMENT_LIMIT_BYTES = 18 * 1024 * 1024;
      const isTooLarge = encryptedBuffer.byteLength > ATTACHMENT_LIMIT_BYTES;

      let text = `Encrypted database backup generated.\n\nGenerated: ${now.toISOString()}\n`;
      let attachments = [];

      if (!isTooLarge) {
        text += '\nEncrypted backup attached.';
        attachments = [
          {
            name: fileName,
            content: encryptedBuffer.toString('base64')
          }
        ];
      } else {
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const [url] = await bucket.file(storagePath).getSignedUrl({
          action: 'read',
          expires: expiresAt
        });
        text += `\n\nBackup is too large to attach. Download (valid 7 days):\n${url}`;
      }

      await sendBrevoEmail({
        to: recipientEmail,
        subject,
        text,
        attachments
      });
    }

    await settingsRef.set(
      {
        lastSuccessAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSuccessPath: storagePath,
        lastRunStatus: 'success',
        lastErrorAt: admin.firestore.FieldValue.delete(),
        lastErrorMessage: admin.firestore.FieldValue.delete()
      },
      { merge: true }
    );

    return { status: 'success', storagePath };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    await settingsRef.set(
      {
        lastRunStatus: 'error',
        lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        lastErrorMessage: error?.message ? String(error.message).slice(0, 1000) : 'Unknown error'
      },
      { merge: true }
    );
    throw new functions.https.HttpsError('internal', error?.message ? String(error.message).slice(0, 1000) : 'Unknown error');
  }
};

// Example: sendWelcomeEmail function
exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
  console.log('User created:', user.email);
  // Add email sending logic here if needed
  return null;
});

// Example: processStockMovement function
exports.processStockMovement = functions.firestore
  .document('inventory_movements/{docId}')
  .onCreate((snap) => {
    const movementData = snap.data();
    console.log('Stock movement recorded:', movementData);
    // Add custom processing logic here
    return null;
  });

// Example: calculateBranchMetrics function
exports.calculateBranchMetrics = functions.pubsub
  .schedule('every day 00:00')
  .timeZone('Asia/Manila')
  .onRun(async () => {
    console.log('Running daily branch metrics calculation...');
    // Add metrics calculation logic here
    return null;
  });

exports.scheduledDatabaseBackup = functions.pubsub
  .schedule('every day 00:30')
  .timeZone('Asia/Manila')
  .onRun(async () => {
    await runBackupInternal({ triggeredByUid: 'scheduler', force: false });
    return null;
  });

exports.runDatabaseBackup = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
  const { uid } = await requireSystemAdmin(context);
  const force = data?.force === true;
  const passphraseOverride = data?.passphrase ? String(data.passphrase) : '';
  const result = await runBackupInternal({ triggeredByUid: uid, force, email: true, passphraseOverride });
  return result;
  });

exports.exportDatabaseBackup = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (_data, context) => {
  const { uid } = await requireSystemAdmin(context);
  const passphraseOverride = _data?.passphrase ? String(_data.passphrase) : '';
  const result = await runBackupInternal({ triggeredByUid: uid, force: true, email: false, passphraseOverride });
  if (result?.status !== 'success' || !result?.storagePath) {
    return result;
  }
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const bucket = getBucket();
  const [url] = await bucket.file(result.storagePath).getSignedUrl({
    action: 'read',
    expires: expiresAt
  });
  return { ...result, url };
  });

exports.exportDatabaseBackupInline = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onCall(async (data, context) => {
  const { uid } = await requireSystemAdmin(context);
  const passphrase = data?.passphrase ? String(data.passphrase).trim() : '';
  if (!passphrase) {
    throw new functions.https.HttpsError('invalid-argument', 'passphrase is required');
  }

  try {
    const now = new Date();
    const snapshot = await exportFirestore();
    const json = JSON.stringify({ generatedAt: now.toISOString(), data: snapshot });

    const encrypted = encryptString(json, passphrase);
    const encryptedJson = JSON.stringify(encrypted);
    const fileNameDate = now.toISOString().replace(/[:.]/g, '-');
    const fileName = `db-backup-${fileNameDate}.enc.json`;

    return {
      status: 'success',
      fileName,
      contentType: 'application/json',
      data: encryptedJson,
      generatedAt: now.toISOString(),
      triggeredBy: uid
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error?.message ? String(error.message).slice(0, 1000) : 'Unknown error');
  }
  });

exports.getLatestBackupUrl = functions.https.onCall(async (_data, context) => {
  await requireSystemAdmin(context);
  const settingsSnap = await db.doc(SETTINGS_DOC).get();
  const settings = settingsSnap.data() || {};
  const storagePath = settings.lastSuccessPath;
  if (!storagePath) {
    throw new functions.https.HttpsError('not-found', 'No backup available');
  }

  const expiresAt = Date.now() + 60 * 60 * 1000;
  const bucket = getBucket();
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: expiresAt
  });

  return { storagePath, url };
});

exports.getDatabaseBackupSettings = functions.https.onCall(async (_data, context) => {
  await requireSystemAdmin(context);
  const snap = await db.doc(SETTINGS_DOC).get();
  const settings = snap.data() || {};
  return {
    schedule: settings.schedule || 'off',
    recipientEmail: settings.recipientEmail || '',
    lastRunAt: settings.lastRunAt || null,
    lastRunStatus: settings.lastRunStatus || null,
    lastSuccessAt: settings.lastSuccessAt || null,
    lastSuccessPath: settings.lastSuccessPath || null,
    lastErrorAt: settings.lastErrorAt || null,
    lastErrorMessage: settings.lastErrorMessage || null
  };
});

exports.updateDatabaseBackupSettings = functions.https.onCall(async (data, context) => {
  const { uid } = await requireSystemAdmin(context);

  const schedule = String(data?.schedule || 'off').toLowerCase();
  const allowed = new Set(['off', 'daily', 'weekly', 'monthly']);
  if (!allowed.has(schedule)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid schedule');
  }

  const recipientEmailRaw = data?.recipientEmail;
  const recipientEmail = recipientEmailRaw == null ? '' : String(recipientEmailRaw).trim();
  if (recipientEmail) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
    if (!emailOk) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid recipient email');
    }
  }

  await db.doc(SETTINGS_DOC).set(
    {
      schedule,
      recipientEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    },
    { merge: true }
  );

  return { success: true };
});

// Add your custom functions here
module.exports = { ...exports };
