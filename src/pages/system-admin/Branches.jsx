/**
 * Branches Management Page
 * For System Admin and Franchise Owner to manage all branches
 */

import { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Mail, User, Power, Edit, Eye, Trash2, Database, Server, Activity, Users } from 'lucide-react';
import { collection, getDocs, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllBranches, toggleBranchStatus, getBranchStats, deleteBranch } from '../../services/branchService';
import { getAllUsers } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { getFullName } from '../../utils/helpers';
import { USER_ROLES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BranchFormModal from '../../components/branch/BranchFormModal';
import BranchDetailsModal from '../../components/branch/BranchDetailsModal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

const Branches = () => {
  const { currentUser, activeRole } = useAuth();
  const [branches, setBranches] = useState([]);
  const [filteredBranches, setFilteredBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null); // Store branchId being toggled
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchStats, setBranchStats] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [viewBranch, setViewBranch] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleStatusModal, setShowToggleStatusModal] = useState(false);
  const [branchToToggle, setBranchToToggle] = useState(null);
  const [summaryStats, setSummaryStats] = useState({
    totalUsers: 0,
    totalStaff: 0,
    totalCollections: 0,
    totalActivityLogs: 0
  });

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'System Admin - Branches | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);
  const [branchToDelete, setBranchToDelete] = useState(null);

  useEffect(() => {
    fetchBranches();
    fetchSummaryStats();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [branches, searchTerm, statusFilter]);

  const fetchSummaryStats = async () => {
    try {
      // Get total users count (all users including staff and clients)
      const allUsers = await getAllUsers();
      const totalUsers = allUsers.length;

      // Get total staff count (active users who are not clients)
      const staffCount = allUsers.filter(u => {
        const roles = u.roles || (u.role ? [u.role] : []);
        return !roles.includes(USER_ROLES.CLIENT) && u.isActive !== false;
      }).length;

      // Get total activity logs count
      const activityLogsQuery = collection(db, 'activity_logs');
      const activityLogsSnapshot = await getCountFromServer(activityLogsQuery);
      const totalActivityLogs = activityLogsSnapshot.data().count;

      // Get total database collections count (monitored collections)
      const collections = [
        'appointments', 'branch_products', 'branches', 'categories', 'invoices',
        'loyalty', 'master_products', 'purchase_orders', 'purchase_orders_details',
        'referrals', 'salon_use_inventory', 'salon_use_products', 'schedules',
        'services', 'staff_services', 'stock_transfer', 'stock_transfer_audit',
        'stocks', 'suppliers', 'activity_logs', 'users'
      ];

      setSummaryStats({
        totalUsers: totalUsers,
        totalStaff: staffCount,
        totalCollections: collections.length,
        totalActivityLogs: totalActivityLogs
      });
    } catch (error) {
      console.error('Error fetching summary stats:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const data = await getAllBranches();
      console.log('Fetched branches:', data);
      setBranches(data);
      
      // Fetch stats for each branch
      const stats = {};
      for (const branch of data) {
        stats[branch.id] = await getBranchStats(branch.id);
      }
      setBranchStats(stats);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error(`Failed to load branches: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...branches];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(branch =>
        (branch.name || branch.branchName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(branch => {
        if (statusFilter === 'active') return branch.isActive === true;
        if (statusFilter === 'inactive') return branch.isActive === false;
        return true;
      });
    }

    setFilteredBranches(filtered);
  };

  const handleAddBranch = () => {
    setSelectedBranch(null);
    setShowFormModal(true);
  };

  const handleEditBranch = (branch) => {
    setSelectedBranch(branch);
    setShowFormModal(true);
  };

  const handleViewBranch = (branch) => {
    setViewBranch(branch);
    setShowDetailsModal(true);
  };

  const handleDeleteBranch = (branch) => {
    setBranchToDelete(branch);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!branchToDelete) return;
    
    try {
      setDeleting(true);
      await deleteBranch(branchToDelete.id, currentUser);
      await fetchBranches();
      setShowDeleteModal(false);
    } catch (error) {
      // Error handled in service
    } finally {
      setDeleting(false);
      setBranchToDelete(null);
    }
  };

  const handleToggleStatus = (branch) => {
    setBranchToToggle(branch);
    setShowToggleStatusModal(true);
  };

  const confirmToggleStatus = async () => {
    if (!branchToToggle) return;
    
    try {
      setToggling(branchToToggle.id);
      const newStatus = !branchToToggle.isActive; // Toggle boolean
      await toggleBranchStatus(branchToToggle.id, newStatus, currentUser);
      await fetchBranches();
      setShowToggleStatusModal(false);
      setBranchToToggle(null);
    } catch (error) {
      // Error handled in service
    } finally {
      setToggling(null);
    }
  };

  const handleFormSave = () => {
    fetchBranches();
    fetchSummaryStats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const activeBranches = branches.filter(b => b.isActive === true).length;
  const inactiveBranches = branches.filter(b => b.isActive === false).length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Branch Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage all salon branches and their configurations</p>
        </div>
        <button
          onClick={handleAddBranch}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span>Add Branch</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Total Branches</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{branches.length}</p>
            </div>
            <MapPin className="w-6 h-6 md:w-8 md:h-8 text-primary-600 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Active Branches</p>
              <p className="text-xl md:text-2xl font-bold text-green-600 mt-1">
                {activeBranches}
              </p>
            </div>
            <Power className="w-6 h-6 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Inactive Branches</p>
              <p className="text-xl md:text-2xl font-bold text-red-600 mt-1">
                {inactiveBranches}
              </p>
            </div>
            <Power className="w-6 h-6 md:w-8 md:h-8 text-red-600 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Total Users</p>
              <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
                {summaryStats.totalUsers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{summaryStats.totalStaff} staff</p>
            </div>
            <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Database Collections</p>
              <p className="text-xl md:text-2xl font-bold text-purple-600 mt-1">
                {summaryStats.totalCollections}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Monitored</p>
            </div>
            <Database className="w-6 h-6 md:w-8 md:h-8 text-purple-600 flex-shrink-0" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 md:p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600">Activity Logs</p>
              <p className="text-xl md:text-2xl font-bold text-orange-600 mt-1">
                {summaryStats.totalActivityLogs.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Total tracked</p>
            </div>
            <Activity className="w-6 h-6 md:w-8 md:h-8 text-orange-600 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 md:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredBranches.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No branches found
          </div>
        ) : (
          filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow"
            >
              {/* Branch Header */}
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">{branch.name || branch.branchName}</h3>
                  <span
                    className={`inline-block mt-2 px-2 md:px-3 py-1 text-xs font-medium rounded-full ${
                      branch.isActive === true
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {branch.isActive === true ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Branch Details */}
              <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
                <div className="flex items-start gap-2 text-xs md:text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="break-words">{branch.address}</span>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{branch.contact}</span>
                </div>
                {branch.email && (
                  <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{branch.email}</span>
                  </div>
                )}
              </div>

              {/* Branch Stats */}
              {branchStats[branch.id] && (
                <div className="mb-3 md:mb-4 pt-3 md:pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Assigned Staff</p>
                    <p className="text-base md:text-lg font-semibold text-gray-900">
                      {branchStats[branch.id].staffCount || 0}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-3 md:pt-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={() => handleViewBranch(branch)}
                    disabled={toggling === branch.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-primary-300 text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
                  >
                    <Eye className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">View</span>
                  </button>
                  <button
                    onClick={() => handleEditBranch(branch)}
                    disabled={toggling === branch.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
                  >
                    <Edit className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleStatus(branch)}
                    disabled={toggling === branch.id}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-0 ${
                      branch.isActive === true
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {toggling === branch.id ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="truncate">Processing...</span>
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                          {branch.isActive === true ? 'Deactivate' : 'Activate'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
                {activeRole === USER_ROLES.SYSTEM_ADMIN && (
                  <button
                    onClick={() => handleDeleteBranch(branch)}
                    disabled={toggling === branch.id}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4 flex-shrink-0" />
                    <span>Delete Branch</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <BranchFormModal
          branch={selectedBranch}
          onClose={() => setShowFormModal(false)}
          onSave={handleFormSave}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && viewBranch && (
        <BranchDetailsModal
          branch={viewBranch}
          stats={branchStats[viewBranch.id]}
          onClose={() => setShowDetailsModal(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!deleting) {
            setShowDeleteModal(false);
            setBranchToDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Delete Branch"
        message={`Are you sure you want to delete "${branchToDelete?.name || branchToDelete?.branchName}"? This action cannot be undone. Note: You cannot delete a branch with assigned staff.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />

      {/* Toggle Status Confirmation Modal */}
      <ConfirmModal
        isOpen={showToggleStatusModal}
        onClose={() => {
          if (!toggling) {
            setShowToggleStatusModal(false);
            setBranchToToggle(null);
          }
        }}
        onConfirm={confirmToggleStatus}
        title={branchToToggle?.isActive === true ? 'Deactivate Branch' : 'Activate Branch'}
        message={`Are you sure you want to ${branchToToggle?.isActive === true ? 'deactivate' : 'activate'} "${branchToToggle?.name || branchToToggle?.branchName}"? ${branchToToggle?.isActive === true ? 'This will prevent the branch from being used for appointments and other operations. The branch can be reactivated later.' : 'This will make the branch available for appointments and operations.'}`}
        confirmText={branchToToggle?.isActive === true ? 'Deactivate' : 'Activate'}
        cancelText="Cancel"
        type={branchToToggle?.isActive === true ? 'danger' : 'default'}
        loading={toggling === branchToToggle?.id}
      />
    </div>
  );
};

export default Branches;
