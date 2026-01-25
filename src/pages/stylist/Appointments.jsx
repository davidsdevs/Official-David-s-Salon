/**
 * Appointments Page - Stylist
 * Mobile-ready view for stylists to view their assigned appointments
 * Status updates are managed by receptionists only
 */

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Mail, AlertCircle, Eye, Scissors, Bell, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByStylist,
  getStylistTodayStats,
  getAppointmentById,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getNotifications, markNotificationAsRead, getUnreadNotificationCount } from '../../services/notificationService';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
import toast from 'react-hot-toast';

const StylistAppointments = () => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('today');
  const [clientSearch, setClientSearch] = useState('');
  const [stats, setStats] = useState({ today: 0, pending: 0, inService: 0, completed: 0 });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize] = useState(20);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchAppointments(false);
      fetchNotifications();
      fetchUnreadCount();
      
      // Refresh notifications every 30 seconds
      const notificationInterval = setInterval(() => {
        fetchNotifications();
        fetchUnreadCount();
      }, 30000);
      
      return () => clearInterval(notificationInterval);
    }
  }, [currentUser]);

  // Recalculate stats when appointments change
  useEffect(() => {
    if (appointments.length > 0) {
      const calculatedStats = {
        today: appointments.length, // Total appointments
        pending: appointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
        inService: appointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length,
        completed: appointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length
      };
      
      setStats(calculatedStats);
    } else {
      // Reset to zero if no appointments
      setStats({ today: 0, pending: 0, inService: 0, completed: 0 });
    }
  }, [appointments]);

  // Refetch when filter changes
  useEffect(() => {
    if (currentUser && appointments.length > 0) {
      // Filter is applied client-side, no need to refetch
    }
  }, [filter]);

  const fetchStats = async () => {
    try {
      const statsData = await getStylistTodayStats(currentUser.uid);
      
      // Also calculate overall stats from all appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate >= today && aptDate < tomorrow;
      });
      
      const overallStats = {
        today: todayAppointments.length,
        pending: appointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
        inService: appointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length,
        completed: todayAppointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length
      };
      
      // Use overall stats if we have appointments loaded, otherwise use API stats
      setStats(appointments.length > 0 ? overallStats : statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      console.log('📱 Fetching notifications for stylist:', currentUser.uid);
      const allNotifications = await getNotifications(currentUser.uid, {
        unreadOnly: false,
        limitCount: 5,
        orderByField: 'createdAt',
        orderDirection: 'desc'
      });
      console.log('📱 Fetched notifications:', allNotifications.length, allNotifications);
      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadNotificationCount(currentUser.uid);
      console.log('📱 Unread notification count:', count);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.isRead) {
        await handleMarkAsRead(notification.id);
      }

      // Handle appointment notifications
      if (notification.appointmentId) {
        setLoadingDetails(true);
        try {
          const appointment = await getAppointmentById(notification.appointmentId);
          setSelectedAppointment(appointment);
          setShowDetailsModal(true);
          setShowNotifications(false);
        } catch (error) {
          console.error('Error fetching appointment details:', error);
          toast.error('Failed to load appointment details');
        } finally {
          setLoadingDetails(false);
        }
      } 
      // Handle check-in notifications (navigate to check-ins page)
      else if (notification.checkInId || notification.type?.includes('check_in') || notification.type?.includes('arrived')) {
        setShowNotifications(false);
        toast.success('Client has arrived! Check the Arrivals page.');
        // Could navigate to check-ins page if route exists
        // window.location.href = '/stylist/check-ins';
      }
      // Other notification types
      else {
        setShowNotifications(false);
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const fetchAppointments = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setAppointments([]);
        setHasMore(true);
      }

      const data = await getAppointmentsByStylist(currentUser.uid);
      
      // For big data, limit initial load and implement pagination
      if (!loadMore) {
        // Initial load - show first page
        const initialData = data.slice(0, pageSize);
        setAppointments(initialData);
        setHasMore(data.length > pageSize);
      } else {
        // Load more - append next page
        const startIndex = appointments.length;
        const nextPage = data.slice(startIndex, startIndex + pageSize);
        setAppointments(prev => [...prev, ...nextPage]);
        setHasMore(startIndex + pageSize < data.length);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const getFilteredAppointments = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let filtered = appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      
      switch (filter) {
        case 'today':
          return aptDate >= today && aptDate < tomorrow;
        case 'pending':
          return apt.status === APPOINTMENT_STATUS.PENDING;
        case 'upcoming':
          return aptDate >= now && apt.status !== APPOINTMENT_STATUS.COMPLETED && apt.status !== APPOINTMENT_STATUS.CANCELLED;
        case 'completed':
          return apt.status === APPOINTMENT_STATUS.COMPLETED;
        default:
          return true;
      }
    });
    
    // Apply client search filter
    if (clientSearch.trim()) {
      const searchLower = clientSearch.toLowerCase();
      filtered = filtered.filter(apt => 
        (apt.clientName || '').toLowerCase().includes(searchLower) ||
        (apt.clientPhone || '').includes(searchLower) ||
        (apt.clientEmail || '').toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  };

  const filteredAppointments = getFilteredAppointments();

  const getStatusColor = (status) => {
    switch (status) {
      case APPOINTMENT_STATUS.PENDING:
      case APPOINTMENT_STATUS.CONFIRMED:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case APPOINTMENT_STATUS.IN_SERVICE:
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case APPOINTMENT_STATUS.COMPLETED:
        return 'bg-green-100 text-green-700 border-green-200';
      case APPOINTMENT_STATUS.CANCELLED:
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleViewDetails = async (appointment) => {
    try {
      setLoadingDetails(true);
      // Fetch full appointment details including history
      const fullAppointment = await getAppointmentById(appointment.id);
      setSelectedAppointment(fullAppointment);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching appointment details:', error);
      // If fetching fails, use the appointment data we already have
      setSelectedAppointment(appointment);
      setShowDetailsModal(true);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header with Notifications */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600 mt-1">Manage your daily schedule</p>
        </div>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Notifications</h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      notification.type?.includes('cancelled') ? 'bg-red-100 text-red-700' :
                      notification.type?.includes('completed') ? 'bg-green-100 text-green-700' :
                      notification.type?.includes('check_in') || notification.type?.includes('arrived') ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {notification.type?.includes('completed') ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : notification.type?.includes('check_in') || notification.type?.includes('arrived') ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Calendar className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm">{notification.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                      {notification.serviceName && (
                        <p className="text-xs text-gray-500 mt-1">
                          Service: {notification.serviceName}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {notification.createdAt ? formatDate(notification.createdAt) : 'Recently'}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t border-gray-200 text-center">
            <a
              href="/stylist/notifications"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View All Notifications
            </a>
          </div>
        </div>
      )}

      {/* Stats Cards - Improved Layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Today</p>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.today || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Total appointments</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats?.pending || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting confirmation</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">In Service</p>
            <Scissors className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-600">{stats?.inService || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Currently serving</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">Completed</p>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-600">{stats?.completed || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Completed</p>
        </div>
      </div>

      {/* Filter Tabs - Organized by Priority */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'today'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>Today</span>
            </div>
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'upcoming'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Upcoming</span>
            </div>
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
              filter === 'pending'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>Pending</span>
              {stats.pending > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  filter === 'pending' 
                    ? 'bg-white text-primary-600' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {stats.pending}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              filter === 'completed'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              <span>Completed</span>
            </div>
          </button>
        </div>
      </div>

      {/* Client Search - Show when viewing pending or all appointments */}
      {(filter === 'pending' || filter === 'upcoming') && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client name, phone, or email..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          {clientSearch && (
            <p className="text-xs text-gray-500 mt-2">
              Showing {filteredAppointments.length} result{filteredAppointments.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Appointments List - Minimal Cards with Gaps */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          My Appointments ({filteredAppointments.length})
        </h2>
        {filteredAppointments.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-lg border border-gray-100">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === 'today'
                ? 'No appointments scheduled for today'
                : filter === 'upcoming'
                ? 'No upcoming appointments'
                : filter === 'completed'
                ? 'No completed appointments'
                : 'No appointments found'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((appointment) => {
              // Get services assigned to this stylist
              const myServices = appointment.services && appointment.services.length > 0
                ? appointment.services.filter(svc => svc.stylistId === currentUser.uid)
                : [];

              return (
                <div 
                  key={appointment.id} 
                  onClick={() => handleViewDetails(appointment)}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-primary-300 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {appointment.clientName || 'Guest Client'}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {myServices.length > 0 ? (
                          <div className="text-sm text-gray-700">
                            {myServices.map((service, index) => (
                              <div key={index} className="text-gray-900 font-medium">
                                {service.serviceName || 'Unknown Service'}
                              </div>
                            ))}
                          </div>
                        ) : appointment.serviceName ? (
                          <div className="text-sm text-gray-900 font-medium">
                            {appointment.serviceName}
                          </div>
                        ) : null}

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(appointment.appointmentDate)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(appointment.appointmentDate)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(appointment);
                      }}
                      disabled={loadingDetails}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      title="View Full Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => fetchAppointments(true)}
                  disabled={loadingMore}
                  className="px-6 py-2 text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
};

export default StylistAppointments;
