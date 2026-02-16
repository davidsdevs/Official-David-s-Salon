/**
 * Loyalty Criteria Configuration Page - System Admin
 * For configuring loyalty points criteria and rules
 */

import { useState, useEffect } from 'react';
import { Save, RotateCcw, Settings, Gift, TrendingUp, Calendar, Users, Percent } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getLoyaltyCriteria, 
  updateLoyaltyCriteria, 
  validateLoyaltyCriteria,
  resetLoyaltyCriteriaToDefault,
  DEFAULT_LOYALTY_CRITERIA 
} from '../../services/loyaltyCriteriaService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

const LoyaltyCriteria = () => {
  const { currentUser } = useAuth();
  
  const [criteria, setCriteria] = useState(DEFAULT_LOYALTY_CRITERIA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    fetchCriteria();
  }, []);

  const fetchCriteria = async () => {
    try {
      setLoading(true);
      const data = await getLoyaltyCriteria();
      setCriteria(data);
    } catch (error) {
      console.error('Error fetching loyalty criteria:', error);
      toast.error('Failed to load loyalty criteria');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setCriteria(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSave = async () => {
    try {
      // Validate criteria
      const validation = validateLoyaltyCriteria(criteria);
      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error('Please fix the validation errors');
        return;
      }

      setSaving(true);
      await updateLoyaltyCriteria(criteria, currentUser);
      await fetchCriteria(); // Refresh data
      setErrors([]);
    } catch (error) {
      console.error('Error saving loyalty criteria:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      await resetLoyaltyCriteriaToDefault(currentUser);
      await fetchCriteria(); // Refresh data
      setShowResetModal(false);
      setErrors([]);
    } catch (error) {
      console.error('Error resetting loyalty criteria:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-600" />
            Loyalty Criteria Configuration
          </h1>
          <p className="text-gray-600 mt-1">Configure loyalty points earning and redemption rules</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResetModal(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points Earning Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Points Earning</h2>
              <p className="text-sm text-gray-600">Configure how customers earn loyalty points</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Points per Peso Spent
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={criteria.pointsPerPeso}
                onChange={(e) => handleInputChange('pointsPerPeso', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: 0.01 = 1 point per ₱100 spent
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Spend for Points (₱)
              </label>
              <input
                type="number"
                min="0"
                value={criteria.minimumSpendForPoints}
                onChange={(e) => handleInputChange('minimumSpendForPoints', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum transaction amount to earn points
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Points per Transaction
              </label>
              <input
                type="number"
                min="1"
                value={criteria.maximumPointsPerTransaction}
                onChange={(e) => handleInputChange('maximumPointsPerTransaction', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="1000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cap on points earned per single transaction
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Points Threshold (₱)
              </label>
              <input
                type="number"
                min="0"
                value={criteria.bonusPointsThreshold}
                onChange={(e) => handleInputChange('bonusPointsThreshold', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="5000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Spend amount to trigger bonus multiplier
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bonus Points Multiplier
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={criteria.bonusPointsMultiplier}
                onChange={(e) => handleInputChange('bonusPointsMultiplier', parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Multiplier applied when threshold is reached
              </p>
            </div>
          </div>
        </div>

        {/* Points Redemption Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Percent className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Points Redemption</h2>
              <p className="text-sm text-gray-600">Configure how customers redeem loyalty points</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Point Value (₱)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={criteria.pointValue}
                onChange={(e) => handleInputChange('pointValue', parseFloat(e.target.value) || 0.01)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Value of each point when redeemed (1 point = ₱1)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Redemption Points
              </label>
              <input
                type="number"
                min="0"
                value={criteria.minimumRedemptionPoints}
                onChange={(e) => handleInputChange('minimumRedemptionPoints', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum points required to redeem
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Redemption Percentage (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={criteria.maximumRedemptionPercentage}
                onChange={(e) => handleInputChange('maximumRedemptionPercentage', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum percentage of bill that can be paid with points
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Points Expiry (Days)
              </label>
              <input
                type="number"
                min="1"
                value={criteria.pointsExpiryDays}
                onChange={(e) => handleInputChange('pointsExpiryDays', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="365"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of days before points expire
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Configuration Status</h2>
              <p className="text-sm text-gray-600">Current loyalty system status</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Loyalty System</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${criteria.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${criteria.isActive ? 'text-green-700' : 'text-red-700'}`}>
                  {criteria.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Enable Loyalty System
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={criteria.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {criteria.updatedAt && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Last updated: {criteria.updatedAt.toLocaleString()}
                </p>
                {criteria.updatedByName && (
                  <p className="text-xs text-gray-500">
                    By: {criteria.updatedByName}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleReset}
        title="Reset to Default Configuration"
        message="Are you sure you want to reset the loyalty criteria to default values? This action cannot be undone."
        confirmText="Reset to Default"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        loading={saving}
      />
    </div>
  );
};

export default LoyaltyCriteria;