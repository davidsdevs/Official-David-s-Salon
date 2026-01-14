// src/pages/02_OperationalManager/Deposits.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { depositService } from '../../services/depositService';
import { getBranches } from '../../services/branchService';
import {
  Banknote,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Building,
  Loader2,
  Search,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Table,
  CalendarDays,
  Filter,
  Printer
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';

const OperationalManagerDeposits = () => {
  const { userData } = useAuth();
  
  const [deposits, setDeposits] = useState([]);
  const [branches, setBranches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [validationFilter, setValidationFilter] = useState('all');
  
  // Modal states
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  
  // Calendar states
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Expense image modal state
  const [expenseImageUrl, setExpenseImageUrl] = useState(null);

  // Load deposits and branches
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all branches first
      const allBranches = await getBranches();
      const branchesMap = {};
      allBranches.forEach(branch => {
        branchesMap[branch.id] = branch.name || `Branch ${branch.id.substring(0, 8)}`;
      });
      setBranches(branchesMap);
      
      // Load all deposits
      const depositsList = await depositService.getAllDeposits();
      setDeposits(depositsList);
    } catch (err) {
      console.error('Error loading deposits:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userData]);

  // Filter deposits
  const filteredDeposits = deposits.filter(deposit => {
    const branchName = branches[deposit.branchId] || 'Unknown';
    const matchesSearch = 
      !searchTerm ||
      branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.submittedByName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || deposit.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || deposit.branchId === branchFilter;
    const matchesValidation = validationFilter === 'all' || deposit.validationStatus === validationFilter;
    
    return matchesSearch && matchesStatus && matchesBranch && matchesValidation;
  });

  // Handle approve/reject
  const handleReview = async (action) => {
    if (!selectedDeposit) return;

    try {
      setIsReviewing(true);
      setError(null);

      await depositService.reviewDeposit(selectedDeposit.id, action, {
        reviewedBy: userData.uid || userData.id,
        reviewedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        notes: reviewNotes
      });

      setShowReviewModal(false);
      setReviewNotes('');
      await loadData();
      
      // Show toast notification instead of alert
      const actionText = action === 'approve' ? 'approved' : 'rejected';
      toast.success(`Deposit ${actionText} successfully!`, {
        duration: 4000,
        position: 'top-right',
        icon: action === 'approve' ? '✓' : '✗'
      });
    } catch (err) {
      console.error('Error reviewing deposit:', err);
      setError(err.message || 'Failed to review deposit');
      toast.error(err.message || 'Failed to review deposit', {
        duration: 4000,
        position: 'top-right'
      });
    } finally {
      setIsReviewing(false);
    }
  };

  // Statistics
  const stats = {
    total: deposits.length,
    approved: deposits.filter(d => d.status === 'approved').length,
    rejected: deposits.filter(d => d.status === 'rejected').length,
    pending: deposits.filter(d => d.status === 'submitted').length,
    totalAmount: deposits.reduce((sum, d) => sum + (d.amount || 0), 0),
    totalSales: deposits.reduce((sum, d) => sum + (d.dailySalesTotal || 0), 0),
    totalDifference: deposits.reduce((sum, d) => sum + (d.difference || 0), 0),
    matches: deposits.filter(d => d.validationStatus === 'match').length,
    mismatches: deposits.filter(d => d.validationStatus === 'mismatch').length,
    needsReview: deposits.filter(d => d.validationStatus === 'manual_review').length
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-100 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-100 border-red-200';
      case 'submitted': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get validation color
  const getValidationColor = (status) => {
    switch (status) {
      case 'match': return 'text-green-600 bg-green-50';
      case 'mismatch': return 'text-red-600 bg-red-50';
      case 'manual_review': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get unique branches for filter
  const uniqueBranches = [...new Set(deposits.map(d => d.branchId))];

  // Count active filters
  const activeFilterCount = [
    statusFilter !== 'all',
    branchFilter !== 'all',
    validationFilter !== 'all'
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setBranchFilter('all');
    setValidationFilter('all');
    setSearchTerm('');
  };

  // Print deposits report
  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    
    let htmlContent = `
      <html>
        <head>
          <title>Deposits Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; }
            .summary { display: flex; justify-content: space-around; margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .summary-item { text-align: center; }
            .summary-label { font-size: 12px; color: #666; }
            .summary-value { font-size: 18px; font-weight: bold; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
            th { background-color: #160B53; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .status-approved { color: #16a34a; font-weight: bold; }
            .status-rejected { color: #dc2626; font-weight: bold; }
            .status-pending { color: #ca8a04; font-weight: bold; }
            .match { color: #16a34a; }
            .mismatch { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>Deposits Report</h1>
          <p style="text-align: center; color: #666;">Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}</p>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Deposits</div>
              <div class="summary-value">${filteredDeposits.length}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Sales</div>
              <div class="summary-value">₱${stats.totalSales.toLocaleString()}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Deposited</div>
              <div class="summary-value">₱${stats.totalAmount.toLocaleString()}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Branch</th>
                <th>Deposit Amount</th>
                <th>Daily Sales</th>
                <th>Difference</th>
                <th>Validation</th>
                <th>Status</th>
                <th>Submitted By</th>
              </tr>
            </thead>
            <tbody>
    `;

    filteredDeposits.forEach(deposit => {
      const statusClass = deposit.status === 'approved' ? 'status-approved' : 
                         deposit.status === 'rejected' ? 'status-rejected' : 'status-pending';
      const validationClass = deposit.validationStatus === 'match' ? 'match' : 'mismatch';
      
      htmlContent += `
        <tr>
          <td>${format(new Date(deposit.depositDate), 'MMM dd, yyyy')}</td>
          <td>${branches[deposit.branchId] || 'Unknown Branch'}</td>
          <td>₱${(deposit.amount || 0).toLocaleString()}</td>
          <td>₱${(deposit.dailySalesTotal || 0).toLocaleString()}</td>
          <td class="${validationClass}">${deposit.difference >= 0 ? '+' : ''}₱${Math.abs(deposit.difference || 0).toFixed(2)}</td>
          <td class="${validationClass}">${deposit.validationStatus === 'match' ? '✓ Match' : deposit.validationStatus === 'mismatch' ? '✗ Mismatch' : '⚠ Review'}</td>
          <td class="${statusClass}">${deposit.status === 'approved' ? '✓ Approved' : deposit.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}</td>
          <td>${deposit.submittedByName || 'Unknown'}</td>
        </tr>
      `;
    });

    htmlContent += `
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Print single deposit
  const handlePrintDeposit = (deposit) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const branchName = branches[deposit.branchId] || 'Unknown Branch';
    
    const htmlContent = `
      <html>
        <head>
          <title>Deposit Receipt - ${branchName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #160B53; border-bottom: 2px solid #160B53; padding-bottom: 10px; }
            .header { text-align: center; margin-bottom: 20px; }
            .info-section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #555; }
            .info-value { color: #333; }
            .amount-section { display: flex; justify-content: space-around; margin: 20px 0; }
            .amount-box { text-align: center; padding: 15px 25px; border-radius: 8px; }
            .amount-box.sales { background: #dbeafe; border: 2px solid #3b82f6; }
            .amount-box.deposit { background: #dcfce7; border: 2px solid #22c55e; }
            .amount-box.diff { background: ${Math.abs(deposit.difference || 0) <= 1 ? '#dcfce7' : '#fee2e2'}; border: 2px solid ${Math.abs(deposit.difference || 0) <= 1 ? '#22c55e' : '#ef4444'}; }
            .amount-label { font-size: 12px; color: #666; margin-bottom: 5px; }
            .amount-value { font-size: 24px; font-weight: bold; }
            .status { display: inline-block; padding: 6px 12px; border-radius: 20px; font-weight: bold; margin-top: 10px; }
            .status-approved { background: #dcfce7; color: #16a34a; }
            .status-rejected { background: #fee2e2; color: #dc2626; }
            .status-pending { background: #fef3c7; color: #ca8a04; }
            .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Deposit Receipt</h1>
          <div class="header">
            <p style="color: #666; margin: 5px 0;">Date: ${format(new Date(deposit.depositDate), 'MMMM dd, yyyy')}</p>
            <p style="color: #666; margin: 5px 0;">Branch: <strong>${branchName}</strong></p>
          </div>
          
          <div class="amount-section">
            <div class="amount-box sales">
              <div class="amount-label">Daily Sales</div>
              <div class="amount-value" style="color: #3b82f6;">₱${(deposit.dailySalesTotal || 0).toLocaleString()}</div>
            </div>
            <div class="amount-box deposit">
              <div class="amount-label">Deposit Amount</div>
              <div class="amount-value" style="color: #22c55e;">₱${(deposit.amount || 0).toLocaleString()}</div>
            </div>
            <div class="amount-box diff">
              <div class="amount-label">Difference</div>
              <div class="amount-value" style="color: ${Math.abs(deposit.difference || 0) <= 1 ? '#22c55e' : '#ef4444'};">
                ${deposit.difference >= 0 ? '+' : ''}₱${Math.abs(deposit.difference || 0).toFixed(2)}
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Reference Number:</span>
              <span class="info-value">${deposit.referenceNumber || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bank:</span>
              <span class="info-value">${deposit.bankName || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Submitted By:</span>
              <span class="info-value">${deposit.submittedByName || 'Unknown'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Submitted At:</span>
              <span class="info-value">${deposit.submittedAt ? format(new Date(deposit.submittedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Validation:</span>
              <span class="info-value">${deposit.validationStatus === 'match' ? '✓ Match' : deposit.validationStatus === 'mismatch' ? '✗ Mismatch' : '⚠ Needs Review'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">
                <span class="status status-${deposit.status === 'approved' ? 'approved' : deposit.status === 'rejected' ? 'rejected' : 'pending'}">
                  ${deposit.status === 'approved' ? '✓ Approved' : deposit.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                </span>
              </span>
            </div>
            ${deposit.reviewedByName ? `
            <div class="info-row">
              <span class="info-label">Reviewed By:</span>
              <span class="info-value">${deposit.reviewedByName}</span>
            </div>
            ` : ''}
            ${deposit.reviewNotes ? `
            <div class="info-row">
              <span class="info-label">Review Notes:</span>
              <span class="info-value">${deposit.reviewNotes}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getDepositsForDate = (date) => {
    return filteredDeposits.filter(deposit => 
      isSameDay(new Date(deposit.depositDate), date)
    );
  };

  const getDepositStatusForDate = (date) => {
    const dayDeposits = getDepositsForDate(date);
    if (dayDeposits.length === 0) return null;
    
    // Return the most critical status
    if (dayDeposits.some(d => d.status === 'submitted')) return 'pending';
    if (dayDeposits.some(d => d.status === 'rejected')) return 'rejected';
    if (dayDeposits.every(d => d.status === 'approved')) return 'approved';
    return 'mixed';
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfWeek = daysInMonth[0].getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deposit Reviews</h1>
        <p className="text-gray-600">Review and validate branch deposits against daily sales</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deposits</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.pending} pending</p>
            </div>
            <Banknote className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">₱{stats.totalSales.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">All branches</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deposits</p>
              <p className="text-2xl font-bold text-gray-900">₱{stats.totalAmount.toLocaleString()}</p>
              <p className={`text-xs mt-1 ${
                stats.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.totalDifference >= 0 ? '+' : ''}₱{Math.abs(stats.totalDifference).toFixed(2)} difference
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Validation Status</p>
              <p className="text-2xl font-bold text-gray-900">{stats.matches}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.mismatches} mismatches, {stats.needsReview} need review
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
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
                placeholder="Search by branch, reference, or submitted by..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
              />
            </div>
          </div>

          {/* Icon-only Buttons - No borders */}
          <button
            onClick={() => setShowFilterModal(true)}
            className="p-2 relative text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded-lg transition-colors"
            title="Filter"
          >
            <Filter className="h-5 w-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#160B53] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {filteredDeposits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'text-[#160B53] bg-[#160B53]/10' : 'text-gray-600 hover:text-[#160B53] hover:bg-gray-100'}`}
            title="Table View"
          >
            <Table className="h-5 w-5" />
          </button>

          <button
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'text-[#160B53] bg-[#160B53]/10' : 'text-gray-600 hover:text-[#160B53] hover:bg-gray-100'}`}
            title="Calendar View"
          >
            <CalendarDays className="h-5 w-5" />
          </button>

          <button
            onClick={handlePrint}
            className="p-2 text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded-lg transition-colors"
            title="Print"
          >
            <Printer className="h-5 w-5" />
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {/* Deposits Table or Calendar View */}
      {loading ? (
        <Card className="p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
            <span className="ml-2 text-gray-600">Loading deposits...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </Card>
      ) : viewMode === 'calendar' ? (
        // Calendar View
        <Card className="p-6 border border-gray-200">
          <div className="space-y-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                  className="text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-4">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {emptyDays.map((_, idx) => (
                  <div key={`empty-${idx}`} className="aspect-square" />
                ))}
                {daysInMonth.map(day => {
                  const dayDeposits = getDepositsForDate(day);
                  const status = getDepositStatusForDate(day);
                  const isToday = isSameDay(day, new Date());

                  let bgColor = 'bg-white';
                  let borderColor = 'border-gray-200';
                  let textColor = 'text-gray-900';

                  if (status === 'pending') {
                    bgColor = 'bg-yellow-50';
                    borderColor = 'border-yellow-200';
                  } else if (status === 'approved') {
                    bgColor = 'bg-green-50';
                    borderColor = 'border-green-200';
                  } else if (status === 'rejected') {
                    bgColor = 'bg-red-50';
                    borderColor = 'border-red-200';
                  } else if (status === 'mixed') {
                    bgColor = 'bg-blue-50';
                    borderColor = 'border-blue-200';
                  }

                  return (
                    <div
                      key={day.toISOString()}
                      className={`aspect-square p-2 border-2 rounded-lg ${bgColor} ${borderColor} ${
                        isToday ? 'ring-2 ring-[#160B53]' : ''
                      } cursor-pointer hover:shadow-md transition-shadow`}
                    >
                      <div className="h-full flex flex-col">
                        <span className={`text-sm font-semibold ${textColor}`}>
                          {format(day, 'd')}
                        </span>
                        {dayDeposits.length > 0 && (
                          <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-xs font-bold text-gray-700">
                                {dayDeposits.length}
                              </div>
                              <div className="text-xs text-gray-600">
                                {status === 'pending' && '⏳'}
                                {status === 'approved' && '✓'}
                                {status === 'rejected' && '✗'}
                                {status === 'mixed' && '◐'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300"></div>
                <span className="text-sm text-gray-600">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-200 border border-green-300"></div>
                <span className="text-sm text-gray-600">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-200 border border-red-300"></div>
                <span className="text-sm text-gray-600">Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-200 border border-blue-300"></div>
                <span className="text-sm text-gray-600">Mixed Status</span>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        // Table View
        <Card className="overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deposit Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Daily Sales</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                      No deposits found
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(deposit.depositDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {branches[deposit.branchId] || 'Unknown Branch'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        ₱{(deposit.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        ₱{(deposit.dailySalesTotal || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {Math.abs(deposit.difference || 0) <= 1 ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : Math.abs(deposit.difference || 0) > 100 ? (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          )}
                          <span className={`font-medium ${
                            Math.abs(deposit.difference || 0) <= 1 
                              ? 'text-green-600' 
                              : Math.abs(deposit.difference || 0) > 100
                              ? 'text-red-600'
                              : 'text-yellow-600'
                          }`}>
                            {deposit.difference >= 0 ? '+' : ''}₱{Math.abs(deposit.difference || 0).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getValidationColor(deposit.validationStatus)}`}>
                          {deposit.validationStatus === 'match' ? '✓ Match' :
                           deposit.validationStatus === 'mismatch' ? '✗ Mismatch' :
                           deposit.validationStatus === 'manual_review' ? '⚠ Review' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(deposit.status)}`}>
                          {deposit.status === 'approved' ? '✓ Approved' :
                           deposit.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {deposit.submittedByName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedDeposit(deposit);
                              setShowDetailsModal(true);
                            }}
                            className="p-1.5 text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrintDeposit(deposit)}
                            className="p-1.5 text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded transition-colors"
                            title="Print"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {deposit.status === 'submitted' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedDeposit(deposit);
                                setReviewNotes('');
                                setShowReviewModal(true);
                              }}
                              className="bg-[#160B53] text-white hover:bg-[#12094A]"
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Filter Deposits</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowFilterModal(false)}
                  className="text-white hover:bg-white/20 p-1"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="submitted">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Validation Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Validation</label>
                <select
                  value={validationFilter}
                  onChange={(e) => setValidationFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                >
                  <option value="all">All Validation</option>
                  <option value="match">Match</option>
                  <option value="mismatch">Mismatch</option>
                  <option value="manual_review">Needs Review</option>
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
                      {branches[branchId] || 'Unknown Branch'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Results Count */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-[#160B53]">{filteredDeposits.length}</span> of {deposits.length} deposits
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="text-sm"
                >
                  Clear All
                </Button>
                <Button
                  onClick={() => setShowFilterModal(false)}
                  className="bg-[#160B53] text-white hover:bg-[#12094A] text-sm"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Details Modal */}
      {showDetailsModal && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Deposit Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetailsModal(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Amount Comparison Card - Simplified (No OCR) */}
              <Card className="p-6 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Amount Comparison</h3>
                <div className="space-y-4">
                  {/* Daily Sales Total */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <div>
                        <span className="font-medium text-gray-700 block">Daily Sales Total</span>
                        <span className="text-xs text-gray-500">(From Transactions)</span>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      ₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Manual Deposit Amount */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-600"></div>
                      <div>
                        <span className="font-medium text-gray-700 block">Manual Deposit Amount</span>
                        <span className="text-xs text-gray-500">(Submitted by Branch)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-green-600">
                        ₱{(selectedDeposit.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {selectedDeposit.dailySalesTotal > 0 && (
                        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                          Math.abs(selectedDeposit.amount - selectedDeposit.dailySalesTotal) <= 1 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {Math.abs(selectedDeposit.amount - selectedDeposit.dailySalesTotal) <= 1 
                            ? '✓ Match' 
                            : `Diff: ₱${Math.abs(selectedDeposit.amount - selectedDeposit.dailySalesTotal).toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Difference Summary */}
                  <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Total Difference</p>
                        <p className="text-xs text-gray-600 mt-1">Deposit Amount vs Daily Sales</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          Math.abs(selectedDeposit.difference || 0) <= 1 
                            ? 'text-green-600' 
                            : Math.abs(selectedDeposit.difference || 0) > 100
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {selectedDeposit.difference >= 0 ? '+' : ''}₱{Math.abs(selectedDeposit.difference || 0).toFixed(2)}
                        </p>
                        <p className={`text-xs font-medium mt-1 ${
                          Math.abs(selectedDeposit.difference || 0) <= 1 
                            ? 'text-green-600' 
                            : Math.abs(selectedDeposit.difference || 0) > 100
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {Math.abs(selectedDeposit.difference || 0) <= 1 
                            ? '✓ Acceptable' 
                            : Math.abs(selectedDeposit.difference || 0) > 100
                            ? '✗ Large Discrepancy'
                            : '⚠ Minor Difference'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Expenses/Deductions Section */}
              {(selectedDeposit.expenses?.length > 0 || selectedDeposit.totalExpenses > 0) && (
                <Card className="p-6 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Expenses / Deductions
                  </h3>
                  
                  {/* Total Expenses */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-orange-200 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                      <span className="font-medium text-gray-700">Total Expenses</span>
                    </div>
                    <span className="text-2xl font-bold text-orange-600">
                      ₱{(selectedDeposit.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Expense Items */}
                  {selectedDeposit.expenses?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600 mb-2">Expense Breakdown:</p>
                      <div className="bg-white rounded-lg border border-orange-200 divide-y divide-orange-100">
                        {selectedDeposit.expenses.map((expense, index) => (
                          <div key={index} className="p-3 flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-800">{expense.description || expense.category || 'Expense'}</p>
                                {(expense.imageUrl || expense.receiptUrl || expense.image) && (
                                  <button
                                    onClick={() => setExpenseImageUrl(expense.imageUrl || expense.receiptUrl || expense.image)}
                                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                    title="View Receipt"
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              {expense.justification && (
                                <p className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium">Justification:</span> {expense.justification}
                                </p>
                              )}
                              {expense.category && expense.description && (
                                <p className="text-xs text-gray-500 mt-1">Category: {expense.category}</p>
                              )}
                            </div>
                            <span className="font-semibold text-orange-600 ml-4">
                              ₱{(expense.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expected vs Actual Calculation */}
                  <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Daily Sales:</span>
                        <span className="font-medium">₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-orange-600">
                        <span>Less: Expenses:</span>
                        <span className="font-medium">- ₱{(selectedDeposit.totalExpenses || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                        <span className="text-gray-700">Expected Deposit:</span>
                        <span className="text-blue-600">₱{((selectedDeposit.dailySalesTotal || 0) - (selectedDeposit.totalExpenses || 0)).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Actual Deposit:</span>
                        <span className="text-green-600 font-medium">₱{(selectedDeposit.amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Receipt Image */}
              {selectedDeposit.receiptImageUrl && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-gray-600" />
                    Receipt Image
                  </h3>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <img 
                      src={selectedDeposit.receiptImageUrl} 
                      alt="Deposit receipt" 
                      className="max-w-full rounded-lg shadow-md"
                    />
                  </div>
                </div>
              )}

              {/* Deposit Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-500 mb-1">Deposit Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {format(new Date(selectedDeposit.depositDate), 'MMMM dd, yyyy')}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-500 mb-1">Branch</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {branches[selectedDeposit.branchId] || 'Unknown Branch'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-500 mb-1">Validation Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getValidationColor(selectedDeposit.validationStatus)}`}>
                    {selectedDeposit.validationStatus === 'match' ? '✓ Match' :
                     selectedDeposit.validationStatus === 'mismatch' ? '✗ Mismatch' :
                     selectedDeposit.validationStatus === 'manual_review' ? '⚠ Review' : 'Pending'}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-500 mb-1">Review Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedDeposit.status)}`}>
                    {selectedDeposit.status === 'approved' ? '✓ Approved' :
                     selectedDeposit.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                  </span>
                </div>
                {selectedDeposit.bankName && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Bank</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedDeposit.bankName}</p>
                  </div>
                )}
                {selectedDeposit.referenceNumber && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Reference Number</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedDeposit.referenceNumber}</p>
                  </div>
                )}
              </div>

              {/* Submitted By */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Submitted By</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#160B53] text-white flex items-center justify-center font-semibold">
                    {(selectedDeposit.submittedByName || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium">{selectedDeposit.submittedByName || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(selectedDeposit.submittedAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Review Information */}
              {selectedDeposit.reviewedByName && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Reviewed By</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${
                      selectedDeposit.status === 'approved' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      {(selectedDeposit.reviewedByName || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-900 font-medium">{selectedDeposit.reviewedByName}</p>
                      {selectedDeposit.reviewedAt && (
                        <p className="text-xs text-gray-500">
                          {format(new Date(selectedDeposit.reviewedAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedDeposit.reviewNotes && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900 mb-1">Review Notes:</p>
                      <p className="text-sm text-blue-800">{selectedDeposit.reviewNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedDeposit.notes && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Additional Notes</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-200">{selectedDeposit.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Review Deposit</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowReviewModal(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Amount Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Daily Sales</p>
                  <p className="text-3xl font-bold text-blue-600">
                    ₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">From Transactions</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Deposit Amount</p>
                  <p className="text-3xl font-bold text-green-600">
                    ₱{(selectedDeposit.amount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Submitted Amount</p>
                </div>
              </div>

              {/* Difference Indicator */}
              <div className={`p-4 rounded-lg border-2 ${
                Math.abs(selectedDeposit.difference || 0) <= 1 
                  ? 'bg-green-50 border-green-200' 
                  : Math.abs(selectedDeposit.difference || 0) > 100
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Difference</p>
                    <p className="text-xs text-gray-500 mt-1">Deposit vs Daily Sales</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${
                      Math.abs(selectedDeposit.difference || 0) <= 1 
                        ? 'text-green-600' 
                        : Math.abs(selectedDeposit.difference || 0) > 100
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}>
                      {selectedDeposit.difference >= 0 ? '+' : ''}₱{Math.abs(selectedDeposit.difference || 0).toFixed(2)}
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${
                      Math.abs(selectedDeposit.difference || 0) <= 1 
                        ? 'text-green-600' 
                        : Math.abs(selectedDeposit.difference || 0) > 100
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}>
                      {Math.abs(selectedDeposit.difference || 0) <= 1 
                        ? '✓ Acceptable' 
                        : Math.abs(selectedDeposit.difference || 0) > 100
                        ? '✗ Large Discrepancy'
                        : '⚠ Minor Difference'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Review Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
                  placeholder="Add notes about your review decision (optional)..."
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setShowReviewModal(false)}
                  disabled={isReviewing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleReview('reject')}
                  disabled={isReviewing}
                  className="bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                >
                  {isReviewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Reject
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleReview('approve')}
                  disabled={isReviewing}
                  className="bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                >
                  {isReviewing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Image Modal */}
      {expenseImageUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Expense Receipt
              </h3>
              <button
                onClick={() => setExpenseImageUrl(null)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <img 
                src={expenseImageUrl} 
                alt="Expense receipt" 
                className="max-w-full rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
};

export default OperationalManagerDeposits;

