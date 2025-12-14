/**
 * Service Templates Service
 * Manages master service templates created by System Admin
 * Templates are used as base for branch-specific services
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
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

const TEMPLATES_COLLECTION = 'service_templates';

/**
 * Get all service templates
 * @returns {Promise<Array>} Array of service templates
 */
export const getServiceTemplates = async () => {
  try {
    const templatesRef = collection(db, TEMPLATES_COLLECTION);
    const q = query(templatesRef, orderBy('serviceName', 'asc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching service templates:', error);
    throw error;
  }
};

/**
 * Get active service templates (enabled only)
 * @returns {Promise<Array>} Array of active templates
 */
export const getActiveServiceTemplates = async () => {
  try {
    const templatesRef = collection(db, TEMPLATES_COLLECTION);
    const q = query(
      templatesRef,
      where('enabled', '==', true),
      orderBy('serviceName', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching active service templates:', error);
    throw error;
  }
};

/**
 * Get a single service template by ID
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Template data
 */
export const getServiceTemplateById = async (templateId) => {
  try {
    const templateRef = doc(db, TEMPLATES_COLLECTION, templateId);
    const templateDoc = await getDoc(templateRef);
    
    if (!templateDoc.exists()) {
      throw new Error('Service template not found');
    }
    
    return {
      id: templateDoc.id,
      ...templateDoc.data()
    };
  } catch (error) {
    console.error('Error fetching service template:', error);
    throw error;
  }
};

/**
 * Create or update a service template
 * @param {Object} templateData - Template data
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<string>} Template ID
 */
export const saveServiceTemplate = async (templateData, currentUser) => {
  try {
    const templateId = templateData.id || doc(collection(db, TEMPLATES_COLLECTION)).id;
    const templateRef = doc(db, TEMPLATES_COLLECTION, templateId);
    
    const data = {
      serviceName: templateData.serviceName,
      description: templateData.description || '',
      category: templateData.category || 'General',
      defaultDuration: templateData.defaultDuration || 30, // in minutes
      isChemical: templateData.isChemical || false, // Flag for chemical services
      enabled: templateData.enabled !== undefined ? templateData.enabled : true,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    if (!templateData.id) {
      data.createdAt = Timestamp.now();
      data.createdBy = currentUser.uid;
    }
    
    await setDoc(templateRef, data, { merge: true });
    
    // Log activity
    await logActivity({
      action: templateData.id ? 'service_template_updated' : 'service_template_created',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        templateId,
        serviceName: templateData.serviceName,
        category: templateData.category
      }
    });
    
    toast.success(`Template ${templateData.id ? 'updated' : 'created'} successfully!`);
    return templateId;
  } catch (error) {
    console.error('Error saving service template:', error);
    toast.error('Failed to save template');
    throw error;
  }
};

/**
 * Toggle template enabled status
 * @param {string} templateId - Template ID
 * @param {boolean} enabled - New enabled status
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const toggleServiceTemplate = async (templateId, enabled, currentUser) => {
  try {
    const templateRef = doc(db, TEMPLATES_COLLECTION, templateId);
    
    await updateDoc(templateRef, {
      enabled,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: 'service_template_toggled',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        templateId,
        enabled
      }
    });
    
    toast.success(`Template ${enabled ? 'enabled' : 'disabled'} successfully!`);
  } catch (error) {
    console.error('Error toggling service template:', error);
    toast.error('Failed to toggle template');
    throw error;
  }
};

/**
 * Delete a service template
 * @param {string} templateId - Template ID
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const deleteServiceTemplate = async (templateId, currentUser) => {
  try {
    const templateRef = doc(db, TEMPLATES_COLLECTION, templateId);
    const templateDoc = await getDoc(templateRef);
    const templateData = templateDoc.data();
    
    // TODO: Check if any branch services are using this template
    // For now, we'll allow deletion
    
    await deleteDoc(templateRef);
    
    // Log activity
    await logActivity({
      action: 'service_template_deleted',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        templateId,
        serviceName: templateData?.serviceName
      }
    });
    
    toast.success('Template deleted successfully!');
  } catch (error) {
    console.error('Error deleting service template:', error);
    toast.error('Failed to delete template');
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
