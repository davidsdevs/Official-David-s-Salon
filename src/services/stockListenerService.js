// src/services/stockListenerService.js
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';

class StockListenerService {
  constructor() {
    this.unsubscribers = new Map(); // Store unsubscribe functions by branchId
    this.processedTransactions = new Set(); // Track processed transactions to avoid duplicates
  }

  /**
   * Start listening to transactions for a specific branch
   * Automatically deducts stock when products are sold
   * @param {string} branchId - Branch ID to listen to
   * @param {Function} onStockUpdated - Callback when stock is updated
   */
  startListening(branchId, onStockUpdated = null) {
    if (!branchId) {
      console.error('Branch ID is required for stock listener');
      return null;
    }

    // Stop existing listener for this branch if any
    this.stopListening(branchId);

    console.log(`Starting stock listener for branch: ${branchId}`);

    // Listen to transactions with products
    // Note: Firestore 'in' query supports max 10 values, so we'll filter client-side for status
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('branchId', '==', branchId)
      // Note: We filter by status client-side to avoid 'in' query limitations
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const transactionData = change.doc.data();
        const transactionId = change.doc.id;

        // Skip if already processed
        if (this.processedTransactions.has(transactionId)) {
          return;
        }

        // Get transaction status
        const status = transactionData.status || '';
        const isPaidOrCompleted = status === 'paid' || status === 'completed' || status === 'Paid' || status === 'Completed';
        const isVoided = status === 'voided' || status === 'Voided' || status === 'cancelled' || status === 'Cancelled';
        
        // Handle voided transactions - return stock back
        const salesType = transactionData.salesType || '';
        const hasProducts = salesType === 'product' || salesType === 'mixed';
        const productItems = (transactionData.items || []).filter(item => item.type === 'product');
        
        if ((change.type === 'added' || change.type === 'modified') && 
            isVoided &&
            hasProducts &&
            productItems.length > 0 &&
            transactionData.stockDeducted) { // Only return if stock was previously deducted
          
          // Skip if already processed for void
          if (this.processedTransactions.has(`${transactionId}_voided`)) {
            return;
          }

          // Mark as processed
          this.processedTransactions.add(`${transactionId}_voided`);

          try {
            await this.returnTransactionProducts(transactionData, transactionId);
            
            // Mark transaction as having stock returned
            try {
              await updateDoc(doc(db, 'transactions', transactionId), {
                stockReturned: true,
                stockReturnedAt: serverTimestamp()
              });
            } catch (updateError) {
              console.error('Error marking transaction as stock returned:', updateError);
            }
            
            if (onStockUpdated) {
              onStockUpdated(transactionId, transactionData);
            }
          } catch (error) {
            console.error(`Error returning stock for voided transaction ${transactionId}:`, error);
            // Remove from processed set so it can be retried
            this.processedTransactions.delete(`${transactionId}_voided`);
          }
        }
        // Handle paid/completed transactions - deduct stock
        else if ((change.type === 'added' || change.type === 'modified') && 
            isPaidOrCompleted &&
            hasProducts &&
            productItems.length > 0 &&
            !transactionData.stockDeducted) { // Check if stock was already deducted
          
          // Mark as processed
          this.processedTransactions.add(transactionId);

          try {
            await this.processTransactionProducts(transactionData, transactionId);
            
            // Mark transaction as having stock deducted
            try {
              await updateDoc(doc(db, 'transactions', transactionId), {
                stockDeducted: true,
                stockDeductedAt: serverTimestamp()
              });
            } catch (updateError) {
              console.error('Error marking transaction as processed:', updateError);
            }
            
            if (onStockUpdated) {
              onStockUpdated(transactionId, transactionData);
            }
          } catch (error) {
            console.error(`Error processing transaction ${transactionId}:`, error);
            // Remove from processed set so it can be retried
            this.processedTransactions.delete(transactionId);
          }
        }
      });
    }, (error) => {
      console.error('Error in stock listener:', error);
    });

    this.unsubscribers.set(branchId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Process products in a transaction and deduct stock
   * @param {Object} transactionData - Transaction data
   * @param {string} transactionId - Transaction ID
   */
  async processTransactionProducts(transactionData, transactionId) {
    const { items, branchId } = transactionData;

    // Filter items to get only products
    const productItems = (items || []).filter(item => item.type === 'product');

    if (!productItems || productItems.length === 0) {
      return;
    }

    if (!branchId) {
      console.error('Transaction missing branchId:', transactionId);
      return;
    }

    const stockUpdates = [];
    let needsBatchCommit = false;
    const fallbackBatch = writeBatch(db);

    // Process each product in the transaction
    for (const product of productItems) {
      const productId = product.id || product.productId;
      const quantity = parseInt(product.quantity || 1);

      if (!productId || quantity <= 0) {
        console.warn(`Invalid product data in transaction ${transactionId}:`, product);
        continue;
      }

      try {
        // Use FIFO to deduct from batches (oldest batches first)
        const { inventoryService } = await import('./inventoryService');
        
        const deductionResult = await inventoryService.deductStockFIFO({
          branchId,
          productId,
          quantity,
          reason: 'Transaction Sale',
          notes: `Transaction ID: ${transactionId}`,
          createdBy: transactionData.createdBy || 'system',
          productName: product.name || product.productName || 'Unknown Product'
        });

        if (!deductionResult.success) {
          console.warn(`FIFO deduction failed for product ${productId}:`, deductionResult.message);
          // Fallback to old method if FIFO fails (no batches exist)
          const stocksRef = collection(db, 'stocks');
          const stockQuery = query(
            stocksRef,
            where('branchId', '==', branchId),
            where('productId', '==', productId),
            where('status', '==', 'active')
          );

          const stockSnapshot = await getDocs(stockQuery);
          
          if (!stockSnapshot.empty) {
            const stockDoc = stockSnapshot.docs[0];
            const stockData = stockDoc.data();
            const stockRef = stockDoc.ref;

            const currentRealTimeStock = parseInt(stockData.realTimeStock || stockData.beginningStock || 0);
            const newRealTimeStock = Math.max(0, currentRealTimeStock - quantity);

            fallbackBatch.update(stockRef, {
              realTimeStock: newRealTimeStock,
              updatedAt: serverTimestamp()
            });
            needsBatchCommit = true;

            stockUpdates.push({
              productId,
              productName: product.name || product.productName || stockData.productName || 'Unknown Product',
              quantity,
              previousStock: currentRealTimeStock,
              newStock: newRealTimeStock,
              method: 'fallback' // Indicates FIFO wasn't used
            });
          }
        } else {
          // FIFO deduction successful
          const batchesUsed = deductionResult.batchesUsed || [];
          stockUpdates.push({
            productId,
            productName: product.name || product.productName || 'Unknown Product',
            quantity,
            method: 'FIFO',
            batchesUsed: batchesUsed.map(b => ({
              batchNumber: b.batchNumber,
              deducted: b.deducted,
              remaining: b.remaining
            }))
          });
        }

        // Log activity (only if we have stock update info)
        if (stockUpdates.length > 0) {
          const stockUpdate = stockUpdates[stockUpdates.length - 1];
          try {
            const branchDoc = await getDoc(doc(db, 'branches', branchId));
            const branchName = branchDoc.exists() ? branchDoc.data().name || 'Unknown Branch' : 'Unknown Branch';
            
            const userName = transactionData.createdBy || 'System';
            const userDoc = await getDoc(doc(db, 'users', userName));
            const userData = userDoc.exists() ? userDoc.data() : {};
            const displayName = userData.displayName || userData.name || userData.email || 'Unknown User';

            // Get stock document ID for logging
            const stocksRef = collection(db, 'stocks');
            const stockQuery = query(
              stocksRef,
              where('branchId', '==', branchId),
              where('productId', '==', productId),
              where('status', '==', 'active')
            );
            const stockSnapshot = await getDocs(stockQuery);
            const stockDocId = stockSnapshot.empty ? productId : stockSnapshot.docs[0].id;

            await logActivity({
              action: 'stock_deducted',
              performedBy: userName,
              branchId,
              details: {
                module: 'stocks',
                entityType: 'stock',
                entityId: stockDocId,
                entityName: stockUpdate.productName || 'Unknown Product',
                transactionId,
                quantity,
                method: stockUpdate.method || 'FIFO',
                before: { realTimeStock: stockUpdate.previousStock || 0 },
                after: { realTimeStock: stockUpdate.newStock || 0 },
                batchesUsed: stockUpdate.batchesUsed || [],
                reason: 'Product sale from transaction',
                notes: `Stock deducted from transaction ${transactionId}. Quantity: ${quantity}. Method: ${stockUpdate.method || 'FIFO'}${stockUpdate.batchesUsed && stockUpdate.batchesUsed.length > 0 ? `. Batches: ${stockUpdate.batchesUsed.map(b => b.batchNumber).join(', ')}` : ''}`
              }
            });
          } catch (logError) {
            console.error('Error logging stock deduction activity:', logError);
            // Don't fail the stock update if logging fails
          }
        }

      } catch (error) {
        console.error(`Error processing product ${productId} in transaction ${transactionId}:`, error);
        // Continue with other products even if one fails
      }
    }

    // Commit fallback batch if it was used (only needed when FIFO fails)
    if (needsBatchCommit) {
      try {
        await fallbackBatch.commit();
        console.log(`Fallback stock update committed for transaction ${transactionId}`);
      } catch (commitError) {
        console.error(`Error committing fallback batch for transaction ${transactionId}:`, commitError);
      }
    }
    
    if (stockUpdates.length > 0) {
      console.log(`Stock updated for ${stockUpdates.length} products from transaction ${transactionId}`);
    }
  }

  /**
   * Stop listening to transactions for a specific branch
   * @param {string} branchId - Branch ID
   */
  stopListening(branchId) {
    const unsubscribe = this.unsubscribers.get(branchId);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(branchId);
      console.log(`Stopped stock listener for branch: ${branchId}`);
    }
  }

  /**
   * Return stock for voided transactions
   * @param {Object} transactionData - Transaction data
   * @param {string} transactionId - Transaction ID
   */
  async returnTransactionProducts(transactionData, transactionId) {
    const { items, branchId } = transactionData;

    // Filter items to get only products
    const productItems = (items || []).filter(item => item.type === 'product');

    if (!productItems || productItems.length === 0) {
      return;
    }

    if (!branchId) {
      console.error('Transaction missing branchId:', transactionId);
      return;
    }

    const batch = writeBatch(db);
    const stockReturns = [];

    // Process each product in the transaction
    for (const product of productItems) {
      const productId = product.id || product.productId;
      const quantity = parseInt(product.quantity || 1);

      if (!productId || quantity <= 0) {
        console.warn(`Invalid product data in transaction ${transactionId}:`, product);
        continue;
      }

      try {
        // Find the current active stock record for this product
        const stocksRef = collection(db, 'stocks');
        const stockQuery = query(
          stocksRef,
          where('branchId', '==', branchId),
          where('productId', '==', productId),
          where('status', '==', 'active')
        );

        const stockSnapshot = await getDocs(stockQuery);
        
        if (stockSnapshot.empty) {
          console.warn(`No active stock found for product ${productId} in branch ${branchId}`);
          continue;
        }

        // Get the most recent stock record
        const stockDoc = stockSnapshot.docs[0];
        const stockData = stockDoc.data();
        const stockRef = stockDoc.ref;

        const currentRealTimeStock = parseInt(stockData.realTimeStock || stockData.beginningStock || 0);
        const newRealTimeStock = currentRealTimeStock + quantity; // Add back the quantity

        // Update stock
        batch.update(stockRef, {
          realTimeStock: newRealTimeStock,
          updatedAt: serverTimestamp()
        });

        stockReturns.push({
          productId,
          productName: product.name || product.productName || stockData.productName || 'Unknown Product',
          quantity,
          previousStock: currentRealTimeStock,
          newStock: newRealTimeStock
        });

        // Log activity
        try {
          const branchDoc = await getDoc(doc(db, 'branches', branchId));
          const branchName = branchDoc.exists() ? branchDoc.data().name || 'Unknown Branch' : 'Unknown Branch';
          
          const userName = transactionData.createdBy || 'System';
          const userDoc = await getDoc(doc(db, 'users', userName));
          const userData = userDoc.exists() ? userDoc.data() : {};
          const displayName = userData.displayName || userData.name || userData.email || 'Unknown User';

          await logActivity({
            action: 'stock_returned',
            performedBy: userName,
            branchId,
            details: {
              module: 'stocks',
              entityType: 'stock',
              entityId: stockDoc.id,
              entityName: product.name || product.productName || stockData.productName || 'Unknown Product',
              transactionId,
              quantity,
              before: { realTimeStock: currentRealTimeStock },
              after: { realTimeStock: newRealTimeStock },
              reason: 'Transaction voided - stock returned',
              notes: `Stock returned from voided transaction ${transactionId}. Quantity: ${quantity}`
            }
          });
        } catch (logError) {
          console.error('Error logging stock return activity:', logError);
          // Don't fail the stock update if logging fails
        }

      } catch (error) {
        console.error(`Error returning stock for product ${productId} in transaction ${transactionId}:`, error);
        // Continue with other products even if one fails
      }
    }

    // Commit all stock updates
    if (stockReturns.length > 0) {
      await batch.commit();
      console.log(`Stock returned for ${stockReturns.length} products from voided transaction ${transactionId}`);
    }
  }

  /**
   * Stop all listeners
   */
  stopAllListeners() {
    this.unsubscribers.forEach((unsubscribe, branchId) => {
      unsubscribe();
      console.log(`Stopped stock listener for branch: ${branchId}`);
    });
    this.unsubscribers.clear();
    this.processedTransactions.clear();
  }

  /**
   * Clear processed transactions cache (useful for testing or manual reprocessing)
   */
  clearProcessedCache() {
    this.processedTransactions.clear();
  }
}

export const stockListenerService = new StockListenerService();
export default stockListenerService;

