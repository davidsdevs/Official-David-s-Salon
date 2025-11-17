import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, BarChart3, Building2, Scissors, Receipt, Package, ShoppingCart, Megaphone, FileText, TrendingUp, Wallet } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const BranchManagerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.MANAGER_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Management' },
    { path: ROUTES.MANAGER_STAFF, label: 'Staff', icon: Users },
    { path: '/manager/services', label: 'Services', icon: Scissors },
    { path: '/manager/calendar', label: 'Calendar & Holidays', icon: Calendar },
    { path: '/manager/branch-settings', label: 'Branch Settings', icon: Building2 },
    { path: ROUTES.MANAGER_APPOINTMENTS, label: 'Appointments', icon: Calendar },
    { path: '/manager/billing', label: 'Billing', icon: Receipt },
    { section: 'Operations' },
    { path: '/manager/inventory', label: 'Inventory', icon: Package },
    { path: '/manager/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { path: '/manager/deposits', label: 'Bank Deposits', icon: Wallet },
    { path: '/manager/promotions', label: 'Promotions', icon: Megaphone },
    { path: '/manager/stylist-portfolios', label: 'Stylist Portfolios', icon: FileText },
    { section: 'Analytics' },
    { path: '/manager/client-analytics', label: 'Client Analytics', icon: TrendingUp },
    { path: ROUTES.MANAGER_REPORTS, label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} menuItems={menuItems} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-y-auto">
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default BranchManagerLayout;
