/**
 * Pending Appointments Service
 * Handles checking and managing pending appointments that need attention
 */

import { 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  doc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { APPOINTMENT_STATUS } from './appointmentService';
import { logActivity } from './activityService';

const APPOINTMENTS_COLLECTION = 'appointments';

/**
 * Get count of pending appointments needing attention
 * @param {string} branchId - Branch ID
 * @returns {Promise<{success: boolean, approaching: number, expired: number}>}
 */
export const getPendingAppointmentsCount = async (branchId) => {
  try {
    if (!branchId) {
      return { success: false, approaching: 0, expired: 0 };
    }

    const now = new Date();
    const hoursThreshold = 24; // 24 hours before appointment
    const thresholdTime = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      where('status', '==', APPOINTMENT_STATUS.PENDING)
    );

    const snapshot = await getDocs(q);
    let approaching = 0;
    let expired = 0;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const appointmentDate = data.appointmentDate?.toDate 
        ? data.appointmentDate.toDate() 
        : data.appointmentDate instanceof Date 
        ? data.appointmentDate 
        : new Date(data.appointmentDate);

      if (appointmentDate < now) {
        // Expired - appointment time has passed
        expired++;
      } else if (appointmentDate <= thresholdTime) {
        // Approaching - within 24 hours
        approaching++;
      }
    });

    return {
      success: true,
      approaching,
      expired
    };
  } catch (error) {
    console.error('Error getting pending appointments count:', error);
    return {
      success: false,
      approaching: 0,
      expired: 0
    };
  }
};

/**
 * Check pending appointments and optionally auto-cancel expired ones
 * @param {string} branchId - Branch ID
 * @param {boolean} autoCancel - Whether to automatically cancel expired appointments
 * @returns {Promise<{success: boolean, cancelled: number, approaching: number, expired: number}>}
 */
export const checkPendingAppointments = async (branchId, autoCancel = false) => {
  try {
    if (!branchId) {
      return { success: false, cancelled: 0, approaching: 0, expired: 0 };
    }

    const now = new Date();
    const hoursThreshold = 24;
    const thresholdTime = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      where('status', '==', APPOINTMENT_STATUS.PENDING)
    );

    const snapshot = await getDocs(q);
    let cancelled = 0;
    let approaching = 0;
    let expired = 0;

    const cancelPromises = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const appointmentDate = data.appointmentDate?.toDate 
        ? data.appointmentDate.toDate() 
        : data.appointmentDate instanceof Date 
        ? data.appointmentDate 
        : new Date(data.appointmentDate);

      if (appointmentDate < now) {
        // Expired - appointment time has passed
        expired++;
        
        if (autoCancel) {
          // Auto-cancel expired appointments
          const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, docSnapshot.id);
          cancelPromises.push(
            updateDoc(appointmentRef, {
              status: APPOINTMENT_STATUS.CANCELLED,
              cancelledAt: Timestamp.now(),
              cancellationReason: 'Auto-cancelled: Appointment time has passed without confirmation'
            }).then(() => {
              // Log activity
              return logActivity({
                performedBy: 'system',
                action: 'AUTO_CANCEL_APPOINTMENT',
                targetType: 'appointment',
                targetId: docSnapshot.id,
                details: 'Auto-cancelled expired pending appointment',
                metadata: { 
                  originalStatus: APPOINTMENT_STATUS.PENDING,
                  appointmentDate: appointmentDate.toISOString()
                }
              });
            })
          );
          cancelled++;
        }
      } else if (appointmentDate <= thresholdTime) {
        // Approaching - within 24 hours
        approaching++;
      }
    });

    // Wait for all cancellations to complete
    if (cancelPromises.length > 0) {
      await Promise.all(cancelPromises);
    }

    return {
      success: true,
      cancelled,
      approaching,
      expired
    };
  } catch (error) {
    console.error('Error checking pending appointments:', error);
    return {
      success: false,
      cancelled: 0,
      approaching: 0,
      expired: 0
    };
  }
};

/**
 * Get detailed list of pending appointments needing attention
 * @param {string} branchId - Branch ID
 * @param {number} hoursThreshold - Hours before appointment to consider "approaching" (default: 24)
 * @returns {Promise<{success: boolean, approaching: Array, expired: Array}>}
 */
export const getPendingAppointmentsNeedingAttention = async (branchId, hoursThreshold = 24) => {
  try {
    if (!branchId) {
      return { success: false, approaching: [], expired: [] };
    }

    const now = new Date();
    const thresholdTime = new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000);

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      where('status', '==', APPOINTMENT_STATUS.PENDING)
    );

    const snapshot = await getDocs(q);
    const approaching = [];
    const expired = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const appointmentDate = data.appointmentDate?.toDate 
        ? data.appointmentDate.toDate() 
        : data.appointmentDate instanceof Date 
        ? data.appointmentDate 
        : new Date(data.appointmentDate);

      const appointment = {
        id: docSnapshot.id,
        ...data,
        appointmentDate
      };

      if (appointmentDate < now) {
        // Expired - appointment time has passed
        expired.push(appointment);
      } else if (appointmentDate <= thresholdTime) {
        // Approaching - within threshold hours
        approaching.push(appointment);
      }
    });

    // Sort by appointment date (soonest first)
    approaching.sort((a, b) => a.appointmentDate - b.appointmentDate);
    expired.sort((a, b) => b.appointmentDate - a.appointmentDate); // Most recent expired first

    return {
      success: true,
      approaching,
      expired
    };
  } catch (error) {
    console.error('Error getting pending appointments needing attention:', error);
    return {
      success: false,
      approaching: [],
      expired: []
    };
  }
};

