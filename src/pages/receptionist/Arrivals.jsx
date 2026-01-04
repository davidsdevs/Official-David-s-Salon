/**
 * Arrivals & Check-ins Management Page - Receptionist
 * For managing client arrivals and check-ins
 */

import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Search, 
  Clock, 
  CheckCircle, 
  User, 
  Phone, 
  Scissors,
  Calendar,
  AlertCircle,
  ArrowRight,
  Play,
  MapPin,
  Timer,
  Check,
  X,
  Receipt,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import {
  getAppointmentsByDateRange,
  checkInAppointment,
  getAppointmentById,
  APPOINTMENT_STATUS
} from '../../services/appointmentService';
import {
  getArrivalsByBranch,
  getArrivalsByAppointmentIds,
  getArrivalById,
  createWalkInArrival,
  createArrivalFromAppointment,
  updateArrivalStatus,
  ARRIVAL_STATUS
} from '../../services/arrivalsService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import { createBill } from '../../services/billingService';
import BillingModalPOS from '../../components/billing/BillingModalPOS';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

const ReceptionistArrivals = () => {
  const { currentUser, userBranch, userBranchData } = useAuth();
  const navigate = useNavigate();
  
  console.log('🎨 ReceptionistArrivals render - userBranch:', userBranch, 'currentUser:', currentUser?.uid);
  
  const [arrivals, setArrivals] = useState([]); // Combined: checked-in appointments + walk-ins
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming, arrived, in-service
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'tomorrow', 'week', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Helper function to get date range based on filter
  const getDateRange = (filterType) => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filterType) {
      case 'today':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { startDate: today, endDate: tomorrow };

      case 'tomorrow':
        const tomorrowStart = new Date(today);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
        return { startDate: tomorrowStart, endDate: tomorrowEnd };

      case 'week':
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return { startDate: today, endDate: weekEnd };

      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return { startDate: start, endDate: end };
        }
        return { startDate: today, endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000) };

      default:
        return { startDate: today, endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    }
  };
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [clients, setClients] = useState([]);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [arrivalToBill, setArrivalToBill] = useState(null);
  const [processingBilling, setProcessingBilling] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInData, setCheckInData] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedArrival, setSelectedArrival] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showWalkInConfirmModal, setShowWalkInConfirmModal] = useState(false);
  const [pendingWalkInData, setPendingWalkInData] = useState(null);
  const [showCheckInConfirmModal, setShowCheckInConfirmModal] = useState(false);
  const [appointmentToCheckIn, setAppointmentToCheckIn] = useState(null);
  const [showStartServiceConfirmModal, setShowStartServiceConfirmModal] = useState(false);
  const [arrivalToStartService, setArrivalToStartService] = useState(null);
  const [showCompleteServiceConfirmModal, setShowCompleteServiceConfirmModal] = useState(false);
  const [arrivalToCompleteService, setArrivalToCompleteService] = useState(null);

  useEffect(() => {
    console.log('🔄 useEffect triggered, userBranch:', userBranch, 'type:', typeof userBranch);
    
    if (userBranch && typeof userBranch === 'string' && userBranch.trim() !== '') {
      console.log('🏪 Branch loaded, ARRIVAL_STATUS constants:', ARRIVAL_STATUS);
      fetchArrivals();
      fetchServicesAndStylists();
    } else {
      console.log('⚠️ useEffect skipped - userBranch not ready:', userBranch);
      setLoading(false);
    }
  }, [userBranch]);

  // Refetch when date filter changes
  useEffect(() => {
    if (userBranch && activeTab === 'upcoming') {
      fetchArrivals();
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const fetchServicesAndStylists = async () => {
    try {
      console.log('🔍 fetchServicesAndStylists called, userBranch:', userBranch);
      
      // Guard: Don't fetch if branch is not loaded yet
      if (!userBranch || typeof userBranch !== 'string' || userBranch.trim() === '') {
        console.log('⚠️ Branch not loaded yet or invalid, skipping services/stylists fetch. userBranch:', userBranch);
        return;
      }
      
      // Fetch branch services (userBranch is already the branchId string)
      const branchServices = await getBranchServices(userBranch);
      setServices(branchServices);
      
      // Fetch stylists
      const branchStylists = await getUsersByRole(USER_ROLES.STYLIST);
      const filteredStylists = branchStylists.filter(s => s.branchId === userBranch);
      setStylists(filteredStylists);

      // Fetch clients for billing modal
      const clientsData = await getUsersByRole(USER_ROLES.CLIENT);
      setClients(clientsData.filter(c => c.isActive));
    } catch (error) {
      console.error('Error fetching services and stylists:', error);
    }
  };

  const fetchArrivals = async () => {
    try {
      setLoading(true);

      console.log('🔍 fetchArrivals called, userBranch value:', userBranch, 'type:', typeof userBranch);

      // Guard: Don't fetch if branch is not loaded yet
      if (!userBranch || typeof userBranch !== 'string' || userBranch.trim() === '') {
        console.log('⚠️ Branch not loaded yet or invalid, skipping fetch. userBranch:', userBranch);
        setLoading(false);
        return;
      }

      const now = new Date();
      const dateRange = getDateRange(dateFilter);

      console.log('📅 Fetching data for:', { now, dateRange, branchId: userBranch, filter: dateFilter });

      // Fetch appointments based on date filter
      const appointmentsData = await getAppointmentsByDateRange(userBranch, dateRange.startDate, dateRange.endDate);
      console.log('📋 Appointments fetched:', appointmentsData.length);

      // Fetch ALL active arrivals regardless of date (for Arrived and In-service tabs)
      // The Arrived tab should show everyone who's checked in and waiting, like a hotel
      const allArrivalsData = await getArrivalsByBranch(userBranch); // No date filter = get all
      console.log('✅ All arrivals fetched (no date filter):', allArrivalsData.length, allArrivalsData);

      // Filter out completed and cancelled arrivals (only show active ones)
      const activeArrivals = allArrivalsData.filter(arr =>
        arr.status !== ARRIVAL_STATUS.COMPLETED &&
        arr.status !== ARRIVAL_STATUS.CANCELLED
      );
      console.log('🟢 Active arrivals:', activeArrivals.length, activeArrivals);
      
      // Get list of appointment IDs that are already checked in
      const checkedInAppointmentIds = new Set(
        activeArrivals
          .filter(arr => !arr.isWalkIn && arr.appointmentId)
          .map(arr => arr.appointmentId)
      );
      console.log('🔗 Checked-in appointment IDs:', Array.from(checkedInAppointmentIds));
      
      // Filter upcoming appointments: confirmed, scheduled within date range, and not yet in check-in collection
      // Note: We check check-in collection instead of appointment.arrivedAt
      const upcomingAppointments = appointmentsData.filter(apt => {
        if (apt.status !== APPOINTMENT_STATUS.CONFIRMED) return false;
        if (checkedInAppointmentIds.has(apt.id)) return false;

        // Show appointments scheduled within the selected date range
        if (apt.appointmentDate) {
          const aptDate = apt.appointmentDate instanceof Date
            ? apt.appointmentDate
            : (apt.appointmentDate.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate));

          // Include if appointment is scheduled within the date range
          return aptDate >= dateRange.startDate && aptDate <= dateRange.endDate;
        }

        return false;
      });
      console.log('⏰ Upcoming appointments:', upcomingAppointments.length);
      
      // Combine upcoming appointments + active arrivals (today only)
      const combinedArrivals = [
        ...upcomingAppointments.map(apt => ({ ...apt, type: 'appointment', isUpcoming: true })),
        ...activeArrivals.map(arr => ({ ...arr, type: arr.isWalkIn ? 'walkIn' : 'appointment', isUpcoming: false }))
      ];
      console.log('🎯 Combined arrivals:', combinedArrivals.length);
      
      setArrivals(combinedArrivals);
    } catch (error) {
      console.error('Error fetching arrivals:', error);
      toast.error('Failed to load arrivals');
    } finally {
      setLoading(false);
    }
  };

  // Filter arrivals based on active tab
  const filteredArrivals = useMemo(() => {
    let filtered = [...arrivals];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.clientName?.toLowerCase().includes(searchLower) ||
        apt.clientPhone?.includes(searchTerm) ||
        apt.serviceName?.toLowerCase().includes(searchLower) ||
        apt.stylistName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply tab filter
    if (activeTab === 'upcoming') {
      // Show confirmed appointments that haven't arrived yet (not checked in)
      // Note: isUpcoming flag already indicates they're not in check-in collection
      filtered = filtered.filter(apt => 
        apt.isUpcoming === true &&
        apt.status === APPOINTMENT_STATUS.CONFIRMED
      );
      console.log(`📋 Upcoming filtered: ${filtered.length} items`);
    } else if (activeTab === 'arrived') {
      // Show arrivals that are in "arrived" status (not yet in service)
      console.log(`🔍 Before arrived filter:`, filtered.map(a => ({ 
        name: a.clientName, 
        isUpcoming: a.isUpcoming, 
        status: a.status 
      })));
      
      filtered = filtered.filter(apt => 
        apt.isUpcoming === false &&
        apt.status === ARRIVAL_STATUS.ARRIVED
      );
      
      console.log(`✅ Arrived filtered: ${filtered.length} items`, filtered.map(a => ({ 
        name: a.clientName, 
        status: a.status,
        arrivedAt: a.arrivedAt 
      })));
    } else if (activeTab === 'in-service') {
      // Show arrivals currently in service
      filtered = filtered.filter(apt => 
        apt.isUpcoming === false &&
        apt.status === ARRIVAL_STATUS.IN_SERVICE
      );
      console.log(`🔧 In-service filtered: ${filtered.length} items`);
    }

    // Sort by appointment time (earliest first for upcoming, arrived time for arrived/in-service)
    filtered.sort((a, b) => {
      if (activeTab === 'upcoming') {
        // Sort upcoming appointments by appointment time
        const dateA = a.appointmentDate?.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate);
        const dateB = b.appointmentDate?.toDate ? b.appointmentDate.toDate() : new Date(b.appointmentDate);
        return dateA - dateB;
      } else {
        // Sort arrivals by arrived time
        const dateA = a.arrivedAt?.toDate ? a.arrivedAt.toDate() : new Date(a.arrivedAt);
        const dateB = b.arrivedAt?.toDate ? b.arrivedAt.toDate() : new Date(b.arrivedAt);
        return dateA - dateB;
      }
    });

    return filtered;
  }, [arrivals, searchTerm, activeTab]);

  // Statistics
  const stats = useMemo(() => {
    console.log('📊 Calculating stats from arrivals:', arrivals.length);
    console.log('📊 All arrivals:', arrivals.map(a => ({ 
      name: a.clientName, 
      isUpcoming: a.isUpcoming, 
      status: a.status,
      type: a.type 
    })));
    
    const upcoming = arrivals.filter(a => a.isUpcoming === true).length;
    const arrived = arrivals.filter(a => a.isUpcoming === false && a.status === ARRIVAL_STATUS.ARRIVED).length;
    const inService = arrivals.filter(a => a.isUpcoming === false && a.status === ARRIVAL_STATUS.IN_SERVICE).length;
    
    console.log('📊 Stats calculated:', { upcoming, arrived, inService, totalToday: arrivals.length });
    
    return {
      upcoming,
      arrived,
      inService,
      totalToday: arrivals.length
    };
  }, [arrivals]);

  const handleCheckIn = async (appointment) => {
    // Show confirmation modal first
    setAppointmentToCheckIn(appointment);
    setShowCheckInConfirmModal(true);
  };

  const confirmCheckIn = () => {
    if (!appointmentToCheckIn) return;
    
    try {
      // Prepare appointment data for check-in modal (using BillingModalPOS)
      const appointmentForCheckIn = {
        id: appointmentToCheckIn.id,
        appointmentId: appointmentToCheckIn.id,
        clientId: appointmentToCheckIn.clientId || null,
        clientName: appointmentToCheckIn.clientName || '',
        clientPhone: appointmentToCheckIn.clientPhone || '',
        clientEmail: appointmentToCheckIn.clientEmail || '',
        branchId: appointmentToCheckIn.branchId,
        branchName: appointmentToCheckIn.branchName || '',
        stylistId: appointmentToCheckIn.stylistId || null,
        stylistName: appointmentToCheckIn.stylistName || '',
        services: appointmentToCheckIn.services || (appointmentToCheckIn.serviceId ? [{
          serviceId: appointmentToCheckIn.serviceId,
          serviceName: appointmentToCheckIn.serviceName || '',
          price: appointmentToCheckIn.servicePrice || 0,
          stylistId: appointmentToCheckIn.stylistId || null,
          stylistName: appointmentToCheckIn.stylistName || ''
        }] : []),
        products: appointmentToCheckIn.products || [], // Include pre-selected products
        serviceId: appointmentToCheckIn.serviceId || null,
        serviceName: appointmentToCheckIn.serviceName || '',
        servicePrice: appointmentToCheckIn.servicePrice || 0,
        isWalkIn: false,
        isNewCheckIn: true, // Flag to indicate this is a new check-in
        notes: appointmentToCheckIn.notes || ''
      };
      
      // Close confirmation modal and open billing modal in checkin mode
      setShowCheckInConfirmModal(false);
      setCheckInData(appointmentForCheckIn);
      setShowCheckInModal(true);
      setAppointmentToCheckIn(null);
    } catch (error) {
      console.error('Error opening check-in modal:', error);
      toast.error('Failed to open check-in');
      setShowCheckInConfirmModal(false);
      setAppointmentToCheckIn(null);
    }
  };

  const handleCheckInSubmit = async (formData) => {
    // Check if this is a walk-in or check-in
    const isWalkIn = checkInData?.isNewWalkIn;
    const isCheckIn = checkInData?.isNewCheckIn;
    
    if (isWalkIn) {
      // Validate walk-in data first
      if (!formData.clientName?.trim()) {
        toast.error('Please enter client name');
        return;
      }
      
      if (!formData.items || formData.items.length === 0) {
        toast.error('Please select at least one service');
        return;
      }
      
      // Show confirmation modal for walk-in submission
      setPendingWalkInData(formData);
      setShowWalkInConfirmModal(true);
      return; // Don't proceed yet, wait for confirmation
    }
    
    // For check-ins, proceed with submission
    await proceedWithCheckIn(formData);
  };

  const confirmWalkInSubmit = async () => {
    if (!pendingWalkInData) return;
    
    try {
      setProcessing('walkin');
      setShowWalkInConfirmModal(false);
      
      // Create walk-in arrival with ARRIVED status
      const firstService = pendingWalkInData.items.find(item => item.type === 'service');
      const walkInArrival = {
        clientId: pendingWalkInData.clientId || null,
        clientName: pendingWalkInData.clientName.trim(),
        clientPhone: pendingWalkInData.clientPhone || '',
        clientEmail: pendingWalkInData.clientEmail || '',
        branchId: pendingWalkInData.branchId,
        branchName: pendingWalkInData.branchName || '',
        services: pendingWalkInData.items
          .filter(item => item.type === 'service')
          .map(item => ({
            serviceId: item.serviceId || item.id || null, // Support both serviceId and id
            serviceName: item.name || '',
            price: item.price || 0,
            duration: item.duration || 30, // Add duration
            quantity: item.quantity || 1, // Add quantity
            stylistId: item.stylistId || null,
            stylistName: item.stylistName || ''
          }))
          .filter(service => service.serviceId), // Remove services without serviceId
        serviceId: firstService?.serviceId || firstService?.id || null,
        serviceName: firstService?.name || '',
        servicePrice: firstService?.price || 0,
        stylistId: firstService?.stylistId || null,
        stylistName: firstService?.stylistName || '',
        products: pendingWalkInData.items
          .filter(item => item.type === 'product')
          .map(item => ({
            productId: item.productId || item.id || null, // Support both productId and id
            productName: item.name || '',
            price: item.price || 0,
            quantity: item.quantity || 1
          }))
          .filter(product => product.productId), // Remove products without productId
        notes: pendingWalkInData.notes || '',
        status: ARRIVAL_STATUS.ARRIVED
      };

      console.log('🏪 Creating walk-in with services:', walkInArrival.services);
      console.log('🏪 Creating walk-in with products:', walkInArrival.products);

      await createWalkInArrival(walkInArrival, currentUser);
      toast.success('Walk-in client added successfully!');
      
      // Close modal and refresh
      setShowCheckInModal(false);
      setCheckInData(null);
      setPendingWalkInData(null);
      
      // Wait a bit to ensure Firestore has propagated the data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh arrivals data
      await fetchArrivals();
      
      // Switch to "arrived" tab to show the newly added walk-in
      setActiveTab('arrived');
    } catch (error) {
      console.error('Error during walk-in submission:', error);
      toast.error('Failed to add walk-in client');
      setPendingWalkInData(null);
    } finally {
      setProcessing(null);
    }
  };

  const proceedWithCheckIn = async (formData) => {
    try {
      setProcessing('checkin');
      
      // This handles check-in from appointments
      if (checkInData?.isNewCheckIn) {
        // Create arrival record from appointment
        const firstServiceCheckIn = formData.items.find(item => item.type === 'service');
        const arrivalData = {
          appointmentId: checkInData.appointmentId,
          clientId: formData.clientId || null,
          clientName: formData.clientName || '',
          clientPhone: formData.clientPhone || '',
          clientEmail: formData.clientEmail || '',
          branchId: formData.branchId,
          branchName: formData.branchName || '',
          services: formData.items
            .filter(item => item.type === 'service')
            .map(item => ({
              serviceId: item.serviceId || item.id || null, // Support both serviceId and id
              serviceName: item.name || '',
              price: item.price || 0,
              stylistId: item.stylistId || null,
              stylistName: item.stylistName || ''
            }))
            .filter(service => service.serviceId), // Remove services without serviceId
          serviceId: firstServiceCheckIn?.serviceId || firstServiceCheckIn?.id || null,
          serviceName: firstServiceCheckIn?.name || '',
          servicePrice: firstServiceCheckIn?.price || 0,
          stylistId: firstServiceCheckIn?.stylistId || null,
          stylistName: firstServiceCheckIn?.stylistName || '',
          products: formData.items
            .filter(item => item.type === 'product')
            .map(item => ({
              productId: item.productId || item.id || null, // Support both productId and id
              productName: item.name || '',
              price: item.price || 0,
              quantity: item.quantity || 1
            }))
            .filter(product => product.productId), // Remove products without productId
          notes: formData.notes || '',
          status: ARRIVAL_STATUS.ARRIVED // Just arrived, not completed yet
        };
        
        const newArrival = await createArrivalFromAppointment(checkInData.appointmentId, arrivalData, currentUser);
        console.log('✅ Created arrival from check-in:', newArrival);

        // Also update the appointment to include the products for record keeping
        if (arrivalData.products && arrivalData.products.length > 0) {
          try {
            const appointmentRef = doc(db, 'appointments', checkInData.appointmentId);
            await updateDoc(appointmentRef, {
              products: arrivalData.products,
              updatedAt: serverTimestamp()
            });
            console.log('✅ Updated appointment with products:', arrivalData.products);
          } catch (error) {
            console.error('Error updating appointment with products:', error);
            // Don't fail the check-in if appointment update fails
          }
        }

        toast.success('Client checked in successfully!');
      }
      
      // Close modal and refresh
      setShowCheckInModal(false);
      setCheckInData(null);
      
      // Wait a bit to ensure Firestore has propagated the data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Increased to 1 second
      
      // Refresh arrivals data
      await fetchArrivals();
      
      // Switch to "arrived" tab to show the newly checked-in client
      setActiveTab('arrived');
      console.log('🎯 Switched to arrived tab after check-in');
    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Failed to process check-in');
    } finally {
      setProcessing(null);
    }
  };

  const handleStartService = async (arrival) => {
    // Show confirmation modal first
    setArrivalToStartService(arrival);
    setShowStartServiceConfirmModal(true);
  };

  const confirmStartService = async () => {
    if (!arrivalToStartService) return;
    
    try {
      setProcessing(arrivalToStartService.id);
      setShowStartServiceConfirmModal(false);
      // Update arrival status (works for both appointments and walk-ins)
      await updateArrivalStatus(arrivalToStartService.id, ARRIVAL_STATUS.IN_SERVICE, currentUser);
      await fetchArrivals();
      setArrivalToStartService(null);
      // Toast is shown in updateArrivalStatus, so we don't need another one here
    } catch (error) {
      console.error('Error starting service:', error);
      toast.error('Failed to start service');
      setArrivalToStartService(null);
    } finally {
      setProcessing(null);
    }
  };

  const handleCompleteService = async (arrival) => {
    // Show confirmation modal first
    setArrivalToCompleteService(arrival);
    setShowCompleteServiceConfirmModal(true);
  };

  const confirmCompleteService = async () => {
    if (!arrivalToCompleteService) return;
    
    try {
      setProcessing(arrivalToCompleteService.id);
      setShowCompleteServiceConfirmModal(false);
      
      // Convert arrival to appointment-like format for billing modal
      let products = arrivalToCompleteService.products || [];

      // If arrival doesn't have products but is linked to an appointment, try to get products from the appointment
      if ((!products || products.length === 0) && arrivalToCompleteService.appointmentId) {
        try {
          const appointment = await getAppointmentById(arrivalToCompleteService.appointmentId);
          if (appointment && appointment.products) {
            products = appointment.products;
            console.log('📦 Loaded products from associated appointment:', products);
          }
        } catch (error) {
          console.error('Error loading products from appointment:', error);
        }
      }

      const arrivalForBilling = {
        id: arrivalToCompleteService.appointmentId || arrivalToCompleteService.id,
        arrivalId: arrivalToCompleteService.id, // Store arrival ID for status update
        appointmentId: arrivalToCompleteService.appointmentId || null, // Store appointment ID if exists
        clientId: arrivalToCompleteService.clientId || null,
        clientName: arrivalToCompleteService.clientName || '',
        clientPhone: arrivalToCompleteService.clientPhone || '',
        clientEmail: arrivalToCompleteService.clientEmail || '',
        branchId: arrivalToCompleteService.branchId,
        branchName: arrivalToCompleteService.branchName || '',
        stylistId: arrivalToCompleteService.stylistId || null,
        stylistName: arrivalToCompleteService.stylistName || '',
        services: arrivalToCompleteService.services || (arrivalToCompleteService.serviceId ? [{
          serviceId: arrivalToCompleteService.serviceId,
          serviceName: arrivalToCompleteService.serviceName || '',
          price: arrivalToCompleteService.servicePrice || 0,
          stylistId: arrivalToCompleteService.stylistId || null,
          stylistName: arrivalToCompleteService.stylistName || ''
        }] : []),
        products: products, // Include products from arrival or appointment
        serviceId: arrivalToCompleteService.serviceId || null,
        serviceName: arrivalToCompleteService.serviceName || '',
        servicePrice: arrivalToCompleteService.servicePrice || 0,
        isWalkIn: arrivalToCompleteService.isWalkIn || false,
        notes: arrivalToCompleteService.notes || ''
      };
      
      // Open billing modal (status will be updated after payment)
      console.log('💰 Opening billing modal with products:', arrivalForBilling.products);
      setArrivalToBill(arrivalForBilling);
      setShowBillingModal(true);
      setArrivalToCompleteService(null);
    } catch (error) {
      console.error('Error opening billing modal:', error);
      toast.error('Failed to open billing modal');
      setArrivalToCompleteService(null);
      setProcessing(null);
    }
  };

  const handleSubmitBill = async (billData) => {
    try {
      setProcessingBilling(true);
      
      // Link bill to arrival/appointment
      if (arrivalToBill) {
        billData.arrivalId = arrivalToBill.arrivalId;
        billData.appointmentId = arrivalToBill.appointmentId || arrivalToBill.id;
      }
      
      // Create the bill
      await createBill(billData, currentUser);
      
      // Update arrival status to COMPLETED after successful payment
      if (arrivalToBill && arrivalToBill.arrivalId) {
        await updateArrivalStatus(arrivalToBill.arrivalId, ARRIVAL_STATUS.COMPLETED, currentUser);
      }
      
      // Close modal and reset
      setShowBillingModal(false);
      setArrivalToBill(null);
      
      // Refresh arrivals
      await fetchArrivals();
      
      toast.success('Payment processed successfully!');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setProcessingBilling(false);
    }
  };


  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeUntilAppointment = (appointmentDate) => {
    const now = new Date();
    const aptDate = appointmentDate.toDate ? appointmentDate.toDate() : new Date(appointmentDate);
    const diffMs = aptDate - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) {
      const minsLate = Math.abs(diffMins);
      return `${minsLate} min${minsLate !== 1 ? 's' : ''} late`;
    } else if (diffMins < 60) {
      return `in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `in ${hours}h ${mins}m`;
    }
  };

  const getWaitTime = (arrivedAt) => {
    if (!arrivedAt) return null;
    const now = new Date();
    const arrived = arrivedAt.toDate ? arrivedAt.toDate() : new Date(arrivedAt);
    const diffMs = now - arrived;
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  const getServiceTime = (startedAt) => {
    if (!startedAt) return null;
    const now = new Date();
    const started = startedAt.toDate ? startedAt.toDate() : new Date(startedAt);
    const diffMs = now - started;
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  const handleCreateWalkInClick = () => {
    // Prepare empty walk-in data for billing modal
    const walkInData = {
      id: null,
      appointmentId: null,
      clientId: null,
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      branchId: userBranch, // userBranch is already the branchId string
      branchName: '', // Will be set by the billing service
      stylistId: null,
      stylistName: '',
      services: [],
      serviceId: null,
      serviceName: '',
      servicePrice: 0,
      isWalkIn: true,
      isNewWalkIn: true, // Flag to indicate this is a new walk-in
      notes: ''
    };
    
    // Open billing modal in checkin mode (for walk-in)
    setCheckInData(walkInData);
    setShowCheckInModal(true);
  };

  const handleViewDetails = async (arrival) => {
    try {
      setLoadingDetails(true);
      
      // Always fetch fresh data from Firebase to ensure we have the latest services/products
      let freshArrival = null;
      try {
        freshArrival = await getArrivalById(arrival.id);
        console.log('🔍 handleViewDetails - Fresh arrival from Firebase:', freshArrival);
        console.log('🔍 handleViewDetails - Fresh services:', freshArrival?.services);
        console.log('🔍 handleViewDetails - Fresh products:', freshArrival?.products);
      } catch (error) {
        console.error('Error fetching fresh arrival data:', error);
        // Fallback to cached data if fetch fails
        freshArrival = arrival;
      }
      
      // Use fresh data if available, otherwise use cached data
      const arrivalData = freshArrival || arrival;
      
      // If this is an appointment-based arrival, fetch the full appointment data
      if (arrivalData.appointmentId && !arrivalData.isWalkIn) {
        try {
          const fullAppointment = await getAppointmentById(arrivalData.appointmentId);
          setSelectedArrival(fullAppointment);
        } catch (error) {
          console.error('Error fetching appointment details:', error);
          // If fetching fails, use the arrival data as fallback
          setSelectedArrival(arrivalData);
        }
      } else {
        // For walk-ins or if no appointmentId, use the arrival data directly
        // Transform arrival to appointment-like format for AppointmentDetails component
        console.log('🔍 handleViewDetails - Using arrival data:', arrivalData);
        console.log('🔍 handleViewDetails - Arrival services:', arrivalData.services);
        console.log('🔍 handleViewDetails - Arrival services type:', typeof arrivalData.services, Array.isArray(arrivalData.services));
        console.log('🔍 handleViewDetails - Arrival products:', arrivalData.products);
        console.log('🔍 handleViewDetails - Arrival products type:', typeof arrivalData.products, Array.isArray(arrivalData.products));
        
        // Ensure services and products are arrays (handle Firestore data conversion)
        const servicesArray = Array.isArray(arrivalData.services) 
          ? arrivalData.services 
          : (arrivalData.services ? [arrivalData.services] : []);
        
        const productsArray = Array.isArray(arrivalData.products) 
          ? arrivalData.products 
          : (arrivalData.products ? [arrivalData.products] : []);
        
        console.log('🔍 handleViewDetails - Processed services array:', servicesArray);
        console.log('🔍 handleViewDetails - Processed products array:', productsArray);
        
        const arrivalAsAppointment = {
          ...arrivalData,
          appointmentDate: arrivalData.arrivedAt || arrivalData.appointmentDate,
          appointmentTime: arrivalData.arrivedAt 
            ? (arrivalData.arrivedAt.toDate ? arrivalData.arrivedAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : new Date(arrivalData.arrivedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
            : (arrivalData.appointmentTime || null),
          status: arrivalData.status || APPOINTMENT_STATUS.CONFIRMED,
          history: arrivalData.history || [],
          // Explicitly preserve services and products as arrays
          services: servicesArray,
          products: productsArray
        };
        
        console.log('🔍 handleViewDetails - Transformed arrivalAsAppointment:', arrivalAsAppointment);
        console.log('🔍 handleViewDetails - Final services:', arrivalAsAppointment.services);
        console.log('🔍 handleViewDetails - Final products:', arrivalAsAppointment.products);
        
        setSelectedArrival(arrivalAsAppointment);
      }
      
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error loading details:', error);
      toast.error('Failed to load details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Show loading while waiting for authentication and branch data
  if (loading || !currentUser || !userBranch) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
          {!userBranch && currentUser && (
            <p className="text-gray-500 mt-4">Loading branch data...</p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Arrivals & Check-ins</h1>
            <p className="text-sm md:text-base text-gray-600">Manage client arrivals and check-ins for today</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCreateWalkInClick}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700"
            >
              <User className="h-4 w-4" />
              Add Walk-in
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-xl font-bold text-gray-900">{stats.upcoming}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Arrived</p>
                <p className="text-xl font-bold text-gray-900">{stats.arrived}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Play className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Service</p>
                <p className="text-xl font-bold text-gray-900">{stats.inService}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Today</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalToday}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upcoming ({stats.upcoming})
          </button>
          <button
            onClick={() => setActiveTab('arrived')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'arrived'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Arrived ({stats.arrived})
          </button>
          <button
            onClick={() => setActiveTab('in-service')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'in-service'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            In Service ({stats.inService})
          </button>
        </div>

        {/* Analytics for Upcoming Tab */}
        {activeTab === 'upcoming' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Clients</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.arrived + stats.inService}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.arrived} waiting, {stats.inService} in service
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Service Efficiency</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(() => {
                      const completed = arrivals.filter(a => a.status === ARRIVAL_STATUS.COMPLETED).length;
                      const totalProcessed = arrivals.length;
                      if (totalProcessed === 0) return '0%';
                      return Math.round((completed / totalProcessed) * 100) + '%';
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {arrivals.filter(a => a.status === ARRIVAL_STATUS.COMPLETED).length} completed today
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Queue Status</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {(() => {
                      const waiting = arrivals.filter(a =>
                        a.isUpcoming === false &&
                        a.status === ARRIVAL_STATUS.ARRIVED
                      ).length;
                      const inService = stats.inService;

                      if (waiting === 0 && inService === 0) return 'Clear';
                      if (waiting <= 2) return 'Light';
                      if (waiting <= 5) return 'Busy';
                      return 'Heavy';
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {arrivals.filter(a => a.status === ARRIVAL_STATUS.ARRIVED).length} waiting
                  </p>
                </div>
                <Timer className="h-8 w-8 text-orange-600" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Wait Time</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {(() => {
                      const waitingArrivals = arrivals.filter(a =>
                        a.isUpcoming === false &&
                        a.status === ARRIVAL_STATUS.ARRIVED &&
                        a.arrivedAt
                      );

                      if (waitingArrivals.length === 0) return '0min';

                      const totalWait = waitingArrivals.reduce((sum, arr) => {
                        return sum + (getWaitTime(arr.arrivedAt) || 0);
                      }, 0);

                      const avgWait = Math.round(totalWait / waitingArrivals.length);
                      return avgWait + 'min';
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Average waiting time</p>
                </div>
                <Timer className="h-8 w-8 text-purple-600" />
              </div>
            </Card>
          </div>
        )}

        {/* Date Filter for Upcoming Tab */}
        {activeTab === 'upcoming' && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">Filter by Date</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{stats.upcoming} appointments</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setDateFilter('today')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  dateFilter === 'today'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('tomorrow')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  dateFilter === 'tomorrow'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('week')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  dateFilter === 'week'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('custom')}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  dateFilter === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Custom
              </button>
            </div>

            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow">
          <SearchInput
            placeholder="Search by client name, phone, service, or stylist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Arrivals List */}
        <div className="space-y-3">
          {filteredArrivals.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {activeTab === 'upcoming' && 'No upcoming appointments'}
                {activeTab === 'arrived' && 'No clients have arrived yet'}
                {activeTab === 'in-service' && 'No appointments in service'}
              </p>
            </Card>
          ) : (
            filteredArrivals.map((arrival) => {
              const isProcessing = processing === arrival.id;
              // Calculate appropriate time based on status
              let displayTime = null;
              let timeLabel = '';
              if (arrival.isUpcoming === false) {
                if (arrival.status === ARRIVAL_STATUS.IN_SERVICE && arrival.startedAt) {
                  // Show service time for customers in service
                  displayTime = getServiceTime(arrival.startedAt);
                  timeLabel = 'service';
                } else if (arrival.status === ARRIVAL_STATUS.ARRIVED && arrival.arrivedAt) {
                  // Show wait time for customers waiting
                  displayTime = getWaitTime(arrival.arrivedAt);
                  timeLabel = 'waiting';
                }
              }
              const timeUntil = activeTab === 'upcoming' && arrival.isUpcoming === true && arrival.appointmentDate ? getTimeUntilAppointment(arrival.appointmentDate) : null;
              const isWalkIn = arrival.isWalkIn === true;

              return (
                <Card key={arrival.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left: Client Info */}
                    <div className="flex-1 flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${isWalkIn ? 'bg-green-100' : 'bg-blue-100'}`}>
                        <User className={`h-6 w-6 ${isWalkIn ? 'text-green-600' : 'text-blue-600'}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {arrival.clientName || 'Unknown Client'}
                          </h3>
                          {isWalkIn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Walk-in
                            </span>
                          )}
                          {displayTime !== null && displayTime >= 0 && (
                            <>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                timeLabel === 'waiting' && displayTime >= 60
                                  ? 'bg-red-100 text-red-800 animate-pulse'
                                  : timeLabel === 'service'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                <Timer className="h-3 w-3" />
                                {displayTime} min {timeLabel === 'service' ? '(service)' : timeLabel === 'waiting' ? '(waiting)' : ''}
                              </span>
                              {timeLabel === 'waiting' && displayTime >= 60 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                                  ACTION REQUIRED
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            <span>{arrival.clientPhone || 'N/A'}</span>
                          </div>
                          
                          {arrival.serviceName && (
                            <div className="flex items-center gap-1">
                              <Scissors className="h-4 w-4" />
                              <span className="truncate">{arrival.serviceName || 'Multiple Services'}</span>
                            </div>
                          )}
                          
                          {arrival.stylistName && (
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{arrival.stylistName}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          {arrival.isUpcoming && arrival.appointmentDate && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Appointment: {formatTime(arrival.appointmentDate)}</span>
                              {timeUntil && (
                                <span className={`px-2 py-0.5 rounded ${
                                  timeUntil.includes('late') ? 'bg-red-100 text-red-700' : 
                                  timeUntil.includes('in') && parseInt(timeUntil) < 30 ? 'bg-green-100 text-green-700' : 
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {timeUntil}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {!arrival.isUpcoming && arrival.arrivedAt && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <span>Arrived: {formatTime(arrival.arrivedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        onClick={() => handleViewDetails(arrival)}
                        disabled={loadingDetails}
                        className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                      
                      {activeTab === 'upcoming' && arrival.isUpcoming === true && arrival.status === APPOINTMENT_STATUS.CONFIRMED && (
                        <Button
                          onClick={() => handleCheckIn(arrival)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          Check In
                        </Button>
                      )}
                      
                      {activeTab === 'arrived' && (
                        <Button
                          onClick={() => handleStartService(arrival)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                        >
                          <Play className="h-4 w-4" />
                          Start Service
                        </Button>
                      )}
                      
                      {activeTab === 'in-service' && (
                        <Button
                          onClick={() => handleCompleteService(arrival)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <Receipt className="h-4 w-4" />
                          Check-out
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Check-in / Walk-in Modal - Using BillingModalPOS in checkin mode */}
      {checkInData && (
        <BillingModalPOS
          isOpen={showCheckInModal}
          appointment={checkInData}
          services={services}
          stylists={stylists}
          clients={clients}
          mode="checkin"
          onClose={() => {
            if (!processing) {
              setShowCheckInModal(false);
              setCheckInData(null);
            }
          }}
          onSubmit={handleCheckInSubmit}
          loading={processing === 'checkin' || processing === 'walkin'}
        />
      )}

      {/* Billing Modal */}
      {arrivalToBill && (
        <BillingModalPOS
          isOpen={showBillingModal}
          appointment={arrivalToBill}
          services={services}
          stylists={stylists}
          clients={clients}
          mode="billing"
          onClose={() => {
            if (!processingBilling) {
              setShowBillingModal(false);
              setArrivalToBill(null);
              // Reset processing state when modal is closed so checkout button can be clicked again
              setProcessing(null);
            }
          }}
          onSubmit={handleSubmitBill}
          loading={processingBilling}
        />
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedArrival && (
        <AppointmentDetails
          appointment={selectedArrival}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedArrival(null);
          }}
          onEdit={null} // Disable edit from arrivals page
        />
      )}

      {/* Confirm Add Walk-in Modal */}
      <ConfirmModal
        isOpen={showWalkInConfirmModal}
        onClose={() => {
          if (!processing) {
            setShowWalkInConfirmModal(false);
            setPendingWalkInData(null);
          }
        }}
        onConfirm={confirmWalkInSubmit}
        title="Add Walk-in Client"
        message={`Are you sure you want to add walk-in client ${pendingWalkInData?.clientName || ''}?`}
        confirmText="Add Walk-in"
        cancelText="Cancel"
        type="default"
        loading={processing === 'walkin'}
      />

      {/* Confirm Check In Modal */}
      <ConfirmModal
        isOpen={showCheckInConfirmModal}
        onClose={() => {
          if (!processing) {
            setShowCheckInConfirmModal(false);
            setAppointmentToCheckIn(null);
          }
        }}
        onConfirm={confirmCheckIn}
        title="Check In Client"
        message={`Are you sure you want to check in ${appointmentToCheckIn?.clientName || 'this client'}? You will be able to adjust services and products after confirming.`}
        confirmText="Check In"
        cancelText="Cancel"
        type="default"
        loading={processing !== null}
      />

      {/* Confirm Start Service Modal */}
      <ConfirmModal
        isOpen={showStartServiceConfirmModal}
        onClose={() => {
          if (!processing) {
            setShowStartServiceConfirmModal(false);
            setArrivalToStartService(null);
          }
        }}
        onConfirm={confirmStartService}
        title="Start Service"
        message={`Are you sure you want to start service for ${arrivalToStartService?.clientName || 'this client'}?`}
        confirmText="Start Service"
        cancelText="Cancel"
        type="default"
        loading={processing === arrivalToStartService?.id}
      />

      {/* Confirm Check-out Modal */}
      <ConfirmModal
        isOpen={showCompleteServiceConfirmModal}
        onClose={() => {
          if (!processing) {
            setShowCompleteServiceConfirmModal(false);
            setArrivalToCompleteService(null);
            // Reset processing state when modal is closed
            setProcessing(null);
          }
        }}
        onConfirm={confirmCompleteService}
        title="Check-out"
        message={`Are you sure you want to check-out ${arrivalToCompleteService?.clientName || 'this client'}? You will proceed to billing after confirming.`}
        confirmText="Check-out"
        cancelText="Cancel"
        type="default"
        loading={processing === arrivalToCompleteService?.id}
      />

    </>
  );
};

export default ReceptionistArrivals;

