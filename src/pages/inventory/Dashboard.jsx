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
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const InventoryDashboard = () => {
  const { userData, userBranch } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    expiringSoon: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.branchId) return;

    // Real-time listener for stock alerts
    const alertsRef = collection(db, 'stockAlerts');
    const alertsQuery = query(
      alertsRef,
      where('branchId', '==', userData.branchId)
    );

    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const lowStockCount = snapshot.docs.length;
      setStats(prev => ({ ...prev, lowStockItems: lowStockCount }));
    }, (error) => {
      console.error('Error listening to stock alerts:', error);
    });

    // Real-time listener for pending purchase orders
    const purchaseOrdersRef = collection(db, 'purchaseOrders');
    const poQuery = query(
      purchaseOrdersRef,
      where('branchId', '==', userData.branchId),
      where('status', '==', 'Pending')
    );

    const unsubscribePO = onSnapshot(poQuery, (snapshot) => {
      const pendingCount = snapshot.docs.length;
      setStats(prev => ({ ...prev, pendingOrders: pendingCount }));
    }, (error) => {
      console.error('Error listening to purchase orders:', error);
    });

    // Real-time listener for expiring batches
    const batchesRef = collection(db, 'batches');
    const batchesQuery = query(
      batchesRef,
      where('branchId', '==', userData.branchId),
      where('status', '==', 'active')
    );

    const unsubscribeBatches = onSnapshot(batchesQuery, (snapshot) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      let expiringCount = 0;
      snapshot.docs.forEach(doc => {
        const batch = doc.data();
        if (batch.expirationDate) {
          const expiryDate = batch.expirationDate instanceof Date 
            ? batch.expirationDate 
            : new Date(batch.expirationDate);
          expiryDate.setHours(0, 0, 0, 0);
          
          if (expiryDate >= today && expiryDate <= thirtyDaysFromNow) {
            expiringCount++;
          }
        }
      });

      setStats(prev => ({ ...prev, expiringSoon: expiringCount }));
    }, (error) => {
      console.error('Error listening to batches:', error);
    });

    // Load total products (one-time, as this doesn't change frequently)
    const loadTotalProducts = async () => {
      try {
        const productsRef = collection(db, 'products');
        const snapshot = await getDocs(productsRef);
        setStats(prev => ({ ...prev, totalProducts: snapshot.docs.length }));
      } catch (error) {
        console.error('Error loading total products:', error);
      }
    };

    loadTotalProducts();
    setLoading(false);

    // Cleanup subscriptions
    return () => {
      unsubscribeAlerts();
      unsubscribePO();
      unsubscribeBatches();
    };
  }, [userData?.branchId]);

  // Load recent activity
  useEffect(() => {
    if (!userData?.branchId) return;

    const loadActivity = async () => {
      try {
        const activities = [];

        // Get recent stock alerts
        const alertsRef = collection(db, 'stockAlerts');
        const alertsQuery = query(
          alertsRef,
          where('branchId', '==', userData.branchId)
        );
        const alertsSnapshot = await getDocs(alertsQuery);
        alertsSnapshot.docs.slice(0, 3).forEach(doc => {
          const alert = doc.data();
          activities.push({
            id: doc.id,
            type: 'alert',
            icon: AlertTriangle,
            title: `Low stock alert: ${alert.productName}`,
            timestamp: alert.createdAt,
            color: 'text-red-600'
          });
        });

        // Get recent purchase orders
        const poRef = collection(db, 'purchaseOrders');
        const poQuery = query(
          poRef,
          where('branchId', '==', userData.branchId)
        );
        const poSnapshot = await getDocs(poQuery);
        poSnapshot.docs.slice(0, 3).forEach(doc => {
          const po = doc.data();
          activities.push({
            id: doc.id,
            type: 'order',
            icon: ShoppingCart,
            title: `Purchase order ${po.orderId} created`,
            timestamp: po.createdAt,
            color: 'text-green-600'
          });
        });

        // Get recent products
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        productsSnapshot.docs.slice(0, 3).forEach(doc => {
          const product = doc.data();
          activities.push({
            id: doc.id,
            type: 'product',
            icon: Package,
            title: `New product added: ${product.name}`,
            timestamp: product.createdAt,
            color: 'text-blue-600'
          });
        });

        // Sort by timestamp (most recent first)
        activities.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
          return timeB.getTime() - timeA.getTime();
        });

        setRecentActivity(activities.slice(0, 5));
      } catch (error) {
        console.error('Error loading recent activity:', error);
      }
    };

    loadActivity();
  }, [userData?.branchId]);

  // Helper function to format time difference
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Inventory Controller Dashboard</h1>
          <p className="text-sm md:text-base text-gray-600">Manage inventory, stocks, and suppliers</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center">
            <Package className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
            <div className="ml-2 md:ml-4 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Total Products</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.totalProducts}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
            <div className="ml-2 md:ml-4 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Low Stock Items</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.lowStockItems}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center">
            <ShoppingCart className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
            <div className="ml-2 md:ml-4 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Pending Orders</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.pendingOrders}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 md:h-8 md:w-8 text-orange-600 flex-shrink-0" />
            <div className="ml-2 md:ml-4 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Expiring Soon</p>
              <p className="text-lg md:text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.expiringSoon}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        <Link to={ROUTES.INVENTORY_STOCK_TRANSFER}>
          <Card className="p-4 md:p-5 lg:p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center">
              <ArrowRightLeft className="h-6 w-6 md:h-8 md:w-8 text-purple-600 flex-shrink-0" />
              <div className="ml-3 md:ml-4 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">Stock Transfer</h3>
                <p className="text-xs md:text-sm text-gray-600 truncate">Transfer items between branches</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to={ROUTES.INVENTORY_UPC_GENERATOR}>
          <Card className="p-4 md:p-5 lg:p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center">
              <QrCode className="h-6 w-6 md:h-8 md:w-8 text-indigo-600 flex-shrink-0" />
              <div className="ml-3 md:ml-4 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">UPC Generator</h3>
                <p className="text-xs md:text-sm text-gray-600 truncate">Generate barcodes for products</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to={ROUTES.INVENTORY_REPORTS}>
          <Card className="p-4 md:p-5 lg:p-6 hover:shadow-lg transition-shadow cursor-pointer sm:col-span-2 lg:col-span-1">
            <div className="flex items-center">
              <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-teal-600 flex-shrink-0" />
              <div className="ml-3 md:ml-4 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">Inventory Reports</h3>
                <p className="text-xs md:text-sm text-gray-600 truncate">View detailed analytics</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <Card className="p-4 md:p-5 lg:p-6">
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Recent Activity</h3>
        <div className="space-y-2 md:space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => {
              const IconComponent = activity.icon;
              return (
                <div key={activity.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg gap-2 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center min-w-0 flex-1">
                    <IconComponent className={`h-4 w-4 md:h-5 md:w-5 ${activity.color} flex-shrink-0`} />
                    <span className="ml-2 md:ml-3 text-xs md:text-sm truncate">{activity.title}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">{getTimeAgo(activity.timestamp)}</span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">No recent activity</p>
            </div>
          )}
        </div>
      </Card>
      </div>
    </>
  );
};

export default InventoryDashboard;

