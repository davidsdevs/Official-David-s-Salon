/**
 * User Service - Handles all user-related operations
 * Module: M01 - User & Role Management
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
  signOut
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { db, auth, firebaseConfig } from '../config/firebase';
import { logActivity } from './activityService';
import { sendUserCreatedEmail, sendAccountActivatedEmail, sendAccountDeactivatedEmail, sendPasswordResetNotification } from './emailService';
import { ROLE_LABELS } from '../utils/constants';
import toast from 'react-hot-toast';

/**
 * Get all users with optional filtering
 * @param {Object} filters - Filter criteria {role, branchId, status}
 * @returns {Promise<Array>} Array of users
 */
export const getAllUsers = async (filters = {}) => {
  try {
    let q = collection(db, 'users');
    
    // Apply filters
    const constraints = [];
    if (filters.role) {
      constraints.push(where('role', '==', filters.role));
    }
    if (filters.branchId) {
      constraints.push(where('branchId', '==', filters.branchId));
    }
    if (filters.status) {
      constraints.push(where('isActive', '==', filters.status === 'active'));
    }
    
    if (constraints.length > 0) {
      q = query(collection(db, 'users'), ...constraints, orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    const users = [];
    
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User data
 */
export const getUserById = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {Object} currentUser - User creating the account
 * @returns {Promise<Object>} Created user data
 */
export const createUser = async (userData, currentUser) => {
  try {
    // Create a secondary Firebase app instance to avoid logging out current user
    // This prevents the admin from being logged out when creating a new user
    const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
    const secondaryAuth = getAuth(secondaryApp);
    
    // Create Firebase Auth account using secondary auth
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      userData.email,
      userData.password || 'DefaultPass123!' // Temporary password
    );
    
    const user = userCredential.user;
    
    // Build full name for Firebase Auth
    const fullName = `${userData.firstName}${userData.middleName ? ' ' + userData.middleName.charAt(0) + '.' : ''} ${userData.lastName}`.trim();
    
    // Update display name in Firebase Auth
    await updateFirebaseProfile(user, {
      displayName: fullName
    });
    
    // Sign out the newly created user from secondary auth and delete the secondary app
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
    
    // Create Firestore user document
    // Handle roles: if single role provided, convert to array
    const roles = Array.isArray(userData.roles) ? userData.roles : 
                  userData.role ? [userData.role] : [];
    
    const userDocData = {
      email: userData.email,
      firstName: userData.firstName,
      middleName: userData.middleName || '',
      lastName: userData.lastName,
      phone: userData.phone || '',
      roles: roles, // New: array of roles (NO MORE LEGACY FIELDS)
      branchId: userData.branchId || null,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: currentUser.uid
    };
    
    await setDoc(doc(db, 'users', user.uid), userDocData);
    
    // Log activity
    await logActivity({
      action: 'user_created',
      performedBy: currentUser.uid,
      targetUser: user.uid,
      details: {
        roles: roles,
        email: userData.email,
        branchId: userData.branchId || null
      }
    });

    // Send welcome email with temporary password (async, don't wait)
    sendUserCreatedEmail({
      email: userData.email,
      displayName: fullName,
      role: roles.map(r => ROLE_LABELS[r]).join(', '),
      tempPassword: userData.password || 'DefaultPass123!'
    }).catch(err => console.error('User created email error:', err));
    
    toast.success(`User ${fullName} created successfully!`);
    
    return {
      id: user.uid,
      ...userDocData
    };
  } catch (error) {
    console.error('Error creating user:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      toast.error('Email address is already in use');
    } else if (error.code === 'auth/weak-password') {
      toast.error('Password is too weak');
    } else {
      toast.error('Failed to create user');
    }
    
    throw error;
  }
};

/**
 * Update user information
 * @param {string} userId - User ID
 * @param {Object} updates - Data to update
 * @param {Object} currentUser - User performing the update
 * @returns {Promise<void>}
 */
export const updateUser = async (userId, updates, currentUser) => {
  try {
      // Get current user data to compare changes
    const userDoc = await getDoc(doc(db, 'users', userId));
    const currentData = userDoc.data();
    
    // Handle roles: if single role provided, convert to array
    if (updates.role && !updates.roles) {
      updates.roles = [updates.role];
    }
    
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    // Remove password and old fields from updates
    delete updateData.password;
    delete updateData.role; // Don't save legacy field
    delete updateData.displayName; // Don't save old displayName
    
    // Find what actually changed
    const changedFields = Object.keys(updates).filter(key => {
      if (key === 'roles') {
        // Compare roles arrays
        const oldRoles = currentData.roles || [];
        const newRoles = updates.roles || [];
        return JSON.stringify(oldRoles.sort()) !== JSON.stringify(newRoles.sort());
      }
      return currentData[key] !== updates[key];
    });
    
    await updateDoc(doc(db, 'users', userId), updateData);
    
    // Log activity with only changed fields
    await logActivity({
      action: 'user_updated',
      performedBy: currentUser.uid,
      targetUser: userId,
      details: {
        changedFields: changedFields,
        changes: changedFields.reduce((acc, field) => {
          acc[field] = {
            from: field === 'roles' ? currentData.roles : currentData[field],
            to: updates[field]
          };
          return acc;
        }, {})
      }
    });
    
    toast.success('User updated successfully!');
  } catch (error) {
    console.error('Error updating user:', error);
    toast.error('Failed to update user');
    throw error;
  }
};

/**
 * Activate or deactivate a user
 * @param {string} userId - User ID
 * @param {boolean} isActive - Active status
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const toggleUserStatus = async (userId, isActive, currentUser) => {
  try {
    // Get user data for email notification
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();

    await updateDoc(doc(db, 'users', userId), {
      isActive,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: isActive ? 'user_activated' : 'user_deactivated',
      performedBy: currentUser.uid,
      targetUser: userId
    });

    // Send email notification (async, don't wait)
    if (userData) {
      if (isActive) {
        sendAccountActivatedEmail({
          email: userData.email,
          displayName: userData.displayName
        }).catch(err => console.error('Activation email error:', err));
      } else {
        sendAccountDeactivatedEmail({
          email: userData.email,
          displayName: userData.displayName
        }).catch(err => console.error('Deactivation email error:', err));
      }
    }
    
    toast.success(`User ${isActive ? 'activated' : 'deactivated'} successfully!`);
  } catch (error) {
    console.error('Error toggling user status:', error);
    toast.error('Failed to update user status');
    throw error;
  }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
export const resetUserPassword = async (email) => {
  try {
    // Get user data for custom email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    let userData = null;
    if (!snapshot.empty) {
      userData = snapshot.docs[0].data();
    }

    // Send Firebase password reset email
    await sendPasswordResetEmail(auth, email);

    // Send custom notification email (async, don't wait)
    if (userData) {
      sendPasswordResetNotification({
        email: userData.email,
        displayName: userData.displayName
      }).catch(err => console.error('Password reset notification error:', err));
    }

    toast.success('Password reset email sent!');
  } catch (error) {
    console.error('Error sending password reset:', error);
    
    if (error.code === 'auth/user-not-found') {
      toast.error('User not found');
    } else {
      toast.error('Failed to send password reset email');
    }
    
    throw error;
  }
};

/**
 * Update user profile (for self-update)
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    const updateData = {
      ...profileData,
      updatedAt: Timestamp.now()
    };
    
    // Remove sensitive fields
    delete updateData.role;
    delete updateData.branchId;
    delete updateData.isActive;
    delete updateData.email;
    
    await updateDoc(doc(db, 'users', userId), updateData);
    
    // Update Firebase Auth display name if name fields changed
    if ((profileData.firstName || profileData.lastName) && auth.currentUser) {
      const fullName = `${profileData.firstName || ''}${profileData.middleName ? ' ' + profileData.middleName.charAt(0) + '.' : ''} ${profileData.lastName || ''}`.trim();
      await updateFirebaseProfile(auth.currentUser, {
        displayName: fullName
      });
    }
    
    // Log activity
    await logActivity({
      action: 'profile_updated',
      performedBy: userId,
      targetUser: userId,
      details: {
        fields: Object.keys(profileData)
      }
    });
    
    toast.success('Profile updated successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    toast.error('Failed to update profile');
    throw error;
  }
};

/**
 * Get users by branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of users
 */
export const getUsersByBranch = async (branchId) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('branchId', '==', branchId),
      where('isActive', '==', true),
      orderBy('lastName'),
      orderBy('firstName')
    );
    
    const snapshot = await getDocs(q);
    const users = [];
    
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching branch users:', error);
    throw error;
  }
};

/**
 * Get users by role
 * @param {string} role - User role
 * @returns {Promise<Array>} Array of users
 */
export const getUsersByRole = async (role) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('roles', 'array-contains', role),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(q);
    const users = [];
    
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching users by role:', error);
    throw error;
  }
};
