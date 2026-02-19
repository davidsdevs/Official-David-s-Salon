// src/pages/system-admin/SystemSettings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getSystemSettings,
  updateSystemSettings,
  resetSystemSettingsToDefault,
  validateSystemSettings,
  DEFAULT_SYSTEM_SETTINGS
} from '../../services/systemSettingsService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Settings,
  Building2,
  FileText,
  Phone,
  Mail,
  Globe,
  Calendar,
  Save,
  RotateCcw,
  AlertTriangle,
  Info,
  Loader2,
  Receipt,
  Shield,
  Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';

const SystemSettings = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SYSTEM_SETTINGS);
  const [errors, setErrors] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('company');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getSystemSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading system settings:', error);
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleCheckboxChange = (field) => {
    setSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const validation = validateSystemSettings(settings);
      if (!validation.isValid) {
        setErrors(validation.errors);
        toast.error('Please fix validation errors');
        return;
      }

      setSaving(true);
      setErrors([]);
      
      await updateSystemSettings(settings, userData);
      setHasChanges(false);
      await loadSettings();
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast.error('Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset to default system settings? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await resetSystemSettingsToDefault(userData);
      setHasChanges(false);
      await loadSettings();
    } catch (error) {
      console.error('Error resetting system settings:', error);
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

  const tabs = [
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'bir', label: 'BIR Information', icon: Receipt },
    { id: 'contact', label: 'Contact Details', icon: Phone },
    { id: 'receipt', label: 'Receipt Settings', icon: FileText },
    { id: 'operational', label: 'Operational', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-7 w-7 text-[#160B53]" />
            System Settings
          </h1>
          <p className="text-gray-600 mt-1">Configure company-wide settings and information</p>
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
              These settings apply company-wide and will be used in receipts, reports, and official documents.
              Ensure all information is accurate and up-to-date.
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#160B53] text-[#160B53]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Company Information Tab */}
      {activeTab === 'company' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Company Information</h2>
              <p className="text-sm text-gray-600">Basic company details and registration</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={settings.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="David's Salon"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Legal Company Name
              </label>
              <Input
                value={settings.companyLegalName}
                onChange={(e) => handleChange('companyLegalName', e.target.value)}
                placeholder="David's Salon Corporation"
                className="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Tagline
              </label>
              <Input
                value={settings.companyTagline}
                onChange={(e) => handleChange('companyTagline', e.target.value)}
                placeholder="Your Beauty, Our Passion"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Type
              </label>
              <select
                value={settings.businessType}
                onChange={(e) => handleChange('businessType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
              >
                <option value="Sole Proprietorship">Sole Proprietorship</option>
                <option value="Partnership">Partnership</option>
                <option value="Corporation">Corporation</option>
                <option value="Cooperative">Cooperative</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Established
              </label>
              <Input
                type="date"
                value={settings.dateEstablished ? new Date(settings.dateEstablished).toISOString().split('T')[0] : ''}
                onChange={(e) => handleChange('dateEstablished', e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SEC Registration No.
              </label>
              <Input
                value={settings.secRegistrationNo}
                onChange={(e) => handleChange('secRegistrationNo', e.target.value)}
                placeholder="SEC-XXXXXXXXX"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                DTI Registration No.
              </label>
              <Input
                value={settings.dtiRegistrationNo}
                onChange={(e) => handleChange('dtiRegistrationNo', e.target.value)}
                placeholder="DTI-XXXXXXXXX"
                className="w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mayor's Permit No.
              </label>
              <Input
                value={settings.mayorPermitNo}
                onChange={(e) => handleChange('mayorPermitNo', e.target.value)}
                placeholder="MP-XXXXXXXXX"
                className="w-full"
              />
            </div>
          </div>
        </Card>
      )}

      {/* BIR Information Tab */}
      {activeTab === 'bir' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-green-100 rounded-lg">
              <Receipt className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">BIR Information</h2>
              <p className="text-sm text-gray-600">Tax identification and BIR registration details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TIN (Tax Identification Number) <span className="text-red-500">*</span>
              </label>
              <Input
                value={settings.tin}
                onChange={(e) => handleChange('tin', e.target.value)}
                placeholder="000-000-000-000"
                maxLength={15}
                className="w-full font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Format: XXX-XXX-XXX-XXX</p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900">VAT Registered</label>
                <p className="text-xs text-gray-600">Company is registered for VAT</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.vatRegistered}
                  onChange={() => handleCheckboxChange('vatRegistered')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BIR Accreditation No.
              </label>
              <Input
                value={settings.birAccreditationNo}
                onChange={(e) => handleChange('birAccreditationNo', e.target.value)}
                placeholder="ACC-XXXXXXXXX"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BIR Permit No.
              </label>
              <Input
                value={settings.birPermitNo}
                onChange={(e) => handleChange('birPermitNo', e.target.value)}
                placeholder="PER-XXXXXXXXX"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                BIR Permit Date Issued
              </label>
              <Input
                type="date"
                value={settings.birPermitDateIssued ? new Date(settings.birPermitDateIssued).toISOString().split('T')[0] : ''}
                onChange={(e) => handleChange('birPermitDateIssued', e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                This information will appear on all official receipts and must be accurate for BIR compliance.
                Ensure your TIN and registration details are up-to-date.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Contact Details Tab */}
      {activeTab === 'contact' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Contact Details</h2>
              <p className="text-sm text-gray-600">Head office and customer service information</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4">Head Office Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <Input
                    value={settings.headOfficeAddress}
                    onChange={(e) => handleChange('headOfficeAddress', e.target.value)}
                    placeholder="123 Main Street, Barangay Name"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <Input
                    value={settings.headOfficeCity}
                    onChange={(e) => handleChange('headOfficeCity', e.target.value)}
                    placeholder="Manila"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Province
                  </label>
                  <Input
                    value={settings.headOfficeProvince}
                    onChange={(e) => handleChange('headOfficeProvince', e.target.value)}
                    placeholder="Metro Manila"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zip Code
                  </label>
                  <Input
                    value={settings.headOfficeZipCode}
                    onChange={(e) => handleChange('headOfficeZipCode', e.target.value)}
                    placeholder="1000"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Head Office Phone
                  </label>
                  <Input
                    value={settings.headOfficePhone}
                    onChange={(e) => handleChange('headOfficePhone', e.target.value)}
                    placeholder="+63 2 1234 5678"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Head Office Email
                  </label>
                  <Input
                    type="email"
                    value={settings.headOfficeEmail}
                    onChange={(e) => handleChange('headOfficeEmail', e.target.value)}
                    placeholder="info@davidssalon.com"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Service Phone
                  </label>
                  <Input
                    value={settings.customerServicePhone}
                    onChange={(e) => handleChange('customerServicePhone', e.target.value)}
                    placeholder="+63 2 8888 8888"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Service Email
                  </label>
                  <Input
                    type="email"
                    value={settings.customerServiceEmail}
                    onChange={(e) => handleChange('customerServiceEmail', e.target.value)}
                    placeholder="support@davidssalon.com"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fax Number
                  </label>
                  <Input
                    value={settings.headOfficeFax}
                    onChange={(e) => handleChange('headOfficeFax', e.target.value)}
                    placeholder="+63 2 1234 5679"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Online Presence</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <Input
                    value={settings.websiteUrl}
                    onChange={(e) => handleChange('websiteUrl', e.target.value)}
                    placeholder="https://www.davidssalon.com"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facebook Page
                  </label>
                  <Input
                    value={settings.facebookPage}
                    onChange={(e) => handleChange('facebookPage', e.target.value)}
                    placeholder="facebook.com/davidssalon"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instagram Handle
                  </label>
                  <Input
                    value={settings.instagramHandle}
                    onChange={(e) => handleChange('instagramHandle', e.target.value)}
                    placeholder="@davidssalon"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Receipt Settings Tab */}
      {activeTab === 'receipt' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Receipt Settings</h2>
              <p className="text-sm text-gray-600">Customize receipt header, footer, and policies</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Header
              </label>
              <Input
                value={settings.receiptHeader}
                onChange={(e) => handleChange('receiptHeader', e.target.value)}
                placeholder="David's Salon"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Displayed at the top of receipts</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt Footer
              </label>
              <textarea
                value={settings.receiptFooter}
                onChange={(e) => handleChange('receiptFooter', e.target.value)}
                placeholder="Thank you for choosing David's Salon!"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Displayed at the bottom of receipts</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Return / Exchange Policy
              </label>
              <textarea
                value={settings.returnPolicy}
                onChange={(e) => handleChange('returnPolicy', e.target.value)}
                placeholder="Products may be returned within 7 days with original receipt and packaging."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Displayed on receipts</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Warranty Policy
              </label>
              <textarea
                value={settings.warrantyPolicy}
                onChange={(e) => handleChange('warrantyPolicy', e.target.value)}
                placeholder="Services are guaranteed for 7 days. Contact us for any concerns."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Service warranty information</p>
            </div>

            {/* Print Customer Copy Toggle */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Print Customer Copy
                  </label>
                  <p className="text-xs text-gray-500">
                    When enabled, receptionists will print both merchant and customer copies of receipts. 
                    Merchant's copy is always printed for record-keeping.
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    onClick={() => handleCheckboxChange('printCustomerCopy')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#160B53] focus:ring-offset-2 ${
                      settings.printCustomerCopy ? 'bg-[#160B53]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.printCustomerCopy ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Merchant's Copy:</strong> Always printed first with "MERCHANT'S COPY" label (for your records)</li>
                      <li><strong>Customer's Copy:</strong> Printed second with "CUSTOMER'S COPY" label (only if this setting is enabled)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Operational Settings Tab */}
      {activeTab === 'operational' && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Operational Settings</h2>
              <p className="text-sm text-gray-600">System-wide operational configurations</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Currency
                </label>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => handleChange('defaultCurrency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                >
                  <option value="PHP">PHP - Philippine Peso</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Timezone
                </label>
                <select
                  value={settings.defaultTimezone}
                  onChange={(e) => handleChange('defaultTimezone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                >
                  <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                  <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fiscal Year Start
                </label>
                <Input
                  value={settings.fiscalYearStart}
                  onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
                  placeholder="01-01"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Format: MM-DD</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Feature Toggles</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900">Loyalty Program</label>
                    <p className="text-xs text-gray-600">Enable customer loyalty points system</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableLoyaltyProgram}
                      onChange={() => handleCheckboxChange('enableLoyaltyProgram')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900">Promotions</label>
                    <p className="text-xs text-gray-600">Enable promotional campaigns and discounts</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enablePromotions}
                      onChange={() => handleCheckboxChange('enablePromotions')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900">Referral Program</label>
                    <p className="text-xs text-gray-600">Enable customer referral rewards</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableReferralProgram}
                      onChange={() => handleCheckboxChange('enableReferralProgram')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-900">Online Booking</label>
                    <p className="text-xs text-gray-600">Enable online appointment booking</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableOnlineBooking}
                      onChange={() => handleCheckboxChange('enableOnlineBooking')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Save Reminder */}
      {hasChanges && (
        <Card className="bg-yellow-50 border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm font-medium text-yellow-900">
                You have unsaved changes. Click "Save Changes" to apply your settings.
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

export default SystemSettings;
