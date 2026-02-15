/**
 * Staff Lending Management Page
 * View and manage stylist lending requests
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle, XCircle, Clock, Building2, User, Calendar, Plus, Search, Filter, ChevronLeft, ChevronRight, Printer, Download } from 'lucide-react';
import PDFPreviewModal from '../../components/ui/PDFPreviewModal';
import { getLendingRequests, approveLendingRequest, rejectLendingRequest, cancelLendingRequest, getActiveLendingFromBranch, getActiveLendingForBranch } from '../../services/stylistLendingService';
import { getBranchById } from '../../services/branchService';
import { getUserById } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { formatDate, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LendStylistModal from '../../components/branch/LendStylistModal';
import ApproveLendingModal from '../../components/branch/ApproveLendingModal';
import toast from 'react-hot-toast';

const StaffLending = () => {
  const { currentUser, userBranch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [branchCache, setBranchCache] = useState({});
  const [stylistCache, setStylistCache] = useState({});
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [requestToApprove, setRequestToApprove] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);
  const [lentOutStylists, setLentOutStylists] = useState([]); // Stylists lent OUT from this branch
  const [lentInStylists, setLentInStylists] = useState([]); // Stylists lent TO this branch
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Print ref
  const printRef = useRef();
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  
  // Big Data Optimizations
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterModalLocal, setShowFilterModalLocal] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'incoming', 'outgoing'
  const [branchFilter, setBranchFilter] = useState('all'); // 'all' or specific branchId
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' }); // Date range filter
  const [sortBy, setSortBy] = useState('requestedAt'); // 'requestedAt', 'startDate', 'status'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [showBranchStats, setShowBranchStats] = useState(false); // Toggle branch history view
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleEndIndex, setVisibleEndIndex] = useState(10);

  useEffect(() => {
    if (userBranch) {
      fetchRequests();
      fetchBranchInfo();
      fetchLendingDataForPrint();
    }
  }, [userBranch]);

  // PDF Preview modal
  {/** Rendered at bottom of component JSX via showPDFPreview state */}

  const fetchBranchInfo = async () => {
    try {
      const branch = await getBranchById(userBranch);
      setBranchInfo(branch);
    } catch (error) {
      console.error('Error fetching branch info:', error);
    }
  };

  const fetchLendingDataForPrint = async () => {
    if (!userBranch) return;
    
    try {
      // Get stylists lent OUT from this branch
      const lentOut = await getActiveLendingFromBranch(userBranch, null);
      const lentOutWithDetails = await Promise.all(
        lentOut.map(async (lending) => {
          try {
            const stylist = await getUserById(lending.stylistId);
            const toBranch = await getBranchById(lending.toBranchId);
            return {
              ...lending,
              stylistName: getFullName(stylist),
              stylistEmail: stylist.email,
              toBranchName: toBranch?.branchName || toBranch?.name || 'Unknown Branch'
            };
          } catch (error) {
            return null;
          }
        })
      );
      setLentOutStylists(lentOutWithDetails.filter(l => l !== null));

      // Get stylists lent TO this branch
      const lentIn = await getActiveLendingForBranch(userBranch, null);
      const lentInWithDetails = await Promise.all(
        lentIn.map(async (lending) => {
          try {
            const stylist = await getUserById(lending.stylistId);
            const fromBranch = await getBranchById(lending.fromBranchId);
            return {
              ...lending,
              stylistName: getFullName(stylist),
              stylistEmail: stylist.email,
              fromBranchName: fromBranch?.branchName || fromBranch?.name || 'Unknown Branch'
            };
          } catch (error) {
            return null;
          }
        })
      );
      setLentInStylists(lentInWithDetails.filter(l => l !== null));
    } catch (error) {
      console.error('Error fetching lending data for print:', error);
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
      setVisibleStartIndex(0);
      setVisibleEndIndex(itemsPerPage);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, itemsPerPage]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const lendingRequests = await getLendingRequests(userBranch);
      setRequests(lendingRequests);
      
      // Fetch branch and stylist info
      const branchIds = new Set();
      const stylistIds = new Set();
      
      lendingRequests.forEach(req => {
        if (req.fromBranchId) branchIds.add(req.fromBranchId);
        if (req.toBranchId) branchIds.add(req.toBranchId);
        if (req.stylistId) stylistIds.add(req.stylistId);
      });

      // Fetch branches
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

      // Fetch stylists
      const stylistPromises = Array.from(stylistIds).map(async (id) => {
        if (!stylistCache[id]) {
          try {
            const stylist = await getUserById(id);
            return { id, stylist };
          } catch (error) {
            return { id, stylist: null };
          }
        }
        return null;
      });
      
      const stylistResults = await Promise.all(stylistPromises);
      const newStylistCache = { ...stylistCache };
      stylistResults.forEach(result => {
        if (result && result.stylist) {
          newStylistCache[result.id] = result.stylist;
        }
      });
      setStylistCache(newStylistCache);
    } catch (error) {
      console.error('Error fetching lending requests:', error);
      toast.error('Failed to load lending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request) => {
    // Open approval modal instead of directly approving
    setRequestToApprove(request);
    setShowApproveModal(true);
  };
  
  const handleApproveComplete = async () => {
    await fetchRequests();
    setShowApproveModal(false);
    setRequestToApprove(null);
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessing(selectedRequest.id);
      await rejectLendingRequest(selectedRequest.id, rejectionReason, currentUser);
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      await fetchRequests();
    } catch (error) {
      // Error handled in service
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (request) => {
    if (!confirm('Are you sure you want to cancel this lending request?')) return;
    
    try {
      setProcessing(request.id);
      await cancelLendingRequest(request.id, currentUser);
      await fetchRequests();
    } catch (error) {
      // Error handled in service
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    if (status === 'approved') return <CheckCircle className="w-4 h-4" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  // Memoized filtered and sorted requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(req => {
        const stylist = stylistCache[req.stylistId];
        const stylistName = stylist ? getFullName(stylist).toLowerCase() : '';
        const stylistEmail = stylist?.email?.toLowerCase() || '';
        const branch = branchCache[req.fromBranchId] || branchCache[req.toBranchId];
        const branchName = branch?.branchName?.toLowerCase() || branch?.name?.toLowerCase() || '';
        const reason = req.reason?.toLowerCase() || '';
        const status = req.status?.toLowerCase() || '';
        
        return stylistName.includes(searchLower) ||
               stylistEmail.includes(searchLower) ||
               branchName.includes(searchLower) ||
               reason.includes(searchLower) ||
               status.includes(searchLower);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(req => req.type === typeFilter);
    }

    // Branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(req => 
        req.fromBranchId === branchFilter || req.toBranchId === branchFilter
      );
    }

    // Date range filter
    if (dateFilter.startDate || dateFilter.endDate) {
      filtered = filtered.filter(req => {
        const requestDate = req.requestedAt?.toDate ? req.requestedAt.toDate() : new Date(req.requestedAt || 0);
        const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
        const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
        
        if (startDate && endDate) {
          return requestDate >= startDate && requestDate <= endDate;
        } else if (startDate) {
          return requestDate >= startDate;
        } else if (endDate) {
          return requestDate <= endDate;
        }
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'requestedAt') {
        aValue = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt || 0);
        bValue = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt || 0);
      } else if (sortBy === 'startDate') {
        aValue = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate || 0);
        bValue = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate || 0);
      } else {
        aValue = a[sortBy] || '';
        bValue = b[sortBy] || '';
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [requests, debouncedSearchTerm, statusFilter, typeFilter, branchFilter, dateFilter, sortBy, sortOrder, branchCache, stylistCache]);

  // CSV Export for lending requests
  const exportToCSV = () => {
    if (!filteredRequests || filteredRequests.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = filteredRequests.map(req => {
      const stylist = stylistCache[req.stylistId];
      const fromBranch = branchCache[req.fromBranchId];
      const toBranch = branchCache[req.toBranchId];
      return {
        'Request ID': req.id || req.requestId || '',
        'Stylist': stylist ? getFullName(stylist) : (req.stylistName || ''),
        'Type': req.type || '',
        'From Branch': fromBranch?.branchName || fromBranch?.name || '',
        'To Branch': toBranch?.branchName || toBranch?.name || '',
        'Start Date': req.startDate ? (req.startDate.toDate ? req.startDate.toDate().toISOString() : new Date(req.startDate).toISOString()) : '',
        'End Date': req.endDate ? (req.endDate.toDate ? req.endDate.toDate().toISOString() : new Date(req.endDate).toISOString()) : '',
        'Status': req.status || '',
        'Requested At': req.requestedAt ? (req.requestedAt.toDate ? req.requestedAt.toDate().toISOString() : new Date(req.requestedAt).toISOString()) : '',
        'Reason': req.reason || ''
      };
    });

    const csvHeaders = Object.keys(exportData[0] || {});
    const csvRows = [
      csvHeaders.join(','),
      ...exportData.map(row => csvHeaders.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `Lending_Requests_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Get unique branches for filter dropdown
  const uniqueBranches = useMemo(() => {
    const branches = new Map();
    requests.forEach(req => {
      if (req.fromBranchId && branchCache[req.fromBranchId]) {
        branches.set(req.fromBranchId, branchCache[req.fromBranchId].branchName || branchCache[req.fromBranchId].name || 'Unknown');
      }
      if (req.toBranchId && branchCache[req.toBranchId]) {
        branches.set(req.toBranchId, branchCache[req.toBranchId].branchName || branchCache[req.toBranchId].name || 'Unknown');
      }
    });
    return Array.from(branches.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests, branchCache]);

  // Branch statistics - count lending by branch
  const branchStatistics = useMemo(() => {
    const stats = {};
    
    requests.forEach(req => {
      // Count staff lent OUT (to other branches)
      if (req.type === 'outgoing' && req.toBranchId) {
        const branchName = branchCache[req.toBranchId]?.branchName || branchCache[req.toBranchId]?.name || 'Unknown';
        if (!stats[req.toBranchId]) {
          stats[req.toBranchId] = { 
            name: branchName, 
            lentTo: 0, 
            borrowedFrom: 0,
            pending: 0,
            approved: 0,
            active: 0,
            completed: 0
          };
        }
        stats[req.toBranchId].lentTo++;
        if (req.status === 'pending') stats[req.toBranchId].pending++;
        if (req.status === 'approved') stats[req.toBranchId].approved++;
        if (req.status === 'active') stats[req.toBranchId].active++;
        if (req.status === 'completed') stats[req.toBranchId].completed++;
      }
      
      // Count staff borrowed FROM (from other branches)
      if (req.type === 'incoming' && req.fromBranchId) {
        const branchName = branchCache[req.fromBranchId]?.branchName || branchCache[req.fromBranchId]?.name || 'Unknown';
        if (!stats[req.fromBranchId]) {
          stats[req.fromBranchId] = { 
            name: branchName, 
            lentTo: 0, 
            borrowedFrom: 0,
            pending: 0,
            approved: 0,
            active: 0,
            completed: 0
          };
        }
        stats[req.fromBranchId].borrowedFrom++;
        if (req.status === 'pending') stats[req.fromBranchId].pending++;
        if (req.status === 'approved') stats[req.fromBranchId].approved++;
        if (req.status === 'active') stats[req.fromBranchId].active++;
        if (req.status === 'completed') stats[req.fromBranchId].completed++;
      }
    });
    
    return Object.entries(stats).sort((a, b) => {
      const totalA = a[1].lentTo + a[1].borrowedFrom;
      const totalB = b[1].lentTo + b[1].borrowedFrom;
      return totalB - totalA;
    });
  }, [requests, branchCache]);

  // Paginated requests
  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice(visibleStartIndex, visibleEndIndex);
  }, [filteredRequests, visibleStartIndex, visibleEndIndex]);

  // PDF Preview modal for printing
  const printContent = (
    <div ref={printRef} className="p-6 bg-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.4in 0.4in 0.75in 0.4in;
          }
          body {
            counter-reset: page 1;
            font-family: 'Poppins', sans-serif;
          }
          .report-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
          }
          .company-name {
            font-size: 14pt;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .report-title {
            font-size: 18pt;
            font-weight: bold;
            margin: 0 0 10px 0;
          }
          .filters-section {
            margin-top: 10px;
            text-align: center;
            font-size: 9pt;
          }
          .filter-badge {
            display: inline-block;
            padding: 2px 8px;
            margin: 2px 4px;
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 8pt;
          }
          .report-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 8px 0.4in 0.25in 0.4in;
            border-top: 1px solid #333;
          }
          .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            font-size: 8pt;
          }
          .footer-left {
            text-align: left;
            flex: 1;
          }
          .footer-center {
            text-align: center;
            flex: 1;
          }
          .footer-right {
            text-align: right;
            flex: 1;
          }
          .page-number::before {
            content: "Page " counter(page);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background-color: #f5f5f5 !important;
            border: 1px solid #333;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 9pt;
          }
          td {
            border: 1px solid #666;
            padding: 6px 8px;
            font-size: 9pt;
          }
        }
      `}</style>
      
      {/* Header */}
      <div className="report-header">
        <div className="company-name">David Salon</div>
        <h1 className="report-title">Temporary Branch Assignment Requests</h1>
        
        {/* Active Filters */}
        <div className="filters-section">
          <strong>Active Filters:</strong>
          <span className="filter-badge">Branch: {branchInfo?.branchName || branchInfo?.name || 'Loading...'}</span>
          {statusFilter !== 'all' && (
            <span className="filter-badge">Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
          )}
          {typeFilter !== 'all' && (
            <span className="filter-badge">Type: {typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}</span>
          )}
          {branchFilter !== 'all' && (
            <span className="filter-badge">Branch Filter: {branchCache[branchFilter]?.branchName || branchCache[branchFilter]?.name || branchFilter}</span>
          )}
          {searchTerm && (
            <span className="filter-badge">Search: "{searchTerm}"</span>
          )}
          {(dateFilter.startDate || dateFilter.endDate) && (
            <span className="filter-badge">
              Date Range: {dateFilter.startDate || 'Any'} to {dateFilter.endDate || 'Any'}
            </span>
          )}
          <span className="filter-badge">Total Requests: {filteredRequests.length}</span>
        </div>
      </div>
      
      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>Stylist</th>
            <th>Type</th>
            <th>From Branch</th>
            <th>To Branch</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredRequests.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                No requests found
              </td>
            </tr>
          ) : (
            filteredRequests.map((r, i) => {
              const stylist = stylistCache[r.stylistId];
              const fromBranch = branchCache[r.fromBranchId];
              const toBranch = branchCache[r.toBranchId];
              return (
                <tr key={i}>
                  <td>{stylist ? getFullName(stylist) : (r.stylistName || 'N/A')}</td>
                  <td>{r.type === 'incoming' ? 'Incoming' : 'Outgoing'}</td>
                  <td>{fromBranch?.branchName || fromBranch?.name || 'N/A'}</td>
                  <td>{toBranch?.branchName || toBranch?.name || 'N/A'}</td>
                  <td>{r.startDate ? (r.startDate.toDate ? formatDate(r.startDate.toDate()) : formatDate(new Date(r.startDate))) : 'N/A'}</td>
                  <td>{r.endDate ? (r.endDate.toDate ? formatDate(r.endDate.toDate()) : formatDate(new Date(r.endDate))) : 'N/A'}</td>
                  <td>{r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'N/A'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      
      {/* Footer */}
      <div className="report-footer">
        <div className="footer-content">
          <div className="footer-left">
            <div>Generated by: <strong>{currentUser ? getFullName(currentUser) : 'Manager'}</strong></div>
          </div>
          <div className="footer-center">
            <span className="page-number"></span>
          </div>
          <div className="footer-right">
            <div>Generated on: <strong>{new Date().toLocaleString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Calculate pagination info
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRequests.length / itemsPerPage);
  }, [filteredRequests.length, itemsPerPage]);

  const currentPageNumber = useMemo(() => {
    return Math.floor(visibleStartIndex / itemsPerPage) + 1;
  }, [visibleStartIndex, itemsPerPage]);

  // Load more items
  const loadMore = useCallback(() => {
    if (visibleEndIndex < filteredRequests.length) {
      setVisibleEndIndex(prev => Math.min(prev + itemsPerPage, filteredRequests.length));
    }
  }, [filteredRequests.length, itemsPerPage, visibleEndIndex]);

  // Navigate pages
  const goToPage = useCallback((page) => {
    const start = (page - 1) * itemsPerPage;
    setVisibleStartIndex(start);
    setVisibleEndIndex(Math.min(start + itemsPerPage, filteredRequests.length));
    setCurrentPage(page);
  }, [itemsPerPage, filteredRequests.length]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setBranchFilter('all');
    setDateFilter({ startDate: '', endDate: '' });
    setSortBy('requestedAt');
    setSortOrder('desc');
    setCurrentPage(1);
    setVisibleStartIndex(0);
    setVisibleEndIndex(itemsPerPage);
  }, [itemsPerPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const incomingRequests = requests.filter(r => r.type === 'incoming');
  const outgoingRequests = requests.filter(r => r.type === 'outgoing');
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const myPendingRequests = pendingRequests.filter(r => r.type === 'outgoing'); // My pending requests

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

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the lending report');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Temporary Branch Assignment Requests - ${new Date().toISOString().split('T')[0]}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
              color: #000;
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

  return (
    <div className="space-y-6">
      {/* Type Tabs and Search */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Tabs */}
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setTypeFilter('all');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  typeFilter === 'all'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                All Requests
              </button>
              <button
                onClick={() => {
                  setTypeFilter('incoming');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  typeFilter === 'incoming'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Incoming
              </button>
              <button
                onClick={() => {
                  setTypeFilter('outgoing');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  typeFilter === 'outgoing'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Outgoing
              </button>
            </div>

            {/* Search, Filter, Print & Export - single row layout */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search lending requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>

              <button
                onClick={() => setShowFilterModal(true)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm ${
                  (statusFilter !== 'all' || typeFilter !== 'all' || branchFilter !== 'all' || dateFilter.startDate || dateFilter.endDate) ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 hover:bg-gray-50'
                }`}
                title={`Filter - ${filteredRequests.length} requests`}
              >
                <Filter className="w-5 h-5" />
                <span className="px-1.5 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                  {filteredRequests.length}
                </span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <Printer className="w-5 h-5 text-gray-600" />
              </button>

              <button
                onClick={() => exportToCSV()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Branch Statistics/History Section */}
          {showBranchStats && branchStatistics.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Lending History by Branch</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {branchStatistics.map(([branchId, stats]) => (
                  <button
                    key={branchId}
                    onClick={() => {
                      setBranchFilter(branchFilter === branchId ? 'all' : branchId);
                      setCurrentPage(1);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      branchFilter === branchId
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">{stats.name}</span>
                      {branchFilter === branchId && (
                        <span className="text-xs text-primary-600 font-medium">Active</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Lent to:</span>
                        <span className="font-semibold text-blue-600">{stats.lentTo}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Borrowed:</span>
                        <span className="font-semibold text-green-600">{stats.borrowedFrom}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      {stats.active > 0 && (
                        <span className="text-blue-600">{stats.active} active</span>
                      )}
                      {stats.pending > 0 && (
                        <span className="text-yellow-600">{stats.pending} pending</span>
                      )}
                      {stats.completed > 0 && (
                        <span className="text-gray-600">{stats.completed} completed</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {branchFilter !== 'all' && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Showing requests for: <strong>{branchCache[branchFilter]?.name || branchFilter}</strong>
                  </span>
                  <button
                    onClick={() => setBranchFilter('all')}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Start</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">End</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                    No requests found. Try adjusting search or filters.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request) => {
                  const stylist = stylistCache[request.stylistId];
                  const fromBranch = branchCache[request.fromBranchId];
                  const toBranch = branchCache[request.toBranchId];
                  const isIncoming = request.type === 'incoming';
                  const canApprove = isIncoming && request.status === 'pending';
                  const canReject = isIncoming && request.status === 'pending';
                  const canCancel = !isIncoming && (request.status === 'pending' || request.status === 'approved');

                  return (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {isIncoming ? 'Incoming' : 'Outgoing'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex flex-col">
                          {stylist ? (
                            <>
                              <span className="font-medium">{getFullName(stylist)}</span>
                              <span className="text-xs text-gray-500">{stylist?.email || 'N/A'}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-amber-600">To Be Assigned</span>
                              <span className="text-xs text-gray-500">Awaiting approval</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {fromBranch?.branchName || fromBranch?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {toBranch?.branchName || toBranch?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {request.startDate ? formatDate(request.startDate, 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {request.endDate ? formatDate(request.endDate, 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 inline-flex items-center gap-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                          {getStatusIcon(request.status)}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canApprove && (
                            <button
                              onClick={() => handleApprove(request)}
                              disabled={processing === request.id}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          {canReject && (
                            <button
                              onClick={() => handleReject(request)}
                              disabled={processing === request.id}
                              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(request)}
                              disabled={processing === request.id}
                              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                          {!canApprove && !canReject && !canCancel && (
                            <span className="text-xs text-gray-400">No actions</span>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {visibleStartIndex + 1} to {Math.min(visibleEndIndex, filteredRequests.length)} of {filteredRequests.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPageNumber - 1)}
                  disabled={currentPageNumber === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPageNumber <= 3) {
                      pageNum = i + 1;
                    } else if (currentPageNumber >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPageNumber - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`px-3 py-2 border rounded-lg transition-colors text-sm ${
                          currentPageNumber === pageNum
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => goToPage(currentPageNumber + 1)}
                  disabled={currentPageNumber === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Filter Requests</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Branches</option>
                  {uniqueBranches.map(([branchId, branchName]) => (
                    <option key={branchId} value={branchId}>
                      {branchName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">From</label>
                    <input
                      type="date"
                      value={dateFilter.startDate}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">To</label>
                    <input
                      type="date"
                      value={dateFilter.endDate}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="requestedAt">Request Date</option>
                  <option value="startDate">Start Date</option>
                  <option value="status">Status</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={() => {
                  setShowFilterModal(false);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Reject Modal */}
      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => {
          if (!processing) {
            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectionReason('');
          }
        }}
        onConfirm={confirmReject}
        title="Reject Lending Request"
        message={
          <div className="space-y-4">
            <p>Are you sure you want to reject this lending request?</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Provide a reason for rejection..."
              />
            </div>
          </div>
        }
        confirmText="Reject"
        cancelText="Cancel"
        type="danger"
        loading={processing === selectedRequest?.id}
      />

      {/* Request Help Modal */}
      <LendStylistModal
        isOpen={showRequestModal}
        stylist={null}
        requestingBranchId={userBranch}
        onClose={() => setShowRequestModal(false)}
        onSave={() => {
          fetchRequests();
          setShowRequestModal(false);
        }}
      />

      {/* Approve Lending Request Modal */}
      <ApproveLendingModal
        isOpen={showApproveModal}
        request={requestToApprove}
        onClose={() => {
          setShowApproveModal(false);
          setRequestToApprove(null);
        }}
        onApprove={() => {
          fetchRequests();
          setShowApproveModal(false);
          setRequestToApprove(null);
        }}
      />
      {/* PDF Preview Modal for printing lending requests */}
      {showPDFPreview && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          contentRef={printRef}
          title="Lending Requests"
          fileName={`Lending_Requests_${new Date().toISOString().replace(/[:.]/g,'-')}`}
        />
      )}

      {/* Hidden print content */}
      <div className="hidden">
        {printContent}
      </div>
    </div>
  );
};

export default StaffLending;
