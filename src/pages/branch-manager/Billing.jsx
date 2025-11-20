/**
 * Billing Management Page - Branch Manager
 * View all bills, approve refunds, void transactions, and view reports
 */

import { useState, useEffect, useRef } from 'react';
import { Search, DollarSign, Calendar, Receipt, Eye, RefreshCw, XCircle, Download, Printer, User, CheckCircle, FileSearch, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const [witnessEmail, setWitnessEmail] = useState('');
  const [witnessPassword, setWitnessPassword] = useState('');
  const [verifyingWitness, setVerifyingWitness] = useState(false);
  const [witnessVerified, setWitnessVerified] = useState(false);
  const [witnessInfo, setWitnessInfo] = useState(null);
  
  // Receipt number checker
  const [showReceiptChecker, setShowReceiptChecker] = useState(false);
  const [receiptSearchNumber, setReceiptSearchNumber] = useState('');
  const [receiptCheckResults, setReceiptCheckResults] = useState([]);
  const [checkingReceipt, setCheckingReceipt] = useState(false);

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
    setWitnessEmail('');
    setWitnessPassword('');
    setWitnessVerified(false);
    setWitnessInfo(null);
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
      [PAYMENT_METHODS.VOUCHER]: 'Voucher',
      [PAYMENT_METHODS.GIFT_CARD]: 'Gift Card'
    };
    return labels[method] || method;
  };

  // Check receipt number
  const handleCheckReceipt = async () => {
    if (!receiptSearchNumber.trim()) {
      toast.error('Please enter a receipt number');
      return;
    }

    try {
      setCheckingReceipt(true);
      const searchNumber = receiptSearchNumber.trim().toUpperCase();
      
      // Search for bills with matching receipt number
      const matchingBills = bills.filter(bill => 
        bill.receiptNumber && bill.receiptNumber.toUpperCase() === searchNumber
      );

      setReceiptCheckResults(matchingBills);
      
      if (matchingBills.length === 0) {
        toast.error(`No transaction found with receipt number: ${searchNumber}`);
      } else {
        toast.success(`Found ${matchingBills.length} transaction(s) with receipt number: ${searchNumber}`);
      }
    } catch (error) {
      console.error('Error checking receipt:', error);
      toast.error('Failed to check receipt number');
    } finally {
      setCheckingReceipt(false);
    }
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
        <button
          onClick={() => {
            setShowReceiptChecker(true);
            setReceiptSearchNumber('');
            setReceiptCheckResults([]);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FileSearch className="w-5 h-5" />
          Receipt Checker
        </button>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Receipt #</th>
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

      {/* Receipt Number Checker Modal */}
      {showReceiptChecker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileSearch className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Receipt Number Checker</h2>
                    <p className="text-sm text-gray-600">Cross-reference receipt numbers with transactions</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReceiptChecker(false);
                    setReceiptSearchNumber('');
                    setReceiptCheckResults([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Search Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Receipt Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={receiptSearchNumber}
                    onChange={(e) => setReceiptSearchNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCheckReceipt();
                      }
                    }}
                    placeholder="Enter receipt number to search"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  />
                  <button
                    onClick={handleCheckReceipt}
                    disabled={checkingReceipt || !receiptSearchNumber.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {checkingReceipt ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Checking...
                      </>
                    ) : (
                      <>
                        <FileSearch className="w-4 h-4" />
                        Check
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Results */}
              {receiptCheckResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">
                      Found {receiptCheckResults.length} transaction(s) with receipt number: <strong>{receiptSearchNumber.toUpperCase()}</strong>
                    </span>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bill ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Payment</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Receipt #</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {receiptCheckResults.map((bill) => (
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
                              <p className="text-sm font-semibold text-gray-900">₱{bill.total?.toFixed(2)}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm text-gray-600">{getPaymentMethodLabel(bill.paymentMethod)}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(bill.status)}`}>
                                {bill.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-mono font-medium text-blue-600">{bill.receiptNumber}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <button
                                onClick={() => {
                                  handleViewDetails(bill);
                                  setShowReceiptChecker(false);
                                }}
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
                  </div>
                </div>
              )}

              {receiptCheckResults.length === 0 && receiptSearchNumber && !checkingReceipt && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No transactions found with this receipt number</p>
                  <p className="text-sm text-gray-400 mt-1">Try checking the receipt number or search for a different one</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManagerBilling;
