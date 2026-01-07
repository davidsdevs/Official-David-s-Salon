/**
 * Appointments Page - Client
 * Self-service booking, rescheduling, and cancellation
 */

import { useState, useEffect, useCallback } from 'react';
  import { Plus, Calendar, Clock, MapPin, User, ChevronDown, ChevronUp, Search, Filter, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByClient,
  createAppointment,
  cancelAppointment,
  updateAppointment,
  getAvailableTimeSlots,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getAllBranches, getBranchById } from '../../services/branchService';
import { getBranchServices, getServiceById } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentCard from '../../components/appointment/AppointmentCard';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ClientBookingModal from '../../components/appointment/ClientBookingModal';
import RescheduleModal from '../../components/appointment/RescheduleModal';
import toast from 'react-hot-toast';

const ClientAppointments = () => {
  const { currentUser, userData } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalCounts, setTotalCounts] = useState({ all: 0, pending: 0, confirmed: 0, cancelled: 0, past: 0 });
  
  // Filtering and search state
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'confirmed', 'cancelled', 'past'
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [appointmentToReschedule, setAppointmentToReschedule] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  
  // Booking form state
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  const [booking, setBooking] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailAppointment, setSelectedDetailAppointment] = useState(null);
  
  const [bookingData, setBookingData] = useState({
    branchId: '',
    services: [], // Array of { serviceId, stylistId }
    date: '',
    timeSlot: null,
    notes: ''
  });

  const loadTabCounts = useCallback(async () => {
    try {
      const [allResult, pendingResult, confirmedResult, cancelledResult] = await Promise.all([
        getAppointmentsByClient(currentUser.uid, { limit: 1 }),
        getAppointmentsByClient(currentUser.uid, { status: APPOINTMENT_STATUS.PENDING, limit: 1 }),
        getAppointmentsByClient(currentUser.uid, { status: APPOINTMENT_STATUS.CONFIRMED, limit: 1 }),
        getAppointmentsByClient(currentUser.uid, { status: APPOINTMENT_STATUS.CANCELLED, limit: 1 })
      ]);

      setTotalCounts({
        all: allResult.totalCount,
        pending: pendingResult.totalCount,
        confirmed: confirmedResult.totalCount,
        cancelled: cancelledResult.totalCount,
        past: 0 // Will be calculated when needed
      });
    } catch (error) {
      console.error('Error loading tab counts:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadTabCounts();
      fetchAppointments();
      fetchBranches();
      setCurrentPage(1); // Reset to first page when component mounts
    }
  }, [currentUser, loadTabCounts]);

  useEffect(() => {
    if (currentUser) {
      fetchAppointments();
      setCurrentPage(1); // Reset to first page when tab/filters change
    }
  }, [currentUser, activeTab, searchTerm, dateRange]);

  useEffect(() => {
    if (bookingData.branchId) {
      fetchBranchServices(bookingData.branchId);
      fetchBranchStylists(bookingData.branchId);
    }
  }, [bookingData.branchId]);

  useEffect(() => {
    // Fetch slots when date is selected and at least one service is selected
    if (bookingData.date && bookingData.services && bookingData.services.length > 0 && bookingData.branchId) {
      fetchAvailableSlots();
    }
  }, [bookingData.date, bookingData.services, bookingData.branchId]);

  const fetchAppointments = useCallback(async (loadMore = false, specificTab = null) => {
    try {
      const tab = specificTab || activeTab;
      
      if (!loadMore) {
        setLoading(true);
        setAppointments([]);
        setLastDoc(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const options = {
        limit: 20,
        searchTerm: searchTerm || undefined
      };

      // Set status filter based on active tab
      if (tab === 'pending') {
        options.status = APPOINTMENT_STATUS.PENDING;
      } else if (tab === 'confirmed') {
        options.status = APPOINTMENT_STATUS.CONFIRMED;
      } else if (tab === 'past') {
        // For past, we'll filter client-side since Firestore doesn't support complex date queries easily
        options.status = null; // Load all, filter client-side
      }

      // Add date range if specified
      if (dateRange.from) {
        options.dateFrom = new Date(dateRange.from);
      }
      if (dateRange.to) {
        options.dateTo = new Date(dateRange.to);
      }

      if (loadMore && lastDoc) {
        options.startAfter = lastDoc;
      }

      const result = await getAppointmentsByClient(currentUser.uid, options);
      
      if (loadMore) {
        // Filter past appointments client-side for the 'past' tab
        let newAppointments = result.appointments;
        if (tab === 'past') {
          const now = new Date();
          newAppointments = result.appointments.filter(apt => 
            new Date(apt.appointmentDate) < now ||
            apt.status === APPOINTMENT_STATUS.COMPLETED ||
            apt.status === APPOINTMENT_STATUS.CANCELLED
          );
        }
        
        setAppointments(prev => [...prev, ...newAppointments]);
      } else {
        // Filter past appointments client-side for the 'past' tab
        let filteredAppointments = result.appointments;
        if (tab === 'past') {
          const now = new Date();
          filteredAppointments = result.appointments.filter(apt => 
            new Date(apt.appointmentDate) < now ||
            apt.status === APPOINTMENT_STATUS.COMPLETED ||
            apt.status === APPOINTMENT_STATUS.CANCELLED
          );
        }
        
        setAppointments(filteredAppointments);
        setTotalCounts(prev => ({ ...prev, [tab]: result.totalCount }));
      }
      
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser, activeTab, searchTerm, dateRange, lastDoc]);

  const fetchBranches = async () => {
    try {
      const data = await getAllBranches();
      setBranches(data.filter(b => b.isActive === true));
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchBranchServices = async (branchId) => {
    try {
      const data = await getBranchServices(branchId);
      // Services are already filtered by branchPricing in getBranchServices
      // getBranchServices only returns services with branchPricing[branchId] set
      setServices(data);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    }
  };

  const fetchBranchStylists = async (branchId) => {
    try {
      const data = await getUsersByRole(USER_ROLES.STYLIST);
      setStylists(data.filter(s => s.branchId === branchId && s.isActive));
    } catch (error) {
      console.error('Error fetching stylists:', error);
      // Clients don't have permission to query stylists
      // Set empty array - stylist selection will be optional
      setStylists([]);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      // Calculate total duration from all selected services
      const totalDuration = bookingData.services.reduce((sum, serviceItem) => {
        const service = services.find(s => s.id === serviceItem.serviceId);
        return sum + (service?.duration || 60);
      }, 0);
      
      // Use first service's stylist preference, or null if no preference
      const preferredStylistId = bookingData.services[0]?.stylistId || null;
      
      const result = await getAvailableTimeSlots(
        preferredStylistId,
        bookingData.branchId,
        bookingData.date,
        totalDuration || 60
      );
      setAvailableSlots(result.slots || []);
      setUnavailableMessage(result.message || null);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
      setUnavailableMessage('Error loading time slots. Please try again.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBookAppointment = () => {
    setAppointmentToReschedule(null);
    setBookingData({
      branchId: '',
      services: [],
      date: '',
      timeSlot: null,
      notes: ''
    });
    setServices([]);
    setStylists([]);
    setAvailableSlots([]);
    setUnavailableMessage(null);
    setShowBookingModal(true);
  };

  const handleSubmitBooking = async () => {
    // Submit directly without showing summary modal
    if (!bookingData.branchId || !bookingData.services || bookingData.services.length === 0 || !bookingData.timeSlot) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if client already has an appointment on the selected date
    const selectedDate = new Date(bookingData.date);
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const endOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
    
    const existingAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate >= startOfDay && 
             aptDate <= endOfDay && 
             apt.status !== APPOINTMENT_STATUS.CANCELLED && 
             apt.status !== APPOINTMENT_STATUS.COMPLETED;
    });

    if (existingAppointments.length > 0) {
      toast.error('You already have an appointment on this date. Please choose a different date.');
      return;
    }

    const branch = branches.find(b => b.id === bookingData.branchId);
    
    // Validate all services and build services array
    const servicesArray = [];
    let totalPrice = 0;
    let totalDuration = 0;
    
    for (const serviceItem of bookingData.services) {
      const service = services.find(s => s.id === serviceItem.serviceId);
      
      if (!service) {
        toast.error('One or more selected services are not available for this branch. Please pick valid services.');
        return;
      }
      
      // Ensure price exists for this branch
      const branchPrice = service.price ?? (service.branchPricing ? service.branchPricing[bookingData.branchId] : undefined);
      if (branchPrice === undefined || branchPrice === null) {
        toast.error(`Service "${service.serviceName}" does not have a price for the chosen branch. Please contact the salon for more details.`);
        return;
      }
      
      const stylist = stylists.find(s => s.id === serviceItem.stylistId);
      
      servicesArray.push({
        serviceId: serviceItem.serviceId,
        serviceName: service?.serviceName || service?.name,
        stylistId: serviceItem.stylistId || null,
        stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Any available',
        duration: service?.duration || 60,
        price: branchPrice
      });
      
      totalPrice += branchPrice;
      totalDuration += (service?.duration || 60);
    }

    // Combine date and time properly - create as local datetime
    // Split the date and time to create a proper local Date object
    const [year, month, day] = bookingData.date.split('-').map(Number);
    const [hours, minutes] = bookingData.timeSlot.time.split(':').map(Number);
    const appointmentDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    const appointmentData = {
      clientId: currentUser.uid,
      clientName: `${userData.firstName} ${userData.lastName}`,
      clientEmail: userData.email,
      clientPhone: userData.phoneNumber || '',
      branchId: bookingData.branchId,
      branchName: branch?.name || branch?.branchName,
      services: servicesArray,
      appointmentDate: appointmentDateTime,
      duration: totalDuration,
      totalPrice: totalPrice,
      status: APPOINTMENT_STATUS.PENDING,
      notes: bookingData.notes
    };

    // Submit directly without showing confirmation modal
    try {
      setBooking(true);
      await createAppointment(appointmentData, currentUser);
      setShowBookingModal(false);
      await fetchAppointments();
      toast.success('Appointment request submitted successfully! Please wait for confirmation.');
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error(error.message || 'Failed to create appointment. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const handleCancelAppointment = (appointment) => {
    setAppointmentToCancel(appointment);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const handleReschedule = async (appointment) => {
    console.log('Reschedule clicked:', appointment);
    // Fetch branch details for operating hours
    try {
      const branch = await getBranchById(appointment.branchId);
      setAppointmentToReschedule({ ...appointment, branch });
      setShowRescheduleModal(true);
      console.log('Reschedule modal should open now');
    } catch (error) {
      console.error('Error fetching branch:', error);
      toast.error('Failed to load branch details');
    }
  };

  const handleSubmitReschedule = async (newDate, newTimeSlot) => {
    if (!appointmentToReschedule) return;
    
    try {
      setRescheduling(true);
      
      // Calculate new appointment date/time
      const [year, month, day] = newDate.split('-').map(Number);
      const [hours, minutes] = newTimeSlot.split(':').map(Number);
      const appointmentDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      // UPDATE existing appointment with new date/time (don't create new or cancel)
      await updateAppointment(
        appointmentToReschedule.id,
        {
          appointmentDate: appointmentDateTime,
          status: APPOINTMENT_STATUS.PENDING // Reset to pending for receptionist approval
        },
        currentUser
      );
      
      setShowRescheduleModal(false);
      setAppointmentToReschedule(null);
      await fetchAppointments();
      toast.success('Appointment rescheduled successfully! Please wait for confirmation.');
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      toast.error(error.message || 'Failed to reschedule appointment. Please try again.');
    } finally {
      setRescheduling(false);
    }
  };

  const confirmCancel = async () => {
    if (!appointmentToCancel) return;
    
    try {
      await cancelAppointment(appointmentToCancel.id, cancellationReason || 'Cancelled by client', currentUser);
      setShowCancelModal(false);
      setAppointmentToCancel(null);
      await fetchAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
    }
  };
  // Pagination calculations
  const totalPages = Math.ceil(totalCounts[activeTab] / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAppointments = appointments.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600">Book and manage your salon appointments</p>
        </div>
        <button
          onClick={handleBookAppointment}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Book Appointment
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDateRange({ from: '', to: '' })}
                className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'all'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All ({totalCounts.all})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'pending'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending ({totalCounts.pending})
            </button>
            <button
              onClick={() => setActiveTab('confirmed')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'confirmed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Confirmed ({totalCounts.confirmed})
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'cancelled'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Cancelled ({totalCounts.cancelled})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'past'
                  ? 'border-gray-500 text-gray-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Past
            </button>
          </nav>
        </div>

        {/* Appointments Grid */}
        <div className="p-4 sm:p-6">
          {appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments found</h3>
              <p className="text-gray-500 mb-6">
                {activeTab === 'all' ? 'You haven\'t booked any appointments yet.' : `No ${activeTab} appointments found.`}
              </p>
              {activeTab === 'all' && (
                <button
                  onClick={handleBookAppointment}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#160B53] text-white rounded-lg hover:bg-[#1a0f63] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Book Your First Appointment
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedAppointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onCancel={activeTab !== 'past' ? handleCancelAppointment : undefined}
                    onReschedule={(activeTab === 'pending' || (activeTab === 'all' && appointment.status === APPOINTMENT_STATUS.PENDING)) ? handleReschedule : undefined}
                    onView={(apt) => { setSelectedDetailAppointment(apt); setShowDetailsModal(true); }}
                    showActions={activeTab !== 'past'}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalCounts[activeTab] > itemsPerPage && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <ChevronUp className="w-4 h-4 rotate-180" />
                    Previous
                  </button>

                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">Page {currentPage}</span> of <span className="font-semibold">{totalPages}</span>
                    {' '} 
                    ({startIndex + 1} - {Math.min(endIndex, totalCounts[activeTab])} of {totalCounts[activeTab]} appointments)
                  </div>

                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Next
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Results Summary for small datasets */}
              {totalCounts[activeTab] <= itemsPerPage && totalCounts[activeTab] > 0 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Showing all {totalCounts[activeTab]} appointments
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      <ClientBookingModal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          // Reset booking data when modal closes
          setBookingData({
            branchId: '',
            services: [],
            date: '',
            timeSlot: null,
            notes: ''
          });
          setServices([]);
          setStylists([]);
          setAvailableSlots([]);
          setUnavailableMessage(null);
        }}
        bookingData={bookingData}
        setBookingData={setBookingData}
        branches={branches}
        services={services}
        stylists={stylists}
        availableSlots={availableSlots}
        loadingSlots={loadingSlots}
        unavailableMessage={unavailableMessage}
        booking={booking}
        onSubmit={handleSubmitBooking}
        existingAppointments={appointments}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          setAppointmentToReschedule(null);
        }}
        appointment={appointmentToReschedule}
        onSubmit={handleSubmitReschedule}
        loading={rescheduling}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setAppointmentToCancel(null);
        }}
        onConfirm={confirmCancel}
        title="Cancel Appointment"
        message={`Are you sure you want to cancel your appointment on ${appointmentToCancel ? formatDate(appointmentToCancel.appointmentDate) : ''}?`}
        confirmText="Yes, Cancel"
        cancelText="Keep Appointment"
        type="danger"
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Cancellation (Optional)
          </label>
          <textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Let us know why you're cancelling..."
          />
        </div>
      </ConfirmModal>

      {/* Appointment Details Modal (Client) */}
      {showDetailsModal && selectedDetailAppointment && (
        <AppointmentDetails
          appointment={selectedDetailAppointment}
          onClose={() => { setShowDetailsModal(false); setSelectedDetailAppointment(null); }}
        />
      )}
    </div>
  );
};

export default ClientAppointments;
