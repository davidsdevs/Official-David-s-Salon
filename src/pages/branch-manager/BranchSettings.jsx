/**
 * Branch Settings Page
 * For Branch Managers to manage their branch details
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Save, ArrowLeft } from 'lucide-react';
import { getBranchById, updateBranch } from '../../services/branchService';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const BranchSettings = () => {
  const { currentUser, userBranch } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branch, setBranch] = useState(null);
  const [formData, setFormData] = useState({
    address: '',
    contact: '',
    email: '',
    operatingHours: {
      monday: { open: '09:00', close: '18:00', isOpen: true },
      tuesday: { open: '09:00', close: '18:00', isOpen: true },
      wednesday: { open: '09:00', close: '18:00', isOpen: true },
      thursday: { open: '09:00', close: '18:00', isOpen: true },
      friday: { open: '09:00', close: '18:00', isOpen: true },
      saturday: { open: '09:00', close: '18:00', isOpen: true },
      sunday: { open: '09:00', close: '18:00', isOpen: false }
    }
  });

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  useEffect(() => {
    if (userBranch) {
      fetchBranch();
    } else {
      setLoading(false);
    }
  }, [userBranch]);

  const fetchBranch = async () => {
    try {
      setLoading(true);
      const data = await getBranchById(userBranch);
      setBranch(data);
      setFormData({
        address: data.address || '',
        contact: data.contact || '',
        email: data.email || '',
        operatingHours: data.operatingHours || formData.operatingHours
      });
    } catch (error) {
      // Silently handle error, UI will show "No branch assigned" message
      setBranch(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          [field]: value
        }
      }
    }));
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          isOpen: !prev.operatingHours[day].isOpen
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.address || !formData.contact) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      await updateBranch(userBranch, formData, currentUser);
      await fetchBranch();
    } catch (error) {
      console.error('Error updating branch:', error);
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

  if (!branch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No branch assigned to your account</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/manager/settings')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Settings</h1>
          <p className="text-gray-600 mt-1">Manage your branch information and operating hours</p>
        </div>
      </div>

      {/* Branch Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Branch Information (Read-Only) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Branch Information
            </h3>
            <div className="space-y-4">
              {/* Branch Name - Read Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={branch.name || branch.branchName}
                  readOnly
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* Status - Read Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <input
                  type="text"
                  value={branch.isActive === true ? 'Active' : 'Inactive'}
                  readOnly
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Contact Information
            </h3>
            <div className="space-y-4">
              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Address *
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Complete branch address"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Contact Number *
                </label>
                <input
                  type="tel"
                  id="contact"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="+63 912 345 6789"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="branch@davidsalon.com"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              <Clock className="w-4 h-4 inline mr-2" />
              Operating Hours
            </h3>
            <div className="space-y-3">
              {days.map(day => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-28">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.operatingHours[day].isOpen}
                        onChange={() => handleDayToggle(day)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {day}
                      </span>
                    </label>
                  </div>
                  
                  {formData.operatingHours[day].isOpen ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={formData.operatingHours[day].open}
                        onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={formData.operatingHours[day].close}
                        onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 italic">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Changes to operating hours will affect appointment availability.
              System Admin will be notified of any changes.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchSettings;
