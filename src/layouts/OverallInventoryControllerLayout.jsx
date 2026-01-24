import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  AlertTriangle, 
  Calendar,
  Receipt,
  ClipboardList
} from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const OverallInventoryControllerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.OVERALL_INVENTORY_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Inventory Management' },
    { path: ROUTES.OVERALL_INVENTORY_OVERVIEW, label: 'Inventory Overview', icon: Package },
    { path: ROUTES.OVERALL_INVENTORY_PURCHASE_ORDERS, label: 'Purchase Orders', icon: ShoppingCart },
    { section: 'Sales & Logs' },
    { path: ROUTES.OVERALL_INVENTORY_PRODUCT_SALES, label: 'Product Sales', icon: Receipt },
    { path: ROUTES.OVERALL_INVENTORY_ADJUST_LOGS, label: 'Adjust Logs', icon: ClipboardList },
    { section: 'Monitoring & Alerts' },
    { path: ROUTES.OVERALL_INVENTORY_ALERTS, label: 'Stock Alerts', icon: AlertTriangle },
    { path: ROUTES.OVERALL_INVENTORY_EXPIRY, label: 'Expiry Tracker', icon: Calendar },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} menuItems={menuItems} />
      
      <div className="flex-1 flex flex-col md:ml-64 min-w-0 overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
          <main className="flex-1 p-4 md:p-6 min-w-0 max-w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default OverallInventoryControllerLayout;
















