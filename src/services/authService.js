import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { verifyRolePassword } from './rolePasswordService';
import { USER_ROLES } from '../utils/constants';

/**
 * Create a new user account with email and password
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Created user object
 */
export const registerUser = async (userData) => {
  const { email, password, displayName, role, branchId = null } = userData;

  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile
    await updateProfile(user, { displayName });

    // Send verification email
    await sendEmailVerification(user);

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email,
      displayName,
      role,
      branchId,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role,
    };
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

/**
 * Get user data from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User data
 */
export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    throw new Error('User not found');
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

/**
 * Update user data in Firestore
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateUserData = async (userId, updates) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
};

/**
 * Verify manager authorization code for stock adjustments
 * @param {string} code - Manager authorization code
 * @param {string} branchId - Branch ID to verify against
 * @returns {Promise<Object>} Verification result with valid status and manager info
 */
export const verifyManagerCode = async (code, branchId) => {
  try {
    if (!branchId || !code) {
      return { valid: false };
    }

    // Get ALL branch managers for this branch
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('branchId', '==', branchId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error('No active users found for branch:', branchId);
      return { valid: false };
    }

    // Check each user to see if they are a branch manager and verify their role password
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Check if user is a branch manager (check both role and roles array)
      const isBranchManager = userData.role === USER_ROLES.BRANCH_MANAGER ||
                              (userData.roles && userData.roles.includes(USER_ROLES.BRANCH_MANAGER));

      if (isBranchManager) {
        // Verify using this branch manager's role password
        const isValid = await verifyRolePassword(userId, USER_ROLES.BRANCH_MANAGER, code);

        if (isValid === true) {
          return { valid: true, managerId: userId, managerName: userData.displayName || userData.name || userData.email };
        }

        if (isValid === null) {
          // No role password set - fallback to Firebase Auth for backward compatibility
          if (userData.email) {
            try {
              const userCredential = await signInWithEmailAndPassword(auth, userData.email, code);
              if (userCredential.user) {
                await new Promise(resolve => setTimeout(resolve, 100));
                await signOut(auth);
                return { valid: true, managerId: userId, managerName: userData.displayName || userData.name || userData.email };
              }
            } catch (authError) {
              // Continue to next manager
              continue;
            }
          }
        }
      }
    }

    return { valid: false };
  } catch (error) {
    console.error('Error verifying manager code:', error);
    return { valid: false };
  }
};
