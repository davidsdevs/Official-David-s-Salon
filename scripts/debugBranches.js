/**
 * Debug script to check branch data in Firestore
 * Run with: node scripts/debugBranches.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

async function debugBranches() {
  try {
    console.log('🔍 Fetching all branches from Firestore...\n');
    
    const branchesRef = collection(db, 'branches');
    const snapshot = await getDocs(branchesRef);
    
    console.log(`📊 Total branches found: ${snapshot.size}\n`);
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n--- Branch ${index + 1} ---`);
      console.log(`ID: ${doc.id}`);
      console.log(`Name: ${data.name || data.branchName || 'MISSING'}`);
      console.log(`Address: ${data.address || 'MISSING'}`);
      console.log(`Contact: ${data.contact || 'MISSING'}`);
      console.log(`Email: ${data.email || 'MISSING'}`);
      console.log(`isActive: ${data.isActive !== undefined ? data.isActive : 'MISSING'}`);
      console.log(`Full data:`, JSON.stringify(data, null, 2));
    });
    
    console.log('\n✅ Debug complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugBranches();
