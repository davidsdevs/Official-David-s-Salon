/**
 * Price History Service
 * Manages service price change history and sales analytics
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Get price change history for a service and branch
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of price change records
 */
export const getPriceHistory = async (serviceId, branchId) => {
  try {
    const priceHistoryRef = collection(db, 'servicePriceHistory');
    const q = query(
      priceHistoryRef,
      where('serviceId', '==', serviceId),
      where('branchId', '==', branchId),
      orderBy('changedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        changedAt: data.changedAt?.toDate ? data.changedAt.toDate() : new Date(data.changedAt)
      };
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    throw error;
  }
};

/**
 * Get sales data for a service and branch within a date range
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Sales statistics
 */
export const getServiceSalesData = async (serviceId, branchId, startDate, endDate) => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('branchId', '==', branchId),
      where('status', '==', 'paid'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    
    let totalSales = 0;
    let totalQuantity = 0;
    let totalRevenue = 0;
    const salesByDate = {};
    
    snapshot.forEach((doc) => {
      const transaction = doc.data();
      const transactionDate = transaction.createdAt?.toDate 
        ? transaction.createdAt.toDate() 
        : new Date(transaction.createdAt);
      
      // Filter by date range
      if (transactionDate >= startDateObj && transactionDate <= endDateObj) {
        // Check if this transaction includes the service
        const items = transaction.items || [];
        items.forEach(item => {
          // Match by serviceId or id field, and ensure it's a service (not a product)
          const isService = item.type === 'service' || (!item.type && !item.productId);
          const matchesService = item.serviceId === serviceId || item.id === serviceId;
          
          if (isService && matchesService) {
            const quantity = item.quantity || 1;
            const price = item.price || item.adjustedPrice || item.basePrice || 0;
            
            totalQuantity += quantity;
            totalRevenue += price * quantity;
            totalSales += 1;
            
            // Group by date
            const dateKey = transactionDate.toISOString().split('T')[0];
            if (!salesByDate[dateKey]) {
              salesByDate[dateKey] = { quantity: 0, revenue: 0, count: 0 };
            }
            salesByDate[dateKey].quantity += quantity;
            salesByDate[dateKey].revenue += price * quantity;
            salesByDate[dateKey].count += 1;
          }
        });
      }
    });
    
    return {
      totalSales,
      totalQuantity,
      totalRevenue,
      averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,
      salesByDate
    };
  } catch (error) {
    console.error('Error fetching sales data:', error);
    throw error;
  }
};

/**
 * Get price change impact analysis
 * Compares sales before and after a price change
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Date} priceChangeDate - Date when price was changed
 * @param {number} daysBefore - Number of days before price change to analyze
 * @param {number} daysAfter - Number of days after price change to analyze
 * @returns {Promise<Object>} Comparison data
 */
export const getPriceChangeImpact = async (
  serviceId, 
  branchId, 
  priceChangeDate, 
  daysBefore = 30, 
  daysAfter = 30
) => {
  try {
    const changeDate = new Date(priceChangeDate);
    const beforeStart = new Date(changeDate);
    beforeStart.setDate(beforeStart.getDate() - daysBefore);
    const afterEnd = new Date(changeDate);
    afterEnd.setDate(afterEnd.getDate() + daysAfter);
    
    const [beforeData, afterData] = await Promise.all([
      getServiceSalesData(serviceId, branchId, beforeStart, changeDate),
      getServiceSalesData(serviceId, branchId, changeDate, afterEnd)
    ]);
    
    // Calculate percentage changes
    const quantityChange = beforeData.totalQuantity > 0
      ? ((afterData.totalQuantity - beforeData.totalQuantity) / beforeData.totalQuantity) * 100
      : 0;
    
    const revenueChange = beforeData.totalRevenue > 0
      ? ((afterData.totalRevenue - beforeData.totalRevenue) / beforeData.totalRevenue) * 100
      : 0;
    
    const salesCountChange = beforeData.totalSales > 0
      ? ((afterData.totalSales - beforeData.totalSales) / beforeData.totalSales) * 100
      : 0;
    
    return {
      before: {
        ...beforeData,
        period: `${daysBefore} days before`
      },
      after: {
        ...afterData,
        period: `${daysAfter} days after`
      },
      changes: {
        quantityChange,
        revenueChange,
        salesCountChange
      },
      priceChangeDate: changeDate
    };
  } catch (error) {
    console.error('Error calculating price change impact:', error);
    throw error;
  }
};

/**
 * Get transactions for a service within a price range and date range
 * Filters transactions where the service was sold at a specific price
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {number} price - Specific price to filter by (optional, allows small variance)
 * @returns {Promise<Array>} Array of transaction objects
 */
export const getTransactionsForPricePeriod = async (
  serviceId,
  branchId,
  startDate,
  endDate,
  price = null
) => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('branchId', '==', branchId),
      where('status', '==', 'paid'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    
    const transactions = [];
    
    snapshot.forEach((doc) => {
      const transaction = doc.data();
      const transactionDate = transaction.createdAt?.toDate 
        ? transaction.createdAt.toDate() 
        : new Date(transaction.createdAt);
      
      // Filter by date range
      if (transactionDate >= startDateObj && transactionDate <= endDateObj) {
        // Check if this transaction includes the service
        const items = transaction.items || [];
        items.forEach(item => {
          // Match by serviceId or id field, and ensure it's a service (not a product)
          const isService = item.type === 'service' || (!item.type && !item.productId);
          const matchesService = item.serviceId === serviceId || item.id === serviceId;
          
          if (isService && matchesService) {
            const itemPrice = item.price || item.adjustedPrice || item.basePrice || 0;
            
            // If price filter is provided, check if it matches (allow 1 peso variance for rounding)
            if (price === null || Math.abs(itemPrice - price) <= 1) {
              transactions.push({
                id: doc.id,
                transactionId: doc.id,
                transactionDate,
                clientName: transaction.clientName || 'Walk-in',
                clientId: transaction.clientId || null,
                itemName: item.name || 'Unknown Service',
                itemPrice,
                quantity: item.quantity || 1,
                subtotal: transaction.subtotal || 0,
                discount: transaction.discount || 0,
                total: transaction.total || 0,
                paymentMethod: transaction.paymentMethod || 'cash',
                stylistName: item.stylistName || transaction.stylistName || 'N/A',
                appointmentId: transaction.appointmentId || null,
                createdAt: transactionDate
              });
            }
          }
        });
      }
    });
    
    return transactions;
  } catch (error) {
    console.error('Error fetching transactions for price period:', error);
    throw error;
  }
};

