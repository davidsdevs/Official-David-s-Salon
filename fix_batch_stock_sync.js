/**
 * Fix Batch Stock Synchronization
 * 
 * This script fixes the data synchronization issue between:
 * - stocks collection (realTimeStock, remainingQuantity)
 * - product_batches collection (remainingQuantity)
 * 
 * Run with: node fix_batch_stock_sync.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

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

async function fixBatchStockSync() {
  console.log('🔧 Starting batch stock synchronization fix...\n');
  
  try {
    // Get all batch stocks
    const stocksQuery = query(
      collection(db, 'stocks'),
      where('stockType', '==', 'batch')
    );
    const stocksSnapshot = await getDocs(stocksQuery);
    
    console.log(`📦 Found ${stocksSnapshot.size} batch stocks to check\n`);
    
    let fixedCount = 0;
    let alreadySyncedCount = 0;
    let errorCount = 0;
    
    for (const stockDoc of stocksSnapshot.docs) {
      const stockData = stockDoc.data();
      const stockId = stockDoc.id;
      
      // Get the corresponding product_batch
      const batchQuery = query(
        collection(db, 'product_batches'),
        where('batchNumber', '==', stockData.batchNumber),
        where('branchId', '==', stockData.branchId),
        where('productId', '==', stockData.productId)
      );
      const batchSnapshot = await getDocs(batchQuery);
      
      if (batchSnapshot.empty) {
        console.log(`⚠️  No product_batch found for stock ${stockId} (${stockData.productName})`);
        errorCount++;
        continue;
      }
      
      const batchDoc = batchSnapshot.docs[0];
      const batchData = batchDoc.data();
      const batchId = batchDoc.id;
      
      // Compare values
      const stockRealTime = Number(stockData.realTimeStock) || 0;
      const stockRemaining = Number(stockData.remainingQuantity) || 0;
      const batchRemaining = Number(batchData.remainingQuantity) || 0;
      
      console.log(`\n📊 ${stockData.productName}`);
      console.log(`   Batch: ${stockData.batchNumber}`);
      console.log(`   Stock ID: ${stockId}`);
      console.log(`   Batch ID: ${batchId}`);
      console.log(`   Current values:`);
      console.log(`     - stocks.realTimeStock: ${stockRealTime}`);
      console.log(`     - stocks.remainingQuantity: ${stockRemaining}`);
      console.log(`     - product_batches.remainingQuantity: ${batchRemaining}`);
      
      // Check if sync is needed
      if (stockRealTime === stockRemaining && stockRealTime === batchRemaining) {
        console.log(`   ✅ Already synced`);
        alreadySyncedCount++;
        continue;
      }
      
      // Sync needed - use stocks.realTimeStock as source of truth
      console.log(`   🔄 Syncing to: ${stockRealTime}`);
      
      const batch = writeBatch(db);
      
      // Update stocks collection
      if (stockRemaining !== stockRealTime) {
        const stockRef = doc(db, 'stocks', stockId);
        batch.update(stockRef, {
          remainingQuantity: stockRealTime,
          updatedAt: serverTimestamp()
        });
        console.log(`   📝 Updating stocks.remainingQuantity: ${stockRemaining} → ${stockRealTime}`);
      }
      
      // Update product_batches collection
      if (batchRemaining !== stockRealTime) {
        const batchRef = doc(db, 'product_batches', batchId);
        const newStatus = stockRealTime <= 0 ? 'depleted' : 'active';
        batch.update(batchRef, {
          remainingQuantity: stockRealTime,
          status: newStatus,
          updatedAt: serverTimestamp()
        });
        console.log(`   📝 Updating product_batches.remainingQuantity: ${batchRemaining} → ${stockRealTime}`);
        console.log(`   📝 Updating product_batches.status: ${batchData.status} → ${newStatus}`);
      }
      
      // Commit the batch
      await batch.commit();
      console.log(`   ✅ Synced successfully`);
      fixedCount++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Fixed: ${fixedCount} stocks`);
    console.log(`✓  Already synced: ${alreadySyncedCount} stocks`);
    console.log(`⚠️  Errors: ${errorCount} stocks`);
    console.log(`📦 Total checked: ${stocksSnapshot.size} stocks`);
    console.log('='.repeat(60));
    
    if (fixedCount > 0) {
      console.log('\n🎉 Synchronization complete!');
      console.log('💡 Next steps:');
      console.log('   1. Hard refresh your browser (Ctrl+Shift+R)');
      console.log('   2. Try the deduction again');
      console.log('   3. It should work now!');
    } else if (alreadySyncedCount === stocksSnapshot.size) {
      console.log('\n✨ All stocks are already synchronized!');
      console.log('💡 If you still see errors, try:');
      console.log('   1. Hard refresh your browser (Ctrl+Shift+R)');
      console.log('   2. Check the specific stock in Firestore console');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during synchronization:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the fix
fixBatchStockSync();
