// src/pages/overall-inventory/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { 
  Package, 
  ShoppingCart,
  AlertTriangle, 
  Calendar,
  Building,
  TrendingUp,
  Banknote,
  RefreshCw,
  Receipt,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import { db } from '../../config/firebase';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { getAllBranches } from '../../services/branchService';
import { productService } from '../../services/productService';
import { inventoryService } from '../../services/inventoryService';
import { format, subDays } from 'date-fns';

const OverallInventoryControllerDashboard = () => {
  const { userData } = useAuth();
  const [stats, setStats] = useState({
    totalBranches: 0,
    totalProducts: 0,
    totalStockItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    expiringSoon: 0,
    overallSales: 0,
    recentAdjustments: 0
  });
  const [branches, setBranches] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get all branches
      const branchesData = await getAllBranches();
      const activeBranches = branchesData.filter(b => b.isActive !== false);
      setBranches(activeBranches);
      
      // Get all products (for fallback unitCost lookup)
      const productsResult = await productService.getAllProducts();
      const totalProducts = productsResult.success ? productsResult.products.length : 0;
      const productsMap = {};
      if (productsResult.success) {
        productsResult.products.forEach(p => {
          productsMap[p.id] = p;
        });
      }

      // Helper to get computed stock (same as Inventory Overview)
      const getComputedStock = (stock) => {
        return stock.remainingQuantity || stock.realTimeStock || stock.beginningStock || stock.currentStock || 0;
      };

      // Helper to filter stocks (same as Inventory Overview - current month only)
      const filterCurrentMonthStocks = (stocks) => {
        const currentDate = new Date();
        const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        const stockList = [];
        const processedRegularStocks = new Set();
        
        stocks.forEach(stock => {
          const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
          
          if (isBatchStock) {
            // For batch stocks, show if has stock, or is current month, or was created recently
            const stockStart = stock.startPeriod ? new Date(stock.startPeriod) : null;
            const isCurrentMonth = stockStart && 
              stockStart.getMonth() === currentMonthStart.getMonth() &&
              stockStart.getFullYear() === currentMonthStart.getFullYear();
            
            const realTimeStock = stock.realTimeStock || 0;
            if (realTimeStock > 0 || isCurrentMonth || (stockStart && stockStart >= currentMonthStart)) {
              stockList.push(stock);
            }
          } else {
            // For regular stocks (non-batch), show current month only (one per product)
            if (!stock.startPeriod) return;
            const stockStart = new Date(stock.startPeriod);
            const isCurrentMonth = 
              stockStart.getMonth() === currentMonthStart.getMonth() &&
              stockStart.getFullYear() === currentMonthStart.getFullYear();
            
            if (isCurrentMonth && !processedRegularStocks.has(stock.productId)) {
              processedRegularStocks.add(stock.productId);
              stockList.push(stock);
            }
          }
        });
        
        return stockList;
      };

      // Load stocks for all branches using inventoryService
      let totalValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalStockItems = 0;
      const branchStockData = {};

      for (const branch of activeBranches) {
        try {
          // Use inventoryService to get branch stocks (same as Inventory Overview)
          const stocksResult = await inventoryService.getBranchStocks(branch.id);
          
          if (stocksResult.success && stocksResult.stocks) {
            // Filter to current month stocks (same as Inventory Overview)
            const filteredStocks = filterCurrentMonthStocks(stocksResult.stocks);
            let branchValue = 0;
            let branchLowStock = 0;
            let branchOutOfStock = 0;
            let branchQuantity = 0;

            filteredStocks.forEach((stock) => {
              const currentStock = getComputedStock(stock);
              const minStock = stock.minStock || 5;
              
              // Get unit cost - try stock first, then fallback to product
              const product = productsMap[stock.productId];
              const unitCost = stock.unitCost || product?.unitCost || product?.price || 0;
              
              const stockValue = currentStock * unitCost;
              
              totalStockItems++;
              totalValue += stockValue;
              branchValue += stockValue;
              branchQuantity += currentStock;
              
              if (currentStock === 0) {
                outOfStockCount++;
                branchOutOfStock++;
              } else if (currentStock <= minStock) {
                lowStockCount++;
                branchLowStock++;
              }
            });

            branchStockData[branch.id] = {
              totalItems: filteredStocks.length,
              totalValue: branchValue,
              totalQuantity: branchQuantity,
              lowStock: branchLowStock,
              outOfStock: branchOutOfStock
            };
          }
        } catch (err) {
          console.warn(`Error loading stocks for branch ${branch.name}:`, err);
          branchStockData[branch.id] = {
            totalItems: 0,
            totalValue: 0,
            totalQuantity: 0,
            lowStock: 0,
            outOfStock: 0
          };
        }
      }

      // Build branch stats array
      const branchStatsArray = activeBranches.map(branch => ({
        id: branch.id,
        name: branch.name,
        ...branchStockData[branch.id] || { totalItems: 0, totalValue: 0, totalQuantity: 0, lowStock: 0, outOfStock: 0 }
      }));
      setBranchStats(branchStatsArray);

      // Get expiring batches (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      let expiringSoonCount = 0;
      try {
        const batchesQuery = query(
          collection(db, 'product_batches'),
          where('expiryDate', '<=', thirtyDaysFromNow),
          where('expiryDate', '>=', new Date())
        );
        const batchesSnapshot = await getDocs(batchesQuery);
        expiringSoonCount = batchesSnapshot.size;
      } catch (err) {
        console.warn('Error loading expiring batches:', err);
      }

      // Get overall product sales from all transactions
      let overallSales = 0;
      const recentTxns = [];

      try {
        const transactionsQuery = query(
          collection(db, 'transactions'),
          orderBy('createdAt', 'desc'),
          limit(500)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        transactionsSnapshot.forEach((doc) => {
          const txn = doc.data();
          const txnDate = txn.createdAt?.toDate ? txn.createdAt.toDate() : new Date(txn.createdAt);
          
          // Extract only product items from the transaction
          const productItems = (txn.items || []).filter(item => item.type === 'product');
          const productValue = productItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
          
          // Add to overall sales
          if (productValue > 0) {
            overallSales += productValue;

            // Add to recent transactions (limit to 5)
            if (recentTxns.length < 5) {
              const branch = activeBranches.find(b => b.id === txn.branchId);
              recentTxns.push({
                id: doc.id,
                ...txn,
                branchName: branch?.name || 'Unknown',
                productValue,
                createdAt: txnDate
              });
            }
          }
        });
      } catch (err) {
        console.warn('Error loading transactions:', err);
      }
      setRecentTransactions(recentTxns);

      // Get recent stock adjustments
      let recentAdjustmentsCount = 0;
      const recentAdj = [];
      try {
        const adjustmentsQuery = query(
          collection(db, 'stockAdjustments'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const adjustmentsSnapshot = await getDocs(adjustmentsQuery);
        recentAdjustmentsCount = adjustmentsSnapshot.size;
        
        adjustmentsSnapshot.forEach((doc) => {
          if (recentAdj.length < 5) {
            const adj = doc.data();
            const branch = activeBranches.find(b => b.id === adj.branchId);
            recentAdj.push({
              id: doc.id,
              ...adj,
              branchName: branch?.name || 'Unknown',
              createdAt: adj.createdAt?.toDate ? adj.createdAt.toDate() : new Date(adj.createdAt)
            });
          }
        });
      } catch (err) {
        console.warn('Error loading adjustments:', err);
      }
      setRecentAdjustments(recentAdj);

      setStats({
        totalBranches: activeBranches.length,
        totalProducts,
        totalStockItems,
        totalValue,
        lowStockItems: lowStockCount,
        outOfStockItems: outOfStockCount,
        expiringSoon: expiringSoonCount,
        overallSales,
        recentAdjustments: recentAdjustmentsCount
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overall Inventory Dashboard</h1>
          <p className="text-gray-600">Monitor inventory across all {stats.totalBranches} branches</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Branches</p>
              <p className="text-xl font-bold">{loading ? '...' : stats.totalBranches}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Items</p>
              <p className="text-xl font-bold">{loading ? '...' : stats.totalStockItems}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Banknote className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Stock Value</p>
              <p className="text-xl font-bold">{loading ? '...' : `₱${stats.totalValue.toLocaleString()}`}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Overall Sales</p>
              <p className="text-xl font-bold">{loading ? '...' : `₱${(stats.overallSales || 0).toLocaleString()}`}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{loading ? '...' : stats.outOfStockItems}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </Card>
        
        <Card className="p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{loading ? '...' : stats.lowStockItems}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-400" />
          </div>
        </Card>
        
        <Card className="p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-orange-600">{loading ? '...' : stats.expiringSoon}</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-400" />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overall Sales</p>
              <p className="text-2xl font-bold text-green-600">{loading ? '...' : `₱${stats.overallSales.toLocaleString()}`}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-400" />
          </div>
        </Card>
      </div>

      {/* Branch Overview & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Stock Overview */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Branch Stock Overview</h2>
            <Link to={ROUTES.OVERALL_INVENTORY_OVERVIEW} className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : branchStats.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No branch data</div>
            ) : (
              branchStats.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{branch.name}</p>
                    <p className="text-sm text-gray-500">{branch.totalItems} items • {branch.totalQuantity || 0} units</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₱{(branch.totalValue || 0).toLocaleString()}</p>
                    <div className="flex gap-2 text-xs">
                      {branch.outOfStock > 0 && (
                        <span className="text-red-600">{branch.outOfStock} out</span>
                      )}
                      {branch.lowStock > 0 && (
                        <span className="text-yellow-600">{branch.lowStock} low</span>
                      )}
                      {branch.outOfStock === 0 && branch.lowStock === 0 && (
                        <span className="text-green-600">All good</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Product Sales */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Product Sales</h2>
            <Link to={ROUTES.OVERALL_INVENTORY_PRODUCT_SALES} className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No recent sales</div>
            ) : (
              recentTransactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Receipt className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{txn.branchName}</p>
                      <p className="text-xs text-gray-500">{format(txn.createdAt, 'MMM dd, HH:mm')}</p>
                    </div>
                  </div>
                  <p className="font-medium text-green-600">+₱{txn.productValue.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent Adjustments & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Adjustments */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Stock Adjustments</h2>
            <Link to={ROUTES.OVERALL_INVENTORY_ADJUST_LOGS} className="text-sm text-blue-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : recentAdjustments.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No recent adjustments</div>
            ) : (
              recentAdjustments.map((adj) => (
                <div key={adj.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${(adj.adjustmentQuantity || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      {(adj.adjustmentQuantity || 0) >= 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{adj.productName || 'Unknown Product'}</p>
                      <p className="text-xs text-gray-500">{adj.branchName} • {format(adj.createdAt, 'MMM dd, HH:mm')}</p>
                    </div>
                  </div>
                  <p className={`font-medium ${(adj.adjustmentQuantity || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(adj.adjustmentQuantity || 0) >= 0 ? '+' : ''}{adj.adjustmentQuantity || 0}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to={ROUTES.OVERALL_INVENTORY_OVERVIEW}>
              <div className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                <Package className="h-6 w-6 text-blue-600 mb-2" />
                <p className="font-medium text-gray-900">Inventory Overview</p>
                <p className="text-xs text-gray-500">View all branch stocks</p>
              </div>
            </Link>
            <Link to={ROUTES.OVERALL_INVENTORY_PURCHASE_ORDERS}>
              <div className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
                <ShoppingCart className="h-6 w-6 text-orange-600 mb-2" />
                <p className="font-medium text-gray-900">Purchase Orders</p>
                <p className="text-xs text-gray-500">Manage PO approvals</p>
              </div>
            </Link>
            <Link to={ROUTES.OVERALL_INVENTORY_ALERTS}>
              <div className="p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer">
                <AlertTriangle className="h-6 w-6 text-red-600 mb-2" />
                <p className="font-medium text-gray-900">Stock Alerts</p>
                <p className="text-xs text-gray-500">Low & out of stock</p>
              </div>
            </Link>
            <Link to={ROUTES.OVERALL_INVENTORY_EXPIRY}>
              <div className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer">
                <Calendar className="h-6 w-6 text-yellow-600 mb-2" />
                <p className="font-medium text-gray-900">Expiry Tracker</p>
                <p className="text-xs text-gray-500">Monitor expiring items</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OverallInventoryControllerDashboard;
