/**
 * BIR Receipt Batch Service
 * Manages BIR-issued receipt number batches for branches
 * 
 * Flow:
 * 1. Branch Manager inputs a batch from HQ (e.g., start: 0001, end: 0500)
 * 2. When receptionist creates a transaction, receipt number auto-increments from the batch
 * 3. Once batch is exhausted, they need a new batch from HQ
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc,
  updateDoc,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';

const BIR_BATCHES_COLLECTION = 'bir_receipt_batches';

/**
 * Create a new BIR receipt batch for a branch
 * @param {Object} batchData - Batch information
 * @param {string} batchData.branchId - Branch ID
 * @param {string} batchData.prefix - Receipt prefix (e.g., "DS" for David's Salon)
 * @param {number} batchData.startNumber - Starting receipt number
 * @param {number} batchData.endNumber - Ending receipt number
 * @param {string} batchData.notes - Optional notes
 * @param {Object} currentUser - User creating the batch
 * @returns {Promise<Object>} - Created batch data
 */
export const createBIRReceiptBatch = async (batchData, currentUser) => {
  try {
    const { branchId, prefix, startNumber, endNumber, notes } = batchData;
    
    // Validate inputs
    if (!branchId) throw new Error('Branch ID is required');
    if (!prefix || prefix.trim() === '') throw new Error('Receipt prefix is required');
    if (!startNumber || startNumber < 1) throw new Error('Start number must be at least 1');
    if (!endNumber || endNumber < startNumber) throw new Error('End number must be greater than start number');
    
    // Check for overlapping batches
    const existingBatches = await getBIRReceiptBatches(branchId);
    for (const batch of existingBatches) {
      if (batch.prefix === prefix.trim().toUpperCase()) {
        // Check if ranges overlap
        if (
          (startNumber >= batch.startNumber && startNumber <= batch.endNumber) ||
          (endNumber >= batch.startNumber && endNumber <= batch.endNumber) ||
          (startNumber <= batch.startNumber && endNumber >= batch.endNumber)
        ) {
          throw new Error(`Receipt numbers overlap with existing batch: ${batch.prefix}-${batch.startNumber} to ${batch.prefix}-${batch.endNumber}`);
        }
      }
    }
    
    const userId = currentUser?.uid || currentUser?.id || 'system';
    const userName = currentUser?.displayName || 
                    `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 
                    currentUser?.email || 
                    'System';
    
    const batch = {
      branchId,
      prefix: prefix.trim().toUpperCase(),
      startNumber: parseInt(startNumber),
      endNumber: parseInt(endNumber),
      currentNumber: parseInt(startNumber) - 1, // Will be incremented to startNumber on first use
      totalReceipts: parseInt(endNumber) - parseInt(startNumber) + 1,
      usedReceipts: 0,
      remainingReceipts: parseInt(endNumber) - parseInt(startNumber) + 1,
      status: 'active', // active, exhausted, inactive
      dateReceived: batchData.dateReceived ? Timestamp.fromDate(new Date(batchData.dateReceived)) : serverTimestamp(),
      notes: notes || '',
      createdBy: userId,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, BIR_BATCHES_COLLECTION), batch);
    
    return {
      id: docRef.id,
      ...batch,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('Error creating BIR receipt batch:', error);
    throw error;
  }
};

/**
 * Get all BIR receipt batches for a branch
 * @param {string} branchId - Branch ID
 * @param {boolean} activeOnly - Only return active batches
 * @returns {Promise<Array>} - Array of batches
 */
export const getBIRReceiptBatches = async (branchId, activeOnly = false) => {
  try {
    let q = query(
      collection(db, BIR_BATCHES_COLLECTION),
      where('branchId', '==', branchId)
    );
    
    if (activeOnly) {
      q = query(
        collection(db, BIR_BATCHES_COLLECTION),
        where('branchId', '==', branchId),
        where('status', '==', 'active')
      );
    }
    
    const snapshot = await getDocs(q);
    const batches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
    }));
    
    // Sort by createdAt descending
    batches.sort((a, b) => b.createdAt - a.createdAt);
    
    return batches;
  } catch (error) {
    console.error('Error fetching BIR receipt batches:', error);
    return [];
  }
};

/**
 * Get the active BIR receipt batch for a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object|null>} - Active batch or null
 */
export const getActiveBIRReceiptBatch = async (branchId) => {
  try {
    const batches = await getBIRReceiptBatches(branchId, true);
    
    // Return the first active batch that still has remaining receipts
    for (const batch of batches) {
      if (batch.status === 'active' && batch.remainingReceipts > 0) {
        return batch;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting active BIR receipt batch:', error);
    return null;
  }
};

/**
 * Get the next receipt number from the active batch (with atomic increment)
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} - { receiptNumber, batchId, remaining }
 */
export const getNextReceiptNumber = async (branchId) => {
  try {
    // Use a transaction to ensure atomic increment
    const result = await runTransaction(db, async (transaction) => {
      // Get active batches
      const batchesQuery = query(
        collection(db, BIR_BATCHES_COLLECTION),
        where('branchId', '==', branchId),
        where('status', '==', 'active')
      );
      
      const batchesSnapshot = await getDocs(batchesQuery);
      
      if (batchesSnapshot.empty) {
        throw new Error('No active BIR receipt batch found. Please ask your Branch Manager to add a new batch.');
      }
      
      // Find a batch with remaining receipts
      let activeBatch = null;
      let activeBatchRef = null;
      
      for (const batchDoc of batchesSnapshot.docs) {
        const batchData = batchDoc.data();
        if (batchData.remainingReceipts > 0 && batchData.currentNumber < batchData.endNumber) {
          activeBatch = { id: batchDoc.id, ...batchData };
          activeBatchRef = batchDoc.ref;
          break;
        }
      }
      
      if (!activeBatch || !activeBatchRef) {
        throw new Error('All BIR receipt batches are exhausted. Please ask your Branch Manager to add a new batch.');
      }
      
      // Calculate next number, skipping voided numbers
      let nextNumber = activeBatch.currentNumber + 1;
      const voidedNumbers = activeBatch.voidedNumbers || [];
      
      // Convert voided numbers to integers for comparison (they may be stored as padded strings)
      const voidedNumbersInt = voidedNumbers.map(v => parseInt(String(v).replace(/^0+/, ''), 10) || parseInt(v, 10));
      
      console.log('🧾 Current number:', activeBatch.currentNumber);
      console.log('🧾 Next number candidate:', nextNumber);
      console.log('🧾 Voided numbers (raw):', voidedNumbers);
      console.log('🧾 Voided numbers (int):', voidedNumbersInt);
      
      // Skip any voided numbers
      while (voidedNumbersInt.includes(nextNumber) && nextNumber <= activeBatch.endNumber) {
        console.log('🧾 Skipping voided number:', nextNumber);
        nextNumber++;
      }
      
      console.log('🧾 Final next number:', nextNumber);
      
      // Check if we've exceeded the batch
      if (nextNumber > activeBatch.endNumber) {
        throw new Error('All BIR receipt batches are exhausted. Please ask your Branch Manager to add a new batch.');
      }
      
      const newRemaining = activeBatch.remainingReceipts - 1;
      const newUsed = activeBatch.usedReceipts + 1;
      
      // Check if batch will be exhausted
      const newStatus = nextNumber >= activeBatch.endNumber ? 'exhausted' : 'active';
      
      // Update the batch
      transaction.update(activeBatchRef, {
        currentNumber: nextNumber,
        remainingReceipts: newRemaining,
        usedReceipts: newUsed,
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      // Format receipt number with zero-padding (no prefix)
      const paddedNumber = String(nextNumber).padStart(String(activeBatch.endNumber).length, '0');
      const receiptNumber = paddedNumber;
      
      return {
        receiptNumber,
        prefix: activeBatch.prefix, // Return prefix separately if needed
        batchId: activeBatch.id,
        remaining: newRemaining,
        isLastInBatch: newStatus === 'exhausted'
      };
    });
    
    return result;
  } catch (error) {
    console.error('Error getting next receipt number:', error);
    throw error;
  }
};

/**
 * Update a BIR receipt batch
 * @param {string} batchId - Batch ID
 * @param {Object} updateData - Data to update
 * @param {Object} currentUser - User making the update
 * @returns {Promise<void>}
 */
export const updateBIRReceiptBatch = async (batchId, updateData, currentUser) => {
  try {
    const batchRef = doc(db, BIR_BATCHES_COLLECTION, batchId);
    
    const updates = {
      ...updateData,
      updatedAt: serverTimestamp()
    };
    
    // Don't allow changing start/end numbers if batch has been used
    if (updateData.startNumber !== undefined || updateData.endNumber !== undefined) {
      const batchSnap = await getDoc(batchRef);
      if (batchSnap.exists() && batchSnap.data().usedReceipts > 0) {
        throw new Error('Cannot modify receipt numbers after batch has been used');
      }
    }
    
    await updateDoc(batchRef, updates);
  } catch (error) {
    console.error('Error updating BIR receipt batch:', error);
    throw error;
  }
};

/**
 * Deactivate a BIR receipt batch
 * @param {string} batchId - Batch ID
 * @param {Object} currentUser - User deactivating
 * @returns {Promise<void>}
 */
export const deactivateBIRReceiptBatch = async (batchId, currentUser) => {
  try {
    const batchRef = doc(db, BIR_BATCHES_COLLECTION, batchId);
    
    await updateDoc(batchRef, {
      status: 'inactive',
      deactivatedBy: currentUser?.uid || currentUser?.id || 'system',
      deactivatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error deactivating BIR receipt batch:', error);
    throw error;
  }
};

/**
 * Reactivate a BIR receipt batch
 * @param {string} batchId - Batch ID
 * @param {Object} currentUser - User reactivating
 * @returns {Promise<void>}
 */
export const reactivateBIRReceiptBatch = async (batchId, currentUser) => {
  try {
    const batchRef = doc(db, BIR_BATCHES_COLLECTION, batchId);
    const batchSnap = await getDoc(batchRef);
    
    if (!batchSnap.exists()) {
      throw new Error('Batch not found');
    }
    
    const batchData = batchSnap.data();
    
    // Check if batch still has remaining receipts
    if (batchData.remainingReceipts <= 0) {
      throw new Error('Cannot reactivate exhausted batch');
    }
    
    await updateDoc(batchRef, {
      status: 'active',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error reactivating BIR receipt batch:', error);
    throw error;
  }
};

/**
 * Void specific receipt numbers (mark as destroyed/unusable)
 * @param {string} batchId - Batch ID
 * @param {Array<number>} receiptNumbers - Array of receipt numbers to void
 * @param {string} reason - Reason for voiding
 * @param {Object} currentUser - User voiding the receipts
 * @returns {Promise<Object>} - Updated batch data
 */
export const voidReceiptNumbers = async (batchId, receiptNumbers, reason, currentUser) => {
  try {
    const batchRef = doc(db, BIR_BATCHES_COLLECTION, batchId);
    const batchSnap = await getDoc(batchRef);
    
    if (!batchSnap.exists()) {
      throw new Error('Batch not found');
    }
    
    const batchData = batchSnap.data();
    const existingVoided = batchData.voidedNumbers || [];
    
    // Filter out numbers that are already voided or already used
    const validNumbersToVoid = receiptNumbers.filter(num => {
      const numInt = parseInt(num);
      return numInt >= batchData.startNumber && 
             numInt <= batchData.endNumber && 
             numInt > batchData.currentNumber && // Can't void already used numbers
             !existingVoided.includes(numInt);
    });
    
    if (validNumbersToVoid.length === 0) {
      throw new Error('No valid receipt numbers to void. Numbers may already be used or voided.');
    }
    
    const newVoidedNumbers = [...existingVoided, ...validNumbersToVoid].sort((a, b) => a - b);
    const voidedCount = validNumbersToVoid.length;
    
    const userId = currentUser?.uid || currentUser?.id || 'system';
    const userName = currentUser?.displayName || 
                    `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 
                    currentUser?.email || 
                    'System';
    
    // Create void log entry
    const voidLog = {
      numbers: validNumbersToVoid,
      reason: reason || 'No reason provided',
      voidedBy: userId,
      voidedByName: userName,
      voidedAt: new Date().toISOString()
    };
    
    const existingVoidLogs = batchData.voidLogs || [];
    
    await updateDoc(batchRef, {
      voidedNumbers: newVoidedNumbers,
      voidLogs: [...existingVoidLogs, voidLog],
      remainingReceipts: batchData.remainingReceipts - voidedCount,
      updatedAt: serverTimestamp()
    });
    
    // Check if batch should be marked as exhausted
    const newRemaining = batchData.remainingReceipts - voidedCount;
    if (newRemaining <= 0) {
      await updateDoc(batchRef, {
        status: 'exhausted'
      });
    }
    
    return {
      voidedCount,
      voidedNumbers: validNumbersToVoid,
      newRemaining
    };
  } catch (error) {
    console.error('Error voiding receipt numbers:', error);
    throw error;
  }
};

/**
 * Skip to a specific receipt number (void all numbers before it)
 * @param {string} batchId - Batch ID
 * @param {number} skipToNumber - The number to skip to
 * @param {string} reason - Reason for skipping
 * @param {Object} currentUser - User performing the skip
 * @returns {Promise<Object>} - Result with voided count
 */
export const skipToReceiptNumber = async (batchId, skipToNumber, reason, currentUser) => {
  try {
    const batchRef = doc(db, BIR_BATCHES_COLLECTION, batchId);
    const batchSnap = await getDoc(batchRef);
    
    if (!batchSnap.exists()) {
      throw new Error('Batch not found');
    }
    
    const batchData = batchSnap.data();
    const targetNumber = parseInt(skipToNumber);
    
    if (targetNumber <= batchData.currentNumber) {
      throw new Error('Cannot skip to a number that has already been used');
    }
    
    if (targetNumber > batchData.endNumber) {
      throw new Error('Cannot skip beyond the batch end number');
    }
    
    // Generate all numbers to void (from current+1 to target-1)
    const numbersToVoid = [];
    for (let i = batchData.currentNumber + 1; i < targetNumber; i++) {
      if (!batchData.voidedNumbers?.includes(i)) {
        numbersToVoid.push(i);
      }
    }
    
    if (numbersToVoid.length === 0) {
      // Just update currentNumber if no numbers to void
      await updateDoc(batchRef, {
        currentNumber: targetNumber - 1,
        updatedAt: serverTimestamp()
      });
      return { voidedCount: 0, skippedTo: targetNumber };
    }
    
    return await voidReceiptNumbers(batchId, numbersToVoid, reason, currentUser);
  } catch (error) {
    console.error('Error skipping to receipt number:', error);
    throw error;
  }
};

export default {
  createBIRReceiptBatch,
  getBIRReceiptBatches,
  getActiveBIRReceiptBatch,
  getNextReceiptNumber,
  updateBIRReceiptBatch,
  deactivateBIRReceiptBatch,
  reactivateBIRReceiptBatch,
  voidReceiptNumbers,
  skipToReceiptNumber
};
