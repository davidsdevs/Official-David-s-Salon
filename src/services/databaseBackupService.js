/**
 * Database Backup & Restore Service
 * Client-side backup and restore for Firestore database
 * Works without Firebase Functions
 */

import { collection, getDocs, doc, setDoc, writeBatch, deleteDoc, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import CryptoJS from 'crypto-js';

// Collections to backup (add more as needed)
const COLLECTIONS_TO_BACKUP = [
  'users',
  'branches',
  'appointments',
  'transactions',
  'services',
  'products',
  'stocks',
  'suppliers',
  'purchaseOrders',
  'promotions',
  'clients',
  'loyaltyPoints',
  'referralCodes',
  'rolePasswords',
  'branchCalendars',
  'leaveRequests',
  'feedback',
  'notifications',
  'activityLogs',
  'deposits',
  'commissions',
  'portfolios',
  'branchServices',
  'branchPricing',
  'masterProducts',
  'serviceTemplates',
  'loyaltyCriteria'
];

/**
 * Export entire database to JSON
 * @returns {Promise<Object>} Database backup object
 */
export const exportDatabase = async () => {
  try {
    console.log('📦 Starting database export...');
    const backup = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        collections: []
      },
      data: {}
    };

    let totalDocuments = 0;

    for (const collectionName of COLLECTIONS_TO_BACKUP) {
      try {
        console.log(`📥 Exporting collection: ${collectionName}`);
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        const documents = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Convert Firestore Timestamps to ISO strings
          const serializedData = serializeFirestoreData(data);
          documents.push({
            id: doc.id,
            data: serializedData
          });
        });

        backup.data[collectionName] = documents;
        backup.metadata.collections.push({
          name: collectionName,
          count: documents.length
        });
        
        totalDocuments += documents.length;
        console.log(`✅ Exported ${documents.length} documents from ${collectionName}`);
      } catch (error) {
        console.error(`❌ Error exporting ${collectionName}:`, error);
        backup.metadata.collections.push({
          name: collectionName,
          count: 0,
          error: error.message
        });
      }
    }

    backup.metadata.totalDocuments = totalDocuments;
    console.log(`🎉 Export complete! Total documents: ${totalDocuments}`);
    
    return {
      success: true,
      backup,
      totalDocuments
    };
  } catch (error) {
    console.error('❌ Database export failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Serialize Firestore data (convert Timestamps, etc.)
 * @param {Object} data - Firestore document data
 * @returns {Object} Serialized data
 */
const serializeFirestoreData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const serialized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (value?.toDate && typeof value.toDate === 'function') {
      // Firestore Timestamp
      serialized[key] = {
        _type: 'timestamp',
        _value: value.toDate().toISOString()
      };
    } else if (value instanceof Date) {
      serialized[key] = {
        _type: 'date',
        _value: value.toISOString()
      };
    } else if (Array.isArray(value)) {
      serialized[key] = value.map(item => serializeFirestoreData(item));
    } else if (typeof value === 'object') {
      serialized[key] = serializeFirestoreData(value);
    } else {
      serialized[key] = value;
    }
  }
  
  return serialized;
};

/**
 * Deserialize data back to Firestore format
 * @param {Object} data - Serialized data
 * @returns {Object} Deserialized data
 */
const deserializeFirestoreData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const deserialized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      deserialized[key] = value;
    } else if (value?._type === 'timestamp' || value?._type === 'date') {
      deserialized[key] = new Date(value._value);
    } else if (Array.isArray(value)) {
      deserialized[key] = value.map(item => deserializeFirestoreData(item));
    } else if (typeof value === 'object') {
      deserialized[key] = deserializeFirestoreData(value);
    } else {
      deserialized[key] = value;
    }
  }
  
  return deserialized;
};

/**
 * Download backup as encrypted JSON file
 * @param {Object} backup - Backup data
 * @param {string} password - Encryption password
 * @returns {Promise<Object>} Result
 */
export const downloadBackup = async (backup, password) => {
  try {
    console.log('🔐 Encrypting backup...');
    
    // Convert backup to JSON string
    const jsonString = JSON.stringify(backup, null, 2);
    
    // Encrypt if password provided
    let finalData = jsonString;
    let isEncrypted = false;
    
    if (password) {
      finalData = CryptoJS.AES.encrypt(jsonString, password).toString();
      isEncrypted = true;
      console.log('✅ Backup encrypted');
    }
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `davids-salon-backup-${timestamp}${isEncrypted ? '.encrypted' : ''}.json`;
    
    // Create blob and download
    const blob = new Blob([finalData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Backup downloaded:', filename);
    
    return {
      success: true,
      filename,
      isEncrypted,
      size: blob.size
    };
  } catch (error) {
    console.error('❌ Download failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Read and decrypt backup file
 * @param {File} file - Backup file
 * @param {string} password - Decryption password (if encrypted)
 * @returns {Promise<Object>} Backup data
 */
export const readBackupFile = async (file, password = '') => {
  try {
    console.log('📖 Reading backup file...');
    
    const text = await file.text();
    const isEncrypted = file.name.includes('.encrypted');
    
    let jsonString = text;
    
    // Decrypt if encrypted
    if (isEncrypted) {
      if (!password) {
        return {
          success: false,
          error: 'This backup is encrypted. Please provide the password.'
        };
      }
      
      console.log('🔓 Decrypting backup...');
      try {
        const bytes = CryptoJS.AES.decrypt(text, password);
        jsonString = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!jsonString) {
          return {
            success: false,
            error: 'Incorrect password or corrupted backup file.'
          };
        }
        console.log('✅ Backup decrypted');
      } catch (error) {
        return {
          success: false,
          error: 'Failed to decrypt backup. Check your password.'
        };
      }
    }
    
    // Parse JSON
    const backup = JSON.parse(jsonString);
    
    // Validate backup structure
    if (!backup.metadata || !backup.data) {
      return {
        success: false,
        error: 'Invalid backup file format.'
      };
    }
    
    console.log('✅ Backup file read successfully');
    console.log(`📊 Backup contains ${backup.metadata.totalDocuments} documents`);
    
    return {
      success: true,
      backup
    };
  } catch (error) {
    console.error('❌ Failed to read backup file:', error);
    return {
      success: false,
      error: error.message || 'Failed to read backup file.'
    };
  }
};

/**
 * Restore database from backup
 * @param {Object} backup - Backup data
 * @param {Object} options - Restore options
 * @returns {Promise<Object>} Result
 */
export const restoreDatabase = async (backup, options = {}) => {
  const {
    clearExisting = false,
    collectionsToRestore = null, // null = all collections
    onProgress = null
  } = options;
  
  try {
    console.log('🔄 Starting database restore...');
    
    const collections = collectionsToRestore || Object.keys(backup.data);
    let totalRestored = 0;
    let totalErrors = 0;
    const results = [];
    
    for (let i = 0; i < collections.length; i++) {
      const collectionName = collections[i];
      const documents = backup.data[collectionName] || [];
      
      console.log(`📥 Restoring collection: ${collectionName} (${documents.length} documents)`);
      
      if (onProgress) {
        onProgress({
          collection: collectionName,
          current: i + 1,
          total: collections.length,
          documents: documents.length
        });
      }
      
      try {
        // Clear existing data if requested
        if (clearExisting) {
          console.log(`🗑️ Clearing existing data in ${collectionName}...`);
          const existingSnapshot = await getDocs(collection(db, collectionName));
          const batch = writeBatch(db);
          let batchCount = 0;
          
          existingSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            batchCount++;
            
            // Firestore batch limit is 500
            if (batchCount >= 500) {
              batch.commit();
              batchCount = 0;
            }
          });
          
          if (batchCount > 0) {
            await batch.commit();
          }
          console.log(`✅ Cleared ${existingSnapshot.size} existing documents`);
        }
        
        // Restore documents in batches
        let restored = 0;
        for (let j = 0; j < documents.length; j += 500) {
          const batch = writeBatch(db);
          const batchDocs = documents.slice(j, j + 500);
          
          for (const { id, data } of batchDocs) {
            const docRef = doc(db, collectionName, id);
            const deserializedData = deserializeFirestoreData(data);
            batch.set(docRef, deserializedData);
            restored++;
          }
          
          await batch.commit();
        }
        
        totalRestored += restored;
        results.push({
          collection: collectionName,
          success: true,
          restored
        });
        
        console.log(`✅ Restored ${restored} documents to ${collectionName}`);
      } catch (error) {
        console.error(`❌ Error restoring ${collectionName}:`, error);
        totalErrors++;
        results.push({
          collection: collectionName,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`🎉 Restore complete! Restored: ${totalRestored}, Errors: ${totalErrors}`);
    
    return {
      success: totalErrors === 0,
      totalRestored,
      totalErrors,
      results
    };
  } catch (error) {
    console.error('❌ Database restore failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get backup statistics
 * @param {Object} backup - Backup data
 * @returns {Object} Statistics
 */
export const getBackupStats = (backup) => {
  if (!backup || !backup.metadata) {
    return null;
  }
  
  const stats = {
    exportDate: backup.metadata.exportDate,
    version: backup.metadata.version,
    totalDocuments: backup.metadata.totalDocuments,
    collections: backup.metadata.collections.map(col => ({
      name: col.name,
      count: col.count,
      hasError: !!col.error
    })),
    size: JSON.stringify(backup).length
  };
  
  return stats;
};
