/**
 * Appointment Reminder Service
 * Handles sending reminder emails to clients a day before their appointments
 */

import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAppointmentsByBranch } from './appointmentService';
import { getBranchById } from './branchService';
import { sendAppointmentReminderEmail } from './emailService';
import { APPOINTMENT_STATUS } from './appointmentService';
import toast from 'react-hot-toast';

const APPOINTMENTS_COLLECTION = 'appointments';

/**
 * Check and send reminder emails for appointments happening tomorrow
 * @param {string} branchId - Optional branch ID to filter by branch. If not provided, checks all branches
 * @returns {Promise<Object>} Result with count of reminders sent
 */
export const sendAppointmentReminders = async (branchId = null) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate tomorrow's date range
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    console.log('Checking for appointments on:', tomorrow.toISOString());
    
    // Build query
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const constraints = [
      where('appointmentDate', '>=', Timestamp.fromDate(tomorrow)),
      where('appointmentDate', '<=', Timestamp.fromDate(tomorrowEnd)),
      where('status', 'in', [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED])
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
    
    console.log(`Found ${appointments.length} appointments for tomorrow`);
    
    // Filter appointments that haven't received reminders yet
    const appointmentsNeedingReminders = appointments.filter(apt => {
      // Skip if already sent reminder
      if (apt.reminderSent24h === true) {
        return false;
      }
      
      // Skip if no email
      if (!apt.clientEmail) {
        console.log(`Skipping appointment ${apt.id}: No client email`);
        return false;
      }
      
      // Skip walk-ins
      if (apt.isWalkIn === true) {
        return false;
      }
      
      return true;
    });
    
    console.log(`${appointmentsNeedingReminders.length} appointments need reminders`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Send reminders for each appointment
    for (const appointment of appointmentsNeedingReminders) {
      try {
        // Get branch data
        const branchData = await getBranchById(appointment.branchId);
        
        // Send reminder email
        const result = await sendAppointmentReminderEmail(appointment, branchData);
        
        if (result.success) {
          // Mark reminder as sent
          const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointment.id);
          await updateDoc(appointmentRef, {
            reminderSent24h: true,
            reminderSent24hAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          
          successCount++;
          console.log(`✅ Reminder sent to ${appointment.clientEmail} for appointment ${appointment.id}`);
        } else {
          errorCount++;
          errors.push({
            appointmentId: appointment.id,
            clientEmail: appointment.clientEmail,
            error: result.error || result.message
          });
          console.error(`❌ Failed to send reminder to ${appointment.clientEmail}:`, result.error);
        }
      } catch (error) {
        errorCount++;
        errors.push({
          appointmentId: appointment.id,
          clientEmail: appointment.clientEmail,
          error: error.message
        });
        console.error(`❌ Error processing reminder for appointment ${appointment.id}:`, error);
      }
    }
    
    return {
      success: true,
      totalAppointments: appointments.length,
      remindersSent: successCount,
      errors: errorCount,
      errorDetails: errors
    };
  } catch (error) {
    console.error('Error sending appointment reminders:', error);
    return {
      success: false,
      error: error.message,
      remindersSent: 0,
      errors: 0
    };
  }
};

/**
 * Manually trigger reminder check (can be called from admin panel or scheduled task)
 * @param {string} branchId - Optional branch ID
 * @returns {Promise<Object>} Result
 */
export const triggerReminderCheck = async (branchId = null) => {
  try {
    const result = await sendAppointmentReminders(branchId);
    
    if (result.success) {
      if (result.remindersSent > 0) {
        toast.success(`Sent ${result.remindersSent} appointment reminder(s)`);
      } else {
        toast.info('No reminders to send at this time');
      }
    } else {
      toast.error(`Failed to send reminders: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error triggering reminder check:', error);
    toast.error('Failed to check for reminders');
    return {
      success: false,
      error: error.message
    };
  }
};

