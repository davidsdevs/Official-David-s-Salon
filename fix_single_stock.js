/**
 * Fix Single Stock Synchronization
 * 
 * Quick fix for a specific stock by batch number.
 * Usage: node fix_single_stock.js "PO-2JC-01-SUP-001"
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixSingleStock(batchNumber) {
  console.log(`🔧 Fixing stock for batch: ${batchNumber}\n`);
  
  try {
    // Get the stock
    const stocksSnapshot = await db.collection('stocks')
      .where('batchNumber', '==', batchNumber)
      .where('stockType', '==', 'batch')
      .get();
    
    if (stocksSnapshot.empty) {
      console.log(`❌ No stock found with batch number: ${batchNumber}`);
      return;
    }
    
    const stockDoc = stocksSnapshot.docs[0];
    const stockData = stockDoc.data();
    const stockId = stockDoc.id;
    
    // Get the corresponding product_batch
    const batchSnapshot = await db.collection('product_batches')
      .where('batchNumber', '==', batchNumber)
      .where('branchId', '==', stockData.branchId)
      .where('productId', '==', stockData.productId)
      .get();
    
    if (batchSnapshot.empty) {
      console.log(`❌ No product_batch found for batch: ${batchNumber}`);
      return;
    }
    
    const batchDoc = batchSnapshot.docs[0];
    const batchData = batchDoc.data();
    const batchId = batchDoc.id;
    
    // Show current values
    const stockRealTime = Number(stockData.realTimeStock) || 0;
    const stockRemaining = Number(stockData.remainingQuantity) || 0;
    const batchRemaining = Number(batchData.remainingQuantity) || 0;
    
    console.log(`📊 ${stockData.productName}`);
    console.log(`   Batch: ${batchNumber}`);
    console.log(`   Stock ID: ${stockId}`);
    console.log(`   Batch ID: ${batchId}`);
    console.log(`\n   BEFORE:`);
    console.log(`     - stocks.realTimeStock: ${stockRealTime}`);
    console.log(`     - stocks.remainingQuantity: ${stockRemaining}`);
    console.log(`     - product_batches.remainingQuantity: ${batchRemaining}`);
    
    // Sync to realTimeStock
    console.log(`\n   🔄 Syncing all to: ${stockRealTime}`);
    
    const batch = db.batch();
    
    // Update stocks collection
    const stockRef = db.collection('stocks').doc(stockId);
    batch.update(stockRef, {
      remainingQuantity: stockRealTime,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Update product_batches collection
    const batchRef = db.collection('product_batches').doc(batchId);
    const newStatus = stockRealTime <= 0 ? 'depleted' : 'active';
    batch.update(batchRef, {
      remainingQuantity: stockRealTime,
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Commit
    await batch.commit();
    
    console.log(`\n   AFTER:`);
    console.log(`     - stocks.realTimeStock: ${stockRealTime}`);
    console.log(`     - stocks.remainingQuantity: ${stockRealTime}`);
    console.log(`     - product_batches.remainingQuantity: ${stockRealTime}`);
    console.log(`     - product_batches.status: ${newStatus}`);
    
    console.log(`\n✅ Fixed successfully!`);
    console.log(`💡 Hard refresh your browser (Ctrl+Shift+R) and try again`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Get batch number from command line
const batchNumber = process.argv[2];

if (!batchNumber) {
  console.log('❌ Usage: node fix_single_stock.js "BATCH-NUMBER"');
  console.log('   Example: node fix_single_stock.js "PO-2JC-01-SUP-001"');
  process.exit(1);
}

// Run the fix
fixSingleStock(batchNumber)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
