/**
 * Appointment Service
 * Handles all appointment-related operations
 */

import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getCountFromServer,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getBranchById } from './branchService';
import { getBranchCalendar } from './branchCalendarService';
import { getScheduleConfigurationsByBranch } from './scheduleService';
import { logActivity } from './activityService';
import { 
  storeAppointmentCreated, 
  storeAppointmentConfirmed, 
  storeAppointmentCancelled, 
  storeAppointmentRescheduled,
  storeAppointmentCompleted,
  storeAppointmentInService,
  storeAppointmentTransferred
} from './notificationService';
import toast from 'react-hot-toast';

const APPOINTMENTS_COLLECTION = 'appointments';

/**
 * Appointment Status Constants
 */
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

/**
 * Get all appointments
 */
export const getAllAppointments = async () => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(appointmentsRef, orderBy('appointmentDate', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching appointments:', error);
    toast.error('Failed to load appointments');
    throw error;
  }
};

/**
 * Get appointments by branch
 */
export const getAppointmentsByBranch = async (branchId) => {
  try {
    // Validate branchId
    if (!branchId) {
      console.warn('getAppointmentsByBranch called with invalid branchId:', branchId);
      return [];
    }
    
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      orderBy('appointmentDate', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching branch appointments for branchId:', branchId, error);
    toast.error('Failed to load branch appointments');
    throw error;
  }
};

/**
 * Get appointments by client
 */
export const getAppointmentsByClient = async (clientId, options = {}) => {
  try {
    // Validate clientId
    if (!clientId) {
      console.warn('getAppointmentsByClient called with invalid clientId:', clientId);
      return { appointments: [], hasMore: false, totalCount: 0 };
    }

    const {
      status,
      limit = 20,
      startAfter,
      searchTerm,
      dateFrom,
      dateTo
    } = options;

    // Build query constraints array
    const constraints = [where('clientId', '==', clientId)];

    // Add status filter if specified
    if (status) {
      constraints.push(where('status', '==', status));
    }

    // Add date range filters if specified
    if (dateFrom) {
      constraints.push(where('appointmentDate', '>=', Timestamp.fromDate(dateFrom)));
    }
    if (dateTo) {
      constraints.push(where('appointmentDate', '<=', Timestamp.fromDate(dateTo)));
    }

    // Order by appointment date descending (handled client-side to avoid composite index requirements)
    // constraints.push(orderBy('appointmentDate', 'desc'));

    // Add pagination
    if (startAfter) {
      constraints.push(startAfter(startAfter));
    }

    // Add limit
    constraints.push(firestoreLimit(limit + 1)); // +1 to check if there are more

    const q = query(collection(db, APPOINTMENTS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    let appointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));

    // Sort by appointment date descending (client-side)
    appointments.sort((a, b) => {
      const aDate = a.appointmentDate ? new Date(a.appointmentDate).getTime() : 0;
      const bDate = b.appointmentDate ? new Date(b.appointmentDate).getTime() : 0;
      return bDate - aDate;
    });

    // Apply client-side search if searchTerm provided
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      appointments = appointments.filter(apt =>
        apt.services?.some(service =>
          service.serviceName?.toLowerCase().includes(term) ||
          service.stylistName?.toLowerCase().includes(term)
        ) ||
        apt.branchName?.toLowerCase().includes(term) ||
        apt.notes?.toLowerCase().includes(term)
      );
    }

    const hasMore = appointments.length > limit;
    if (hasMore) {
      appointments = appointments.slice(0, limit);
    }

    // Get total count for status tabs (this is a simplified version)
    // In production, you'd want to cache this or use a separate query
    let totalCount = appointments.length;
    if (!startAfter && !searchTerm) {
      // Only get total count for initial load without filters
      const countConstraints = [where('clientId', '==', clientId)];
      if (status) {
        countConstraints.push(where('status', '==', status));
      }
      const countQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        ...countConstraints
      );
      const countSnapshot = await getCountFromServer(countQuery);
      totalCount = countSnapshot.data().count;
    }

    return {
      appointments,
      hasMore,
      totalCount,
      lastDoc: hasMore ? snapshot.docs[limit - 1] : snapshot.docs[snapshot.docs.length - 1]
    };
  } catch (error) {
    console.error('Error fetching client appointments:', error);
    toast.error('Failed to load your appointments');
    throw error;
  }
};

/**
 * Get appointments by stylist
 * Handles both single-service appointments (stylistId field) 
 * and multi-service appointments (services array)
 */
export const getAppointmentsByStylist = async (stylistId) => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    
    // Query 1: Single-service appointments with stylistId field
    const singleServiceQuery = query(
      appointmentsRef,
      where('stylistId', '==', stylistId),
      orderBy('appointmentDate', 'desc')
    );
    const singleServiceSnapshot = await getDocs(singleServiceQuery);
    const singleServiceAppointments = singleServiceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
    
    // Query 2: Multi-service appointments where stylist is in services array
    // Get all appointments and filter client-side (Firestore can't query array contains with specific field)
    const allAppointmentsQuery = query(
      appointmentsRef,
      orderBy('appointmentDate', 'desc')
    );
    const allAppointmentsSnapshot = await getDocs(allAppointmentsQuery);
    const multiServiceAppointments = allAppointmentsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        appointmentDate: doc.data().appointmentDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }))
      .filter(apt => 
        apt.services && 
        apt.services.some(svc => svc.stylistId === stylistId)
      );
    
    // Combine and deduplicate
    const allAppointments = [...singleServiceAppointments];
    multiServiceAppointments.forEach(apt => {
      if (!allAppointments.find(a => a.id === apt.id)) {
        allAppointments.push(apt);
      }
    });
    
    // Sort by date descending
    return allAppointments.sort((a, b) => {
      const dateA = a.appointmentDate ? new Date(a.appointmentDate) : new Date(0);
      const dateB = b.appointmentDate ? new Date(b.appointmentDate) : new Date(0);
      return dateB - dateA;
    });
    
  } catch (error) {
    console.error('Error fetching stylist appointments:', error);
    toast.error('Failed to load your appointments');
    throw error;
  }
};

/**
 * Get appointments with filters and pagination
 * @param {Object} filters - Filter criteria (branchId, status, clientId, stylistId, startDate, endDate)
 * @param {string} currentUserRole - Current user role
 * @param {string} currentUserId - Current user ID
 * @param {number} pageSize - Page size (default: 20)
 * @param {Object} lastDoc - Last document for pagination
 * @returns {Promise<Object>} Appointments with pagination info
 */
export const getAppointments = async (filters = {}, currentUserRole = 'branch_manager', currentUserId = 'current_user', pageSize = 20, lastDoc = null) => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const constraints = [];

    // Apply filters
    if (filters.branchId) {
      constraints.push(where('branchId', '==', filters.branchId));
    }
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.clientId) {
      constraints.push(where('clientId', '==', filters.clientId));
    }
    if (filters.stylistId) {
      // For multi-service appointments, we'll filter client-side
      // For now, we'll query by stylistId field (single-service appointments)
      constraints.push(where('stylistId', '==', filters.stylistId));
    }
    if (filters.startDate) {
      constraints.push(where('appointmentDate', '>=', Timestamp.fromDate(new Date(filters.startDate))));
    }
    if (filters.endDate) {
      constraints.push(where('appointmentDate', '<=', Timestamp.fromDate(new Date(filters.endDate))));
    }

    // Add ordering
    constraints.push(orderBy('appointmentDate', 'desc'));

    // Add pagination
    if (pageSize) {
      constraints.push(firestoreLimit(pageSize + 1)); // Fetch one extra to check if there's more
    }
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(appointmentsRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const appointments = (hasMore ? docs.slice(0, pageSize) : docs).map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));

    // Filter multi-service appointments by stylistId if needed (client-side)
    let filteredAppointments = appointments;
    if (filters.stylistId) {
      filteredAppointments = appointments.filter(apt => {
        // Check single-service appointments
        if (apt.stylistId === filters.stylistId) {
          return true;
        }
        // Check multi-service appointments
        if (apt.services && Array.isArray(apt.services)) {
          return apt.services.some(svc => svc.stylistId === filters.stylistId);
        }
        return false;
      });
    }

    return {
      appointments: filteredAppointments,
      lastDoc: hasMore ? docs[pageSize - 1] : null,
      hasMore: hasMore
    };
  } catch (error) {
    console.error('Error fetching appointments:', error);
    throw error;
  }
};

/**
 * Get appointments by date range
 */
export const getAppointmentsByDateRange = async (branchId, startDate, endDate) => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    
    // Build query constraints dynamically
    const constraints = [where('branchId', '==', branchId)];
    
    // Add date filters only if dates are provided
    if (startDate) {
      constraints.push(where('appointmentDate', '>=', Timestamp.fromDate(startDate)));
    }
    if (endDate) {
      constraints.push(where('appointmentDate', '<=', Timestamp.fromDate(endDate)));
    }
    
    // Add ordering
    constraints.push(orderBy('appointmentDate', 'asc'));
    
    const q = query(appointmentsRef, ...constraints);
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching appointments by date range:', error);
    toast.error('Failed to load appointments');
    throw error;
  }
};

/**
 * Get single appointment by ID
 */
export const getAppointmentById = async (appointmentId) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const appointmentSnap = await getDoc(appointmentRef);
    
    if (!appointmentSnap.exists()) {
      throw new Error('Appointment not found');
    }
    
    return {
      id: appointmentSnap.id,
      ...appointmentSnap.data(),
      appointmentDate: appointmentSnap.data().appointmentDate?.toDate(),
      createdAt: appointmentSnap.data().createdAt?.toDate(),
      updatedAt: appointmentSnap.data().updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching appointment:', error);
    toast.error('Failed to load appointment details');
    throw error;
  }
};

/**
 * Create new appointment
 */
export const createAppointment = async (appointmentData, currentUser) => {
  try {
    // Validate required fields
    // For guest clients, clientId is optional but clientName is required
    const isGuest = appointmentData.isGuest;
    
    // Support both single service (serviceId) and multi-service (services array)
    const hasService = appointmentData.serviceId || (appointmentData.services && appointmentData.services.length > 0);
    
    if (!appointmentData.branchId || !hasService || !appointmentData.appointmentDate) {
      throw new Error('Missing required appointment fields');
    }
    
    if (!isGuest && !appointmentData.clientId) {
      throw new Error('Client ID is required for registered client appointments');
    }
    
    if (isGuest && !appointmentData.clientName) {
      throw new Error('Client name is required for guest client appointments');
    }

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);

    // Check for duplicate appointments - same client, date/time, service, and stylist
    if (appointmentData.clientId) {
      const appointmentDateTime = new Date(appointmentData.appointmentDate);
      const appointmentStart = new Date(appointmentDateTime);
      appointmentStart.setSeconds(0, 0);
      const appointmentEnd = new Date(appointmentStart);
      appointmentEnd.setMinutes(appointmentEnd.getMinutes() + (appointmentData.duration || 60));

      // Get services to check
      const servicesToCheck = appointmentData.services || (appointmentData.serviceId ? [{
        serviceId: appointmentData.serviceId,
        stylistId: appointmentData.stylistId || null
      }] : []);

      // Check for existing appointments with same client
      const existingQuery = query(
        appointmentsRef,
        where('clientId', '==', appointmentData.clientId)
      );

      const existingSnapshot = await getDocs(existingQuery);
      
      for (const docSnap of existingSnapshot.docs) {
        const existing = docSnap.data();
        
        // Skip cancelled and completed appointments
        if (existing.status === APPOINTMENT_STATUS.CANCELLED || 
            existing.status === APPOINTMENT_STATUS.COMPLETED ||
            existing.status === APPOINTMENT_STATUS.NO_SHOW) {
          continue;
        }
        
        const existingDate = existing.appointmentDate?.toDate();
        
        if (existingDate) {
          const existingStart = new Date(existingDate);
          existingStart.setSeconds(0, 0);
          const existingEnd = new Date(existingStart);
          existingEnd.setMinutes(existingEnd.getMinutes() + (existing.duration || 60));

          // Check if appointments overlap in time
          const timeOverlaps = appointmentStart < existingEnd && appointmentEnd > existingStart;

          if (timeOverlaps) {
            // Check if same service and stylist
            const existingServices = existing.services || (existing.serviceId ? [{
              serviceId: existing.serviceId,
              stylistId: existing.stylistId || null
            }] : []);

            for (const service of servicesToCheck) {
              const hasSameService = existingServices.some(existingService => {
                const sameService = existingService.serviceId === service.serviceId;
                const sameStylist = (existingService.stylistId || null) === (service.stylistId || null);
                return sameService && sameStylist;
              });

              if (hasSameService) {
                toast.error('You already have an appointment for this service');
                throw new Error('Duplicate appointment detected');
              }
            }
          }
        }
      }
    }

    // Check for double booking
    // Stylist schedule/shift validation removed - allow bookings regardless of stylist availability
    // The branch manager will handle stylist scheduling after booking confirmation

    // Note: Time validation is now optional - receptionist can accept/reject during review
    // Previously validated appointment time against operating hours
    // Now allowing all bookings and letting receptionist decide
    // const appointmentDateTime = new Date(appointmentData.appointmentDate);
    // const duration = appointmentData.duration || 60;
    // const timeValidation = await validateAppointmentTime(...);

    const defaultStatus = appointmentData.status || APPOINTMENT_STATUS.PENDING;
    
    // Build initial history entry
    const initialHistory = [{
      action: 'created',
      by: currentUser.uid,
      timestamp: new Date().toISOString(),
      notes: appointmentData.isGuest ? 'Appointment created for new client' : 'Appointment created'
    }];
    
    // If status is confirmed, add confirmation to history
    if (defaultStatus === APPOINTMENT_STATUS.CONFIRMED) {
      initialHistory.push({
        action: 'status_changed_to_confirmed',
        by: currentUser.uid,
        timestamp: new Date().toISOString()
      });
    }
    
    const newAppointment = {
      ...appointmentData,
      appointmentDate: Timestamp.fromDate(new Date(appointmentData.appointmentDate)),
      status: defaultStatus,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: initialHistory
    };

    const docRef = await addDoc(appointmentsRef, newAppointment);

    // Prepare appointment data for notification
    const appointmentForNotification = {
      id: docRef.id,
      ...newAppointment,
      appointmentDate: appointmentData.appointmentDate
    };

    // Send notification to client and stylist(s)
    try {
      await storeAppointmentConfirmed(appointmentForNotification);
    } catch (error) {
      console.error('Error sending appointment confirmed notification:', error);
      // Don't fail appointment creation if notification fails
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CREATE_APPOINTMENT',
      targetType: 'appointment',
      targetId: docRef.id,
      details: `Created appointment for client ${appointmentData.clientName || appointmentData.clientId}`,
      metadata: {
        branchId: appointmentData.branchId,
        serviceId: appointmentData.serviceId || null,
        services: appointmentData.services || null,
        appointmentDate: appointmentData.appointmentDate
      }
    });

    toast.success('Appointment created successfully');
    return docRef.id;
  } catch (error) {
    console.error('Error creating appointment:', error);
    if (error.message !== 'Time slot not available') {
      toast.error('Failed to create appointment');
    }
    throw error;
  }
};

/**
 * Update appointment
 */
export const updateAppointment = async (appointmentId, updates, currentUser) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    
    // If rescheduling, check availability and time restrictions
    if (updates.appointmentDate) {
      const appointment = await getAppointmentById(appointmentId);

      // If appointment is in_service or completed, disallow reschedule
      if (appointment.status === APPOINTMENT_STATUS.IN_SERVICE || appointment.status === APPOINTMENT_STATUS.COMPLETED) {
        toast.error('Rescheduling is not allowed once the service is in progress or completed.');
        throw new Error('Reschedule not allowed - appointment in_service or completed');
      }

      // If appointment appears to be paid, disallow reschedule as well
      const paidFlag = appointment.paymentStatus || appointment.paid || appointment.isPaid;
      if (paidFlag === true || (typeof paidFlag === 'string' && paidFlag.toLowerCase() === 'paid')) {
        toast.error('Rescheduling is not allowed for appointments that have already been paid.');
        throw new Error('Reschedule not allowed - appointment paid');
      }
      
      // Check availability for multi-service or single-service
      // Stylist schedule/shift validation removed - allow updates regardless of stylist availability
      // The branch manager will handle stylist scheduling

      // Note: Time validation removed - receptionist can accept/reject during review
      // Previously validated: const timeValidation = await validateAppointmentTime(...)


      updates.appointmentDate = Timestamp.fromDate(updates.appointmentDate);
    }

    // Filter out undefined values from updates
    const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    // Get appointment before update to check status change and stylist changes
    const appointmentBeforeUpdate = await getAppointmentById(appointmentId);
    const oldStatus = appointmentBeforeUpdate.status;
    const oldDate = appointmentBeforeUpdate.appointmentDate;
    const oldTime = appointmentBeforeUpdate.appointmentTime || null;
    
    // Helper function to get timestamp in milliseconds from Date or Timestamp
    const getTimeMillis = (dateValue) => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) return dateValue.getTime();
      if (dateValue?.toMillis) return dateValue.toMillis();
      if (dateValue?.toDate) return dateValue.toDate().getTime();
      return null;
    };

    // Check for stylist transfer (when clientType is TR and stylist changes)
    let stylistTransferDetected = false;
    let oldStylistId = null;
    let newStylistId = null;
    let oldStylistName = null;
    let newStylistName = null;

    // Check if services array is being updated
    if (cleanUpdates.services && Array.isArray(cleanUpdates.services)) {
      // Check each service for TR clientType and stylist changes
      for (let i = 0; i < cleanUpdates.services.length; i++) {
        const newService = cleanUpdates.services[i];
        const oldService = appointmentBeforeUpdate.services?.[i] || appointmentBeforeUpdate.services?.find(s => s.serviceId === newService.serviceId);
        
        if (newService.clientType === 'TR' && oldService) {
          // Check if stylist changed
          if (oldService.stylistId && newService.stylistId && oldService.stylistId !== newService.stylistId) {
            stylistTransferDetected = true;
            oldStylistId = oldService.stylistId;
            newStylistId = newService.stylistId;
            oldStylistName = oldService.stylistName || 'Previous Stylist';
            newStylistName = newService.stylistName || 'New Stylist';
            break; // Use first service's transfer info
          }
        }
      }
    }

    // Build history entry
    const historyEntry = {
      by: currentUser.uid,
      timestamp: new Date().toISOString()
    };

    // Check if this is a reschedule
    const oldDateMillis = getTimeMillis(oldDate);
    const newDateMillis = getTimeMillis(cleanUpdates.appointmentDate);
    
    if (cleanUpdates.appointmentDate && oldDateMillis !== null && newDateMillis !== null && oldDateMillis !== newDateMillis) {
      historyEntry.action = 'rescheduled';
      historyEntry.details = {
        oldDate: oldDate instanceof Date ? oldDate.toISOString() : (oldDate?.toDate ? oldDate.toDate().toISOString() : oldDate),
        oldTime: oldTime,
        newDate: cleanUpdates.appointmentDate instanceof Date ? cleanUpdates.appointmentDate.toISOString() : (cleanUpdates.appointmentDate?.toDate ? cleanUpdates.appointmentDate.toDate().toISOString() : cleanUpdates.appointmentDate),
        newTime: cleanUpdates.appointmentTime || null
      };
      if (cleanUpdates.rescheduleReason) {
        historyEntry.reason = cleanUpdates.rescheduleReason;
      }
    } else if (cleanUpdates.status && cleanUpdates.status !== oldStatus) {
      historyEntry.action = `status_changed_to_${cleanUpdates.status}`;
      if (cleanUpdates.status === APPOINTMENT_STATUS.CANCELLED && cleanUpdates.cancelReason) {
        historyEntry.reason = cleanUpdates.cancelReason;
      }
    } else {
      historyEntry.action = 'updated';
      historyEntry.notes = 'Appointment updated';
    }

    // Update appointment with history
    await updateDoc(appointmentRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
      history: [...(appointmentBeforeUpdate.history || []), historyEntry]
    });

    // Get updated appointment for notifications
    const updatedAppointment = await getAppointmentById(appointmentId);
    const newStatus = updatedAppointment.status;

    // Send notification if status changed
    if (oldStatus !== newStatus && newStatus) {
      try {
        const appointmentForNotification = {
          ...updatedAppointment,
          appointmentDate: updatedAppointment.appointmentDate
        };

        switch (newStatus) {
          case APPOINTMENT_STATUS.CONFIRMED:
            await storeAppointmentConfirmed(appointmentForNotification);
            break;
          case APPOINTMENT_STATUS.CANCELLED:
            await storeAppointmentCancelled(appointmentForNotification);
            break;
          case APPOINTMENT_STATUS.IN_SERVICE:
            await storeAppointmentInService(appointmentForNotification);
            break;
          case APPOINTMENT_STATUS.COMPLETED:
            await storeAppointmentCompleted(appointmentForNotification);
            break;
        }
      } catch (error) {
        console.error('Error sending status change notification:', error);
      }
    }

    // Send notification if rescheduled (appointmentDate changed)
    if (updates.appointmentDate) {
      try {
        const appointmentForNotification = {
          ...updatedAppointment,
          newAppointmentDate: updates.appointmentDate instanceof Date 
            ? updates.appointmentDate 
            : updates.appointmentDate.toDate?.() || new Date(updates.appointmentDate),
          appointmentDate: updatedAppointment.appointmentDate
        };
        await storeAppointmentRescheduled(appointmentForNotification);
      } catch (error) {
        console.error('Error sending rescheduled notification:', error);
      }
    }

    // Send transfer notification if stylist changed and clientType is TR
    if (stylistTransferDetected && oldStylistId && newStylistId) {
      try {
        const transferNotificationData = {
          ...updatedAppointment,
          oldStylistId,
          newStylistId,
          oldStylistName,
          newStylistName,
          appointmentDate: updatedAppointment.appointmentDate
        };
        await storeAppointmentTransferred(transferNotificationData);
        console.log('✅ Transfer notification sent:', { oldStylistId, newStylistId });
      } catch (error) {
        console.error('Error sending transfer notification:', error);
        // Don't fail the update if notification fails
      }
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'UPDATE_APPOINTMENT',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Updated appointment`,
      metadata: updates
    });

    toast.success('Appointment updated successfully');
  } catch (error) {
    console.error('Error updating appointment:', error);
    if (error.message !== 'Time slot not available') {
      toast.error('Failed to update appointment');
    }
    throw error;
  }
};

/**
 * Automatically cancel appointments based on criteria (optimized for minimal reads)
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} - Array of cancelled appointments
 */
export const autoCancelAppointments = async (branchId) => {
  try {
    const now = new Date();
    const cancelledAppointments = [];

    // Strategy: Only check appointments that are likely to need cancellation
    // 1. Appointments from yesterday or earlier (past due)
    // 2. Appointments created more than 7 days ago

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    console.log(`🔍 Checking for auto-cancellable appointments for branch ${branchId}`);

    // Query 1: Past due appointments (appointment date <= yesterday)
    const pastDueQuery = query(
      collection(db, APPOINTMENTS_COLLECTION),
      where('branchId', '==', branchId),
      where('status', '==', APPOINTMENT_STATUS.PENDING),
      where('appointmentDate', '<=', Timestamp.fromDate(yesterday)),
      limit(10) // Limit to avoid too many reads
    );

    const pastDueSnapshot = await getDocs(pastDueQuery);
    console.log(`📅 Found ${pastDueSnapshot.size} potentially past-due appointments`);

    // Query 2: Old pending appointments (created > 7 days ago)
    const oldPendingQuery = query(
      collection(db, APPOINTMENTS_COLLECTION),
      where('branchId', '==', branchId),
      where('status', '==', APPOINTMENT_STATUS.PENDING),
      where('createdAt', '<=', Timestamp.fromDate(weekAgo)),
      limit(10) // Limit to avoid too many reads
    );

    const oldPendingSnapshot = await getDocs(oldPendingQuery);
    console.log(`⏰ Found ${oldPendingSnapshot.size} old pending appointments`);

    // Combine and deduplicate appointments to check
    const appointmentsToCheck = new Map();

    // Add past due appointments
    pastDueSnapshot.docs.forEach(doc => {
      appointmentsToCheck.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Add old pending appointments (will overwrite if duplicate)
    oldPendingSnapshot.docs.forEach(doc => {
      appointmentsToCheck.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const uniqueAppointments = Array.from(appointmentsToCheck.values());
    console.log(`🎯 Checking ${uniqueAppointments.length} unique appointments for cancellation`);

    // Process each appointment (limited to avoid overwhelming the system)
    for (const appointment of uniqueAppointments.slice(0, 5)) { // Max 5 cancellations per run
      let shouldCancel = false;
      let cancelReason = '';

      // Check if appointment date has passed (with buffer)
      if (appointment.appointmentDate) {
        const appointmentDate = appointment.appointmentDate.toDate ? appointment.appointmentDate.toDate() : new Date(appointment.appointmentDate);
        const hoursAgo = (now - appointmentDate) / (1000 * 60 * 60);

        // Cancel if more than 2 hours past appointment time
        if (hoursAgo > 2) {
          shouldCancel = true;
          cancelReason = 'Auto-cancelled: Appointment time has passed';
        }
      }

      // Check if created too long ago
      if (!shouldCancel && appointment.createdAt) {
        const createdDate = appointment.createdAt.toDate ? appointment.createdAt.toDate() : new Date(appointment.createdAt);
        const daysOld = (now - createdDate) / (1000 * 60 * 60 * 24);

        if (daysOld > 7) {
          shouldCancel = true;
          cancelReason = 'Auto-cancelled: Pending booking expired';
        }
      }

      if (shouldCancel) {
        console.log(`🚫 Auto-cancelling appointment ${appointment.id}: ${cancelReason}`);

        try {
          await updateAppointmentStatus(appointment.id, APPOINTMENT_STATUS.CANCELLED, 'system', cancelReason);
          cancelledAppointments.push({
            id: appointment.id,
            clientName: appointment.clientName,
            reason: cancelReason
          });
        } catch (error) {
          console.error(`❌ Failed to cancel appointment ${appointment.id}:`, error);
        }
      }
    }

    console.log(`✅ Auto-cancelled ${cancelledAppointments.length} appointments (limited processing)`);
    return cancelledAppointments;

  } catch (error) {
    console.error('❌ Error in optimized auto-cancel appointments:', error);
    throw error;
  }
};

/**
 * Validate if an appointment time is within branch operating hours
 * @param {string} branchId - Branch ID
 * @param {Date} appointmentDate - Appointment date and time
 * @param {number} duration - Appointment duration in minutes
 * @returns {Promise<Object>} - { isValid: boolean, message: string }
 */
export const validateAppointmentTime = async (branchId, appointmentDate, duration = 60) => {
  try {
    // Get branch data
    const branch = await getBranchById(branchId);
    if (!branch) {
      return { isValid: false, message: 'Branch not found' };
    }

    // Get day of week
    const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayName = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });

    // Get operating hours for the day
    const dayHours = branch.operatingHours?.[dayOfWeek];
    if (!dayHours) {
      return { isValid: false, message: `No operating hours configured for ${dayName}` };
    }

    // Check if branch is open
    const isBranchOpen = dayHours.isOpen !== undefined
      ? dayHours.isOpen
      : !dayHours.closed;

    if (!isBranchOpen) {
      return { isValid: false, message: `Branch is closed on ${dayName}s` };
    }

    // Parse operating hours
    const [startHour, startMinute] = dayHours.open.split(':').map(Number);
    const [endHour, endMinute] = dayHours.close.split(':').map(Number);

    // Create operating hour boundaries
    const operatingStart = new Date(appointmentDate);
    operatingStart.setHours(startHour, startMinute, 0, 0);

    const operatingEnd = new Date(appointmentDate);
    operatingEnd.setHours(endHour, endMinute, 0, 0);

    // Calculate appointment end time
    const appointmentEnd = new Date(appointmentDate.getTime() + duration * 60000);

    // Debug logging
    console.log('Appointment validation:', {
      appointmentStartLocal: appointmentDate.toString(),
      appointmentEndLocal: appointmentEnd.toString(),
      appointmentStartISO: appointmentDate.toISOString(),
      appointmentEndISO: appointmentEnd.toISOString(),
      operatingStartLocal: operatingStart.toString(),
      operatingEndLocal: operatingEnd.toString(),
      operatingStartISO: operatingStart.toISOString(),
      operatingEndISO: operatingEnd.toISOString(),
      duration,
      appointmentEndHour: appointmentEnd.getHours(),
      operatingEndHour: operatingEnd.getHours(),
      comparison: appointmentEnd.getTime() - operatingEnd.getTime()
    });

    // Validate appointment fits within operating hours
    if (appointmentDate < operatingStart) {
      return {
        isValid: false,
        message: `Appointment starts before opening time (${dayHours.open}). Branch opens at ${dayHours.open} on ${dayName}s.`
      };
    }

    // Allow appointments that end at or before closing time (not strictly after)
    if (appointmentEnd > operatingEnd) {
      return {
        isValid: false,
        message: `Appointment ends after closing time (${dayHours.close}). Branch closes at ${dayHours.close} on ${dayName}s.`
      };
    }

    // Check calendar for holidays/closures
    const calendar = await getBranchCalendar(branchId);
    const dateString = appointmentDate.toISOString().split('T')[0];

    const dayEvents = calendar.filter(entry => {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const entryDateString = entryDate.toISOString().split('T')[0];
      return entryDateString === dateString;
    });

    // Check for holidays/closures
    const closureEvent = dayEvents.find(e => e.type === 'holiday' || e.type === 'closure');
    if (closureEvent) {
      const reason = closureEvent.type === 'holiday' ? 'Holiday' : 'Temporary Closure';
      const title = closureEvent.title ? ` (${closureEvent.title})` : '';
      return { isValid: false, message: `${reason}${title} - No appointments available on this date` };
    }

    return { isValid: true, message: 'Appointment time is within operating hours' };

  } catch (error) {
    console.error('Error validating appointment time:', error);
    return { isValid: false, message: 'Error validating appointment time' };
  }
};

/**
 * Update appointment status
 */
export const updateAppointmentStatus = async (appointmentId, status, currentUser, postServiceNotes = null, servicesAssessment = null) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    
    const updates = {
      status,
      updatedAt: serverTimestamp()
    };
    
    // Update services with client type and price adjustments if provided
    if (servicesAssessment && servicesAssessment.length > 0) {
      // If appointment has services array, update it
      const appointment = await getAppointmentById(appointmentId);
      if (appointment.services && appointment.services.length > 0) {
        const updatedServices = appointment.services.map((svc, index) => {
          const assessment = servicesAssessment.find(a => a.serviceId === svc.serviceId) || servicesAssessment[index];
          if (assessment) {
            const updatedService = {
              ...svc,
              clientType: assessment.clientType,
              adjustment: assessment.adjustment || 0,
              adjustmentReason: assessment.adjustmentReason || '',
              adjustedPrice: assessment.price || (svc.price || svc.basePrice || 0) + (assessment.adjustment || 0),
              basePrice: assessment.basePrice || svc.price || svc.basePrice || 0
            };
            // Remove status field if it exists (redundant - appointment has status, not individual services)
            delete updatedService.status;
            return updatedService;
          }
          // Remove status from existing service if it exists
          const cleanedService = { ...svc };
          delete cleanedService.status;
          return cleanedService;
        });
        updates.services = updatedServices;
      } else if (appointment.serviceName) {
        // Single service appointment
        const assessment = servicesAssessment[0];
        if (assessment) {
          updates.clientType = assessment.clientType;
          updates.adjustment = assessment.adjustment || 0;
          updates.adjustmentReason = assessment.adjustmentReason || '';
          updates.adjustedPrice = assessment.price || (appointment.servicePrice || 0) + (assessment.adjustment || 0);
          updates.basePrice = assessment.basePrice || appointment.servicePrice || 0;
        }
      }
    }
    
    // Add post-service notes if completing appointment
    if (status === APPOINTMENT_STATUS.COMPLETED && postServiceNotes) {
      updates.postServiceNotes = postServiceNotes;
      updates.completedAt = serverTimestamp();
      updates.completedBy = currentUser.uid;
    }
    
    // Get current appointment to build history
    const currentAppointment = await getAppointmentById(appointmentId);
    
    // Build history entry for status change
    const historyEntry = {
      action: `status_changed_to_${status}`,
      by: currentUser.uid,
      timestamp: new Date().toISOString()
    };
    
    if (status === APPOINTMENT_STATUS.CANCELLED && postServiceNotes) {
      historyEntry.reason = postServiceNotes;
    }
    
    // Add history to updates
    updates.history = [...(currentAppointment.history || []), historyEntry];
    
    await updateDoc(appointmentRef, updates);
    
    // Get updated appointment for notifications
    const updatedAppointment = await getAppointmentById(appointmentId);

    // Send notification based on status change
    try {
      const appointmentForNotification = {
        ...updatedAppointment,
        appointmentDate: updatedAppointment.appointmentDate
      };

      switch (status) {
        case APPOINTMENT_STATUS.CONFIRMED:
          await storeAppointmentConfirmed(appointmentForNotification);
          break;
        case APPOINTMENT_STATUS.CANCELLED:
          await storeAppointmentCancelled(appointmentForNotification);
          break;
        case APPOINTMENT_STATUS.IN_SERVICE:
          await storeAppointmentInService(appointmentForNotification);
          break;
        case APPOINTMENT_STATUS.COMPLETED:
          await storeAppointmentCompleted(appointmentForNotification);
          break;
      }
    } catch (error) {
      console.error('Error sending status change notification:', error);
      // Don't fail status update if notification fails
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'UPDATE_APPOINTMENT_STATUS',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Changed appointment status to ${status}`,
      metadata: { status }
    });

    toast.success(`Appointment marked as ${status}`);
  } catch (error) {
    console.error('Error updating appointment status:', error);
    toast.error('Failed to update appointment status');
    throw error;
  }
};

/**
 * Check in appointment (mark as arrived)
 */
export const checkInAppointment = async (appointmentId, currentUser) => {
  try {
    console.log('🔄 checkInAppointment called for:', appointmentId);
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const appointment = await getAppointmentById(appointmentId);
    
    console.log('📋 Appointment fetched:', { 
      id: appointment.id, 
      status: appointment.status, 
      clientName: appointment.clientName 
    });
    
    // Only allow check-in for confirmed appointments
    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED) {
      toast.error('Only confirmed appointments can be checked in');
      throw new Error('Only confirmed appointments can be checked in');
    }
    
    // Check if appointment is already checked in (check arrivals collection instead of appointment.arrivedAt)
    const { getArrivalByAppointmentId, createArrivalFromAppointment, ARRIVAL_STATUS } = await import('./arrivalsService');
    const existingArrival = await getArrivalByAppointmentId(appointmentId);
    
    if (existingArrival && existingArrival.status !== ARRIVAL_STATUS.COMPLETED && existingArrival.status !== ARRIVAL_STATUS.CANCELLED) {
      toast.info('Client has already been checked in');
      return;
    }
    
    // Create entry in arrivals collection with ARRIVED status
    
    // Pass appointment data with ARRIVED status explicitly set
    const appointmentWithArrivedStatus = {
      ...appointment,
      status: ARRIVAL_STATUS.ARRIVED // Override to set as arrived, not confirmed
    };
    
    console.log('📝 Creating arrival from appointment check-in with status:', ARRIVAL_STATUS.ARRIVED);
    const createdArrival = await createArrivalFromAppointment(appointmentWithArrivedStatus, currentUser);
    console.log('✅ Arrival created successfully:', createdArrival?.id);
    
    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CHECK_IN_APPOINTMENT',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Checked in ${appointment.clientName || 'client'}`,
      metadata: { 
        clientName: appointment.clientName,
        arrivalId: createdArrival?.id,
        arrivalStatus: ARRIVAL_STATUS.ARRIVED
      }
    });

    // Toast is shown in createArrivalFromAppointment, so we don't show another one here
    console.log('🎉 Check-in completed successfully!');
  } catch (error) {
    console.error('Error checking in appointment:', error);
    toast.error('Failed to check in appointment');
    throw error;
  }
};

/**
 * Create a walk-in appointment and mark as arrived
 * So walk-in clients appear in the arrivals queue like regular appointments
 */
export const createWalkInAppointment = async (walkInData, currentUser) => {
  try {
    const now = new Date();
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);

    const newAppointment = {
      branchId: walkInData.branchId,
      branchName: walkInData.branchName || '',
      clientId: walkInData.clientId || null,
      clientName: walkInData.clientName || 'Walk-in Client',
      clientPhone: walkInData.clientPhone || '',
      clientEmail: walkInData.clientEmail || '',
      services: walkInData.services || [],
      isWalkIn: true,
      status: APPOINTMENT_STATUS.CONFIRMED,
      appointmentDate: Timestamp.fromDate(now),
      // Walk-in is already in the branch, so mark as arrived immediately
      arrivedAt: serverTimestamp(),
      checkedInBy: currentUser.uid,
      notes: walkInData.notes || 'Walk-in client',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: [{
        action: 'created',
        by: currentUser.uid,
        timestamp: new Date().toISOString(),
        notes: 'Walk-in appointment created'
      }]
    };

    const docRef = await addDoc(appointmentsRef, newAppointment);

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CREATE_WALK_IN_APPOINTMENT',
      targetType: 'appointment',
      targetId: docRef.id,
      details: `Created walk-in appointment for ${newAppointment.clientName}`,
      metadata: {
        branchId: newAppointment.branchId,
        clientName: newAppointment.clientName,
        isWalkIn: true
      }
    });

    toast.success('Walk-in client added to arrivals queue');
    return docRef.id;
  } catch (error) {
    console.error('Error creating walk-in appointment:', error);
    toast.error('Failed to create walk-in appointment');
    throw error;
  }
};

/**
 * Cancel appointment
 */
export const cancelAppointment = async (appointmentId, reason, currentUser, bypassValidation = false, silenceToast = false) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const appointment = await getAppointmentById(appointmentId);
    
    // Build history entry
    const historyEntry = {
      action: 'status_changed_to_cancelled',
      by: currentUser.uid,
      timestamp: new Date().toISOString(),
      reason: reason || 'No reason provided'
    };
    
    await updateDoc(appointmentRef, {
      status: APPOINTMENT_STATUS.CANCELLED,
      cancellationReason: reason || 'No reason provided',
      cancelledBy: currentUser.uid,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: [...(appointment.history || []), historyEntry]
    });

    // Get updated appointment for notifications
    const updatedAppointment = await getAppointmentById(appointmentId);

    // Send cancellation notification
    try {
      const appointmentForNotification = {
        ...updatedAppointment,
        appointmentDate: updatedAppointment.appointmentDate
      };
      await storeAppointmentCancelled(appointmentForNotification);
    } catch (error) {
      console.error('Error sending cancellation notification:', error);
      // Don't fail cancellation if notification fails
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CANCEL_APPOINTMENT',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Cancelled appointment: ${reason || 'No reason provided'}`,
      metadata: { reason }
    });

    if (!silenceToast) {
      toast.success('Appointment cancelled successfully');
    }
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    toast.error('Failed to cancel appointment');
    throw error;
  }
};

/**
 * Delete appointment
 */
export const deleteAppointment = async (appointmentId, currentUser) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    
    // Get appointment data before deleting
    const appointment = await getAppointmentById(appointmentId);
    
    await deleteDoc(appointmentRef);

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'DELETE_APPOINTMENT',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Deleted appointment`,
      metadata: { 
        clientId: appointment.clientId,
        appointmentDate: appointment.appointmentDate
      }
    });

    toast.success('Appointment deleted successfully');
  } catch (error) {
    console.error('Error deleting appointment:', error);
    toast.error('Failed to delete appointment');
    throw error;
  }
};

/**
 * Check stylist availability for a time slot
 * Now checks both old format (stylistId field) and new format (services array)
 */
export const checkStylistAvailability = async (stylistId, appointmentDate, duration = 60, excludeAppointmentId = null) => {
  try {
    if (!stylistId) return true; // If no stylist assigned, allow booking

    const startTime = new Date(appointmentDate);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    
    // Get all appointments for the date range with active statuses
    // We need to fetch all and filter client-side because Firestore can't query nested array fields
    const dateStart = new Date(appointmentDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(appointmentDate);
    dateEnd.setHours(23, 59, 59, 999);
    
    const q = query(
      appointmentsRef,
      where('appointmentDate', '>=', Timestamp.fromDate(dateStart)),
      where('appointmentDate', '<=', Timestamp.fromDate(dateEnd)),
      where('status', 'in', [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_SERVICE])
    );
    
    const snapshot = await getDocs(q);
    
    for (const doc of snapshot.docs) {
      if (excludeAppointmentId && doc.id === excludeAppointmentId) {
        continue; // Skip the appointment being updated
      }

      const existingAppointment = doc.data();
      
      // Check if stylist is assigned to this appointment
      let isStylistAssigned = false;
      
      // Check old format (single stylistId field)
      if (existingAppointment.stylistId === stylistId) {
        isStylistAssigned = true;
      }
      
      // Check new format (services array)
      if (existingAppointment.services && Array.isArray(existingAppointment.services)) {
        const hasStylist = existingAppointment.services.some(svc => svc.stylistId === stylistId);
        if (hasStylist) {
          isStylistAssigned = true;
        }
      }
      
      if (!isStylistAssigned) {
        continue; // This appointment doesn't involve the stylist we're checking
      }
      
      // Stylist is assigned, now check for time overlap
      const existingStart = existingAppointment.appointmentDate.toDate();
      const existingEnd = new Date(existingStart.getTime() + (existingAppointment.duration || 60) * 60000);

      // Check for overlap
      if (
        (startTime >= existingStart && startTime < existingEnd) ||
        (endTime > existingStart && endTime <= existingEnd) ||
        (startTime <= existingStart && endTime >= existingEnd)
      ) {
        return false; // Time slot is not available
      }
    }

    return true; // Time slot is available
  } catch (error) {
    console.error('Error checking stylist availability:', error);
    return false;
  }
};

/**
 * Get available time slots for a stylist on a specific date
 * Now integrated with branch operating hours and calendar
 * @returns {Object} { slots: Array, message: string|null }
 */
export const getAvailableTimeSlots = async (stylistId, branchId, date, serviceDuration = 60) => {
  try {
    // Get branch data for operating hours (fallback)
    const branch = await getBranchById(branchId);
    if (!branch) {
      console.error('Branch not found:', branchId);
      return { slots: [], message: 'Branch not found' };
    }

    // Get day of week
    const selectedDate = new Date(date);
    const dayOfWeekName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const dayOfWeek = dayOfWeekName.toLowerCase();
    const dayName = dayOfWeekName;
    
    // Get schedule configurations for the branch
    let scheduleConfig = null;
    let stylistShift = null;
    
    try {
      const scheduleConfigs = await getScheduleConfigurationsByBranch(branchId);
      // Find the schedule configuration that applies to this date
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      // Find the most recent schedule configuration with startDate <= targetDate
      const applicableConfigs = scheduleConfigs
        .filter(c => {
          if (!c.startDate) return false;
          const configStartDate = new Date(c.startDate);
          configStartDate.setHours(0, 0, 0, 0);
          return configStartDate <= targetDate && c.isActive;
        })
        .sort((a, b) => {
          const aTime = new Date(a.startDate).getTime();
          const bTime = new Date(b.startDate).getTime();
          return bTime - aTime; // Most recent first
        });
      
      scheduleConfig = applicableConfigs[0] || null;
      
      // If stylistId provided, get their shift for this day
      if (stylistId && scheduleConfig && scheduleConfig.shifts && scheduleConfig.shifts[stylistId]) {
        stylistShift = scheduleConfig.shifts[stylistId][dayOfWeek] || null;
      }
    } catch (scheduleError) {
      console.warn('Error fetching schedules, falling back to branch operating hours:', scheduleError);
    }
    
    // Determine working hours - prioritize schedules over branch operating hours
    let startHour, startMinute, endHour, endMinute;
    let workingHours = null;
    
    if (stylistShift && stylistShift.start && stylistShift.end) {
      // Use stylist-specific shift from schedules
      [startHour, startMinute] = stylistShift.start.split(':').map(Number);
      [endHour, endMinute] = stylistShift.end.split(':').map(Number);
      workingHours = { open: stylistShift.start, close: stylistShift.end };
    } else {
      // Fall back to branch operating hours
      const dayHours = branch.operatingHours?.[dayOfWeek];
      if (!dayHours) {
        return { slots: [], message: 'No operating hours configured for this branch' };
      }
      
      // Check if branch is open (backwards compatible with old 'closed' field)
      const isBranchOpen = dayHours.isOpen !== undefined 
        ? dayHours.isOpen 
        : !dayHours.closed; // Fallback to old field
      
      if (!isBranchOpen) {
        return { slots: [], message: `Branch is closed on ${dayName}s` };
      }
      
      workingHours = dayHours;
      [startHour, startMinute] = workingHours.open.split(':').map(Number);
      [endHour, endMinute] = workingHours.close.split(':').map(Number);
    }

    // Check calendar for holidays/closures
    const calendar = await getBranchCalendar(branchId);
    const dateString = selectedDate.toISOString().split('T')[0];
    
    const dayEvents = calendar.filter(entry => {
      // entry.date is already a Date object (converted by getBranchCalendar)
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const entryDateString = entryDate.toISOString().split('T')[0];
      return entryDateString === dateString;
    });

    // Check if there's a holiday or closure
    const closureEvent = dayEvents.find(e => e.type === 'holiday' || e.type === 'closure');
    if (closureEvent) {
      const reason = closureEvent.type === 'holiday' ? 'Holiday' : 'Temporary Closure';
      const title = closureEvent.title ? ` (${closureEvent.title})` : '';
      return { slots: [], message: `${reason}${title} - No appointments available` };
    }

    // Check for special hours (override working hours)
    const specialHours = dayEvents.find(e => e.type === 'special_hours');
    if (specialHours && specialHours.specialHours) {
      workingHours = specialHours.specialHours;
      [startHour, startMinute] = workingHours.open.split(':').map(Number);
      [endHour, endMinute] = workingHours.close.split(':').map(Number);
    }

    // Get current time for disabling past slots
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();

    // OPTIMIZATION: Fetch ALL appointments for the day at once
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      where('appointmentDate', '>=', Timestamp.fromDate(dayStart)),
      where('appointmentDate', '<=', Timestamp.fromDate(dayEnd)),
      where('status', 'in', [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_SERVICE])
    );
    const snapshot = await getDocs(q);
    const dayAppointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate()
    }));

    const slots = [];
    const slotDate = new Date(date);
    slotDate.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    // Calculate minimum booking time (current time + 2 hours for advance booking requirement)
    const minBookingTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

    console.log('� TIME SLOT GENERATION DEBUG:', {
      isToday,
      selectedDate: selectedDate.toLocaleString(),
      currentTime: now.toLocaleString(),
      minBookingTime: minBookingTime.toLocaleString(),
      branchHours: {
        open: `${startHour}:${startMinute.toString().padStart(2, '0')}`,
        close: `${endHour}:${endMinute.toString().padStart(2, '0')}`
      },
      serviceDuration: serviceDuration + ' minutes',
      firstSlotTime: slotDate.toLocaleString(),
      lastSlotTime: endTime.toLocaleString()
    });

    // Generate all possible time slots (30-minute intervals)
    // Allow slots to extend past closing time - receptionist will handle approval
    let slotCount = 0;
    while (slotDate.getTime() < endTime.getTime()) {
      const slotEnd = new Date(slotDate.getTime() + serviceDuration * 60000);
      
      // Determine availability based on 2-hour advance booking rule
      let isAvailable = true;
      let disabledReason = null;
      
      // If it's today, check if slot is at least 2 hours from now
      if (isToday && slotDate.getTime() < minBookingTime.getTime()) {
        isAvailable = false;
        disabledReason = 'within 2-hour window';
        
        // Debug log for first few slots
        if (slotCount < 5) {
          console.log(`⏰ Slot ${slotDate.toLocaleTimeString()}:`, {
            slotTime: slotDate.getTime(),
            minBookingTime: minBookingTime.getTime(),
            isBeforeMinTime: slotDate.getTime() < minBookingTime.getTime(),
            isAvailable,
            reason: disabledReason
          });
        }
      }
      
      // Check availability from appointments (conflicts with other bookings) - only if time slot itself is available
      if (isAvailable) {
        if (stylistId) {
          // Check if this specific stylist has conflicts
          for (const apt of dayAppointments) {
            const aptStart = apt.appointmentDate;
            const aptEnd = new Date(aptStart.getTime() + (apt.duration || 60) * 60000);
            
            // Check if stylist is assigned to this appointment
            const hasStylist = apt.services?.some(svc => svc.stylistId === stylistId);
            if (hasStylist) {
              // Check for time overlap
              if (slotDate < aptEnd && slotEnd > aptStart) {
                isAvailable = false;
                break;
              }
            }
          }
        } else {
          // For general availability (no specific stylist), check overall branch capacity
          // Count overlapping appointments
          let overlappingCount = 0;
          for (const apt of dayAppointments) {
            const aptStart = apt.appointmentDate;
            const aptEnd = new Date(aptStart.getTime() + (apt.duration || 60) * 60000);
            if (slotDate < aptEnd && slotEnd > aptStart) {
              overlappingCount++;
            }
          }
          // You can set a maximum capacity per time slot if needed
          // For now, we allow all slots if no stylist is specified
        }
      }
      
      slots.push({
        time: new Date(slotDate),
        available: isAvailable
      });
      
      slotCount++;

      slotDate.setMinutes(slotDate.getMinutes() + 30); // 30-minute intervals
    }

    console.log(`📊 GENERATED ${slots.length} SLOTS:`, {
      totalSlots: slots.length,
      availableSlots: slots.filter(s => s.available).length,
      unavailableSlots: slots.filter(s => !s.available).length,
      firstSlot: slots[0]?.time?.toLocaleTimeString(),
      lastSlot: slots[slots.length - 1]?.time?.toLocaleTimeString(),
      allSlotTimes: slots.map(s => ({ 
        time: s.time.toLocaleTimeString(), 
        available: s.available 
      }))
    });

    return { slots, message: null };
  } catch (error) {
    console.error('Error getting available time slots:', error);
    return { slots: [], message: 'Error loading time slots. Please try again.' };
  }
};

/**
 * Get appointment statistics for a branch
 */
export const getAppointmentStats = async (branchId, startDate, endDate) => {
  try {
    const appointments = await getAppointmentsByDateRange(branchId, startDate, endDate);

    const stats = {
      total: appointments.length,
      pending: appointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
      confirmed: appointments.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      completed: appointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      cancelled: appointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      noShow: appointments.filter(a => a.status === APPOINTMENT_STATUS.NO_SHOW).length,
      inService: appointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length
    };

    return stats;
  } catch (error) {
    console.error('Error getting appointment stats:', error);
    return null;
  }
};

/**
 * Get today's appointment statistics for a branch (Receptionist)
 */
export const getTodayAppointmentStats = async (branchId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await getAppointmentsByDateRange(branchId, today, tomorrow);

    const stats = {
      today: appointments.length,
      pending: appointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
      confirmed: appointments.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      completed: appointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      cancelled: appointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      inService: appointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length
    };

    return stats;
  } catch (error) {
    console.error('Error getting today appointment stats:', error);
    return null;
  }
};

/**
 * Get today's appointment statistics for a stylist
 */
export const getStylistTodayStats = async (stylistId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('stylistId', '==', stylistId),
      where('appointmentDate', '>=', Timestamp.fromDate(today)),
      where('appointmentDate', '<', Timestamp.fromDate(tomorrow))
    );

    const snapshot = await getDocs(q);
    const appointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // For multi-service appointments, also get appointments where stylist is in services array
    const multiServiceQuery = query(
      appointmentsRef,
      where('appointmentDate', '>=', Timestamp.fromDate(today)),
      where('appointmentDate', '<', Timestamp.fromDate(tomorrow))
    );

    const multiServiceSnapshot = await getDocs(multiServiceQuery);
    const multiServiceAppointments = multiServiceSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(apt => 
        apt.services && 
        apt.services.some(svc => svc.stylistId === stylistId)
      );

    // Combine and deduplicate
    const allAppointments = [...appointments];
    multiServiceAppointments.forEach(apt => {
      if (!allAppointments.find(a => a.id === apt.id)) {
        allAppointments.push(apt);
      }
    });

    const stats = {
      today: allAppointments.length,
      pending: allAppointments.filter(a => 
        a.status === APPOINTMENT_STATUS.PENDING || 
        a.status === APPOINTMENT_STATUS.CONFIRMED
      ).length,
      inService: allAppointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length,
      completed: allAppointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length
    };

    return stats;
  } catch (error) {
    console.error('Error getting stylist today stats:', error);
    return null;
  }
};

export default {
  getAllAppointments,
  getAppointmentsByBranch,
  getAppointmentsByClient,
  getAppointmentsByStylist,
  getAppointmentsByDateRange,
  getAppointmentById,
  createAppointment,
  createWalkInAppointment,
  updateAppointment,
  updateAppointmentStatus,
  checkInAppointment,
  cancelAppointment,
  deleteAppointment,
  checkStylistAvailability,
  getAvailableTimeSlots,
  getAppointmentStats,
  getTodayAppointmentStats,
  getStylistTodayStats,
  APPOINTMENT_STATUS
};
