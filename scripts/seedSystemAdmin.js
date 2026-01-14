/**
 * Seed System Admin User
 * Run with: node scripts/seedSystemAdmin.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Firebase configuration - using the new project
const firebaseConfig = {
  apiKey: "AIzaSyAehuymW1M3_OuAb0_QKGe5SvF50RQMXyc",
  authDomain: "official-david-salon-a6450.firebaseapp.com",
  projectId: "official-david-salon-a6450",
  storageBucket: "official-david-salon-a6450.firebasestorage.app",
  messagingSenderId: "842310549544",
  appId: "1:842310549544:web:751ba88fa246e6b362751d",
  measurementId: "G-2KD6VW398N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DEFAULT PASSWORD FOR ALL ROLES: "admin123"
const DEFAULT_PASSWORD = "admin123";

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function createSystemAdminUser() {
  // Hash the default password for all roles
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  
  return {
    branchId: "KYiL9JprSX3LBOYzrF6e",
    createdAt: Timestamp.now(),
    createdBy: "SYSTEM_SEED",
    email: "sso_account@gmail.com",
    firstName: "SSO",
    isActive: true,
    lastLoginAt: null,
    lastName: "ACCOUNT",
    middleName: "",
    phone: "+63 9465034725",
    role: "systemAdmin",
    rolePasswords: {
      branchManager: hashedPassword,
      inventoryController: hashedPassword,
      operationalManager: hashedPassword,
      overallInventoryController: hashedPassword,
      receptionist: hashedPassword,
      stylist: hashedPassword,
      systemAdmin: hashedPassword
    },
    roles: [
      "branchManager",
      "inventoryController",
      "operationalManager",
      "overallInventoryController",
      "receptionist",
      "stylist",
      "systemAdmin"
    ],
    updatedAt: Timestamp.now(),
    updatedBy: "SYSTEM_SEED"
  };
}

async function seedSystemAdmin() {
  try {
    console.log('🚀 Starting System Admin seed...\n');
    
    // Create user with hashed passwords
    const systemAdminUser = await createSystemAdminUser();
    
    // Generate a document ID (or use a specific one)
    const userId = 'sso_admin_001';
    
    // Create the user document
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, systemAdminUser);
    
    console.log('✅ System Admin user created successfully!');
    console.log('\n📋 User Details:');
    console.log('   Document ID:', userId);
    console.log('   Email:', systemAdminUser.email);
    console.log('   Name:', `${systemAdminUser.firstName} ${systemAdminUser.lastName}`);
    console.log('   Role:', systemAdminUser.role);
    console.log('   Roles:', systemAdminUser.roles.join(', '));
    console.log('   Branch ID:', systemAdminUser.branchId);
    console.log('   Is Active:', systemAdminUser.isActive);
    console.log('\n🔐 PASSWORD FOR ALL ROLES: admin123');
    console.log('\n✨ Done! You can now login with this user.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding System Admin:', error);
    process.exit(1);
  }
}

// Run the seed
seedSystemAdmin();
