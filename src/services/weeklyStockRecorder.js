// src/services/weeklyStockRecorder.js
import { 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';

class WeeklyStockRecorder {
  constructor() {
    this.collection = 'stocks';
  }

  /**
   * Record weekly stock for all active stocks in a branch
   * This should be called weekly (e.g., every Monday)
   * @param {string} branchId - Branch ID
   * @param {number} weekNumber - Week number (1-4) in the current month
   * @param {string} userId - User ID who triggered the recording
   * @param {string} userName - User name who triggered the recording
   * @returns {Promise<Object>} - { success, recorded, errors }
   */
  async recordWeeklyStock(branchId, weekNumber, userId = null, userName = 'System') {
    try {
      if (!branchId) {
        return { success: false, message: 'Branch ID is required' };
      }

      if (!weekNumber || weekNumber < 1 || weekNumber > 4) {
        return { success: false, message: 'Week number must be between 1 and 4' };
      }

      console.log(`Recording week ${weekNumber} stock for branch ${branchId}`);

      // Get all active stocks for this branch
      const stocksRef = collection(db, this.collection);
      const q = query(
        stocksRef,
        where('branchId', '==', branchId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      const recorded = [];
      const errors = [];

      // Get current date info
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      
      // Calculate week dates
      const weekStartDate = new Date(firstDayOfMonth);
      weekStartDate.setDate(1 + (weekNumber - 1) * 7);
      
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);

      // Get branch name for logging
      let branchName = 'Unknown Branch';
      try {
        const branchDoc = await getDoc(doc(db, 'branches', branchId));
        if (branchDoc.exists()) {
          branchName = branchDoc.data().name || 'Unknown Branch';
        }
      } catch (error) {
        console.error('Error getting branch name:', error);
      }

      for (const stockDoc of snapshot.docs) {
        try {
          const stockData = stockDoc.data();
          const stockId = stockDoc.id;

          // Get current realTimeStock
          const currentStock = parseInt(stockData.realTimeStock || stockData.beginningStock || 0);

          // Determine which week field to update
          const weekField = `week${weekNumber}Stock`;
          const previousWeekStock = stockData[weekField] || null;

          // Update the week stock field
          await updateDoc(doc(db, this.collection, stockId), {
            [weekField]: currentStock,
            updatedAt: serverTimestamp()
          });

          recorded.push({
            stockId,
            productId: stockData.productId,
            productName: stockData.productName || 'Unknown Product',
            weekNumber,
            stockValue: currentStock,
            previousValue: previousWeekStock
          });

          // Log activity
          try {
            await logActivity({
              action: 'weekly_stock_recorded',
              performedBy: userId || 'system',
              branchId,
              details: {
                module: 'stocks',
                entityType: 'stock',
                entityId: stockId,
                entityName: stockData.productName || 'Unknown Product',
                weekNumber,
                weekField,
                previousValue: previousWeekStock,
                newValue: currentStock,
                reason: `Weekly stock recording - Week ${weekNumber}`,
                notes: `Recorded week ${weekNumber} stock: ${currentStock} units for ${stockData.productName || 'product'}`
              }
            });
          } catch (logError) {
            console.error('Error logging weekly stock activity:', logError);
          }

        } catch (error) {
          console.error(`Error recording stock for ${stockDoc.id}:`, error);
          errors.push({
            stockId: stockDoc.id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        recorded,
        errors,
        message: `Recorded week ${weekNumber} stock for ${recorded.length} products`
      };

    } catch (error) {
      console.error('Error in weekly stock recording:', error);
      return {
        success: false,
        message: error.message,
        recorded: [],
        errors: []
      };
    }
  }

  /**
   * Auto-record stock for all weeks of the current month
   * This can be called at the end of each week automatically
   * @param {string} branchId - Branch ID
   * @param {string} userId - User ID (optional, defaults to 'system')
   * @param {string} userName - User name (optional)
   * @returns {Promise<Object>} - Recording results
   */
  async autoRecordCurrentWeek(branchId, userId = null, userName = 'System') {
    const now = new Date();
    const currentDate = now.getDate(); // Day of month (1-31)
    
    // Determine which week of the month (1-4)
    // Week 1: Days 1-7
    // Week 2: Days 8-14
    // Week 3: Days 15-21
    // Week 4: Days 22-31
    let weekNumber;
    if (currentDate <= 7) {
      weekNumber = 1;
    } else if (currentDate <= 14) {
      weekNumber = 2;
    } else if (currentDate <= 21) {
      weekNumber = 3;
    } else {
      weekNumber = 4;
    }

    return this.recordWeeklyStock(branchId, weekNumber, userId, userName);
  }

  /**
   * Record stock for a specific week manually
   * @param {string} branchId - Branch ID
   * @param {number} weekNumber - Week number (1-4)
   * @param {string} userId - User ID
   * @param {string} userName - User name
   * @returns {Promise<Object>} - Recording results
   */
  async recordSpecificWeek(branchId, weekNumber, userId, userName) {
    return this.recordWeeklyStock(branchId, weekNumber, userId, userName);
  }
}

export const weeklyStockRecorder = new WeeklyStockRecorder();
export default weeklyStockRecorder;

