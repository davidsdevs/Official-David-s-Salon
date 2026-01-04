/**
 * Leave Management Page - Branch Manager
 * Manage leave requests for stylists and request own leave
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar, Plus, CheckCircle, XCircle, Clock, User, Search, Filter, UserPlus, Printer, X, ArrowUpDown, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getLeaveRequestsByBranch, 
  saveLeaveRequest, 
  approveLeaveRequest, 
  rejectLeaveRequest,
  cancelLeaveRequest,
  LEAVE_TYPES 
} from '../../services/leaveManagementService';
import { getAppointmentsByStylist, APPOINTMENT_STATUS } from '../../services/appointmentService';
import { getUsersByBranch, getUserById } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { formatDate, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import LeaveRequestModal from '../../components/leave/LeaveRequestModal';
import RejectLeaveModal from '../../components/leave/RejectLeaveModal';

const LeaveManagement = () => {
  const { currentUser, userBranch, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isForStaff, setIsForStaff] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);
  
  // Print ref
  const printRef = useRef();

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Leave Management | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Sorting
  const [sortBy, setSortBy] = useState('requestedAt'); // 'requestedAt', 'startDate', 'endDate', 'employeeName', 'status', 'type'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  
  // Debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    if (userBranch) {
      fetchLeaveRequests();
      fetchStaffMembers();
      fetchBranchInfo();
    }
  }, [userBranch]);

  const fetchBranchInfo = async () => {
    try {
      const branch = await getBranchById(userBranch);
      setBranchInfo(branch);
    } catch (error) {
      console.error('Error fetching branch info:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const requests = await getLeaveRequestsByBranch(userBranch);
      setLeaveRequests(requests || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests. Please try again.');
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const staff = await getUsersByBranch(userBranch);
      // Get all staff (not just stylists) for filtering
      const allStaff = (staff || []).filter(s => {
        const userRoles = s.roles || (s.role ? [s.role] : []);
        return userRoles.some(role => ['stylist', 'receptionist', 'inventory_controller'].includes(role));
      });
      setStaffMembers(allStaff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff members.');
      setStaffMembers([]);
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get employee name helper - defined before useMemo
  const getEmployeeName = useCallback((employeeId) => {
    if (!employeeId) return 'Unknown';
    if (!currentUser) return 'Unknown';
    if (employeeId === currentUser.uid) {
      return getFullName(userData) || currentUser.displayName || 'Me';
    }
    if (!staffMembers || staffMembers.length === 0) return 'Unknown';
    const staff = staffMembers.find(s => (s.id === employeeId) || (s.uid === employeeId));
    return staff ? getFullName(staff) : 'Unknown';
  }, [currentUser, userData, staffMembers]);

  const filteredAndSortedRequests = useMemo(() => {
    if (!leaveRequests || leaveRequests.length === 0) return [];
    if (!currentUser || !userBranch) return [];
    
    let filtered = leaveRequests.filter(request => {
      if (!request) return false;
      
      // Search filter
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        try {
          const employeeName = getEmployeeName(request.employeeId || '').toLowerCase();
          if (!employeeName.includes(searchLower)) {
            return false;
          }
        } catch (e) {
          console.error('Error getting employee name:', e);
          return false;
        }
      }

      // Status filter (supports combined rejected/cancelled)
      if (statusFilter !== 'all') {
        if (statusFilter === 'rejected_cancelled') {
          if (request.status !== 'rejected' && request.status !== 'cancelled') {
            return false;
          }
        } else if (request.status !== statusFilter) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && request.type !== typeFilter) {
        return false;
      }

      // Staff filter
      if (staffFilter !== 'all' && request.employeeId !== staffFilter) {
        return false;
      }

      // Branch manager can see:
      // 1. Stylist requests (requests that don't require operational approval - they approve these)
      // 2. Their own requests (regardless of status or requiresOperationalApproval) - including cancelled/pending/approved
      // 3. All requests in their branch (to see all leave activity for their branch)
      const isStylistRequest = !request.requiresOperationalApproval;
      const isOwnRequest = request.employeeId === currentUser.uid;
      const isInSameBranch = request.branchId === userBranch;
      
      // Show if: stylist request (for approval), own request (to see status), or in same branch (visibility)
      return isStylistRequest || isOwnRequest || isInSameBranch;
    });

    // Sorting
    try {
      filtered.sort((a, b) => {
        if (!a || !b) return 0;
        let aValue, bValue;
        
        switch (sortBy) {
          case 'requestedAt':
            aValue = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt || 0);
            bValue = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt || 0);
            break;
          case 'startDate':
            aValue = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate || 0);
            bValue = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate || 0);
            break;
          case 'endDate':
            aValue = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate || 0);
            bValue = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate || 0);
            break;
          case 'employeeName':
            try {
              aValue = getEmployeeName(a.employeeId || '').toLowerCase();
              bValue = getEmployeeName(b.employeeId || '').toLowerCase();
            } catch (e) {
              aValue = '';
              bValue = '';
            }
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
            break;
          case 'type':
            aValue = a.type || '';
            bValue = b.type || '';
            break;
          default:
            aValue = a[sortBy] || '';
            bValue = b[sortBy] || '';
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    } catch (error) {
      console.error('Error sorting requests:', error);
    }

    return filtered || [];
  }, [leaveRequests, debouncedSearchTerm, statusFilter, typeFilter, staffFilter, sortBy, sortOrder, currentUser, userBranch, staffMembers, userData, getEmployeeName]);

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Pagination calculations
  const paginationData = useMemo(() => {
    const totalItems = filteredAndSortedRequests.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRequests = filteredAndSortedRequests.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      paginatedRequests
    };
  }, [filteredAndSortedRequests, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, typeFilter, staffFilter, sortBy, sortOrder]);


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

  const handleCancel = async (request) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    
    try {
      setProcessing(request.id);
      await cancelLeaveRequest(request.id, currentUser);
      await fetchLeaveRequests();
      setProcessing(null);
    } catch (error) {
      setProcessing(null);
    }
  };

  const handleRequestLeave = (forStaff = false) => {
    setIsForStaff(forStaff);
    setSelectedRequest(null);
    setShowRequestModal(true);
  };

  const handleSubmitLeave = async (leaveData) => {
    try {
      // If requesting for staff, use their ID; otherwise use current user's ID
      const employeeId = isForStaff ? leaveData.employeeId : currentUser.uid;
      
      // Check for conflicting appointments (pending/confirmed/in_service) in date range
      if (employeeId && leaveData.startDate && leaveData.endDate) {
        const start = new Date(leaveData.startDate);
        const end = new Date(leaveData.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const appointments = await getAppointmentsByStylist(employeeId);
        const activeConflicts = appointments.filter((apt) => {
          if (!apt.appointmentDate) return false;
          const aptDate = apt.appointmentDate instanceof Date ? apt.appointmentDate : new Date(apt.appointmentDate);
          const status = apt.status;
          const isActiveStatus = status !== APPOINTMENT_STATUS.CANCELLED && status !== APPOINTMENT_STATUS.COMPLETED && status !== APPOINTMENT_STATUS.NO_SHOW;
          return isActiveStatus && aptDate >= start && aptDate <= end;
        });

        if (activeConflicts.length > 0) {
          const sample = activeConflicts.slice(0, 3).map(apt => {
            const d = apt.appointmentDate instanceof Date ? apt.appointmentDate : new Date(apt.appointmentDate);
            return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          }).join(', ');
          toast.error(`Cannot file leave: ${activeConflicts.length} active appointment(s) in this date range. ${sample ? 'Conflicts: ' + sample : ''}`);
          return;
        }
      }
      
      // Pass userData so the service can check if current user is branch manager
      await saveLeaveRequest({
        ...leaveData,
        employeeId,
        branchId: userBranch,
      }, currentUser, userData);
      
      await fetchLeaveRequests();
      setShowRequestModal(false);
      setIsForStaff(false);
    } catch (error) {
      console.error('Error submitting leave:', error);
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

  // Print handler
  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }

    setTimeout(() => {
      if (!printRef.current) {
        toast.error('Print content not ready. Please try again.');
        return;
      }

      const printContentHTML = printRef.current.innerHTML;
      
      let styles = '';
      try {
        styles = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              return Array.from(sheet.cssRules || [])
                .map((rule) => rule.cssText)
                .join('\n');
            } catch (e) {
              return '';
            }
          })
          .join('\n');
      } catch (e) {
        console.warn('Could not extract all styles:', e);
      }

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the leave report');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Leave Report - ${new Date().toISOString().split('T')[0]}</title>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
            ${styles}
            @media print {
              @page {
                size: A4;
                margin: 0.75in;
              }
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
              color: #000;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid #000;
              padding: 10px 8px;
            }
            th {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          ${printContentHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  setTimeout(function() {
                    window.close();
                  }, 100);
                };
                setTimeout(function() {
                  if (!window.closed) {
                    window.close();
                  }
                }, 30000);
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      
      printWindow.document.close();
    }, 100);
  };

  const pendingRequests = filteredAndSortedRequests.filter(r => r.status === 'pending');
  const approvedRequests = filteredAndSortedRequests.filter(r => r.status === 'approved');
  const rejectedRequests = filteredAndSortedRequests.filter(r => r.status === 'rejected');
  const cancelledRequests = filteredAndSortedRequests.filter(r => r.status === 'cancelled');

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-600">Manage leave requests for your branch</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-5 h-5" />
            Print Report
          </button>
          <button
            onClick={() => handleRequestLeave(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Leave for Staff
          </button>
          <button
            onClick={() => handleRequestLeave(false)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Request My Leave
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{pendingRequests.length}</p>
            </div>
            <div className="p-3">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{approvedRequests.length}</p>
            </div>
            <div className="p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{rejectedRequests.length}</p>
            </div>
            <div className="p-3">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cancelled</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">{cancelledRequests.length}</p>
            </div>
            <div className="p-3">
              <X className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{filteredAndSortedRequests.length}</p>
            </div>
            <div className="p-3">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Filters</span>
            {(statusFilter !== 'all' || typeFilter !== 'all' || staffFilter !== 'all' || debouncedSearchTerm) && (
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                Active
              </span>
            )}
          </div>
          {showFilters ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
        </button>
        
        {showFilters && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by employee name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Staff Filter - Prominent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Staff Member <span className="text-[#160B53]">*</span>
                </label>
                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Staff</option>
                  <option value={currentUser.uid}>Me ({getFullName(userData) || currentUser.displayName || 'My Requests'})</option>
                  {staffMembers.map(staff => {
                    const staffId = staff.id || staff.uid;
                    return (
                      <option key={staffId} value={staffId}>
                        {getFullName(staff)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected_cancelled">Rejected + Cancelled</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leave Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  {LEAVE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Items Per Page */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Items Per Page
                </label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>

            {/* Clear Filters Button */}
            {(statusFilter !== 'all' || typeFilter !== 'all' || staffFilter !== 'all' || debouncedSearchTerm) && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                    setStaffFilter('all');
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Leave Requests</h2>
            <div className="text-sm text-gray-600">
              Showing {paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} results
              {paginationData.totalItems > 1000 && (
                <span className="ml-2 text-blue-600 font-medium">
                  (Large dataset - use filters to narrow results)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('employeeName')}>
                  <div className="flex items-center gap-1">
                    Employee
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('type')}>
                  <div className="flex items-center gap-1">
                    Type
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('startDate')}>
                  <div className="flex items-center gap-1">
                    Start Date
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('endDate')}>
                  <div className="flex items-center gap-1">
                    End Date
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Days</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('requestedAt')}>
                  <div className="flex items-center gap-1">
                    Requested
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginationData.paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-lg font-medium text-gray-900 mb-2">No leave requests found</p>
                    <p className="text-sm text-gray-500">
                      {filteredAndSortedRequests.length === 0 
                        ? "Try adjusting your search or filter criteria"
                        : "No requests match your current filters"
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                paginationData.paginatedRequests.map(request => {
                  const typeInfo = getLeaveTypeInfo(request.type);
                  const employeeName = getEmployeeName(request.employeeId);
                  const isOwnRequest = request.employeeId === currentUser.uid;
                  const isPending = request.status === 'pending';
                  
                  const canApprove = isPending && !isOwnRequest && !request.requiresOperationalApproval;
                  const canCancel = isPending && (isOwnRequest || request.submittedBy === currentUser.uid);

                  return (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{employeeName}</div>
                            <div className="flex items-center gap-1 mt-1">
                              {isOwnRequest && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">My Request</span>
                              )}
                              {request.requiresOperationalApproval && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Pending Ops Mgr</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(request.startDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(request.endDate)}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">{request.days || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                          {request.status === 'pending' && <Clock className="h-3 w-3" />}
                          {request.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                          {request.status === 'rejected' && <XCircle className="h-3 w-3" />}
                          {request.status === 'cancelled' && <X className="h-3 w-3" />}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700 max-w-xs truncate" title={request.reason || 'N/A'}>
                          {request.reason || 'N/A'}
                        </div>
                        {request.status === 'rejected' && request.rejectionReason && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={request.rejectionReason}>
                            Rejected: {request.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(request.requestedAt)}
                        {request.reviewedAt && (
                          <div className="text-xs text-gray-400 mt-1">
                            Reviewed: {formatDate(request.reviewedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canApprove && (
                            <>
                              <button
                                onClick={() => handleApprove(request)}
                                disabled={processing === request.id}
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs flex items-center gap-1"
                                title="Approve"
                              >
                                <CheckCircle className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleReject(request)}
                                disabled={processing === request.id}
                                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-xs flex items-center gap-1"
                                title="Reject"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(request)}
                              disabled={processing === request.id}
                              className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 text-xs"
                              title="Cancel"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {paginationData.totalItems > 0 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                Page <span className="font-medium">{currentPage}</span> of{' '}
                <span className="font-medium">{paginationData.totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(paginationData.totalPages, prev + 1))}
                  disabled={currentPage === paginationData.totalPages}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <LeaveRequestModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setIsForStaff(false);
        }}
        onSubmit={handleSubmitLeave}
        staffMembers={isForStaff ? staffMembers : []}
        isForStaff={isForStaff}
        currentUserId={currentUser.uid}
      />

      <RejectLeaveModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedRequest(null);
        }}
        onConfirm={handleRejectConfirm}
      />

      {/* Hidden Print Component */}
      <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 0.75in;
            }
            * {
              color: #000 !important;
              background: transparent !important;
            }
          }
        `}</style>
        <div className="print-content" style={{ 
          fontFamily: "'Poppins', sans-serif",
          color: '#000',
          background: '#fff',
          padding: '20px'
        }}>
          {/* Header */}
          <div style={{ 
            textAlign: 'center',
            marginBottom: '30px',
            borderBottom: '2px solid #000',
            paddingBottom: '15px'
          }}>
            <h1 style={{ 
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '10px',
              letterSpacing: '1px'
            }}>
              LEAVE MANAGEMENT REPORT
            </h1>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
              {branchInfo?.branchName || branchInfo?.name || 'Branch'}
            </div>
            <div style={{ 
              fontSize: '11px',
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <div style={{ textAlign: 'left' }}>
                <div>Printed by: {currentUser ? getFullName(currentUser) : 'Manager'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Printed: {new Date().toLocaleString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ 
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px'
          }}>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{pendingRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Pending</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{approvedRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Approved</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{rejectedRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Rejected</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{cancelledRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Cancelled</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{filteredAndSortedRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Total</div>
            </div>
          </div>

          {/* Leave Requests Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #000',
            fontSize: '11px'
          }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Employee</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Type</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Start Date</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>End Date</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Days</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Status</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ border: '1px solid #000', padding: '20px', textAlign: 'center' }}>
                    No leave requests found
                  </td>
                </tr>
              ) : (
                filteredAndSortedRequests.map((request, idx) => {
                  const typeInfo = getLeaveTypeInfo(request.type);
                  const employeeName = getEmployeeName(request.employeeId);
                  const isOwnRequest = request.employeeId === currentUser.uid;
                  
                  // Status colors
                  let statusBg = '#fef3c7';
                  let statusText = '#854d0e';
                  if (request.status === 'approved') {
                    statusBg = '#d1fae5';
                    statusText = '#065f46';
                  } else if (request.status === 'rejected') {
                    statusBg = '#fee2e2';
                    statusText = '#991b1b';
                  } else if (request.status === 'cancelled') {
                    statusBg = '#f3f4f6';
                    statusText = '#374151';
                  }

                  return (
                    <tr key={request.id} style={{ pageBreakInside: 'avoid' }}>
                      <td style={{ border: '1px solid #000', padding: '10px 8px' }}>
                        {employeeName}
                        {isOwnRequest && <span style={{ fontSize: '9px', color: '#666', display: 'block' }}>(My Request)</span>}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{typeInfo.label}</td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{formatDate(request.startDate, 'MMM dd, yyyy')}</td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{formatDate(request.endDate, 'MMM dd, yyyy')}</td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{request.days || 'N/A'}</td>
                      <td style={{ 
                        border: '1px solid #000', 
                        padding: '10px 8px', 
                        textAlign: 'center',
                        backgroundColor: statusBg,
                        color: statusText,
                        fontWeight: '600'
                      }}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', fontSize: '10px' }}>
                        {request.reason || 'N/A'}
                        {request.status === 'rejected' && request.rejectionReason && (
                          <div style={{ marginTop: '5px', color: '#991b1b', fontSize: '9px' }}>
                            Rejection: {request.rejectionReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="mt-4 pt-2 border-t border-black text-center" style={{ fontSize: '11px', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #000' }}>
            <p>Total: {filteredAndSortedRequests.length} | Pending: {pendingRequests.length} | Approved: {approvedRequests.length} | Rejected: {rejectedRequests.length} | Cancelled: {cancelledRequests.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveManagement;

