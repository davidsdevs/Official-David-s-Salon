/**
 * Branches Management Page - Operational Manager
 * For Operational Manager to manage all branches
 */

import { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Mail, User, Power, Edit, Eye, TrendingUp } from 'lucide-react';
import { getAllBranches, toggleBranchStatus, getBranchStats } from '../../services/branchService';
import { useAuth } from '../../context/AuthContext';
import { getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BranchFormModal from '../../components/branch/BranchFormModal';
import BranchDetailsModal from '../../components/branch/BranchDetailsModal';
import toast from 'react-hot-toast';

const OperationalManagerBranches = () => {
  const { currentUser } = useAuth();
  const [branches, setBranches] = useState([]);
  const [filteredBranches, setFilteredBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchStats, setBranchStats] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [viewBranch, setViewBranch] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [branches, searchTerm, statusFilter]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const data = await getAllBranches();
      setBranches(data);
      
      // Fetch stats for each branch
      const stats = {};
      for (const branch of data) {
        const branchStat = await getBranchStats(branch.id);
        stats[branch.id] = branchStat;
      }
      setBranchStats(stats);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
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

  const handleToggleStatus = async (branchId, currentIsActive) => {
    try {
      setToggling(branchId);
      const newStatus = !currentIsActive; // Toggle boolean
      await toggleBranchStatus(branchId, newStatus, currentUser);
      await fetchBranches();
    } catch (error) {
      // Error handled in service
    } finally {
      setToggling(null);
    }
  };

  const handleFormSave = () => {
    fetchBranches();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Calculate overall stats
  const totalBranches = branches.length;
  const activeBranches = branches.filter(b => b.isActive === true).length;
  const inactiveBranches = branches.filter(b => b.isActive === false).length;
  const totalStaff = Object.values(branchStats).reduce((sum, stat) => sum + (stat?.staffCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
          <p className="text-gray-600">Manage and monitor all salon branches</p>
        </div>
        <button
          onClick={handleAddBranch}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Branch
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Branches</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalBranches}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <MapPin className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Branches</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeBranches}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive Branches</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{inactiveBranches}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <Power className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalStaff}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBranches.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow border border-gray-200">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No branches found</p>
          </div>
        ) : (
          filteredBranches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {branch.name || branch.branchName}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    branch.isActive === true 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {branch.isActive === true ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{branch.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{branch.contact}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{branch.email}</span>
                </div>
              </div>

              {/* Stats */}
              {branchStats[branch.id] && (
                <div className="grid grid-cols-3 gap-2 mb-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Staff</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {branchStats[branch.id].staffCount || 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Appointments</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {branchStats[branch.id].appointmentsCount || 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Inventory</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {branchStats[branch.id].inventoryCount || 0}
                    </p>
                  </div>
                </div>
              )}

              {/* Manager */}
              {branch.managerName && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
                  <User className="w-4 h-4" />
                  <div>
                    <p className="text-xs text-gray-500">Branch Manager</p>
                    <p className="font-medium text-gray-900">{branch.managerName}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewBranch(branch)}
                    disabled={toggling === branch.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-primary-300 text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleEditBranch(branch)}
                    disabled={toggling === branch.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleStatus(branch.id, branch.isActive)}
                    disabled={toggling === branch.id}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      branch.isActive === true
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {toggling === branch.id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                    {toggling === branch.id ? 'Processing...' : (branch.isActive === true ? 'Deactivate' : 'Activate')}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Branch Form Modal */}
      {showFormModal && (
        <BranchFormModal
          branch={selectedBranch}
          onClose={() => setShowFormModal(false)}
          onSave={handleFormSave}
        />
      )}

      {/* Branch Details Modal */}
      {showDetailsModal && viewBranch && (
        <BranchDetailsModal
          branch={viewBranch}
          stats={branchStats[viewBranch.id]}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
};

export default OperationalManagerBranches;
