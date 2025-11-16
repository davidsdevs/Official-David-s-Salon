/**
 * Appointments Overview Page - Branch Manager
 * For monitoring and analyzing branch appointments
 */

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, Clock, CheckCircle, XCircle, AlertCircle, BarChart3, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByBranch,
  getAppointmentStats,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import { exportAppointmentsToCSV, exportAnalyticsToCSV } from '../../utils/exportHelpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentCard from '../../components/appointment/AppointmentCard';
import toast from 'react-hot-toast';

const BranchManagerAppointments = () => {
  const { userBranch, userBranchData } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [stats, setStats] = useState(null);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);

  useEffect(() => {
    if (userBranch) {
      fetchData();
    }
  }, [userBranch, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch appointments
      const appointmentsData = await getAppointmentsByBranch(userBranch);
      
      // Fetch services and stylists for enrichment
      const servicesData = await getBranchServices(userBranch);
      
      const stylistsData = await getUsersByRole(USER_ROLES.STYLIST);
      const branchStylists = stylistsData.filter(s => s.branchId === userBranch);
      
      setServices(servicesData);
      setStylists(branchStylists);
      
      // Enrich appointments
      const enrichedAppointments = appointmentsData.map(apt => {
        // Handle multi-service appointments
        if (apt.services && apt.services.length > 0) {
          const enrichedServices = apt.services.map(svc => {
            const serviceData = servicesData.find(s => s.id === svc.serviceId);
            const stylist = branchStylists.find(st => st.id === svc.stylistId);
            return {
              ...svc,
              serviceName: svc.serviceName || serviceData?.name || 'Unknown Service',
              isChemical: serviceData?.isChemical || false,
              stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Unassigned'
            };
          });
          
          return {
            ...apt,
            services: enrichedServices,
            branchName: userBranchData?.name || userBranchData?.branchName || ''
          };
        }
        
        // Handle single service appointments (backward compatibility)
        const service = servicesData.find(s => s.id === apt.serviceId);
        const stylist = branchStylists.find(s => s.id === apt.stylistId);
        return {
          ...apt,
          serviceName: service?.name || 'Unknown Service',
          isChemical: service?.isChemical || false,
          stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Unassigned',
          branchName: userBranchData?.name || userBranchData?.branchName || ''
        };
      });
      
      // Filter by date range
      const filtered = filterByDateRange(enrichedAppointments, dateRange);
      setAppointments(filtered);
      
      // Calculate stats
      const startDate = getStartDate(dateRange);
      const endDate = new Date();
      const statsData = await getAppointmentStats(userBranch, startDate, endDate);
      setStats(statsData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch appointments data');
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (range) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (range) {
      case 'today':
        return today;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo;
      default:
        return today;
    }
  };

  const filterByDateRange = (appointments, range) => {
    const startDate = getStartDate(range);
    const endDate = new Date();
    
    return appointments.filter(apt => {
      // Handle Firestore Timestamp
      const aptDate = apt.appointmentDate?.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
      return aptDate >= startDate && aptDate <= endDate;
    }).sort((a, b) => {
      const dateA = a.appointmentDate?.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate);
      const dateB = b.appointmentDate?.toDate ? b.appointmentDate.toDate() : new Date(b.appointmentDate);
      return dateB - dateA;
    });
  };

  // Calculate analytics
  const calculateAnalytics = () => {
    if (!appointments.length) return null;

    // Service popularity
    const serviceCount = {};
    appointments.forEach(apt => {
      if (apt.services && apt.services.length > 0) {
        // Multi-service appointment
        apt.services.forEach(svc => {
          const serviceName = svc.serviceName || 'Unknown Service';
          serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
        });
      } else {
        // Single service appointment
        const serviceName = apt.serviceName || 'Unknown Service';
        serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
      }
    });
    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Stylist performance
    const stylistCount = {};
    appointments.forEach(apt => {
      if (apt.services && apt.services.length > 0) {
        // Multi-service appointment
        apt.services.forEach(svc => {
          if (svc.stylistId && svc.stylistName) {
            stylistCount[svc.stylistName] = (stylistCount[svc.stylistName] || 0) + 1;
          }
        });
      } else {
        // Single service appointment
        if (apt.stylistId && apt.stylistName) {
          stylistCount[apt.stylistName] = (stylistCount[apt.stylistName] || 0) + 1;
        }
      }
    });
    const topStylists = Object.entries(stylistCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Hourly distribution
    const hourlyCount = {};
    appointments.forEach(apt => {
      const aptDate = apt.appointmentDate?.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
      const hour = aptDate.getHours();
      hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
    });
    const peakHours = Object.entries(hourlyCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => {
        const h = parseInt(hour);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${displayHour}:00 ${period}`;
      });

    // Completion rate
    const completed = appointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length;
    const completionRate = appointments.length > 0 ? ((completed / appointments.length) * 100).toFixed(1) : 0;

    // Cancellation rate
    const cancelled = appointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length;
    const cancellationRate = appointments.length > 0 ? ((cancelled / appointments.length) * 100).toFixed(1) : 0;

    return {
      topServices,
      topStylists,
      peakHours,
      completionRate,
      cancellationRate
    };
  };

  const analytics = calculateAnalytics();

  const handleExportAppointments = () => {
    try {
      const filename = `appointments_${userBranchData?.name || userBranchData?.branchName || 'branch'}_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
      exportAppointmentsToCSV(appointments, filename);
      toast.success('Appointments exported successfully');
    } catch (error) {
      console.error('Error exporting appointments:', error);
      toast.error('Failed to export appointments');
    }
  };

  const handleExportAnalytics = () => {
    try {
      const filename = `analytics_${userBranchData?.name || userBranchData?.branchName || 'branch'}_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
      exportAnalyticsToCSV(analytics, dateRange, filename);
      toast.success('Analytics exported successfully');
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast.error('Failed to export analytics');
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments Overview</h1>
          <p className="text-gray-600">Monitor and analyze branch appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportAppointments}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Appointments
          </button>
          <button
            onClick={handleExportAnalytics}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Analytics
          </button>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Appointments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats.cancelled}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Services */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Top Services</h2>
            </div>
            <div className="space-y-3">
              {analytics.topServices.length > 0 ? (
                analytics.topServices.map(([service, count], index) => (
                  <div key={service} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700">{service}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{count} bookings</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>

          {/* Top Stylists */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Top Stylists</h2>
            </div>
            <div className="space-y-3">
              {analytics.topStylists.length > 0 ? (
                analytics.topStylists.map(([stylist, count], index) => (
                  <div key={stylist} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700">{stylist}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{count} appointments</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Completion Rate</span>
                  <span className="text-sm font-semibold text-green-600">{analytics.completionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${analytics.completionRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Cancellation Rate</span>
                  <span className="text-sm font-semibold text-red-600">{analytics.cancellationRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full transition-all"
                    style={{ width: `${analytics.cancellationRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Peak Hours */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Peak Hours</h2>
            </div>
            <div className="space-y-3">
              {analytics.peakHours.length > 0 ? (
                analytics.peakHours.map((hour, index) => (
                  <div key={hour} className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-700">{hour}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Appointments */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Appointments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appointments.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No appointments found for this period</p>
            </div>
          ) : (
            appointments.slice(0, 6).map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                showActions={false}
              />
            ))
          )}
        </div>
        {appointments.length > 6 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Showing 6 of {appointments.length} appointments
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchManagerAppointments;
