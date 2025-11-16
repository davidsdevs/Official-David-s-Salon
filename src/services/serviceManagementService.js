/**
 * Service Management Service
 * For System Admin to manage global services in the 'services' collection
 * 
 * Services are global with branch-specific pricing via branchPricing field
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

/**
 * Get all global services
 * @returns {Promise<Array>} Array of all services
 */
export const getAllServices = async () => {
  try {
    const servicesRef = collection(db, 'services');
    const q = query(servicesRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching all services:', error);
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
 * Create or update a global service
 * @param {Object} serviceData - Service data
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<string>} Service ID
 */
export const saveService = async (serviceData, currentUser) => {
  try {
    const serviceId = serviceData.id || doc(collection(db, 'services')).id;
    const serviceRef = doc(db, 'services', serviceId);
    
    const data = {
      name: serviceData.name,
      description: serviceData.description || '',
      category: serviceData.category || 'General',
      duration: serviceData.duration || 30, // in minutes
      imageURL: serviceData.imageURL || '',
      isChemical: serviceData.isChemical || false,
      isActive: serviceData.isActive !== undefined ? serviceData.isActive : true,
      inventoryItems: serviceData.inventoryItems || [], // Array of {itemId, itemName, itemUnit, quantity}
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    if (!serviceData.id) {
      data.createdAt = Timestamp.now();
      data.createdBy = currentUser.uid;
      // Initialize empty branchPricing for new services
      data.branchPricing = {};
    }
    
    await setDoc(serviceRef, data, { merge: true });
    
    // Log activity
    await logActivity({
      action: serviceData.id ? 'service_updated' : 'service_created',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        serviceId,
        serviceName: serviceData.name,
        category: serviceData.category
      }
    });
    
    toast.success(`Service ${serviceData.id ? 'updated' : 'created'} successfully!`);
    return serviceId;
  } catch (error) {
    console.error('Error saving service:', error);
    toast.error('Failed to save service');
    throw error;
  }
};

/**
 * Toggle service active status (global on/off)
 * @param {string} serviceId - Service ID
 * @param {boolean} isActive - New active status
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const toggleServiceActive = async (serviceId, isActive, currentUser) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    
    await updateDoc(serviceRef, {
      isActive,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: 'service_toggled',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        serviceId,
        isActive
      }
    });
    
    toast.success(`Service ${isActive ? 'activated' : 'deactivated'} successfully!`);
  } catch (error) {
    console.error('Error toggling service:', error);
    toast.error('Failed to toggle service');
    throw error;
  }
};

/**
 * Delete a global service
 * WARNING: This will remove the service from all branches
 * @param {string} serviceId - Service ID
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const deleteService = async (serviceId, currentUser) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    const serviceDoc = await getDoc(serviceRef);
    const serviceData = serviceDoc.data();
    
    // Check if any branches are using this service
    const branchPricing = serviceData?.branchPricing || {};
    const branchesUsingService = Object.keys(branchPricing).length;
    
    if (branchesUsingService > 0) {
      throw new Error(
        `Cannot delete service. It is being used by ${branchesUsingService} branch(es). ` +
        `Please remove it from all branches first.`
      );
    }
    
    await deleteDoc(serviceRef);
    
    // Log activity
    await logActivity({
      action: 'service_deleted',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        serviceId,
        serviceName: serviceData?.name
      }
    });
    
    toast.success('Service deleted successfully!');
  } catch (error) {
    console.error('Error deleting service:', error);
    toast.error(error.message || 'Failed to delete service');
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
