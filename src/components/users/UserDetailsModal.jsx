/**
 * User Details Modal Component
 * View detailed information about a user
 */

import { useState, useEffect } from 'react';
import { X, Edit, Mail, Phone, MapPin, Calendar, Shield, Building2, Activity } from 'lucide-react';
import { getUserRecentActivities, getActionLabel } from '../../services/activityService';
import { getBranchById } from '../../services/branchService';
import { ROLE_LABELS } from '../../utils/constants';
import { formatDate, formatDateTime, getFullName, getInitials } from '../../utils/helpers';
import RoleBadges from '../ui/RoleBadges';
import LoadingSpinner from '../ui/LoadingSpinner';

const UserDetailsModal = ({ user, onClose, onEdit }) => {
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [branchName, setBranchName] = useState('');

  useEffect(() => {
    if (user) {
      fetchUserActivities();
      if (user.branchId) {
        fetchBranchName();
      }
    }
  }, [user]);

  const fetchBranchName = async () => {
    try {
      const branch = await getBranchById(user.branchId);
      setBranchName(branch.name || branch.branchName || user.branchId);
    } catch (error) {
      console.error('Error fetching branch:', error);
      setBranchName(user.branchId); // Fallback to ID if fetch fails
    }
  };

  const fetchUserActivities = async () => {
    try {
      setLoadingActivities(true);
      const userActivities = await getUserRecentActivities(user.id, 10);
      setActivities(userActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={getFullName(user)}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {getInitials(user)}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{getFullName(user)}</h2>
              <div className="mt-1">
                <RoleBadges user={user} size="sm" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit User"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Email Address</p>
                  <p className="text-sm font-medium text-gray-900">{user.email}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Phone Number</p>
                    <p className="text-sm font-medium text-gray-900">{user.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <p className="text-sm font-medium text-gray-900">{ROLE_LABELS[user.role]}</p>
                </div>
              </div>

              {user.branchId && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Branch</p>
                    <p className="text-sm font-medium text-gray-900">{branchName || user.branchId}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Created Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(user.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(user.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 inline-flex text-sm leading-5 font-semibold rounded-full ${
                user.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Recent Activities */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            </div>

            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No recent activities</p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {getActionLabel(activity.action)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDateTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
