import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, Settings, Activity, Clipboard, Package, FileText, Image, Megaphone, Truck } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const SystemAdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.ADMIN_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Management' },
    { path: ROUTES.ADMIN_USERS, label: 'Users', icon: Users },
    { path: ROUTES.ADMIN_BRANCHES, label: 'Branches', icon: Building2 },
    { path: '/admin/service-templates', label: 'Service Catalog', icon: Clipboard },
    { path: '/admin/master-products', label: 'Master Products', icon: Package },
    { path: '/admin/suppliers', label: 'Suppliers', icon: Truck },
    { section: 'Content' },
    { path: '/admin/content-management', label: 'Content Management', icon: FileText },
    { path: '/admin/homepage-content', label: 'Homepage Content', icon: Image },
    { path: '/admin/promotions', label: 'Promotions', icon: Megaphone },
    { section: 'System' },
    { path: '/admin/activity-logs', label: 'Activity Logs', icon: Activity },
    { path: ROUTES.ADMIN_SETTINGS, label: 'Settings', icon: Settings },
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

export default SystemAdminLayout;
