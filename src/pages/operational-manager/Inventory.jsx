import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, TrendingUp, DollarSign, Package, AlertTriangle, 
  BarChart3, Building2, Edit3, History, Eye, RefreshCw,
  ChevronDown, ChevronUp, Filter, Download, FileText,
  CheckCircle, XCircle, Clock, ArrowUpDown, Sliders
} from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { getBranches } from '../../services/branchService';
import { inventoryService } from '../../services/inventoryService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const OperationalManagerInventory = () => {
  const { userData, currentUser } = useAuth();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview'); // overview, stocks, audit, performance
  
  // Force Adjust Modal
  const [showForceAdjustModal, setShowForceAdjustModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [adjustmentData, setAdjustmentData] = useState({
    newQuantity: '',
    reason: '',
    notes: ''
  });
  const [adjusting, setAdjusting] = useState(false);
  
  // Audit Log
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  
  // Stock Details Modal
  const [showStockDetailsModal, setShowStockDetailsModal] = useState(false);
  const [stockDetails, setStockDetails] = useState(null);
  
  // Sorting
  const [sortColumn, setSortColumn] = useState('productName');
  const [sortDirection, setSortDirection] = useState('asc');

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

  // Load audit logs
  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const logs = [];
      
      for (const branch of branches) {
        try {
          const movements = await inventoryService.getInventoryMovements(branch.id, { limit: 50 });
          if (movements.success) {
            movements.movements.forEach(m => {
              logs.push({
                ...m,
                branchId: branch.id,
                branchName: branch.name
              });
            });
          }
        } catch (err) {
          console.warn(`Error loading movements for branch ${branch.name}:`, err);
        }
      }
      
      // Sort by date descending
      logs.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
      
      setAuditLogs(logs.slice(0, 100));
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      loadInventory();
      if (activeTab === 'audit') {
        loadAuditLogs();
      }
    }
  }, [selectedBranch, branches.length, activeTab]);

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(inventory.map(item => item.category).filter(Boolean))];
  }, [inventory]);

  // Calculate cost summaries
  const costSummary = useMemo(() => {
    let totalCost = 0;
    let totalSalesValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    inventory.forEach(item => {
      const unitCost = item.unitCost || 0;
      const currentStock = item.currentStock || 0;
      const sellingPrice = item.sellingPrice || unitCost * 1.5;
      
      totalCost += unitCost * currentStock;
      totalSalesValue += sellingPrice * currentStock;
      
      if (currentStock > 0 && currentStock <= (item.minStock || 0)) {
        lowStockCount++;
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
      lowStockCount,
      outOfStockCount,
      totalItems: inventory.length
    };
  }, [inventory]);

  // Branch Performance Data
  const branchPerformance = useMemo(() => {
    const performance = {};
    
    branches.forEach(branch => {
      performance[branch.id] = {
        branchName: branch.name,
        totalItems: 0,
        totalValue: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        healthyItems: 0,
        turnoverRate: 0
      };
    });

    inventory.forEach(item => {
      if (!performance[item.branchId]) return;
      
      const unitCost = item.unitCost || 0;
      const currentStock = item.currentStock || 0;
      const minStock = item.minStock || 0;
      
      performance[item.branchId].totalItems++;
      performance[item.branchId].totalValue += unitCost * currentStock;
      
      if (currentStock === 0) {
        performance[item.branchId].outOfStockItems++;
      } else if (currentStock <= minStock) {
        performance[item.branchId].lowStockItems++;
      } else {
        performance[item.branchId].healthyItems++;
      }
    });

    // Calculate health score for each branch
    return Object.entries(performance).map(([branchId, data]) => {
      const healthScore = data.totalItems > 0 
        ? Math.round((data.healthyItems / data.totalItems) * 100)
        : 0;
      return {
        branchId,
        ...data,
        healthScore
      };
    }).sort((a, b) => b.healthScore - a.healthScore);
  }, [inventory, branches]);

  // Filtered and sorted inventory
  const filteredInventory = useMemo(() => {
    let filtered = inventory;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.productName?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term) ||
        item.branchName?.toLowerCase().includes(term)
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [inventory, searchTerm, categoryFilter, sortColumn, sortDirection]);

  // Handle sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Open Force Adjust Modal
  const handleForceAdjust = (stock) => {
    setSelectedStock(stock);
    setAdjustmentData({
      newQuantity: stock.currentStock?.toString() || '0',
      reason: '',
      notes: ''
    });
    setShowForceAdjustModal(true);
  };

  // Submit Force Adjustment
  const handleSubmitAdjustment = async () => {
    if (!selectedStock) return;
    
    const newQty = parseInt(adjustmentData.newQuantity);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    if (!adjustmentData.reason.trim()) {
      toast.error('Please provide a reason for the adjustment');
      return;
    }

    try {
      setAdjusting(true);
      
      const oldQuantity = selectedStock.currentStock || 0;
      const difference = newQty - oldQuantity;
      
      // Update the stock
      const stockRef = doc(db, 'branch_stocks', selectedStock.id);
      await updateDoc(stockRef, {
        currentStock: newQty,
        status: newQty > (selectedStock.minStock || 0) ? 'In Stock' : 
                newQty > 0 ? 'Low Stock' : 'Out of Stock',
        lastAdjustedAt: serverTimestamp(),
        lastAdjustedBy: currentUser?.uid || 'system',
        lastAdjustedByName: userData?.firstName ? `${userData.firstName} ${userData.lastName}` : 'Operational Manager'
      });
      
      // Log the adjustment
      await addDoc(collection(db, 'inventory_movements'), {
        branchId: selectedStock.branchId,
        productId: selectedStock.productId,
        productName: selectedStock.productName,
        stockId: selectedStock.id,
        type: 'force_adjustment',
        previousQuantity: oldQuantity,
        newQuantity: newQty,
        quantityChange: difference,
        reason: adjustmentData.reason,
        notes: adjustmentData.notes,
        performedBy: currentUser?.uid || 'system',
        performedByName: userData?.firstName ? `${userData.firstName} ${userData.lastName}` : 'Operational Manager',
        performedByRole: 'Operational Manager',
        createdAt: serverTimestamp()
      });
      
      toast.success(`Stock adjusted from ${oldQuantity} to ${newQty}`);
      setShowForceAdjustModal(false);
      setSelectedStock(null);
      loadInventory();
      
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error('Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  // View Stock Details
  const handleViewDetails = (stock) => {
    setStockDetails(stock);
    setShowStockDetailsModal(true);
  };

  // Get status badge
  const getStatusBadge = (stock) => {
    const current = stock.currentStock || 0;
    const min = stock.minStock || 0;
    
    if (current === 0) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Out of Stock</span>;
    } else if (current <= min) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Low Stock</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">In Stock</span>;
  };

  if (loading && inventory.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Overall Inventory</h1>
          <p className="text-gray-600">Monitor, audit, and manage inventory across all branches</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { loadInventory(); if (activeTab === 'audit') loadAuditLogs(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'stocks', label: 'All Stocks', icon: Package },
            { id: 'audit', label: 'Audit Log', icon: History },
            { id: 'performance', label: 'Branch Performance', icon: Building2 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Summary Stats Cards - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Items</p>
              <p className="text-lg font-bold text-gray-900">{costSummary.totalItems}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Value</p>
              <p className="text-lg font-bold text-green-600">₱{costSummary.totalCost.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Sales Value</p>
              <p className="text-lg font-bold text-purple-600">₱{costSummary.totalSalesValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Profit Margin</p>
              <p className="text-lg font-bold text-emerald-600">{costSummary.profitMargin.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Low Stock</p>
              <p className="text-lg font-bold text-orange-600">{costSummary.lowStockCount}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Out of Stock</p>
              <p className="text-lg font-bold text-red-600">{costSummary.outOfStockCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search products, SKU, branch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[150px]"
          >
            <option value="all">All Branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[150px]"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {categories.slice(0, 8).map(category => {
                const items = inventory.filter(i => i.category === category);
                const value = items.reduce((sum, i) => sum + ((i.unitCost || 0) * (i.currentStock || 0)), 0);
                const percentage = costSummary.totalCost > 0 ? (value / costSummary.totalCost * 100) : 0;
                
                return (
                  <div key={category} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{category}</span>
                        <span className="text-gray-500">₱{value.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{percentage.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
          
          {/* Branch Summary */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Branch Inventory Summary</h3>
            <div className="space-y-3">
              {branchPerformance.map(branch => (
                <div key={branch.branchId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{branch.branchName}</p>
                      <p className="text-xs text-gray-500">{branch.totalItems} items • ₱{branch.totalValue.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {branch.outOfStockItems > 0 && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">{branch.outOfStockItems} OOS</span>
                    )}
                    {branch.lowStockItems > 0 && (
                      <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">{branch.lowStockItems} Low</span>
                    )}
                    <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                      branch.healthScore >= 80 ? 'bg-green-100 text-green-700' :
                      branch.healthScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {branch.healthScore}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* All Stocks Tab */}
      {activeTab === 'stocks' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('productName')}
                  >
                    <div className="flex items-center gap-1">
                      Product
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('branchName')}
                  >
                    <div className="flex items-center gap-1">
                      Branch
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('currentStock')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Stock
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('unitCost')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Unit Cost
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInventory.length > 0 ? (
                  filteredInventory.slice(0, 100).map((stock) => (
                    <tr key={stock.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{stock.productName}</p>
                          <p className="text-xs text-gray-500">{stock.sku || stock.category || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{stock.branchName}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-gray-900">{stock.currentStock || 0}</span>
                        <span className="text-xs text-gray-500 ml-1">/ {stock.minStock || 0} min</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(stock)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        ₱{(stock.unitCost || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        ₱{((stock.unitCost || 0) * (stock.currentStock || 0)).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetails(stock)}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleForceAdjust(stock)}
                            className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                            title="Force Adjust"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      No inventory items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredInventory.length > 100 && (
            <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500 text-center">
              Showing 100 of {filteredInventory.length} items. Use filters to narrow down results.
            </div>
          )}
        </Card>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Inventory Audit Log</h3>
            <p className="text-sm text-gray-500">Track all inventory movements and adjustments</p>
          </div>
          
          {loadingAudit ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => {
                      const date = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt);
                      const change = log.quantityChange || (log.newQuantity - log.previousQuantity) || 0;
                      
                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {format(date, 'MMM dd, yyyy HH:mm')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{log.branchName}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{log.productName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              log.type === 'force_adjustment' ? 'bg-orange-100 text-orange-700' :
                              log.type === 'sale' ? 'bg-blue-100 text-blue-700' :
                              log.type === 'restock' ? 'bg-green-100 text-green-700' :
                              log.type === 'transfer_in' ? 'bg-purple-100 text-purple-700' :
                              log.type === 'transfer_out' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {log.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {change > 0 ? '+' : ''}{change}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {log.performedByName || log.performedBy || 'System'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                            {log.reason || log.notes || '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        No audit logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Branch Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchPerformance.map(branch => (
              <Card key={branch.branchId} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{branch.branchName}</h3>
                      <p className="text-xs text-gray-500">{branch.totalItems} total items</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 text-sm font-bold rounded-full ${
                    branch.healthScore >= 80 ? 'bg-green-100 text-green-700' :
                    branch.healthScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {branch.healthScore}%
                  </div>
                </div>
                
                {/* Health Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Inventory Health</span>
                    <span>{branch.healthyItems} healthy / {branch.totalItems} total</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-green-500 h-full"
                      style={{ width: `${branch.totalItems > 0 ? (branch.healthyItems / branch.totalItems * 100) : 0}%` }}
                    />
                    <div 
                      className="bg-orange-500 h-full"
                      style={{ width: `${branch.totalItems > 0 ? (branch.lowStockItems / branch.totalItems * 100) : 0}%` }}
                    />
                    <div 
                      className="bg-red-500 h-full"
                      style={{ width: `${branch.totalItems > 0 ? (branch.outOfStockItems / branch.totalItems * 100) : 0}%` }}
                    />
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <p className="text-lg font-bold text-green-600">{branch.healthyItems}</p>
                    <p className="text-xs text-green-700">Healthy</p>
                  </div>
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <p className="text-lg font-bold text-orange-600">{branch.lowStockItems}</p>
                    <p className="text-xs text-orange-700">Low Stock</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg">
                    <p className="text-lg font-bold text-red-600">{branch.outOfStockItems}</p>
                    <p className="text-xs text-red-700">Out of Stock</p>
                  </div>
                </div>
                
                {/* Total Value */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Inventory Value</span>
                    <span className="text-lg font-bold text-gray-900">₱{branch.totalValue.toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          {/* Performance Summary Table */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Branch Performance Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Inventory Value</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Healthy</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Low Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Out of Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Health Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {branchPerformance.map(branch => (
                    <tr key={branch.branchId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{branch.branchName}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{branch.totalItems}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">₱{branch.totalValue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-600 font-medium">{branch.healthyItems}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-600 font-medium">{branch.lowStockItems}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-red-600 font-medium">{branch.outOfStockItems}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          branch.healthScore >= 80 ? 'bg-green-100 text-green-700' :
                          branch.healthScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {branch.healthScore}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Force Adjust Modal */}
      <Modal
        isOpen={showForceAdjustModal}
        onClose={() => {
          setShowForceAdjustModal(false);
          setSelectedStock(null);
        }}
        title="Force Adjust Stock"
        size="md"
      >
        {selectedStock && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">Force Adjustment</p>
                  <p className="text-sm text-orange-700">This action will directly modify the stock quantity and will be logged in the audit trail.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">{selectedStock.productName}</p>
              <p className="text-sm text-gray-500">{selectedStock.branchName}</p>
              <p className="text-sm text-gray-500 mt-1">Current Stock: <span className="font-medium">{selectedStock.currentStock || 0}</span></p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Quantity <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={adjustmentData.newQuantity}
                onChange={(e) => setAdjustmentData(prev => ({ ...prev, newQuantity: e.target.value }))}
                placeholder="Enter new quantity"
              />
              {adjustmentData.newQuantity && (
                <p className="text-sm mt-1">
                  Change: <span className={`font-medium ${
                    parseInt(adjustmentData.newQuantity) > (selectedStock.currentStock || 0) ? 'text-green-600' :
                    parseInt(adjustmentData.newQuantity) < (selectedStock.currentStock || 0) ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {parseInt(adjustmentData.newQuantity) - (selectedStock.currentStock || 0) > 0 ? '+' : ''}
                    {parseInt(adjustmentData.newQuantity) - (selectedStock.currentStock || 0)}
                  </span>
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={adjustmentData.reason}
                onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a reason</option>
                <option value="Physical count correction">Physical count correction</option>
                <option value="Damaged goods">Damaged goods</option>
                <option value="Expired products">Expired products</option>
                <option value="Theft/Loss">Theft/Loss</option>
                <option value="System error correction">System error correction</option>
                <option value="Audit adjustment">Audit adjustment</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={adjustmentData.notes}
                onChange={(e) => setAdjustmentData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Add any additional details..."
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForceAdjustModal(false);
                  setSelectedStock(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAdjustment}
                disabled={adjusting || !adjustmentData.reason}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {adjusting ? 'Adjusting...' : 'Force Adjust'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock Details Modal */}
      <Modal
        isOpen={showStockDetailsModal}
        onClose={() => {
          setShowStockDetailsModal(false);
          setStockDetails(null);
        }}
        title="Stock Details"
        size="md"
      >
        {stockDetails && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {stockDetails.imageUrl ? (
                <img src={stockDetails.imageUrl} alt={stockDetails.productName} className="w-20 h-20 object-cover rounded-lg" />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{stockDetails.productName}</h3>
                <p className="text-sm text-gray-500">{stockDetails.sku || 'No SKU'}</p>
                <p className="text-sm text-gray-500">{stockDetails.branchName}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Current Stock</p>
                <p className="text-xl font-bold text-gray-900">{stockDetails.currentStock || 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Min Stock Level</p>
                <p className="text-xl font-bold text-gray-900">{stockDetails.minStock || 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Unit Cost</p>
                <p className="text-xl font-bold text-gray-900">₱{(stockDetails.unitCost || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Value</p>
                <p className="text-xl font-bold text-green-600">₱{((stockDetails.unitCost || 0) * (stockDetails.currentStock || 0)).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Category</span>
                <span className="font-medium text-gray-900">{stockDetails.category || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Status</span>
                {getStatusBadge(stockDetails)}
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Location</span>
                <span className="font-medium text-gray-900">{stockDetails.location || 'Not specified'}</span>
              </div>
              {stockDetails.expiryDate && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Expiry Date</span>
                  <span className="font-medium text-gray-900">
                    {format(stockDetails.expiryDate?.toDate ? stockDetails.expiryDate.toDate() : new Date(stockDetails.expiryDate), 'MMM dd, yyyy')}
                  </span>
                </div>
              )}
              {stockDetails.lastAdjustedAt && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Last Adjusted</span>
                  <span className="font-medium text-gray-900">
                    {format(stockDetails.lastAdjustedAt?.toDate ? stockDetails.lastAdjustedAt.toDate() : new Date(stockDetails.lastAdjustedAt), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStockDetailsModal(false);
                  setStockDetails(null);
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowStockDetailsModal(false);
                  handleForceAdjust(stockDetails);
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Sliders className="w-4 h-4 mr-2" />
                Force Adjust
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OperationalManagerInventory;
