/**
 * Activity Logging Service
 * Module: M01 - User & Role Management
 * Tracks all user-related actions for audit purposes
 */

import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  getDoc,
  doc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Log an activity/action
 * @param {Object} activityData - Activity details
 * @returns {Promise<string>} Document ID of logged activity
 */
export const logActivity = async (activityData) => {
  try {
    // Fetch user names for better display
    let performedByName = 'Unknown User';
    let targetUserName = null;

    // Get performer's name
    if (activityData.performedBy) {
      try {
        const performerDoc = await getDoc(doc(db, 'users', activityData.performedBy));
        if (performerDoc.exists()) {
          const data = performerDoc.data();
          if (data.firstName && data.lastName) {
            performedByName = `${data.firstName}${data.middleName ? ' ' + data.middleName.charAt(0) + '.' : ''} ${data.lastName}`.trim();
          } else if (data.displayName) {
            performedByName = data.displayName;
          } else {
            performedByName = data.email || 'Unknown User';
          }
        }
      } catch (err) {
        console.error('Error fetching performer name:', err);
      }
    }

    // Get target user's name if applicable
    if (activityData.targetUser) {
      try {
        const targetDoc = await getDoc(doc(db, 'users', activityData.targetUser));
        if (targetDoc.exists()) {
          const data = targetDoc.data();
          if (data.firstName && data.lastName) {
            targetUserName = `${data.firstName}${data.middleName ? ' ' + data.middleName.charAt(0) + '.' : ''} ${data.lastName}`.trim();
          } else if (data.displayName) {
            targetUserName = data.displayName;
          } else {
            targetUserName = data.email || 'Unknown User';
          }
        }
      } catch (err) {
        console.error('Error fetching target user name:', err);
      }
    }

    // Skip logging if performedBy is undefined
    if (!activityData.performedBy) {
      console.warn('Activity log skipped: performedBy is undefined');
      return null;
    }

    const logData = {
      action: activityData.action,
      performedBy: activityData.performedBy,
      performedByName: performedByName,
      targetUser: activityData.targetUser || null,
      targetUserName: targetUserName,
      targetType: activityData.targetType || null,
      targetId: activityData.targetId || null,
      branchId: activityData.branchId || null,
      details: activityData.details || {},
      metadata: activityData.metadata || {},
      timestamp: Timestamp.now(),
      ipAddress: activityData.ipAddress || null
    };
    
    const docRef = await addDoc(collection(db, 'activity_logs'), logData);
    return docRef.id;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - logging should not break the main flow
  }
};

/**
 * Get activity logs with filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} Array of activity logs
 */
export const getActivityLogs = async (filters = {}) => {
  try {
    const constraints = [orderBy('timestamp', 'desc')];
    
    if (filters.performedBy) {
      constraints.unshift(where('performedBy', '==', filters.performedBy));
    }
    if (filters.targetUser) {
      constraints.unshift(where('targetUser', '==', filters.targetUser));
    }
    if (filters.action) {
      constraints.unshift(where('action', '==', filters.action));
    }
    if (filters.branchId) {
      constraints.unshift(where('branchId', '==', filters.branchId));
    }
    
    // Limit results
    constraints.push(limit(filters.limit || 100));
    
    const q = query(collection(db, 'activity_logs'), ...constraints);
    const snapshot = await getDocs(q);
    
    const logs = [];
    snapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return logs;
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
};

/**
 * Get recent activities for a user
 * @param {string} userId - User ID
 * @param {number} limitCount - Number of records to fetch
 * @returns {Promise<Array>} Array of recent activities
 */
export const getUserRecentActivities = async (userId, limitCount = 20) => {
  try {
    const q = query(
      collection(db, 'activity_logs'),
      where('performedBy', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const activities = [];
    
    snapshot.forEach((doc) => {
      activities.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return activities;
  } catch (error) {
    console.error('Error fetching user activities:', error);
    throw error;
  }
};

/**
 * Get all activities (for system-wide viewing)
 * @param {number} limitCount - Number of records to fetch
 * @returns {Promise<Array>} Array of all activities
 */
export const getAllActivities = async (limitCount = 100) => {
  try {
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    const activities = [];
    
    snapshot.forEach((doc) => {
      activities.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return activities;
  } catch (error) {
    console.error('Error fetching all activities:', error);
    throw error;
  }
};

/**
 * Get action labels for display
 * @param {string} action - Action code
 * @returns {string} Human-readable action label
 */
export const getActionLabel = (action) => {
  const actionLabels = {
    user_created: 'Created User',
    user_updated: 'Updated User',
    user_activated: 'Activated User',
    user_deactivated: 'Deactivated User',
    user_login: 'Logged In',
    user_logout: 'Logged Out',
    password_reset: 'Password Reset',
    profile_updated: 'Updated Profile',
    role_changed: 'Changed Role',
    branch_assigned: 'Assigned to Branch'
  };
  
  return actionLabels[action] || action;
};
