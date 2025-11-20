/**
 * Price History Analytics Page
 * For Operational Manager to view service price change history and sales impact
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Calendar,
  Search,
  AlertCircle,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getPriceHistory, getPriceChangeImpact, getTransactionsForPricePeriod } from '../../services/priceHistoryService';
import { getAllBranches } from '../../services/branchService';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const PriceHistoryAnalytics = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [priceHistory, setPriceHistory] = useState([]);
  const [impactData, setImpactData] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedPriceChange, setSelectedPriceChange] = useState(null);
  const [selectedPriceType, setSelectedPriceType] = useState(null); // 'old' or 'new'

  useEffect(() => {
    loadServices();
    loadBranches();
  }, []);

  useEffect(() => {
    if (selectedServiceId && selectedBranchId) {
      loadPriceHistory();
    } else {
      setPriceHistory([]);
      setImpactData(null);
    }
  }, [selectedServiceId, selectedBranchId]);

  const loadServices = async () => {
    try {
      const servicesRef = collection(db, 'services');
      const q = query(
        servicesRef,
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(q);
      const servicesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setServices(servicesList);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    }
  };

  const loadBranches = async () => {
    try {
      const branchesList = await getAllBranches();
      setBranches(branchesList);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load branches');
    }
  };

  const loadPriceHistory = async () => {
    try {
      setLoading(true);
      const history = await getPriceHistory(selectedServiceId, selectedBranchId);
      setPriceHistory(history);
    } catch (error) {
      console.error('Error loading price history:', error);
      toast.error('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const loadImpactAnalysis = async (priceChange) => {
    try {
      setLoadingImpact(true);
      const impact = await getPriceChangeImpact(
        selectedServiceId,
        selectedBranchId,
        priceChange.changedAt,
        30, // 30 days before
        30  // 30 days after
      );
      setImpactData({
        ...impact,
        priceChange
      });
    } catch (error) {
      console.error('Error loading impact analysis:', error);
      toast.error('Failed to load impact analysis');
    } finally {
      setLoadingImpact(false);
    }
  };

  const loadTransactionsForPeriod = async (priceChange, priceType = 'old') => {
    try {
      setLoadingTransactions(true);
      setSelectedPriceChange(priceChange);
      setSelectedPriceType(priceType);
      const changeDate = new Date(priceChange.changedAt);
      const price = priceType === 'old' ? priceChange.oldPrice : priceChange.newPrice;
      
      // Get transactions 30 days before or after based on price type
      const startDate = new Date(changeDate);
      const endDate = new Date(changeDate);
      
      if (priceType === 'old') {
        startDate.setDate(startDate.getDate() - 30);
        endDate.setDate(endDate.getDate() - 1); // Up to day before change
      } else {
        startDate.setDate(startDate.getDate() + 1); // Day after change
        endDate.setDate(endDate.getDate() + 30);
      }
      
      const transactionsData = await getTransactionsForPricePeriod(
        selectedServiceId,
        selectedBranchId,
        startDate,
        endDate,
        price
      );
      
      setTransactions(transactionsData);
      setIsTransactionsModalOpen(true);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const getPriceChangePercentage = (oldPrice, newPrice) => {
    if (!oldPrice || oldPrice === 0) return 0;
    return ((newPrice - oldPrice) / oldPrice) * 100;
  };

  const formatCurrency = (amount) => {
    return `Γé▒${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price History Analytics</h1>
        <p className="text-gray-600">Track service price changes and their impact on sales</p>
      </div>

      {/* Selection Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Service
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="">-- Select Service --</option>
                  {filteredServices.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} {service.category ? `(${service.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Branch Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Branch
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                disabled={!selectedServiceId}
              >
                <option value="">-- Select Branch --</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name || branch.branchName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedService && selectedBranch && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Selected:</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedService.name} at {selectedBranch.name || selectedBranch.branchName}
                  </p>
                  {selectedService.branchPricing?.[selectedBranchId] && (
                    <p className="text-sm text-gray-600 mt-1">
                      Current Price: {formatCurrency(selectedService.branchPricing[selectedBranchId])}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Price History */}
      {selectedServiceId && selectedBranchId && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : priceHistory.length === 0 ? (
            <Card className="p-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Price History</h3>
                <p className="text-gray-600">
                  No price changes have been recorded for this service at this branch.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Price Change History</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Click on any price change to view sales impact analysis
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Changed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Old Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        New Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Changed By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {priceHistory.map((change) => {
                      const changePercent = getPriceChangePercentage(change.oldPrice, change.newPrice);
                      const isIncrease = change.newPrice > change.oldPrice;
                      
                      return (
                        <tr key={change.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {format(change.changedAt, 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(change.changedAt, 'hh:mm a')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(change.oldPrice)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(change.newPrice)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`flex items-center gap-1 text-sm font-medium ${
                              isIncrease ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {isIncrease ? (
                                <ArrowUp className="h-4 w-4" />
                              ) : (
                                <ArrowDown className="h-4 w-4" />
                              )}
                              {Math.abs(changePercent).toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(Math.abs(change.newPrice - change.oldPrice))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {change.changedByName || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadImpactAnalysis(change)}
                                className="flex items-center gap-2"
                              >
                                <BarChart3 className="h-4 w-4" />
                                View Impact
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadTransactionsForPeriod(change, 'old')}
                                className="flex items-center gap-2"
                                title="View transactions with old price"
                              >
                                <ShoppingCart className="h-4 w-4" />
                                Old Price
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadTransactionsForPeriod(change, 'new')}
                                className="flex items-center gap-2"
                                title="View transactions with new price"
                              >
                                <ShoppingCart className="h-4 w-4" />
                                New Price
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Impact Analysis */}
          {impactData && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Sales Impact Analysis</h2>
                <p className="text-sm text-gray-600">
                  Comparing sales 30 days before and after the price change on{' '}
                  {format(impactData.priceChange.changedAt, 'MMM dd, yyyy')}
                </p>
              </div>

              {loadingImpact ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-blue-50 border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Quantity Sold</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {impactData.changes.quantityChange > 0 ? (
                              <span className="text-red-600">
                                <TrendingUp className="inline h-5 w-5 mr-1" />
                                {impactData.changes.quantityChange.toFixed(1)}%
                              </span>
                            ) : impactData.changes.quantityChange < 0 ? (
                              <span className="text-green-600">
                                <TrendingDown className="inline h-5 w-5 mr-1" />
                                {Math.abs(impactData.changes.quantityChange).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-600">
                                <Minus className="inline h-5 w-5 mr-1" />
                                0%
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Before: {impactData.before.totalQuantity}</span>
                          <span className="text-gray-600">After: {impactData.after.totalQuantity}</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-green-50 border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Revenue</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {impactData.changes.revenueChange > 0 ? (
                              <span className="text-green-600">
                                <TrendingUp className="inline h-5 w-5 mr-1" />
                                {impactData.changes.revenueChange.toFixed(1)}%
                              </span>
                            ) : impactData.changes.revenueChange < 0 ? (
                              <span className="text-red-600">
                                <TrendingDown className="inline h-5 w-5 mr-1" />
                                {Math.abs(impactData.changes.revenueChange).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-600">
                                <Minus className="inline h-5 w-5 mr-1" />
                                0%
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            Before: {formatCurrency(impactData.before.totalRevenue)}
                          </span>
                          <span className="text-gray-600">
                            After: {formatCurrency(impactData.after.totalRevenue)}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-purple-50 border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Sales Count</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {impactData.changes.salesCountChange > 0 ? (
                              <span className="text-red-600">
                                <TrendingUp className="inline h-5 w-5 mr-1" />
                                {impactData.changes.salesCountChange.toFixed(1)}%
                              </span>
                            ) : impactData.changes.salesCountChange < 0 ? (
                              <span className="text-green-600">
                                <TrendingDown className="inline h-5 w-5 mr-1" />
                                {Math.abs(impactData.changes.salesCountChange).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-600">
                                <Minus className="inline h-5 w-5 mr-1" />
                                0%
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-purple-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Before: {impactData.before.totalSales}</span>
                          <span className="text-gray-600">After: {impactData.after.totalSales}</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Detailed Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        30 Days Before Price Change
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Sales:</span>
                          <span className="font-medium">{impactData.before.totalSales}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quantity Sold:</span>
                          <span className="font-medium">{impactData.before.totalQuantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Revenue:</span>
                          <span className="font-medium">{formatCurrency(impactData.before.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Average Price:</span>
                          <span className="font-medium">
                            {formatCurrency(impactData.before.averagePrice)}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        30 Days After Price Change
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Sales:</span>
                          <span className="font-medium">{impactData.after.totalSales}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quantity Sold:</span>
                          <span className="font-medium">{impactData.after.totalQuantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Revenue:</span>
                          <span className="font-medium">{formatCurrency(impactData.after.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Average Price:</span>
                          <span className="font-medium">
                            {formatCurrency(impactData.after.averagePrice)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Comparison Charts */}
                  {impactData && (
                    <div className="space-y-6 mt-6">
                      <h3 className="text-lg font-semibold text-gray-900">Sales Trends Comparison</h3>
                      
                      {/* Revenue Chart */}
                      <Card className="p-4">
                        <h4 className="text-md font-semibold text-gray-700 mb-4">Daily Revenue Trend</h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={(() => {
                            // Combine before and after sales by date
                            const beforeDates = Object.keys(impactData.before.salesByDate || {});
                            const afterDates = Object.keys(impactData.after.salesByDate || {});
                            const allDates = [...new Set([...beforeDates, ...afterDates])].sort();
                            
                            return allDates.map(date => ({
                              date: format(new Date(date), 'MMM dd'),
                              before: impactData.before.salesByDate[date]?.revenue || 0,
                              after: impactData.after.salesByDate[date]?.revenue || 0,
                              changeDate: format(impactData.priceChangeDate, 'MMM dd')
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => `Γé▒${value.toLocaleString()}`} />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="before" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              name="30 Days Before"
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="after" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              name="30 Days After"
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Card>

                      {/* Quantity Chart */}
                      <Card className="p-4">
                        <h4 className="text-md font-semibold text-gray-700 mb-4">Daily Quantity Sold</h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={(() => {
                            const beforeDates = Object.keys(impactData.before.salesByDate || {});
                            const afterDates = Object.keys(impactData.after.salesByDate || {});
                            const allDates = [...new Set([...beforeDates, ...afterDates])].sort();
                            
                            return allDates.map(date => ({
                              date: format(new Date(date), 'MMM dd'),
                              before: impactData.before.salesByDate[date]?.quantity || 0,
                              after: impactData.after.salesByDate[date]?.quantity || 0
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="before" fill="#3b82f6" name="30 Days Before" />
                            <Bar dataKey="after" fill="#ef4444" name="30 Days After" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>

                      {/* Sales Count Chart */}
                      <Card className="p-4">
                        <h4 className="text-md font-semibold text-gray-700 mb-4">Daily Sales Count</h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={(() => {
                            const beforeDates = Object.keys(impactData.before.salesByDate || {});
                            const afterDates = Object.keys(impactData.after.salesByDate || {});
                            const allDates = [...new Set([...beforeDates, ...afterDates])].sort();
                            
                            return allDates.map(date => ({
                              date: format(new Date(date), 'MMM dd'),
                              before: impactData.before.salesByDate[date]?.count || 0,
                              after: impactData.after.salesByDate[date]?.count || 0
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="before" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              name="30 Days Before"
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="after" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              name="30 Days After"
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Transactions Modal */}
          {isTransactionsModalOpen && selectedPriceChange && (
            <Modal
              isOpen={isTransactionsModalOpen}
              onClose={() => {
                setIsTransactionsModalOpen(false);
                setSelectedPriceChange(null);
                setSelectedPriceType(null);
                setTransactions([]);
              }}
              title={`Transactions - ${selectedPriceType === 'old' ? 'Old' : 'New'} Price Period (Γé▒${(selectedPriceType === 'old' ? selectedPriceChange.oldPrice : selectedPriceChange.newPrice).toLocaleString()})`}
              size="xl"
            >
              {loadingTransactions ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Found</h3>
                  <p className="text-gray-600">
                    No transactions found for this price period.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Price Period:</p>
                        <p className="text-lg font-semibold text-gray-900">
                          Γé▒{(selectedPriceType === 'old' ? selectedPriceChange.oldPrice : selectedPriceChange.newPrice).toLocaleString()} per service
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Total Transactions: {transactions.length} | 
                          Total Revenue: Γé▒{transactions.reduce((sum, t) => sum + t.itemPrice * t.quantity, 0).toLocaleString()} |
                          Total Quantity: {transactions.reduce((sum, t) => sum + t.quantity, 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stylist</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-xs text-gray-900">
                                {format(transaction.transactionDate, 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(transaction.transactionDate, 'hh:mm a')}
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              {transaction.clientName}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              {transaction.itemName}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              Γé▒{transaction.itemPrice.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              {transaction.quantity}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">
                              Γé▒{(transaction.itemPrice * transaction.quantity).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              <span className="capitalize">{transaction.paymentMethod}</span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              {transaction.stylistName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Modal>
          )}
        </>
      )}
    </div>
  );
};

export default PriceHistoryAnalytics;



