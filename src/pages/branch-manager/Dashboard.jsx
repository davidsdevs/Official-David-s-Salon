import { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Banknote, 
  Package, 
  Clock,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  User,
  PackageX,
  ArrowRight,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBranchById } from '../../services/branchService';
import { getAppointmentsByDateRange } from '../../services/appointmentService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { inventoryService } from '../../services/inventoryService';
import { USER_ROLES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatTime12Hour, getFullName } from '../../utils/helpers';
import { Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';

const BranchManagerDashboard = () => {
  const { userBranch, userData } = useAuth();
  const [branch, setBranch] = useState(null);
  const [stats, setStats] = useState({
    staffCount: 0,
    appointmentCount: 0,
    totalProducts: 0,
    monthlyRevenue: 0,
    expiringCount: 0,
    pendingTransfers: 0,
    pendingDeliveries: 0,
    voidedCount: 0,
    voidedAmount: 0
  });
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [voidedServices, setVoidedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Dashboard | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);

  useEffect(() => {
    if (userBranch) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [userBranch]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch branch details
      const branchData = await getBranchById(userBranch);
      setBranch(branchData);
      
      // Fetch all data in parallel
      await Promise.all([
        fetchStaffAndAppointments(),
        fetchInventoryStats(),
        fetchMonthlyRevenue(),
        fetchExpiringItems(),
        fetchRecentActivity(),
        fetchPendingTransfersAndDeliveries(),
        fetchVoidedServices()
      ]);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const fetchStaffAndAppointments = async () => {
    try {
      // Get staff count
      const usersRef = collection(db, 'users');
      const staffQuery = query(usersRef, where('branchId', '==', userBranch));
      const staffSnapshot = await getDocs(staffQuery);
      
      // Fetch today's appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const appointments = await getAppointmentsByDateRange(userBranch, today, tomorrow);
      
      // Filter to only upcoming appointments
      const upcoming = appointments
        .filter(apt => {
          const status = apt.status?.toLowerCase();
          return status !== 'completed' && status !== 'cancelled' && status !== 'no_show';
        })
        .sort((a, b) => {
          const timeA = a.appointmentDate?.getTime() || 0;
          const timeB = b.appointmentDate?.getTime() || 0;
          return timeA - timeB;
        })
        .slice(0, 5);
      
      // Enrich appointments
      const services = await getBranchServices(userBranch);
      const stylists = await getUsersByRole(USER_ROLES.STYLIST);
      const branchStylists = stylists.filter(s => s.branchId === userBranch);
      
      const enrichedAppointments = upcoming.map(apt => {
        const service = services.find(s => s.id === apt.serviceId || s.serviceId === apt.serviceId);
        const stylist = branchStylists.find(s => s.id === apt.stylistId);
        const clientName = apt.clientName || 
          (apt.client?.firstName && apt.client?.lastName 
            ? `${apt.client.firstName} ${apt.client.lastName}` 
            : apt.client?.name || 'Walk-in Client');
        
        return {
          ...apt,
          serviceName: service?.name || service?.serviceName || 'Unknown Service',
          stylistName: stylist ? getFullName(stylist) : 'Unassigned',
          clientName: clientName
        };
      });
      
      setUpcomingAppointments(enrichedAppointments);
      setStats(prev => ({
        ...prev,
        staffCount: staffSnapshot.size,
        appointmentCount: appointments.length
      }));
    } catch (error) {
      console.error('Error fetching staff and appointments:', error);
    }
  };

  const fetchInventoryStats = async () => {
    try {
      // Get stocks for this branch
      const stocksRef = collection(db, 'stocks');
      const stocksQuery = query(
        stocksRef,
        where('branchId', '==', userBranch),
        where('status', '==', 'active')
      );
      const stocksSnapshot = await getDocs(stocksQuery);
      
      let totalProducts = stocksSnapshot.size;
      
      // Get expiring batches (within 30 days)
      const expiringResult = await inventoryService.getExpiringBatches(userBranch, 30);
      const expiringCount = expiringResult.success ? expiringResult.batches.length : 0;
      
      setStats(prev => ({
        ...prev,
        totalProducts,
        expiringCount
      }));
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
    }
  };

  const fetchMonthlyRevenue = async () => {
    try {
      // Get first day of current month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const transactionsRef = collection(db, 'transactions');
      const transactionsQuery = query(
        transactionsRef,
        where('branchId', '==', userBranch),
        where('createdAt', '>=', firstDayOfMonth)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      let monthlyRevenue = 0;
      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        const status = (transaction.status || '').toLowerCase();
        // Only count completed/paid transactions, exclude voided/cancelled/refunded
        if (status !== 'voided' && status !== 'cancelled' && status !== 'refunded') {
          monthlyRevenue += Number(transaction.total || transaction.totalAmount || 0);
        }
      });
      
      setStats(prev => ({
        ...prev,
        monthlyRevenue
      }));
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
    }
  };

  const fetchExpiringItems = async () => {
    try {
      const expiringResult = await inventoryService.getExpiringBatches(userBranch, 30);
      if (expiringResult.success) {
        // Sort by expiration date (soonest first) and limit to 5
        const sorted = expiringResult.batches
          .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
          .slice(0, 5);
        setExpiringItems(sorted);
      }
    } catch (error) {
      console.error('Error fetching expiring items:', error);
    }
  };

  const fetchPendingTransfersAndDeliveries = async () => {
    try {
      // Pending transfers (incoming to this branch)
      const transfersRef = collection(db, 'stock_transfer');
      const transfersQuery = query(
        transfersRef,
        where('toBranchId', '==', userBranch),
        where('status', 'in', ['Pending', 'In Transit'])
      );
      const transfersSnapshot = await getDocs(transfersQuery);
      
      // Pending deliveries
      const deliveriesRef = collection(db, 'deliveries');
      const deliveriesQuery = query(
        deliveriesRef,
        where('branchId', '==', userBranch),
        where('status', 'in', ['pending', 'in_transit', 'Pending', 'In Transit'])
      );
      const deliveriesSnapshot = await getDocs(deliveriesQuery);
      
      setStats(prev => ({
        ...prev,
        pendingTransfers: transfersSnapshot.size,
        pendingDeliveries: deliveriesSnapshot.size
      }));
    } catch (error) {
      console.error('Error fetching pending transfers/deliveries:', error);
    }
  };

  const fetchVoidedServices = async () => {
    try {
      // Get voided arrivals for this month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const arrivalsRef = collection(db, 'arrivals');
      const voidedQuery = query(
        arrivalsRef,
        where('branchId', '==', userBranch),
        where('status', '==', 'voided'),
        orderBy('voidedAt', 'desc'),
        limit(10)
      );
      
      const voidedSnapshot = await getDocs(voidedQuery);
      
      let voidedCount = 0;
      let voidedAmount = 0;
      const voidedList = [];
      
      voidedSnapshot.forEach(doc => {
        const data = doc.data();
        voidedCount++;
        
        // Calculate estimated amount from services
        let serviceTotal = 0;
        if (data.services && data.services.length > 0) {
          serviceTotal = data.services.reduce((sum, svc) => sum + (svc.price || 0), 0);
        } else if (data.servicePrice) {
          serviceTotal = data.servicePrice;
        }
        voidedAmount += serviceTotal;
        
        voidedList.push({
          id: doc.id,
          clientName: data.clientName || 'Unknown',
          voidedAt: data.voidedAt?.toDate?.() || new Date(),
          voidedByName: data.voidedByName || 'Staff',
          voidReason: data.voidReason || 'No reason provided',
          estimatedAmount: serviceTotal,
          services: data.services || []
        });
      });
      
      setVoidedServices(voidedList);
      setStats(prev => ({
        ...prev,
        voidedCount,
        voidedAmount
      }));
    } catch (error) {
      console.error('Error fetching voided services:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const activities = [];
      
      // Recent stock movements
      const movementsRef = collection(db, 'inventory_movements');
      const movementsQuery = query(
        movementsRef,
        where('branchId', '==', userBranch),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      try {
        const movementsSnapshot = await getDocs(movementsQuery);
        movementsSnapshot.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            type: 'movement',
            title: data.movementType === 'in' ? 'Stock Added' : 'Stock Deducted',
            description: `${data.productName || 'Product'} - ${data.quantity} units`,
            timestamp: data.createdAt?.toDate?.() || new Date(),
            icon: data.movementType === 'in' ? 'plus' : 'minus'
          });
        });
      } catch (e) {
        // Collection might not exist
      }
      
      // Recent deliveries received
      const deliveriesRef = collection(db, 'deliveries');
      const deliveriesQuery = query(
        deliveriesRef,
        where('branchId', '==', userBranch),
        where('status', '==', 'received'),
        limit(3)
      );
      
      try {
        const deliveriesSnapshot = await getDocs(deliveriesQuery);
        deliveriesSnapshot.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            type: 'delivery',
            title: 'Delivery Received',
            description: `PO: ${data.purchaseOrderId || 'N/A'}`,
            timestamp: data.receivedAt?.toDate?.() || data.updatedAt?.toDate?.() || new Date(),
            icon: 'package'
          });
        });
      } catch (e) {
        // Collection might not exist
      }
      
      // Sort by timestamp and limit
      activities.sort((a, b) => b.timestamp - a.timestamp);
      setRecentActivity(activities.slice(0, 5));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const getTimeAgo = (date) => {
    if (!date) return 'N/A';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, 'MMM dd');
  };

  const getDaysUntilExpiry = (expirationDate) => {
    if (!expirationDate) return null;
    const expDate = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
    const now = new Date();
    const diffTime = expDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!userBranch || !branch) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-1">No Branch Assigned</h3>
            <p className="text-yellow-700">
              You are not currently assigned to any branch. Please contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getTodaySchedule = () => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const schedule = branch.operatingHours?.[today];
    
    if (!schedule || !schedule.isOpen) {
      return 'Closed';
    }
    
    return `${formatTime12Hour(schedule.open)} - ${formatTime12Hour(schedule.close)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening at your branch today.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Branch Info Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">{branch.name || branch.branchName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{branch.address || 'No address'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{branch.contact || 'No contact'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{branch.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Today: {getTodaySchedule()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              branch.isActive === true 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {branch.isActive === true ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-500 p-2 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-600 text-xs font-medium">Total Staff</p>
          <p className="text-2xl font-bold text-gray-900">{stats.staffCount}</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-500 p-2 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-600 text-xs font-medium">Today's Appointments</p>
          <p className="text-2xl font-bold text-gray-900">{stats.appointmentCount}</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-500 p-2 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-600 text-xs font-medium">Inventory Items</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <Banknote className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-600 text-xs font-medium">Monthly Revenue</p>
          <p className="text-xl font-bold text-gray-900">₱{stats.monthlyRevenue.toLocaleString()}</p>
        </div>

        {/* Voided Services Card */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={`${stats.voidedCount > 0 ? 'bg-red-500' : 'bg-gray-400'} p-2 rounded-lg`}>
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-600 text-xs font-medium">Voided Services</p>
          <p className={`text-2xl font-bold ${stats.voidedCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.voidedCount}
          </p>
          {stats.voidedAmount > 0 && (
            <p className="text-xs text-red-500 mt-1">
              Est. ₱{stats.voidedAmount.toLocaleString()} lost
            </p>
          )}
        </div>
      </div>

      {/* Alert Cards */}
      {(stats.expiringCount > 0 || stats.pendingTransfers > 0 || stats.pendingDeliveries > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.expiringCount > 0 && (
            <Link to="/manager/inventory/expiry" className="bg-red-50 border border-red-200 rounded-lg p-4 hover:bg-red-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-lg">
                  <PackageX className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-red-800 font-semibold">{stats.expiringCount}</p>
                  <p className="text-red-600 text-xs">Expiring Soon</p>
                </div>
              </div>
            </Link>
          )}

          {stats.pendingTransfers > 0 && (
            <Link to="/manager/inventory/transfers" className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <ArrowRight className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-blue-800 font-semibold">{stats.pendingTransfers}</p>
                  <p className="text-blue-600 text-xs">Incoming Transfers</p>
                </div>
              </div>
            </Link>
          )}

          {stats.pendingDeliveries > 0 && (
            <Link to="/manager/inventory/deliveries" className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 hover:bg-indigo-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-indigo-800 font-semibold">{stats.pendingDeliveries}</p>
                  <p className="text-indigo-600 text-xs">Pending Deliveries</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Today's Appointments</h3>
            <Link 
              to="/manager/appointments" 
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No upcoming appointments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => {
                let appointmentTime = 'TBD';
                if (apt.appointmentDate) {
                  const date = apt.appointmentDate instanceof Date 
                    ? apt.appointmentDate 
                    : apt.appointmentDate.toDate();
                  const hours = date.getHours().toString().padStart(2, '0');
                  const minutes = date.getMinutes().toString().padStart(2, '0');
                  appointmentTime = formatTime12Hour(`${hours}:${minutes}`);
                }
                const status = apt.status?.toLowerCase() || 'pending';
                const statusColors = {
                  confirmed: 'bg-blue-100 text-blue-700',
                  pending: 'bg-yellow-100 text-yellow-700',
                  in_service: 'bg-purple-100 text-purple-700'
                };
                
                return (
                  <div key={apt.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{apt.clientName}</p>
                      <p className="text-xs text-gray-500">{appointmentTime} • {apt.serviceName}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
                      {status === 'in_service' ? 'In Service' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Expiring Soon</h3>
            <Link 
              to="/manager/inventory/expiry" 
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          
          {expiringItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No items expiring soon</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringItems.map((item) => {
                const daysLeft = getDaysUntilExpiry(item.expirationDate);
                const isUrgent = daysLeft !== null && daysLeft <= 7;
                
                return (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${isUrgent ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">Batch: {item.batchNumber || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
                        {daysLeft !== null ? `${daysLeft} days` : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.expirationDate ? format(new Date(item.expirationDate), 'MMM dd') : 'N/A'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Voided Services */}
        {stats.voidedCount > 0 && (
          <div className="bg-white rounded-lg shadow border border-red-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900">Recent Voided Services</h3>
              </div>
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                {stats.voidedCount} this month
              </span>
            </div>
            
            <div className="space-y-3">
              {voidedServices.slice(0, 5).map((voided) => (
                <div key={voided.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{voided.clientName}</p>
                      <span className="text-xs text-red-600 font-medium">
                        Est. ₱{voided.estimatedAmount.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Voided by {voided.voidedByName} • {format(voided.voidedAt, 'MMM dd, h:mm a')}
                    </p>
                    <p className="text-xs text-red-600 mt-1 italic">
                      Reason: {voided.voidReason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {stats.voidedAmount > 0 && (
              <div className="mt-4 pt-4 border-t border-red-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Estimated Loss</span>
                  <span className="text-lg font-bold text-red-600">
                    ₱{stats.voidedAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/manager/staff" className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Manage Staff</p>
              </div>
            </Link>
            
            <Link to="/manager/appointments" className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              <Calendar className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Appointments</p>
              </div>
            </Link>
            
            <Link to="/manager/inventory/stocks" className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
              <Package className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Inventory</p>
              </div>
            </Link>
            
            <Link to="/manager/inventory/transfers" className="flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
              <ArrowRight className="w-5 h-5 text-orange-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Transfers</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchManagerDashboard;
