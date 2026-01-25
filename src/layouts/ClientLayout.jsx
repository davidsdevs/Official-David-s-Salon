import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, ShoppingBag, Gift, User, Receipt, Tag } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const ClientLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.CLIENT_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    
    { section: 'Bookings' },
    { path: '/client/appointments', label: 'Appointments', icon: Calendar },
    
    { section: 'Shop' },
    { path: '/client/products', label: 'Products', icon: ShoppingBag },
    { path: '/client/promotions', label: 'Promotions', icon: Tag },
    
    { section: 'Account' },
    { path: ROUTES.CLIENT_TRANSACTIONS, label: 'Transactions', icon: Receipt },
    { path: '/client/rewards', label: 'Rewards', icon: Gift },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} menuItems={menuItems} />
      
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0 overflow-hidden">
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

export default ClientLayout;
