import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Receipt, CheckCircle, Clock, Scissors, Package, BarChart3, Bell, BellOff } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  notifyNewAppointment, 
  requestNotificationPermission, 
  getNotificationStatus,
  preloadNotificationSound,
  playNotificationSound
} from '../services/notificationSoundService';
// Import expoPushService to register debug functions on window
import '../services/expoPushService';
import toast from 'react-hot-toast';

const ReceptionistLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { userBranch } = useAuth();
  
  // Use ref for notification state so listener doesn't need to restart
  const notificationsEnabledRef = useRef(false);
  const knownAppointmentIds = useRef(new Set());

  // Keep ref in sync with state
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  // Initialize notifications on mount
  useEffect(() => {
    const initNotifications = async () => {
      const status = getNotificationStatus();
      if (status.supported && status.permission === 'granted') {
        setNotificationsEnabled(true);
        preloadNotificationSound();
      }
    };
    initNotifications();
  }, []);

  // Handle enabling notifications (requires user interaction)
  const handleEnableNotifications = async () => {
    preloadNotificationSound();
    
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      await playNotificationSound();
      toast.success('Notifications enabled! You\'ll hear this sound for new appointments.');
    } else {
      toast.error('Please allow notifications in your browser settings.');
    }
  };

  // Subscribe to appointments - only depends on userBranch
  useEffect(() => {
    if (!userBranch) return;

    console.log('🎧 Setting up appointment listener for branch:', userBranch);

    const appointmentsRef = collection(db, 'appointments');
    
    // Listen to ALL pending appointments for this branch (no date filter)
    const q = query(
      appointmentsRef,
      where('branchId', '==', userBranch),
      where('status', '==', 'pending')
    );

    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('📡 Snapshot received:', snapshot.size, 'pending appointments');
      
      // Update pending count
      setPendingCount(snapshot.size);
      
      // Check for new appointments
      snapshot.docChanges().forEach((change) => {
        console.log('📝 Change type:', change.type, 'Doc ID:', change.doc.id);
        
        if (change.type === 'added') {
          const appointmentId = change.doc.id;
          const isNew = !knownAppointmentIds.current.has(appointmentId);
          
          console.log('➕ Added appointment:', appointmentId, 'isNew:', isNew, 'isFirstSnapshot:', isFirstSnapshot, 'notificationsEnabled:', notificationsEnabledRef.current);
          
          // Notify if: not first snapshot, notifications enabled, and truly new
          if (!isFirstSnapshot && notificationsEnabledRef.current && isNew) {
            const appointmentData = {
              id: appointmentId,
              ...change.doc.data(),
              appointmentDate: change.doc.data().appointmentDate?.toDate?.() || change.doc.data().appointmentDate
            };
            
            console.log('🔔 TRIGGERING NOTIFICATION for:', appointmentData.clientName || 'Guest');
            notifyNewAppointment(appointmentData);
          }
        }
      });
      
      // Update known IDs
      knownAppointmentIds.current = new Set(snapshot.docs.map(doc => doc.id));
      isFirstSnapshot = false;
      
    }, (error) => {
      console.error('❌ Error listening to appointments:', error);
    });

    return () => {
      console.log('🔌 Unsubscribing from appointment listener');
      unsubscribe();
    };
  }, [userBranch]); // Only re-subscribe when branch changes

  const menuItems = [
    { path: ROUTES.RECEPTIONIST_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    
    { section: 'Appointments & Clients' },
    { path: ROUTES.RECEPTIONIST_APPOINTMENTS, label: 'Appointments', icon: Calendar, badge: pendingCount > 0 ? pendingCount : null },
    { path: ROUTES.RECEPTIONIST_ARRIVALS, label: 'Arrivals & Check-ins', icon: CheckCircle },
    { path: ROUTES.RECEPTIONIST_CLIENTS, label: 'Clients', icon: Users },
    
    { section: 'Transactions' },
    { path: ROUTES.RECEPTIONIST_BILLING, label: 'Billing', icon: Receipt },
    { path: ROUTES.RECEPTIONIST_SALES_REPORT, label: 'Sales Report', icon: BarChart3 },
    
    { section: 'Resources' },
    { path: ROUTES.RECEPTIONIST_STAFF_SCHEDULE, label: 'Staff Schedule', icon: Clock },
    { path: ROUTES.RECEPTIONIST_SERVICES, label: 'Services', icon: Scissors },
    { path: ROUTES.RECEPTIONIST_PRODUCTS, label: 'Products', icon: Package },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} menuItems={menuItems} />
      
      <div className="flex-1 flex flex-col md:ml-64 min-w-0 overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen}>
          {/* Notification Toggle Button */}
          <button
            onClick={handleEnableNotifications}
            className={`p-2 rounded-lg transition-colors ${
              notificationsEnabled 
                ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title={notificationsEnabled ? 'Notifications enabled' : 'Click to enable notifications'}
          >
            {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </button>
        </Header>
        
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
          <main className="flex-1 p-4 md:p-6 min-w-0 max-w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistLayout;
