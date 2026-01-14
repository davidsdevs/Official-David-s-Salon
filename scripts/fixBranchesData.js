/**
 * Fix script to ensure all branches have required fields
 * Run with: node scripts/fixBranchesData.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixBranchesData() {
  try {
    console.log('🔍 Fetching all branches from Firestore...\n');
    
    const branchesRef = collection(db, 'branches');
    const snapshot = await getDocs(branchesRef);
    
    console.log(`📊 Total branches found: ${snapshot.size}\n`);
    
    let fixedCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const branchId = docSnapshot.id;
      const data = docSnapshot.data();
      const updates = {};
      let needsUpdate = false;
      
      // Check for missing isActive field
      if (data.isActive === undefined || data.isActive === null) {
        console.log(`⚠️  Branch ${branchId} missing isActive field, setting to true`);
        updates.isActive = true;
        needsUpdate = true;
      }
      
      // Check for missing name field (but has branchName)
      if (!data.name && data.branchName) {
        console.log(`⚠️  Branch ${branchId} missing name field, copying from branchName`);
        updates.name = data.branchName;
        needsUpdate = true;
      }
      
      // Check for missing required fields
      if (!data.address) {
        console.log(`⚠️  Branch ${branchId} missing address field`);
      }
      if (!data.contact) {
        console.log(`⚠️  Branch ${branchId} missing contact field`);
      }
      if (!data.email) {
        console.log(`⚠️  Branch ${branchId} missing email field`);
      }
      
      // Update if needed
      if (needsUpdate) {
        updates.updatedAt = Timestamp.now();
        await updateDoc(doc(db, 'branches', branchId), updates);
        console.log(`✅ Updated branch ${branchId}\n`);
        fixedCount++;
      }
    }
    
    console.log(`\n✅ Fix complete. Updated ${fixedCount} branches.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixBranchesData();
