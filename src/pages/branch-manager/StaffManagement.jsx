/**
 * Staff Management Page - Branch Manager
 * Manage staff within their branch only
 */

import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Search, Edit, Power, Mail } from 'lucide-react';
import { getUsersByBranch, toggleUserStatus, resetUserPassword } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants';
import { formatDate, getFullName, getInitials } from '../../utils/helpers';
import BranchStaffFormModal from '../../components/branch/BranchStaffFormModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RoleBadges from '../../components/ui/RoleBadges';
import toast from 'react-hot-toast';

const StaffManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [branchName, setBranchName] = useState('');

  // Branch Manager can only manage these roles
  const MANAGEABLE_ROLES = [
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.STYLIST,
    USER_ROLES.INVENTORY_CONTROLLER
  ];

  useEffect(() => {
    if (userBranch) {
      fetchBranchDetails();
      fetchStaff();
    }
  }, [userBranch]);

  const fetchBranchDetails = async () => {
    try {
      const branch = await getBranchById(userBranch);
      setBranchName(branch.branchName);
    } catch (error) {
      console.error('Error fetching branch details:', error);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [staff, searchTerm, roleFilter]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const branchStaff = await getUsersByBranch(userBranch);
      // Filter to only show manageable roles
      const manageableStaff = branchStaff.filter(user => {
        // Check if user has any manageable role in their roles array
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.some(role => MANAGEABLE_ROLES.includes(role));
      });
      setStaff(manageableStaff);
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...staff];

    if (searchTerm) {
      filtered = filtered.filter(member => {
        const fullName = getFullName(member).toLowerCase();
        const email = member.email?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
      });
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(member => {
        // Check if member has the role in their roles array
        const memberRoles = member.roles || (member.role ? [member.role] : []);
        return memberRoles.includes(roleFilter);
      });
    }

    setFilteredStaff(filtered);
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await toggleUserStatus(userId, !currentStatus, currentUser);
      await fetchStaff();
    } catch (error) {
      // Error handled in service
    }
  };

  const handleResetPassword = async (email) => {
    try {
      await resetUserPassword(email);
    } catch (error) {
      // Error handled in service
    }
  };

  const handleEditStaff = (member) => {
    setSelectedStaff(member);
    setShowStaffForm(true);
  };

  const handleStaffSaved = () => {
    setShowStaffForm(false);
    setSelectedStaff(null);
    fetchStaff();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!userBranch) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">
          You need to be assigned to a branch to manage staff.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600 mt-1">
            Manage staff members for branch: <span className="font-semibold">{branchName || 'Loading...'}</span>
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedStaff(null);
            setShowStaffForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Staff
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{staff.length}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Staff</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {staff.filter(s => s.isActive).length}
              </p>
            </div>
            <Power className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Receptionists</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {staff.filter(s => {
                  const roles = s.roles || (s.role ? [s.role] : []);
                  return roles.includes(USER_ROLES.RECEPTIONIST);
                }).length}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stylists</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {staff.filter(s => {
                  const roles = s.roles || (s.role ? [s.role] : []);
                  return roles.includes(USER_ROLES.STYLIST);
                }).length}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            {MANAGEABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {getInitials(member)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {getFullName(member)}
                          </div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadges user={member} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditStaff(member)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit Staff"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(member.email)}
                          className="text-orange-600 hover:text-orange-900"
                          title="Reset Password"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(member.id, member.isActive)}
                          className={member.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                          title={member.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showStaffForm && (
        <BranchStaffFormModal
          staff={selectedStaff}
          branchId={userBranch}
          branchName={branchName}
          onClose={() => {
            setShowStaffForm(false);
            setSelectedStaff(null);
          }}
          onSave={handleStaffSaved}
        />
      )}
    </div>
  );
};

export default StaffManagement;
