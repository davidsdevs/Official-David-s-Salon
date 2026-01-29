/**
 * Sales Report Page - Receptionist
 * View sales data, revenue, and transaction reports
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Banknote,
  TrendingUp,
  ShoppingCart,
  Calendar,
  Download,
  Filter,
  Receipt,
  CreditCard,
  Gift,
  FileText,
  RefreshCw,
  Eye,
  Printer,
  X,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBillsByBranch, getDailySalesSummary, BILL_STATUS } from '../../services/billingService';
import { getBranchById } from '../../services/branchService';
import { formatCurrency } from '../../utils/helpers';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ReceiptComponent from '../../components/billing/Receipt';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';

const ReceptionistSalesReport = () => {
  const { userBranch, userData } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('month'); // today, week, month, custom
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all'); // all, paid, refunded, voided
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [branchData, setBranchData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const printRef = useRef();
  const receiptRef = useRef();
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Sales_Report_${format(new Date(), 'yyyy-MM-dd')}`,
    pageStyle: '@page { size: A4; margin: 1cm; }',
  });

  useEffect(() => {
    if (userBranch) {
      fetchBills();
      fetchBranchData();
    }
  }, [userBranch, dateFilter, customStartDate, customEndDate]);

  const fetchBranchData = async () => {
    try {
      const branch = await getBranchById(userBranch);
      setBranchData(branch);
    } catch (error) {
      console.error('Error fetching branch data:', error);
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      
      let startDate, endDate;
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          endDate = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'custom':
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
      }

      const billsData = await getBillsByBranch(userBranch, {
        startDate,
        endDate
      });

      setBills(billsData || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  // Filter bills
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, customStartDate, customEndDate]);

  const filteredBills = useMemo(() => {
    let filtered = bills;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(bill => 
        bill.clientName?.toLowerCase().includes(searchLower) ||
        bill.id?.toLowerCase().includes(searchLower) ||
        bill.stylistName?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [bills, statusFilter, searchTerm]);

  // Paginated bills
  const totalPages = Math.ceil(filteredBills.length / pageSize);
  const paginatedBills = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredBills.slice(startIndex, endIndex);
  }, [filteredBills, currentPage, pageSize]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const paidBills = filteredBills.filter(b => b.status === BILL_STATUS.PAID);
    
    const totalRevenue = paidBills.reduce((sum, bill) => sum + (bill.total || 0), 0);
    const totalTransactions = paidBills.length;
    const totalDiscounts = paidBills.reduce((sum, bill) => sum + (bill.discount || 0), 0);
    const totalTax = paidBills.reduce((sum, bill) => sum + (bill.tax || 0), 0);
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Payment method breakdown
    const paymentBreakdown = {
      cash: 0,
      card: 0,
      voucher: 0,
      gift_card: 0
    };

    paidBills.forEach(bill => {
      const method = bill.paymentMethod || 'cash';
      if (paymentBreakdown[method] !== undefined) {
        paymentBreakdown[method] += bill.total || 0;
      }
    });

    // Service vs Product breakdown
    const serviceRevenue = paidBills
      .filter(b => b.salesType === 'service' || b.salesType === 'mixed')
      .reduce((sum, bill) => {
        const serviceItems = (bill.items || []).filter(item => item.type === 'service');
        return sum + serviceItems.reduce((s, item) => s + ((item.price || 0) * (item.quantity || 1)), 0);
      }, 0);

    const productRevenue = paidBills
      .filter(b => b.salesType === 'product' || b.salesType === 'mixed')
      .reduce((sum, bill) => {
        const productItems = (bill.items || []).filter(item => item.type === 'product');
        return sum + productItems.reduce((s, item) => s + ((item.price || 0) * (item.quantity || 1)), 0);
      }, 0);

    // Refunds
    const refundedBills = filteredBills.filter(b => b.status === BILL_STATUS.REFUNDED);
    const totalRefunds = refundedBills.reduce((sum, bill) => sum + (bill.refundAmount || bill.total || 0), 0);

    return {
      totalRevenue,
      totalTransactions,
      totalDiscounts,
      totalTax,
      avgTransactionValue,
      paymentBreakdown,
      serviceRevenue,
      productRevenue,
      totalRefunds,
      netRevenue: totalRevenue - totalRefunds
    };
  }, [filteredBills]);

  // Export to CSV
  const exportToCSV = () => {
    const paidBills = filteredBills.filter(b => b.status === BILL_STATUS.PAID);
    
    if (paidBills.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Transaction ID',
      'Date',
      'Time',
      'Client Name',
      'Client Phone',
      'Stylist',
      'Items',
      'Subtotal',
      'Discount',
      'Tax',
      'Total',
      'Payment Method',
      'Status'
    ];

    const csvRows = [
      headers.join(','),
      ...paidBills.map(bill => {
        const date = bill.createdAt?.toDate 
          ? bill.createdAt.toDate() 
          : new Date(bill.createdAt);
        
        const items = (bill.items || []).map(item => 
          `${item.name} (${item.quantity || 1}x)`
        ).join('; ');

        return [
          bill.id || 'N/A',
          format(date, 'yyyy-MM-dd'),
          format(date, 'HH:mm'),
          `"${(bill.clientName || '').replace(/"/g, '""')}"`,
          bill.clientPhone || '',
          `"${(bill.stylistName || '').replace(/"/g, '""')}"`,
          `"${items.replace(/"/g, '""')}"`,
          bill.subtotal || 0,
          bill.discount || 0,
          bill.tax || 0,
          bill.total || 0,
          bill.paymentMethod || 'cash',
          bill.status || 'paid'
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  // Export to PDF using react-to-print
  const exportToPDF = () => {
    if (filteredBills.length === 0) {
      toast.error('No data to export');
      return;
    }
    handlePrint();
  };

  // Receipt printing
  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt_${selectedBill?.id || 'Unknown'}`,
    pageStyle: '@page { size: A4; margin: 1cm; }',
  });

  const handleViewBill = (bill) => {
    setSelectedBill(bill);
    setShowBillDetails(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-gray-600 mt-1">View sales data and transaction reports</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchBills}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5 text-gray-600" />
            Print Report
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client, transaction ID, stylist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          {/* Filter Button */}
          <button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
              (statusFilter !== 'all' || dateFilter !== 'month')
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
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Filter Transactions</h2>
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

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setDateFilter('today')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilter === 'today'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilter('week')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilter === 'week'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilter('month')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilter === 'month'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateFilter('custom')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      dateFilter === 'custom'
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {/* Custom Date Range Inputs */}
                {dateFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        min={customStartDate || undefined}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDateFilter('month');
                  setCustomStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setCustomEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
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
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(summaryStats.totalRevenue)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Banknote className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Net: {formatCurrency(summaryStats.netRevenue)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summaryStats.totalTransactions}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Avg: {formatCurrency(summaryStats.avgTransactionValue)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Service Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(summaryStats.serviceRevenue)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Product: {formatCurrency(summaryStats.productRevenue)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Discounts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(summaryStats.totalDiscounts)}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Receipt className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tax: {formatCurrency(summaryStats.totalTax)}
          </p>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Method Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-green-100 rounded">
              <Banknote className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(summaryStats.paymentBreakdown.cash)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-blue-100 rounded">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Card</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(summaryStats.paymentBreakdown.card)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-purple-100 rounded">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Voucher</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(summaryStats.paymentBreakdown.voucher)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-pink-100 rounded">
              <Gift className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Gift Card</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(summaryStats.paymentBreakdown.gift_card)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {Math.min((currentPage - 1) * pageSize + 1, filteredBills.length)} to {Math.min(currentPage * pageSize, filteredBills.length)} of {filteredBills.length} transaction{filteredBills.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stylist
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedBills.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                paginatedBills.map((bill) => {
                  const date = bill.createdAt?.toDate 
                    ? bill.createdAt.toDate() 
                    : new Date(bill.createdAt);
                  
                  return (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(date, 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(date, 'HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {bill.clientName || 'N/A'}
                        </div>
                        {bill.clientPhone && (
                          <div className="text-xs text-gray-500">
                            {bill.clientPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs">
                          {(bill.items || []).slice(0, 2).map((item, idx) => (
                            <div key={idx} className="truncate">
                              {item.name} (x{item.quantity || 1})
                            </div>
                          ))}
                          {(bill.items || []).length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{(bill.items || []).length - 2} more
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bill.stylistName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency((bill.subtotal || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency((bill.discount || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency((bill.total || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {bill.paymentMethod || 'cash'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          bill.status === BILL_STATUS.PAID
                            ? 'bg-green-100 text-green-800'
                            : bill.status === BILL_STATUS.REFUNDED
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {bill.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleViewBill(bill)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
                  Showing <span className="font-semibold text-gray-900">{Math.min((currentPage - 1) * pageSize + 1, filteredBills.length)}</span> to{' '}
                  <span className="font-semibold text-gray-900">{Math.min(currentPage * pageSize, filteredBills.length)}</span> of{' '}
                  <span className="font-semibold text-gray-900">{filteredBills.length.toLocaleString()}</span> bills
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
      </Card>

      {/* Hidden printable component for PDF export */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="p-8 bg-white">
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
              .print-footer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                text-align: center;
                font-size: 10px;
                padding: 10px;
                border-top: 1px solid #ddd;
              }
            }
          `}</style>
          
          {/* Header */}
          <div className="text-center mb-6 no-page-break">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Report</h1>
            {branchData && (
              <p className="text-gray-600">{branchData.name || branchData.branchName}</p>
            )}
            {(() => {
              let dateRangeText = '';
              switch (dateFilter) {
                case 'today':
                  dateRangeText = `Date: ${format(new Date(), 'MMMM dd, yyyy')}`;
                  break;
                case 'week':
                  dateRangeText = `Week: ${format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd')} - ${format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd, yyyy')}`;
                  break;
                case 'month':
                  dateRangeText = `Month: ${format(new Date(), 'MMMM yyyy')}`;
                  break;
                case 'custom':
                  dateRangeText = `Date Range: ${format(new Date(customStartDate), 'MMM dd, yyyy')} - ${format(new Date(customEndDate), 'MMM dd, yyyy')}`;
                  break;
              }
              return (
                <p className="text-gray-600 mt-2">{dateRangeText}</p>
              );
            })()}
          </div>

          {/* Filters Applied Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200 no-page-break">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">FILTERS APPLIED:</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><strong>Date Range:</strong> {(() => {
                switch (dateFilter) {
                  case 'today': return format(new Date(), 'MMMM dd, yyyy');
                  case 'week': return `${format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd')} - ${format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd, yyyy')}`;
                  case 'month': return format(new Date(), 'MMMM yyyy');
                  case 'custom': return `${format(new Date(customStartDate), 'MMM dd, yyyy')} - ${format(new Date(customEndDate), 'MMM dd, yyyy')}`;
                  default: return 'All';
                }
              })()}</div>
              <div><strong>Status:</strong> {statusFilter === 'all' ? 'All Statuses' : statusFilter.toUpperCase()}</div>
              {searchTerm && <div><strong>Search Term:</strong> {searchTerm}</div>}
              <div><strong>Total Records:</strong> {filteredBills.filter(b => b.status === BILL_STATUS.PAID).length}</div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Summary Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.totalRevenue)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Net Revenue</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.netRevenue)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-lg font-bold">{summaryStats.totalTransactions}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Average Transaction</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.avgTransactionValue)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Service Revenue</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.serviceRevenue)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Product Revenue</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.productRevenue)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Discounts</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.totalDiscounts)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Tax</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.totalTax)}</p>
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Method Breakdown</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="border p-3">
                <p className="text-sm text-gray-600">Cash</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.paymentBreakdown.cash)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Card</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.paymentBreakdown.card)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Voucher</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.paymentBreakdown.voucher)}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Gift Card</p>
                <p className="text-lg font-bold">{formatCurrency(summaryStats.paymentBreakdown.gift_card)}</p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction Details</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Date</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Time</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Client</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Stylist</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Items</th>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-bold">Subtotal</th>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-bold">Discount</th>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-bold">Total</th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-bold">Payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.filter(b => b.status === BILL_STATUS.PAID).map((bill) => {
                  const date = bill.createdAt?.toDate 
                    ? bill.createdAt.toDate() 
                    : new Date(bill.createdAt);
                  
                  return (
                    <tr key={bill.id}>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{format(date, 'MMM dd, yyyy')}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{format(date, 'HH:mm')}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{bill.clientName || 'N/A'}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{bill.stylistName || 'N/A'}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {(bill.items || []).map(item => `${item.name} (x${item.quantity || 1})`).join(', ')}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">{formatCurrency(bill.subtotal || 0)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">{formatCurrency(bill.discount || 0)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right font-bold">{formatCurrency(bill.total || 0)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-center capitalize">{bill.paymentMethod || 'cash'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td colSpan="5" className="border border-gray-300 px-4 py-2 text-right text-sm">TOTAL:</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm text-right">
                    {formatCurrency(filteredBills.filter(b => b.status === BILL_STATUS.PAID).reduce((sum, bill) => sum + (bill.subtotal || 0), 0))}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm text-right">
                    {formatCurrency(filteredBills.filter(b => b.status === BILL_STATUS.PAID).reduce((sum, bill) => sum + (bill.discount || 0), 0))}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm text-right">
                    {formatCurrency(filteredBills.filter(b => b.status === BILL_STATUS.PAID).reduce((sum, bill) => sum + (bill.total || 0), 0))}
                  </td>
                  <td className="border border-gray-300 px-4 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Report Footer - Generator Info */}
          <div className="mt-8 pt-4 border-t-2 border-gray-300 text-xs text-gray-600">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Generated By:</strong> {userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : userData?.email || 'System'}</p>
                <p><strong>Position:</strong> Receptionist</p>
              </div>
              <div className="text-right">
                <p><strong>Generated On:</strong> {format(new Date(), 'MMMM dd, yyyy')}</p>
                <p><strong>Time:</strong> {format(new Date(), 'hh:mm a')}</p>
              </div>
            </div>
            <div className="text-center mt-4 text-gray-500">
              <p>Page 1 of 1 | {branchData?.name || branchData?.branchName} - Sales Report</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Details Modal with Receipt */}
      {showBillDetails && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Receipt</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrintReceipt}
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
    </div>
  );
};

export default ReceptionistSalesReport;

