/**
 * Script to create test users for DSMS
 * Run with: node scripts/createTestUsers.js
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);
const db = getFirestore(app);

// Test users to create
const testUsers = [
  {
    email: 'admin@davidsalon.com',
    password: 'admin123',
    displayName: 'System Administrator',
    role: 'system_admin',
    branchId: null
  },
  {
    email: 'owner@davidsalon.com',
    password: 'owner123',
    displayName: 'Franchise Owner',
    role: 'franchise_owner',
    branchId: null
  },
  {
    email: 'manager@davidsalon.com',
    password: 'manager123',
    displayName: 'Branch Manager',
    role: 'branch_manager',
    branchId: 'branch_001'
  },
  {
    email: 'receptionist@davidsalon.com',
    password: 'recept123',
    displayName: 'Front Desk Receptionist',
    role: 'receptionist',
    branchId: 'branch_001'
  },
  {
    email: 'inventory@davidsalon.com',
    password: 'inventory123',
    displayName: 'Inventory Controller',
    role: 'inventory_controller',
    branchId: 'branch_001'
  },
  {
    email: 'stylist@davidsalon.com',
    password: 'stylist123',
    displayName: 'Sarah Stylist',
    role: 'stylist',
    branchId: 'branch_001'
  },
  {
    email: 'client@davidsalon.com',
    password: 'client123',
    displayName: 'John Client',
    role: 'client',
    branchId: null
  }
];

async function createUser(userData) {
  try {
    console.log(`Creating user: ${userData.email}...`);
    
    // Create authentication user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );
    
    const user = userCredential.user;
    console.log(`✅ Auth user created with UID: ${user.uid}`);
    
    // Create Firestore user document
    await setDoc(doc(db, 'users', user.uid), {
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
    
    return { success: true, uid: user.uid };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`⚠️  User ${userData.email} already exists`);
    } else {
      console.error(`❌ Error creating ${userData.email}:`, error.message);
    }
    console.log('---');
    return { success: false, error: error.message };
  }
}

async function createAllUsers() {
  console.log('🚀 Starting test user creation...\n');
  
  const results = [];
  
  for (const userData of testUsers) {
    const result = await createUser(userData);
    results.push({ email: userData.email, ...result });
    
    // Wait a bit between creations to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Summary:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successfully created: ${successful} users`);
  console.log(`❌ Failed: ${failed} users`);
  
  console.log('\n📝 Test User Credentials:');
  console.log('='.repeat(50));
  testUsers.forEach(user => {
    console.log(`${user.role.padEnd(25)} | ${user.email} | ${user.password}`);
  });
  
  console.log('\n✨ Done! You can now login with any of the above credentials.');
  process.exit(0);
}

// Run the script
createAllUsers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
