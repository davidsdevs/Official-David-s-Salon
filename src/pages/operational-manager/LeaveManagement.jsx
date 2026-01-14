/**
 * Leave Management Page - Operational Manager
 * Approve/reject leave requests from branch managers
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Search, 
  Filter, 
  Building2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBranchManagerLeaveRequests, 
  approveLeaveRequest, 
  rejectLeaveRequest,
  LEAVE_TYPES 
} from '../../services/leaveManagementService';
import { getBranches } from '../../services/branchService';
import { formatDate, getFullName } from '../../utils/helpers';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RejectLeaveModal from '../../components/leave/RejectLeaveModal';
import toast from 'react-hot-toast';

const OperationalManagerLeaveManagement = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [userCache, setUserCache] = useState({});
  const [branchCache, setBranchCache] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  // Load branches on mount
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const allBranches = await getBranches();
        const branchMap = {};
        allBranches.forEach(branch => {
          branchMap[branch.id] = branch.name || branch.branchName || `Branch ${branch.id.substring(0, 8)}`;
        });
        setBranchCache(branchMap);
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    };
    loadBranches();
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const requests = await getBranchManagerLeaveRequests();
      
      // Build user cache from request data
      const newUserCache = {};
      requests.forEach(req => {
        if (req.employeeId && req.employeeName) {
          newUserCache[req.employeeId] = { 
            firstName: req.employeeName.split(' ')[0], 
            lastName: req.employeeName.split(' ').slice(1).join(' ') 
          };
        }
      });
      setUserCache(prev => ({ ...prev, ...newUserCache }));
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter(request => {
      // Status filter
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && request.type !== typeFilter) {
        return false;
      }

      // Branch filter
      if (branchFilter !== 'all' && request.branchId !== branchFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const employeeName = getEmployeeName(request.employeeId).toLowerCase();
        const branchName = getBranchName(request.branchId).toLowerCase();
        if (!employeeName.includes(searchLower) && !branchName.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [leaveRequests, searchTerm, statusFilter, typeFilter, branchFilter]);

  // Get unique branches from requests
  const uniqueBranches = [...new Set(leaveRequests.map(r => r.branchId).filter(Boolean))];

  // Stats
  const stats = useMemo(() => ({
    pending: leaveRequests.filter(r => r.status === 'pending').length,
    approved: leaveRequests.filter(r => r.status === 'approved').length,
    rejected: leaveRequests.filter(r => r.status === 'rejected').length,
    total: leaveRequests.length
  }), [leaveRequests]);

  // Count active filters
  const activeFilterCount = [
    statusFilter !== 'all',
    typeFilter !== 'all',
    branchFilter !== 'all'
  ].filter(Boolean).length;

  // Clear filters
  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setBranchFilter('all');
    setSearchTerm('');
  };

  const getEmployeeName = (employeeId) => {
    const user = userCache[employeeId];
    return user ? getFullName(user) : 'Unknown';
  };

  const getBranchName = (branchId) => {
    return branchCache[branchId] || 'Unknown Branch';
  };

  const getLeaveTypeInfo = (type) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0];
  };

  const handleApprove = async (request) => {
    try {
      setProcessing(request.id);
      await approveLeaveRequest(request.id, currentUser);
      await fetchLeaveRequests();
      setProcessing(null);
    } catch (error) {
      setProcessing(null);
    }
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async (reason) => {
    if (!selectedRequest) return;
    
    try {
      setProcessing(selectedRequest.id);
      await rejectLeaveRequest(selectedRequest.id, reason, currentUser);
      await fetchLeaveRequests();
      setShowRejectModal(false);
      setSelectedRequest(null);
      setProcessing(null);
    } catch (error) {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branch Manager Leave Management</h1>
        <p className="text-gray-600">Review and approve leave requests from branch managers</p>
      </div>

      {/* Stats Cards - 3 cards with icons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              <p className="text-xs text-gray-500 mt-1">This period</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs text-gray-500 mt-1">This period</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar Row - Visual Hierarchy */}
      <Card className="p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          {/* Search Bar - ~70% width */}
          <div className="flex-1 max-w-[70%]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or branch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
              />
            </div>
          </div>

          {/* Status Quick Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#160B53]"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Icon-only Buttons - No borders */}
          <button
            onClick={() => setShowFilterModal(true)}
            className="p-2 relative text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded-lg transition-colors"
            title="More Filters"
          >
            <Filter className="h-5 w-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#160B53] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {filteredRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={fetchLeaveRequests}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {/* Leave Requests Table */}
      <Card className="overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No leave requests found</p>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-[#160B53] hover:underline text-sm"
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRequests.map(request => {
                  const typeInfo = getLeaveTypeInfo(request.type);
                  const employeeName = request.employeeName || getEmployeeName(request.employeeId);
                  const branchName = getBranchName(request.branchId);
                  const isPending = request.status === 'pending';

                  return (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#160B53] rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {employeeName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{employeeName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Building2 className="w-4 h-4" />
                          <span>{branchName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color || 'bg-gray-100 text-gray-700'}`}>
                          {typeInfo?.label || request.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(request.startDate)} - {formatDate(request.endDate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">{request.days}</span>
                        <span className="text-gray-500 text-sm ml-1">day{request.days !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleApprove(request)}
                              disabled={processing === request.id}
                              className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="Approve"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(request)}
                              disabled={processing === request.id}
                              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Reject"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {request.reviewedByName ? `by ${request.reviewedByName}` : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Filter Leave Requests</h2>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                >
                  <option value="all">All Types</option>
                  {LEAVE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                >
                  <option value="all">All Branches</option>
                  {uniqueBranches.map(branchId => (
                    <option key={branchId} value={branchId}>
                      {branchCache[branchId] || 'Unknown Branch'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Results Count */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-[#160B53]">{filteredRequests.length}</span> of {leaveRequests.length} requests
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="px-4 py-2 text-sm bg-[#160B53] text-white rounded-lg hover:bg-[#12094A] transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      <RejectLeaveModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedRequest(null);
        }}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
};

export default OperationalManagerLeaveManagement;














