/**
 * Billing Management Page - Branch Manager
 * View all bills, approve refunds, void transactions, and view reports
 */

import { useState, useEffect, useRef } from 'react';
import { Search, DollarSign, Calendar, Receipt, Eye, RefreshCw, XCircle, Download, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBillsByBranch,
  getDailySalesSummary,
  refundBill,
  voidBill,
  getBillingLogs,
  BILL_STATUS,
  PAYMENT_METHODS
} from '../../services/billingService';
import { getBranchById } from '../../services/branchService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ReceiptComponent from '../../components/billing/Receipt';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';

const BranchManagerBilling = () => {
  const { currentUser, userBranch, userBranchData, userData } = useAuth();
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [dailySummary, setDailySummary] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billLogs, setBillLogs] = useState([]);
  const [branchData, setBranchData] = useState(null);
  
  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [refundData, setRefundData] = useState({ amount: '', reason: '' });
  const [voidReason, setVoidReason] = useState('');

  // Receipt printing
  const receiptRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  useEffect(() => {
    if (userBranch) {
      fetchData();
      fetchBranchData();
    }
  }, [userBranch]);

  useEffect(() => {
    applyFilters();
  }, [bills, searchTerm, statusFilter, dateFilter]);

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

  const applyFilters = () => {
    let filtered = [...bills];

    if (searchTerm) {
      filtered = filtered.filter(bill =>
        bill.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.clientPhone?.includes(searchTerm) ||
        bill.id?.includes(searchTerm)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const monthFromNow = new Date(today);
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);

    if (dateFilter === 'today') {
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        billDate.setHours(0, 0, 0, 0);
        return billDate.getTime() === today.getTime();
      });
    } else if (dateFilter === 'week') {
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        return billDate >= today && billDate <= weekFromNow;
      });
    } else if (dateFilter === 'month') {
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        return billDate >= today && billDate <= monthFromNow;
      });
    }

    setFilteredBills(filtered);
  };

  const handleViewDetails = async (bill) => {
    setSelectedBill(bill);
    setShowDetailsModal(true);
    
    // Fetch logs for this bill
    const logs = await getBillingLogs(bill.id);
    setBillLogs(logs);
  };

  const handleRefundClick = (bill) => {
    setSelectedBill(bill);
    setRefundData({ 
      amount: bill.total.toString(), 
      reason: ''
    });
    setShowRefundModal(true);
  };

  const handleVoidClick = (bill) => {
    setSelectedBill(bill);
    setVoidReason('');
    setShowVoidModal(true);
  };

  const confirmRefund = async () => {
    if (!refundData.reason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    const amount = parseFloat(refundData.amount);
    if (isNaN(amount) || amount <= 0 || amount > selectedBill.total) {
      toast.error('Invalid refund amount');
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
      await refundBill(selectedBill.id, {
        amount: amount,
        reason: refundData.reason
      }, userForBilling);
      
      setShowRefundModal(false);
      setSelectedBill(null);
      setRefundData({ amount: '', reason: '' });
      await fetchData();
    } catch (error) {
      console.error('Error processing refund:', error);
    } finally {
      setProcessing(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding the transaction');
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
      await voidBill(selectedBill.id, voidReason, userForBilling);
      
      setShowVoidModal(false);
      setSelectedBill(null);
      setVoidReason('');
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
      [PAYMENT_METHODS.VOUCHER]: 'Voucher',
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
          <h1 className="text-2xl font-bold text-gray-900">Billing Management</h1>
          <p className="text-gray-600">View transactions, process refunds, and manage billing</p>
        </div>
      </div>

      {/* Summary Cards */}
      {dailySummary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Net Revenue</p>
                <p className="text-2xl font-bold text-green-600 mt-1">₱{dailySummary.netRevenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
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
                <p className="text-sm text-gray-600">Gross Revenue</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">₱{dailySummary.totalRevenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Discounts</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">₱{dailySummary.totalDiscounts?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
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
                <RefreshCw className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client, phone, bill ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value={BILL_STATUS.PAID}>Paid</option>
            <option value={BILL_STATUS.REFUNDED}>Refunded</option>
            <option value={BILL_STATUS.VOIDED}>Voided</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {filteredBills.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No bills found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bill ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cashier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">#{bill.id.slice(-8)}</p>
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
                      <p className="text-sm font-semibold text-gray-900">₱{bill.total?.toFixed(2)}</p>
                      {bill.discount > 0 && (
                        <p className="text-xs text-green-600">-₱{bill.discount?.toFixed(2)}</p>
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
                          <>
                            <button
                              onClick={() => handleRefundClick(bill)}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                              title="Process Refund"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleVoidClick(bill)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Void Transaction"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                            handleRefundClick(selectedBill);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Process Refund
                        </button>
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

      {/* Refund Modal */}
      <ConfirmModal
        isOpen={showRefundModal}
        onClose={() => {
          if (!processing) {
            setShowRefundModal(false);
            setSelectedBill(null);
          }
        }}
        onConfirm={confirmRefund}
        title="Process Refund"
        message={`Process refund for bill #${selectedBill?.id?.slice(-8)}?`}
        confirmText="Process Refund"
        cancelText="Cancel"
        type="warning"
        loading={processing}
      >
        <div className="mt-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Full refund amount:</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ₱{selectedBill?.total?.toFixed(2) || '0.00'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Refund *
            </label>
            <textarea
              value={refundData.reason}
              onChange={(e) => setRefundData(prev => ({ ...prev, reason: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Enter reason for refund..."
              required
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Void Modal */}
      <ConfirmModal
        isOpen={showVoidModal}
        onClose={() => {
          if (!processing) {
            setShowVoidModal(false);
            setSelectedBill(null);
          }
        }}
        onConfirm={confirmVoid}
        title="Void Transaction"
        message={`Void bill #${selectedBill?.id?.slice(-8)}? This action cannot be undone.`}
        confirmText="Void Transaction"
        cancelText="Cancel"
        type="danger"
        loading={processing}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Voiding *
          </label>
          <textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Enter reason for voiding this transaction..."
            required
          />
        </div>
      </ConfirmModal>

      {/* Hidden receipt for printing */}
      <div className="hidden">
        <ReceiptComponent ref={receiptRef} bill={selectedBill || {}} branch={branchData} />
      </div>
    </div>
  );
};

export default BranchManagerBilling;
