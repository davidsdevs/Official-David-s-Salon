/**
 * Loyalty Criteria Configuration Service
 * Handles loyalty points configuration and criteria management
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc,
  setDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';
import { logActivity } from './activityService';

const LOYALTY_CRITERIA_COLLECTION = 'loyalty_criteria';

// Default loyalty criteria
export const DEFAULT_LOYALTY_CRITERIA = {
  pointsPerPeso: 0.01, // 1 point per ₱100 spent
  pointValue: 1, // 1 point = ₱1 discount
  minimumSpendForPoints: 100, // Minimum spend to earn points
  maximumPointsPerTransaction: 1000, // Maximum points that can be earned per transaction
  pointsExpiryDays: 365, // Points expire after 1 year
  minimumRedemptionPoints: 50, // Minimum points required to redeem
  maximumRedemptionPercentage: 50, // Maximum percentage of bill that can be paid with points
  bonusPointsThreshold: 5000, // Spend threshold for bonus points
  bonusPointsMultiplier: 2, // Bonus multiplier when threshold is reached
  birthdayBonusPoints: 100, // Bonus points on birthday
  referralBonusPoints: 200, // Bonus points for successful referrals
  isActive: true
};

/**
 * Get loyalty criteria configuration
 * @returns {Promise<Object>} - Loyalty criteria configuration
 */
export const getLoyaltyCriteria = async () => {
  try {
    const criteriaRef = collection(db, LOYALTY_CRITERIA_COLLECTION);
    const snapshot = await getDocs(criteriaRef);
    
    if (snapshot.empty) {
      // Return default criteria if none configured
      return DEFAULT_LOYALTY_CRITERIA;
    }
    
    // Get the first (and should be only) criteria document
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching loyalty criteria:', error);
    return DEFAULT_LOYALTY_CRITERIA;
  }
};

/**
 * Update loyalty criteria configuration
 * @param {Object} criteriaData - Loyalty criteria data
 * @param {Object} currentUser - User updating the criteria
 * @returns {Promise<void>}
 */
export const updateLoyaltyCriteria = async (criteriaData, currentUser) => {
  try {
    const criteriaRef = collection(db, LOYALTY_CRITERIA_COLLECTION);
    const snapshot = await getDocs(criteriaRef);
    
    const userId = currentUser.uid || currentUser.id;
    const userName = currentUser.displayName || 
                    `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 
                    currentUser.email || 
                    'Unknown User';
    
    const updateData = {
      ...criteriaData,
      updatedBy: userId,
      updatedByName: userName,
      updatedAt: Timestamp.now()
    };
    
    if (snapshot.empty) {
      // Create new criteria document
      updateData.createdBy = userId;
      updateData.createdByName = userName;
      updateData.createdAt = Timestamp.now();
      
      await addDoc(criteriaRef, updateData);
      
      await logActivity({
        performedBy: userId,
        action: 'CREATE_LOYALTY_CRITERIA',
        targetType: 'system',
        targetId: 'loyalty_criteria',
        details: 'Created loyalty criteria configuration',
        metadata: criteriaData
      });
      
      toast.success('Loyalty criteria configuration created successfully');
    } else {
      // Update existing criteria document
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, updateData);
      
      await logActivity({
        performedBy: userId,
        action: 'UPDATE_LOYALTY_CRITERIA',
        targetType: 'system',
        targetId: snapshot.docs[0].id,
        details: 'Updated loyalty criteria configuration',
        metadata: criteriaData
      });
      
      toast.success('Loyalty criteria configuration updated successfully');
    }
  } catch (error) {
    console.error('Error updating loyalty criteria:', error);
    toast.error('Failed to update loyalty criteria configuration');
    throw error;
  }
};

/**
 * Calculate points earned based on criteria
 * @param {number} amount - Transaction amount
 * @param {Object} criteria - Loyalty criteria (optional, will fetch if not provided)
 * @returns {Promise<number>} - Points earned
 */
export const calculatePointsEarned = async (amount, criteria = null) => {
  try {
    if (!criteria) {
      criteria = await getLoyaltyCriteria();
    }
    
    // Check minimum spend requirement
    if (amount < criteria.minimumSpendForPoints) {
      return 0;
    }
    
    // Calculate base points
    let pointsEarned = Math.floor(amount * criteria.pointsPerPeso);
    
    // Apply maximum points per transaction limit
    if (pointsEarned > criteria.maximumPointsPerTransaction) {
      pointsEarned = criteria.maximumPointsPerTransaction;
    }
    
    // Apply bonus multiplier if threshold is reached
    if (amount >= criteria.bonusPointsThreshold) {
      pointsEarned = Math.floor(pointsEarned * criteria.bonusPointsMultiplier);
    }
    
    return pointsEarned;
  } catch (error) {
    console.error('Error calculating points earned:', error);
    return 0;
  }
};

/**
 * Calculate maximum redeemable points for a transaction
 * @param {number} billAmount - Bill amount
 * @param {number} availablePoints - Available loyalty points
 * @param {Object} criteria - Loyalty criteria (optional, will fetch if not provided)
 * @returns {Promise<Object>} - { maxPoints, maxDiscount }
 */
export const calculateMaxRedeemablePoints = async (billAmount, availablePoints, criteria = null) => {
  try {
    if (!criteria) {
      criteria = await getLoyaltyCriteria();
    }
    
    // Check minimum redemption requirement
    if (availablePoints < criteria.minimumRedemptionPoints) {
      return { maxPoints: 0, maxDiscount: 0 };
    }
    
    // Calculate maximum discount based on percentage limit
    const maxDiscountFromPercentage = (billAmount * criteria.maximumRedemptionPercentage) / 100;
    
    // Calculate maximum points based on point value
    const maxPointsFromDiscount = Math.floor(maxDiscountFromPercentage / criteria.pointValue);
    
    // Use the minimum of available points and calculated maximum
    const maxPoints = Math.min(availablePoints, maxPointsFromDiscount);
    const maxDiscount = maxPoints * criteria.pointValue;
    
    return { maxPoints, maxDiscount };
  } catch (error) {
    console.error('Error calculating max redeemable points:', error);
    return { maxPoints: 0, maxDiscount: 0 };
  }
};

/**
 * Validate loyalty criteria data
 * @param {Object} criteriaData - Loyalty criteria data to validate
 * @returns {Object} - { isValid, errors }
 */
export const validateLoyaltyCriteria = (criteriaData) => {
  const errors = [];
  
  // Points per peso validation
  if (!criteriaData.pointsPerPeso || criteriaData.pointsPerPeso <= 0) {
    errors.push('Points per peso must be greater than 0');
  }
  
  // Point value validation
  if (!criteriaData.pointValue || criteriaData.pointValue <= 0) {
    errors.push('Point value must be greater than 0');
  }
  
  // Minimum spend validation
  if (criteriaData.minimumSpendForPoints < 0) {
    errors.push('Minimum spend for points cannot be negative');
  }
  
  // Maximum points per transaction validation
  if (!criteriaData.maximumPointsPerTransaction || criteriaData.maximumPointsPerTransaction <= 0) {
    errors.push('Maximum points per transaction must be greater than 0');
  }
  
  // Points expiry validation
  if (!criteriaData.pointsExpiryDays || criteriaData.pointsExpiryDays <= 0) {
    errors.push('Points expiry days must be greater than 0');
  }
  
  // Minimum redemption points validation
  if (criteriaData.minimumRedemptionPoints < 0) {
    errors.push('Minimum redemption points cannot be negative');
  }
  
  // Maximum redemption percentage validation
  if (!criteriaData.maximumRedemptionPercentage || 
      criteriaData.maximumRedemptionPercentage <= 0 || 
      criteriaData.maximumRedemptionPercentage > 100) {
    errors.push('Maximum redemption percentage must be between 1 and 100');
  }
  
  // Bonus points threshold validation
  if (criteriaData.bonusPointsThreshold < 0) {
    errors.push('Bonus points threshold cannot be negative');
  }
  
  // Bonus points multiplier validation
  if (!criteriaData.bonusPointsMultiplier || criteriaData.bonusPointsMultiplier < 1) {
    errors.push('Bonus points multiplier must be at least 1');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Reset loyalty criteria to default values
 * @param {Object} currentUser - User resetting the criteria
 * @returns {Promise<void>}
 */
export const resetLoyaltyCriteriaToDefault = async (currentUser) => {
  try {
    await updateLoyaltyCriteria(DEFAULT_LOYALTY_CRITERIA, currentUser);
    toast.success('Loyalty criteria reset to default values');
  } catch (error) {
    console.error('Error resetting loyalty criteria:', error);
    toast.error('Failed to reset loyalty criteria');
    throw error;
  }
};