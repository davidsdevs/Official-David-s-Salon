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
    try {
      if (filteredDeposits.length === 0) {
        toast.error('No deposits to print');
        return;
      }

      const printWindow = window.open('', '', 'height=600,width=800');
      
      if (!printWindow) {
        toast.error('Please allow pop-ups to print reports');
        return;
      }
      
      // Build filters text
      const filters = [];
      if (searchTerm) filters.push(`Search: "${searchTerm}"`);
      if (statusFilter !== 'all') filters.push(`Status: ${statusFilter}`);
      if (branchFilter !== 'all') {
        const branchName = branches[branchFilter];
        if (branchName) filters.push(`Branch: ${branchName}`);
      }
      if (validationFilter !== 'all') filters.push(`Validation: ${validationFilter}`);
      const filtersText = filters.length > 0 ? filters.join(' | ') : 'All Deposits';
      
      let htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Deposits Report</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
              @media print {
                @page {
                  size: letter;
                  margin: 0.4in 0.4in 0.75in 0.4in;
                }
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Poppins', Arial, sans-serif;
              }
              body {
                font-family: 'Poppins', Arial, sans-serif;
                padding: 0;
                color: #000;
                font-size: 9px;
              }
              .header {
                text-align: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid #333;
              }
              .header h1 {
                font-size: 14px;
                font-weight: 600;
                margin: 0 0 5px 0;
              }
              .header h2 {
                font-size: 18px;
                font-weight: 700;
                margin: 0;
              }
              .filters {
                background: #fff;
                padding: 10px;
                border: 2px solid #333;
                margin: 10px 0 15px 0;
                text-align: center;
              }
              .filters-title {
                font-size: 10px;
                font-weight: 700;
                margin-bottom: 5px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .filters-content {
                font-size: 9px;
                font-weight: 600;
              }
              .summary-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin: 15px 0;
              }
              .stat-box {
                text-align: center;
                padding: 10px;
                background: #fff;
                border: 1px solid #333;
              }
              .stat-value {
                font-size: 16px;
                font-weight: 700;
                color: #000;
                margin-bottom: 3px;
              }
              .stat-label {
                font-size: 9px;
                color: #000;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
              }
              .deposit-card {
                border: 1px solid #333;
                margin-bottom: 10px;
                background: #fff;
                page-break-inside: avoid;
              }
              .deposit-header {
                background: #fff;
                padding: 8px 12px;
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .deposit-branch {
                font-size: 11px;
                font-weight: 700;
              }
              .status-badge {
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 8px;
                font-weight: 600;
                text-transform: uppercase;
                border: 1px solid #333;
                background: #fff;
                color: #000;
              }
              .deposit-body {
                padding: 10px 12px;
              }
              .info-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
              }
              .info-row {
                padding: 4px 0;
                border-bottom: 1px dotted #ddd;
                font-size: 9px;
              }
              .info-label {
                font-weight: 600;
                display: inline-block;
                width: 110px;
              }
              .info-value {
                color: #333;
              }
              .footer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 10px 0.4in;
                border-top: 2px solid #333;
                font-size: 8px;
                background: #fff;
              }
              .footer-content {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
              }
              .footer-left, .footer-right {
                flex: 1;
              }
              .footer-left {
                text-align: left;
              }
              .footer-right {
                text-align: right;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>DAVID'S SALON</h1>
              <h2>Deposits Report - All Branches</h2>
            </div>
            
            <div class="filters">
              <div class="filters-title">FILTERS APPLIED</div>
              <div class="filters-content">${filtersText}</div>
            </div>

            <div class="summary-stats">
              <div class="stat-box">
                <div class="stat-value">${filteredDeposits.length}</div>
                <div class="stat-label">Total Deposits</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">₱${stats.totalSales.toLocaleString()}</div>
                <div class="stat-label">Total Sales</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">₱${stats.totalAmount.toLocaleString()}</div>
                <div class="stat-label">Total Deposited</div>
              </div>
            </div>
      `;

      filteredDeposits.forEach(deposit => {
        const statusLabel = deposit.status === 'approved' ? 'Approved' : 
                           deposit.status === 'rejected' ? 'Rejected' : 'Pending';
        const validationLabel = deposit.validationStatus === 'match' ? 'Match' : 
                               deposit.validationStatus === 'mismatch' ? 'Mismatch' : 'Review';
        
        htmlContent += `
          <div class="deposit-card">
            <div class="deposit-header">
              <div class="deposit-branch">${branches[deposit.branchId] || 'Unknown Branch'} - ${format(new Date(deposit.depositDate), 'MMM dd, yyyy')}</div>
              <span class="status-badge">${statusLabel}</span>
            </div>
            
            <div class="deposit-body">
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Deposit Amount:</span>
                  <span class="info-value">₱${(deposit.amount || 0).toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Daily Sales:</span>
                  <span class="info-value">₱${(deposit.dailySalesTotal || 0).toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Difference:</span>
                  <span class="info-value">${deposit.difference >= 0 ? '+' : ''}₱${Math.abs(deposit.difference || 0).toFixed(2)}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Validation:</span>
                  <span class="info-value">${validationLabel}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Submitted By:</span>
                  <span class="info-value">${deposit.submittedByName || 'Unknown'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value">${statusLabel}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      htmlContent += `
            <div class="footer">
              <div class="footer-content">
                <div class="footer-left">
                  <strong>Generated By:</strong> Operational Manager<br>
                  <strong>Position:</strong> Operational Manager<br>
                  <strong>Branch:</strong> All Branches
                </div>
                <div class="footer-right">
                  <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br>
                  <strong>Time:</strong> ${format(new Date(), 'HH:mm:ss')}
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error printing deposits report:', error);
      toast.error('Failed to generate print report: ' + error.message);
    }
  };

  // Print single deposit
  const handlePrintDeposit = (deposit) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const branchName = branches[deposit.branchId] || 'Unknown Branch';
    const statusLabel = deposit.status === 'approved' ? 'Approved' : 
                       deposit.status === 'rejected' ? 'Rejected' : 'Pending';
    const validationLabel = deposit.validationStatus === 'match' ? 'Match' : 
                           deposit.validationStatus === 'mismatch' ? 'Mismatch' : 'Review';
    
    const htmlContent = `
      <html>
        <head>
          <title>Deposit Receipt - ${branchName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin: 0.4in 0.4in 0.75in 0.4in;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: 'Poppins', Arial, sans-serif;
            }
            body {
              font-family: 'Poppins', Arial, sans-serif;
              padding: 0;
              color: #000;
              font-size: 10px;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 14px;
              font-weight: 600;
              margin: 0 0 5px 0;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
            }
            .deposit-info {
              text-align: center;
              margin: 15px 0;
              padding: 10px;
              border: 2px solid #333;
              background: #fff;
            }
            .deposit-info-title {
              font-size: 10px;
              font-weight: 700;
              margin-bottom: 5px;
            }
            .deposit-info-value {
              font-size: 11px;
              font-weight: 600;
            }
            .summary-stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin: 15px 0;
            }
            .stat-box {
              text-align: center;
              padding: 12px;
              background: #fff;
              border: 1px solid #333;
            }
            .stat-value {
              font-size: 16px;
              font-weight: 700;
              color: #000;
              margin-bottom: 3px;
            }
            .stat-label {
              font-size: 9px;
              color: #000;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 600;
            }
            .deposit-card {
              border: 1px solid #333;
              margin-bottom: 10px;
              background: #fff;
              page-break-inside: avoid;
            }
            .deposit-header {
              background: #fff;
              padding: 8px 12px;
              border-bottom: 1px solid #333;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
            }
            .status-badge {
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
              border: 1px solid #333;
              background: #fff;
              color: #000;
            }
            .deposit-body {
              padding: 10px 12px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
            }
            .info-row {
              padding: 4px 0;
              border-bottom: 1px dotted #ddd;
              font-size: 9px;
            }
            .info-label {
              font-weight: 600;
              display: inline-block;
              width: 110px;
            }
            .info-value {
              color: #333;
            }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 10px 0.4in;
              border-top: 2px solid #333;
              font-size: 8px;
              background: #fff;
            }
            .footer-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .footer-left, .footer-right {
              flex: 1;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Deposit Receipt</h2>
          </div>
          
          <div class="deposit-info">
            <div class="deposit-info-title">BRANCH & DATE</div>
            <div class="deposit-info-value">${branchName} - ${format(new Date(deposit.depositDate), 'MMMM dd, yyyy')}</div>
          </div>

          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-value">₱${(deposit.dailySalesTotal || 0).toLocaleString()}</div>
              <div class="stat-label">Daily Sales</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">₱${(deposit.amount || 0).toLocaleString()}</div>
              <div class="stat-label">Deposit Amount</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${deposit.difference >= 0 ? '+' : ''}₱${Math.abs(deposit.difference || 0).toFixed(2)}</div>
              <div class="stat-label">Difference</div>
            </div>
          </div>
          
          <div class="deposit-card">
            <div class="deposit-header">
              <div class="section-title">Deposit Details</div>
              <span class="status-badge">${statusLabel}</span>
            </div>
            
            <div class="deposit-body">
              <div class="info-grid">
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
                  <span class="info-value">${validationLabel}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value">${statusLabel}</span>
                </div>
                ${deposit.reviewedByName ? `
                <div class="info-row">
                  <span class="info-label">Reviewed By:</span>
                  <span class="info-value">${deposit.reviewedByName}</span>
                </div>
                ` : ''}
                ${deposit.reviewNotes ? `
                <div class="info-row" style="grid-column: 1 / -1;">
                  <span class="info-label">Review Notes:</span>
                  <span class="info-value">${deposit.reviewNotes}</span>
                </div>
                ` : ''}
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-content">
              <div class="footer-left">
                <strong>Generated By:</strong> Operational Manager<br>
                <strong>Position:</strong> Operational Manager<br>
                <strong>Branch:</strong> All Branches
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br>
                <strong>Time:</strong> ${format(new Date(), 'HH:mm:ss')}
              </div>
            </div>
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

      {/* Enhanced Deposit Details Modal - Mobile Responsive */}
      {showDetailsModal && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] sm:h-[92vh] flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#2A1B70] text-white px-3 sm:px-6 py-3 sm:py-5 flex-shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 opacity-20"></div>
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                  <div className="p-2 sm:p-3 bg-white/10 rounded-lg sm:rounded-xl backdrop-blur-md flex-shrink-0">
                    <Banknote className="h-4 w-4 sm:h-6 sm:w-6 text-blue-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-2xl font-bold tracking-tight truncate">Deposit Review</h2>
                    <p className="text-blue-100 text-xs sm:text-sm opacity-90 truncate">
                      {branches[selectedDeposit.branchId] || 'Unknown Branch'}
                    </p>
                    <p className="text-blue-100 text-xs opacity-90 sm:hidden">
                      {format(new Date(selectedDeposit.depositDate), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-blue-100 text-xs sm:text-sm opacity-90 hidden sm:block">
                      {format(new Date(selectedDeposit.depositDate), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePrintDeposit(selectedDeposit)}
                    className="text-white hover:bg-white/20 hidden sm:flex items-center gap-2 px-3"
                  >
                    <Printer className="h-4 w-4" />
                    <span className="hidden md:inline">Print</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePrintDeposit(selectedDeposit)}
                    className="text-white hover:bg-white/20 sm:hidden p-2"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowDetailsModal(false)}
                    className="text-white hover:bg-white/20 rounded-full p-1.5 sm:p-2"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50/50">
              {/* Financial Summary - Mobile Responsive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Daily Sales */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Daily Sales</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-blue-700">
                    ₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">From transactions</p>
                </div>

                {/* Deposited Amount */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-green-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    <p className="text-xs font-bold text-green-900 uppercase tracking-wide">Deposited</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-green-700">
                    ₱{(selectedDeposit.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Bank deposit</p>
                </div>

                {/* Difference */}
                <div className={`rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 shadow-sm sm:col-span-2 lg:col-span-1 ${
                  Math.abs(selectedDeposit.difference || 0) <= 1 
                    ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200' 
                    : Math.abs(selectedDeposit.difference || 0) > 100
                    ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
                    : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      Math.abs(selectedDeposit.difference || 0) <= 1 ? 'bg-emerald-600' :
                      Math.abs(selectedDeposit.difference || 0) > 100 ? 'bg-red-600' : 'bg-amber-600'
                    }`}></div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${
                      Math.abs(selectedDeposit.difference || 0) <= 1 ? 'text-emerald-900' :
                      Math.abs(selectedDeposit.difference || 0) > 100 ? 'text-red-900' : 'text-amber-900'
                    }`}>Difference</p>
                  </div>
                  <p className={`text-2xl sm:text-3xl font-extrabold ${
                    Math.abs(selectedDeposit.difference || 0) <= 1 ? 'text-emerald-700' :
                    Math.abs(selectedDeposit.difference || 0) > 100 ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    {selectedDeposit.difference >= 0 ? '+' : ''}₱{Math.abs(selectedDeposit.difference || 0).toFixed(2)}
                  </p>
                  <p className={`text-xs mt-1 font-semibold ${
                    Math.abs(selectedDeposit.difference || 0) <= 1 ? 'text-emerald-600' :
                    Math.abs(selectedDeposit.difference || 0) > 100 ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {Math.abs(selectedDeposit.difference || 0) <= 1 ? '✓ Acceptable' :
                     Math.abs(selectedDeposit.difference || 0) > 100 ? '✗ Large Gap' : '⚠ Minor Gap'}
                  </p>
                </div>
              </div>

              {/* Adjustments Section - Mobile Responsive */}
              {(selectedDeposit.expenses?.length > 0 || selectedDeposit.totalExpenses > 0 || selectedDeposit.totalAdditions > 0) && (
                <div className="bg-white rounded-lg sm:rounded-xl border-2 border-orange-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-3 sm:px-5 py-3 sm:py-4 border-b border-orange-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg flex-shrink-0">
                          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">Deposit Adjustments</h3>
                          <p className="text-xs text-gray-600 hidden sm:block">Deductions and additions affecting final deposit</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {selectedDeposit.totalAdditions > 0 && (
                          <p className="text-xs sm:text-sm font-bold text-green-700">+₱{selectedDeposit.totalAdditions.toLocaleString()}</p>
                        )}
                        {selectedDeposit.totalExpenses > 0 && (
                          <p className="text-xs sm:text-sm font-bold text-red-700">-₱{selectedDeposit.totalExpenses.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
                    {/* Calculation Breakdown */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 sm:p-4 border border-gray-200">
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">Daily Sales Total</span>
                          <span className="font-bold text-blue-700">₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString()}</span>
                        </div>
                        {selectedDeposit.totalAdditions > 0 && (
                          <div className="flex justify-between items-center text-green-700">
                            <span className="font-medium">+ Additions</span>
                            <span className="font-bold">+₱{selectedDeposit.totalAdditions.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedDeposit.totalExpenses > 0 && (
                          <div className="flex justify-between items-center text-red-700">
                            <span className="font-medium">- Deductions</span>
                            <span className="font-bold">-₱{selectedDeposit.totalExpenses.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                          <span className="text-gray-900 font-bold">Expected</span>
                          <span className="font-extrabold text-base sm:text-lg text-purple-700">
                            ₱{((selectedDeposit.dailySalesTotal || 0) + (selectedDeposit.totalAdditions || 0) - (selectedDeposit.totalExpenses || 0)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-900 font-bold">Actual</span>
                          <span className="font-extrabold text-base sm:text-lg text-green-700">₱{(selectedDeposit.amount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Adjustment Items with Justifications */}
                    {selectedDeposit.expenses?.length > 0 && (
                      <div className="space-y-2 sm:space-y-3">
                        <p className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-2">
                          <span className="w-1 h-4 bg-orange-500 rounded"></span>
                          Details ({selectedDeposit.expenses.length})
                        </p>
                        <div className="space-y-2">
                          {selectedDeposit.expenses.map((expense, index) => (
                            <div key={index} className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between gap-2 sm:gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                      expense.type === 'addition' 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {expense.type === 'addition' ? '+ Addition' : '- Deduction'}
                                    </span>
                                    <span className="text-xs text-gray-500">#{index + 1}</span>
                                  </div>
                                  <p className="font-bold text-sm sm:text-base text-gray-900 mb-1 break-words">
                                    {expense.description || expense.category || 'Adjustment'}
                                  </p>
                                  {expense.justification && (
                                    <div className="mt-2 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                                      <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                                        <span className="w-1 h-3 bg-blue-500 rounded"></span>
                                        Justification
                                      </p>
                                      <p className="text-xs sm:text-sm text-blue-800 leading-relaxed break-words">{expense.justification}</p>
                                    </div>
                                  )}
                                  {expense.category && expense.description && (
                                    <p className="text-xs text-gray-500 mt-1">Category: {expense.category}</p>
                                  )}
                                </div>
                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 flex-shrink-0">
                                  <span className={`text-lg sm:text-xl font-extrabold whitespace-nowrap ${
                                    expense.type === 'addition' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {expense.type === 'addition' ? '+' : '-'}₱{(expense.amount || 0).toLocaleString()}
                                  </span>
                                  {(expense.imageUrl || expense.receiptUrl || expense.receiptImageUrl || expense.image) && (
                                    <button
                                      onClick={() => setExpenseImageUrl(expense.imageUrl || expense.receiptUrl || expense.receiptImageUrl || expense.image)}
                                      className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="View Receipt"
                                    >
                                      <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Receipt & Additional Info - Mobile Responsive */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Left: Receipt Image */}
                {selectedDeposit.receiptImageUrl && (
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-3 sm:px-5 py-2 sm:py-3 border-b border-gray-200">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
                        <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                        Deposit Receipt
                      </h3>
                    </div>
                    <div className="p-3 sm:p-4">
                      <img 
                        src={selectedDeposit.receiptImageUrl} 
                        alt="Deposit receipt" 
                        className="w-full rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(selectedDeposit.receiptImageUrl, '_blank')}
                      />
                      <p className="text-xs text-center text-gray-500 mt-2">Tap to view full size</p>
                    </div>
                  </div>
                )}

                {/* Right: Deposit Information */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-3 sm:p-5">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                      <Building className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                      Deposit Information
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-gray-100">
                        <span className="text-xs sm:text-sm text-gray-600">Date</span>
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">
                          {format(new Date(selectedDeposit.depositDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-gray-100">
                        <span className="text-xs sm:text-sm text-gray-600">Branch</span>
                        <span className="text-xs sm:text-sm font-semibold text-gray-900 text-right">
                          {branches[selectedDeposit.branchId] || 'Unknown'}
                        </span>
                      </div>
                      {selectedDeposit.bankName && (
                        <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-gray-100">
                          <span className="text-xs sm:text-sm text-gray-600">Bank</span>
                          <span className="text-xs sm:text-sm font-semibold text-gray-900">{selectedDeposit.bankName}</span>
                        </div>
                      )}
                      {selectedDeposit.referenceNumber && (
                        <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-gray-100">
                          <span className="text-xs sm:text-sm text-gray-600">Reference #</span>
                          <span className="text-xs sm:text-sm font-mono font-semibold text-gray-900 break-all text-right">{selectedDeposit.referenceNumber}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-1.5 sm:py-2">
                        <span className="text-xs sm:text-sm text-gray-600">Validation</span>
                        <span className={`inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-bold ${getValidationColor(selectedDeposit.validationStatus)}`}>
                          {selectedDeposit.validationStatus === 'match' ? '✓ Match' :
                           selectedDeposit.validationStatus === 'mismatch' ? '✗ Mismatch' : '⚠ Review'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Review Info */}
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-3 sm:p-5">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">Review Status</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-600">Current Status</span>
                        <span className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-bold border ${getStatusColor(selectedDeposit.status)}`}>
                          {selectedDeposit.status === 'approved' ? '✓ Approved' :
                           selectedDeposit.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </div>

                      {/* Submitted By */}
                      <div className="pt-2 sm:pt-3 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Submitted By</p>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#160B53] text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                            {(selectedDeposit.submittedByName || 'U')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{selectedDeposit.submittedByName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">
                              {selectedDeposit.submittedAt && format(new Date(selectedDeposit.submittedAt), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Reviewed By */}
                      {selectedDeposit.reviewedByName && (
                        <div className="pt-2 sm:pt-3 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Reviewed By</p>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm text-white flex-shrink-0 ${
                              selectedDeposit.status === 'approved' ? 'bg-green-600' : 'bg-red-600'
                            }`}>
                              {(selectedDeposit.reviewedByName || 'U')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{selectedDeposit.reviewedByName}</p>
                              <p className="text-xs text-gray-500">
                                {selectedDeposit.reviewedAt && format(new Date(selectedDeposit.reviewedAt), 'MMM dd, yyyy HH:mm')}
                              </p>
                            </div>
                          </div>
                          {selectedDeposit.reviewNotes && (
                            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs font-semibold text-blue-900 mb-1">Review Notes:</p>
                              <p className="text-xs sm:text-sm text-blue-800 leading-relaxed break-words">{selectedDeposit.reviewNotes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Anomaly Warning - Mobile Responsive */}
              {selectedDeposit.hasAnomaly && selectedDeposit.anomalyDescription && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-5">
                  <div className="flex items-start gap-2 sm:gap-4">
                    <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-red-900 mb-1 sm:mb-2">Anomaly Detected</h3>
                      <p className="text-xs sm:text-sm text-red-800 leading-relaxed break-words">{selectedDeposit.anomalyDescription}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer with Actions - Mobile Responsive */}
            <div className="bg-white border-t-2 border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 shadow-lg gap-2">
              <div className="text-xs text-gray-500 hidden sm:block">
                {selectedDeposit.status === 'submitted' ? 'Pending your review' : 'Review completed'}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {selectedDeposit.status === 'submitted' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowReviewModal(true);
                        setShowDetailsModal(false);
                      }}
                      className="border-red-300 text-red-700 hover:bg-red-50 px-3 sm:px-6 flex-1 sm:flex-none text-sm"
                    >
                      <XCircle className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Reject</span>
                    </Button>
                    <Button
                      onClick={() => {
                        setShowReviewModal(true);
                        setShowDetailsModal(false);
                      }}
                      className="bg-green-600 text-white hover:bg-green-700 px-3 sm:px-6 flex-1 sm:flex-none text-sm"
                    >
                      <CheckCircle className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Approve</span>
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 sm:px-8 flex-1 sm:flex-none text-sm"
                >
                  Close
                </Button>
              </div>
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

