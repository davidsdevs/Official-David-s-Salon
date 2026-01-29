/**
 * Arrivals & Check-ins Management Page - Receptionist
 * For managing client arrivals and check-ins
 */

import { useState, useEffect, useMemo, useRef } from 'react';
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
  Receipt as ReceiptIcon,
  Eye,
  Ban
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
import { formatCurrency } from '../../utils/helpers';
import { createBill } from '../../services/billingService';
import BillingModalPOS from '../../components/billing/BillingModalPOS';
import Receipt from '../../components/billing/Receipt';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import { thermalPrinter } from '../../services/thermalPrinterService';
import toast from 'react-hot-toast';

const ReceptionistArrivals = () => {
  const { currentUser, userBranch, userData } = useAuth();
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
  const [showDateFilter, setShowDateFilter] = useState(false);

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
  const [branchData, setBranchData] = useState(null);
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
  
  // Void service state
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [arrivalToVoid, setArrivalToVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  
  // Receipt modal state - shown after billing modal closes
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedBill, setCompletedBill] = useState(null);
  const [showReprintConfirm, setShowReprintConfirm] = useState(false);
  const [reprintingReceipt, setReprintingReceipt] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    console.log('🔄 useEffect triggered, userBranch:', userBranch, 'type:', typeof userBranch);
    
    if (userBranch && typeof userBranch === 'string' && userBranch.trim() !== '') {
      console.log('🏪 Branch loaded, ARRIVAL_STATUS constants:', ARRIVAL_STATUS);
      fetchArrivals();
      fetchServicesAndStylists();
      fetchBranchData();
    } else {
      console.log('⚠️ useEffect skipped - userBranch not ready:', userBranch);
      setLoading(false);
    }
  }, [userBranch]);

  const fetchBranchData = async () => {
    if (!userBranch) return;
    try {
      const { getBranchById } = await import('../../services/branchService');
      const branch = await getBranchById(userBranch);
      setBranchData(branch);
      console.log('✅ Fetched branch data:', branch);
    } catch (error) {
      console.error('Error fetching branch data:', error);
    }
  };

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

  // Handle reprint receipt via Bluetooth thermal printer
  const handleReprintReceipt = async () => {
    if (!completedBill) return;
    
    try {
      setReprintingReceipt(true);
      
      // Check if printer is connected
      if (!thermalPrinter.isConnected) {
        toast.error('Printer not connected. Please pair your printer first.');
        setShowReprintConfirm(false);
        return;
      }
      
      // Prepare bill data for printing
      const billData = {
        ...completedBill,
        receiptNumber: completedBill.receiptNumber || 'N/A',
        createdAt: completedBill.createdAt,
        createdByName: completedBill.createdByName || userData?.firstName || 'Staff',
        clientName: completedBill.clientName || 'Guest',
        items: completedBill.items || [],
        subtotal: completedBill.subtotal || 0,
        discount: completedBill.discount || 0,
        promotionDiscount: completedBill.promotionDiscount || 0,
        loyaltyDiscount: completedBill.loyaltyDiscount || 0,
        total: completedBill.total || completedBill.grandTotal || 0,
        paymentMethod: completedBill.paymentMethod || 'cash',
        amountReceived: completedBill.amountReceived || 0,
        change: completedBill.change || 0
      };
      
      await thermalPrinter.printReceipt(billData, branchData);
      toast.success('Receipt printed successfully!');
      setShowReprintConfirm(false);
    } catch (error) {
      console.error('Error reprinting receipt:', error);
      toast.error('Failed to print receipt: ' + error.message);
    } finally {
      setReprintingReceipt(false);
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
      
      // Ensure branch name is available - fetch if not loaded
      let finalBranchName = pendingWalkInData.branchName || branchData?.name || branchData?.branchName;
      if (!finalBranchName || finalBranchName === 'Unknown Branch') {
        try {
          const { getBranchById } = await import('../../services/branchService');
          const branch = await getBranchById(userBranch);
          finalBranchName = branch?.name || branch?.branchName || 'Unknown Branch';
          console.log('✅ Fetched branch name on-demand:', finalBranchName);
        } catch (error) {
          console.error('Error fetching branch name:', error);
          finalBranchName = 'Unknown Branch';
        }
      }
      
      // Create walk-in arrival with ARRIVED status
      const firstService = pendingWalkInData.items.find(item => item.type === 'service');
      const walkInArrival = {
        clientId: pendingWalkInData.clientId || null,
        clientName: pendingWalkInData.clientName.trim(),
        clientPhone: pendingWalkInData.clientPhone || '',
        clientEmail: pendingWalkInData.clientEmail || '',
        branchId: userBranch,
        branchName: finalBranchName,
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

      console.log('🏪 Creating walk-in arrival with branchName:', walkInArrival.branchName, 'sources:', {
        pendingBranchName: pendingWalkInData.branchName,
        branchDataName: branchData?.name,
        userBranch: userBranch
      });
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
          branchId: userBranch,
          branchName: formData.branchName || branchData?.name || '',
          services: formData.items
            .filter(item => item.type === 'service')
            .map(item => ({
              serviceId: item.serviceId || item.id || null, // Support both serviceId and id
              serviceName: item.name || '',
              price: item.price || 0,
              duration: item.duration || 30, // Add duration
              quantity: item.quantity || 1, // Add quantity - FIX: was missing!
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
          quantity: 1, // Default quantity for legacy data
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
      console.log('💰 Opening billing modal with services:', arrivalForBilling.services);
      console.log('💰 arrivalToCompleteService.services:', arrivalToCompleteService.services);
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
      
      // Create the bill and get the transaction ID
      const transactionId = await createBill(billData, currentUser);
      
      // Update arrival status to COMPLETED after successful payment
      if (arrivalToBill && arrivalToBill.arrivalId) {
        await updateArrivalStatus(arrivalToBill.arrivalId, ARRIVAL_STATUS.COMPLETED, currentUser);
      }
      
      // Refresh arrivals
      await fetchArrivals();
      
      toast.success('Payment processed successfully!');
      
      // Return the bill data with the ID so receipt can be displayed
      return {
        ...billData,
        id: transactionId,
        createdByName: currentUser?.displayName || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'Staff'
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
      throw error; // Re-throw so BillingModalPOS knows it failed
    } finally {
      setProcessingBilling(false);
    }
  };

  // Void service handlers
  const handleVoidService = (arrival) => {
    setArrivalToVoid(arrival);
    setVoidReason('');
    setManagerPassword('');
    setPasswordError('');
    setShowVoidModal(true);
  };

  const confirmVoidService = async () => {
    if (!arrivalToVoid || !voidReason.trim()) {
      toast.error('Please provide a reason for voiding');
      return;
    }
    
    if (!managerPassword.trim()) {
      setPasswordError('Branch manager password is required');
      return;
    }
    
    try {
      setVerifyingPassword(true);
      setPasswordError('');
      
      console.log('🔐 Verifying manager password');
      console.log('📍 Current userBranch:', userBranch);
      console.log('👤 Current user:', currentUser?.email);
      
      // Get branch managers for this branch
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const usersRef = collection(db, 'users');
      
      // First, let's check ALL users in this branch
      const allBranchUsersQuery = query(
        usersRef,
        where('branchId', '==', userBranch)
      );
      const allBranchUsersSnapshot = await getDocs(allBranchUsersQuery);
      console.log('👥 Total users in branch:', allBranchUsersSnapshot.size);
      allBranchUsersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log('  - User:', data.email, 'Role:', data.role, 'BranchId:', data.branchId);
      });
      
      // Now check for branch managers
      const managersQuery = query(
        usersRef,
        where('branchId', '==', userBranch),
        where('role', '==', 'branchManager')  // Changed from 'branch_manager' to 'branchManager'
      );
      const managersSnapshot = await getDocs(managersQuery);
      
      console.log('👔 Found branch managers:', managersSnapshot.size);
      
      if (managersSnapshot.empty) {
        setPasswordError('No branch manager found for this branch');
        setVerifyingPassword(false);
        return;
      }
      
      // Verify password against any branch manager's rolePasswords.branchManager
      let passwordValid = false;
      let managerName = '';
      const bcrypt = await import('bcryptjs');
      
      for (const managerDoc of managersSnapshot.docs) {
        const managerData = managerDoc.data();
        console.log('🔍 Checking manager:', managerData.email);
        console.log('   Has rolePasswords:', !!managerData.rolePasswords);
        console.log('   rolePasswords:', managerData.rolePasswords);
        console.log('   Has branchManager password:', !!managerData.rolePasswords?.branchManager);
        
        const hashedPassword = managerData.rolePasswords?.branchManager;  // Changed from branch_manager to branchManager
        
        if (hashedPassword) {
          const isMatch = await bcrypt.compare(managerPassword, hashedPassword);
          console.log('   Password match:', isMatch);
          if (isMatch) {
            passwordValid = true;
            managerName = `${managerData.firstName || ''} ${managerData.lastName || ''}`.trim() || managerData.email;
            break;
          }
        } else {
          console.log('   ⚠️ Manager has no rolePasswords.branchManager field');
        }
      }
      
      if (!passwordValid) {
        console.log('❌ Password validation failed');
        setPasswordError('Invalid branch manager password');
        setVerifyingPassword(false);
        return;
      }
      
      console.log('✅ Password verified, voiding service...');
      setVerifyingPassword(false);
      setProcessing(arrivalToVoid.id);
      
      // Update arrival status to VOIDED
      const arrivalRef = doc(db, 'arrivals', arrivalToVoid.id);
      await updateDoc(arrivalRef, {
        status: 'voided',
        voidedAt: serverTimestamp(),
        voidedBy: currentUser.uid,
        voidedByName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || currentUser.email,
        approvedByManager: managerName,
        voidReason: voidReason.trim(),
        updatedAt: serverTimestamp()
      });
      
      // If linked to an appointment, update appointment status too
      if (arrivalToVoid.appointmentId) {
        const appointmentRef = doc(db, 'appointments', arrivalToVoid.appointmentId);
        await updateDoc(appointmentRef, {
          status: 'voided',
          voidedAt: serverTimestamp(),
          voidedBy: currentUser.uid,
          approvedByManager: managerName,
          voidReason: voidReason.trim(),
          updatedAt: serverTimestamp()
        });
      }
      
      await fetchArrivals();
      toast.success('Service voided successfully');
      
      setShowVoidModal(false);
      setArrivalToVoid(null);
      setVoidReason('');
      setManagerPassword('');
      setPasswordError('');
    } catch (error) {
      console.error('Error voiding service:', error);
      toast.error('Failed to void service');
      setVerifyingPassword(false);
    } finally {
      setProcessing(null);
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
        
        // Fetch branch name from database if needed
        let displayBranchName = arrivalData.branchName;
        if (!displayBranchName || displayBranchName === 'Unknown Branch') {
          try {
            const { getBranchById } = await import('../../services/branchService');
            const branch = await getBranchById(arrivalData.branchId);
            displayBranchName = branch?.name || branch?.branchName || 'Unknown Branch';
          } catch (error) {
            console.error('Error fetching branch name for display:', error);
            displayBranchName = branchData?.name || branchData?.branchName || 'Unknown Branch';
          }
        }
        
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
          products: productsArray,
          // Ensure branchName is preserved
          branchName: displayBranchName
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

        {/* Search and Filter Row */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <SearchInput
                placeholder="Search by client name, phone, service, or stylist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Date Filter Button - Only for Upcoming Tab */}
            {activeTab === 'upcoming' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                    dateFilter !== 'today' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Filter by date"
                >
                  <Calendar className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {dateFilter === 'today' && 'Today'}
                    {dateFilter === 'tomorrow' && 'Tomorrow'}
                    {dateFilter === 'week' && 'This Week'}
                    {dateFilter === 'custom' && 'Custom'}
                  </span>
                </button>

                {/* Date Filter Dropdown */}
                {showDateFilter && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Filter by Date</h4>
                      <span className="text-xs text-gray-500">{stats.upcoming} appointments</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => { setDateFilter('today'); setShowDateFilter(false); }}
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
                        onClick={() => { setDateFilter('tomorrow'); setShowDateFilter(false); }}
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
                        onClick={() => { setDateFilter('week'); setShowDateFilter(false); }}
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
                      <div className="space-y-3 pt-3 border-t">
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
                        <button
                          type="button"
                          onClick={() => setShowDateFilter(false)}
                          className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'upcoming'
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Upcoming</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'upcoming' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {stats.upcoming}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('arrived')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'arrived'
                  ? 'border-green-500 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Arrived</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'arrived' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {stats.arrived}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('in-service')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'in-service'
                  ? 'border-purple-500 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                <span>In Service</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'in-service' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {stats.inService}
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Arrivals List */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          {/* Arrivals Content */}
          <div className="p-4 space-y-3">
            {filteredArrivals.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {activeTab === 'upcoming' && 'No upcoming appointments'}
                  {activeTab === 'arrived' && 'No clients have arrived yet'}
                  {activeTab === 'in-service' && 'No appointments in service'}
                </p>
              </div>
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
                        
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                          {arrival.isUpcoming && arrival.appointmentDate && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              <span>Appointment: {formatTime(arrival.appointmentDate)}</span>
                              {timeUntil && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  timeUntil.includes('late') ? 'bg-red-100 text-red-600' : 
                                  timeUntil.includes('in') && parseInt(timeUntil) < 30 ? 'bg-green-100 text-green-600' : 
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {timeUntil}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {!arrival.isUpcoming && arrival.arrivedAt && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-2.5 w-2.5 text-green-500" />
                              <span>Arrived: {formatTime(arrival.arrivedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Button
                        onClick={() => handleViewDetails(arrival)}
                        disabled={loadingDetails}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-600 hover:bg-gray-700"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                      
                      {activeTab === 'upcoming' && arrival.isUpcoming === true && arrival.status === APPOINTMENT_STATUS.CONFIRMED && (
                        <Button
                          onClick={() => handleCheckIn(arrival)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          Check In
                        </Button>
                      )}
                      
                      {activeTab === 'arrived' && (
                        <Button
                          onClick={() => handleStartService(arrival)}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700"
                        >
                          <Play className="h-4 w-4" />
                          Start Service
                        </Button>
                      )}
                      
                      {activeTab === 'in-service' && (
                        <>
                          <Button
                            onClick={() => handleVoidService(arrival)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700"
                          >
                            <Ban className="h-4 w-4" />
                            Void
                          </Button>
                          <Button
                            onClick={() => handleCompleteService(arrival)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700"
                          >
                            <ReceiptIcon className="h-4 w-4" />
                            Check-out
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
          </div>
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
          onClose={(billData) => {
            if (!processingBilling) {
              setShowBillingModal(false);
              setArrivalToBill(null);
              // Reset processing state when modal is closed so checkout button can be clicked again
              setProcessing(null);
              
              // If bill data is passed, show the receipt modal
              if (billData && billData.id) {
                setCompletedBill(billData);
                setShowReceiptModal(true);
              }
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

      {/* Receipt Modal - Shown after billing modal closes */}
      {showReceiptModal && completedBill && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-green-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Payment Successful!</h3>
                  <p className="text-sm text-gray-600">Transaction #{completedBill.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  setCompletedBill(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div ref={receiptRef}>
                <Receipt bill={completedBill} branch={branchData} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  const bill = completedBill;
                  const branch = branchData;
                  
                  // Get services and products from items
                  const services = bill.items?.filter(item => item.type === 'service') || [];
                  const products = bill.items?.filter(item => item.type === 'product') || [];
                  
                  // Format date
                  const formatDate = (date) => {
                    if (!date) return 'N/A';
                    const d = date.toDate ? date.toDate() : new Date(date);
                    return d.toLocaleString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });
                  };

                  // Get client type label
                  const getClientTypeLabel = (type) => {
                    switch(type) {
                      case 'X': return 'New';
                      case 'R': return 'Regular';
                      case 'TR': return 'Transfer';
                      default: return type || 'Regular';
                    }
                  };

                  // Build services HTML
                  let servicesHtml = '';
                  services.forEach(service => {
                    const qty = service.quantity > 1 ? ` x${service.quantity}` : '';
                    const price = (service.price * (service.quantity || 1)).toFixed(2);
                    servicesHtml += `
                      <div class="item">
                        <div class="item-name">${service.name}${qty}</div>
                        <div class="item-price">₱${price}</div>
                      </div>
                      ${service.stylistName ? `<div class="item-detail">Stylist: ${service.stylistName}</div>` : ''}
                      ${service.clientType ? `<div class="item-detail">Client Type: ${getClientTypeLabel(service.clientType)}</div>` : ''}
                      ${service.adjustment && service.adjustment !== 0 ? `<div class="item-detail">Adjustment: ${service.adjustment > 0 ? '+' : ''}${formatCurrency(service.adjustment)}${service.adjustmentReason ? ` (${service.adjustmentReason})` : ''}</div>` : ''}
                    `;
                  });

                  // Build products HTML
                  let productsHtml = '';
                  products.forEach(product => {
                    const qty = product.quantity > 1 ? ` x${product.quantity}` : '';
                    const price = (product.price * (product.quantity || 1)).toFixed(2);
                    productsHtml += `
                      <div class="item">
                        <div class="item-name">${product.name}${qty}</div>
                        <div class="item-price">₱${price}</div>
                      </div>
                    `;
                  });

                  // Build service product charges HTML
                  let serviceProductChargesHtml = '';
                  if (bill.serviceProductCharges && bill.serviceProductCharges.length > 0) {
                    serviceProductChargesHtml = `<div class="section-title">SERVICE PRODUCT USAGE</div>`;
                    bill.serviceProductCharges.forEach(charge => {
                      serviceProductChargesHtml += `
                        <div class="item">
                          <div class="item-name">${charge.productName}</div>
                          <div class="item-price">${formatCurrency(charge.charge || 0)}</div>
                        </div>
                        <div class="item-detail">${charge.usageDisplay || ''}</div>
                      `;
                    });
                  }

                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>Receipt - ${bill.receiptNumber || 'Transaction'}</title>
                      <style>
                        @page {
                          size: 58mm auto;
                          margin: 0;
                        }
                        * { 
                          margin: 0; 
                          padding: 0; 
                          box-sizing: border-box; 
                        }
                        html, body {
                          width: 58mm;
                          max-width: 58mm;
                          margin: 0 auto;
                          padding: 3mm;
                          font-family: 'Courier New', 'Lucida Console', monospace;
                          font-size: 8pt;
                          line-height: 1.2;
                          color: #000;
                          background: #fff;
                          -webkit-print-color-adjust: exact;
                          print-color-adjust: exact;
                        }
                        .receipt {
                          width: 100%;
                        }
                        .header {
                          text-align: center;
                          margin-bottom: 2mm;
                          padding-bottom: 2mm;
                          border-bottom: 1px dashed #000;
                        }
                        .salon-logo {
                          width: 35mm;
                          height: auto;
                          margin: 0 auto 2mm auto;
                          display: block;
                          filter: grayscale(100%) contrast(1.2);
                        }
                        .branch-name {
                          font-size: 9pt;
                          margin-bottom: 1mm;
                        }
                        .branch-address {
                          font-size: 7pt;
                          margin-bottom: 2mm;
                        }
                        .receipt-title {
                          font-size: 9pt;
                          font-weight: bold;
                          margin-top: 2mm;
                        }
                        .info-section {
                          margin: 2mm 0;
                          padding: 2mm 0;
                          border-bottom: 1px dashed #000;
                        }
                        .info-row {
                          display: flex;
                          justify-content: space-between;
                          margin: 0.5mm 0;
                          font-size: 7pt;
                        }
                        .info-label {
                          color: #333;
                        }
                        .info-value {
                          font-weight: bold;
                          text-align: right;
                          max-width: 55%;
                          word-break: break-word;
                        }
                        .section-title {
                          font-size: 8pt;
                          font-weight: bold;
                          margin: 2mm 0 1mm 0;
                          text-align: center;
                          border-top: 1px dashed #000;
                          border-bottom: 1px dashed #000;
                          padding: 1mm 0;
                        }
                        .item {
                          display: flex;
                          justify-content: space-between;
                          margin: 1mm 0;
                          font-size: 7pt;
                        }
                        .item-name {
                          flex: 1;
                          word-break: break-word;
                        }
                        .item-price {
                          font-weight: bold;
                          text-align: right;
                          min-width: 12mm;
                        }
                        .item-detail {
                          font-size: 6pt;
                          color: #555;
                          margin-left: 2mm;
                          margin-bottom: 0.5mm;
                        }
                        .totals-section {
                          margin-top: 2mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                        }
                        .total-row {
                          display: flex;
                          justify-content: space-between;
                          margin: 0.5mm 0;
                          font-size: 7pt;
                        }
                        .total-row.grand-total {
                          font-size: 10pt;
                          font-weight: bold;
                          border-top: 1px solid #000;
                          padding-top: 1mm;
                          margin-top: 1mm;
                        }
                        .total-row.discount {
                          color: #006600;
                        }
                        .payment-section {
                          margin-top: 2mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                        }
                        .change-row {
                          font-size: 9pt;
                          font-weight: bold;
                          background: #eee;
                          padding: 1mm;
                          margin: 1mm 0;
                        }
                        .notes-section {
                          margin-top: 2mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                          font-size: 7pt;
                        }
                        .footer {
                          text-align: center;
                          margin-top: 3mm;
                          padding-top: 2mm;
                          border-top: 1px dashed #000;
                          font-size: 7pt;
                        }
                        .footer-thanks {
                          font-size: 8pt;
                          font-weight: bold;
                          margin-bottom: 1mm;
                        }
                        .footer-note {
                          margin: 1mm 0;
                        }
                        .footer-ids {
                          margin-top: 2mm;
                          font-size: 7pt;
                        }
                        @media print {
                          html, body {
                            width: 58mm !important;
                            max-width: 58mm !important;
                            min-width: 58mm !important;
                            padding: 2mm !important;
                            margin: 0 !important;
                          }
                        }
                        @media screen {
                          html, body {
                            background: #f5f5f5;
                          }
                          .receipt {
                            background: #fff;
                            box-shadow: 0 0 10px rgba(0,0,0,0.1);
                            padding: 3mm;
                          }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="receipt">
                        <div class="header">
                          <img src="/logo.jpg" alt="David's Salon" class="salon-logo" />
                          <div class="branch-name">${branch?.name || branch?.branchName || bill.branchName || 'Branch'}</div>
                          ${branch?.address ? `<div class="branch-address">${branch.address}</div>` : ''}
                          <div class="receipt-title">OFFICIAL RECEIPT</div>
                        </div>

                        <div class="info-section">
                          <div class="info-row">
                            <span class="info-label">Receipt No:</span>
                            <span class="info-value">#${bill.receiptNumber || 'N/A'}</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Transaction ID:</span>
                            <span class="info-value">${bill.id || 'N/A'}</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Date:</span>
                            <span class="info-value">${formatDate(bill.createdAt)}</span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Cashier:</span>
                            <span class="info-value">${bill.createdByName || 'Staff'}</span>
                          </div>
                        </div>

                        <div class="info-section">
                          <div class="info-row">
                            <span class="info-label">Customer:</span>
                            <span class="info-value">${bill.clientName || 'Guest'}</span>
                          </div>
                          ${bill.clientPhone ? `
                          <div class="info-row">
                            <span class="info-label">Phone:</span>
                            <span class="info-value">${bill.clientPhone}</span>
                          </div>
                          ` : ''}
                          ${bill.clientEmail ? `
                          <div class="info-row">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${bill.clientEmail}</span>
                          </div>
                          ` : ''}
                        </div>

                        ${services.length > 0 ? `
                        <div class="section-title">SERVICES</div>
                        ${servicesHtml}
                        ` : ''}

                        ${products.length > 0 ? `
                        <div class="section-title">PRODUCTS</div>
                        ${productsHtml}
                        ` : ''}

                        ${serviceProductChargesHtml}

                        <div class="totals-section">
                          <div class="total-row">
                            <span>Subtotal:</span>
                            <span>${formatCurrency((bill.subtotal || 0))}</span>
                          </div>
                          ${bill.serviceProductChargeTotal > 0 ? `
                          <div class="total-row">
                            <span>Product Usage:</span>
                            <span>${formatCurrency(bill.serviceProductChargeTotal)}</span>
                          </div>
                          ` : ''}
                          ${bill.promotionDiscount > 0 ? `
                          <div class="total-row discount">
                            <span>Promo (${bill.promotionCode}):</span>
                            <span>-${formatCurrency(bill.promotionDiscount)}</span>
                          </div>
                          ` : ''}
                          ${bill.discount > 0 ? `
                          <div class="total-row discount">
                            <span>Discount:</span>
                            <span>-${formatCurrency(bill.discount)}</span>
                          </div>
                          ` : ''}
                          ${bill.loyaltyPointsUsed > 0 ? `
                          <div class="total-row discount">
                            <span>Points Used:</span>
                            <span>-${formatCurrency(bill.loyaltyPointsUsed)}</span>
                          </div>
                          ` : ''}
                          <div class="total-row grand-total">
                            <span>TOTAL:</span>
                            <span>${formatCurrency((bill.total || 0))}</span>
                          </div>
                        </div>

                        <div class="payment-section">
                          <div class="total-row">
                            <span>Payment Method:</span>
                            <span>${bill.paymentMethod ? bill.paymentMethod.charAt(0).toUpperCase() + bill.paymentMethod.slice(1) : 'Cash'}</span>
                          </div>
                          ${bill.paymentMethod === 'cash' && bill.amountReceived ? `
                          <div class="total-row">
                            <span>Amount Received:</span>
                            <span>${formatCurrency(bill.amountReceived)}</span>
                          </div>
                          <div class="total-row change-row">
                            <span>Change:</span>
                            <span>${formatCurrency((bill.change || 0))}</span>
                          </div>
                          ` : ''}
                          ${bill.paymentReference ? `
                          <div class="total-row">
                            <span>Reference:</span>
                            <span>${bill.paymentReference}</span>
                          </div>
                          ` : ''}
                        </div>

                        ${bill.notes ? `
                        <div class="notes-section">
                          <strong>Notes:</strong> ${bill.notes}
                        </div>
                        ` : ''}

                        <div class="footer">
                          <div class="footer-thanks">THANK YOU FOR CHOOSING DAVID'S SALON!</div>
                          <div class="footer-note">This serves as your official receipt.</div>
                          <div class="footer-note">Please keep this for your records.</div>
                          <div class="footer-ids">
                            <div>Transaction ID: ${bill.id || 'N/A'}</div>
                            <div>Receipt No: ${bill.receiptNumber || 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                  setTimeout(() => { printWindow.print(); }, 250);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center gap-2"
                title="Open print preview (for PDF/other printers)"
              >
                <Eye className="w-5 h-5" />
                Preview
              </button>
              <button
                type="button"
                onClick={() => setShowReprintConfirm(true)}
                disabled={!thermalPrinter.isConnected}
                className={`flex-1 px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                  thermalPrinter.isConnected 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={thermalPrinter.isConnected ? 'Print via Bluetooth' : 'Printer not connected'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  setCompletedBill(null);
                }}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Confirmation Modal */}
      <ConfirmModal
        isOpen={showReprintConfirm}
        onClose={() => setShowReprintConfirm(false)}
        onConfirm={handleReprintReceipt}
        title="Reprint Receipt"
        message="Are you sure you want to print this receipt again?"
        confirmText={reprintingReceipt ? "Printing..." : "Yes, Print"}
        cancelText="Cancel"
        type="info"
        loading={reprintingReceipt}
      />

      {/* Void Service Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-red-50">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Void Service</h3>
                <p className="text-sm text-gray-600">Requires branch manager approval</p>
              </div>
            </div>
            
            <div className="p-4">
              <p className="text-gray-700 mb-4">
                Are you sure you want to void the service for <strong>{arrivalToVoid?.clientName}</strong>?
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for voiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Enter reason for voiding this service..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch Manager Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={managerPassword}
                  onChange={(e) => {
                    setManagerPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Enter branch manager password..."
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                    passwordError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {passwordError && (
                  <p className="text-sm text-red-600 mt-1">{passwordError}</p>
                )}
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Voided services will be recorded and visible in the Branch Manager's dashboard for tracking purposes.
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex gap-3 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setShowVoidModal(false);
                  setArrivalToVoid(null);
                  setVoidReason('');
                  setManagerPassword('');
                  setPasswordError('');
                }}
                disabled={processing === arrivalToVoid?.id || verifyingPassword}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmVoidService}
                disabled={processing === arrivalToVoid?.id || verifyingPassword || !voidReason.trim() || !managerPassword.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifyingPassword ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Verifying...
                  </>
                ) : processing === arrivalToVoid?.id ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Voiding...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Void Service
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default ReceptionistArrivals;

