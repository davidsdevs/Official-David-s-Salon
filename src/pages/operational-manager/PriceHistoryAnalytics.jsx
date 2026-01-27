/**
 * Branch Price Analytics Page
 * Shows all services with current prices, transaction counts, and price comparison
 * Includes visual comparison charts when viewing all branches
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import {
  TrendingUp,
  TrendingDown,
  Search,
  AlertCircle,
  RefreshCw,
  Building2,
  DollarSign,
  ShoppingCart,
  ArrowUp,
  ArrowDown,
  History,
  BarChart3,
  LineChart as LineChartIcon
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllBranches } from '../../services/branchService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
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
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceHistory, setPriceHistory] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load branches
      const branchesList = await getAllBranches();
      setBranches(branchesList);

      // Load services
      const servicesRef = collection(db, 'services');
      const servicesSnap = await getDocs(query(servicesRef, where('isActive', '==', true)));
      
      const servicesData = [];
      const priceHistoryMap = {};

      for (const doc of servicesSnap.docs) {
        const serviceData = { id: doc.id, ...doc.data() };
        
        // Get branch pricing for this service
        const branchPricing = serviceData.branchPricing || {};
        
        // Get transaction count for this service
        const transactionsRef = collection(db, 'transactions');
        const transactionsSnap = await getDocs(transactionsRef);
        
        let transactionCount = 0;
        let totalRevenue = 0;
        
        transactionsSnap.docs.forEach(txDoc => {
          const txData = txDoc.data();
          const items = txData.items || [];
          items.forEach(item => {
            if (item.serviceId === doc.id || item.name === serviceData.name) {
              transactionCount++;
              totalRevenue += item.price || 0;
            }
          });
        });

        // Get price history for this service
        const priceHistoryRef = collection(db, 'priceHistory');
        const priceHistorySnap = await getDocs(
          query(priceHistoryRef, where('serviceId', '==', doc.id))
        );
        
        const history = priceHistorySnap.docs.map(histDoc => ({
          id: histDoc.id,
          ...histDoc.data(),
          changedAt: histDoc.data().changedAt?.toDate ? histDoc.data().changedAt.toDate() : new Date(histDoc.data().changedAt)
        }));

        priceHistoryMap[doc.id] = history;

        servicesData.push({
          ...serviceData,
          branchPricing,
          transactionCount,
          totalRevenue,
          priceHistory: history
        });
      }

      setServices(servicesData);
      setPriceHistory(priceHistoryMap);
      console.log('📊 Loaded services:', servicesData.length);
      console.log('💰 Price history:', priceHistoryMap);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load price analytics');
    } finally {
      setLoading(false);
    }
  };

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = !searchTerm || 
        service.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [services, searchTerm]);

  // Get service data for selected branch
  const getServiceDataForBranch = (service, branchId) => {
    if (branchId === 'all') {
      // Show base price if all branches selected
      return {
        currentPrice: service.basePrice || 0,
        hasHistory: service.priceHistory?.length > 0
      };
    }

    // Get branch-specific pricing
    const branchPrice = service.branchPricing?.[branchId];
    const history = service.priceHistory?.filter(h => h.branchId === branchId) || [];
    
    return {
      currentPrice: branchPrice || service.basePrice || 0,
      hasHistory: history.length > 0,
      history: history.sort((a, b) => b.changedAt - a.changedAt)
    };
  };

  // Get old price (most recent price change)
  const getOldPrice = (service, branchId) => {
    const data = getServiceDataForBranch(service, branchId);
    if (!data.hasHistory || !data.history || data.history.length === 0) {
      return null;
    }
    return data.history[0].oldPrice;
  };

  // Calculate price change
  const getPriceChange = (service, branchId) => {
    const data = getServiceDataForBranch(service, branchId);
    const oldPrice = getOldPrice(service, branchId);
    
    if (!oldPrice) return null;
    
    const change = data.currentPrice - oldPrice;
    const percentChange = (change / oldPrice) * 100;
    
    return {
      amount: change,
      percent: percentChange,
      isIncrease: change > 0
    };
  };

  const formatCurrency = (amount) => {
    return `₱${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Branch colors for charts
  const branchColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#84CC16', // Lime
  ];

  // Prepare comparison chart data (for "All Branches" view)
  const comparisonChartData = useMemo(() => {
    if (selectedBranch !== 'all') return [];

    return filteredServices.map(service => {
      const dataPoint = {
        name: service.name.length > 20 ? service.name.substring(0, 20) + '...' : service.name,
        basePrice: service.basePrice || 0
      };

      // Add each branch's price
      branches.forEach(branch => {
        const branchPrice = service.branchPricing?.[branch.id] || service.basePrice || 0;
        dataPoint[branch.id] = branchPrice;
      });

      return dataPoint;
    });
  }, [filteredServices, branches, selectedBranch]);

  // Statistics
  const stats = useMemo(() => {
    const totalServices = filteredServices.length;
    const totalTransactions = filteredServices.reduce((sum, s) => sum + (s.transactionCount || 0), 0);
    const totalRevenue = filteredServices.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
    
    let servicesWithIncrease = 0;
    let servicesWithDecrease = 0;
    
    filteredServices.forEach(service => {
      const change = getPriceChange(service, selectedBranch);
      if (change) {
        if (change.isIncrease) servicesWithIncrease++;
        else servicesWithDecrease++;
      }
    });

    return {
      totalServices,
      totalTransactions,
      totalRevenue,
      servicesWithIncrease,
      servicesWithDecrease
    };
  }, [filteredServices, selectedBranch]);

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Price Analytics</h1>
          <p className="text-gray-600">View all services with current prices and transaction history</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Services</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalServices}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <History className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Price Increases</p>
              <p className="text-2xl font-bold text-red-600">{stats.servicesWithIncrease}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Price Decreases</p>
              <p className="text-2xl font-bold text-green-600">{stats.servicesWithDecrease}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">🔍 Compare All Branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                📍 {branch.name || branch.branchName}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Comparison View - Only show when "All Branches" is selected */}
      {selectedBranch === 'all' && filteredServices.length > 0 && (
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Branch Price Comparison</h2>
            </div>
            <p className="text-gray-600 text-sm">Visual comparison of service prices across all branches</p>
          </div>

          {/* Branch Legend */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-3">Branch Legend:</p>
            <div className="flex flex-wrap gap-3">
              {branches.map((branch, index) => (
                <div key={branch.id} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: branchColors[index % branchColors.length] }}
                  />
                  <span className="text-sm text-gray-700">{branch.name || branch.branchName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line Chart */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-blue-600" />
              Price Trends Across Branches
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={comparisonChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `₱${value}`}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => {
                    const branch = branches.find(b => b.id === value);
                    return branch ? (branch.name || branch.branchName) : value;
                  }}
                />
                {branches.map((branch, index) => (
                  <Line
                    key={branch.id}
                    type="monotone"
                    dataKey={branch.id}
                    stroke={branchColors[index % branchColors.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Price Comparison by Service
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={comparisonChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `₱${value}`}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => {
                    const branch = branches.find(b => b.id === value);
                    return branch ? (branch.name || branch.branchName) : value;
                  }}
                />
                {branches.map((branch, index) => (
                  <Bar
                    key={branch.id}
                    dataKey={branch.id}
                    fill={branchColors[index % branchColors.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Price Variance Analysis */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredServices.slice(0, 3).map(service => {
              const prices = branches.map(b => service.branchPricing?.[b.id] || service.basePrice || 0);
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const variance = maxPrice - minPrice;
              const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

              return (
                <div key={service.id} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-3">{service.name}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lowest:</span>
                      <span className="font-bold text-green-600">{formatCurrency(minPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Highest:</span>
                      <span className="font-bold text-red-600">{formatCurrency(maxPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(avgPrice)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="text-gray-600">Variance:</span>
                      <span className="font-bold text-purple-600">{formatCurrency(variance)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Services Table */}
      <Card className="overflow-hidden">
        {filteredServices.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Services Found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Old Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredServices.map((service) => {
                  const data = getServiceDataForBranch(service, selectedBranch);
                  const oldPrice = getOldPrice(service, selectedBranch);
                  const priceChange = getPriceChange(service, selectedBranch);

                  return (
                    <tr key={service.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{service.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                          {service.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-lg font-bold text-gray-900">
                          {formatCurrency(data.currentPrice)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {oldPrice ? (
                          <span className="text-gray-600">{formatCurrency(oldPrice)}</span>
                        ) : (
                          <span className="text-gray-400 text-sm">No history</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {priceChange ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                              priceChange.isIncrease 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {priceChange.isIncrease ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                              {Math.abs(priceChange.percent).toFixed(1)}%
                            </span>
                            <span className={`text-xs ${priceChange.isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                              {priceChange.isIncrease ? '+' : ''}{formatCurrency(priceChange.amount)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-gray-900 font-medium">
                          {service.transactionCount || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-gray-900 font-medium">
                          {formatCurrency(service.totalRevenue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PriceHistoryAnalytics;
