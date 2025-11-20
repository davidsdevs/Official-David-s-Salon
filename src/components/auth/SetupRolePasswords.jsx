/**
 * Setup Role Passwords Component
 * Allows users to set passwords for their roles
 */

import { useState, useEffect } from 'react';
import { Lock, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { setRolePassword, getRolePassword } from '../../services/rolePasswordService';
import { ROLE_LABELS } from '../../utils/constants';
import toast from 'react-hot-toast';

const SetupRolePasswords = () => {
  const { currentUser, userRoles, userData } = useAuth();
  const [passwords, setPasswords] = useState({});
  const [confirmPasswords, setConfirmPasswords] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [showConfirmPasswords, setShowConfirmPasswords] = useState({});
  const [existingPasswords, setExistingPasswords] = useState({});

  // Check existing passwords on mount
  useEffect(() => {
    const checkExistingPasswords = async () => {
      if (!currentUser || !userRoles || userRoles.length === 0) return;
      
      const existing = {};
      for (const role of userRoles) {
        const hasPassword = await getRolePassword(currentUser.uid, role);
        existing[role] = !!hasPassword;
      }
      setExistingPasswords(existing);
    };

    checkExistingPasswords();
  }, [currentUser?.uid, userRoles]);

  const handlePasswordChange = (role, value) => {
    setPasswords({ ...passwords, [role]: value });
    setErrors({ ...errors, [role]: '' });
  };

  const handleConfirmPasswordChange = (role, value) => {
    setConfirmPasswords({ ...confirmPasswords, [role]: value });
    setErrors({ ...errors, [role]: '' });
  };

  const togglePasswordVisibility = (role) => {
    setShowPasswords({ ...showPasswords, [role]: !showPasswords[role] });
  };

  const toggleConfirmPasswordVisibility = (role) => {
    setShowConfirmPasswords({ ...showConfirmPasswords, [role]: !showConfirmPasswords[role] });
  };

  const validatePassword = (password) => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const handleSavePassword = async (role) => {
    const password = passwords[role];
    const confirmPassword = confirmPasswords[role];

    // Validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrors({ ...errors, [role]: passwordError });
      return;
    }

    if (password !== confirmPassword) {
      setErrors({ ...errors, [role]: 'Passwords do not match' });
      return;
    }

    setLoading({ ...loading, [role]: true });
    try {
      await setRolePassword(currentUser.uid, role, password);
      toast.success(`Password set successfully for ${ROLE_LABELS[role]}`);
      
      // Clear fields
      setPasswords({ ...passwords, [role]: '' });
      setConfirmPasswords({ ...confirmPasswords, [role]: '' });
      setErrors({ ...errors, [role]: '' });
      
      // Update existing passwords
      setExistingPasswords({ ...existingPasswords, [role]: true });
    } catch (error) {
      console.error('Error setting password:', error);
      toast.error(`Failed to set password: ${error.message}`);
    } finally {
      setLoading({ ...loading, [role]: false });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Role Passwords</h3>
          <p className="text-sm text-gray-500">Set passwords for each of your roles</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">About Role Passwords:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Each role can have its own password for enhanced security</li>
              <li>Passwords must be at least 6 characters long</li>
              <li>You'll use this password when logging in with that specific role</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Password Setup for each role */}
      <div className="space-y-6">
        {userRoles.map((role) => (
          <div key={role} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{ROLE_LABELS[role]}</span>
                {existingPasswords[role] && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Password Set
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {existingPasswords[role] ? 'New Password (optional)' : 'Set Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPasswords[role] ? 'text' : 'password'}
                    value={passwords[role] || ''}
                    onChange={(e) => handlePasswordChange(role, e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(role)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords[role] ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPasswords[role] ? 'text' : 'password'}
                    value={confirmPasswords[role] || ''}
                    onChange={(e) => handleConfirmPasswordChange(role, e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => toggleConfirmPasswordVisibility(role)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPasswords[role] ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {errors[role] && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{errors[role]}</span>
              </div>
            )}

            {/* Save Button for this role */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSavePassword(role)}
                disabled={loading[role] || !passwords[role] || !confirmPasswords[role]}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading[role] ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Password
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SetupRolePasswords;

