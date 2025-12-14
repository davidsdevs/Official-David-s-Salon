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

export default SystemAdminLayout;
