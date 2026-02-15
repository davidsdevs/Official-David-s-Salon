import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, ShoppingBag, Gift, User, Receipt, Tag, Bell } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { getUnreadNotificationCount } from '../services/notificationService';

const ClientLayout = () => {
  const { currentUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const bottomItems = [
    { 
      path: '/client/notifications', 
      label: 'Notifications', 
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined
    },
  ];

  useEffect(() => {
    if (currentUser?.uid) {
      fetchUnreadCount();
      // Refresh unread count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchUnreadCount = async () => {
    try {
      if (currentUser?.uid) {
        const count = await getUnreadNotificationCount(currentUser.uid);
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        toggleSidebar={() => setSidebarOpen(false)} 
        menuItems={menuItems}
        bottomItems={bottomItems}
      />
      
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
