/**
 * Setup Role PINs Component
 * Allows users to set PINs for their roles
 */

import { useState } from 'react';
import { Lock, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ROLE_LABELS } from '../../utils/constants';
import toast from 'react-hot-toast';

const SetupRolePins = () => {
  const { currentUser, userRoles, userData } = useAuth();
  const [pins, setPins] = useState({});
  const [confirmPins, setConfirmPins] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const existingPins = userData?.rolePins || {};

  const handlePinChange = (role, value) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setPins({ ...pins, [role]: numericValue });
    setErrors({ ...errors, [role]: '' });
  };

  const handleConfirmPinChange = (role, value) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setConfirmPins({ ...confirmPins, [role]: numericValue });
    setErrors({ ...errors, [role]: '' });
  };

  const validatePins = () => {
    const newErrors = {};
    let isValid = true;

    userRoles.forEach((role) => {
      const pin = pins[role];
      const confirmPin = confirmPins[role];

      if (pin && pin.length !== 4) {
        newErrors[role] = 'PIN must be 4 digits';
        isValid = false;
      } else if (pin && confirmPin && pin !== confirmPin) {
        newErrors[role] = 'PINs do not match';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validatePins()) {
      return;
    }

    setLoading(true);
    try {
      // Merge new PINs with existing ones
      const updatedPins = { ...existingPins };
      
      Object.keys(pins).forEach((role) => {
        if (pins[role] && pins[role].length === 4) {
          updatedPins[role] = pins[role];
        }
      });

      // Update Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        rolePins: updatedPins,
        updatedAt: new Date()
      });

      toast.success('Role PINs updated successfully');
      setPins({});
      setConfirmPins({});
    } catch (error) {
      console.error('Error updating PINs:', error);
      toast.error('Failed to update PINs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Role Security PINs</h3>
          <p className="text-sm text-gray-500">Set 4-digit PINs for each of your roles</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Why PINs are required:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>You need to enter your PIN when switching between roles</li>
              <li>This prevents unauthorized access to different role dashboards</li>
              <li>Each role can have a different PIN for added security</li>
            </ul>
          </div>
        </div>
      </div>

      {/* PIN Setup for each role */}
      <div className="space-y-6">
        {userRoles.map((role) => (
          <div key={role} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{ROLE_LABELS[role]}</span>
                {existingPins[role] && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    PIN Set
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {existingPins[role] ? 'New PIN (optional)' : 'Set PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="4"
                  value={pins[role] || ''}
                  onChange={(e) => handlePinChange(role, e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-2 text-center text-lg font-bold tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="4"
                  value={confirmPins[role] || ''}
                  onChange={(e) => handleConfirmPinChange(role, e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-2 text-center text-lg font-bold tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {errors[role] && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{errors[role]}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading || Object.keys(pins).length === 0}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save PINs'}
        </button>
      </div>
    </div>
  );
};

export default SetupRolePins;
