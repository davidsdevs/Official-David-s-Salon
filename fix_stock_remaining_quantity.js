/**
 * Fix Stock remainingQuantity Inconsistency
 * 
 * Problem: stocks collection has incorrect remainingQuantity values
 * - realTimeStock: 6 (correct)
 * - remainingQuantity: 10 (wrong - should match realTimeStock)
 * 
 * This script syncs remainingQuantity with realTimeStock for all batch stocks
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixStockRemainingQuantity() {
  try {
    console.log('🔍 Fetching all batch stocks...');
    
    // Get all batch stocks
    const stocksRef = collection(db, 'stocks');
    const batchStocksQuery = query(
      stocksRef,
      where('stockType', '==', 'batch')
    );
    
    const snapshot = await getDocs(batchStocksQuery);
    console.log(`📦 Found ${snapshot.docs.length} batch stocks`);
    
    if (snapshot.docs.length === 0) {
      console.log('✅ No batch stocks to fix');
      return;
    }
    
    // Check for inconsistencies
    const inconsistentStocks = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const realTimeStock = Number(data.realTimeStock) || 0;
      const remainingQuantity = Number(data.remainingQuantity) || 0;
      
      if (realTimeStock !== remainingQuantity) {
        inconsistentStocks.push({
          id: doc.id,
          productName: data.productName,
          batchNumber: data.batchNumber,
          realTimeStock,
          remainingQuantity,
          difference: remainingQuantity - realTimeStock
        });
      }
    });
    
    if (inconsistentStocks.length === 0) {
      console.log('✅ All batch stocks are consistent!');
      return;
    }
    
    console.log(`\n⚠️  Found ${inconsistentStocks.length} inconsistent stocks:`);
    inconsistentStocks.forEach(stock => {
      console.log(`  - ${stock.productName} (${stock.batchNumber})`);
      console.log(`    realTimeStock: ${stock.realTimeStock}`);
      console.log(`    remainingQuantity: ${stock.remainingQuantity}`);
      console.log(`    difference: ${stock.difference}`);
    });
    
    console.log('\n🔧 Fixing inconsistencies...');
    
    // Fix in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < inconsistentStocks.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = inconsistentStocks.slice(i, i + batchSize);
      
      chunk.forEach(stock => {
        const stockRef = doc(db, 'stocks', stock.id);
        batch.update(stockRef, {
          remainingQuantity: stock.realTimeStock,
          updatedAt: new Date()
        });
      });
      
      await batch.commit();
      console.log(`✅ Fixed ${chunk.length} stocks (batch ${Math.floor(i / batchSize) + 1})`);
    }
    
    console.log('\n✅ All inconsistencies fixed!');
    console.log('📊 Summary:');
    console.log(`  - Total batch stocks: ${snapshot.docs.length}`);
    console.log(`  - Fixed stocks: ${inconsistentStocks.length}`);
    console.log(`  - Consistent stocks: ${snapshot.docs.length - inconsistentStocks.length}`);
    
  } catch (error) {
    console.error('❌ Error fixing stock remainingQuantity:', error);
    throw error;
  }
}

// Run the fix
fixStockRemainingQuantity()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
