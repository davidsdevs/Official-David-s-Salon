/**
 * System Settings Service
 * Handles company-wide settings and configuration
 */

import { 
  collection, 
  doc, 
  getDocs, 
  addDoc,
  updateDoc,
  query,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';
import { logActivity } from './activityService';

const SYSTEM_SETTINGS_COLLECTION = 'system_settings';

// Default system settings
export const DEFAULT_SYSTEM_SETTINGS = {
  // Company Information
  companyName: "David's Salon",
  companyLegalName: "David's Salon Corporation",
  companyTagline: "Your Beauty, Our Passion",
  
  // BIR Information
  tin: '000-000-000-000',
  birAccreditationNo: '',
  birPermitNo: '',
  birPermitDateIssued: null,
  vatRegistered: true,
  
  // Head Office Information
  headOfficeAddress: '',
  headOfficeCity: '',
  headOfficeProvince: '',
  headOfficeZipCode: '',
  headOfficePhone: '',
  headOfficeEmail: '',
  headOfficeFax: '',
  
  // Business Information
  businessType: 'Corporation',
  dateEstablished: null,
  secRegistrationNo: '',
  dtiRegistrationNo: '',
  mayorPermitNo: '',
  
  // Contact Information
  customerServicePhone: '',
  customerServiceEmail: '',
  websiteUrl: '',
  facebookPage: '',
  instagramHandle: '',
  
  // Receipt Settings
  receiptHeader: "David's Salon",
  receiptFooter: 'Thank you for choosing David\'s Salon!',
  returnPolicy: 'Products may be returned within 7 days with original receipt and packaging.',
  warrantyPolicy: 'Services are guaranteed for 7 days. Contact us for any concerns.',
  printCustomerCopy: true, // Enable printing customer copy by default
  
  // System Settings
  defaultCurrency: 'PHP',
  defaultTimezone: 'Asia/Manila',
  defaultLanguage: 'en',
  fiscalYearStart: '01-01', // MM-DD format
  
  // Operational Settings
  enableLoyaltyProgram: true,
  enablePromotions: true,
  enableReferralProgram: true,
  enableOnlineBooking: true,
  
  isActive: true
};

/**
 * Get system settings
 * @returns {Promise<Object>} - System settings
 */
export const getSystemSettings = async () => {
  try {
    const settingsRef = collection(db, SYSTEM_SETTINGS_COLLECTION);
    const snapshot = await getDocs(settingsRef);
    
    if (snapshot.empty) {
      // Return default settings if none configured
      return DEFAULT_SYSTEM_SETTINGS;
    }
    
    // Get the first (and should be only) settings document
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      birPermitDateIssued: doc.data().birPermitDateIssued?.toDate(),
      dateEstablished: doc.data().dateEstablished?.toDate()
    };
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return DEFAULT_SYSTEM_SETTINGS;
  }
};

/**
 * Update system settings
 * @param {Object} settingsData - System settings data
 * @param {Object} currentUser - User updating the settings
 * @returns {Promise<void>}
 */
export const updateSystemSettings = async (settingsData, currentUser) => {
  try {
    const settingsRef = collection(db, SYSTEM_SETTINGS_COLLECTION);
    const snapshot = await getDocs(settingsRef);
    
    const userId = currentUser.uid || currentUser.id;
    const userName = currentUser.displayName || 
                    `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 
                    currentUser.email || 
                    'Unknown User';
    
    // Convert date strings to Timestamps if present
    // Remove fields that shouldn't be in Firestore update
    const { id, createdAt, updatedAt: oldUpdatedAt, ...cleanSettingsData } = settingsData;
    
    const updateData = {
      ...cleanSettingsData,
      updatedBy: userId,
      updatedByName: userName,
      updatedAt: Timestamp.now()
    };
    
    // Handle date fields
    if (settingsData.birPermitDateIssued && typeof settingsData.birPermitDateIssued === 'string') {
      updateData.birPermitDateIssued = Timestamp.fromDate(new Date(settingsData.birPermitDateIssued));
    } else if (settingsData.birPermitDateIssued === '' || settingsData.birPermitDateIssued === undefined) {
      delete updateData.birPermitDateIssued;
    }
    
    if (settingsData.dateEstablished && typeof settingsData.dateEstablished === 'string') {
      updateData.dateEstablished = Timestamp.fromDate(new Date(settingsData.dateEstablished));
    } else if (settingsData.dateEstablished === '' || settingsData.dateEstablished === undefined) {
      delete updateData.dateEstablished;
    }
    
    // Remove all undefined values from updateData
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    if (snapshot.empty) {
      // Create new settings document
      updateData.createdBy = userId;
      updateData.createdByName = userName;
      updateData.createdAt = Timestamp.now();
      
      await addDoc(settingsRef, updateData);
      
      await logActivity({
        performedBy: userId,
        action: 'CREATE_SYSTEM_SETTINGS',
        targetType: 'system',
        targetId: 'system_settings',
        details: 'Created system settings',
        metadata: settingsData
      });
      
      toast.success('System settings created successfully');
    } else {
      // Update existing settings document
      const docRef = snapshot.docs[0].ref;
      await updateDoc(docRef, updateData);
      
      await logActivity({
        performedBy: userId,
        action: 'UPDATE_SYSTEM_SETTINGS',
        targetType: 'system',
        targetId: snapshot.docs[0].id,
        details: 'Updated system settings',
        metadata: settingsData
      });
      
      toast.success('System settings updated successfully');
    }
  } catch (error) {
    console.error('Error updating system settings:', error);
    toast.error('Failed to update system settings');
    throw error;
  }
};

/**
 * Validate system settings data
 * @param {Object} settingsData - System settings data to validate
 * @returns {Object} - { isValid, errors }
 */
export const validateSystemSettings = (settingsData) => {
  const errors = [];
  
  // Company name validation
  if (!settingsData.companyName || settingsData.companyName.trim() === '') {
    errors.push('Company name is required');
  }
  
  // TIN validation (Philippine format: XXX-XXX-XXX-XXX)
  if (settingsData.tin) {
    const tinPattern = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
    if (!tinPattern.test(settingsData.tin)) {
      errors.push('TIN must be in format: XXX-XXX-XXX-XXX');
    }
  }
  
  // Email validation
  if (settingsData.headOfficeEmail) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(settingsData.headOfficeEmail)) {
      errors.push('Head office email is invalid');
    }
  }
  
  if (settingsData.customerServiceEmail) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(settingsData.customerServiceEmail)) {
      errors.push('Customer service email is invalid');
    }
  }
  
  // Phone validation (Philippine format)
  if (settingsData.headOfficePhone) {
    const phonePattern = /^(\+63|0)\d{10}$/;
    if (!phonePattern.test(settingsData.headOfficePhone.replace(/[\s-]/g, ''))) {
      errors.push('Head office phone number is invalid');
    }
  }
  
  // URL validation
  if (settingsData.websiteUrl) {
    try {
      new URL(settingsData.websiteUrl);
    } catch {
      errors.push('Website URL is invalid');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Reset system settings to default values
 * @param {Object} currentUser - User resetting the settings
 * @returns {Promise<void>}
 */
export const resetSystemSettingsToDefault = async (currentUser) => {
  try {
    await updateSystemSettings(DEFAULT_SYSTEM_SETTINGS, currentUser);
    toast.success('System settings reset to default values');
  } catch (error) {
    console.error('Error resetting system settings:', error);
    toast.error('Failed to reset system settings');
    throw error;
  }
};

/**
 * Get formatted company address
 * @param {Object} settings - System settings
 * @returns {string} - Formatted address
 */
export const getFormattedAddress = (settings) => {
  const parts = [
    settings.headOfficeAddress,
    settings.headOfficeCity,
    settings.headOfficeProvince,
    settings.headOfficeZipCode
  ].filter(Boolean);
  
  return parts.join(', ');
};

/**
 * Get company contact info
 * @param {Object} settings - System settings
 * @returns {Object} - Contact information
 */
export const getCompanyContactInfo = (settings) => {
  return {
    phone: settings.headOfficePhone || settings.customerServicePhone || '',
    email: settings.headOfficeEmail || settings.customerServiceEmail || '',
    address: getFormattedAddress(settings),
    website: settings.websiteUrl || '',
    facebook: settings.facebookPage || '',
    instagram: settings.instagramHandle || ''
  };
};
