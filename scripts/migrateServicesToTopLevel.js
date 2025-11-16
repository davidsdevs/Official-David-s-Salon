/**
 * Migration Script: Move Services from Subcollection to Top-Level Collection
 * 
 * OLD STRUCTURE:
 * branches/{branchId}/services/{serviceId}
 * 
 * NEW STRUCTURE:
 * services/{serviceId} with branchId field
 * 
 * USAGE:
 * node scripts/migrateServicesToTopLevel.js
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  deleteDoc 
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7EFNq5rYZn9oMbXjTPx7aOBT1SQDqeCI",
  authDomain: "capstone-project-b7f21.firebaseapp.com",
  projectId: "capstone-project-b7f21",
  storageBucket: "capstone-project-b7f21.firebasestorage.app",
  messagingSenderId: "260069662063",
  appId: "1:260069662063:web:b47b0e9dd3804dda4dfcea"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateServices() {
  try {
    console.log('🚀 Starting services migration...\n');
    
    // Get all branches
    const branchesSnapshot = await getDocs(collection(db, 'branches'));
    console.log(`📦 Found ${branchesSnapshot.size} branches\n`);
    
    let totalServices = 0;
    let migratedServices = 0;
    let errors = 0;
    
    // For each branch
    for (const branchDoc of branchesSnapshot.docs) {
      const branchId = branchDoc.id;
      const branchName = branchDoc.data().branchName;
      
      console.log(`\n📍 Processing branch: ${branchName} (${branchId})`);
      
      // Get services subcollection
      const servicesSnapshot = await getDocs(
        collection(db, 'branches', branchId, 'services')
      );
      
      console.log(`   Found ${servicesSnapshot.size} services`);
      totalServices += servicesSnapshot.size;
      
      // Migrate each service
      for (const serviceDoc of servicesSnapshot.docs) {
        try {
          const serviceId = serviceDoc.id;
          const serviceData = serviceDoc.data();
          
          // Create new top-level service document with branchId
          const newServiceRef = doc(db, 'services', serviceId);
          await setDoc(newServiceRef, {
            ...serviceData,
            branchId  // Add branchId field
          });
          
          console.log(`   ✓ Migrated: ${serviceData.serviceName} (${serviceId})`);
          migratedServices++;
          
          // Optional: Delete old subcollection document
          // Uncomment if you want to remove old data
          // await deleteDoc(doc(db, 'branches', branchId, 'services', serviceId));
          // console.log(`   🗑️ Deleted old: ${serviceId}`);
          
        } catch (error) {
          console.error(`   ✗ Error migrating service ${serviceDoc.id}:`, error.message);
          errors++;
        }
      }
    }
    
    console.log('\n\n═══════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total services found: ${totalServices}`);
    console.log(`✓ Successfully migrated: ${migratedServices}`);
    console.log(`✗ Errors: ${errors}`);
    console.log('═══════════════════════════════════════\n');
    
    if (migratedServices === totalServices && errors === 0) {
      console.log('✅ Migration completed successfully!');
      console.log('\n⚠️  NEXT STEPS:');
      console.log('1. Verify data in Firebase Console');
      console.log('2. Test application with new structure');
      console.log('3. Uncomment delete statements in script to remove old subcollection data');
      console.log('4. Deploy Firestore indexes: firebase deploy --only firestore:indexes');
      console.log('5. Deploy Firestore rules: firebase deploy --only firestore:rules\n');
    } else {
      console.log('⚠️  Migration completed with errors. Please review and retry.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateServices()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
