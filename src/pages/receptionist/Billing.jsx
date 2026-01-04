/**
 * Billing & POS Page - Receptionist
 * For processing payments and viewing billing history
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Banknote, Calendar, Filter, Receipt, Eye, AlertCircle, Printer, X, UserPlus, Bell, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBillsByBranch,
  getDailySalesSummary,
  BILL_STATUS,
  PAYMENT_METHODS,
  createBill
} from '../../services/billingService';
import { 
  getAppointmentsByBranch, 
  APPOINTMENT_STATUS, 
  updateAppointmentStatus
} from '../../services/appointmentService';
import { getBranchById } from '../../services/branchService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES, ROUTES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BillingModalPOS from '../../components/billing/BillingModalPOS';
import ReceiptComponent from '../../components/billing/Receipt';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';

const ReceptionistBilling = () => {
  const navigate = useNavigate();
  const { currentUser, userBranch, userBranchData, userData } = useAuth();
  const printRef = useRef();

  const handlePrintReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Billing Report - ${new Date().toLocaleDateString()}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 20mm;
      }
      @media print {
        body {
          font-size: 12px;
        }
        .no-print {
          display: none !important;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
      }
    `
  });
  const [bills, setBills] = useState([]);
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState('all'); // 'all', 'service', 'product', 'mixed'
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [maxAmountFilter, setMaxAmountFilter] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dateFilterType, setDateFilterType] = useState('today'); // 'today', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'custom', 'monthYear'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc'); // Default to newest first
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // Default to 25 rows for big data

  // Sort icon helper
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-gray-600" />
      : <ArrowDown className="w-3 h-3 text-gray-600" />;
  };

  // Handle column sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Helper function to get date range based on preset type
  const getDateRange = (type, month = null, year = null) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (type) {
      case 'today':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      
      case 'thisWeek':
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        return {
          startDate: thisWeekStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      
      case 'lastWeek':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1); // Last Saturday
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6); // Start of last week
        return {
          startDate: lastWeekStart.toISOString().split('T')[0],
          endDate: lastWeekEnd.toISOString().split('T')[0]
        };
      
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: thisMonthStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: lastMonthStart.toISOString().split('T')[0],
          endDate: lastMonthEnd.toISOString().split('T')[0]
        };
      
      case 'thisYear':
        const thisYearStart = new Date(today.getFullYear(), 0, 1);
        return {
          startDate: thisYearStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      
      case 'monthYear':
        if (month && year) {
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0);
          return {
            startDate: monthStart.toISOString().split('T')[0],
            endDate: monthEnd.toISOString().split('T')[0]
          };
        }
        return { startDate: '', endDate: '' };
      
      default:
        return { startDate: '', endDate: '' };
    }
  };

  // Handle date filter type change
  const handleDateFilterTypeChange = (type) => {
    setDateFilterType(type);
    if (type === 'monthYear') {
      const range = getDateRange('monthYear', selectedMonth, selectedYear);
      setStartDateFilter(range.startDate);
      setEndDateFilter(range.endDate);
    } else if (type !== 'custom') {
      const range = getDateRange(type);
      setStartDateFilter(range.startDate);
      setEndDateFilter(range.endDate);
    } else {
      // Custom - don't auto-set dates
      setStartDateFilter('');
      setEndDateFilter('');
    }
  };

  // Handle month/year change
  const handleMonthYearChange = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    const range = getDateRange('monthYear', month, year);
    setStartDateFilter(range.startDate);
    setEndDateFilter(range.endDate);
  };
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [branchData, setBranchData] = useState(null);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [clients, setClients] = useState([]);
  const [showPendingList, setShowPendingList] = useState(false);
  const [isButtonMinimized, setIsButtonMinimized] = useState(false);
  const minimizeTimeoutRef = useRef(null);

  // Tax and service charge rates (can be configured)
  const TAX_RATE = 0; // 12% VAT - set to 0 if no tax
  const SERVICE_CHARGE_RATE = 0; // 5% service charge - set to 0 if no service charge

  // Receipt printing
  const receiptRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  useEffect(() => {
    if (userBranch) {
      fetchData();
      // Initialize with today's date range
      const todayRange = getDateRange('today');
      setStartDateFilter(todayRange.startDate);
      setEndDateFilter(todayRange.endDate);
    }
  }, [userBranch]);

  useEffect(() => {
    applyFilters();
  }, [bills, searchTerm, statusFilter, paymentMethodFilter, saleTypeFilter, startDateFilter, endDateFilter, minAmountFilter, maxAmountFilter, sortField, sortDirection, currentPage, pageSize]);

  // Auto-minimize button after showing label initially
  useEffect(() => {
    if (completedAppointments.length > 0) {
      // Show full label initially
      setIsButtonMinimized(false);
      
      // Auto-minimize after 1.5 seconds
      if (minimizeTimeoutRef.current) {
        clearTimeout(minimizeTimeoutRef.current);
      }
      
      minimizeTimeoutRef.current = setTimeout(() => {
        setIsButtonMinimized(true);
      }, 1500);
      
      return () => {
        if (minimizeTimeoutRef.current) {
          clearTimeout(minimizeTimeoutRef.current);
        }
      };
    }
  }, [completedAppointments.length]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch bills
      const billsData = await getBillsByBranch(userBranch);
      setBills(billsData);

      // Fetch completed appointments that haven't been billed yet
      const allAppointments = await getAppointmentsByBranch(userBranch);
      const completed = allAppointments.filter(apt => 
        apt.status === APPOINTMENT_STATUS.COMPLETED &&
        !billsData.some(bill => bill.appointmentId === apt.id)
      );
      setCompletedAppointments(completed);

      // Fetch daily summary
      const summary = await getDailySalesSummary(userBranch);
      setDailySummary(summary);

      // Fetch branch data for receipts
      const branch = await getBranchById(userBranch);
      setBranchData(branch);

      // Fetch services, stylists, and clients for walk-in billing
      const servicesData = await getBranchServices(userBranch);
      setServices(servicesData);

      const stylistsData = await getUsersByRole(USER_ROLES.STYLIST);
      const branchStylists = stylistsData.filter(s => s.branchId === userBranch);
      setStylists(branchStylists);

      const clientsData = await getUsersByRole(USER_ROLES.CLIENT);
      setClients(clientsData.filter(c => c.isActive));
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bills];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(bill =>
        bill.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.clientPhone?.includes(searchTerm) ||
        bill.id?.includes(searchTerm) ||
        bill.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    // Payment method filter
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(bill => bill.paymentMethod === paymentMethodFilter);
    }

    // Sale type filter
    if (saleTypeFilter !== 'all') {
      filtered = filtered.filter(bill => bill.salesType === saleTypeFilter);
    }

    // Date range filter
    if (startDateFilter) {
      const filterDate = new Date(startDateFilter);
      filterDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        billDate.setHours(0, 0, 0, 0);
        return billDate >= filterDate;
      });
    }

    if (endDateFilter) {
      const filterDate = new Date(endDateFilter);
      filterDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        return billDate <= filterDate;
      });
    }

    // Amount filters
    if (minAmountFilter) {
      filtered = filtered.filter(bill => {
        const billTotal = bill.total || 0;
        return billTotal >= parseFloat(minAmountFilter);
      });
    }

    if (maxAmountFilter) {
      filtered = filtered.filter(bill => {
        const billTotal = bill.total || 0;
        return billTotal <= parseFloat(maxAmountFilter);
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      switch (sortField) {
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt).getTime() : 0;
          bValue = b.createdAt ? new Date(b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt).getTime() : 0;
          break;
        case 'clientName':
          aValue = a.clientName?.toLowerCase() || '';
          bValue = b.clientName?.toLowerCase() || '';
          break;
        case 'total':
          aValue = a.total || 0;
          bValue = b.total || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedBills = filtered.slice(startIndex, endIndex);

    setFilteredBills(paginatedBills);
  };

  // Calculate total pages for pagination
  const totalPages = Math.ceil(bills.filter(bill => {
    // Apply the same filters to calculate total count
    let matches = true;

    if (searchTerm) {
      matches = matches && (
        bill.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.clientPhone?.includes(searchTerm) ||
        bill.id?.includes(searchTerm) ||
        bill.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      matches = matches && bill.status === statusFilter;
    }

    if (paymentMethodFilter !== 'all') {
      matches = matches && bill.paymentMethod === paymentMethodFilter;
    }

    if (saleTypeFilter !== 'all') {
      matches = matches && bill.salesType === saleTypeFilter;
    }

    if (startDateFilter) {
      const filterDate = new Date(startDateFilter);
      filterDate.setHours(0, 0, 0, 0);
      const billDate = new Date(bill.createdAt);
      billDate.setHours(0, 0, 0, 0);
      matches = matches && billDate >= filterDate;
    }

    if (endDateFilter) {
      const filterDate = new Date(endDateFilter);
      filterDate.setHours(23, 59, 59, 999);
      const billDate = new Date(bill.createdAt);
      matches = matches && billDate <= filterDate;
    }

    if (minAmountFilter) {
      matches = matches && (bill.total || 0) >= parseFloat(minAmountFilter);
    }

    if (maxAmountFilter) {
      matches = matches && (bill.total || 0) <= parseFloat(maxAmountFilter);
    }

    return matches;
  }).length / pageSize);

  const handleProcessPayment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowBillingModal(true);
  };

  const handleWalkInBilling = () => {
    // Redirect to arrivals queue where walk-ins are managed and checked in
    navigate(ROUTES.RECEPTIONIST_ARRIVALS);
  };

  const handlePOSProducts = () => {
    // Open POS modal for direct product sales (no services)
    setShowPOSModal(true);
  };

  const handleSubmitBill = async (billData) => {
    try {
      setProcessing(true);
      
      // Create the bill - combine currentUser (has uid) with userData (has firstName, lastName)
      const userForBilling = {
        ...currentUser,
        ...userData,
        uid: currentUser.uid // Ensure uid is from Firebase Auth
      };
      await createBill(billData, userForBilling);

      // Update appointment status to include billing info if needed
      // (Optional: You can add a billedAt field to appointments)

      setShowBillingModal(false);
      setSelectedAppointment(null);
      
      // Refresh data
      await fetchData();
      
      toast.success('Payment processed successfully!');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewBill = (bill) => {
    setSelectedBill(bill);
    setShowBillDetails(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      [BILL_STATUS.PAID]: 'bg-green-100 text-green-700',
      [BILL_STATUS.REFUNDED]: 'bg-red-100 text-red-700',
      [BILL_STATUS.VOIDED]: 'bg-gray-100 text-gray-700'
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      [PAYMENT_METHODS.CASH]: 'Cash',
      [PAYMENT_METHODS.CARD]: 'Card',
      [PAYMENT_METHODS.VOUCHER]: 'E-Wallet',
      [PAYMENT_METHODS.GIFT_CARD]: 'Gift Card'
    };
    return labels[method] || method;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & POS</h1>
          <p className="text-gray-600">View transactions and billing history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePOSProducts}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Banknote className="w-5 h-5" />
            Quick POS (Products Only)
          </button>
          <button
            onClick={handleWalkInBilling}
            className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Walk-in / Check-in
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> To process a new payment, go to <a href="/receptionist/arrivals" className="font-medium underline hover:text-blue-900">Arrivals & Check-ins</a> page. 
            Complete the service flow: Check-in → Start Service → Check-out (Billing).
          </p>
        </div>
      </div>

      {/* Daily Summary Cards */}
      {dailySummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-green-600 mt-1">₱{dailySummary.netRevenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Banknote className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Transactions</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{dailySummary.totalTransactions}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Discounts Given</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">₱{dailySummary.totalDiscounts?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Banknote className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Refunds</p>
                <p className="text-2xl font-bold text-red-600 mt-1">₱{dailySummary.totalRefunds?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Banknote className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Search and Filter Button */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client, phone, bill ID, receipt number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Button */}
          <button
            onClick={() => setShowFilterModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Filter"
          >
            <Filter className="w-5 h-5 text-gray-600" />
            {(statusFilter !== 'all' || paymentMethodFilter !== 'all' || saleTypeFilter !== 'all' || startDateFilter || endDateFilter || minAmountFilter || maxAmountFilter) && (
              <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                {(statusFilter !== 'all' ? 1 : 0) + (paymentMethodFilter !== 'all' ? 1 : 0) + (saleTypeFilter !== 'all' ? 1 : 0) + (startDateFilter || endDateFilter ? 1 : 0) + (minAmountFilter ? 1 : 0) + (maxAmountFilter ? 1 : 0)}
              </span>
            )}
          </button>

          {/* Print Report Button */}
          <button
            onClick={() => handlePrintReport()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5 text-gray-600" />
            Print Report
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Filter Bills</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value={BILL_STATUS.PAID}>Paid</option>
                  <option value={BILL_STATUS.REFUNDED}>Refunded</option>
                  <option value={BILL_STATUS.VOIDED}>Voided</option>
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Methods</option>
                  <option value={PAYMENT_METHODS.CASH}>Cash</option>
                  <option value={PAYMENT_METHODS.CARD}>Card</option>
                  <option value={PAYMENT_METHODS.VOUCHER}>E-Wallet</option>
                  <option value={PAYMENT_METHODS.GIFT_CARD}>Gift Card</option>
                </select>
              </div>

              {/* Sale Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sale Type
                </label>
                <select
                  value={saleTypeFilter}
                  onChange={(e) => setSaleTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="service">Services Only</option>
                  <option value="product">Products Only</option>
                  <option value="mixed">Mixed (Services + Products)</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Date Range
                </label>
                
                {/* Quick Preset Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('today')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'today'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('thisWeek')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'thisWeek'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('lastWeek')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'lastWeek'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Last Week
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('thisMonth')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'thisMonth'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('lastMonth')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'lastMonth'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('thisYear')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'thisYear'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    This Year
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('monthYear')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'monthYear'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Select Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDateFilterTypeChange('custom')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilterType === 'custom'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {/* Month/Year Picker */}
                {dateFilterType === 'monthYear' && (
                  <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Month</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => handleMonthYearChange(parseInt(e.target.value), selectedYear)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value={1}>January</option>
                        <option value={2}>February</option>
                        <option value={3}>March</option>
                        <option value={4}>April</option>
                        <option value={5}>May</option>
                        <option value={6}>June</option>
                        <option value={7}>July</option>
                        <option value={8}>August</option>
                        <option value={9}>September</option>
                        <option value={10}>October</option>
                        <option value={11}>November</option>
                        <option value={12}>December</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Year</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => handleMonthYearChange(selectedMonth, parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}

                {/* Custom Date Range Inputs */}
                {dateFilterType === 'custom' && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        min={startDateFilter || undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Display Selected Range */}
                {(dateFilterType !== 'custom' && dateFilterType !== 'monthYear') && (
                  <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Selected:</span>{' '}
                      {startDateFilter && endDateFilter
                        ? `${new Date(startDateFilter).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(endDateFilter).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'No date range selected'}
                    </p>
                  </div>
                )}
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Amount
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={minAmountFilter}
                    onChange={(e) => setMinAmountFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Amount
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={maxAmountFilter}
                    onChange={(e) => setMaxAmountFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setPaymentMethodFilter('all');
                  setDateFilterType('today');
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setMinAmountFilter('');
                  setMaxAmountFilter('');
                  // Reset to today's date range
                  const todayRange = getDateRange('today');
                  setStartDateFilter(todayRange.startDate);
                  setEndDateFilter(todayRange.endDate);
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear all filters
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bills Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredBills.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No bills found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or create a new transaction</p>
          </div>
        ) : (
          <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-2">
                      Date & Time
                      {getSortIcon('createdAt')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('clientName')}
                  >
                    <div className="flex items-center gap-2">
                      Client
                      {getSortIcon('clientName')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Services</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center gap-2">
                      Amount
                      {getSortIcon('total')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{bill.id?.slice(-8).toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{bill.createdAt?.toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">{bill.createdAt?.toLocaleTimeString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{bill.clientName}</p>
                      <p className="text-xs text-gray-500">{bill.clientPhone}</p>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const services = bill.items?.filter(item => item.type === 'service' || !item.type).length || 0;
                        const products = bill.items?.filter(item => item.type === 'product').length || 0;
                        const totalItems = bill.items?.length || 0;

                        if (services > 0 && products > 0) {
                          return (
                            <p className="text-sm text-gray-600">
                              {services} service(s), {products} product(s)
                            </p>
                          );
                        } else if (products > 0) {
                          return (
                            <p className="text-sm text-gray-600">
                              {products} product(s)
                            </p>
                          );
                        } else {
                          return (
                            <p className="text-sm text-gray-600">
                              {totalItems} service(s)
                            </p>
                          );
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">{getPaymentMethodLabel(bill.paymentMethod)}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-gray-900">₱{bill.total?.toFixed(2)}</p>
                      {bill.discount > 0 && (
                        <p className="text-xs text-green-600">-₱{bill.discount?.toFixed(2)} discount</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(bill.status)}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleViewBill(bill)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-6 py-3 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">per page</span>
              </div>
              <div className="text-sm text-gray-700">
                Showing {Math.min((currentPage - 1) * pageSize + 1, bills.length)} to {Math.min(currentPage * pageSize, bills.length)} of {bills.length} bills
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Printable Report (Hidden) */}
      <div ref={printRef} className="hidden print:block print:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Billing Report</h1>
          <p className="text-gray-600">Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
          {userBranchData && <p className="text-gray-600">{userBranchData.name} - {userBranchData.address}</p>}
        </div>

        {/* Applied Filters Summary */}
        {(searchTerm || statusFilter !== 'all' || paymentMethodFilter !== 'all' || saleTypeFilter !== 'all' || startDateFilter || endDateFilter || minAmountFilter || maxAmountFilter) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Applied Filters:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {searchTerm && <div><strong>Search:</strong> {searchTerm}</div>}
              {statusFilter !== 'all' && <div><strong>Status:</strong> {statusFilter}</div>}
              {paymentMethodFilter !== 'all' && <div><strong>Payment:</strong> {getPaymentMethodLabel(paymentMethodFilter)}</div>}
              {saleTypeFilter !== 'all' && <div><strong>Type:</strong> {saleTypeFilter === 'service' ? 'Services Only' : saleTypeFilter === 'product' ? 'Products Only' : 'Mixed'}</div>}
              {startDateFilter && <div><strong>From:</strong> {new Date(startDateFilter).toLocaleDateString()}</div>}
              {endDateFilter && <div><strong>To:</strong> {new Date(endDateFilter).toLocaleDateString()}</div>}
              {minAmountFilter && <div><strong>Min Amount:</strong> ₱{minAmountFilter}</div>}
              {maxAmountFilter && <div><strong>Max Amount:</strong> ₱{maxAmountFilter}</div>}
            </div>
          </div>
        )}

        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Transaction ID</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Date & Time</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Client</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Payment</th>
              <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.map((bill) => (
              <tr key={bill.id}>
                <td className="border border-gray-300 px-4 py-2">{bill.id?.slice(-8).toUpperCase()}</td>
                <td className="border border-gray-300 px-4 py-2">
                  {bill.createdAt?.toLocaleDateString()} {bill.createdAt?.toLocaleTimeString()}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {bill.clientName}
                  {bill.clientPhone && <br />}
                  <span className="text-xs text-gray-600">{bill.clientPhone}</span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {(() => {
                    const services = bill.items?.filter(item => item.type === 'service' || !item.type).length || 0;
                    const products = bill.items?.filter(item => item.type === 'product').length || 0;

                    if (services > 0 && products > 0) return 'Mixed';
                    if (products > 0) return 'Products';
                    return 'Services';
                  })()}
                </td>
                <td className="border border-gray-300 px-4 py-2">{getPaymentMethodLabel(bill.paymentMethod)}</td>
                <td className="border border-gray-300 px-4 py-2 text-right">₱{bill.total?.toFixed(2)}</td>
                <td className="border border-gray-300 px-4 py-2">{bill.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold">
              <td colSpan="5" className="border border-gray-300 px-4 py-2 text-right">Total:</td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                ₱{filteredBills.reduce((sum, bill) => sum + (bill.total || 0), 0).toFixed(2)}
              </td>
              <td className="border border-gray-300 px-4 py-2"></td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Report generated by {currentUser?.email || 'System'}</p>
          <p>Total records: {filteredBills.length}</p>
        </div>
      </div>

      {/* Billing Modal - POS Style */}
      <BillingModalPOS
        isOpen={showBillingModal}
        appointment={selectedAppointment}
        onClose={() => {
          setShowBillingModal(false);
          setSelectedAppointment(null);
        }}
        onSubmit={handleSubmitBill}
        loading={processing}
        services={services}
        stylists={stylists}
        clients={clients}
        serviceChargeRate={SERVICE_CHARGE_RATE}
      />

      {/* Quick POS Modal - Products Only */}
      <BillingModalPOS
        isOpen={showPOSModal}
        appointment={null} // No appointment for direct product sales
        onClose={() => setShowPOSModal(false)}
        onSubmit={handleSubmitBill}
        loading={processing}
        services={[]} // Empty services array for products-only mode
        stylists={[]} // Empty stylists array for products-only mode
        clients={clients}
        mode="products-only" // Special mode for direct product sales
      />


      {/* Bill Details Modal with Receipt */}
      {showBillDetails && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Receipt</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => setShowBillDetails(false)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              {/* Receipt Display */}
              <div className="border border-gray-200 rounded-lg">
                <ReceiptComponent ref={receiptRef} bill={selectedBill} branch={branchData} />
              </div>

              <button
                onClick={() => setShowBillDetails(false)}
                className="w-full mt-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt for printing */}
      <div className="hidden">
        <ReceiptComponent ref={receiptRef} bill={selectedBill || {}} branch={branchData} />
      </div>

      {/* Floating Pending Payments Button */}
      {completedAppointments.length > 0 && (
        <>
          <button
            onClick={() => {
              setShowPendingList(!showPendingList);
              // Toggle minimized state when clicked
              if (isButtonMinimized) {
                setIsButtonMinimized(false);
              }
            }}
            onMouseEnter={() => {
              // Clear any pending minimize
              if (minimizeTimeoutRef.current) {
                clearTimeout(minimizeTimeoutRef.current);
              }
              // Expand to show label on hover
              setIsButtonMinimized(false);
            }}
            onMouseLeave={() => {
              // Only minimize if dropdown is not open
              if (!showPendingList) {
                if (minimizeTimeoutRef.current) {
                  clearTimeout(minimizeTimeoutRef.current);
                }
                minimizeTimeoutRef.current = setTimeout(() => {
                  setIsButtonMinimized(true);
                }, 1000);
              }
            }}
            className="fixed bottom-6 right-6 z-40 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full shadow-md hover:shadow-lg flex items-center group overflow-visible"
              style={{
                animation: 'bounceIn 0.4s ease-out, pulse 2s infinite 0.4s',
                padding: isButtonMinimized ? '12px' : '12px 32px 12px 16px',
                transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
          >
            <Bell className="w-5 h-5 flex-shrink-0" />
            <div 
              className="overflow-hidden whitespace-nowrap transition-all duration-500 ease-in-out"
              style={{
                width: isButtonMinimized ? '0px' : '140px',
                opacity: isButtonMinimized ? 0 : 1,
                marginLeft: isButtonMinimized ? '0px' : '8px',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <span className="text-sm font-medium inline-block">Pending Payments</span>
            </div>
            <span 
              className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 z-10 pointer-events-none"
              style={{
                animation: 'pulse 1.5s infinite'
              }}
            >
              {completedAppointments.length}
            </span>
          </button>
          
          {/* Add custom keyframes in style tag */}
          <style>{`
            @keyframes bounceIn {
              0% {
                opacity: 0;
                transform: translateY(50px) scale(0.8);
              }
              60% {
                opacity: 1;
                transform: translateY(-5px) scale(1.05);
              }
              100% {
                transform: translateY(0) scale(1);
              }
            }
            
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
              }
              50% {
                opacity: 0.7;
              }
            }
            
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(15px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            
            .animate-fade-in {
              animation: fadeIn 0.2s ease-out;
            }
            
            .animate-slide-up {
              animation: slideUp 0.25s ease-out;
            }
          `}</style>

          {/* Pending Payments Dropdown */}
          {showPendingList && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-30 bg-black bg-opacity-25 animate-fade-in"
                onClick={() => setShowPendingList(false)}
                style={{
                  animation: 'fadeIn 0.2s ease-out'
                }}
              />
              
              {/* Dropdown Panel */}
              <div 
                className="fixed bottom-24 right-6 z-40 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden animate-slide-up"
                style={{
                  animation: 'slideUp 0.3s ease-out'
                }}
              >
                {/* Header */}
                <div className="bg-yellow-500 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-white" />
                    <h3 className="font-semibold text-white">
                      Pending Payments ({completedAppointments.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowPendingList(false)}
                    className="text-white hover:bg-yellow-600 rounded p-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* List */}
                <div className="max-h-96 overflow-y-auto">
                  {completedAppointments.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => {
                        handleProcessPayment(apt);
                        setShowPendingList(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {apt.clientName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">
                              #{apt.id.slice(-6)}
                            </p>
                            {apt.services && apt.services.length > 0 && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-xs text-gray-500">
                                  {apt.services.length} service(s)
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 ml-2" />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    Click to process payment
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ReceptionistBilling;
