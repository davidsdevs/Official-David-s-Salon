import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  getBillsByBranch, 
  getDailySalesSummary, 
  BILL_STATUS, 
  PAYMENT_METHODS,
  createBill,
  getBillById
} from '../../services/billingService';
import { getAppointmentsByBranch } from '../../services/appointmentService';
import { getBranchById } from '../../services/branchService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES, APPOINTMENT_STATUS, ROUTES } from '../../utils/constants';
import BillingModalPOS from '../../components/billing/BillingModalPOS';
import EnhancedBillingModal from '../../components/billing/EnhancedBillingModal';
import TwoStepCheckoutModal from '../../components/billing/TwoStepCheckoutModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ReceiptComponent from '../../components/billing/Receipt';
import { thermalPrinter } from '../../services/thermalPrinterService';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { 
  Banknote, UserPlus, Bell, Filter, Search, Eye, Printer, X, CheckCircle, AlertCircle,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  Receipt, XCircle
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { format } from 'date-fns';

const ReceptionistBilling = () => {
  const navigate = useNavigate();
  const { currentUser, userBranch, userData } = useAuth();
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
  const [dateFilterType, setDateFilterType] = useState('thisMonth'); // 'today', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'custom', 'monthYear'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc'); // Default to newest first
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Fixed to 10 rows per page

  // Format currency with commas
  // Using formatCurrency from helpers instead of local function

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
  const [showEnhancedBillingModal, setShowEnhancedBillingModal] = useState(false);
  const [showTwoStepCheckoutModal, setShowTwoStepCheckoutModal] = useState(false);
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedBill, setCompletedBill] = useState(null);
  const [branchData, setBranchData] = useState(null);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [clients, setClients] = useState([]);
  const [showPendingList, setShowPendingList] = useState(false);
  const [isButtonMinimized, setIsButtonMinimized] = useState(false);
  const [showReprintConfirm, setShowReprintConfirm] = useState(false);
  const [reprintingReceipt, setReprintingReceipt] = useState(false);
  const minimizeTimeoutRef = useRef(null);

  // Tax and service charge rates (can be configured)
  const TAX_RATE = 0; // 12% VAT - set to 0 if no tax
  const SERVICE_CHARGE_RATE = 0; // 5% service charge - set to 0 if no service charge

  // Receipt printing
  const receiptRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });
  const printRef = useRef();
  const handlePrintReport = useReactToPrint({
    contentRef: printRef,
  });

  useEffect(() => {
    if (userBranch) {
      fetchData();
      // Don't set date filters by default - show all bills initially
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

  // Handle reprint receipt via Bluetooth thermal printer
  const handleReprintReceipt = async () => {
    if (!completedBill) return;
    
    try {
      setReprintingReceipt(true);
      
      // Check if printer is connected
      if (!thermalPrinter.isConnected) {
        toast.error('Printer not connected. Please pair your printer first.');
        setShowReprintConfirm(false);
        return;
      }
      
      // Prepare bill data for printing
      const billData = {
        ...completedBill,
        receiptNumber: completedBill.receiptNumber || completedBill.id,
        createdAt: completedBill.createdAt,
        createdByName: completedBill.createdByName || userData?.firstName || 'Staff',
        clientName: completedBill.clientName || 'Guest',
        items: completedBill.items || [],
        subtotal: completedBill.subtotal || 0,
        discount: completedBill.discount || 0,
        discountReason: completedBill.discountReason || null,
        controlNumber: completedBill.controlNumber || null,
        promotionDiscount: completedBill.promotionDiscount || 0,
        loyaltyDiscount: completedBill.loyaltyDiscount || 0,
        total: completedBill.total || completedBill.grandTotal || 0,
        paymentMethod: completedBill.paymentMethod || 'cash',
        amountReceived: completedBill.amountReceived || 0,
        change: completedBill.change || 0
      };
      
      await thermalPrinter.printReceipt(billData, branchData);
      toast.success('Receipt printed successfully!');
      setShowReprintConfirm(false);
    } catch (error) {
      console.error('Error reprinting receipt:', error);
      toast.error('Failed to print receipt: ' + error.message);
    } finally {
      setReprintingReceipt(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch bills without filters
      console.log('🔍 Fetching bills for userBranch:', userBranch);
      const billsData = await getBillsByBranch(userBranch);
      console.log('📄 Fetched bills:', billsData?.length || 0);

      // Log details of fetched bills
      if (billsData && billsData.length > 0) {
        billsData.forEach((bill, index) => {
          console.log(`📋 Bill ${index + 1}: ID=${bill.id}, createdAt=${bill.createdAt}, branchId=${bill.branchId}, total=${bill.total}`);
        });
      }

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
    console.log('🔍 applyFilters called with:', bills.length, 'bills');
    console.log('📅 Date filters - start:', startDateFilter, 'end:', endDateFilter);

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

    // Date range filter (only if filters are set)
    if (startDateFilter && startDateFilter.trim()) {
      const filterDate = new Date(startDateFilter);
      filterDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        billDate.setHours(0, 0, 0, 0);
        return billDate >= filterDate;
      });
    }

    if (endDateFilter && endDateFilter.trim()) {
      const filterDate = new Date(endDateFilter);
      filterDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        return billDate <= filterDate;
      });
    }

    console.log('📊 After filtering:', filtered.length, 'bills remain');

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

  const handleProcessPaymentEnhanced = (appointment) => {
    setSelectedAppointment(appointment);
    setShowEnhancedBillingModal(true);
  };

  const handleProcessPaymentTwoStep = (appointment) => {
    setSelectedAppointment(appointment);
    setShowTwoStepCheckoutModal(true);
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
      const transactionId = await createBill(billData, userForBilling);
      // Fetch the full bill object (with timestamps and normalized fields)
      const fullBill = await getBillById(transactionId);

      // Update appointment status to include billing info if needed
      // (Optional: You can add a billedAt field to appointments)

      setShowBillingModal(false);
      setSelectedAppointment(null);
      
      // Refresh data
      await fetchData();
      
      toast.success('Payment processed successfully!');
      
      // Return the created bill with all the data for receipt display
      return fullBill;
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
      throw error;
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

      {/* Daily Summary Cards - Based on Filtered Bills */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Revenue</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(filteredBills
                  .filter(b => b.status === BILL_STATUS.PAID)
                  .reduce((sum, b) => sum + (b.total || 0), 0))}
              </p>
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
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {filteredBills.filter(b => b.status === BILL_STATUS.PAID).length}
              </p>
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
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {formatCurrency(filteredBills
                  .filter(b => b.status === BILL_STATUS.PAID)
                  .reduce((sum, b) => sum + (b.discount || 0), 0))}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Banknote className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Voided</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(filteredBills
                  .filter(b => b.status === BILL_STATUS.VOIDED)
                  .reduce((sum, b) => sum + (b.total || 0), 0))}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

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
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
              (statusFilter !== 'all' || paymentMethodFilter !== 'all' || saleTypeFilter !== 'all' || startDateFilter || endDateFilter || minAmountFilter || maxAmountFilter)
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            title={`Filter - ${filteredBills.length} bills`}
          >
            <Filter className="w-5 h-5" />
            {filteredBills.length > 0 && (
              <span className="bg-primary-600 text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                {filteredBills.length}
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
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(bill.total)}</p>
                      {bill.discount > 0 && (
                        <p className="text-xs text-green-600">-{formatCurrency(bill.discount)} discount</p>
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
        {totalPages > 0 && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              {/* Top row: Items per page and page info */}
              <div className="flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value={10}>10</option>
                  </select>
                  <span className="text-xs text-gray-600">per page</span>
                </div>

                <div className="text-xs text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{Math.min((currentPage - 1) * pageSize + 1, bills.length)}</span> to{' '}
                  <span className="font-semibold text-gray-900">{Math.min(currentPage * pageSize, bills.length)}</span> of{' '}
                  <span className="font-semibold text-gray-900">{bills.length.toLocaleString()}</span> bills
                </div>
              </div>

              {/* Bottom row: Navigation buttons */}
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {totalPages > 0 && (
                    <>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1.5 text-xs min-w-[32px] rounded border transition-colors ${
                              currentPage === pageNum 
                                ? 'bg-primary-600 text-white border-primary-600 font-semibold' 
                                : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {totalPages > 5 && (
                        <span className="px-2 text-xs text-gray-500">
                          ... of {totalPages}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Next page"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Last page"
                >
                  Last
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printable Report (Hidden) */}
      <div ref={printRef} className="hidden print:block print:p-8">
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 1cm;
            }
            .page-break {
              page-break-before: always;
            }
            .no-page-break {
              page-break-inside: avoid;
            }
          }
        `}</style>

        {/* Header */}
        <div className="text-center mb-6 no-page-break">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Billing Report</h1>
          {branchData && <p className="text-gray-600">{branchData.name || branchData.branchName}</p>}
          {branchData && branchData.address && <p className="text-sm text-gray-500">{branchData.address}</p>}
        </div>

        {/* Applied Filters Summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 no-page-break">
          <h3 className="font-bold text-gray-900 mb-3 text-sm">FILTERS APPLIED:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {searchTerm && <div><strong>Search:</strong> {searchTerm}</div>}
            {statusFilter !== 'all' && <div><strong>Status:</strong> {statusFilter.toUpperCase()}</div>}
            {paymentMethodFilter !== 'all' && <div><strong>Payment:</strong> {getPaymentMethodLabel(paymentMethodFilter)}</div>}
            {saleTypeFilter !== 'all' && <div><strong>Type:</strong> {saleTypeFilter === 'service' ? 'Services Only' : saleTypeFilter === 'product' ? 'Products Only' : 'Mixed'}</div>}
            {startDateFilter && <div><strong>From:</strong> {new Date(startDateFilter).toLocaleDateString()}</div>}
            {endDateFilter && <div><strong>To:</strong> {new Date(endDateFilter).toLocaleDateString()}</div>}
            {minAmountFilter && <div><strong>Min Amount:</strong> {formatCurrency(parseFloat(minAmountFilter))}</div>}
            {maxAmountFilter && <div><strong>Max Amount:</strong> {formatCurrency(parseFloat(maxAmountFilter))}</div>}
            {(!searchTerm && statusFilter === 'all' && paymentMethodFilter === 'all' && saleTypeFilter === 'all' && !startDateFilter && !endDateFilter && !minAmountFilter && !maxAmountFilter) && (
              <div className="col-span-2"><strong>No filters applied</strong> - Showing all records</div>
            )}
            <div><strong>Total Records:</strong> {filteredBills.length}</div>
          </div>
        </div>

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
                <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(bill.total)}</td>
                <td className="border border-gray-300 px-4 py-2">{bill.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold">
              <td colSpan="5" className="border border-gray-300 px-4 py-2 text-right">Total:</td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                {formatCurrency(filteredBills.reduce((sum, bill) => sum + (bill.total || 0), 0))}
              </td>
              <td className="border border-gray-300 px-4 py-2"></td>
            </tr>
          </tfoot>
        </table>

        {/* Report Footer - Generator Info */}
        <div className="mt-8 pt-4 border-t-2 border-gray-300 text-xs text-gray-600">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p><strong>Generated By:</strong> {userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : currentUser?.email || 'System'}</p>
              <p><strong>Position:</strong> Receptionist</p>
            </div>
            <div className="text-right">
              <p><strong>Generated On:</strong> {format(new Date(), 'MMMM dd, yyyy')}</p>
              <p><strong>Time:</strong> {format(new Date(), 'hh:mm a')}</p>
            </div>
          </div>
          <div className="text-center mt-4 text-gray-500">
            <p>Page 1 of 1 | {branchData?.name || branchData?.branchName} - Billing Report</p>
          </div>
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

      {/* Enhanced Billing Modal with Tax & Loyalty */}
      <EnhancedBillingModal
        isOpen={showEnhancedBillingModal}
        billData={selectedAppointment}
        onClose={() => {
          setShowEnhancedBillingModal(false);
          setSelectedAppointment(null);
        }}
        onSubmit={handleSubmitBill}
        loading={processing}
      />

      {/* Two-Step Checkout Modal - Reduced Cognitive Overload */}
      <TwoStepCheckoutModal
        isOpen={showTwoStepCheckoutModal}
        billData={selectedAppointment}
        onClose={() => {
          setShowTwoStepCheckoutModal(false);
          setSelectedAppointment(null);
        }}
        onSubmit={handleSubmitBill}
        loading={processing}
      />

      {/* Quick POS Modal - Products Only */}
      <BillingModalPOS
        isOpen={showPOSModal}
        appointment={null} // No appointment for direct product sales
        onClose={(billData) => {
          setShowPOSModal(false);
          
          // If bill data is passed, show the receipt modal
          if (billData && billData.id) {
            setCompletedBill(billData);
            setShowReceiptModal(true);
          }
        }}
        onSubmit={handleSubmitBill}
        loading={processing}
        services={[]} // Empty services array for products-only mode
        stylists={stylists} // Pass stylists for commissioner selection
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

      {/* Receipt Modal - Shown after Quick POS transaction */}
      {showReceiptModal && completedBill && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Payment Successful!</h3>
                  <p className="text-sm text-gray-600">Transaction #{completedBill.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  setCompletedBill(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div ref={receiptRef}>
                <ReceiptComponent bill={completedBill} branch={branchData} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  const bill = completedBill;
                  const branch = branchData;
                  // Get services and products from items
                  const services = bill.items?.filter(item => item.type === 'service') || [];
                  const products = bill.items?.filter(item => item.type === 'product') || [];

                  // Format date
                  const formatDate = (date) => {
                    if (!date) return 'N/A';
                    const d = date.toDate ? date.toDate() : new Date(date);
                    return d.toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });
                  };

                  // Get client type label
                  const getClientTypeLabel = (type) => {
                    switch(type) {
                      case 'X': return 'New';
                      case 'R': return 'Regular';
                      case 'TR': return 'Transfer';
                      default: return type || 'Regular';
                    }
                  };

                  // Build services HTML
                  let servicesHtml = '';
                  services.forEach(service => {
                    const qty = service.quantity > 1 ? ` x${service.quantity}` : '';
                    const price = formatCurrency(service.price * (service.quantity || 1));
                    servicesHtml += `
                      <div class="item">
                        <div class="item-name">${service.name}${qty}</div>
                        <div class="item-price">₱${price}</div>
                      </div>
                      ${service.stylistName ? `<div class="item-detail">Stylist: ${service.stylistName}</div>` : ''}
                      ${service.clientType ? `<div class="item-detail">Client Type: ${getClientTypeLabel(service.clientType)}</div>` : ''}
                      ${service.adjustment && service.adjustment !== 0 ? `<div class="item-detail">Adjustment: ${service.adjustment > 0 ? '+' : ''}${formatCurrency(service.adjustment)}${service.adjustmentReason ? ` (${service.adjustmentReason})` : ''}</div>` : ''}
                    `;
                  });

                  // Build products HTML
                  let productsHtml = '';
                  products.forEach(product => {
                    const qty = product.quantity > 1 ? ` x${product.quantity}` : '';
                    const price = formatCurrency(product.price * (product.quantity || 1));
                    productsHtml += `
                      <div class="item">
                        <div class="item-name">${product.name}${qty}</div>
                        <div class="item-price">₱${price}</div>
                      </div>
                    `;
                  });

                  // Build service product charges HTML
                  let serviceProductChargesHtml = '';
                  if (bill.serviceProductCharges && bill.serviceProductCharges.length > 0) {
                    serviceProductChargesHtml = `<div class="section-title">SERVICE PRODUCT USAGE</div>`;
                    bill.serviceProductCharges.forEach(charge => {
                      serviceProductChargesHtml += `
                        <div class="item">
                          <div class="item-name">${charge.productName}</div>
                          <div class="item-price">${formatCurrency(charge.charge || 0)}</div>
                        </div>
                        <div class="item-detail">${charge.usageDisplay || ''}</div>
                      `;
                    });
                  }

                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>Receipt - ${bill.receiptNumber || 'Transaction'}</title>
                      <style>
                        @page {
                          size: 58mm auto;
                          margin: 0;
                        }
                        * { 
                          margin: 0; 
                          padding: 0; 
                          box-sizing: border-box; 
                        }
                        html, body {
                          width: 58mm;
                          max-width: 58mm;
                          margin: 0 auto;
                          padding: 3mm;
                          font-family: 'Courier New', 'Lucida Console', monospace;
                          font-size: 8pt;
                          line-height: 1.2;
                          color: #000;
                          background: #fff;
                          -webkit-print-color-adjust: exact;
                          print-color-adjust: exact;
                        }
                        .receipt {
                          width: 100%;
                        }
                        .header {
                          text-align: center;
                          margin-bottom: 2mm;
                          padding-bottom: 2mm;
                          border-bottom: 1px dashed #000;
                        }
                        .salon-logo {
                          width: 35mm;
                          height: auto;
                          margin: 0 auto 2mm auto;
                          display: block;
                          filter: grayscale(100%) contrast(1.2);
                        }
                        .branch-name {
                          font-size: 9pt;
                          margin-bottom: 1mm;
                        }
                        .branch-address {
                          font-size: 7pt;
                          margin-bottom: 2mm;
                        }
                        .receipt-title {
                          font-size: 9pt;
                          font-weight: bold;
                          margin-top: 2mm;
                        }
                        .info-section {
                          margin: 2mm 0;
                          padding: 2mm 0;
                          border-bottom: 1px dashed #000;
                        }
                        .info-row {
                          display: flex;
                          justify-content: space-between;
                          margin: 0.5mm 0;
                          font-size: 7pt;
                        }
                        .info-label {
                          color: #333;
                        }
                        .info-value {
                          font-weight: bold;
                          text-align: right;
                          max-width: 55%;
                          word-break: break-word;
                        }
                        .section-title {
                          font-size: 8pt;
                          font-weight: bold;
                          margin: 2mm 0 1mm 0;
                          text-align: center;
                          border-top: 1px dashed #000;
                          border-bottom: 1px dashed #000;
                          padding: 1mm 0;
                        }
                        .item {
                          display: flex;
                          justify-content: space-between;
                          margin: 1mm 0;
                          font-size: 7pt;
                        }
                        .item-name {
                          flex: 1;
                          word-break: break-word;
                        }
                        .item-price {
                          font-weight: bold;
                          text-align: right;
                          min-width: 12mm;
                        }
                        .item-detail {
                          font-size: 6pt;
                          color: #555;
                          margin-left: 2mm;
                          margin-bottom: 0.5mm;
                        }
                        .totals-section {
                          margin-top: 2mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                        }
                        .total-row {
                          display: flex;
                          justify-content: space-between;
                          margin: 0.5mm 0;
                          font-size: 7pt;
                        }
                        .total-row.grand-total {
                          font-size: 10pt;
                          font-weight: bold;
                          border-top: 1px solid #000;
                          padding-top: 1mm;
                          margin-top: 1mm;
                        }
                        .total-row.discount {
                          color: #006600;
                        }
                        .payment-section {
                          margin-top: 2mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                        }
                        .change-row {
                          font-size: 9pt;
                          font-weight: bold;
                          background: #eee;
                          padding: 1mm;
                          margin: 1mm 0;
                        }
                        .notes-section {
                          margin-top: 2mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                          font-size: 7pt;
                        }
                        .footer {
                          text-align: center;
                          margin-top: 3mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                          font-size: 7pt;
                        }
                        .footer-thanks {
                          font-size: 8pt;
                          font-weight: bold;
                          margin-bottom: 1mm;
                        }
                        .footer-note {
                          margin: 1mm 0;
                        }
                        .footer-ids {
                          margin-top: 2mm;
                          font-size: 7pt;
                        }
                        @media print {
                          html, body {
                            width: 58mm !important;
                            max-width: 58mm !important;
                            min-width: 58mm !important;
                            padding: 2mm !important;
                            margin: 0 !important;
                          }
                        }
                        @media screen {
                          html, body {
                            background: #f5f5f5;
                          }
                          .receipt {
                            background: #fff;
                            box-shadow: 0 0 10px rgba(0,0,0,0.1);
                            padding: 3mm;
                          }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="receipt">
                        <div class="header">
                          <img src="/logo.jpg" alt="David's Salon" class="salon-logo" />
                          <div class="branch-name">${branch?.name || branch?.branchName || bill.branchName || 'Branch'}</div>
                          ${branch?.address ? `<div class="branch-address">${branch.address}</div>` : ''}
                          <div class="receipt-title">OFFICIAL RECEIPT</div>
                        </div>

                        <div class="info-section">
                          <div class="info-row">
                            <span class="info-label">Receipt No:</span>
                            <span class="info-value">#${bill.receiptNumber || bill.id}</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Transaction ID:</span>
                            <span class="info-value">${bill.id || 'N/A'}</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Date:</span>
                            <span class="info-value">${formatDate(bill.createdAt)}</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Cashier:</span>
                            <span class="info-value">${bill.createdByName || 'Staff'}</span>
                          </div>
                        </div>

                        <div class="info-section">
                          <div class="info-row">
                            <span class="info-label">Customer:</span>
                            <span class="info-value">${bill.clientName || 'Guest'}</span>
                          </div>
                          ${bill.clientPhone ? `
                          <div class="info-row">
                            <span class="info-label">Phone:</span>
                            <span class="info-value">${bill.clientPhone}</span>
                          </div>
                          ` : ''}
                          ${bill.clientEmail ? `
                          <div class="info-row">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${bill.clientEmail}</span>
                          </div>
                          ` : ''}
                        </div>

                        ${services.length > 0 ? `
                        <div class="section-title">SERVICES</div>
                        ${servicesHtml}
                        ` : ''}

                        ${products.length > 0 ? `
                        <div class="section-title">PRODUCTS</div>
                        ${productsHtml}
                        ` : ''}

                        ${serviceProductChargesHtml}

                        <div class="totals-section">
                          <div class="total-row">
                            <span>Subtotal:</span>
                            <span>${formatCurrency(bill.subtotal || 0)}</span>
                          </div>
                          ${bill.serviceProductChargeTotal > 0 ? `
                          <div class="total-row">
                            <span>Product Usage:</span>
                            <span>${formatCurrency(bill.serviceProductChargeTotal)}</span>
                          </div>
                          ` : ''}
                          ${bill.promotionDiscount > 0 ? `
                          <div class="total-row discount">
                            <span>Promo (${bill.promotionCode}):</span>
                            <span>-${formatCurrency(bill.promotionDiscount)}</span>
                          </div>
                          ` : ''}
                          ${bill.discount > 0 ? `
                          <div class="total-row discount">
                            <span>${bill.discountReason === 'Senior' ? `Senior Citizen${bill.discountType === 'percent' && bill.discountValue ? ` (${bill.discountValue}%)` : ''}` : bill.discountReason === 'PWD' ? `PWD Discount${bill.discountType === 'percent' && bill.discountValue ? ` (${bill.discountValue}%)` : ''}` : 'Discount'}:</span>
                            <span>-${formatCurrency(bill.discount)}</span>
                          </div>
                          ${(bill.discountReason === 'Senior' || bill.discountReason === 'PWD') && bill.controlNumber ? `
                          <div class="total-row" style="font-size: 6pt; font-style: italic;">
                            <span>  ID/Control No:</span>
                            <span>${bill.controlNumber}</span>
                          </div>
                          ` : ''}
                          ` : ''}
                          ${bill.loyaltyPointsUsed > 0 ? `
                          <div class="total-row discount">
                            <span>Points Used:</span>
                            <span>-${formatCurrency(bill.loyaltyPointsUsed)}</span>
                          </div>
                          ` : ''}
                          <div class="total-row grand-total">
                            <span>TOTAL:</span>
                            <span>${formatCurrency(bill.total || 0)}</span>
                          </div>
                        </div>

                        <div class="payment-section">
                          <div class="total-row">
                            <span>Payment Method:</span>
                            <span>${bill.paymentMethod ? bill.paymentMethod.charAt(0).toUpperCase() + bill.paymentMethod.slice(1) : 'Cash'}</span>
                          </div>
                          ${bill.paymentMethod === 'cash' && bill.amountReceived ? `
                          <div class="total-row">
                            <span>Amount Received:</span>
                            <span>${formatCurrency(bill.amountReceived)}</span>
                          </div>
                          <div class="total-row change-row">
                            <span>Change:</span>
                            <span>${formatCurrency(bill.change || 0)}</span>
                          </div>
                          ` : ''}
                          ${bill.paymentReference ? `
                          <div class="total-row">
                            <span>Reference:</span>
                            <span>${bill.paymentReference}</span>
                          </div>
                          ` : ''}
                        </div>

                        ${bill.notes ? `
                        <div class="notes-section">
                          <strong>Notes:</strong> ${bill.notes}
                        </div>
                        ` : ''}

                        <div class="footer">
                          <div class="footer-thanks">THANK YOU FOR CHOOSING DAVID'S SALON!</div>
                          <div class="footer-note">This serves as your official receipt.</div>
                          <div class="footer-note">Please keep this for your records.</div>
                          <div class="footer-ids">
                            <div>Transaction ID: ${bill.id}</div>
                            <div>Receipt No: ${bill.receiptNumber || bill.id}</div>
                          </div>
                        </div>
                      </div>
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                  setTimeout(() => { printWindow.print(); }, 250);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                title="Open print preview (for PDF/other printers)"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                type="button"
                onClick={() => setShowReprintConfirm(true)}
                disabled={!thermalPrinter.isConnected}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  thermalPrinter.isConnected 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={thermalPrinter.isConnected ? 'Print via Bluetooth' : 'Printer not connected'}
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  setCompletedBill(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <div key={apt.id} className="border-b border-gray-100 last:border-b-0">
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              handleProcessPayment(apt);
                              setShowPendingList(false);
                            }}
                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            Standard Billing
                          </button>
                          <button
                            onClick={() => {
                              handleProcessPaymentTwoStep(apt);
                              setShowPendingList(false);
                            }}
                            className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                          >
                            2-Step Checkout
                          </button>
                          <button
                            onClick={() => {
                              handleProcessPaymentEnhanced(apt);
                              setShowPendingList(false);
                            }}
                            className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                          >
                            Enhanced Billing
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    Choose billing method: Standard, 2-Step Checkout (recommended), or Enhanced (with tax & loyalty)
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Reprint Confirmation Modal */}
      <ConfirmModal
        isOpen={showReprintConfirm}
        onClose={() => setShowReprintConfirm(false)}
        onConfirm={handleReprintReceipt}
        title="Reprint Receipt"
        message="Are you sure you want to print this receipt again?"
        confirmText={reprintingReceipt ? "Printing..." : "Yes, Print"}
        cancelText="Cancel"
        type="info"
        loading={reprintingReceipt}
      />
    </div>
  );
};

export default ReceptionistBilling;
