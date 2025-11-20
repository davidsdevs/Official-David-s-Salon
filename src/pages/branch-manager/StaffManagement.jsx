/**
 * Staff Management Page - Branch Manager
 * Manage staff within their branch only
 */

import { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Search, Edit, Power, Mail, Scissors, Award, Calendar, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { getUsersByBranch, toggleUserStatus, resetUserPassword, getUserById } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { getActiveLendingForBranch, getActiveLendingFromBranch, getActiveLending } from '../../services/stylistLendingService';
import { getActiveSchedulesByEmployee } from '../../services/scheduleService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants';
import { formatDate, getFullName, getInitials } from '../../utils/helpers';
import BranchStaffFormModal from '../../components/branch/BranchStaffFormModal';
import StaffServicesCertificatesModal from '../../components/branch/StaffServicesCertificatesModal';
import StaffSchedule from './StaffSchedule';
import StaffLending from './StaffLending';
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
  const [showServicesCertificatesModal, setShowServicesCertificatesModal] = useState(false);
  const [selectedStaffForConfig, setSelectedStaffForConfig] = useState(null);
  const [branchName, setBranchName] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'schedule', or 'lending'
  const [lentStaff, setLentStaff] = useState([]); // Staff lent TO this branch (from other branches)
  const [lentOutStaff, setLentOutStaff] = useState({}); // Staff FROM this branch lent out { staffId: { toBranchId, toBranchName, startDate, endDate } }
  const [branchCache, setBranchCache] = useState({}); // Cache for branch names

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
      fetchLendingData();
    }
  }, [userBranch]);

  // Fetch lending data - staff lent TO this branch and staff FROM this branch lent out
  const fetchLendingData = async () => {
    if (!userBranch) return;
    
    try {
      const today = new Date();
      
      // Get staff currently lent TO this branch (from other branches)
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsTo = await getActiveLendingForBranch(userBranch, null);
      
      console.log('Fetched active lendings TO this branch:', {
        branchId: userBranch,
        count: activeLendingsTo.length,
        lendings: activeLendingsTo
      });
      
      // Fetch the actual staff data for lent staff
      const lentStaffData = await Promise.all(
        activeLendingsTo.map(async (lending) => {
          try {
            const staffMember = await getUserById(lending.stylistId);
            const fromBranch = await getBranchById(lending.fromBranchId);
            
            // Check if staff member has any manageable role
            const userRoles = staffMember.roles || (staffMember.role ? [staffMember.role] : []);
            const hasManageableRole = userRoles.some(role => MANAGEABLE_ROLES.includes(role));
            
            console.log('Fetched lent staff member:', {
              staffId: lending.stylistId,
              staffName: getFullName(staffMember),
              fromBranch: fromBranch?.branchName || fromBranch?.name,
              roles: userRoles,
              hasManageableRole
            });
            
            // Only include if they have a manageable role (same as regular staff)
            if (!hasManageableRole) {
              console.log('Skipping lent staff member - no manageable role:', getFullName(staffMember));
              return null;
            }
            
            return {
              ...staffMember,
              isLent: true,
              lentFromBranch: fromBranch?.branchName || fromBranch?.name || 'Unknown Branch',
              lentFromBranchId: lending.fromBranchId,
              lendingStartDate: lending.startDate,
              lendingEndDate: lending.endDate
            };
          } catch (error) {
            console.error('Error fetching lent staff:', error);
            return null;
          }
        })
      );
      
      const validLentStaff = lentStaffData.filter(s => s !== null);
      console.log('Setting lent staff:', validLentStaff.length, validLentStaff);
      setLentStaff(validLentStaff);
      
      // Get staff FROM this branch that are lent out
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsFrom = await getActiveLendingFromBranch(userBranch, null);
      const lentOutMap = {};
      const branchIds = new Set();
      
      activeLendingsFrom.forEach(lending => {
        if (lending.stylistId) {
          branchIds.add(lending.toBranchId);
          lentOutMap[lending.stylistId] = {
            toBranchId: lending.toBranchId,
            startDate: lending.startDate,
            endDate: lending.endDate
          };
        }
      });
      
      // Fetch branch names
      const branchPromises = Array.from(branchIds).map(async (id) => {
        if (!branchCache[id]) {
          try {
            const branch = await getBranchById(id);
            return { id, branch };
          } catch (error) {
            return { id, branch: null };
          }
        }
        return null;
      });
      
      const branchResults = await Promise.all(branchPromises);
      const newBranchCache = { ...branchCache };
      branchResults.forEach(result => {
        if (result && result.branch) {
          newBranchCache[result.id] = result.branch;
        }
      });
      setBranchCache(newBranchCache);
      
      // Update lentOutMap with branch names
      Object.keys(lentOutMap).forEach(staffId => {
        const branch = newBranchCache[lentOutMap[staffId].toBranchId];
        lentOutMap[staffId].toBranchName = branch?.branchName || branch?.name || 'Unknown Branch';
      });
      
      setLentOutStaff(lentOutMap);
    } catch (error) {
      console.error('Error fetching lending data:', error);
    }
  };

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
  }, [staff, lentStaff, searchTerm, roleFilter]);

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
      
      // Load shifts from schedules collection for each staff member
      const today = new Date();
      const staffWithSchedules = await Promise.all(
        manageableStaff.map(async (member) => {
          const memberId = member.id || member.uid;
          if (!memberId) return member;
          
          try {
            // Get active schedule configuration for today
            const { activeConfig } = await getActiveSchedulesByEmployee(memberId, userBranch, today);
            
            // Extract shifts from the active config
            const shifts = {};
            if (activeConfig && activeConfig.employeeShifts) {
              Object.entries(activeConfig.employeeShifts).forEach(([dayKey, shift]) => {
                if (shift && shift.start && shift.end) {
                  shifts[dayKey.toLowerCase()] = {
                    start: shift.start,
                    end: shift.end
                  };
                }
              });
            }
            
            return {
              ...member,
              shifts
            };
          } catch (error) {
            console.error(`Error loading schedules for ${memberId}:`, error);
            return { ...member, shifts: {} };
          }
        })
      );
      
      setStaff(staffWithSchedules);
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // Combine regular staff with lent staff
    const allStaff = [...staff, ...lentStaff];
    console.log('Applying filters:', {
      regularStaff: staff.length,
      lentStaff: lentStaff.length,
      total: allStaff.length
    });
    let filtered = [...allStaff];

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

  const handleConfigureServices = (member) => {
    setSelectedStaffForConfig(member);
    setShowServicesCertificatesModal(true);
  };

  const handleViewServices = (member) => {
    // For lent staff, open in view-only mode with their original branch ID
    setSelectedStaffForConfig({ 
      ...member, 
      isLent: true,
      originalBranchId: member.lentFromBranchId || userBranch
    });
    setShowServicesCertificatesModal(true);
  };

  const handleServicesCertificatesSaved = () => {
    setShowServicesCertificatesModal(false);
    setSelectedStaffForConfig(null);
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
        {activeTab === 'list' && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                Staff List
              </div>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'schedule'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Schedule
              </div>
            </button>
            <button
              onClick={() => setActiveTab('lending')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'lending'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                Lending
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' ? (
        <>
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
                  Shifts
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
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const memberId = member.id || member.uid;
                  const isLentToThisBranch = member.isLent; // Staff lent TO this branch
                  const isLentOut = lentOutStaff[memberId]; // Staff FROM this branch lent out
                  
                  return (
                  <tr key={memberId} className={`hover:bg-gray-50 ${isLentToThisBranch ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {getInitials(member)}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {getFullName(member)}
                            </div>
                            {isLentToThisBranch && (
                              <span className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                                (lent)
                              </span>
                            )}
                            {isLentOut && (
                              <span className="px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                Lent to {isLentOut.toBranchName}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                          {isLentToThisBranch && member.lentFromBranch && (
                            <div className="text-xs text-blue-600 mt-1">
                              From: {member.lentFromBranch}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadges user={member} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.shifts && Object.keys(member.shifts).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(member.shifts).map((dayKey) => {
                            const dayLabels = {
                              monday: 'M',
                              tuesday: 'T',
                              wednesday: 'W',
                              thursday: 'T',
                              friday: 'F',
                              saturday: 'S',
                              sunday: 'S'
                            };
                            const shift = member.shifts[dayKey];
                            return (
                              <span
                                key={dayKey}
                                className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                                title={`${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}: ${shift.start} - ${shift.end}`}
                              >
                                {dayLabels[dayKey]}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No shifts</span>
                      )}
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
                      {isLentToThisBranch ? (
                        // View-only actions for lent staff
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewServices(member)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Services & Certificates (Read-only)"
                          >
                            <Scissors className="w-5 h-5" />
                          </button>
                          <span className="text-xs text-gray-400 italic">View only</span>
                        </div>
                      ) : (
                        // Full actions for regular staff
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditStaff(member)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Edit Staff"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleConfigureServices(member)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Configure Services & Certificates"
                          >
                            <Scissors className="w-5 h-5" />
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
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : activeTab === 'schedule' ? (
        <StaffSchedule />
      ) : (
        <StaffLending />
      )}

      {/* Modals */}
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

      {showServicesCertificatesModal && (
        <StaffServicesCertificatesModal
          isOpen={showServicesCertificatesModal}
          staff={selectedStaffForConfig}
          branchId={selectedStaffForConfig?.isLent ? (selectedStaffForConfig.originalBranchId || selectedStaffForConfig.lentFromBranchId) : userBranch}
          onClose={() => {
            setShowServicesCertificatesModal(false);
            setSelectedStaffForConfig(null);
          }}
          onSave={handleServicesCertificatesSaved}
          isReadOnly={selectedStaffForConfig?.isLent || false}
        />
      )}

    </div>
  );
};

export default StaffManagement;
