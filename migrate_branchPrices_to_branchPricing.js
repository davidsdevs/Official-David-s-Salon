/**
 * Migration Script: Rename branchPrices to branchPricing
 * 
 * This script migrates the old branchPrices field to the new branchPricing field
 * in the services collection.
 * 
 * OLD: branchPrices: { "branchId": { price: 1900 } }
 * NEW: branchPricing: { "branchId": 1900 }
 * 
 * Run this script once to migrate all services.
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  deleteField
} from 'firebase/firestore';

// Firebase configuration
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

async function migrateBranchPrices() {
  console.log('🔄 Starting migration: branchPrices → branchPricing');
  console.log('================================================\n');

  try {
    // Get all services
    const servicesRef = collection(db, 'services');
    const snapshot = await getDocs(servicesRef);
    
    console.log(`📊 Found ${snapshot.size} services to check\n`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const serviceDoc of snapshot.docs) {
      const serviceId = serviceDoc.id;
      const data = serviceDoc.data();
      const serviceName = data.name || data.serviceName || serviceId;
      
      console.log(`\n📋 Checking: ${serviceName} (${serviceId})`);
      
      // Check if has old branchPrices field
      if (data.branchPrices && typeof data.branchPrices === 'object') {
        console.log(`   ✓ Has old branchPrices field`);
        
        // Convert old format to new format
        const branchPricing = {};
        
        for (const [branchId, priceData] of Object.entries(data.branchPrices)) {
          // OLD: { "branchId": { price: 1900 } }
          // NEW: { "branchId": 1900 }
          if (priceData && typeof priceData === 'object' && priceData.price !== undefined) {
            branchPricing[branchId] = priceData.price;
            console.log(`   → Converting ${branchId}: { price: ${priceData.price} } → ${priceData.price}`);
          } else if (typeof priceData === 'number') {
            // Already in new format
            branchPricing[branchId] = priceData;
            console.log(`   → Keeping ${branchId}: ${priceData} (already correct format)`);
          }
        }
        
        try {
          // Update document with new field and remove old field
          const serviceRef = doc(db, 'services', serviceId);
          await updateDoc(serviceRef, {
            branchPricing: branchPricing,
            branchPrices: deleteField() // Remove old field
          });
          
          console.log(`   ✅ Migrated successfully`);
          console.log(`   📝 New branchPricing:`, branchPricing);
          migratedCount++;
        } catch (error) {
          console.error(`   ❌ Error migrating:`, error.message);
          errorCount++;
        }
      } else if (data.branchPricing && typeof data.branchPricing === 'object') {
        console.log(`   ⏭️  Already has branchPricing field (skipped)`);
        console.log(`   📝 Current branchPricing:`, data.branchPricing);
        skippedCount++;
      } else {
        console.log(`   ⏭️  No pricing fields (skipped)`);
        skippedCount++;
      }
    }
    
    console.log('\n\n================================================');
    console.log('✅ Migration Complete!');
    console.log('================================================');
    console.log(`📊 Summary:`);
    console.log(`   - Total services: ${snapshot.size}`);
    console.log(`   - Migrated: ${migratedCount}`);
    console.log(`   - Skipped: ${skippedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log('================================================\n');
    
    if (errorCount > 0) {
      console.log('⚠️  Some services had errors. Please check the logs above.');
    } else if (migratedCount > 0) {
      console.log('🎉 All services migrated successfully!');
    } else {
      console.log('ℹ️  No services needed migration.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateBranchPrices()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
