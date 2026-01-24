import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  QrCode, 
  ShoppingCart, 
  PackageCheck, 
  Truck, 
  AlertTriangle, 
  Calendar
} from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const InventoryLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.INVENTORY_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Inventory Management' },
    { path: ROUTES.INVENTORY_PRODUCTS, label: 'Products', icon: Package },
    { path: ROUTES.INVENTORY_STOCKS, label: 'Stocks', icon: TrendingUp },
    { path: ROUTES.INVENTORY_UPC_GENERATOR, label: 'UPC Generator', icon: QrCode },
    { section: 'Purchasing' },
    { path: ROUTES.INVENTORY_PURCHASE_ORDERS, label: 'Purchase Orders', icon: ShoppingCart },
    { path: ROUTES.INVENTORY_DELIVERIES, label: 'Deliveries', icon: PackageCheck },
    { path: ROUTES.INVENTORY_SUPPLIERS, label: 'Suppliers', icon: Truck },
    { section: 'Monitoring' },
    { path: ROUTES.INVENTORY_STOCK_ALERTS, label: 'Stock Alerts', icon: AlertTriangle },
    { path: ROUTES.INVENTORY_EXPIRY_TRACKER, label: 'Expiry Tracker', icon: Calendar },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} menuItems={menuItems} />
      
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0 overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
          <main className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0 max-w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default InventoryLayout;

