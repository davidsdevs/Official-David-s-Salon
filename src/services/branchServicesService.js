/**
 * Branch Services Service
 * Manages services available at each branch
 * 
 * NEW MODEL:
 * - Single 'services' collection with global service info
 * - branchPricing field: { [branchId]: price } (direct price values)
 * - Branch offers service if branchPricing[branchId] exists
 * - Branch stops offering by deleting branchPricing[branchId]
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

/**
 * Get all services offered by a branch (those with branchPricing[branchId] defined)
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of services with branch pricing
 */
export const getBranchServices = async (branchId) => {
  try {
    const servicesRef = collection(db, 'services');
    // Get all active global services
    const q = query(
      servicesRef,
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    
    // Filter to only those offered by this branch (has branchPricing[branchId])
    return snapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.branchPricing && data.branchPricing[branchId] !== undefined;
      })
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Include branch-specific price at top level for convenience
          price: data.branchPricing[branchId]
        };
      });
  } catch (error) {
    console.error('Error fetching branch services:', error);
    throw error;
  }
};

/**
 * Get all global services with branch configuration
 * Used by branch manager to see all services and configure which ones to offer
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of all services with branch config
 */
export const getAllServicesWithBranchConfig = async (branchId) => {
  try {
    const servicesRef = collection(db, 'services');
    const q = query(
      servicesRef,
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      const branchPrice = data.branchPricing?.[branchId];
      return {
        id: doc.id,
        ...data,
        // Include branch price if configured, otherwise null
        price: branchPrice || null,
        isOfferedByBranch: branchPrice !== undefined
      };
    });
  } catch (error) {
    console.error('Error fetching all services with branch config:', error);
    throw error;
  }
};

/**
 * Set or update branch price for a service
 * Creates branchPricing[branchId] entry if it doesn't exist
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {number} price - Price for this branch
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const setBranchPrice = async (serviceId, branchId, price, currentUser) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    
    // Get current service to preserve other branchPricing
    const serviceDoc = await getDoc(serviceRef);
    if (!serviceDoc.exists()) {
      throw new Error('Service not found');
    }
    
    const currentData = serviceDoc.data();
    const branchPricing = currentData.branchPricing || {};
    const oldPrice = branchPricing[branchId];
    
    // Only track history if price actually changed
    if (oldPrice !== undefined && oldPrice !== price) {
      // Record price change history
      const priceHistoryRef = collection(db, 'servicePriceHistory');
      await addDoc(priceHistoryRef, {
        serviceId,
        serviceName: currentData.name,
        branchId,
        oldPrice,
        newPrice: price,
        changedBy: currentUser.uid,
        changedByName: currentUser.displayName || currentUser.email || 'Unknown',
        changedAt: Timestamp.now()
      });
    }
    
    // Update or add this branch's price (direct value)
    branchPricing[branchId] = price;
    
    await updateDoc(serviceRef, {
      branchPricing,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: 'branch_service_price_set',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        serviceId,
        serviceName: currentData.name,
        price
      }
    });
    
    toast.success('Service price set successfully!');
  } catch (error) {
    console.error('Error setting branch price:', error);
    toast.error('Failed to set service price');
    throw error;
  }
};

/**
 * Disable a service for a branch (remove from branchPricing)
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const disableBranchService = async (serviceId, branchId, currentUser) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    
    // Get current service
    const serviceDoc = await getDoc(serviceRef);
    if (!serviceDoc.exists()) {
      throw new Error('Service not found');
    }
    
    const currentData = serviceDoc.data();
    const branchPricing = currentData.branchPricing || {};
    
    // Remove this branch from branchPricing
    delete branchPricing[branchId];
    
    await updateDoc(serviceRef, {
      branchPricing,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: 'branch_service_disabled',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        serviceId,
        serviceName: currentData.name
      }
    });
    
    toast.success('Service disabled for this branch!');
  } catch (error) {
    console.error('Error disabling branch service:', error);
    toast.error('Failed to disable service');
    throw error;
  }
};


/**
 * Get a single service by ID
 * @param {string} serviceId - Service ID
 * @returns {Promise<Object>} Service data
 */
export const getServiceById = async (serviceId) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    const serviceDoc = await getDoc(serviceRef);
    
    if (!serviceDoc.exists()) {
      throw new Error('Service not found');
    }
    
    return {
      id: serviceDoc.id,
      ...serviceDoc.data()
    };
  } catch (error) {
    console.error('Error fetching service:', error);
    throw error;
  }
};


/**
 * Get service categories
 * @returns {Array<string>} Array of service categories
 */
export const getServiceCategories = () => {
  return [
    'Haircut and Blowdry',
    'Hair Coloring',
    'Straightening & Forming',
    'Hair & Make Up',
    'Hair Treatment',
    'Nail Care / Waxing / Threading'
  ];
};
