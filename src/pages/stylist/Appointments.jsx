/**
 * Appointments Page - Stylist
 * Mobile-ready view for stylists to view their assigned appointments
 * Status updates are managed by receptionists only
 */

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByStylist,
  getStylistTodayStats,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const StylistAppointments = () => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchAppointments();
      fetchStats();
    }
  }, [currentUser]);

  const fetchStats = async () => {
    try {
      const statsData = await getStylistTodayStats(currentUser.uid);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointmentsByStylist(currentUser.uid);
      setAppointments(data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAppointments = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      
      switch (filter) {
        case 'today':
          return aptDate >= today && aptDate < tomorrow;
        case 'upcoming':
          return aptDate >= now && apt.status !== APPOINTMENT_STATUS.COMPLETED && apt.status !== APPOINTMENT_STATUS.CANCELLED;
        case 'completed':
          return apt.status === APPOINTMENT_STATUS.COMPLETED;
        default:
          return true;
      }
    }).sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
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

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
        <p className="text-gray-600">Manage your daily schedule</p>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Today</p>
          <p className="text-2xl font-bold text-gray-900">{stats.today}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">In Service</p>
          <p className="text-2xl font-bold text-purple-600">{stats.inService}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
      </div>

      {/* Filter Tabs - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('today')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'today'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'upcoming'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Appointments List - Mobile Optimized */}
      <div className="space-y-3">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No appointments found</p>
          </div>
        ) : (
          filteredAppointments.map((appointment) => (
            <div key={appointment.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {appointment.clientName || 'Guest Client'}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
                    {getStatusLabel(appointment.status)}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>{formatDate(appointment.appointmentDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>{formatTime(appointment.appointmentDate)} ({appointment.duration || 60} mins)</span>
                </div>
                {/* Service(s) */}
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    {appointment.services && appointment.services.length > 0 ? (
                      <div className="space-y-1">
                        {appointment.services
                          .filter(svc => svc.stylistId === currentUser.uid) // Only show services assigned to this stylist
                          .map((service, idx) => (
                            <div key={idx} className="flex items-center gap-2 flex-wrap">
                              <span>{service.serviceName || 'Service'}</span>
                              {service.isChemical && (
                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                                  CHEMICAL
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span>{appointment.serviceName || 'Service'}</span>
                    )}
                  </div>
                </div>
                {appointment.clientPhone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <a href={`tel:${appointment.clientPhone}`} className="text-primary-600 hover:underline">
                      {appointment.clientPhone}
                    </a>
                  </div>
                )}
                {appointment.clientEmail && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <a href={`mailto:${appointment.clientEmail}`} className="text-primary-600 hover:underline truncate">
                      {appointment.clientEmail}
                    </a>
                  </div>
                )}
              </div>

              {/* Notes */}
              {appointment.notes && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Notes:</p>
                  <p className="text-sm text-gray-700">{appointment.notes}</p>
                </div>
              )}

              {/* Info Banner - Stylists can only view */}
              {appointment.status !== APPOINTMENT_STATUS.COMPLETED && appointment.status !== APPOINTMENT_STATUS.CANCELLED && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Please inform the receptionist to update appointment status</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StylistAppointments;
