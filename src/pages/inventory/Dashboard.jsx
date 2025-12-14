import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRightLeft, 
  QrCode, 
  BarChart3, 
  Calendar,
  PackageCheck
} from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { stockAlertsService } from '../../services/stockAlertsService';

const InventoryDashboard = () => {
  const { userData, userBranch } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    expiringSoon: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        
        // Get product count
        const productsResult = await productService.getAllProducts();
        const totalProducts = productsResult.success ? productsResult.products.length : 0;

        // Get inventory stats for branch
        let lowStockItems = 0;
        let expiringSoon = 0;
        if (userBranch) {
          const inventoryStats = await inventoryService.getInventoryStats(userBranch);
          if (inventoryStats.success) {
            lowStockItems = inventoryStats.stats.lowStockCount + inventoryStats.stats.outOfStockCount;
          }

          // Get expiring batches (within 30 days)
          const expiringBatches = await inventoryService.getExpiringBatches(userBranch, 30);
          if (expiringBatches.success) {
            expiringSoon = expiringBatches.batches.length;
          }
        }

        // Get active alerts count
        const alertsResult = await stockAlertsService.getAllAlerts({ status: 'Active' });
        const pendingOrders = 0; // TODO: Get from purchase order service

        setStats({
          totalProducts,
          lowStockItems,
          pendingOrders,
          expiringSoon
        });
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [userBranch]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Controller Dashboard</h1>
        <p className="text-gray-600">Manage inventory, stocks, and suppliers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.totalProducts}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.lowStockItems}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <ShoppingCart className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.pendingOrders}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.expiringSoon}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <Link to={ROUTES.INVENTORY_STOCK_TRANSFER}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ArrowRightLeft className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Stock Transfer</h3>
                  <p className="text-sm text-gray-600">Transfer items between branches</p>
                </div>
              </div>
            </div>
          </Card>
        </Link>

        <Link to={ROUTES.INVENTORY_UPC_GENERATOR}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <QrCode className="h-8 w-8 text-indigo-600" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">UPC Generator</h3>
                  <p className="text-sm text-gray-600">Generate barcodes for products</p>
                </div>
              </div>
            </div>
          </Card>
        </Link>

        <Link to={ROUTES.INVENTORY_REPORTS}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-teal-600" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Inventory Reports</h3>
                  <p className="text-sm text-gray-600">View detailed analytics</p>
                </div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <Package className="h-5 w-5 text-blue-600" />
              <span className="ml-3 text-sm">New product added: L'Oréal Hair Color</span>
            </div>
            <span className="text-xs text-gray-500">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="ml-3 text-sm">Low stock alert: Shampoo Bottles</span>
            </div>
            <span className="text-xs text-gray-500">4 hours ago</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <span className="ml-3 text-sm">Purchase order #PO-2024-001 created</span>
            </div>
            <span className="text-xs text-gray-500">1 day ago</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default InventoryDashboard;

