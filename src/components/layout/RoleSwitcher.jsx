/**
 * Role Switcher Component
 * Allows users with multiple roles to switch between them
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS, USER_ROLES, ROUTES } from '../../utils/constants';
import RolePinModal from '../auth/RolePinModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';

const RoleSwitcher = () => {
  const { userRoles, activeRole, switchRole, currentUser, userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [targetRole, setTargetRole] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't show if user has only one role
  if (!userRoles || userRoles.length <= 1) {
    return null;
  }

  // Map roles to their dashboard routes
  const getRoleDashboard = (role) => {
    const dashboardMap = {
      [USER_ROLES.SYSTEM_ADMIN]: ROUTES.ADMIN_DASHBOARD,
      [USER_ROLES.OPERATIONAL_MANAGER]: ROUTES.OPERATIONAL_MANAGER_DASHBOARD,
      [USER_ROLES.BRANCH_MANAGER]: ROUTES.MANAGER_DASHBOARD,
      [USER_ROLES.RECEPTIONIST]: ROUTES.RECEPTIONIST_DASHBOARD,
      [USER_ROLES.INVENTORY_CONTROLLER]: ROUTES.INVENTORY_DASHBOARD,
      [USER_ROLES.STYLIST]: ROUTES.STYLIST_DASHBOARD,
      [USER_ROLES.CLIENT]: ROUTES.CLIENT_DASHBOARD,
    };
    return dashboardMap[role] || '/';
  };

  const handleRoleSwitch = (role) => {
    if (role !== activeRole) {
      // Show PIN modal for verification
      setTargetRole(role);
      setShowPinModal(true);
    }
    setIsOpen(false);
  };

  const verifyPinAndSwitch = async (enteredPin) => {
    try {
      // Get user's role PINs from Firestore
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const rolePins = userDoc.data()?.rolePins || {};

      // Check if PIN matches for the target role
      if (rolePins[targetRole] === enteredPin) {
        // PIN correct, switch role
        switchRole(targetRole);
        const dashboard = getRoleDashboard(targetRole);
        navigate(dashboard);
        toast.success(`Switched to ${ROLE_LABELS[targetRole]}`);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      toast.error('Failed to verify PIN');
      return false;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <span className="hidden sm:inline">Role:</span>
        <span className="font-semibold text-primary-600">
          {ROLE_LABELS[activeRole] || activeRole}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase">Switch Role</p>
          </div>
          
          <div className="py-1">
            {userRoles.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleSwitch(role)}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  role === activeRole ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                }`}
              >
                <span className="font-medium">{ROLE_LABELS[role] || role}</span>
                {role === activeRole && (
                  <Check className="w-4 h-4 text-primary-600" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              You have {userRoles.length} role{userRoles.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      <RolePinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        targetRole={targetRole}
        onVerify={verifyPinAndSwitch}
      />
    </div>
  );
};

export default RoleSwitcher;
