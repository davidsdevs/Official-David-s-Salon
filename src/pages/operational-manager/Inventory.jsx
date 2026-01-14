import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, TrendingUp, DollarSign, Package, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { getBranches } from '../../services/branchService';
import { inventoryService } from '../../services/inventoryService';
import toast from 'react-hot-toast';

const OperationalManagerInventory = () => {
  const { userData } = useAuth();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Load branches
  const loadBranches = async () => {
    try {
      const branchesData = await getBranches(userData?.roles?.[0] || 'Operational Manager', userData?.uid || '');
      setBranches(Array.isArray(branchesData) ? branchesData : (branchesData?.branches || []));
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  };

  // Load inventory across all branches
  const loadInventory = async () => {
    try {
      setLoading(true);

      const allInventory = [];
      
      if (selectedBranch === 'all') {
        for (const branch of branches) {
          try {
            const stocksResult = await inventoryService.getBranchStocks(branch.id);
            if (stocksResult.success) {
              stocksResult.stocks.forEach(stock => {
                allInventory.push({
                  ...stock,
                  branchId: branch.id,
                  branchName: branch.name
                });
              });
            }
          } catch (err) {
            console.warn(`Error loading stocks for branch ${branch.name}:`, err);
          }
        }
      } else {
        const stocksResult = await inventoryService.getBranchStocks(selectedBranch);
        if (stocksResult.success) {
          const branch = branches.find(b => b.id === selectedBranch);
          stocksResult.stocks.forEach(stock => {
            allInventory.push({
              ...stock,
              branchId: selectedBranch,
              branchName: branch?.name || 'Unknown Branch'
            });
          });
        }
      }

      setInventory(allInventory);
    } catch (err) {
      console.error('Error loading inventory:', err);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      loadInventory();
    }
  }, [selectedBranch, branches.length]);

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(inventory.map(item => item.category).filter(Boolean))];
  }, [inventory]);

  // Calculate cost summaries
  const costSummary = useMemo(() => {
    let totalCost = 0;
    let totalSalesValue = 0;
    let lowStockValue = 0;
    let outOfStockCount = 0;

    inventory.forEach(item => {
      const unitCost = item.unitCost || 0;
      const currentStock = item.currentStock || 0;
      const sellingPrice = item.sellingPrice || unitCost * 1.5;
      
      totalCost += unitCost * currentStock;
      totalSalesValue += sellingPrice * currentStock;
      
      if (currentStock > 0 && currentStock <= (item.minStock || 0)) {
        lowStockValue += unitCost * currentStock;
      }
      
      if (currentStock === 0) {
        outOfStockCount++;
      }
    });

    const grossProfit = totalSalesValue - totalCost;
    const profitMargin = totalSalesValue > 0 ? (grossProfit / totalSalesValue * 100) : 0;

    return {
      totalCost,
      totalSalesValue,
      grossProfit,
      profitMargin,
      lowStockValue,
      outOfStockCount,
      totalItems: inventory.length
    };
  }, [inventory]);

  // Filter inventory by category
  const filteredByCategory = useMemo(() => {
    if (categoryFilter === 'all') return inventory;
    return inventory.filter(item => item.category === categoryFilter);
  }, [inventory, categoryFilter]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    
    filteredByCategory.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!breakdown[category]) {
        breakdown[category] = {
          cost: 0,
          sales: 0,
          count: 0
        };
      }
      
      const unitCost = item.unitCost || 0;
      const currentStock = item.currentStock || 0;
      const sellingPrice = item.sellingPrice || unitCost * 1.5;
      
      breakdown[category].cost += unitCost * currentStock;
      breakdown[category].sales += sellingPrice * currentStock;
      breakdown[category].count += currentStock;
    });

    return Object.entries(breakdown).map(([category, data]) => ({
      category,
      ...data,
      profit: data.sales - data.cost,
      margin: data.sales > 0 ? ((data.sales - data.cost) / data.sales * 100) : 0
    }));
  }, [filteredByCategory]);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Cost Summary</h1>
        <p className="text-gray-600">Overview of costs, prices, and sales across inventory</p>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₱{costSummary.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sales Value</p>
              <p className="text-2xl font-bold text-green-600 mt-1">₱{costSummary.totalSalesValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gross Profit</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">₱{costSummary.grossProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500 mt-1">{costSummary.profitMargin.toFixed(1)}% margin</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Value</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">₱{costSummary.lowStockValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{costSummary.outOfStockCount}</p>
              <p className="text-xs text-gray-500 mt-1">items</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <Package className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Branch Filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
          >
            <option value="all">All Branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categoryBreakdown.length > 0 ? (
                categoryBreakdown.map((cat) => (
                  <tr key={cat.category} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.category}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">{cat.count}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">₱{cat.cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">₱{cat.sales.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-4 text-sm text-right text-purple-600 font-medium">₱{cat.profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium">{cat.margin.toFixed(1)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No inventory data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OperationalManagerInventory;
