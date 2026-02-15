// src/pages/system-admin/TaxConfiguration.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getTaxConfiguration,
  updateTaxConfiguration,
  resetTaxConfigurationToDefault,
  validateTaxConfiguration,
  DEFAULT_TAX_CONFIGURATION
} from '../../services/taxConfigurationService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Receipt,
  Percent,
  DollarSign,
  Users,
  Shield,
  Package,
  Briefcase,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Calculator,
  FileText,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

const TaxConfiguration = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_TAX_CONFIGURATION);
  const [errors, setErrors] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Load tax configuration
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const data = await getTaxConfiguration();
      setConfig(data);
    } catch (error) {
      console.error('Error loading tax configuration:', error);
      toast.error('Failed to load tax configuration');
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  // Handle checkbox changes
  const handleCheckboxChange = (field) => {
    setConfig(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
    setHasChanges(true);
  };

  // Validate and save configuration
  const handleSave = async () => {
    try {
      // Validate configuration
      const validation = validateTaxConfiguration(config);
      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error('Please fix validation errors');
        return;
      }

      setSaving(true);
      setErrors([]);
      
      await updateTaxConfiguration(config, userData);
      setHasChanges(false);
      await loadConfiguration();
    } catch (error) {
      console.error('Error saving tax configuration:', error);
      toast.error('Failed to save tax configuration');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset to default tax configuration? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await resetTaxConfigurationToDefault(userData);
      setHasChanges(false);
      await loadConfiguration();
    } catch (error) {
      console.error('Error resetting tax configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-7 w-7 text-[#160B53]" />
            Tax Configuration
          </h1>
          <p className="text-gray-600 mt-1">Configure VAT, service charges, and tax-related settings</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={saving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-[#160B53] text-white hover:bg-[#2A1B70] flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-900 mb-2">Validation Errors</h3>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-800">{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-blue-900 mb-1">Important Information</h3>
            <p className="text-sm text-blue-800">
              Tax configuration applies to all branches and transactions. Changes will take effect immediately for new transactions.
              Existing transactions will not be affected.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VAT Configuration */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Percent className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">VAT Configuration</h2>
              <p className="text-sm text-gray-600">Value Added Tax settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                VAT Rate (%)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.vatRate}
                onChange={(e) => handleChange('vatRate', parseFloat(e.target.value) || 0)}
                placeholder="12"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Standard VAT rate in Philippines is 12%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Amount for VAT (₱)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={config.minimumAmountForVat}
                onChange={(e) => handleChange('minimumAmountForVat', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">VAT will only apply if total exceeds this amount</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900">VAT Inclusive Pricing</label>
                <p className="text-xs text-gray-600">VAT is included in displayed prices</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isVatInclusive}
                  onChange={() => handleCheckboxChange('isVatInclusive')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900">Active</label>
                <p className="text-xs text-gray-600">Enable VAT calculation</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isActive}
                  onChange={() => handleCheckboxChange('isActive')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Service Charge Configuration */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Service Charge</h2>
              <p className="text-sm text-gray-600">Additional service charge settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Charge Rate (%)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.serviceCharge}
                onChange={(e) => handleChange('serviceCharge', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Additional service charge percentage</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900">Service Charge Inclusive</label>
                <p className="text-xs text-gray-600">Service charge is included in prices</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isServiceChargeInclusive}
                  onChange={() => handleCheckboxChange('isServiceChargeInclusive')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  Service charge is typically added on top of the subtotal and is separate from VAT.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Senior Citizen & PWD Discounts */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Special Discounts</h2>
              <p className="text-sm text-gray-600">Senior citizen and PWD benefits</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senior Citizen Discount (%)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.seniorCitizenDiscount}
                onChange={(e) => handleChange('seniorCitizenDiscount', parseFloat(e.target.value) || 0)}
                placeholder="20"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Philippine law mandates 20% discount for senior citizens</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PWD Discount (%)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.pwdDiscount}
                onChange={(e) => handleChange('pwdDiscount', parseFloat(e.target.value) || 0)}
                placeholder="20"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Philippine law mandates 20% discount for PWD</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900">VAT Exempt for Senior/PWD</label>
                <p className="text-xs text-gray-600">Senior citizens and PWD are exempt from VAT</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.vatExemptForSeniorPwd}
                  onChange={() => handleCheckboxChange('vatExemptForSeniorPwd')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  These discounts are mandated by Philippine law (RA 9994 and RA 10754). Ensure compliance with local regulations.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Tax Calculation Preview */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calculator className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Calculation Preview</h2>
              <p className="text-sm text-gray-600">Example tax calculation</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-3">Sample Transaction: ₱1,000</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₱1,000.00</span>
                </div>

                {config.isVatInclusive && config.vatRate > 0 && (
                  <div className="flex justify-between text-purple-600">
                    <span>VAT ({config.vatRate}% inclusive):</span>
                    <span className="font-medium">
                      ₱{((1000 / (1 + config.vatRate / 100)) * (config.vatRate / 100)).toFixed(2)}
                    </span>
                  </div>
                )}

                {!config.isVatInclusive && config.vatRate > 0 && (
                  <div className="flex justify-between text-purple-600">
                    <span>VAT ({config.vatRate}%):</span>
                    <span className="font-medium">
                      +₱{((1000 * config.vatRate) / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                {config.serviceCharge > 0 && !config.isServiceChargeInclusive && (
                  <div className="flex justify-between text-blue-600">
                    <span>Service Charge ({config.serviceCharge}%):</span>
                    <span className="font-medium">
                      +₱{((1000 * config.serviceCharge) / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Total:</span>
                    <span>
                      ₱{(
                        1000 +
                        (!config.isVatInclusive ? (1000 * config.vatRate) / 100 : 0) +
                        (!config.isServiceChargeInclusive ? (1000 * config.serviceCharge) / 100 : 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-3">With Senior Citizen Discount</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₱1,000.00</span>
                </div>

                <div className="flex justify-between text-green-600">
                  <span>Senior Discount ({config.seniorCitizenDiscount}%):</span>
                  <span className="font-medium">
                    -₱{((1000 * config.seniorCitizenDiscount) / 100).toFixed(2)}
                  </span>
                </div>

                {config.vatExemptForSeniorPwd && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>VAT (Exempt):</span>
                    <span>₱0.00</span>
                  </div>
                )}

                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Total:</span>
                    <span>
                      ₱{(1000 - (1000 * config.seniorCitizenDiscount) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Configuration Summary */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-gray-100 rounded-lg">
            <FileText className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Configuration Summary</h2>
            <p className="text-sm text-gray-600">Current tax settings overview</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-bold text-purple-900 uppercase">VAT Rate</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{config.vatRate}%</p>
            <p className="text-xs text-purple-700 mt-1">
              {config.isVatInclusive ? 'Inclusive' : 'Exclusive'}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-900 uppercase">Service Charge</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{config.serviceCharge}%</p>
            <p className="text-xs text-blue-700 mt-1">
              {config.isServiceChargeInclusive ? 'Inclusive' : 'Exclusive'}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-xs font-bold text-green-900 uppercase">Senior Discount</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{config.seniorCitizenDiscount}%</p>
            <p className="text-xs text-green-700 mt-1">
              {config.vatExemptForSeniorPwd ? 'VAT Exempt' : 'VAT Applied'}
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-bold text-orange-900 uppercase">PWD Discount</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">{config.pwdDiscount}%</p>
            <p className="text-xs text-orange-700 mt-1">
              {config.vatExemptForSeniorPwd ? 'VAT Exempt' : 'VAT Applied'}
            </p>
          </div>
        </div>
      </Card>

      {/* Save Reminder */}
      {hasChanges && (
        <Card className="bg-yellow-50 border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm font-medium text-yellow-900">
                You have unsaved changes. Click "Save Changes" to apply your configuration.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-yellow-600 text-white hover:bg-yellow-700"
            >
              Save Now
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TaxConfiguration;
