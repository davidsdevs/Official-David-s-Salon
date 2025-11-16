import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import toast from 'react-hot-toast';
import { getUserRoles, hasRole } from '../utils/helpers';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // Deprecated: kept for backward compatibility
  const [userRoles, setUserRoles] = useState([]); // New: array of all user roles
  const [activeRole, setActiveRole] = useState(null); // Currently active role for dashboard
  const [userBranch, setUserBranch] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user role and additional data from Firestore
  const fetchUserData = async (user, showToast = true) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Check if user account is active
        if (!userData.isActive) {
          // Sign out the deactivated user first
          await signOut(auth);
          // Only show toast if explicitly requested (e.g., during login)
          if (showToast) {
            toast.error('Your account has been deactivated. Please contact administrator.');
          }
          throw new Error('ACCOUNT_DEACTIVATED');
        }
        
        // Get roles array (handles both new and legacy format)
        const roles = getUserRoles(userData);
        
        setUserRole(userData.role || roles[0]); // Legacy: first role
        setUserRoles(roles); // New: all roles
        
        // Restore active role from localStorage or default to first role
        const savedActiveRole = localStorage.getItem(`activeRole_${user.uid}`);
        const initialActiveRole = (savedActiveRole && roles.includes(savedActiveRole)) 
          ? savedActiveRole 
          : roles[0];
        setActiveRole(initialActiveRole);
        
        setUserBranch(userData.branchId || null);
        setUserData(userData);
        return userData;
      } else {
        // Sign out if no user document
        await signOut(auth);
        if (showToast) {
          toast.error('User profile not found. Please contact admin.');
        }
        throw new Error('USER_NOT_FOUND');
      }
    } catch (error) {
      // Only log and show toast for unexpected errors (not our custom errors)
      if (error.message !== 'ACCOUNT_DEACTIVATED' && error.message !== 'USER_NOT_FOUND') {
        console.error('Error fetching user data:', error);
        if (showToast) {
          toast.error('Failed to load user data');
        }
      }
      throw error;
    }
  };

  // Sign in function
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userData = await fetchUserData(result.user);
      
      // Log login activity
      try {
        const { logActivity } = await import('../services/activityService');
        await logActivity({
          action: 'user_login',
          performedBy: result.user.uid,
          targetUser: result.user.uid
        });
      } catch (logError) {
        console.error('Error logging login activity:', logError);
      }
      
      toast.success('Successfully logged in!');
      return { ...result, userData };
    } catch (error) {
      // Don't log or show error for account issues already handled by fetchUserData
      if (error.message === 'ACCOUNT_DEACTIVATED' || error.message === 'USER_NOT_FOUND') {
        throw error;
      }
      
      // Handle Firebase Auth errors
      if (error.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password');
      } else if (error.code === 'auth/user-disabled') {
        toast.error('This account has been disabled');
      } else {
        console.error('Login error:', error);
        toast.error('Failed to login. Please try again.');
      }
      throw error;
    }
  };

  // Sign out function
  const logout = async () => {
    try {
      const userId = auth.currentUser?.uid;
      
      // Log logout activity before signing out
      if (userId) {
        try {
          const { logActivity } = await import('../services/activityService');
          await logActivity({
            action: 'user_logout',
            performedBy: userId,
            targetUser: userId
          });
        } catch (logError) {
          console.error('Error logging logout activity:', logError);
        }
      }
      
      await signOut(auth);
      setUserRole(null);
      setUserBranch(null);
      toast.success('Successfully logged out');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
      throw error;
    }
  };

  // Reset password function
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('Failed to send reset email');
      throw error;
    }
  };

  // Update user profile
  const updateUserProfile = async (displayName, photoURL) => {
    try {
      await updateProfile(auth.currentUser, { displayName, photoURL });
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return userRole === role;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    return roles.includes(userRole);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setCurrentUser(user);
          // Don't show toast in auth state listener (showToast = false)
          // Toast is already shown during login flow
          await fetchUserData(user, false);
          // If we get here, user data is valid and active
        } catch (error) {
          // fetchUserData already handled the error and logged out
          // Just reset the state silently
          setCurrentUser(null);
          setUserRole(null);
          setUserBranch(null);
          setUserData(null);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserRoles([]);
        setActiveRole(null);
        setUserBranch(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Switch active role (for users with multiple roles)
  const switchRole = (newRole) => {
    if (userRoles.includes(newRole)) {
      setActiveRole(newRole);
      // Store in localStorage for persistence
      localStorage.setItem(`activeRole_${currentUser?.uid}`, newRole);
      // Note: Toast message is shown by the caller (RoleSwitcher)
      return true;
    }
    toast.error('You do not have access to this role');
    return false;
  };

  const value = {
    currentUser,
    userRole, // Deprecated: for backward compatibility
    userRoles, // New: array of all roles
    activeRole, // New: currently active role
    userBranch,
    userData,
    loading,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    switchRole, // New: function to switch between roles
    hasRole: (role) => hasRole(userData, role), // Helper function
    hasAnyRole: (roles) => roles.some(r => hasRole(userData, r)), // Helper function
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '24px'
        }}>
          Loading...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
