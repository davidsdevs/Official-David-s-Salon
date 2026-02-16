/**
 * Billing Management Page - Branch Manager
 * View all bills, void transactions, and manage billing
 *
 * Features:
 * - File upload with downloadable CSV template
 * - Payment methods matching receptionist POS
 * - Cashiers filter limited to receptionists only
 * - CSV import modal with template download
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Banknote, Calendar, Receipt, Eye, RefreshCw, XCircle, Download, Printer, User, CheckCircle, AlertCircle, Upload, FileText, BarChart3, X, Filter, ChevronUp, ChevronDown, ArrowUpDown, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBillsByBranch,
  getDailySalesSummary,
  voidBill,
  getBillingLogs,
  BILL_STATUS,
  PAYMENT_METHODS,
  createBill
} from '../../services/billingService';
import { getBranchById } from '../../services/branchService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ReceiptComponent from '../../components/billing/Receipt';
import BIRReceiptBatchModal from '../../components/billing/BIRReceiptBatchModal';
import { getBIRReceiptBatches, getActiveBIRReceiptBatch } from '../../services/birReceiptService';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { exportToExcel } from '../../utils/excelExport';
import { formatDate, formatTime, formatNumberWithCommas, formatCurrency } from '../../utils/helpers';

const BranchManagerBilling = () => {
  const { currentUser, userBranch, userBranchData, userData } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [maxAmountFilter, setMaxAmountFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [receiptNumberFilter, setReceiptNumberFilter] = useState('');
  const [salesTypeFilter, setSalesTypeFilter] = useState('all');
  const [discountFilter, setDiscountFilter] = useState('all'); // 'all', 'with-discount', 'senior', 'pwd', 'no-discount'
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [dailySummary, setDailySummary] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billLogs, setBillLogs] = useState([]);
  const [branchData, setBranchData] = useState(null);
  const [cashiers, setCashiers] = useState([]);
  
  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [witnessEmail, setWitnessEmail] = useState('');
  const [witnessPassword, setWitnessPassword] = useState('');
  const [verifyingWitness, setVerifyingWitness] = useState(false);
  const [witnessVerified, setWitnessVerified] = useState(false);
  const [witnessInfo, setWitnessInfo] = useState(null);
  

  // CSV Import modal
  const [showImportModal, setShowImportModal] = useState(false);

  // BIR Receipt Batch modal
  const [showBIRBatchModal, setShowBIRBatchModal] = useState(false);
  
  // BIR Receipt Batch summary data
  const [birBatchSummary, setBirBatchSummary] = useState(null);
  const [activeBirBatch, setActiveBirBatch] = useState(null);

  // Receipt printing
  const receiptRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  useEffect(() => {
    if (userBranch) {
      fetchData();
      fetchBranchData();
      fetchCashiers();
      fetchBIRBatchSummary();
    }
  }, [userBranch]);

  // Fetch BIR Receipt Batch summary
  const fetchBIRBatchSummary = async () => {
    try {
      const [batches, active] = await Promise.all([
        getBIRReceiptBatches(userBranch),
        getActiveBIRReceiptBatch(userBranch)
      ]);
      
      // Calculate summary
      const summary = {
        totalBatches: batches.length,
        totalReceipts: batches.reduce((sum, b) => sum + b.totalReceipts, 0),
        usedReceipts: batches.reduce((sum, b) => sum + b.usedReceipts, 0),
        availableReceipts: batches.filter(b => b.status === 'active').reduce((sum, b) => sum + b.remainingReceipts, 0)
      };
      
      setBirBatchSummary(summary);
      setActiveBirBatch(active);
    } catch (error) {
      console.error('Error fetching BIR batch summary:', error);
    }
  };

  // Fetch cashiers for filter (Receptionists POS only)
  const fetchCashiers = async () => {
    try {
      const receptionists = await getUsersByRole(USER_ROLES.RECEPTIONIST);
      const allCashiers = receptionists
        .filter(user => user.isActive && (user.branchId === userBranch || !user.branchId))
        .map(user => ({
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
        }));
      setCashiers(allCashiers);
    } catch (error) {
      console.error('Error fetching cashiers:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const billsData = await getBillsByBranch(userBranch);
      setBills(billsData);

      const summary = await getDailySalesSummary(userBranch);
      setDailySummary(summary);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchData = async () => {
    try {
      const data = await getBranchById(userBranch);
      setBranchData(data);
    } catch (error) {
      console.error('Error fetching branch data:', error);
    }
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // Search filter
    if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          bill.clientName?.toLowerCase().includes(searchLower) ||
        bill.clientPhone?.includes(searchTerm) ||
          bill.id?.includes(searchTerm) ||
          bill.receiptNumber?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && bill.status !== statusFilter) {
        return false;
      }

      // Payment method filter
      if (paymentMethodFilter !== 'all' && bill.paymentMethod !== paymentMethodFilter) {
        return false;
      }

      // Receipt number filter
      if (receiptNumberFilter) {
        if (!bill.receiptNumber || !bill.receiptNumber.toLowerCase().includes(receiptNumberFilter.toLowerCase())) {
          return false;
        }
      }

      // Cashier filter
      if (cashierFilter !== 'all' && bill.createdBy !== cashierFilter) {
        return false;
      }

      // Sales type filter
      if (salesTypeFilter !== 'all' && bill.salesType !== salesTypeFilter) {
        return false;
      }

      // Discount filter
      if (discountFilter !== 'all') {
        const hasDiscount = (bill.discount || 0) > 0;
        const isSenior = bill.discountReason === 'Senior';
        const isPWD = bill.discountReason === 'PWD';
        
        // Debug logging
        if (discountFilter === 'senior' || discountFilter === 'pwd') {
          console.log('🔍 Discount filter check:', {
            billId: bill.id,
            discountFilter,
            discountReason: bill.discountReason,
            discount: bill.discount,
            isSenior,
            isPWD
          });
        }
        
        if (discountFilter === 'with-discount' && !hasDiscount) {
          return false;
        } else if (discountFilter === 'senior' && !isSenior) {
          return false;
        } else if (discountFilter === 'pwd' && !isPWD) {
          return false;
        } else if (discountFilter === 'no-discount' && hasDiscount) {
          return false;
        }
      }

      // Date range filters
      if (startDateFilter) {
        const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
        const filterDate = new Date(startDateFilter);
        filterDate.setHours(0, 0, 0, 0);
        if (billDate < filterDate) return false;
      }

      if (endDateFilter) {
        const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
        const filterDate = new Date(endDateFilter);
        filterDate.setHours(23, 59, 59, 999);
        if (billDate > filterDate) return false;
      }

      // Amount filters
      const billTotal = bill.total || 0;
      if (minAmountFilter && billTotal < parseFloat(minAmountFilter)) {
        return false;
      }

      if (maxAmountFilter && billTotal > parseFloat(maxAmountFilter)) {
        return false;
      }

      return true;
    });
  }, [bills, searchTerm, statusFilter, paymentMethodFilter, startDateFilter, endDateFilter, minAmountFilter, maxAmountFilter, cashierFilter, receiptNumberFilter, salesTypeFilter, discountFilter]);

  // Sort bills
  const sortedBills = useMemo(() => {
    const sorted = [...filteredBills];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumn) {
        case 'clientName':
          aValue = a.clientName || '';
          bValue = b.clientName || '';
          break;
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt) : new Date(0);
          bValue = b.createdAt ? new Date(b.createdAt) : new Date(0);
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'total':
          aValue = a.total || 0;
          bValue = b.total || 0;
          break;
        case 'paymentMethod':
          aValue = a.paymentMethod || '';
          bValue = b.paymentMethod || '';
          break;
        case 'receiptNumber':
          aValue = a.receiptNumber || '';
          bValue = b.receiptNumber || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredBills, sortColumn, sortDirection]);

  // Calculate summary from filtered bills
  const filteredSummary = useMemo(() => {
    let netRevenue = 0;
    let grossRevenue = 0;
    let totalDiscounts = 0;
    let totalVoided = 0;
    let paidTransactions = 0;

    filteredBills.forEach(bill => {
      if (bill.status === 'voided') {
        totalVoided += bill.total || 0;
      } else if (bill.status === 'paid') {
        paidTransactions++;
        grossRevenue += bill.total || 0;
        totalDiscounts += bill.discount || 0;
        netRevenue += (bill.total || 0) - (bill.discount || 0);
      }
    });

    return {
      netRevenue,
      grossRevenue,
      totalDiscounts,
      totalVoided,
      totalTransactions: paidTransactions,
      voidedTransactions: filteredBills.filter(b => b.status === 'voided').length
    };
  }, [filteredBills]);

  // Pagination
  const totalPages = Math.ceil(sortedBills.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBills = sortedBills.slice(startIndex, endIndex);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setMinAmountFilter('');
    setMaxAmountFilter('');
    setCashierFilter('all');
    setReceiptNumberFilter('');
    setSalesTypeFilter('all');
    setDiscountFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || paymentMethodFilter !== 'all' ||
    startDateFilter || endDateFilter || minAmountFilter || maxAmountFilter ||
    cashierFilter !== 'all' || receiptNumberFilter || salesTypeFilter !== 'all' || discountFilter !== 'all';

  const handleExportCSV = () => {
    if (!sortedBills.length) {
      toast.error('No bills to export');
      return;
    }

    try {
      const branchName = branchData?.name || branchData?.branchName || userBranchData?.name || userBranchData?.branchName || 'Branch';
      const sanitizedBranchName = branchName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      
      // Build filter suffix for filename
      const filterParts = [];
      if (statusFilter !== 'all') filterParts.push(`status-${statusFilter}`);
      if (paymentMethodFilter !== 'all') filterParts.push(`payment-${paymentMethodFilter}`);
      if (startDateFilter) filterParts.push(`from-${startDateFilter}`);
      if (endDateFilter) filterParts.push(`to-${endDateFilter}`);
      const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';
      
      // Generate formatted filename
      const filename = `bills_${sanitizedBranchName}_${dateStr}_${timeStr}${filterSuffix}.csv`;
      
      // CSV Headers
      const headers = [
        'Transaction ID',
        'Receipt #',
        'Date',
        'Time',
        'Client Name',
        'Client Phone',
        'Client Email',
        'Payment Method',
        'Sales Type',
        'Subtotal (₱)',
        'Discount (₱)',
        'Tax (₱)',
        'Total Amount (₱)',
        'Items Count',
        'Status',
        'Cashier',
        'Notes'
      ];
      
      // Format bills data
      const csvRows = [headers.join(',')];
      
      sortedBills.forEach(bill => {
        const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
        const dateStr = formatDate(billDate, 'MMM dd, yyyy');
        const timeStr = formatTime(billDate);
        const itemsCount = bill.items ? bill.items.length : 0;
        
        // Escape values that contain commas
        const escapeCSV = (value) => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        const row = [
          escapeCSV(bill.id || ''),
          escapeCSV(bill.receiptNumber || 'N/A'),
          escapeCSV(dateStr),
          escapeCSV(timeStr),
          escapeCSV(bill.clientName || 'Walk-in'),
          escapeCSV(bill.clientPhone || ''),
          escapeCSV(bill.client?.email || ''),
          escapeCSV(getPaymentMethodLabel(bill.paymentMethod)),
          escapeCSV(bill.salesType ? bill.salesType.charAt(0).toUpperCase() + bill.salesType.slice(1) : 'Service'),
          escapeCSV((bill.subtotal || 0).toFixed(2)),
          escapeCSV((bill.discount || 0).toFixed(2)),
          escapeCSV((bill.tax || 0).toFixed(2)),
          escapeCSV((bill.total || 0).toFixed(2)),
          escapeCSV(itemsCount),
          escapeCSV(bill.status || 'pending'),
          escapeCSV(bill.createdByName || 'Unknown'),
          escapeCSV(bill.notes || '')
        ];
        
        csvRows.push(row.join(','));
      });
      
      // Create CSV content
      const csvContent = csvRows.join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${sortedBills.length} bills to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV file');
    }
  };

  const handleImportCSV = () => {
    setShowImportModal(true);
  };

  const downloadCSVTemplate = () => {
    // Create sample CSV template
    const headers = [
      'Client Name',
      'Client Phone',
      'Client Email',
      'Receipt Number',
      'Payment Method',
      'Sales Type',
      'Subtotal (₱)',
      'Discount (₱)',
      'Tax (₱)',
      'Total Amount (₱)',
      'Notes'
    ];

    const sampleData = [
      'John Doe',
      '+639123456789',
      'john@example.com',
      'REC001',
      'Cash',
      'Service',
      '500.00',
      '0.00',
      '0.00',
      '500.00',
      'Sample transaction'
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'billing_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Template downloaded successfully');
  };

  const proceedWithImport = () => {
    setShowImportModal(false);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          toast.error('CSV file must have at least a header row and one data row');
          return;
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Find column indices
        const fieldMap = {};
        headers.forEach((header, index) => {
          const headerLower = header.toLowerCase();
          if (headerLower.includes('receipt') && headerLower.includes('#')) fieldMap.receiptNumber = index;
          if (headerLower.includes('date')) fieldMap.date = index;
          if (headerLower.includes('time')) fieldMap.time = index;
          if (headerLower.includes('client') && headerLower.includes('name')) fieldMap.clientName = index;
          if (headerLower.includes('client') && headerLower.includes('phone')) fieldMap.clientPhone = index;
          if (headerLower.includes('client') && headerLower.includes('email')) fieldMap.clientEmail = index;
          if (headerLower.includes('payment') && headerLower.includes('method')) fieldMap.paymentMethod = index;
          if (headerLower.includes('subtotal')) fieldMap.subtotal = index;
          if (headerLower.includes('discount')) fieldMap.discount = index;
          if (headerLower.includes('tax')) fieldMap.tax = index;
          if (headerLower.includes('total') && !headerLower.includes('sub')) fieldMap.total = index;
          if (headerLower.includes('status')) fieldMap.status = index;
          if (headerLower.includes('notes')) fieldMap.notes = index;
        });

        // Validate required fields
        if (fieldMap.clientName === undefined || fieldMap.total === undefined) {
          toast.error('CSV must contain Client Name and Total Amount columns');
          return;
        }

        // Parse data rows
        const importData = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
          const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

          try {
            const clientName = cleanValues[fieldMap.clientName]?.trim();
            const totalStr = cleanValues[fieldMap.total]?.replace(/[₱,]/g, '').trim();
            const total = parseFloat(totalStr) || 0;

            if (!clientName || total <= 0) {
              errorCount++;
              continue;
            }

            // Parse payment method
            let paymentMethod = PAYMENT_METHODS.CASH;
            if (fieldMap.paymentMethod !== undefined) {
              const pmStr = cleanValues[fieldMap.paymentMethod]?.toLowerCase().trim();
              if (pmStr.includes('card')) paymentMethod = PAYMENT_METHODS.CARD;
              else if (pmStr.includes('voucher')) paymentMethod = PAYMENT_METHODS.VOUCHER;
              else if (pmStr.includes('gift')) paymentMethod = PAYMENT_METHODS.GIFT_CARD;
            }

            const billData = {
              clientName,
              clientPhone: cleanValues[fieldMap.clientPhone] || '',
              receiptNumber: cleanValues[fieldMap.receiptNumber] || null,
              subtotal: parseFloat(cleanValues[fieldMap.subtotal]?.replace(/[₱,]/g, '') || total),
              discount: parseFloat(cleanValues[fieldMap.discount]?.replace(/[₱,]/g, '') || 0),
              tax: parseFloat(cleanValues[fieldMap.tax]?.replace(/[₱,]/g, '') || 0),
              total,
              paymentMethod,
              notes: cleanValues[fieldMap.notes] || '',
              branchId: userBranch,
              branchName: userBranchData?.name || '',
              items: [{ type: 'service', name: 'Imported Item', price: total, quantity: 1 }]
              // Note: createBill will set createdAt automatically to Timestamp.now()
            };

            importData.push(billData);
            successCount++;
          } catch (error) {
            console.error(`Error parsing row ${i + 1}:`, error);
            errorCount++;
          }
        }

        if (importData.length === 0) {
          toast.error('No valid data rows found in CSV');
          return;
        }

        // Confirm import
        const confirmed = window.confirm(
          `Found ${successCount} valid rows and ${errorCount} errors. Import ${successCount} bills?`
        );

        if (!confirmed) return;

        // Import bills
        setProcessing(true);
        let imported = 0;
        for (const billData of importData) {
          try {
            await createBill(billData, currentUser);
            imported++;
          } catch (error) {
            console.error('Error importing bill:', error);
          }
        }

        setProcessing(false);
        toast.success(`Successfully imported ${imported} of ${importData.length} bills`);
        await fetchData();
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('Failed to import CSV file: ' + (error.message || 'Unknown error'));
      }
    };
    input.click();
  };

  const handlePrintReport = () => {
    try {
      // Try multiple sources for branch name
      const branchName = branchData?.name || 
                        branchData?.branchName || 
                        sortedBills[0]?.branchName ||
                        userBranchData?.name || 
                        userBranchData?.branchName || 
                        'Branch';
      const generatedAt = new Date().toLocaleString();
      
      // Build filter description
      const activeFilters = [];
      
      // Always include date range
      if (startDateFilter && endDateFilter) {
        activeFilters.push(`Date Range: ${startDateFilter} to ${endDateFilter}`);
      } else if (startDateFilter) {
        activeFilters.push(`Date Range: From ${startDateFilter}`);
      } else if (endDateFilter) {
        activeFilters.push(`Date Range: Until ${endDateFilter}`);
      } else {
        // Calculate actual date range from sorted bills
        if (sortedBills.length > 0) {
          const dates = sortedBills.map(bill => {
            const date = bill.createdAt?.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
            return date;
          }).sort((a, b) => a - b);
          const minDate = dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const maxDate = dates[dates.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          activeFilters.push(`Date Range: ${minDate} to ${maxDate}`);
        } else {
          activeFilters.push(`Date Range: All Dates`);
        }
      }
      
      if (searchTerm) activeFilters.push(`Search: ${searchTerm}`);
      if (statusFilter !== 'all') activeFilters.push(`Status: ${statusFilter.toUpperCase()}`);
      if (paymentMethodFilter !== 'all') activeFilters.push(`Payment: ${getPaymentMethodLabel(paymentMethodFilter)}`);
      if (cashierFilter !== 'all') {
        const cashier = cashiers.find(c => c.id === cashierFilter);
        if (cashier) activeFilters.push(`Cashier: ${cashier.name}`);
      }
      if (minAmountFilter || maxAmountFilter) {
        activeFilters.push(`Amount: ${formatCurrency(parseFloat(minAmountFilter) || 0)} - ${maxAmountFilter ? formatCurrency(parseFloat(maxAmountFilter)) : 'Unlimited'}`);
      }
      if (receiptNumberFilter) activeFilters.push(`Receipt: ${receiptNumberFilter}`);
      
      // Calculate summary
      const totalBills = sortedBills.length;
      const paidBills = sortedBills.filter(b => b.status === BILL_STATUS.PAID).length;
      const voidedBills = sortedBills.filter(b => b.status === BILL_STATUS.VOIDED).length;
      const refundedBills = sortedBills.filter(b => b.status === BILL_STATUS.REFUNDED).length;
      const totalRevenue = sortedBills.reduce((sum, bill) => sum + (bill.total || 0), 0);
      const totalDiscounts = sortedBills.reduce((sum, bill) => sum + (bill.discount || 0), 0);
      const totalTax = sortedBills.reduce((sum, bill) => sum + (bill.tax || 0), 0);
      
      // Payment method breakdown
      const paymentBreakdown = {};
      sortedBills.forEach(bill => {
        const method = bill.paymentMethod || 'unknown';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (bill.total || 0);
      });

      // Format currency with commas
      const formatCurrency = (amount) => {
        return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      };
      
      // Generate HTML report
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Billing Report - ${branchName}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page { size: letter; margin: 0.5in; }
              body { font-family: 'Poppins', sans-serif; margin: 0; padding: 0; }
              .header { margin-bottom: 15px; }
              .summary { page-break-inside: avoid; }
              .table { page-break-inside: avoid; }
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            body { font-family: 'Poppins', sans-serif; margin: 0; padding: 0; color: #000; line-height: 1.5; }
            .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; text-align: center; }
            .header h1 { font-size: 18px; font-weight: 700; margin: 0 0 4px 0; }
            .header h2 { font-size: 14px; font-weight: 600; margin: 0 0 4px 0; color: #000; }
            .header p { margin: 2px 0; font-size: 9px; color: #000; }
            .filters { background: #f8f9fa; padding: 8px; border: 2px solid #333; margin: 8px 0; text-align: center; }
            .filters-title { font-size: 9px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
            .filters-content { font-size: 8px; font-weight: 600; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
            .summary-card { background: #fff; padding: 6px 4px; border: 1px solid #333; text-align: center; }
            .summary-card h3 { margin: 0 0 3px 0; font-size: 7px; color: #000; text-transform: uppercase; font-weight: 600; letter-spacing: 0.2px; }
            .summary-card p { margin: 0; font-size: 12px; font-weight: 700; color: #000; }
            .table { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #333; }
            .table th, .table td { padding: 3px 2px; text-align: left; border: 1px solid #333; font-size: 7px; }
            .table th { background: #fff; font-weight: 700; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; }
            .table tr:nth-child(even) { background: #fff; }
            .footer { margin-top: 10px; padding-top: 8px; border-top: 2px solid #333; font-size: 7px; color: #000; }
            .footer-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
            .footer-left { text-align: left; }
            .footer-right { text-align: right; }
            .footer-center { text-align: center; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ccc; color: #666; font-size: 7px; }
            .footer-center p { margin: 2px 0; }
            .text-right { text-align: right; }
            .badge { font-size: 7px; font-weight: 600; color: #000; text-transform: uppercase; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Billing / Transaction Report</h2>
            <p style="font-weight: 600; text-transform: uppercase;">${branchName}</p>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">
              ${activeFilters.join(' | ')}
            </div>
          </div>
          
          <div class="summary">
            <div class="summary-card">
              <h3>Total Bills</h3>
              <p>${totalBills}</p>
            </div>
            <div class="summary-card">
              <h3>Total Revenue</h3>
              <p>₱${formatCurrency(totalRevenue)}</p>
            </div>
            <div class="summary-card">
              <h3>Total Discounts</h3>
              <p>₱${formatCurrency(totalDiscounts)}</p>
            </div>
            <div class="summary-card">
              <h3>Paid</h3>
              <p>${paidBills}</p>
            </div>
            <div class="summary-card">
              <h3>Voided</h3>
              <p>${voidedBills}</p>
            </div>
            <div class="summary-card">
              <h3>Refunded</h3>
              <p>${refundedBills}</p>
            </div>
          </div>
          
          <div class="summary">
            <div class="summary-card">
              <h3>Cash Payments</h3>
              <p>₱${formatCurrency(paymentBreakdown.cash || 0)}</p>
            </div>
            <div class="summary-card">
              <h3>Card Payments</h3>
              <p>₱${formatCurrency(paymentBreakdown.card || 0)}</p>
            </div>
            <div class="summary-card">
              <h3>Other Payments</h3>
              <p>₱${formatCurrency((paymentBreakdown.voucher || 0) + (paymentBreakdown.gift_card || 0))}</p>
            </div>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Client</th>
                <th>Payment Method</th>
                <th>Amount</th>
                ${discountFilter === 'senior' || discountFilter === 'pwd' ? '<th>Discount Type</th><th>Control Number</th>' : ''}
                <th>Status</th>
                <th>Cashier</th>
              </tr>
            </thead>
            <tbody>
              ${sortedBills.map(bill => {
                const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
                const dateStr = formatDate(billDate, 'MMM dd, yyyy');
                return `
                  <tr>
                    <td>${bill.id}</td>
                    <td>${bill.receiptNumber || 'N/A'}</td>
                    <td>${dateStr}</td>
                    <td>${bill.clientName || 'Walk-in'}</td>
                    <td>${getPaymentMethodLabel(bill.paymentMethod)}</td>
                    <td class="text-right">₱${formatCurrency(bill.total || 0)}</td>
                    ${discountFilter === 'senior' || discountFilter === 'pwd' ? `
                      <td>${bill.discountReason || 'N/A'}</td>
                      <td>${bill.controlNumber || 'N/A'}</td>
                    ` : ''}
                    <td style="text-align: center;"><span class="badge">${bill.status}</span></td>
                    <td>${bill.createdByName || 'Unknown'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : currentUser?.displayName || 'Branch Manager'}<br>
                <strong>Position:</strong> Branch Manager
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
                <strong>Time:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div class="footer-center">
              <p style="font-weight: 600; color: #333; font-size: 10px;">Page 1 of 1</p>
              <p>${branchName} - Transaction Report</p>
              <p>Total Records: ${sortedBills.length} transaction${sortedBills.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error generating print report:', error);
      toast.error('Failed to generate print report');
    }
  };

  const handleViewDetails = async (bill) => {
    setSelectedBill(bill);
    setShowDetailsModal(true);
    
    // Fetch logs for this bill
    const logs = await getBillingLogs(bill.id);
    setBillLogs(logs);
  };

  const handleVoidClick = (bill) => {
    setSelectedBill(bill);
    setVoidReason('');
    setWitnessEmail('');
    setWitnessPassword('');
    setWitnessVerified(false);
    setWitnessInfo(null);
    setShowVoidModal(true);
  };

  // Verify witness before voiding
  const verifyWitness = async () => {
    if (!witnessEmail.trim()) {
      toast.error('Please enter witness email');
      return;
    }
    if (!witnessPassword.trim()) {
      toast.error('Please enter witness password');
      return;
    }

    try {
      setVerifyingWitness(true);
      
      // Import services
      const { getUserByEmail } = await import('../../services/userService');
      const { verifyRolePassword } = await import('../../services/rolePasswordService');
      
      // Get witness user by email
      const witnessUser = await getUserByEmail(witnessEmail.trim());
      
      if (!witnessUser) {
        toast.error('Witness not found. Please check the email address.');
        return;
      }

      if (!witnessUser.isActive) {
        toast.error('Witness account is inactive');
        return;
      }

      // Verify witness password (check all their roles)
      const { getUserRoles } = await import('../../utils/helpers');
      const witnessRoles = getUserRoles(witnessUser);
      
      let passwordValid = false;
      for (const role of witnessRoles) {
        const isValid = await verifyRolePassword(witnessUser.id, role, witnessPassword);
        if (isValid) {
          passwordValid = true;
          break;
        }
      }

      if (!passwordValid) {
        toast.error('Invalid witness password');
        return;
      }

      // Witness verified
      setWitnessVerified(true);
      setWitnessInfo({
        id: witnessUser.id,
        email: witnessUser.email,
        name: `${witnessUser.firstName || ''} ${witnessUser.lastName || ''}`.trim() || witnessUser.email
      });
      toast.success('Witness verified successfully');
    } catch (error) {
      console.error('Error verifying witness:', error);
      toast.error('Failed to verify witness: ' + (error.message || 'Unknown error'));
    } finally {
      setVerifyingWitness(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding the transaction');
      return;
    }

    if (!witnessVerified || !witnessInfo) {
      toast.error('Please verify witness before voiding');
      return;
    }

    try {
      setProcessing(true);
      // Combine currentUser (has uid) with userData (has firstName, lastName)
      const userForBilling = {
        ...currentUser,
        ...userData,
        uid: currentUser.uid
      };
      await voidBill(selectedBill.id, voidReason, userForBilling, witnessInfo);
      
      setShowVoidModal(false);
      setSelectedBill(null);
      setVoidReason('');
      setWitnessEmail('');
      setWitnessPassword('');
      setWitnessVerified(false);
      setWitnessInfo(null);
      await fetchData();
    } catch (error) {
      console.error('Error voiding bill:', error);
    } finally {
      setProcessing(false);
    }
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

  // Parse receipt numbers from various formats

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
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">View and manage all transaction records</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        </div>
      </div>

      {/* Summary Cards */}
      {filteredSummary && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Net Revenue</p>
                <p className="text-2xl font-bold text-green-600 mt-1">₱{formatNumberWithCommas(filteredSummary.netRevenue || 0)}</p>
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
                <p className="text-2xl font-bold text-blue-600 mt-1">{filteredSummary.totalTransactions}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gross Revenue</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">₱{formatNumberWithCommas(filteredSummary.grossRevenue || 0)}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Banknote className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Discounts</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">₱{formatNumberWithCommas(filteredSummary.totalDiscounts || 0)}</p>
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
                <p className="text-2xl font-bold text-red-600 mt-1">₱{formatNumberWithCommas(filteredSummary.totalVoided || 0)}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* BIR Receipt Summary Card */}
          <div 
            className="bg-white rounded-lg shadow border border-gray-200 p-4 cursor-pointer hover:border-purple-300 hover:shadow-md transition-all"
            onClick={() => setShowBIRBatchModal(true)}
            title="Click to manage BIR receipt batches"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">BIR Receipts</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {birBatchSummary?.availableReceipts?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {birBatchSummary?.usedReceipts?.toLocaleString() || '0'} used / {birBatchSummary?.totalReceipts?.toLocaleString() || '0'} total
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            {activeBirBatch && activeBirBatch.remainingReceipts <= 20 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600">
                <AlertCircle className="w-3 h-3" />
                Low stock: {activeBirBatch.remainingReceipts} left
              </div>
            )}
            {!activeBirBatch && birBatchSummary?.totalBatches === 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />
                No batch configured
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
              (statusFilter !== 'all' || paymentMethodFilter !== 'all' || startDateFilter || endDateFilter ||
               minAmountFilter || maxAmountFilter || cashierFilter !== 'all' || receiptNumberFilter || salesTypeFilter !== 'all' || discountFilter !== 'all')
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            title={`Filter - ${filteredBills.length} transactions`}
          >
            <Filter className="w-5 h-5" />
            {filteredBills.length > 0 && (
              <span className="bg-primary-600 text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                {filteredBills.length}
              </span>
            )}
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Export Transactions Data"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>

          {/* Import CSV Button */}
          <button
            onClick={handleImportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Import Transactions Data"
          >
            <Upload className="w-5 h-5 text-gray-600" />
          </button>

          {/* Print Report Button */}
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5" />
          </button>


          {/* BIR Receipt Batch Button */}
          <button
            onClick={() => setShowBIRBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            title="Manage BIR Receipt Batches"
          >
            <Package className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        Transaction ID
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortColumn === 'createdAt' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('clientName')}
                    >
                      <div className="flex items-center gap-1">
                        Client
                        {sortColumn === 'clientName' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('paymentMethod')}
                    >
                      <div className="flex items-center gap-1">
                        Payment
                        {sortColumn === 'paymentMethod' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('total')}
                    >
                      <div className="flex items-center gap-1">
                        Amount
                        {sortColumn === 'total' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('receiptNumber')}
                    >
                      <div className="flex items-center gap-1">
                        Receipt #
                        {sortColumn === 'receiptNumber' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cashier</th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortColumn === 'status' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedBills.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-12 text-center">
                        <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500">No bills found</p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                          >
                            Clear filters to see all bills
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{bill.id}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{bill.createdAt?.toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">{bill.createdAt?.toLocaleTimeString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{bill.clientName}</p>
                      <p className="text-xs text-gray-500">{bill.clientPhone}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{getPaymentMethodLabel(bill.paymentMethod)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-semibold text-gray-900">₱{formatNumberWithCommas(bill.total || 0)}</p>
                      {bill.discount > 0 && (
                        <p className="text-xs text-green-600">
                          {bill.discountReason === 'Senior' ? 'Senior Citizen' : 
                           bill.discountReason === 'PWD' ? 'PWD' : 'Discount'}: ₱{formatNumberWithCommas(bill.discount)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {bill.receiptNumber ? (
                        <p className="text-sm font-mono font-medium text-blue-600">{bill.receiptNumber}</p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Not set</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{bill.createdByName}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(bill.status)}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetails(bill)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {bill.status === BILL_STATUS.PAID && (
                          <button
                            onClick={() => handleVoidClick(bill)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Void Transaction"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">per page</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages} ({sortedBills.length} total)
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
      </div>

      {/* Bill Details Modal */}
      {showDetailsModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Bill Details</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Receipt Preview */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div style={{ transform: 'scale(0.9)', transformOrigin: 'top left' }}>
                    <ReceiptComponent ref={receiptRef} bill={selectedBill} branch={branchData} />
                  </div>
                </div>

                {/* Logs and Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Transaction History</h3>
                    <div className="space-y-2">
                      {billLogs.length === 0 ? (
                        <p className="text-sm text-gray-500">No activity logs</p>
                      ) : (
                        billLogs.map((log) => (
                          <div key={log.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-gray-900 capitalize">{log.action}</span>
                              <span className="text-xs text-gray-500">
                                {log.timestamp?.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-gray-600 text-xs">{log.details}</p>
                            <p className="text-gray-500 text-xs mt-1">By: {log.performedByName}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {selectedBill.status === BILL_STATUS.PAID && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            setShowDetailsModal(false);
                            handleVoidClick(selectedBill);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Void Transaction
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      <ConfirmModal
        isOpen={showVoidModal}
        onClose={() => {
          if (!processing && !verifyingWitness) {
            setShowVoidModal(false);
            setSelectedBill(null);
            setVoidReason('');
            setWitnessEmail('');
            setWitnessPassword('');
            setWitnessVerified(false);
            setWitnessInfo(null);
          }
        }}
        onConfirm={confirmVoid}
        title="Void Transaction"
        message={`Void bill #${selectedBill?.id?.slice(-8)}? This action cannot be undone.`}
        confirmText="Void Transaction"
        cancelText="Cancel"
        type="danger"
        loading={processing}
        disabled={!witnessVerified}
      >
        <div className="mt-4 space-y-4">
          {/* Witness Verification Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Witness Verification (Required)
            </h3>
            
            {!witnessVerified ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Witness Email *
                  </label>
                  <input
                    type="email"
                    value={witnessEmail}
                    onChange={(e) => setWitnessEmail(e.target.value)}
                    disabled={verifyingWitness || processing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter witness email address"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Witness Password *
                  </label>
                  <input
                    type="password"
                    value={witnessPassword}
                    onChange={(e) => setWitnessPassword(e.target.value)}
                    disabled={verifyingWitness || processing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter witness password"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={verifyWitness}
                  disabled={verifyingWitness || !witnessEmail.trim() || !witnessPassword.trim() || processing}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifyingWitness ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Verify Witness
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Witness Verified</p>
                      <p className="text-xs text-green-700">{witnessInfo?.name || witnessInfo?.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWitnessVerified(false);
                      setWitnessInfo(null);
                      setWitnessPassword('');
                    }}
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reason Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Voiding *
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              disabled={!witnessVerified || processing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter reason for voiding this transaction..."
              required
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Hidden receipt for printing */}
      <div className="hidden">
        <ReceiptComponent ref={receiptRef} bill={selectedBill || {}} branch={branchData} />
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Import CSV Bills</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-900">CSV Template Required</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Download the template to ensure your CSV file has the correct format and columns.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Required Columns:</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Client Name (required)</li>
                    <li>• Total Amount (₱) (required)</li>
                    <li>• Client Phone (optional)</li>
                    <li>• Client Email (optional)</li>
                    <li>• Payment Method (optional)</li>
                    <li>• Receipt Number (optional)</li>
                    <li>• Notes (optional)</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={downloadCSVTemplate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                  <button
                    onClick={proceedWithImport}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Select CSV File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Filter Transactions</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">All Status</option>
                      <option value={BILL_STATUS.PAID}>Paid</option>
                      <option value={BILL_STATUS.VOIDED}>Voided</option>
                      <option value={BILL_STATUS.REFUNDED}>Refunded</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">All Payment Methods</option>
                      <option value={PAYMENT_METHODS.CASH}>Cash</option>
                      <option value={PAYMENT_METHODS.CARD}>Card</option>
                      <option value={PAYMENT_METHODS.VOUCHER}>E-Wallet</option>
                      <option value={PAYMENT_METHODS.GIFT_CARD}>Gift Card</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cashier</label>
                    <select
                      value={cashierFilter}
                      onChange={(e) => setCashierFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">All Cashiers</option>
                      {cashiers.map(cashier => (
                        <option key={cashier.id} value={cashier.id}>{cashier.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sales Type</label>
                    <select
                      value={salesTypeFilter}
                      onChange={(e) => setSalesTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">All Sales Types</option>
                      <option value="service">Service Only</option>
                      <option value="product">Product Only</option>
                      <option value="mixed">Mixed (Service + Product)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                    <select
                      value={discountFilter}
                      onChange={(e) => setDiscountFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">All Transactions</option>
                      <option value="with-discount">With Discount</option>
                      <option value="senior">Senior Citizen</option>
                      <option value="pwd">PWD</option>
                      <option value="no-discount">No Discount</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Number</label>
                    <input
                      type="text"
                      value={receiptNumberFilter}
                      onChange={(e) => setReceiptNumberFilter(e.target.value)}
                      placeholder="Enter receipt number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Amount (₱)</label>
                    <input
                      type="number"
                      value={minAmountFilter}
                      onChange={(e) => setMinAmountFilter(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Amount (₱)</label>
                    <input
                      type="number"
                      value={maxAmountFilter}
                      onChange={(e) => setMaxAmountFilter(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">From</label>
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">To</label>
                      <input
                        type="date"
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {filteredBills.length} of {bills.length} transactions
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BIR Receipt Batch Modal */}
      <BIRReceiptBatchModal
        isOpen={showBIRBatchModal}
        onClose={() => {
          setShowBIRBatchModal(false);
          fetchBIRBatchSummary(); // Refresh summary when modal closes
        }}
        branchId={userBranch}
      />
    </div>
  );
};

export default BranchManagerBilling;
