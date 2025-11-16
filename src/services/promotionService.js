// src/services/promotionService.js
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

class PromotionService {
  /**
   * Validate and get promotion by code
   * @param {string} code - Promotion code
   * @param {string} branchId - Branch ID
   * @param {string} clientId - Client ID (optional, for one-time use validation)
   * @returns {Promise<Object>} - Promotion data or error
   */
  async validatePromotionCode(code, branchId, clientId = null) {
    try {
      if (!code || !branchId) {
        return {
          success: false,
          error: 'Promotion code and branch ID are required'
        };
      }

      const codeUpper = code.trim().toUpperCase();
      
      // Find promotion by code and branch
      const promotionsRef = collection(db, 'promotions');
      const q = query(
        promotionsRef,
        where('promotionCode', '==', codeUpper),
        where('branchId', '==', branchId)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          success: false,
          error: 'Invalid promotion code'
        };
      }

      const promotionDoc = snapshot.docs[0];
      const promotion = {
        id: promotionDoc.id,
        ...promotionDoc.data()
      };

      // Check if promotion is active
      if (!promotion.isActive) {
        return {
          success: false,
          error: 'This promotion is not active'
        };
      }

      // Check date validity
      const now = new Date();
      const startDate = promotion.startDate?.toDate ? promotion.startDate.toDate() : new Date(promotion.startDate);
      const endDate = promotion.endDate?.toDate ? promotion.endDate.toDate() : new Date(promotion.endDate);

      if (now < startDate) {
        return {
          success: false,
          error: `This promotion starts on ${startDate.toLocaleDateString()}`
        };
      }

      if (now > endDate) {
        return {
          success: false,
          error: 'This promotion has expired'
        };
      }

      // Check one-time use
      if (promotion.usageType === 'one-time') {
        if (!clientId) {
          return {
            success: false,
            error: 'Client ID is required for one-time use promotions'
          };
        }

        const usedBy = promotion.usedBy || [];
        if (usedBy.includes(clientId)) {
          return {
            success: false,
            error: 'You have already used this promotion'
          };
        }
      }

      // Check max uses for repeating promotions
      if (promotion.usageType === 'repeating' && promotion.maxUses) {
        const usageCount = promotion.usageCount || 0;
        if (usageCount >= promotion.maxUses) {
          return {
            success: false,
            error: 'This promotion has reached its maximum usage limit'
          };
        }
      }

      // Convert Firestore timestamps to dates
      return {
        success: true,
        promotion: {
          ...promotion,
          startDate: startDate,
          endDate: endDate
        }
      };
    } catch (error) {
      console.error('Error validating promotion code:', error);
      return {
        success: false,
        error: 'Failed to validate promotion code'
      };
    }
  }

  /**
   * Calculate promotion discount (without tracking usage)
   * @param {Object} promotion - Promotion data
   * @param {number} subtotal - Transaction subtotal
   * @param {Array} services - Services in transaction
   * @param {Array} products - Products in transaction
   * @returns {Object} - Discount details
   */
  calculatePromotionDiscount(promotion, subtotal, services = [], products = []) {
    // Check applicable to
    let applicableSubtotal = 0;
    
    if (promotion.applicableTo === 'all') {
      applicableSubtotal = subtotal;
    } else if (promotion.applicableTo === 'services') {
      applicableSubtotal = services.reduce((sum, s) => sum + (s.adjustedPrice || s.price || 0), 0);
    } else if (promotion.applicableTo === 'products') {
      applicableSubtotal = products.reduce((sum, p) => sum + ((p.price || 0) * (p.quantity || 0)), 0);
    } else if (promotion.applicableTo === 'specific') {
      // Calculate subtotal for specific services
      const specificServices = promotion.specificServices || [];
      const servicesSubtotal = services
        .filter(s => specificServices.includes(s.id || s.serviceId))
        .reduce((sum, s) => sum + (s.adjustedPrice || s.price || 0), 0);
      
      // Calculate subtotal for specific products
      const specificProducts = promotion.specificProducts || [];
      const productsSubtotal = products
        .filter(p => specificProducts.includes(p.id || p.productId))
        .reduce((sum, p) => sum + ((p.price || 0) * (p.quantity || 0)), 0);
      
      applicableSubtotal = servicesSubtotal + productsSubtotal;
    }

    // Calculate discount
    let discountAmount = 0;
    if (promotion.discountType === 'percentage') {
      discountAmount = (applicableSubtotal * promotion.discountValue) / 100;
    } else {
      discountAmount = Math.min(promotion.discountValue, applicableSubtotal);
    }

    return {
      discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimal places
      discountType: promotion.discountType,
      discountValue: promotion.discountValue
    };
  }

  /**
   * Track promotion usage (call this when transaction is completed)
   * @param {string} promotionId - Promotion ID
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} - Success status
   */
  async trackPromotionUsage(promotionId, clientId = null) {
    try {
      const promotionRef = doc(db, 'promotions', promotionId);
      const promotionDoc = await getDoc(promotionRef);
      
      if (!promotionDoc.exists()) {
        return {
          success: false,
          error: 'Promotion not found'
        };
      }

      const promotion = promotionDoc.data();
      const updateData = {
        updatedAt: serverTimestamp()
      };

      if (promotion.usageType === 'one-time' && clientId) {
        const usedBy = promotion.usedBy || [];
        if (!usedBy.includes(clientId)) {
          updateData.usedBy = [...usedBy, clientId];
        }
      } else if (promotion.usageType === 'repeating') {
        updateData.usageCount = (promotion.usageCount || 0) + 1;
      }

      await updateDoc(promotionRef, updateData);

      return {
        success: true
      };
    } catch (error) {
      console.error('Error tracking promotion usage:', error);
      return {
        success: false,
        error: 'Failed to track promotion usage'
      };
    }
  }

  /**
   * Get all active promotions for a branch (filtered by date range)
   * @param {string} branchId - Branch ID
   * @param {string} clientId - Client ID (optional, for one-time use filtering)
   * @returns {Promise<Array>} - Array of active promotions
   */
  async getActivePromotions(branchId, clientId = null) {
    try {
      const promotionsRef = collection(db, 'promotions');
      const q = query(
        promotionsRef,
        where('branchId', '==', branchId),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const promotions = [];
      const now = new Date();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const startDate = data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate);
        const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
        
        // Only include promotions that are currently valid (within date range)
        if (now >= startDate && now <= endDate) {
          // For one-time use, check if client has already used it
          if (data.usageType === 'one-time' && clientId) {
            const usedBy = data.usedBy || [];
            if (usedBy.includes(clientId)) {
              return; // Skip this promotion
            }
          }

          // For repeating promotions, check max uses
          if (data.usageType === 'repeating' && data.maxUses) {
            const usageCount = data.usageCount || 0;
            if (usageCount >= data.maxUses) {
              return; // Skip this promotion
            }
          }

          promotions.push({
            id: doc.id,
            ...data,
            startDate,
            endDate
          });
        }
      });
      
      // Sort by title
      promotions.sort((a, b) => a.title.localeCompare(b.title));
      
      return promotions;
    } catch (error) {
      console.error('Error getting active promotions:', error);
      return [];
    }
  }
}

export const promotionService = new PromotionService();
export default promotionService;

