// src/services/stockAlertsService.js
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { inventoryService } from './inventoryService';

class StockAlertsService {
  constructor() {
    this.alertsCollection = 'stock_alerts';
  }

  /**
   * Get all stock alerts (for Inventory Controller - can see all branches)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - { success, alerts, message }
   */
  async getAllAlerts(filters = {}) {
    try {
      let q = query(collection(db, this.alertsCollection));

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.priority && filters.priority !== 'all') {
        q = query(q, where('priority', '==', filters.priority));
      }
      if (filters.branchId && filters.branchId !== 'all') {
        q = query(q, where('branchId', '==', filters.branchId));
      }
      if (filters.alertType && filters.alertType !== 'all') {
        q = query(q, where('alertType', '==', filters.alertType));
      }

      // Order by createdAt descending (newest first)
      q = query(q, orderBy('createdAt', 'desc'));

      const querySnapshot = await getDocs(q);
      const alerts = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                     data.createdAt instanceof Date ? data.createdAt :
                     data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                     data.updatedAt instanceof Date ? data.updatedAt :
                     data.updatedAt ? new Date(data.updatedAt) : new Date(),
          resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : 
                      data.resolvedAt instanceof Date ? data.resolvedAt :
                      data.resolvedAt ? new Date(data.resolvedAt) : null,
          lastRestocked: data.lastRestocked?.toDate ? data.lastRestocked.toDate() : 
                        data.lastRestocked instanceof Date ? data.lastRestocked :
                        data.lastRestocked ? new Date(data.lastRestocked) : null,
          expectedRestock: data.expectedRestock?.toDate ? data.expectedRestock.toDate() : 
                          data.expectedRestock instanceof Date ? data.expectedRestock :
                          data.expectedRestock ? new Date(data.expectedRestock) : null,
        });
      });

      return { success: true, alerts };
    } catch (error) {
      console.error('Error getting stock alerts:', error);
      return { success: false, message: error.message, alerts: [] };
    }
  }

  /**
   * Get alerts for a specific branch
   * @param {string} branchId - Branch ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - { success, alerts, message }
   */
  async getBranchAlerts(branchId, filters = {}) {
    try {
      let q = query(
        collection(db, this.alertsCollection),
        where('branchId', '==', branchId)
      );

      if (filters.status && filters.status !== 'all') {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.priority && filters.priority !== 'all') {
        q = query(q, where('priority', '==', filters.priority));
      }

      q = query(q, orderBy('createdAt', 'desc'));

      const querySnapshot = await getDocs(q);
      const alerts = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : null,
          lastRestocked: data.lastRestocked?.toDate ? data.lastRestocked.toDate() : null,
          expectedRestock: data.expectedRestock?.toDate ? data.expectedRestock.toDate() : null,
        });
      });

      return { success: true, alerts };
    } catch (error) {
      console.error('Error getting branch alerts:', error);
      return { success: false, message: error.message, alerts: [] };
    }
  }

  /**
   * Get alert by ID
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} - { success, alert, message }
   */
  async getAlertById(alertId) {
    try {
      const alertRef = doc(db, this.alertsCollection, alertId);
      const alertSnap = await getDoc(alertRef);
      
      if (alertSnap.exists()) {
        const data = alertSnap.data();
        return {
          success: true,
          alert: {
            id: alertSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : null,
            lastRestocked: data.lastRestocked?.toDate ? data.lastRestocked.toDate() : null,
            expectedRestock: data.expectedRestock?.toDate ? data.expectedRestock.toDate() : null,
          }
        };
      } else {
        return { success: false, message: 'Alert not found' };
      }
    } catch (error) {
      console.error('Error getting alert:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Create a stock alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} - { success, alertId, message }
   */
  async createAlert(alertData) {
    try {
      const alert = {
        productId: String(alertData.productId),
        productName: String(alertData.productName || ''),
        brand: String(alertData.brand || ''),
        category: String(alertData.category || ''),
        branchId: String(alertData.branchId),
        branchName: String(alertData.branchName || ''),
        currentStock: Number(alertData.currentStock) || 0,
        minStock: Number(alertData.minStock) || 0,
        maxStock: Number(alertData.maxStock) || 0,
        unitCost: Number(alertData.unitCost) || 0,
        totalValue: Number(alertData.currentStock || 0) * Number(alertData.unitCost || 0),
        priority: String(alertData.priority || 'Medium'),
        status: 'Active',
        alertType: String(alertData.alertType || 'Low Stock'),
        location: String(alertData.location || ''),
        supplier: String(alertData.supplier || ''),
        notes: String(alertData.notes || ''),
        actionTaken: null,
        lastRestocked: alertData.lastRestocked ? Timestamp.fromDate(new Date(alertData.lastRestocked)) : null,
        expectedRestock: alertData.expectedRestock ? Timestamp.fromDate(new Date(alertData.expectedRestock)) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        resolvedAt: null,
        createdBy: String(alertData.createdBy || ''),
      };

      const docRef = await addDoc(collection(db, this.alertsCollection), alert);
      
      return { success: true, alertId: docRef.id, message: 'Alert created successfully' };
    } catch (error) {
      console.error('Error creating alert:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update an alert
   * @param {string} alertId - Alert ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - { success, message }
   */
  async updateAlert(alertId, updateData) {
    try {
      const alertRef = doc(db, this.alertsCollection, alertId);
      
      const update = {
        ...updateData,
        updatedAt: serverTimestamp(),
      };

      // Convert dates to Timestamps if provided
      if (updateData.lastRestocked) {
        update.lastRestocked = Timestamp.fromDate(new Date(updateData.lastRestocked));
      }
      if (updateData.expectedRestock) {
        update.expectedRestock = Timestamp.fromDate(new Date(updateData.expectedRestock));
      }
      if (updateData.resolvedAt) {
        update.resolvedAt = Timestamp.fromDate(new Date(updateData.resolvedAt));
      }

      // Recalculate total value if stock or cost changed
      if (updateData.currentStock !== undefined || updateData.unitCost !== undefined) {
        const currentAlert = await this.getAlertById(alertId);
        if (currentAlert.success) {
          const currentStock = updateData.currentStock !== undefined 
            ? updateData.currentStock 
            : currentAlert.alert.currentStock;
          const unitCost = updateData.unitCost !== undefined 
            ? updateData.unitCost 
            : currentAlert.alert.unitCost;
          update.totalValue = currentStock * unitCost;
        }
      }

      await updateDoc(alertRef, update);
      
      return { success: true, message: 'Alert updated successfully' };
    } catch (error) {
      console.error('Error updating alert:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   * @param {string} actionTaken - Action taken to resolve
   * @param {string} resolvedBy - User ID who resolved it
   * @returns {Promise<Object>} - { success, message }
   */
  async resolveAlert(alertId, actionTaken = '', resolvedBy = '') {
    try {
      const alertRef = doc(db, this.alertsCollection, alertId);
      
      await updateDoc(alertRef, {
        status: 'Resolved',
        actionTaken: String(actionTaken || ''),
        resolvedAt: serverTimestamp(),
        resolvedBy: String(resolvedBy || ''),
        updatedAt: serverTimestamp(),
      });
      
      return { success: true, message: 'Alert resolved successfully' };
    } catch (error) {
      console.error('Error resolving alert:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Dismiss an alert
   * @param {string} alertId - Alert ID
   * @param {string} dismissedBy - User ID who dismissed it
   * @returns {Promise<Object>} - { success, message }
   */
  async dismissAlert(alertId, dismissedBy = '') {
    try {
      const alertRef = doc(db, this.alertsCollection, alertId);
      
      await updateDoc(alertRef, {
        status: 'Dismissed',
        dismissedBy: String(dismissedBy || ''),
        updatedAt: serverTimestamp(),
      });
      
      return { success: true, message: 'Alert dismissed successfully' };
    } catch (error) {
      console.error('Error dismissing alert:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Delete an alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} - { success, message }
   */
  async deleteAlert(alertId) {
    try {
      const alertRef = doc(db, this.alertsCollection, alertId);
      await deleteDoc(alertRef);
      
      return { success: true, message: 'Alert deleted successfully' };
    } catch (error) {
      console.error('Error deleting alert:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Automatically generate alerts for low stock items
   * This should be called periodically or when stock changes
   * @param {string} branchId - Branch ID (optional, if not provided checks all branches)
   * @param {Object} settings - Alert settings { lowStockThreshold: 10, criticalThreshold: 0 }
   * @returns {Promise<Object>} - { success, alertsCreated, message }
   */
  async generateAlertsForLowStock(branchId = null, settings = null) {
    try {
      let alertsCreated = 0;
      const existingAlerts = new Map(); // Track existing active alerts by productId+branchId

      // Get all active alerts to avoid duplicates
      const activeAlertsQuery = query(
        collection(db, this.alertsCollection),
        where('status', '==', 'Active')
      );
      const activeAlertsSnap = await getDocs(activeAlertsQuery);
      activeAlertsSnap.forEach((doc) => {
        const data = doc.data();
        const key = `${data.productId}_${data.branchId}`;
        existingAlerts.set(key, doc.id);
      });

      // Get stocks from stocks collection (not branch_stocks)
      let stocksQuery;
      if (branchId) {
        stocksQuery = query(
          collection(db, 'stocks'),
          where('branchId', '==', branchId),
          where('status', '==', 'active')
        );
      } else {
        // Get all active stocks from all branches
        stocksQuery = query(
          collection(db, 'stocks'),
          where('status', '==', 'active')
        );
      }
      
      const stocksSnap = await getDocs(stocksQuery);
      const stocks = [];
      stocksSnap.forEach((doc) => {
        const data = doc.data();
        stocks.push({
          id: doc.id,
          ...data,
        });
      });
      
      const stocksResult = { success: true, stocks };

      if (!stocksResult.success || !stocksResult.stocks) {
        return { success: false, message: 'Failed to fetch stocks', alertsCreated: 0 };
      }

      // Get branch names
      const branchNames = new Map();
      const branchesQuery = query(collection(db, 'branches'));
      const branchesSnap = await getDocs(branchesQuery);
      branchesSnap.forEach((doc) => {
        branchNames.set(doc.id, doc.data().name || doc.id);
      });

      // Get product information to get minStock/maxStock
      const productsMap = new Map();
      const productsQuery = query(collection(db, 'products'));
      const productsSnap = await getDocs(productsQuery);
      productsSnap.forEach((doc) => {
        const productData = doc.data();
        productsMap.set(doc.id, {
          minStock: productData.minStock || 10, // Default min stock
          maxStock: productData.maxStock || 100, // Default max stock
          brand: productData.brand || '',
          category: productData.category || '',
          unitCost: productData.unitCost || 0
        });
      });

      // Use configurable threshold from settings (default: 10)
      const lowStockThreshold = settings?.lowStockThreshold || 10;
      const criticalThreshold = settings?.criticalThreshold !== undefined ? settings.criticalThreshold : 0;

      // Check each stock and create alerts if needed
      for (const stock of stocksResult.stocks) {
        const currentStock = parseInt(stock.realTimeStock || 0);
        const productInfo = productsMap.get(stock.productId);
        const maxStock = productInfo?.maxStock || 100; // Default max stock
        const stockBranchId = stock.branchId || branchId;

        // Determine alert type and priority using configurable threshold
        let alertType = null;
        let priority = 'Medium';

        if (currentStock <= criticalThreshold) {
          alertType = 'Out of Stock';
          priority = 'Critical';
        } else if (currentStock <= lowStockThreshold) {
          alertType = 'Low Stock';
          priority = currentStock <= (lowStockThreshold * 0.5) ? 'High' : 'Medium';
        } else if (currentStock > maxStock * 1.5 && maxStock > 0) {
          alertType = 'Overstock';
          priority = 'Low';
        }

        // Only create alert if needed and doesn't already exist
        if (alertType) {
          const alertKey = `${stock.productId}_${stockBranchId}`;
          
          if (!existingAlerts.has(alertKey)) {
            const branchName = branchNames.get(stockBranchId) || stockBranchId;
            
            const alertData = {
              productId: stock.productId,
              productName: stock.productName || 'Unknown Product',
              brand: productInfo?.brand || stock.brand || '',
              category: productInfo?.category || stock.category || '',
              branchId: stockBranchId,
              branchName: branchName,
              currentStock: currentStock,
              minStock: lowStockThreshold, // Use configured threshold
              maxStock: maxStock,
              unitCost: productInfo?.unitCost || stock.unitCost || 0,
              alertType: alertType,
              priority: priority,
              location: stock.location || '',
              supplier: stock.supplier || '',
              lastRestocked: stock.lastRestocked,
              notes: `Automatically generated alert for ${alertType.toLowerCase()} (Threshold: ${lowStockThreshold})`,
            };

            const result = await this.createAlert(alertData);
            if (result.success) {
              alertsCreated++;
            }
          } else {
            // Update existing alert if stock changed significantly
            const existingAlertId = existingAlerts.get(alertKey);
            const existingAlert = await this.getAlertById(existingAlertId);
            
            if (existingAlert.success) {
              const alert = existingAlert.alert;
              
              // Update if stock level changed or alert type should change
              if (alert.currentStock !== currentStock || alert.alertType !== alertType) {
                await this.updateAlert(existingAlertId, {
                  currentStock: currentStock,
                  alertType: alertType,
                  priority: priority,
                  totalValue: currentStock * (productInfo?.unitCost || stock.unitCost || 0),
                });
              }
            }
          }
        } else {
          // Stock is normal, resolve any existing active alerts for this product
          const alertKey = `${stock.productId}_${stockBranchId}`;
          if (existingAlerts.has(alertKey)) {
            const existingAlertId = existingAlerts.get(alertKey);
            await this.resolveAlert(existingAlertId, 'Stock level returned to normal');
          }
        }
      }

      return { 
        success: true, 
        alertsCreated, 
        message: `Generated ${alertsCreated} new stock alerts` 
      };
    } catch (error) {
      console.error('Error generating alerts:', error);
      return { success: false, message: error.message, alertsCreated: 0 };
    }
  }

  /**
   * Subscribe to real-time alerts updates
   * @param {Function} callback - Callback function
   * @param {Object} filters - Filter options
   * @returns {Function} - Unsubscribe function
   */
  subscribeToAlerts(callback, filters = {}) {
    let q = query(collection(db, this.alertsCollection));

    if (filters.status && filters.status !== 'all') {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.branchId && filters.branchId !== 'all') {
      q = query(q, where('branchId', '==', filters.branchId));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const alerts = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : null,
          lastRestocked: data.lastRestocked?.toDate ? data.lastRestocked.toDate() : null,
          expectedRestock: data.expectedRestock?.toDate ? data.expectedRestock.toDate() : null,
        });
      });
      callback({ success: true, alerts });
    }, (error) => {
      console.error('Error in alerts subscription:', error);
      callback({ success: false, message: error.message, alerts: [] });
    });
  }
}

export const stockAlertsService = new StockAlertsService();
export default stockAlertsService;

