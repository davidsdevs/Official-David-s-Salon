/**
 * Pending Appointments Service
 * Handles tracking and managing pending appointments that need attention
 */

import { collection, query, where, getDocs, updateDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { APPOINTMENT_STATUS } from './appointmentService';
import toast from 'react-hot-toast';

const APPOINTMENTS_COLLECTION = 'appointments';

/**
 * Get pending appointments that are approaching or have passed their date
 * @param {string} branchId - Optional branch ID to filter
 * @param {number} hoursBefore - Hours before appointment to consider "approaching" (default: 24)
 * @returns {Promise<Object>} Object with approaching and expired appointments
 */
export const getPendingAppointmentsNeedingAttention = async (branchId = null, hoursBefore = 24) => {
  try {
    const now = new Date();
    const approachingThreshold = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    
    // Build query for pending appointments
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const constraints = [
      where('status', '==', APPOINTMENT_STATUS.PENDING),
      where('appointmentDate', '<=', Timestamp.fromDate(approachingThreshold)),
      orderBy('appointmentDate', 'asc')
    ];
    
    if (branchId) {
      constraints.push(where('branchId', '==', branchId));
    }
    
    const q = query(appointmentsRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const appointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
    
    // Separate into approaching and expired
    const approaching = [];
    const expired = [];
    
    appointments.forEach(apt => {
      const aptDate = apt.appointmentDate;
      if (!aptDate) return;
      
      if (aptDate < now) {
        // Appointment date has passed
        expired.push(apt);
      } else if (aptDate <= approachingThreshold) {
        // Appointment is approaching (within threshold)
        approaching.push(apt);
      }
    });
    
    return {
      success: true,
      approaching: approaching,
      expired: expired,
      total: appointments.length
    };
  } catch (error) {
    console.error('Error fetching pending appointments:', error);
    return {
      success: false,
      error: error.message,
      approaching: [],
      expired: [],
      total: 0
    };
  }
};

/**
 * Auto-update expired pending appointments to cancelled status
 * @param {string} branchId - Optional branch ID to filter
 * @param {boolean} autoCancel - Whether to auto-cancel expired appointments (default: true)
 * @returns {Promise<Object>} Result with count of updated appointments
 */
export const handleExpiredPendingAppointments = async (branchId = null, autoCancel = true) => {
  try {
    const result = await getPendingAppointmentsNeedingAttention(branchId, 0);
    
    if (!result.success || result.expired.length === 0) {
      return {
        success: true,
        updated: 0,
        message: 'No expired pending appointments found'
      };
    }
    
    let updatedCount = 0;
    const errors = [];
    
    for (const appointment of result.expired) {
      try {
        const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointment.id);
        
        if (autoCancel) {
          // Auto-cancel expired pending appointments
          await updateDoc(appointmentRef, {
            status: APPOINTMENT_STATUS.CANCELLED,
            cancellationReason: 'Auto-cancelled: Appointment date passed without confirmation',
            cancelledAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        } else {
          // Just mark as needing attention
          await updateDoc(appointmentRef, {
            needsAttention: true,
            attentionReason: 'Appointment date has passed without confirmation',
            updatedAt: Timestamp.now()
          });
        }
        
        updatedCount++;
        console.log(`✅ Updated expired appointment ${appointment.id}`);
      } catch (error) {
        errors.push({
          appointmentId: appointment.id,
          error: error.message
        });
        console.error(`❌ Error updating appointment ${appointment.id}:`, error);
      }
    }
    
    return {
      success: true,
      updated: updatedCount,
      errors: errors.length,
      errorDetails: errors
    };
  } catch (error) {
    console.error('Error handling expired appointments:', error);
    return {
      success: false,
      error: error.message,
      updated: 0
    };
  }
};

/**
 * Get pending appointments count for dashboard
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} Counts of pending appointments
 */
export const getPendingAppointmentsCount = async (branchId) => {
  try {
    const result = await getPendingAppointmentsNeedingAttention(branchId, 24);
    
    return {
      success: true,
      approaching: result.approaching.length,
      expired: result.expired.length,
      total: result.total
    };
  } catch (error) {
    console.error('Error getting pending appointments count:', error);
    return {
      success: false,
      error: error.message,
      approaching: 0,
      expired: 0,
      total: 0
    };
  }
};

/**
 * Check and handle pending appointments (to be called periodically)
 * @param {string} branchId - Optional branch ID
 * @param {boolean} autoCancel - Whether to auto-cancel expired (default: true)
 * @returns {Promise<Object>} Result
 */
export const checkPendingAppointments = async (branchId = null, autoCancel = true) => {
  try {
    // Handle expired appointments
    const expiredResult = await handleExpiredPendingAppointments(branchId, autoCancel);
    
    // Get approaching appointments
    const approachingResult = await getPendingAppointmentsNeedingAttention(branchId, 24);
    
    return {
      success: true,
      expired: {
        updated: expiredResult.updated || 0,
        errors: expiredResult.errors || 0
      },
      approaching: {
        count: approachingResult.approaching.length,
        appointments: approachingResult.approaching
      },
      total: approachingResult.total
    };
  } catch (error) {
    console.error('Error checking pending appointments:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

