/**
 * Script to add Firestore user documents for existing Authentication users
 * Run with: node scripts/addFirestoreUsers.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDP4pyClJ6KW5AJ9IaPULjDF660u8X7mmU",
  authDomain: "davids-salon.firebaseapp.com",
  projectId: "davids-salon",
  storageBucket: "davids-salon.firebasestorage.app",
  messagingSenderId: "217282497534",
  appId: "1:217282497534:web:a067668a20972ae33c8eaf",
  measurementId: "G-LZWCED7N87"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// User data with UIDs from Authentication
const users = [
  {
    uid: 'nWIccWe4SLMqffWjufnAyVK1Rft1',
    email: 'admin@davidsalon.com',
    displayName: 'System Administrator',
    role: 'system_admin',
    branchId: null
  },
  {
    uid: 'T6SVfwuNppbcvmFiawT5GvJBd3y2',
    email: 'owner@davidsalon.com',
    displayName: 'Franchise Owner',
    role: 'franchise_owner',
    branchId: null
  },
  {
    uid: 'eRretnlIXQWZV8BPIZCLAvda6d62',
    email: 'manager@davidsalon.com',
    displayName: 'Branch Manager',
    role: 'branch_manager',
    branchId: 'branch_001'
  },
  {
    uid: 'xAOyEfBZLvbNTDvrJKpJ4b2HXiO2',
    email: 'receptionist@davidsalon.com',
    displayName: 'Front Desk Receptionist',
    role: 'receptionist',
    branchId: 'branch_001'
  },
  {
    uid: 'khJAMkivc3VvxVnOtxGaKHmrcVZ2',
    email: 'inventory@davidsalon.com',
    displayName: 'Inventory Controller',
    role: 'inventory_controller',
    branchId: 'branch_001'
  },
  {
    uid: 'pOy2IVdgU6X4MmC4VvnXrmdpi0z2',
    email: 'stylist@davidsalon.com',
    displayName: 'Sarah Stylist',
    role: 'stylist',
    branchId: 'branch_001'
  },
  {
    uid: '4EUHbw9bWQWlvrPpGRNzeaREVct1',
    email: 'client@davidsalon.com',
    displayName: 'John Client',
    role: 'client',
    branchId: null
  }
];

async function addFirestoreDocument(userData) {
  try {
    console.log(`Creating Firestore document for: ${userData.email}...`);
    
    await setDoc(doc(db, 'users', userData.uid), {
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role,
      branchId: userData.branchId,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log(`✅ Firestore document created for ${userData.displayName}`);
    console.log('---');
    
    return { success: true };
  } catch (error) {
    console.error(`❌ Error creating document for ${userData.email}:`, error.message);
    console.log('---');
    return { success: false, error: error.message };
  }
}

async function addAllDocuments() {
  console.log('🚀 Starting Firestore document creation...\n');
  
  const results = [];
  
  for (const userData of users) {
    const result = await addFirestoreDocument(userData);
    results.push({ email: userData.email, ...result });
    
    // Wait a bit between creations
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 Summary:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successfully created: ${successful} documents`);
  console.log(`❌ Failed: ${failed} documents`);
  
  if (successful > 0) {
    console.log('\n✨ Done! You can now login with the test credentials.');
    console.log('\n📝 Test Login:');
    console.log('Email: admin@davidsalon.com');
    console.log('Password: admin123');
  }
  
  process.exit(0);
}

// Run the script
addAllDocuments().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
