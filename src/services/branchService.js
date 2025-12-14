/**
 * Branch Service
 * Handles all branch-related operations
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
  limit,
  startAfter,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

/**
 * Get all branches
 * @returns {Promise<Array>} Array of branches
 */
export const getAllBranches = async () => {
  try {
    const branchesRef = collection(db, 'branches');
    
    // Try with orderBy first, fallback to simple query if it fails
    let snapshot;
    try {
      // Try ordering by branchName first (actual field name), then fallback to name
      const q = query(branchesRef, orderBy('branchName', 'asc'));
      snapshot = await getDocs(q);
    } catch (orderByError) {
      // If orderBy fails (e.g., missing index or field), try without it
      console.warn('orderBy failed, fetching without order:', orderByError.message);
      snapshot = await getDocs(branchesRef);
    }
    
    const branches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort manually by branchName or name field
    if (branches.length > 0) {
      branches.sort((a, b) => {
        const nameA = (a.branchName || a.name || '').toLowerCase();
        const nameB = (b.branchName || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    
    console.log(`[branchService] getAllBranches: Found ${branches.length} branches`);
    if (branches.length > 0) {
      console.log('[branchService] Sample branch:', {
        id: branches[0].id,
        branchName: branches[0].branchName,
        name: branches[0].name,
        isActive: branches[0].isActive
      });
    }
    return branches;
  } catch (error) {
    console.error('Error fetching branches:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Get active branches only
 * @returns {Promise<Array>} Array of active branches
 */
export const getActiveBranches = async () => {
  try {
    const branchesRef = collection(db, 'branches');
    const q = query(
      branchesRef, 
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching active branches:', error);
    throw error;
  }
};

/**
 * Get branch by ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} Branch data
 */
export const getBranchById = async (branchId) => {
  try {
    const branchDoc = await getDoc(doc(db, 'branches', branchId));
    
    if (!branchDoc.exists()) {
      throw new Error('Branch not found');
    }
    
    return {
      id: branchDoc.id,
      ...branchDoc.data()
    };
  } catch (error) {
    // Don't log here, let the caller handle it
    throw error;
  }
};

/**
 * Create new branch
 * @param {Object} branchData - Branch information
 * @param {Object} currentUser - User creating the branch
 * @returns {Promise<Object>} Created branch data
 */
export const createBranch = async (branchData, currentUser) => {
  try {
    // Generate branch ID
    const branchRef = doc(collection(db, 'branches'));
    const branchId = branchRef.id;
    
    const newBranch = {
      name: branchData.name || branchData.branchName, // Support both for migration
      address: branchData.address,
      contact: branchData.contact,
      email: branchData.email,
      managerID: branchData.managerID || null,
      operatingHours: branchData.operatingHours || {
        monday: { open: '09:00', close: '18:00', isOpen: true },
        tuesday: { open: '09:00', close: '18:00', isOpen: true },
        wednesday: { open: '09:00', close: '18:00', isOpen: true },
        thursday: { open: '09:00', close: '18:00', isOpen: true },
        friday: { open: '09:00', close: '18:00', isOpen: true },
        saturday: { open: '09:00', close: '18:00', isOpen: true },
        sunday: { open: '09:00', close: '18:00', isOpen: false }
      },
      isActive: true,
      createdAt: Timestamp.now(),
      createdBy: currentUser.uid,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    await setDoc(branchRef, newBranch);
    
    // Log activity
    await logActivity({
      action: 'branch_created',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId: branchId,
        name: branchData.name || branchData.branchName,
        managerID: branchData.managerID
      }
    });
    
    toast.success(`Branch "${branchData.name || branchData.branchName}" created successfully!`);
    
    return {
      id: branchId,
      ...newBranch
    };
  } catch (error) {
    console.error('Error creating branch:', error);
    toast.error('Failed to create branch');
    throw error;
  }
};

/**
 * Update branch information
 * @param {string} branchId - Branch ID
 * @param {Object} updates - Data to update
 * @param {Object} currentUser - User performing the update
 * @returns {Promise<void>}
 */
export const updateBranch = async (branchId, updates, currentUser) => {
  try {
    // Get current branch data to compare changes
    const branchDoc = await getDoc(doc(db, 'branches', branchId));
    const currentData = branchDoc.data();
    
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    // Find what actually changed
    const changedFields = Object.keys(updates).filter(key => {
      if (key === 'operatingHours') {
        return JSON.stringify(currentData[key]) !== JSON.stringify(updates[key]);
      }
      return currentData[key] !== updates[key];
    });
    
    await updateDoc(doc(db, 'branches', branchId), updateData);
    
    // Log activity with only changed fields
    await logActivity({
      action: 'branch_updated',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId: branchId,
        name: currentData.name || currentData.branchName,
        changedFields: changedFields,
        changes: changedFields.reduce((acc, field) => {
          acc[field] = {
            from: currentData[field],
            to: updates[field]
          };
          return acc;
        }, {})
      }
    });
    
    toast.success('Branch updated successfully!');
  } catch (error) {
    console.error('Error updating branch:', error);
    toast.error('Failed to update branch');
    throw error;
  }
};

/**
 * Toggle branch status (activate/deactivate)
 * @param {string} branchId - Branch ID
 * @param {boolean} active - New status
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const toggleBranchStatus = async (branchId, active, currentUser) => {
  try {
    const branchDoc = await getDoc(doc(db, 'branches', branchId));
    const branchData = branchDoc.data();
    
    await updateDoc(doc(db, 'branches', branchId), {
      isActive: active,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: active ? 'branch_activated' : 'branch_deactivated',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId: branchId,
        name: branchData.name || branchData.branchName
      }
    });
    
    toast.success(`Branch ${active ? 'activated' : 'deactivated'} successfully!`);
  } catch (error) {
    console.error('Error toggling branch status:', error);
    toast.error('Failed to update branch status');
    throw error;
  }
};

/**
 * Get branches managed by a specific manager
 * @param {string} managerId - Manager user ID
 * @returns {Promise<Array>} Array of branches
 */
export const getBranchesByManager = async (managerId) => {
  try {
    const branchesRef = collection(db, 'branches');
    const q = query(
      branchesRef,
      where('managerID', '==', managerId),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching manager branches:', error);
    throw error;
  }
};

/**
 * Delete branch
 * @param {string} branchId - Branch ID
 * @param {Object} currentUser - User performing the deletion
 * @returns {Promise<void>}
 */
export const deleteBranch = async (branchId, currentUser) => {
  try {
    // Get branch data before deletion for logging
    const branchDoc = await getDoc(doc(db, 'branches', branchId));
    const branchData = branchDoc.data();
    
    // Check if branch has staff assigned
    const usersRef = collection(db, 'users');
    const staffQuery = query(usersRef, where('branchId', '==', branchId));
    const staffSnapshot = await getDocs(staffQuery);
    
    if (staffSnapshot.size > 0) {
      toast.error(`Cannot delete branch. ${staffSnapshot.size} staff member(s) are still assigned to this branch.`);
      throw new Error('Branch has assigned staff');
    }
    
    // Delete the branch
    await deleteDoc(doc(db, 'branches', branchId));
    
    // Log activity
    await logActivity({
      action: 'branch_deleted',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId: branchId,
        name: branchData.name || branchData.branchName,
        deletedAt: new Date().toISOString()
      }
    });
    
    toast.success(`Branch "${branchData.name || branchData.branchName}" deleted successfully!`);
  } catch (error) {
    if (error.message !== 'Branch has assigned staff') {
      console.error('Error deleting branch:', error);
      toast.error('Failed to delete branch');
    }
    throw error;
  }
};

/**
 * Get all branches (compatible with old branchService.getBranches)
 * @param {string} currentUserRole - Current user role (for filtering, optional)
 * @param {string} currentUserId - Current user ID (for filtering, optional)
 * @param {number} pageSize - Number of branches to return (default: 100)
 * @param {Object} lastDoc - Last document for pagination (optional)
 * @returns {Promise<Array>} Array of branches
 */
export const getBranches = async (currentUserRole = null, currentUserId = null, pageSize = 100, lastDoc = null) => {
  try {
    const branchesRef = collection(db, 'branches');
    let q = query(branchesRef, orderBy('createdAt', 'desc'));
    
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    // Apply limit if pageSize is specified and less than 1000 (Firestore limit)
    if (pageSize && pageSize < 1000) {
      q = query(q, limit(pageSize));
    } else if (!pageSize || pageSize >= 1000) {
      // Default to 100 if no pageSize or very large
      q = query(q, limit(100));
    }
    
    const snapshot = await getDocs(q);
    const branches = [];
    
    snapshot.forEach((doc) => {
      const branchData = doc.data();
      branches.push({
        id: doc.id,
        ...branchData
      });
    });
    
    return branches;
  } catch (error) {
    console.error('Error getting branches:', error);
    throw error;
  }
};

/**
 * Get branch statistics
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} Branch statistics
 */
export const getBranchStats = async (branchId) => {
  try {
    // Get staff count
    const usersRef = collection(db, 'users');
    const staffQuery = query(usersRef, where('branchId', '==', branchId));
    const staffSnapshot = await getDocs(staffQuery);
    
    // Get today's appointment count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointmentsRef = collection(db, 'appointments');
    const appointmentsQuery = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      where('appointmentDate', '>=', Timestamp.fromDate(today)),
      where('appointmentDate', '<', Timestamp.fromDate(tomorrow))
    );
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    
    // TODO: Add more stats when other modules are implemented
    // - Revenue (M04 - Billing/POS)
    // - Inventory items (M05 - Inventory)
    
    return {
      staffCount: staffSnapshot.size,
      appointmentCount: appointmentsSnapshot.size,
      revenue: 0, // Placeholder for M04
      inventoryItems: 0 // Placeholder for M05
    };
  } catch (error) {
    console.error('Error fetching branch stats:', error);
    throw error;
  }
};
