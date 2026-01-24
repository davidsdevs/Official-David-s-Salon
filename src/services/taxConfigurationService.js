/**
 * Tax Configuration Service
 * Handles tax rates and configuration management
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

const TAX_CONFIGURATION_COLLECTION = 'tax_configuration';

// Default tax configuration
export const DEFAULT_TAX_CONFIGURATION = {
  vatRate: 12, // 12% VAT (Philippines standard)
  serviceCharge: 0, // No service charge by default
  isVatInclusive: true, // VAT is included in prices
  isServiceChargeInclusive: false, // Service charge is added on top
  vatExemptServices: [], // Array of service IDs that are VAT exempt
  vatExemptProducts: [], // Array of product IDs that are VAT exempt
  minimumAmountForVat: 0, // Minimum amount to apply VAT
  seniorCitizenDiscount: 20, // 20% discount for senior citizens
  pwdDiscount: 20, // 20% discount for PWD
  vatExemptForSeniorPwd: true, // Senior citizens and PWD are VAT exempt
  isActive: true
};

/**
 * Get tax configuration
 * @returns {Promise<Object>} - Tax configuration
 */
export const getTaxConfiguration = async () => {
  try {
    const configRef = collection(db, TAX_CONFIGURATION_COLLECTION);
    const snapshot = await getDocs(configRef);
    
    if (snapshot.empty) {
      // Return default configuration if none configured
      return DEFAULT_TAX_CONFIGURATION;
    }
    
    // Get the first (and should be only) configuration document
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching tax configuration:', error);
    return DEFAULT_TAX_CONFIGURATION;
  }
};

/**
 * Update tax configuration
 * @param {Object} configData - Tax configuration data
 * @param {Object} currentUser - User updating the configuration
 * @returns {Promise<void>}
 */
export const updateTaxConfiguration = async (configData, currentUser) => {
  try {
    const configRef = collection(db, TAX_CONFIGURATION_COLLECTION);
    const snapshot = await getDocs(configRef);
    
    const userId = currentUser.uid || currentUser.id;
    const userName = currentUser.displayName || 
                    `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 
                    currentUser.email || 
                    'Unknown User';
    
    const updateData = {
      ...configData,
      updatedBy: userId,
      updatedByName: userName,
      updatedAt: Timestamp.now()
    };
    
    if (snapshot.empty) {
      // Create new configuration document
      updateData.createdBy = userId;
      updateData.createdByName = userName;
      updateData.createdAt = Timestamp.now();
      
      await addDoc(configRef, updateData);
      
      await logActivity({
        performedBy: userId,
        action: 'CREATE_TAX_CONFIGURATION',
        targetType: 'system',
        targetId: 'tax_configuration',
        details: 'Created tax configuration',
        metadata: configData
      });
      
      toast.success('Tax configuration created successfully');
    } else {
      // Update existing configuration document
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, updateData);
      
      await logActivity({
        performedBy: userId,
        action: 'UPDATE_TAX_CONFIGURATION',
        targetType: 'system',
        targetId: snapshot.docs[0].id,
        details: 'Updated tax configuration',
        metadata: configData
      });
      
      toast.success('Tax configuration updated successfully');
    }
  } catch (error) {
    console.error('Error updating tax configuration:', error);
    toast.error('Failed to update tax configuration');
    throw error;
  }
};

/**
 * Calculate tax for a transaction
 * @param {Object} billData - Bill data with items, subtotal, etc.
 * @param {Object} taxConfig - Tax configuration (optional, will fetch if not provided)
 * @param {Object} customerInfo - Customer information (for discounts)
 * @returns {Promise<Object>} - Tax calculation result
 */
export const calculateTax = async (billData, taxConfig = null, customerInfo = {}) => {
  try {
    if (!taxConfig) {
      taxConfig = await getTaxConfiguration();
    }
    
    const { items = [], subtotal = 0 } = billData;
    const { isSeniorCitizen = false, isPwd = false } = customerInfo;
    
    let taxableAmount = subtotal;
    let vatAmount = 0;
    let serviceChargeAmount = 0;
    let discountAmount = 0;
    
    // Apply senior citizen or PWD discount first
    if (isSeniorCitizen || isPwd) {
      const discountRate = isSeniorCitizen ? taxConfig.seniorCitizenDiscount : taxConfig.pwdDiscount;
      discountAmount = (subtotal * discountRate) / 100;
      taxableAmount = subtotal - discountAmount;
    }
    
    // Check if amount meets minimum threshold for VAT
    if (taxableAmount >= taxConfig.minimumAmountForVat) {
      // Check if customer is VAT exempt (senior citizen or PWD)
      const isVatExempt = (isSeniorCitizen || isPwd) && taxConfig.vatExemptForSeniorPwd;
      
      if (!isVatExempt) {
        // Filter out VAT exempt items
        const taxableItems = items.filter(item => {
          if (item.type === 'service') {
            return !taxConfig.vatExemptServices.includes(item.id);
          } else if (item.type === 'product') {
            return !taxConfig.vatExemptProducts.includes(item.id);
          }
          return true;
        });
        
        // Calculate taxable amount from non-exempt items
        const taxableItemsAmount = taxableItems.reduce((sum, item) => {
          return sum + (item.price * (item.quantity || 1));
        }, 0);
        
        // Apply discount to taxable amount
        const discountedTaxableAmount = taxableItemsAmount - (discountAmount * (taxableItemsAmount / subtotal));
        
        if (taxConfig.isVatInclusive) {
          // VAT is included in the price (VAT = Amount / 1.12 * 0.12)
          vatAmount = (discountedTaxableAmount / (1 + taxConfig.vatRate / 100)) * (taxConfig.vatRate / 100);
        } else {
          // VAT is added on top of the price
          vatAmount = (discountedTaxableAmount * taxConfig.vatRate) / 100;
        }
      }
    }
    
    // Calculate service charge
    if (taxConfig.serviceCharge > 0) {
      if (taxConfig.isServiceChargeInclusive) {
        // Service charge is included in the price
        serviceChargeAmount = (taxableAmount / (1 + taxConfig.serviceCharge / 100)) * (taxConfig.serviceCharge / 100);
      } else {
        // Service charge is added on top
        serviceChargeAmount = (taxableAmount * taxConfig.serviceCharge) / 100;
      }
    }
    
    // Calculate final total
    let finalTotal = subtotal;
    
    if (!taxConfig.isVatInclusive) {
      finalTotal += vatAmount;
    }
    
    if (!taxConfig.isServiceChargeInclusive) {
      finalTotal += serviceChargeAmount;
    }
    
    finalTotal -= discountAmount;
    
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      serviceChargeAmount: parseFloat(serviceChargeAmount.toFixed(2)),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      total: parseFloat(Math.max(0, finalTotal).toFixed(2)),
      taxableAmount: parseFloat(taxableAmount.toFixed(2)),
      isVatInclusive: taxConfig.isVatInclusive,
      isServiceChargeInclusive: taxConfig.isServiceChargeInclusive,
      vatRate: taxConfig.vatRate,
      serviceChargeRate: taxConfig.serviceCharge,
      appliedDiscounts: {
        seniorCitizen: isSeniorCitizen ? taxConfig.seniorCitizenDiscount : 0,
        pwd: isPwd ? taxConfig.pwdDiscount : 0
      }
    };
  } catch (error) {
    console.error('Error calculating tax:', error);
    return {
      subtotal: billData.subtotal || 0,
      vatAmount: 0,
      serviceChargeAmount: 0,
      discountAmount: 0,
      total: billData.subtotal || 0,
      taxableAmount: billData.subtotal || 0,
      isVatInclusive: true,
      isServiceChargeInclusive: false,
      vatRate: 0,
      serviceChargeRate: 0,
      appliedDiscounts: { seniorCitizen: 0, pwd: 0 }
    };
  }
};

/**
 * Validate tax configuration data
 * @param {Object} configData - Tax configuration data to validate
 * @returns {Object} - { isValid, errors }
 */
export const validateTaxConfiguration = (configData) => {
  const errors = [];
  
  // VAT rate validation
  if (configData.vatRate < 0 || configData.vatRate > 100) {
    errors.push('VAT rate must be between 0 and 100');
  }
  
  // Service charge validation
  if (configData.serviceCharge < 0 || configData.serviceCharge > 100) {
    errors.push('Service charge must be between 0 and 100');
  }
  
  // Minimum amount validation
  if (configData.minimumAmountForVat < 0) {
    errors.push('Minimum amount for VAT cannot be negative');
  }
  
  // Senior citizen discount validation
  if (configData.seniorCitizenDiscount < 0 || configData.seniorCitizenDiscount > 100) {
    errors.push('Senior citizen discount must be between 0 and 100');
  }
  
  // PWD discount validation
  if (configData.pwdDiscount < 0 || configData.pwdDiscount > 100) {
    errors.push('PWD discount must be between 0 and 100');
  }
  
  // VAT exempt arrays validation
  if (configData.vatExemptServices && !Array.isArray(configData.vatExemptServices)) {
    errors.push('VAT exempt services must be an array');
  }
  
  if (configData.vatExemptProducts && !Array.isArray(configData.vatExemptProducts)) {
    errors.push('VAT exempt products must be an array');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Reset tax configuration to default values
 * @param {Object} currentUser - User resetting the configuration
 * @returns {Promise<void>}
 */
export const resetTaxConfigurationToDefault = async (currentUser) => {
  try {
    await updateTaxConfiguration(DEFAULT_TAX_CONFIGURATION, currentUser);
    toast.success('Tax configuration reset to default values');
  } catch (error) {
    console.error('Error resetting tax configuration:', error);
    toast.error('Failed to reset tax configuration');
    throw error;
  }
};

/**
 * Get VAT breakdown for receipt printing
 * @param {Object} taxCalculation - Result from calculateTax function
 * @returns {Object} - VAT breakdown for receipt
 */
export const getVatBreakdown = (taxCalculation) => {
  const { subtotal, vatAmount, isVatInclusive, vatRate } = taxCalculation;
  
  if (isVatInclusive) {
    // VAT is included in the price
    const vatableSales = subtotal - vatAmount;
    const vatExemptSales = 0; // Assuming all sales are vatable for simplicity
    
    return {
      vatableSales: parseFloat(vatableSales.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      vatExemptSales: parseFloat(vatExemptSales.toFixed(2)),
      zeroRatedSales: 0,
      vatRate: vatRate
    };
  } else {
    // VAT is added on top
    return {
      vatableSales: parseFloat(subtotal.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      vatExemptSales: 0,
      zeroRatedSales: 0,
      vatRate: vatRate
    };
  }
};