/**
 * Users View Page (Read-Only for Operational Manager)
 * Big data friendly with pagination and limited queries
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Eye, 
  Users as UsersIcon, 
  Power, 
  Filter,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw
} from 'lucide-react';
import { db } from '../../config/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs,
  getCountFromServer 
} from 'firebase/firestore';
import { getAllBranches } from '../../services/branchService';
import { ROLE_LABELS, USER_ROLES } from '../../utils/constants';
import { getFullName, getInitials, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RoleBadges from '../../components/ui/RoleBadges';
import UserDetailsModal from '../../components/users/UserDetailsModal';
import Modal from '../../components/ui/Modal';
import { toast } from 'react-hot-toast';

/**
 * Helper function to safely convert Firestore timestamps or date strings to Date objects
 */
const safeToDate = (value) => {
  if (!value) return null;
  // If it's a Firestore Timestamp with toDate method
  if (value?.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }
  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }
  // If it's a string or number, try to parse it
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  // If it has seconds and nanoseconds (Firestore Timestamp-like object)
  if (value?.seconds !== undefined) {
    return new Date(value.seconds * 1000);
  }
  return null;
};

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const UsersView = () => {
  // Data states
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const [pageSnapshots, setPageSnapshots] = useState({});
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    branch: 'all'
  });
  
  // UI states
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    staff: 0
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
      setPageSnapshots({});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, []);

  // Fetch users when filters or pagination changes
  useEffect(() => {
    fetchUsers();
  }, [currentPage, itemsPerPage, debouncedSearch, filters]);

  const fetchBranches = async () => {
    try {
      const fetchedBranches = await getAllBranches();
      setBranches(fetchedBranches || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      
      // Build query constraints
      let constraints = [];
      
      // Add filters
      if (filters.status !== 'all') {
        constraints.push(where('isActive', '==', filters.status === 'active'));
      }
      if (filters.branch !== 'all') {
        constraints.push(where('branchId', '==', filters.branch));
      }
      
      // Order by createdAt descending
      constraints.push(orderBy('createdAt', 'desc'));
      
      // Get total count for pagination info
      try {
        const countQuery = query(usersRef, ...constraints.filter(c => c.type !== 'orderBy'));
        const countSnapshot = await getCountFromServer(countQuery);
        setTotalUsers(countSnapshot.data().count);
      } catch (e) {
        // Fallback if count fails
        console.log('Count query failed, using estimate');
      }
      
      // Add pagination
      if (currentPage > 1 && pageSnapshots[currentPage - 1]) {
        constraints.push(startAfter(pageSnapshots[currentPage - 1]));
      }
      constraints.push(limit(itemsPerPage));
      
      // Execute query
      const q = query(usersRef, ...constraints);
      const snapshot = await getDocs(q);
      
      let usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: safeToDate(doc.data().createdAt)
      }));
      
      // Client-side filtering for role (Firestore can't query arrays efficiently)
      if (filters.role !== 'all') {
        usersData = usersData.filter(user => {
          const userRoles = user.roles || (user.role ? [user.role] : []);
          return userRoles.includes(filters.role);
        });
      }
      
      // Client-side search filtering
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        usersData = usersData.filter(user => {
          const fullName = getFullName(user).toLowerCase();
          const email = (user.email || '').toLowerCase();
          return fullName.includes(search) || email.includes(search);
        });
      }
      
      // Store last document for pagination
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setPageSnapshots(prev => ({
          ...prev,
          [currentPage]: snapshot.docs[snapshot.docs.length - 1]
        }));
      }
      
      setUsers(usersData);
      
      // Update stats (only on first load or refresh)
      if (currentPage === 1 && !debouncedSearch && filters.role === 'all' && filters.status === 'all' && filters.branch === 'all') {
        updateStats(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStats = async (usersData) => {
    try {
      // Get full stats from a broader query
      const usersRef = collection(db, 'users');
      const allUsersSnapshot = await getDocs(query(usersRef, limit(1000)));
      const allUsers = allUsersSnapshot.docs.map(doc => doc.data());
      
      setStats({
        total: allUsers.length,
        active: allUsers.filter(u => u.isActive).length,
        inactive: allUsers.filter(u => !u.isActive).length,
        staff: allUsers.filter(u => u.role !== USER_ROLES.CLIENT).length
      });
    } catch (error) {
      // Use current page data as fallback
      setStats({
        total: usersData.length,
        active: usersData.filter(u => u.isActive).length,
        inactive: usersData.filter(u => !u.isActive).length,
        staff: usersData.filter(u => u.role !== USER_ROLES.CLIENT).length
      });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    setPageSnapshots({});
    fetchUsers();
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newLimit) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
    setPageSnapshots({});
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setPageSnapshots({});
    setIsFilterModalOpen(false);
  };

  const handleResetFilters = () => {
    setFilters({
      role: 'all',
      status: 'all',
      branch: 'all'
    });
    setCurrentPage(1);
    setPageSnapshots({});
  };

  const hasActiveFilters = filters.role !== 'all' || filters.status !== 'all' || filters.branch !== 'all';

  // Export to CSV
  const handleExport = () => {
    if (users.length === 0) {
      toast.error('No users to export');
      return;
    }

    const headers = ['Name', 'Email', 'Role', 'Branch', 'Status', 'Created'];
    const rows = users.map(user => [
      getFullName(user),
      user.email || 'N/A',
      ROLE_LABELS[user.role] || user.role || 'N/A',
      user.branchId ? (branches.find(b => b.id === user.branchId)?.name || user.branchId) : 'N/A',
      user.isActive ? 'Active' : 'Inactive',
      formatDate(user.createdAt)
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Users exported successfully');
  };

  // Print
  const handlePrint = () => {
    if (users.length === 0) {
      toast.error('No users to print');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Users Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; }
            .active { background-color: #dcfce7; color: #166534; }
            .inactive { background-color: #fee2e2; color: #991b1b; }
            .footer { margin-top: 20px; font-size: 11px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>Users Report</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <p>Total Users: ${users.length}</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(user => `
                <tr>
                  <td>${getFullName(user)}</td>
                  <td>${user.email || 'N/A'}</td>
                  <td>${ROLE_LABELS[user.role] || user.role || 'N/A'}</td>
                  <td>${user.branchId ? (branches.find(b => b.id === user.branchId)?.name || user.branchId) : 'N/A'}</td>
                  <td><span class="badge ${user.isActive ? 'active' : 'inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>${formatDate(user.createdAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Printed from DSMS - David's Salon Management System</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
    toast.success('Print dialog opened');
  };

  const totalPages = Math.ceil(totalUsers / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalUsers);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users Overview</h1>
          <p className="text-gray-600 mt-1">View all system users</p>
        </div>
        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">View Only Access</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <Power className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive Users</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.inactive}</p>
            </div>
            <Power className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Staff Members</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.staff}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Search Bar and Action Buttons - Visual Hierarchy */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
              hasActiveFilters 
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100' 
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            title={`Filter - ${users.length} users`}
          >
            <Filter className="w-5 h-5" />
            {users.length > 0 && (
              <span className="bg-primary-600 text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                {users.length}
              </span>
            )}
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Export to CSV"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Print"
          >
            <Printer className="w-5 h-5 text-gray-600" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active filters:</span>
          {filters.role !== 'all' && (
            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full flex items-center gap-1">
              Role: {ROLE_LABELS[filters.role]}
              <button onClick={() => setFilters(prev => ({ ...prev, role: 'all' }))} className="hover:text-primary-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.status !== 'all' && (
            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full flex items-center gap-1">
              Status: {filters.status}
              <button onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))} className="hover:text-primary-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.branch !== 'all' && (
            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full flex items-center gap-1">
              Branch: {branches.find(b => b.id === filters.branch)?.name || filters.branch}
              <button onClick={() => setFilters(prev => ({ ...prev, branch: 'all' }))} className="hover:text-primary-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={handleResetFilters}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {user.photoURL ? (
                              <img 
                                src={user.photoURL} 
                                alt={getFullName(user)}
                                className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {getInitials(user)}
                              </div>
                            )}
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {getFullName(user)}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <RoleBadges user={user} size="sm" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.branchId ? (() => {
                            const branch = branches.find(b => b.id === user.branchId);
                            return branch ? (branch.name || branch.branchName) : user.branchId;
                          })() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Showing {users.length > 0 ? startIndex : 0} to {Math.min(endIndex, startIndex + users.length - 1)} of {totalUsers} users
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Rows per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || users.length < itemsPerPage}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <Modal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          title="Filter Users"
          size="md"
        >
          <div className="space-y-4">
            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Roles</option>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Branch Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
              <select
                value={filters.branch}
                onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name || branch.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={handleResetFilters}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                onClick={handleApplyFilters}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => {
            setShowUserDetails(false);
            setSelectedUser(null);
          }}
          onEdit={() => {
            toast.error('You do not have permission to edit users. Please contact a System Administrator.');
          }}
        />
      )}
    </div>
  );
};

export default UsersView;
