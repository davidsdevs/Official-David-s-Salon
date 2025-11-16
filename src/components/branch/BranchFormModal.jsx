/**
 * Branch Form Modal
 * For creating and editing branches
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createBranch, updateBranch } from '../../services/branchService';
import { getAllUsers } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { getFullName } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const BranchFormModal = ({ branch, onClose, onSave }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contact: '',
    email: '',
    managerID: '',
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
    fetchManagers();
    if (branch) {
      setFormData({
        name: branch.name || branch.branchName || '',
        address: branch.address || '',
        contact: branch.contact || '',
        email: branch.email || '',
        managerID: branch.managerID || '',
        operatingHours: branch.operatingHours || formData.operatingHours
      });
    }
  }, [branch]);

  const fetchManagers = async () => {
    try {
      const users = await getAllUsers();
      // Filter users who have Branch Manager role
      const branchManagers = users.filter(user => {
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.includes(USER_ROLES.BRANCH_MANAGER);
      });
      setManagers(branchManagers);
    } catch (error) {
      console.error('Error fetching managers:', error);
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
    
    if (!formData.name || !formData.address || !formData.contact) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      if (branch) {
        // Update existing branch
        await updateBranch(branch.id, formData, currentUser);
      } else {
        // Create new branch
        await createBranch(formData, currentUser);
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving branch:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {branch ? 'Edit Branch' : 'Add New Branch'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Branch Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., David's Salon - Manila Branch"
                />
              </div>

              {/* Manager */}
              <div>
                <label htmlFor="managerID" className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Manager
                </label>
                <select
                  id="managerID"
                  name="managerID"
                  value={formData.managerID}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">No Manager Assigned</option>
                  {managers.map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {getFullName(manager)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
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
            </div>
          </div>

          {/* Contact Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Number */}
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-2">
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
              <strong>Note:</strong> Operating hours will affect appointment availability for this branch.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              {branch ? 'Update Branch' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchFormModal;
