/**
 * Client Booking Modal Component
 * Multi-step procedural booking with timeline
 */

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Scissors, User, ChevronRight, ChevronLeft, Check, Plus, Trash2, FileText, AlertTriangle, Eye, Image as ImageIcon, Phone, CheckCircle2, Timer } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { formatTime, formatTime12Hour } from '../../utils/helpers';
import { getPortfoliosByStylist } from '../../services/portfolioService';
import toast from 'react-hot-toast';
import { APPOINTMENT_STATUS } from '../../utils/constants';

const ClientBookingModal = ({
  isOpen,
  onClose,
  bookingData,
  setBookingData,
  branches,
  services,
  stylists,
  availableSlots,
  loadingSlots,
  unavailableMessage,
  booking,
  onSubmit,
  existingAppointments = []
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Service search & filter (for step 2)
  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');

  // Chemical service warning modal
  const [showChemicalWarning, setShowChemicalWarning] = useState(false);
  const [pendingChemicalService, setPendingChemicalService] = useState(null);

  // Stylist selection modal
  const [showStylistModal, setShowStylistModal] = useState(false);
  const [pendingService, setPendingService] = useState(null);
  const [editingServiceIndex, setEditingServiceIndex] = useState(null); // For changing stylist

  // Portfolio modal
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [selectedStylist, setSelectedStylist] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);

  // Final terms confirmation modal
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Reset function when modal closes
  const handleClose = () => {
    setCurrentStep(1);
    setServiceQuery('');
    setServiceFilter('all');
    setBookingData({
      branchId: '',
      services: [], // Array of { serviceId, stylistId }
      date: '',
      timeSlot: null,
      notes: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  // Reset step when modal opens
  if (isOpen && currentStep === 0) {
    setCurrentStep(1);
  }

  const steps = [
    { number: 1, title: 'Branch', icon: MapPin },
    { number: 2, title: 'Date & Time', icon: Calendar },
    { number: 3, title: 'Service & Stylist', icon: Scissors },
    { number: 4, title: 'Review', icon: FileText },
  ];

  const handleNext = () => {
    // Validate current step before proceeding
    if (currentStep === 1 && !bookingData.branchId) {
      return; // Cannot proceed without branch
    }
    if (currentStep === 2 && (!bookingData.date || !bookingData.timeSlot)) {
      return; // Cannot proceed without date and time
    }
    if (currentStep === 3 && (!bookingData.services || bookingData.services.length === 0)) {
      return; // Cannot proceed without at least one service
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Form submitted, currentStep:', currentStep, 'totalSteps:', totalSteps);
    console.log('Event target:', e.target, 'Submitter:', e.nativeEvent?.submitter);
    
    // ONLY show terms modal if we're on the final step (Step 4) AND it's a real submit (from the submit button)
    // Check if the submitter is actually the submit button, not just any form submission
    const isSubmitButton = e.nativeEvent?.submitter?.type === 'submit';
    
    if (currentStep === totalSteps && bookingData.timeSlot && isSubmitButton) {
      console.log('Showing terms modal');
      setShowTermsModal(true);
    } else {
      console.log('Not showing modal - currentStep:', currentStep, 'isSubmitButton:', isSubmitButton);
    }
  };

  const confirmAndSubmit = () => {
    setShowTermsModal(false);
    onSubmit();
  };

  const isStepComplete = (step) => {
    switch (step) {
      case 1: return !!bookingData.branchId;
      case 2: return !!bookingData.date && !!bookingData.timeSlot;
      case 3: return bookingData.services && bookingData.services.length > 0;
      case 4: return false; // Review step is never "complete" until submission
      default: return false;
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1: return !!bookingData.branchId;
      case 2: return !!bookingData.date && !!bookingData.timeSlot;
      case 3: return bookingData.services && bookingData.services.length > 0;
      case 4: return !!bookingData.timeSlot;
      default: return false;
    }
  };

  // Helper to toggle service selection
  const toggleService = (service) => {
    const exists = bookingData.services?.some(s => s.serviceId === service.id);
    let newServices = bookingData.services ? [...bookingData.services] : [];
    if (exists) {
      newServices = newServices.filter(s => s.serviceId !== service.id);
      setBookingData({ ...bookingData, services: newServices });
    } else {
      // Check if service is chemical and show warning
      if (service.isChemical) {
        setPendingChemicalService(service);
        setShowChemicalWarning(true);
        return;
      }
      // Show stylist selection modal
      setPendingService(service);
      setShowStylistModal(true);
    }
  };

  // Confirm adding chemical service
  const confirmChemicalService = () => {
    if (pendingChemicalService) {
      // After confirming chemical warning, show stylist selection
      setPendingService(pendingChemicalService);
      setShowStylistModal(true);
    }
    setShowChemicalWarning(false);
    setPendingChemicalService(null);
  };

  // Confirm stylist selection and add service
  const confirmStylistSelection = (stylistId) => {
    if (editingServiceIndex !== null) {
      // Changing stylist for existing service
      const newServices = [...(bookingData.services || [])];
      newServices[editingServiceIndex] = { ...newServices[editingServiceIndex], stylistId: stylistId || '' };
      setBookingData({ ...bookingData, services: newServices });
      setEditingServiceIndex(null);
    } else if (pendingService) {
      // Adding new service
      const newServices = bookingData.services ? [...bookingData.services] : [];
      newServices.push({ serviceId: pendingService.id, stylistId: stylistId || '', quantity: 1 });
      setBookingData({ ...bookingData, services: newServices });
    }
    setShowStylistModal(false);
    setPendingService(null);
  };

  // Get stylists for a specific service
  const getStylistsForService = (service) => {
    if (!service) return [];
    // Filter stylists based on their service_id array - only show stylists who can perform this service
    const filteredStylists = stylists.filter(stylist => {
      // Check if stylist has service_id array and it includes this service
      if (stylist.service_id && Array.isArray(stylist.service_id)) {
        return stylist.service_id.includes(service.id);
      }
      // If no service_id array, exclude them (they haven't been assigned any services)
      return false;
    });
    // If no stylists found, return all stylists as fallback
    return filteredStylists.length > 0 ? filteredStylists : stylists;
  };

  // Get current quantity of a selected service
  const getServiceQuantity = (serviceId) => {
    const service = bookingData.services?.find(s => s.serviceId === serviceId);
    return service?.quantity || 0;
  };

  // Update quantity for a service
  const updateServiceQuantity = (serviceId, delta) => {
    const newServices = [...(bookingData.services || [])];
    const index = newServices.findIndex(s => s.serviceId === serviceId);
    if (index !== -1) {
      const newQuantity = Math.max(1, (newServices[index].quantity || 1) + delta);
      newServices[index] = { ...newServices[index], quantity: newQuantity };
      setBookingData({ ...bookingData, services: newServices });
    }
  };

  // Helper to produce a short hours string for a branch (finds first open day)
  const getShortHours = (branch) => {
    try {
      const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const hours = branch?.operatingHours;
      if (!hours) return 'Hours not set';
      for (let day of days) {
        const d = hours[day];
        if (d && d.isOpen) {
          return `${formatTime12Hour(d.open || '09:00')} - ${formatTime12Hour(d.close || '18:00')}`;
        }
      }
      return 'Closed';
    } catch (e) {
      return 'Hours not set';
    }
  };

  const handleBranchKeyDown = (e, branchId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setBookingData({
        ...bookingData,
        branchId,
        services: [],
        date: '',
        timeSlot: null
      });
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Branch Selection
  return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Branch</h3>
              <p className="text-sm text-gray-600">Choose the salon branch where you'd like to book your appointment</p>
          </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Branch <span className="text-red-500">*</span>
              </label>

              {/* Branch cards - 3x3 responsive grid with vertical overflow when many branches */}
              <div className="max-h-[420px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
                <div role="radiogroup" aria-label="Select branch" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {branches.map(branch => {
                    const isSelected = bookingData.branchId === branch.id;
                    const phone = branch.contact || branch.phone || branch.phoneNumber || 'N/A';
                    const hoursShort = getShortHours(branch);
                    return (
                      <button
                        key={branch.id}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`Select ${branch.name || branch.branchName}`}
                        tabIndex={0}
                        type="button"
                        onKeyDown={(e) => handleBranchKeyDown(e, branch.id)}
                        onClick={() => setBookingData({
                          ...bookingData,
                          branchId: branch.id,
                          services: [],
                          date: '',
                          timeSlot: null
                        })}
                        className={`w-full p-4 rounded-lg text-left transition-all flex flex-col items-start gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#160B53] ${isSelected ? 'border-4 border-[#160B53] bg-white shadow-lg' : 'border-2 border-gray-200 bg-white hover:shadow-md hover:border-[#160B53]'}`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className={`p-2 rounded-md flex-shrink-0 ${isSelected ? 'bg-[#160B53]' : 'bg-[#160B53]/10'}`}>
                            <MapPin className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-[#160B53]'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${isSelected ? 'text-[#160B53]' : 'text-gray-900'}`}>{branch.name || branch.branchName}</p>
                            {branch.address && (
                              <p className={`text-sm mt-1 truncate text-gray-500`}>{branch.address}</p>
                            )}
                          </div>
                        </div>

                        <div className="w-full flex items-center justify-between text-sm">
                          <div className="text-gray-600">
                            <div className="font-medium">{phone}</div>
                            <div className="text-xs mt-0.5">Hours: <span className="font-medium">{hoursShort}</span></div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Date and Time Selection
        // New: Show 30-minute interval boxes within branch open hours
        const selectedBranch = branches.find(b => b.id === bookingData.branchId);
        let openTime = '09:00', closeTime = '18:00', isOpen = true;
        if (selectedBranch && bookingData.date) {
          const weekday = new Date(bookingData.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const hours = selectedBranch.operatingHours?.[weekday];
          if (hours) {
            openTime = hours.open || '09:00';
            closeTime = hours.close || '18:00';
            isOpen = hours.isOpen !== false;
          }
        }
        // Helper to get min time (2 hours from now if today)
        let minTime = openTime;
        if (bookingData.date) {
          const today = new Date();
          if (today.toISOString().split('T')[0] === bookingData.date) {
            const nowPlus2 = new Date(today.getTime() + 2 * 60 * 60 * 1000);
            const min = nowPlus2.getHours().toString().padStart(2, '0') + ':' + nowPlus2.getMinutes().toString().padStart(2, '0');
            if (min > openTime) minTime = min;
          }
        }
        // Generate 30-min interval boxes
        function getTimeBoxes(start, end, min) {
          const boxes = [];
          let [h, m] = start.split(':').map(Number);
          const [endH, endM] = end.split(':').map(Number);
          const minHM = min.split(':').map(Number);
          while (h < endH || (h === endH && m < endM)) {
            const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            // Only allow times >= minTime
            if (h > minHM[0] || (h === minHM[0] && m >= minHM[1])) {
              boxes.push(timeStr);
            }
            m += 30;
            if (m >= 60) { h += 1; m = 0; }
          }
          return boxes;
        }
        const timeBoxes = (bookingData.date && isOpen) ? getTimeBoxes(openTime, closeTime, minTime) : [];
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Date & Time</h3>
              <p className="text-sm text-gray-600">Choose your preferred appointment date and time</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    
                    // Check if client already has an appointment on this date
                    if (selectedDate && existingAppointments.length > 0) {
                      const selected = new Date(selectedDate);
                      const startOfDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
                      const endOfDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 23, 59, 59);
                      
                      const duplicateAppointment = existingAppointments.find(apt => {
                        const aptDate = new Date(apt.appointmentDate);
                        return aptDate >= startOfDay && 
                               aptDate <= endOfDay && 
                               apt.status !== APPOINTMENT_STATUS.CANCELLED && 
                               apt.status !== APPOINTMENT_STATUS.COMPLETED;
                      });

                      if (duplicateAppointment) {
                        toast.error('You already have an appointment on this date. Please choose a different date.');
                        return; // Don't update the date
                      }
                    }
                    
                    setBookingData({ ...bookingData, date: selectedDate, timeSlot: null });
                  }}
                  min={(() => {
                    const now = new Date();
                    
                    // Get today's operating hours to check closing time
                    const todayWeekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    const todayHours = selectedBranch?.operatingHours?.[todayWeekday];
                    const todayCloseTime = todayHours?.close || '18:00';
                    
                    // Check if branch is already closed for today
                    const [closeH, closeM] = todayCloseTime.split(':').map(Number);
                    const closingTime = new Date(now);
                    closingTime.setHours(closeH, closeM, 0, 0);
                    
                    // If current time is past closing time, disable today
                    if (now >= closingTime) {
                      const tomorrow = new Date(now);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const year = tomorrow.getFullYear();
                      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
                      const day = String(tomorrow.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    }
                    
                    // Check if there's enough time to book (2-hour minimum before closing)
                    const nowPlus2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                    if (nowPlus2Hours >= closingTime) {
                      const tomorrow = new Date(now);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const year = tomorrow.getFullYear();
                      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
                      const day = String(tomorrow.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    }
                    
                    // Otherwise, allow booking for today
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  })()}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-base transition-colors bg-white"
                  required
                />
                <p className="text-xs text-gray-500 mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2">
                  ℹ️ Bookings must be made at least 2 hours in advance
                </p>
              </div>
              {/* Time Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Time <span className="text-red-500">*</span>
                </label>
                {!bookingData.date ? (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 text-center">
                    Please select a date first
                  </div>
                ) : !isOpen ? (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 text-center shadow-sm">
                    <p className="text-base text-amber-900 font-semibold">Branch is closed on this day</p>
                  </div>
                ) : timeBoxes.length === 0 ? (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 text-center shadow-sm">
                    <p className="text-base text-amber-900 font-semibold">No available times for this day</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto p-2">
                    {timeBoxes.map((time, idx) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setBookingData({ ...bookingData, timeSlot: { time, available: true } })}
                        className={`px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                          bookingData.timeSlot?.time === time
                            ? 'bg-gradient-to-br from-[#160B53] to-[#2D1B69] text-white border-[#160B53] shadow-lg'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-[#160B53] hover:shadow-md hover:bg-[#160B53]/5'
                        }`}
                      >
                        {formatTime12Hour(time)}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">Open hours: {formatTime12Hour(openTime)} - {formatTime12Hour(closeTime)}</p>
              </div>
            </div>
          </div>
        );

      case 3: // Service and Stylist Selection
        // Filter services by selected branch (if available) and search/filter
        const availableServices = (services || []).filter(s => {
          if (serviceFilter === 'chemical' && !s.isChemical) return false;
          if (serviceFilter === 'nonchemical' && s.isChemical) return false;
          if (serviceQuery && !(s.serviceName || s.name || '').toLowerCase().includes(serviceQuery.toLowerCase())) return false;
          return true;
        });

        // Helper: get stylists who offer this service
        const getStylistsForService = (svc) => {
          if (!svc.stylists || svc.stylists.length === 0) return stylists;
          return stylists.filter(stylist => svc.stylists.includes(stylist.id));
        };

        // Helper: calculate total and breakdown
        const getServiceTotal = (si) => {
          const svc = services.find(s => s.id === si.serviceId);
          const price = svc?.branchPricing?.[bookingData.branchId] || svc?.price || 0;
          return price * (si.quantity || 1);
        };
        const total = (bookingData.services || []).reduce((sum, si) => sum + getServiceTotal(si), 0);

        return (
          <div className="space-y-6 pb-2">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Services & Stylists</h3>
              <p className="text-sm text-gray-600">Choose services, assign stylists, and set quantity</p>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-2 items-center">
              <input
                type="search"
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                placeholder="Search services..."
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-base bg-white"
                aria-label="Search services"
              />
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="w-40 px-3 py-2 border-2 border-gray-300 rounded-lg bg-white text-sm"
                aria-label="Filter services"
              >
                <option value="all">All</option>
                <option value="chemical">Chemical</option>
                <option value="nonchemical">Non-chemical</option>
              </select>
            </div>

            {/* Services Grid */}
            <div className="max-h-[360px] overflow-y-auto grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3" style={{ WebkitOverflowScrolling: 'touch' }}>
              {availableServices.map((svc) => {
                const isSelected = bookingData.services?.some(s => s.serviceId === svc.id);
                const currentQuantity = getServiceQuantity(svc.id);
                return (
                  <div
                    key={svc.id}
                    className={`p-4 rounded-lg transition-all flex flex-col gap-2 ${isSelected ? 'border-4 border-[#160B53] shadow-lg bg-white' : 'bg-white border-2 border-gray-200 hover:shadow-md hover:border-gray-300'}`}
                  >
                    <div 
                      onClick={() => !isSelected && toggleService(svc)}
                      className={!isSelected ? 'cursor-pointer' : ''}
                    >
                      <div className="w-full flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold truncate text-gray-900">{svc.serviceName || svc.name}</p>
                          <p className="text-sm mt-1 text-gray-500">{svc.description ? (svc.description.length > 60 ? svc.description.slice(0,57) + '...' : svc.description) : ''}</p>
                        </div>
                        <div className="flex-shrink-0 text-sm font-semibold ml-2 text-gray-900">
                          {svc.price ? `₱${svc.branchPricing?.[bookingData.branchId] || svc.price?.toLocaleString()}` : '—'}
                        </div>
                      </div>
                      <div className="w-full flex items-center justify-between text-xs mt-2">
                        <div className="text-gray-500">{svc.isChemical ? '⚠️ Chemical' : '✓ Non-chemical'}</div>
                        {svc.duration && <div className="text-gray-500">{svc.duration} min</div>}
                      </div>
                    </div>
                    
                    {/* Quantity Controls - shown when selected */}
                    {isSelected && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <span className="text-xs font-medium text-gray-600 flex-1">Quantity:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateServiceQuantity(svc.id, -1);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                          >
                            <span className="text-lg leading-none">−</span>
                          </button>
                          <span className="text-sm font-semibold text-gray-900 min-w-[1.5rem] text-center">{currentQuantity}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateServiceQuantity(svc.id, 1);
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#160B53] hover:bg-[#1a0f63] text-white transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleService(svc);
                            }}
                            className="ml-1 w-7 h-7 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                            title="Remove service"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {availableServices.length === 0 && (
                <div className="col-span-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-gray-600">No services found</div>
              )}
            </div>

            {/* Selected Services Breakdown - Compact 3-column cards */}
            {(bookingData.services || []).length > 0 && (
              <div className="border-2 border-[#160B53] rounded-xl p-4 bg-gradient-to-br from-[#160B53]/5 to-[#2D1B69]/5">
                <h4 className="text-base font-bold text-[#160B53] mb-3 flex items-center gap-2">
                  <Scissors className="w-5 h-5" />
                  Selected Services ({bookingData.services.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(bookingData.services || []).map((serviceItem, index) => {
                    const service = services.find(s => s.id === serviceItem.serviceId);
                    const stylist = stylists.find(s => s.id === serviceItem.stylistId);
                    const price = service?.branchPricing?.[bookingData.branchId] || service?.price || 0;
                    const itemTotal = price * (serviceItem.quantity || 1);
                    
                    return (
                      <div key={index} className="bg-white rounded-lg border-2 border-gray-200 p-3 hover:border-[#160B53]/30 transition-colors flex flex-col">
                        {/* Service Header */}
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-900 truncate mb-1">
                            {service?.serviceName || service?.name || 'Service'}
                          </p>
                          
                          {serviceItem.quantity > 1 && (
                            <p className="text-xs text-gray-500 mb-2">Qty: {serviceItem.quantity}</p>
                          )}
                          
                          <p className="text-lg font-bold text-[#160B53] mb-2">₱{itemTotal.toLocaleString()}</p>
                          
                          <div className="flex items-center gap-1.5 mb-3">
                            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <p className="text-xs text-gray-600 truncate">
                              {stylist 
                                ? `${stylist.firstName} ${stylist.lastName}`
                                : 'Any available'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Action Buttons - Stacked */}
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const svc = services.find(s => s.id === serviceItem.serviceId);
                              if (svc) {
                                setPendingService(svc);
                                setEditingServiceIndex(index);
                                setShowStylistModal(true);
                              }
                            }}
                            className="w-full px-2 py-1.5 text-xs font-medium bg-[#160B53] text-white rounded hover:bg-[#1a0f63] transition-colors flex items-center justify-center gap-1"
                          >
                            <User className="w-3.5 h-3.5" />
                            Change Stylist
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newServices = bookingData.services.filter(s => s.serviceId !== serviceItem.serviceId);
                              setBookingData({ ...bookingData, services: newServices });
                            }}
                            className="w-full px-2 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors flex items-center justify-center gap-1"
                            title="Remove service"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Total Amount Summary - Always visible */}
            <div className="mt-4">
              <div className="bg-gradient-to-br from-[#160B53] to-[#2D1B69] rounded-lg p-4 flex justify-between items-center shadow-md">
                <div>
                  <p className="text-white/80 text-sm font-medium">Total Amount</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {(bookingData.services || []).length > 0 
                      ? `${bookingData.services.length} service${bookingData.services.length !== 1 ? 's' : ''} selected`
                      : 'No services selected yet'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-white">₱{total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Review & Notes
        return (
          <div className="space-y-6 pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Booking Summary</h3>
              <p className="text-sm text-gray-600">Review all details before submitting your appointment request</p>
            </div>

            {/* Booking Summary - Enhanced */}
            <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
              <h4 className="text-lg font-bold text-[#160B53] mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-[#160B53] to-[#2D1B69] rounded-full"></div>
                Appointment Details
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                  <div className="p-2 bg-[#160B53]/10 rounded-lg">
                    <MapPin className="w-5 h-5 text-[#160B53]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {branches.find(b => b.id === bookingData.branchId)?.name || branches.find(b => b.id === bookingData.branchId)?.branchName || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Services List */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Services</p>
                  <div className={`grid gap-2 ${(bookingData.services || []).length > 1 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                    {(bookingData.services || []).map((serviceItem, index) => {
                      const service = services.find(s => s.id === serviceItem.serviceId);
                      const stylist = stylists.find(s => s.id === serviceItem.stylistId);
                      return (
                        <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                          <div className="p-2 bg-[#160B53]/10 rounded-lg flex-shrink-0">
                            <Scissors className="w-5 h-5 text-[#160B53]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {service?.serviceName || 'Not selected'}
                            </p>
                            {service?.price && (
                              <p className="text-sm text-[#160B53] font-bold mt-1">
                                ₱{service.price.toLocaleString()}
                              </p>
                            )}
                            {stylist && (
                              <div className="flex items-center gap-2 mt-2">
                                <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <p className="text-xs text-gray-600 truncate">
                                  {stylist.firstName} {stylist.lastName}
                                </p>
                              </div>
                            )}
                            {!stylist && (
                              <p className="text-xs text-gray-500 mt-2 italic">Any available stylist</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                  <div className="p-2 bg-[#160B53]/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-[#160B53]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {bookingData.date ? new Date(bookingData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                  <div className="p-2 bg-[#160B53]/10 rounded-lg">
                    <Clock className="w-5 h-5 text-[#160B53]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Time</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {bookingData.timeSlot ? formatTime12Hour(bookingData.timeSlot.time) : 'N/A'}
                    </p>
                  </div>
                </div>

                {(() => {
                  const totalPrice = (bookingData.services || []).reduce((sum, serviceItem) => {
                    const service = services.find(s => s.id === serviceItem.serviceId);
                    return sum + (service?.price || 0);
                  }, 0);
                  
                  if (totalPrice > 0) {
                    return (
                      <div className="pt-4 mt-4 border-t-2 border-gray-300 flex justify-between items-center bg-gradient-to-r from-[#160B53]/5 to-[#2D1B69]/5 p-4 rounded-lg">
                        <span className="text-base font-bold text-gray-900">Estimated Total</span>
                        <span className="text-2xl font-bold text-[#160B53]">
                          ₱{totalPrice.toLocaleString()}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Notes */}
              <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Special Requests or Notes <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                  onKeyDown={(e) => {
                    // Prevent Enter from submitting the form
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.stopPropagation();
                    }
                  }}
                rows={4}
                placeholder="Any special requests, allergies, or notes for the stylist..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none transition-colors"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white shadow-2xl w-full h-full sm:w-[96%] sm:h-auto md:w-[90%] lg:w-[85%] xl:w-[80%] max-w-[1200px] sm:rounded-xl rounded-none max-h-[96vh] overflow-hidden flex flex-col" style={{ maxHeight: '96vh' }}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-white">Book Appointment</h2>
              <p className="text-xs text-blue-100 mt-1">Step {currentStep} of {totalSteps}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={booking}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Step Timeline - Enhanced */}
          <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 px-4 sm:px-6 py-5 flex-shrink-0">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.number;
                const isComplete = isStepComplete(step.number);
                const isPast = currentStep > step.number;

                return (
                  <div key={step.number} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1 relative z-10">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all shadow-md ${
                        isActive
                          ? 'bg-gradient-to-br from-[#160B53] to-[#2D1B69] border-[#160B53] text-white scale-110'
                          : isComplete || isPast
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}>
                        {isComplete && !isActive ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>
                      <span className={`text-xs mt-2 text-center font-medium ${
                        isActive 
                          ? 'font-semibold text-[#160B53]' 
                          : isComplete || isPast
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                        isPast || isComplete 
                          ? 'bg-gradient-to-r from-green-500 to-green-400' 
                          : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto" style={{ 
            maxHeight: 'calc(95vh - 280px)',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin'
          }}>
            <div className="p-4 sm:p-6 min-h-full">
              {renderStepContent()}
            </div>
          </div>

          {/* Footer - Navigation Buttons - Enhanced */}
          <div className="bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center gap-3 flex-shrink-0 shadow-lg">
            <div className="flex gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={booking}
                  className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={booking}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
              >
                Cancel
              </button>
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceedToNext() || booking}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-md hover:shadow-lg"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
            <button
              type="button"
                  onClick={() => {
                    if (bookingData.timeSlot && !booking) {
                      console.log('Submit button clicked - showing terms modal');
                      setShowTermsModal(true);
                    }
                  }}
                  disabled={!bookingData.timeSlot || booking}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-md hover:shadow-lg"
            >
              {booking && <LoadingSpinner size="sm" />}
              {booking ? 'Submitting...' : 'Submit Appointment Request'}
            </button>
              )}
            </div>
          </div>
        </form>
      </div>
      {/* Stylist Selection Modal */}
      {showStylistModal && pendingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full overflow-hidden">
            {/* Header */}
            <div className="bg-[#160B53] p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Scissors className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Select Stylist</h3>
                  <p className="text-white/80 text-sm mt-0.5">{pendingService?.serviceName || pendingService?.name}</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Choose a stylist for this service:
              </p>
              
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {getStylistsForService(pendingService).map(stylist => (
                  <div key={stylist.id} className="w-full flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmStylistSelection(stylist.id)}
                      className="flex-1 p-4 border-2 border-gray-200 rounded-lg hover:border-[#160B53] hover:bg-[#160B53]/5 transition-all text-left flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#160B53] to-[#2D1B69] flex items-center justify-center text-white font-semibold group-hover:scale-110 transition-transform">
                        {(stylist.firstName?.[0] || stylist.name?.[0] || 'S').toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {stylist.firstName && stylist.lastName 
                            ? `${stylist.firstName} ${stylist.lastName}` 
                            : stylist.name || 'Stylist'}
                        </p>
                        {stylist.specialization && (
                          <p className="text-xs text-gray-500 mt-0.5">{stylist.specialization}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#160B53]" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setSelectedStylist(stylist);
                        setShowPortfolioModal(true);
                        setLoadingPortfolios(true);
                        try {
                          const portfolioData = await getPortfoliosByStylist(stylist.id);
                          setPortfolios(portfolioData.filter(p => p.status === 'approved'));
                        } catch (error) {
                          console.error('Error loading portfolios:', error);
                          setPortfolios([]);
                        } finally {
                          setLoadingPortfolios(false);
                        }
                      }}
                      className="px-3 py-2 border-2 border-[#160B53] rounded-lg hover:bg-[#160B53] text-[#160B53] hover:text-white transition-all flex items-center justify-center gap-1 group"
                      title="View Portfolio"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-xs font-medium">Portfolio</span>
                    </button>
                  </div>
                ))}
                
                {/* No preference option */}
                <button
                  type="button"
                  onClick={() => confirmStylistSelection('')}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#160B53] hover:bg-[#160B53]/5 transition-all text-left flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-[#160B53]/10 transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-700">No Preference</p>
                    <p className="text-xs text-gray-500 mt-0.5">Any available stylist</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#160B53]" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => {
                  setShowStylistModal(false);
                  setPendingService(null);
                  setEditingServiceIndex(null);
                }}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Chemical Service Warning Modal */}
      {showChemicalWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="bg-[#160B53] p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Chemical Service Alert</h3>
                  <p className="text-white/80 text-sm mt-0.5">Important Information</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4">
                <p className="text-gray-800 text-sm leading-relaxed">
                  You've selected <span className="font-bold text-amber-900">{pendingChemicalService?.serviceName || pendingChemicalService?.name}</span>, which is a <span className="font-semibold text-amber-900">chemical treatment service</span>.
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <Clock className="w-6 h-6 text-blue-600" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Arrive Early for Patch Test</p>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      Please arrive <span className="font-bold text-blue-900">10 minutes earlier</span> than your scheduled appointment time for a mandatory skin patch test.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 leading-relaxed flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">ℹ️</span>
                  <span>This precautionary test ensures your safety and helps us provide the best service possible. It's quick and painless!</span>
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowChemicalWarning(false);
                  setPendingChemicalService(null);
                }}
                className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmChemicalService}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-xl hover:from-[#1a0f63] hover:to-[#35207a] transition-all font-semibold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}    
      
      {/* Portfolio Modal */}
      {showPortfolioModal && selectedStylist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {selectedStylist.firstName && selectedStylist.lastName 
                        ? `${selectedStylist.firstName} ${selectedStylist.lastName}'s Portfolio` 
                        : `${selectedStylist.name || 'Stylist'}'s Portfolio`}
                    </h3>
                    <p className="text-white/80 text-sm mt-0.5">
                      {pendingService?.serviceName || pendingService?.name} Category
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPortfolioModal(false);
                    setSelectedStylist(null);
                    setPortfolios([]);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPortfolios ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : portfolios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">No portfolio items available</p>
                  <p className="text-sm text-gray-500 mt-1">This stylist hasn't uploaded any work yet</p>
                </div>
              ) : (
                <>
                  {/* Filter by service category */}
                  {(() => {
                    const serviceCategory = pendingService?.category;
                    const filteredPortfolios = serviceCategory 
                      ? portfolios.filter(p => p.category === serviceCategory)
                      : portfolios;
                    
                    return filteredPortfolios.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                          <ImageIcon className="w-8 h-8 text-amber-600" />
                        </div>
                        <p className="text-gray-600 font-medium">No {serviceCategory} portfolio items</p>
                        <p className="text-sm text-gray-500 mt-1">
                          This stylist has {portfolios.length} other portfolio item{portfolios.length !== 1 ? 's' : ''}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            // Show all portfolios by clearing category filter
                          }}
                          className="mt-4 px-4 py-2 text-sm bg-[#160B53] text-white rounded-lg hover:bg-[#1a0f63] transition-colors"
                        >
                          View All {portfolios.length} Items
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                          Showing {filteredPortfolios.length} {serviceCategory ? `${serviceCategory} ` : ''}portfolio item{filteredPortfolios.length !== 1 ? 's' : ''}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {filteredPortfolios.map((portfolio) => (
                            <div 
                              key={portfolio.id} 
                              className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all hover:border-[#160B53]"
                            >
                              {/* Image */}
                              <div className="relative aspect-square bg-gray-100">
                                <img 
                                  src={portfolio.imageUrl} 
                                  alt={portfolio.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                {portfolio.category && (
                                  <div className="absolute top-2 right-2 px-2 py-1 bg-[#160B53] text-white text-xs font-semibold rounded-full">
                                    {portfolio.category}
                                  </div>
                                )}
                              </div>
                              
                              {/* Info */}
                              <div className="p-3">
                                <h4 className="font-semibold text-gray-900 truncate">{portfolio.title}</h4>
                                {portfolio.description && (
                                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{portfolio.description}</p>
                                )}
                                {portfolio.createdAt && (
                                  <p className="text-xs text-gray-400 mt-2">
                                    {new Date(portfolio.createdAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setShowPortfolioModal(false);
                  setSelectedStylist(null);
                  setPortfolios([]);
                }}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Terms & Confirmation Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">Confirm Your Appointment</h3>
                  <p className="text-white/80 text-sm mt-1">Please review the terms before submitting</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Terms and Conditions */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 shadow-sm">
                <h5 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                  Terms and Conditions
                </h5>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>By booking this appointment, you agree to arrive on time.</p>
                  {(bookingData.services || []).some(si => {
                    const service = services.find(s => s.id === si.serviceId);
                    return service?.isChemical;
                  }) && (
                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mt-3">
                      <p className="font-semibold text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Chemical Service Notice
                      </p>
                      <p className="text-amber-800 mt-1">
                        Please arrive 10 minutes before your appointment time.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment Confirmation Notice */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-5 shadow-sm">
                <h5 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Important: Appointment Confirmation Required
                </h5>
                <div className="space-y-3 text-sm text-amber-900">
                  <div className="bg-white/60 rounded-lg p-3 border border-amber-200">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <Timer className="w-4 h-4" />
                      Waiting for Confirmation
                    </p>
                    <p className="text-amber-800">
                      After submitting, your appointment will be marked as <span className="font-bold">"PENDING"</span> and must be confirmed by the branch within <span className="font-bold">24 hours</span>.
                    </p>
                  </div>
                  
                  <div className="bg-white/60 rounded-lg p-3 border border-amber-200">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmation Process
                    </p>
                    <p className="text-amber-800">
                      You will receive a notification once the branch confirms your appointment. Please check your notifications regularly.
                    </p>
                  </div>

                  <div className="bg-white/60 rounded-lg p-3 border border-amber-200">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Need Help?
                    </p>
                    <p className="text-amber-800">
                      If your appointment is not confirmed after 24 hours, please contact the branch directly at:
                    </p>
                    <p className="font-bold text-[#160B53] mt-2">
                      {branches.find(b => b.id === bookingData.branchId)?.contact || 
                       branches.find(b => b.id === bookingData.branchId)?.phone || 
                       branches.find(b => b.id === bookingData.branchId)?.phoneNumber || 
                       'Contact number not available'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-gray-200 bg-gray-50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                disabled={booking}
                className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all font-semibold disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={confirmAndSubmit}
                disabled={booking}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all font-semibold shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {booking && <LoadingSpinner size="sm" />}
                {booking ? 'Submitting...' : 'I Agree, Submit Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientBookingModal;
