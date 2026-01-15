/**
 * Branch Performance Report - Operational Manager
 * Analytics and performance metrics for all branches
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { 
  BarChart3, 
  TrendingUp, 
  Banknote, 
  AlertCircle,
  Filter,
  X,
  MapPin,
  CheckCircle,
  Printer
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getBranches } from '../../services/branchService';
import { formatCurrency } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const BranchPerformanceReport = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState({});
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState('revenue-desc');
  const printRef = useRef();

  useEffect(() => {
    fetchBranchesAndPerformance();
  }, []);

  const fetchBranchesAndPerformance = async () => {
    try {
      setLoading(true);
      
      // Fetch all branches
      const branchesData = await getBranches();
      console.log('📊 Fetched branches:', branchesData.length);
      setBranches(branchesData);
      
      // Fetch performance data for each branch
      const performanceMap = {};
      for (const branch of branchesData) {
        performanceMap[branch.id] = await fetchBranchPerformance(branch.id);
      }
      console.log('📊 Performance map:', performanceMap);
      setPerformanceData(performanceMap);
      
    } catch (error) {
      console.error('Error fetching branch performance:', error);
      toast.error('Failed to load branch performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchPerformance = async (branchId) => {
    try {
      console.log(`Fetching performance for branch: ${branchId}`);
      
      // First, check if there are ANY transactions for this branch
      const transactionsRef = collection(db, 'transactions');
      const allTransactionsQuery = query(
        transactionsRef,
        where('branchId', '==', branchId)
      );
      const allTransactionsSnapshot = await getDocs(allTransactionsQuery);
      console.log(`Total transactions for branch ${branchId}: ${allTransactionsSnapshot.size}`);
      
      // Log status breakdown
      const statusBreakdown = {};
      allTransactionsSnapshot.forEach(doc => {
        const status = doc.data().status || 'no-status';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      console.log(`Status breakdown for branch ${branchId}:`, statusBreakdown);
      
      // Fetch paid transactions
      let transactionsQuery = query(
        transactionsRef,
        where('branchId', '==', branchId),
        where('status', '==', 'paid')
      );

      const transactionsSnapshot = await getDocs(transactionsQuery);
      console.log(`Found ${transactionsSnapshot.size} paid transactions for branch ${branchId}`);

      let totalRevenue = 0;
      let totalTransactions = 0;
      let totalServices = 0;
      let totalProducts = 0;
      let totalDiscounts = 0;
      const paymentMethods = {};
      const topServices = {};
      const topProducts = {};

      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Transaction ${doc.id}:`, { total: data.total, discount: data.discount, items: data.items?.length });
        totalTransactions++;
        totalRevenue += data.total || 0;
        totalDiscounts += data.discount || 0;

        // Count payment methods
        const method = data.paymentMethod || 'Unknown';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;

        // Count services and products
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(item => {
            if (item.type === 'service') {
              totalServices++;
              const serviceName = item.name || 'Unknown Service';
              topServices[serviceName] = (topServices[serviceName] || 0) + 1;
            } else if (item.type === 'product') {
              totalProducts++;
              const productName = item.name || 'Unknown Product';
              topProducts[productName] = (topProducts[productName] || 0) + 1;
            }
          });
        }
      });

      console.log(`Branch ${branchId} totals:`, { totalRevenue, totalTransactions, totalServices, totalProducts });

      // Fetch voided transactions
      let voidedQuery = query(
        transactionsRef,
        where('branchId', '==', branchId),
        where('status', '==', 'voided')
      );
      const voidedSnapshot = await getDocs(voidedQuery);
      let totalVoided = 0;
      let voidedCount = 0;
      voidedSnapshot.forEach(doc => {
        voidedCount++;
        totalVoided += doc.data().total || 0;
      });

      // Fetch appointments
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('branchId', '==', branchId)
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const totalAppointments = appointmentsSnapshot.size;
      let completedAppointments = 0;
      appointmentsSnapshot.forEach(doc => {
        if (doc.data().status === 'completed') {
          completedAppointments++;
        }
      });

      // Fetch staff
      const usersRef = collection(db, 'users');
      const staffQuery = query(
        usersRef,
        where('branchId', '==', branchId),
        where('role', 'in', ['stylist', 'receptionist'])
      );
      const staffSnapshot = await getDocs(staffQuery);
      const totalStaff = staffSnapshot.size;

      // Calculate metrics
      const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      const appointmentCompletionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
      const netRevenue = totalRevenue - totalDiscounts;

      return {
        totalRevenue,
        netRevenue,
        totalTransactions,
        totalServices,
        totalProducts,
        totalDiscounts,
        totalVoided,
        voidedCount,
        totalAppointments,
        completedAppointments,
        appointmentCompletionRate,
        totalStaff,
        averageTransactionValue,
        paymentMethods,
        topServices: Object.entries(topServices)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        topProducts: Object.entries(topProducts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      };
    } catch (error) {
      console.error(`Error fetching performance for branch ${branchId}:`, error);
      return {
        totalRevenue: 0,
        netRevenue: 0,
        totalTransactions: 0,
        totalServices: 0,
        totalProducts: 0,
        totalDiscounts: 0,
        totalVoided: 0,
        voidedCount: 0,
        totalAppointments: 0,
        completedAppointments: 0,
        appointmentCompletionRate: 0,
        totalStaff: 0,
        averageTransactionValue: 0,
        paymentMethods: {},
        topServices: [],
        topProducts: []
      };
    }
  };

  // Filter and sort branches
  const filteredBranches = useMemo(() => {
    let filtered = branches;
    
    if (selectedBranch !== 'all') {
      filtered = filtered.filter(b => b.id === selectedBranch);
    }

    // Sort
    filtered.sort((a, b) => {
      const dataA = performanceData[a.id] || {};
      const dataB = performanceData[b.id] || {};

      switch (sortBy) {
        case 'revenue-desc':
          return (dataB.totalRevenue || 0) - (dataA.totalRevenue || 0);
        case 'revenue-asc':
          return (dataA.totalRevenue || 0) - (dataB.totalRevenue || 0);
        case 'transactions-desc':
          return (dataB.totalTransactions || 0) - (dataA.totalTransactions || 0);
        case 'transactions-asc':
          return (dataA.totalTransactions || 0) - (dataB.totalTransactions || 0);
        case 'completion-desc':
          return (dataB.appointmentCompletionRate || 0) - (dataA.appointmentCompletionRate || 0);
        case 'completion-asc':
          return (dataA.appointmentCompletionRate || 0) - (dataB.appointmentCompletionRate || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [branches, selectedBranch, sortBy, performanceData]);

  // Calculate overall summary
  const overallSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalNetRevenue = 0;
    let totalTransactions = 0;
    let totalServices = 0;
    let totalProducts = 0;
    let totalVoided = 0;
    let totalAppointments = 0;
    let completedAppointments = 0;
    let totalStaff = 0;

    filteredBranches.forEach(branch => {
      const data = performanceData[branch.id] || {};
      totalRevenue += data.totalRevenue || 0;
      totalNetRevenue += data.netRevenue || 0;
      totalTransactions += data.totalTransactions || 0;
      totalServices += data.totalServices || 0;
      totalProducts += data.totalProducts || 0;
      totalVoided += data.totalVoided || 0;
      totalAppointments += data.totalAppointments || 0;
      completedAppointments += data.completedAppointments || 0;
      totalStaff += data.totalStaff || 0;
    });

    const appointmentCompletionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return {
      totalRevenue,
      totalNetRevenue,
      totalTransactions,
      totalServices,
      totalProducts,
      totalVoided,
      totalAppointments,
      completedAppointments,
      appointmentCompletionRate,
      totalStaff,
      averageTransactionValue
    };
  }, [filteredBranches, performanceData]);

  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Branch_Performance_Report_${new Date().toISOString().split('T')[0]}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 15mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
      }
    `
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Branch Performance Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">Analytics and performance metrics across all branches</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button
            onClick={() => setShowFilterModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div ref={printRef}>
        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block mb-6">
          <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">David's Salon</h1>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Branch Performance Report</h2>
            <p className="text-sm text-gray-600">
              Generated on: {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {selectedBranch !== 'all' && (
              <p className="text-sm text-gray-600 mt-1">
                Branch: {branches.find(b => b.id === selectedBranch)?.name || 'All Branches'}
              </p>
            )}
            {(startDate || endDate) && (
              <p className="text-sm text-gray-600 mt-1">
                Period: {startDate || 'Start'} to {endDate || 'End'}
              </p>
            )}
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(overallSummary.totalRevenue)}</p>
            </div>
            <Banknote className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Revenue</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(overallSummary.totalNetRevenue)}</p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Transactions</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{overallSummary.totalTransactions}</p>
            </div>
            <Banknote className="h-10 w-10 text-purple-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Appointment Completion</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{overallSummary.appointmentCompletionRate.toFixed(1)}%</p>
            </div>
            <CheckCircle className="h-10 w-10 text-orange-200" />
          </div>
          </div>
        </div>

        {/* Branch Details */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Branch Performance Details</h2>
              <div className="flex items-center gap-2 no-print">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="revenue-desc">Revenue (High to Low)</option>
                  <option value="revenue-asc">Revenue (Low to High)</option>
                  <option value="transactions-desc">Transactions (High to Low)</option>
                  <option value="transactions-asc">Transactions (Low to High)</option>
                  <option value="completion-desc">Completion Rate (High to Low)</option>
                  <option value="completion-asc">Completion Rate (Low to High)</option>
                </select>
              </div>
            </div>
          </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Net Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Transactions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Avg Transaction</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Services</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Products</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Appointments</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Completion %</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Staff</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Voided</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No branches found</p>
                  </td>
                </tr>
              ) : (
                filteredBranches.map(branch => {
                  const data = performanceData[branch.id] || {};
                  return (
                    <tr key={branch.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{branch.name}</p>
                            <p className="text-xs text-gray-500">{branch.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(data.totalRevenue || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                        {formatCurrency(data.netRevenue || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {data.totalTransactions || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(data.averageTransactionValue || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {data.totalServices || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {data.totalProducts || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {data.totalAppointments || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className={data.appointmentCompletionRate >= 80 ? 'text-green-600' : data.appointmentCompletionRate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                          {data.appointmentCompletionRate?.toFixed(1) || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {data.totalStaff || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className="text-red-600 font-medium">{formatCurrency(data.totalVoided || 0)}</span>
                        <p className="text-xs text-gray-500">({data.voidedCount || 0})</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>

        {/* Print Footer - Only visible when printing */}
        <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
          <div className="text-center text-xs text-gray-600">
            <p>David's Salon - Branch Performance Report</p>
            <p className="mt-1">This is a system-generated report. No signature required.</p>
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Filter Report</h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Branches</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => {
                    setSelectedBranch('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchPerformanceReport;
