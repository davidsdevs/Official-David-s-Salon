// src/services/appointmentApiService.js
import { getAppointments, getAppointmentById } from './appointmentService';

class AppointmentApiService {
  /**
   * Get appointments with filters
   * @param {Object} filters - Filter criteria
   * @param {string} currentUserRole - Current user role
   * @param {string} currentUserId - Current user ID
   * @param {number} pageSize - Page size
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Object>} Appointments with pagination info
   */
  async getAppointments(filters = {}, currentUserRole = 'branch_manager', currentUserId = 'current_user', pageSize = 20, lastDoc = null) {
    try {
      const result = await getAppointments(filters, currentUserRole, currentUserId, pageSize, lastDoc);

      return {
        appointments: result.appointments || [],
        lastDoc: result.lastDoc || null,
        hasMore: result.hasMore || false
      };
    } catch (error) {
      console.error('Error getting appointments:', error);
      throw error;
    }
  }

  /**
   * Get appointment by ID
   * @param {string} appointmentId - Appointment ID
   * @param {string} currentUserRole - Current user role
   * @param {string} currentUserId - Current user ID
   * @returns {Promise<Object>} Appointment data
   */
  async getAppointmentById(appointmentId, currentUserRole = 'branch_manager', currentUserId = 'current_user') {
    try {
      const result = await getAppointmentById(appointmentId, currentUserRole, currentUserId);
      return result;
    } catch (error) {
      console.error('Error getting appointment by ID:', error);
      throw error;
    }
  }
}

export const appointmentApiService = new AppointmentApiService();

