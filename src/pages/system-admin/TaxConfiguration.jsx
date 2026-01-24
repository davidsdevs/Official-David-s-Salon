/**
 * Tax Configuration Page - System Admin
 * For configuring tax rates and tax-related settings
 */

import { useState, useEffect } from 'react';
import { Save, RotateCcw, Calculator, Receipt, Percent, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getTaxConfiguration, 
  updateTaxConfiguration, 
  validateTaxConfiguration,
  resetTaxConfigurationToDefault,
  DEFAULT_TAX_CONFIGURATION 
} from '../../services/taxConfigurationService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

const TaxConfiguration = () => {
  const { currentUser } = useAuth();
  
  const [config, setConfig] = useState(DEFAULT_TAX_CONFIGURATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    fetchConfiguration();
  }, []);

  const fetchConfiguration = async () => {
    try {
      setLoading(true);
      const data = await getTaxConfiguration();
      setConfig(data);
    } catch (error) {
      console.error('Error fetching tax configuration:', error);
      toast.error('Failed to load tax configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleArrayChange = (field, value) => {
    // Convert comma-separated string to array
    const arrayValue = value.split(',').map(item => item.trim()).filter(item => item);
    setConfig(prev => ({
      ...prev,
      [field]: arrayValue
    }));
  };

  const handleSave = async () => {
    try {
      // Validate configuration
      const validation = validateTaxConfiguration(config);
      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error('Please fix the validation errors');
        return;
      }

      setSaving(true);
      await updateTaxConfiguration(config, currentUser);
      await fetchConfiguration(); // Refresh data
      setErrors([]);
    } catch (error) {
      console.error('Error saving tax configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      await resetTaxConfigurationToDefault(currentUser);
      await fetchConfiguration(); // Refresh data
      setShowResetModal(false);
      setErrors([]);
    } catch (error) {
      console.error('Error resetting tax configuration:', error);
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
            <Calculator className="w-8 h-8 text-blue-600" />
            Tax Configuration
          </h1>
          <p className="text-gray-600 mt-1">Configure tax rates, VAT settings, and special discounts</p>
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
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        {/* VAT Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">VAT Configuration</h2>
              <p className="text-sm text-gray-600">Configure Value Added Tax settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VAT Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.vatRate}
                onChange={(e) => handleInputChange('vatRate', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="12"
              />
              <p className="text-xs text-gray-500 mt-1">
                Standard VAT rate (Philippines: 12%)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Amount for VAT (₱)
              </label>
              <input
                type="number"
                min="0"
                value={config.minimumAmountForVat}
                onChange={(e) => handleInputChange('minimumAmountForVat', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum transaction amount to apply VAT
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  VAT Inclusive Pricing
                </label>
                <p className="text-xs text-gray-500">
                  VAT is included in displayed prices
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isVatInclusive}
                  onChange={(e) => handleInputChange('isVatInclusive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VAT Exempt Services (Service IDs)
              </label>
              <textarea
                value={config.vatExemptServices?.join(', ') || ''}
                onChange={(e) => handleArrayChange('vatExemptServices', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="service1, service2, service3"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of service IDs exempt from VAT
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VAT Exempt Products (Product IDs)
              </label>
              <textarea
                value={config.vatExemptProducts?.join(', ') || ''}
                onChange={(e) => handleArrayChange('vatExemptProducts', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="product1, product2, product3"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of product IDs exempt from VAT
              </p>
            </div>
          </div>
        </div>

        {/* Service Charge Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Percent className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Service Charge</h2>
              <p className="text-sm text-gray-600">Configure service charge settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Charge Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.serviceCharge}
                onChange={(e) => handleInputChange('serviceCharge', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Service charge percentage (0 = no service charge)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Service Charge Inclusive
                </label>
                <p className="text-xs text-gray-500">
                  Service charge is included in displayed prices
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isServiceChargeInclusive}
                  onChange={(e) => handleInputChange('isServiceChargeInclusive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Special Discounts Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Special Discounts</h2>
              <p className="text-sm text-gray-600">Configure discounts for special customer groups</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senior Citizen Discount (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.seniorCitizenDiscount}
                onChange={(e) => handleInputChange('seniorCitizenDiscount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="20"
              />
              <p className="text-xs text-gray-500 mt-1">
                Discount percentage for senior citizens (Philippines: 20%)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PWD Discount (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.pwdDiscount}
                onChange={(e) => handleInputChange('pwdDiscount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="20"
              />
              <p className="text-xs text-gray-500 mt-1">
                Discount percentage for persons with disabilities (Philippines: 20%)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  VAT Exempt for Senior/PWD
                </label>
                <p className="text-xs text-gray-500">
                  Senior citizens and PWD are exempt from VAT
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.vatExemptForSeniorPwd}
                  onChange={(e) => handleInputChange('vatExemptForSeniorPwd', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Configuration Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Configuration Status</h2>
              <p className="text-sm text-gray-600">Current tax system status and summary</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Tax System</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${config.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${config.isActive ? 'text-green-700' : 'text-red-700'}`}>
                  {config.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Enable Tax System
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="pt-4 border-t border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT Rate:</span>
                <span className="font-medium">{config.vatRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Service Charge:</span>
                <span className="font-medium">{config.serviceCharge}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Senior Discount:</span>
                <span className="font-medium">{config.seniorCitizenDiscount}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">PWD Discount:</span>
                <span className="font-medium">{config.pwdDiscount}%</span>
              </div>
            </div>

            {config.updatedAt && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Last updated: {config.updatedAt.toLocaleString()}
                </p>
                {config.updatedByName && (
                  <p className="text-xs text-gray-500">
                    By: {config.updatedByName}
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
        message="Are you sure you want to reset the tax configuration to default values? This action cannot be undone."
        confirmText="Reset to Default"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        loading={saving}
      />
    </div>
  );
};

export default TaxConfiguration;