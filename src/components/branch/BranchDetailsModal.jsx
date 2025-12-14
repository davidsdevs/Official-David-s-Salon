/**
 * Branch Details Modal - View-only modal for branch information
 */

import { X, MapPin, Phone, Mail, User, Clock, Calendar } from 'lucide-react';
import { formatDate, formatTime12Hour } from '../../utils/helpers';

const BranchDetailsModal = ({ branch, onClose, stats }) => {
  if (!branch) return null;

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Branch Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Name
                </label>
                <p className="text-gray-900">{branch.name || branch.branchName}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  branch.isActive === true 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {branch.isActive === true ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Contact Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <p className="text-gray-900">{branch.address}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number
                  </label>
                  <p className="text-gray-900">{branch.contact}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <p className="text-gray-900">{branch.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Operating Hours
            </h3>
            <div className="space-y-2">
              {daysOfWeek.map((day) => {
                const hours = branch.operatingHours?.[day];
                return (
                  <div key={day} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {day}
                    </span>
                    {!hours?.isOpen ? (
                      <span className="text-sm text-red-600 font-medium">Closed</span>
                    ) : (
                      <span className="text-sm text-gray-900">
                        {formatTime12Hour(hours?.open || '09:00')} - {formatTime12Hour(hours?.close || '18:00')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Statistics */}
          {stats && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Branch Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.staffCount || 0}</p>
                  <p className="text-sm text-gray-600 mt-1">Staff Members</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.appointmentCount || 0}</p>
                  <p className="text-sm text-gray-600 mt-1">Appointments</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">₱{(stats.revenue || 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-600 mt-1">Revenue</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{stats.inventoryItems || 0}</p>
                  <p className="text-sm text-gray-600 mt-1">Inventory Items</p>
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Additional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-600 mb-1">Created At</label>
                <p className="text-gray-900">
                  {branch.createdAt ? formatDate(branch.createdAt) : 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Last Updated</label>
                <p className="text-gray-900">
                  {branch.updatedAt ? formatDate(branch.updatedAt) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchDetailsModal;
