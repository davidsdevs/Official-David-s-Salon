/**
 * Schedule Validator Utility
 * Functions for checking stylist availability based on schedules
 */

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { APPOINTMENT_STATUS } from './constants';

/**
 * Check if a stylist is available at a specific date and time
 * @param {Object} stylist - Stylist object with schedule data
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} time - Time string (HH:MM)
 * @param {number} duration - Service duration in minutes
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} { available: boolean, reason: string }
 */
export const isStylistAvailable = async (stylist, date, time, duration = 60, branchId) => {
  if (!stylist || !date || !time) {
    return { available: false, reason: 'Missing required parameters' };
  }

  // Check if stylist is available anytime (can be bothered)
  if (stylist.availableAnytime === true) {
    console.log('✅ [Schedule Validator] Stylist is available anytime, skipping schedule check');
    
    // Still need to check for conflicts and leave, but skip schedule validation
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const appointmentDate = new Date(year, month - 1, day, hours, minutes);
    const appointmentEnd = new Date(appointmentDate.getTime() + duration * 60000);
    
    // Check for leave requests
    try {
      const leaveRef = collection(db, 'leave_requests');
      const leaveQuery = query(
        leaveRef,
        where('stylistId', '==', stylist.id),
        where('status', '==', 'approved')
      );
      
      const leaveSnapshot = await getDocs(leaveQuery);
      
      for (const leaveDoc of leaveSnapshot.docs) {
        const leave = leaveDoc.data();
        const leaveStart = leave.startDate?.toDate?.() || new Date(leave.startDate);
        const leaveEnd = leave.endDate?.toDate?.() || new Date(leave.endDate);
        
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(23, 59, 59, 999);
        
        const checkDate = new Date(year, month - 1, day);
        checkDate.setHours(0, 0, 0, 0);
        
        if (checkDate >= leaveStart && checkDate <= leaveEnd) {
          const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return { 
            available: false, 
            reason: `On leave (${formatDate(leaveStart)} - ${formatDate(leaveEnd)})` 
          };
        }
      }
    } catch (error) {
      console.error('Error checking leave requests:', error);
    }
    
    // Check for existing appointments
    try {
      const appointmentsRef = collection(db, 'appointments');
      const dateStart = new Date(year, month - 1, day, 0, 0, 0);
      const dateEnd = new Date(year, month - 1, day, 23, 59, 59);
      
      const appointmentsQuery = query(
        appointmentsRef,
        where('appointmentDate', '>=', Timestamp.fromDate(dateStart)),
        where('appointmentDate', '<=', Timestamp.fromDate(dateEnd)),
        where('status', 'in', [
          APPOINTMENT_STATUS.PENDING,
          APPOINTMENT_STATUS.CONFIRMED,
          APPOINTMENT_STATUS.IN_SERVICE
        ])
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      
      for (const aptDoc of appointmentsSnapshot.docs) {
        const apt = aptDoc.data();
        
        let isStylistAssigned = false;
        if (apt.stylistId === stylist.id) {
          isStylistAssigned = true;
        }
        if (apt.services && Array.isArray(apt.services)) {
          const hasStylist = apt.services.some(svc => svc.stylistId === stylist.id);
          if (hasStylist) {
            isStylistAssigned = true;
          }
        }
        
        if (!isStylistAssigned) continue;
        
        const existingStart = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
        const existingDuration = apt.duration || 60;
        const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);
        
        if (
          (appointmentDate >= existingStart && appointmentDate < existingEnd) ||
          (appointmentEnd > existingStart && appointmentEnd <= existingEnd) ||
          (appointmentDate <= existingStart && appointmentEnd >= existingEnd)
        ) {
          const formatTime = (d) => {
            const h = d.getHours();
            const m = d.getMinutes();
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
          };
          return { 
            available: false, 
            reason: `Already booked (${formatTime(existingStart)} - ${formatTime(existingEnd)})` 
          };
        }
      }
    } catch (error) {
      console.error('Error checking appointments:', error);
    }
    
    // Available anytime and no conflicts
    return { available: true, reason: '' };
  }

  // Regular schedule validation for stylists who are NOT available anytime
  // Parse date and time
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const appointmentDate = new Date(year, month - 1, day, hours, minutes);
  const dayOfWeek = appointmentDate.getDay(); // 0 = Sunday, 6 = Saturday
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];

  // Fetch stylist's schedule from schedules collection
  let schedule = null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const schedulesRef = collection(db, 'schedules');
    const scheduleQuery = query(
      schedulesRef,
      where('branchId', '==', branchId),
      where('isActive', '==', true)
    );
    
    console.log('🔍 [Schedule Validator] Querying schedules with branchId:', branchId);
    
    const scheduleSnapshot = await getDocs(scheduleQuery);
    
    console.log('🔍 [Schedule Validator] Query results:', {
      found: scheduleSnapshot.size,
      docs: scheduleSnapshot.docs.map(d => ({ id: d.id, branchId: d.data().branchId, isActive: d.data().isActive }))
    });
    
    if (!scheduleSnapshot.empty) {
      // Check ALL active schedules to find this stylist's shift
      for (const scheduleDoc of scheduleSnapshot.docs) {
        const scheduleData = scheduleDoc.data();
        const shifts = scheduleData.shifts || {};
        const stylistShift = shifts[stylist.id];
        
        if (stylistShift && stylistShift[dayName]) {
          console.log('✅ [Schedule Validator] Found stylist shift in schedule:', scheduleDoc.id);
          schedule = stylistShift[dayName];
          break; // Found the shift, stop searching
        }
      }
      
      console.log('🔍 [Schedule Validator] Checking availability:', {
        stylistName: `${stylist.firstName} ${stylist.lastName}`,
        stylistId: stylist.id,
        date,
        dayOfWeek,
        dayName,
        foundSchedule: !!schedule,
        scheduleDetails: schedule
      });
    } else {
      console.log('❌ [Schedule Validator] No active schedule found for branch:', branchId);
    }
  } catch (error) {
    console.error('Error fetching schedule:', error);
  }

  // 1. Check if stylist works on this day
  // Schedule exists if it has start/end times (even if isWorking is not explicitly set)
  if (!schedule || (!schedule.isWorking && !schedule.start)) {
    console.log('❌ [Schedule Validator] Stylist not working on', dayName);
    return { 
      available: false, 
      reason: `Not scheduled to work on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s` 
    };
  }

  // 2. Check if time slot is within working hours
  const workStartTime = schedule.startTime || schedule.start || '09:00';
  const workEndTime = schedule.endTime || schedule.end || '18:00';
  const [workStartH, workStartM] = workStartTime.split(':').map(Number);
  const [workEndH, workEndM] = workEndTime.split(':').map(Number);
  
  const workStart = new Date(year, month - 1, day, workStartH, workStartM);
  const workEnd = new Date(year, month - 1, day, workEndH, workEndM);
  const appointmentEnd = new Date(appointmentDate.getTime() + duration * 60000);

  if (appointmentDate < workStart || appointmentEnd > workEnd) {
    const formatTime = (h, m) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    };
    return { 
      available: false, 
      reason: `Outside working hours (${formatTime(workStartH, workStartM)} - ${formatTime(workEndH, workEndM)})` 
    };
  }

  // 3. Check for leave requests
  try {
    const leaveRef = collection(db, 'leave_requests');
    const leaveQuery = query(
      leaveRef,
      where('stylistId', '==', stylist.id),
      where('status', '==', 'approved')
    );
    
    const leaveSnapshot = await getDocs(leaveQuery);
    
    for (const leaveDoc of leaveSnapshot.docs) {
      const leave = leaveDoc.data();
      const leaveStart = leave.startDate?.toDate?.() || new Date(leave.startDate);
      const leaveEnd = leave.endDate?.toDate?.() || new Date(leave.endDate);
      
      // Set to start of day for comparison
      leaveStart.setHours(0, 0, 0, 0);
      leaveEnd.setHours(23, 59, 59, 999);
      
      const checkDate = new Date(year, month - 1, day);
      checkDate.setHours(0, 0, 0, 0);
      
      if (checkDate >= leaveStart && checkDate <= leaveEnd) {
        const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return { 
          available: false, 
          reason: `On leave (${formatDate(leaveStart)} - ${formatDate(leaveEnd)})` 
        };
      }
    }
  } catch (error) {
    console.error('Error checking leave requests:', error);
  }

  // 4. Check for existing appointments (not fully booked)
  try {
    const appointmentsRef = collection(db, 'appointments');
    
    // Get appointments for this date
    const dateStart = new Date(year, month - 1, day, 0, 0, 0);
    const dateEnd = new Date(year, month - 1, day, 23, 59, 59);
    
    const appointmentsQuery = query(
      appointmentsRef,
      where('appointmentDate', '>=', Timestamp.fromDate(dateStart)),
      where('appointmentDate', '<=', Timestamp.fromDate(dateEnd)),
      where('status', 'in', [
        APPOINTMENT_STATUS.PENDING,
        APPOINTMENT_STATUS.CONFIRMED,
        APPOINTMENT_STATUS.IN_SERVICE
      ])
    );
    
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    
    // Check for time conflicts
    for (const aptDoc of appointmentsSnapshot.docs) {
      const apt = aptDoc.data();
      
      // Check if this stylist is assigned
      let isStylistAssigned = false;
      
      // Check old format (single stylistId)
      if (apt.stylistId === stylist.id) {
        isStylistAssigned = true;
      }
      
      // Check new format (services array)
      if (apt.services && Array.isArray(apt.services)) {
        const hasStylist = apt.services.some(svc => svc.stylistId === stylist.id);
        if (hasStylist) {
          isStylistAssigned = true;
        }
      }
      
      if (!isStylistAssigned) continue;
      
      // Check for time overlap
      const existingStart = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
      const existingDuration = apt.duration || 60;
      const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);
      
      // Check if times overlap
      if (
        (appointmentDate >= existingStart && appointmentDate < existingEnd) ||
        (appointmentEnd > existingStart && appointmentEnd <= existingEnd) ||
        (appointmentDate <= existingStart && appointmentEnd >= existingEnd)
      ) {
        const formatTime = (d) => {
          const h = d.getHours();
          const m = d.getMinutes();
          const period = h >= 12 ? 'PM' : 'AM';
          const hour12 = h % 12 || 12;
          return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
        };
        return { 
          available: false, 
          reason: `Already booked (${formatTime(existingStart)} - ${formatTime(existingEnd)})` 
        };
      }
    }
  } catch (error) {
    console.error('Error checking appointments:', error);
  }

  return { available: true, reason: '' };
};

/**
 * Filter stylists by availability for a specific date and time
 * @param {Array} stylists - Array of stylist objects
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} time - Time string (HH:MM)
 * @param {number} duration - Service duration in minutes
 * @param {string} branchId - Branch ID
 * @param {boolean} includeUnavailable - Include unavailable stylists with reason
 * @returns {Promise<Array>} Array of stylists with availability info
 */
export const filterStylistsByAvailability = async (
  stylists,
  date,
  time,
  duration = 60,
  branchId,
  includeUnavailable = false
) => {
  if (!stylists || !Array.isArray(stylists) || stylists.length === 0) {
    return [];
  }

  const results = await Promise.all(
    stylists.map(async (stylist) => {
      const availability = await isStylistAvailable(stylist, date, time, duration, branchId);
      return {
        ...stylist,
        isAvailable: availability.available,
        unavailableReason: availability.reason
      };
    })
  );

  if (includeUnavailable) {
    return results;
  }

  return results.filter(s => s.isAvailable);
};

/**
 * Get availability status for a single stylist
 * @param {string} stylistId - Stylist ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} time - Time string (HH:MM)
 * @param {number} duration - Service duration in minutes
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} { available: boolean, reason: string }
 */
export const getStylistAvailabilityStatus = async (stylistId, date, time, duration, branchId) => {
  try {
    // Fetch stylist data
    const { doc, getDoc } = await import('firebase/firestore');
    const stylistDoc = await getDoc(doc(db, 'users', stylistId));
    
    if (!stylistDoc.exists()) {
      return { available: false, reason: 'Stylist not found' };
    }

    const stylist = { id: stylistDoc.id, ...stylistDoc.data() };
    return await isStylistAvailable(stylist, date, time, duration, branchId);
  } catch (error) {
    console.error('Error getting stylist availability:', error);
    return { available: false, reason: 'Error checking availability' };
  }
};
