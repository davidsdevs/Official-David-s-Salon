/**
 * Expo Push Notification Service
 * Sends push notifications directly to Expo mobile apps via the Expo Push API
 * No Cloud Functions or Blaze plan required!
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Use proxy in development to avoid CORS, direct URL in production
const EXPO_PUSH_URL = import.meta.env.DEV 
  ? '/api/expo-push/send'  // Proxied through Vite dev server
  : 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification via Expo Push API
 * @param {string|string[]} pushTokens - Expo push token(s)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data to send with notification
 * @returns {Promise<Object>} - Response from Expo Push API
 */
export const sendExpoPushNotification = async (pushTokens, title, body, data = {}) => {
  try {
    const tokens = Array.isArray(pushTokens) ? pushTokens : [pushTokens];
    
    console.log('📱 Attempting to send push notification');
    console.log('📱 Tokens received:', tokens);
    
    // Filter out invalid tokens
    const validTokens = tokens.filter(token => 
      token && 
      typeof token === 'string' && 
      token.startsWith('ExponentPushToken[')
    );
    
    if (validTokens.length === 0) {
      console.log('📱 No valid Expo push tokens found. Tokens were:', tokens);
      return { success: false, message: 'No valid push tokens' };
    }
    
    // Create messages for each token
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default'
    }));
    
    console.log('📱 Sending push notifications to', validTokens.length, 'device(s)');
    console.log('📱 Message payload:', JSON.stringify(messages, null, 2));
    
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    const result = await response.json();
    console.log('📱 Expo Push API response:', JSON.stringify(result, null, 2));
    
    // Check for errors in the response
    if (result.data) {
      result.data.forEach((item, index) => {
        if (item.status === 'error') {
          console.error(`📱 Push error for token ${index}:`, item.message, item.details);
        } else {
          console.log(`📱 Push success for token ${index}:`, item.status);
        }
      });
    }
    
    return { success: true, result };
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user's Expo push tokens from Firestore (role-based)
 * @param {string} userId - User ID
 * @param {string} role - User role ('client' or 'stylist')
 * @returns {Promise<string[]>} - Array of push tokens
 */
export const getUserPushTokens = async (userId, role) => {
  try {
    if (!userId) {
      console.log('📱 getUserPushTokens: No userId provided');
      return [];
    }
    
    if (!role) {
      console.log('📱 getUserPushTokens: No role provided');
      return [];
    }
    
    console.log('📱 Fetching push tokens for user:', userId, 'role:', role);
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      
      // Get role-specific tokens based on the guide
      let tokens = [];
      if (role === 'client') {
        tokens = userData.clientPushTokens || [];
      } else if (role === 'stylist') {
        tokens = userData.stylistPushTokens || [];
      }
      
      // Filter valid tokens
      const validTokens = tokens.filter(token => 
        token && 
        typeof token === 'string' && 
        (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
      );
      
      if (validTokens.length > 0) {
        console.log('📱 Found', validTokens.length, 'push token(s) for user', userId, 'role:', role);
      } else {
        console.log('📱 No push tokens found for user', userId, 'role:', role);
        console.log('📱 User data fields:', Object.keys(userData).join(', '));
      }
      
      return validTokens;
    }
    
    console.log('📱 User document not found:', userId);
    return [];
  } catch (error) {
    console.error('Error getting user push tokens:', error);
    return [];
  }
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use getUserPushTokens with role parameter instead
 */
export const getUserPushToken = async (userId) => {
  console.warn('⚠️ getUserPushToken is deprecated. Use getUserPushTokens with role parameter.');
  // Try to get tokens from both roles and return the first one found
  const clientTokens = await getUserPushTokens(userId, 'client');
  if (clientTokens.length > 0) return clientTokens[0];
  
  const stylistTokens = await getUserPushTokens(userId, 'stylist');
  if (stylistTokens.length > 0) return stylistTokens[0];
  
  return null;
};

/**
 * Debug function to check if a user has a push token
 * Call from browser console: window.checkPushToken('userId')
 */
export const debugCheckPushToken = async (userId) => {
  console.log('=== DEBUG: Checking push token for user ===');
  console.log('User ID:', userId);
  
  const token = await getUserPushToken(userId);
  
  if (token) {
    console.log('✅ Push token found:', token);
    console.log('Token is valid Expo format:', token.startsWith('ExponentPushToken['));
  } else {
    console.log('❌ No push token found');
    console.log('The mobile app needs to save the expoPushToken to the user document in Firestore');
  }
  
  return token;
};

// Expose debug function to window for console access
if (typeof window !== 'undefined') {
  window.checkPushToken = debugCheckPushToken;
}

/**
 * Get multiple users' push tokens with role support
 * @param {Array<{userId: string, role: string}>} userRoles - Array of user IDs with their roles
 * @returns {Promise<string[]>} - Array of push tokens
 */
export const getMultipleUserPushTokens = async (userRoles) => {
  try {
    const allTokens = [];
    
    for (const { userId, role } of userRoles) {
      const tokens = await getUserPushTokens(userId, role);
      allTokens.push(...tokens);
    }
    
    return allTokens;
  } catch (error) {
    console.error('Error getting multiple push tokens:', error);
    return [];
  }
};


/**
 * Helper to convert Firestore Timestamp or any date format to Date object
 */
const toDate = (dateValue) => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (dateValue.toDate && typeof dateValue.toDate === 'function') return dateValue.toDate(); // Firestore Timestamp
  if (dateValue.seconds) return new Date(dateValue.seconds * 1000); // Firestore Timestamp as plain object
  return new Date(dateValue);
};

/**
 * Send appointment confirmation notification to client and stylist(s)
 * @param {Object} appointment - Appointment data
 * @returns {Promise<Object>} - Result
 */
export const sendAppointmentConfirmedNotification = async (appointment) => {
  try {
    const userRoles = [];
    
    console.log('📱 sendAppointmentConfirmedNotification called with:', {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      services: appointment.services?.length || 0
    });
    
    // Get client's push tokens
    if (appointment.clientId) {
      userRoles.push({ userId: appointment.clientId, role: 'client' });
    }
    
    // Get stylist(s) push tokens
    if (appointment.services && appointment.services.length > 0) {
      // Multi-service appointment
      const uniqueStylistIds = [...new Set(
        appointment.services
          .map(service => service.stylistId)
          .filter(id => id)
      )];
      
      uniqueStylistIds.forEach(stylistId => {
        userRoles.push({ userId: stylistId, role: 'stylist' });
      });
    } else if (appointment.stylistId) {
      // Single-service appointment
      userRoles.push({ userId: appointment.stylistId, role: 'stylist' });
    }
    
    console.log('📱 User roles to fetch tokens for:', userRoles);
    
    // Get all push tokens
    const pushTokens = await getMultipleUserPushTokens(userRoles);
    
    console.log('📱 Push tokens retrieved:', pushTokens.length);
    
    if (pushTokens.length === 0) {
      console.log('📱 No push tokens found for appointment notification');
      console.log('📱 Make sure users have clientPushTokens or stylistPushTokens in their Firestore document');
      return { success: false, message: 'No push tokens found' };
    }
    
    // Format appointment date - handle Firestore Timestamp
    const appointmentDate = toDate(appointment.appointmentDate);
    
    const dateStr = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Get service name(s)
    let serviceName = 'Service';
    if (appointment.services && appointment.services.length > 0) {
      serviceName = appointment.services.map(s => s.serviceName).join(', ');
    } else if (appointment.serviceName) {
      serviceName = appointment.serviceName;
    }
    
    const title = 'Appointment Confirmed';
    const body = `Your appointment for ${serviceName} on ${dateStr} at ${timeStr} has been confirmed.`;
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'appointment_confirmed',
      appointmentId: appointment.id,
      screen: 'Appointments'
    });
  } catch (error) {
    console.error('Error sending appointment confirmed notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send appointment cancellation notification to client and stylist(s)
 * @param {Object} appointment - Appointment data
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} - Result
 */
export const sendAppointmentCancelledNotification = async (appointment, reason = '') => {
  try {
    const userRoles = [];
    
    console.log('📱 sendAppointmentCancelledNotification called with:', {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      reason
    });
    
    // Get client's push tokens
    if (appointment.clientId) {
      userRoles.push({ userId: appointment.clientId, role: 'client' });
    }
    
    // Get stylist(s) push tokens
    if (appointment.services && appointment.services.length > 0) {
      const uniqueStylistIds = [...new Set(
        appointment.services
          .map(service => service.stylistId)
          .filter(id => id)
      )];
      
      uniqueStylistIds.forEach(stylistId => {
        userRoles.push({ userId: stylistId, role: 'stylist' });
      });
    } else if (appointment.stylistId) {
      userRoles.push({ userId: appointment.stylistId, role: 'stylist' });
    }
    
    console.log('📱 User roles to fetch tokens for:', userRoles);
    
    const pushTokens = await getMultipleUserPushTokens(userRoles);
    
    console.log('📱 Push tokens retrieved:', pushTokens.length);
    
    if (pushTokens.length === 0) {
      console.log('📱 No push tokens found for cancellation notification');
      console.log('📱 Make sure users have clientPushTokens or stylistPushTokens in their Firestore document');
      return { success: false, message: 'No push tokens found' };
    }
    
    // Format appointment date - handle Firestore Timestamp
    const appointmentDate = toDate(appointment.appointmentDate);
    
    const dateStr = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    
    const title = 'Appointment Cancelled';
    const body = reason 
      ? `Your appointment on ${dateStr} has been cancelled. Reason: ${reason}`
      : `Your appointment on ${dateStr} has been cancelled.`;
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'appointment_cancelled',
      appointmentId: appointment.id,
      screen: 'Appointments'
    });
  } catch (error) {
    console.error('Error sending appointment cancelled notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send appointment rescheduled notification to client and stylist(s)
 * @param {Object} appointment - Appointment data with new date
 * @param {Date} _oldDate - Previous appointment date (unused but kept for API compatibility)
 * @returns {Promise<Object>} - Result
 */
export const sendAppointmentRescheduledNotification = async (appointment, _oldDate) => {
  try {
    const userRoles = [];
    
    if (appointment.clientId) {
      userRoles.push({ userId: appointment.clientId, role: 'client' });
    }
    
    if (appointment.services && appointment.services.length > 0) {
      const uniqueStylistIds = [...new Set(
        appointment.services
          .map(service => service.stylistId)
          .filter(id => id)
      )];
      
      uniqueStylistIds.forEach(stylistId => {
        userRoles.push({ userId: stylistId, role: 'stylist' });
      });
    } else if (appointment.stylistId) {
      userRoles.push({ userId: appointment.stylistId, role: 'stylist' });
    }
    
    const pushTokens = await getMultipleUserPushTokens(userRoles);
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found' };
    }
    
    // Format new appointment date - handle Firestore Timestamp
    const newDate = toDate(appointment.appointmentDate);
    
    const newDateStr = newDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const newTimeStr = newDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const title = 'Appointment Rescheduled';
    const body = `Your appointment has been rescheduled to ${newDateStr} at ${newTimeStr}.`;
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'appointment_rescheduled',
      appointmentId: appointment.id,
      screen: 'Appointments'
    });
  } catch (error) {
    console.error('Error sending appointment rescheduled notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send appointment reminder notification
 * @param {Object} appointment - Appointment data
 * @param {string} reminderType - 'day_before' or 'hour_before'
 * @returns {Promise<Object>} - Result
 */
export const sendAppointmentReminderNotification = async (appointment, reminderType = 'day_before') => {
  try {
    if (!appointment.clientId) {
      return { success: false, message: 'No client ID' };
    }
    
    const pushTokens = await getUserPushTokens(appointment.clientId, 'client');
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found' };
    }
    
    // Handle Firestore Timestamp
    const appointmentDate = toDate(appointment.appointmentDate);
    
    const timeStr = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    let title, body;
    
    if (reminderType === 'hour_before') {
      title = 'Appointment in 1 Hour';
      body = `Your appointment is coming up at ${timeStr}. See you soon!`;
    } else {
      const dateStr = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
      title = 'Appointment Tomorrow';
      body = `Reminder: You have an appointment tomorrow (${dateStr}) at ${timeStr}.`;
    }
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'appointment_reminder',
      appointmentId: appointment.id,
      screen: 'Appointments'
    });
  } catch (error) {
    console.error('Error sending appointment reminder notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send new appointment notification to stylist
 * @param {Object} appointment - Appointment data
 * @returns {Promise<Object>} - Result
 */
export const sendNewAppointmentToStylistNotification = async (appointment) => {
  try {
    const userRoles = [];
    
    if (appointment.services && appointment.services.length > 0) {
      const uniqueStylistIds = [...new Set(
        appointment.services
          .map(service => service.stylistId)
          .filter(id => id)
      )];
      
      uniqueStylistIds.forEach(stylistId => {
        userRoles.push({ userId: stylistId, role: 'stylist' });
      });
    } else if (appointment.stylistId) {
      userRoles.push({ userId: appointment.stylistId, role: 'stylist' });
    }
    
    if (userRoles.length === 0) {
      return { success: false, message: 'No stylist assigned' };
    }
    
    const pushTokens = await getMultipleUserPushTokens(userRoles);
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found' };
    }
    
    // Handle Firestore Timestamp
    const appointmentDate = toDate(appointment.appointmentDate);
    
    const dateStr = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const clientName = appointment.clientName || 'A client';
    
    const title = 'New Appointment Assigned';
    const body = `${clientName} has booked an appointment with you on ${dateStr} at ${timeStr}.`;
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'new_appointment',
      appointmentId: appointment.id,
      screen: 'Schedule'
    });
  } catch (error) {
    console.error('Error sending new appointment to stylist notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send client arrived notification to stylist(s)
 * @param {Object} appointment - Appointment data
 * @returns {Promise<Object>} - Result
 */
export const sendClientArrivedNotification = async (appointment) => {
  try {
    const userRoles = [];
    
    if (appointment.services && appointment.services.length > 0) {
      const uniqueStylistIds = [...new Set(
        appointment.services
          .map(service => service.stylistId)
          .filter(id => id)
      )];
      
      uniqueStylistIds.forEach(stylistId => {
        userRoles.push({ userId: stylistId, role: 'stylist' });
      });
    } else if (appointment.stylistId) {
      userRoles.push({ userId: appointment.stylistId, role: 'stylist' });
    }
    
    if (userRoles.length === 0) {
      return { success: false, message: 'No stylist assigned' };
    }
    
    const pushTokens = await getMultipleUserPushTokens(userRoles);
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found' };
    }
    
    const clientName = appointment.clientName || 'Your client';
    
    // Get service names
    let serviceName = 'their appointment';
    if (appointment.services && appointment.services.length > 0) {
      serviceName = appointment.services.map(s => s.serviceName).join(', ');
    } else if (appointment.serviceName) {
      serviceName = appointment.serviceName;
    }
    
    const title = 'Client Has Arrived';
    const body = `${clientName} has arrived for ${serviceName}. Please prepare for the service.`;
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'client_arrived',
      appointmentId: appointment.id,
      screen: 'Schedule'
    });
  } catch (error) {
    console.error('Error sending client arrived notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send service started (in-service) notification to stylist(s)
 * @param {Object} appointment - Appointment data
 * @returns {Promise<Object>} - Result
 */
export const sendInServiceNotification = async (appointment) => {
  try {
    const userRoles = [];
    
    // Get stylist(s) push tokens
    if (appointment.services && appointment.services.length > 0) {
      const uniqueStylistIds = [...new Set(
        appointment.services
          .map(service => service.stylistId)
          .filter(id => id)
      )];
      
      uniqueStylistIds.forEach(stylistId => {
        userRoles.push({ userId: stylistId, role: 'stylist' });
      });
    } else if (appointment.stylistId) {
      userRoles.push({ userId: appointment.stylistId, role: 'stylist' });
    }
    
    if (userRoles.length === 0) {
      return { success: false, message: 'No stylist assigned' };
    }
    
    const pushTokens = await getMultipleUserPushTokens(userRoles);
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push token found' };
    }
    
    const clientName = appointment.clientName || 'Client';
    
    // Get service names
    let serviceName = 'service';
    if (appointment.services && appointment.services.length > 0) {
      serviceName = appointment.services.map(s => s.serviceName).join(', ');
    } else if (appointment.serviceName) {
      serviceName = appointment.serviceName;
    }
    
    const title = 'Service Started';
    const body = `Service for ${clientName} has started. ${serviceName}.`;
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'in_service',
      appointmentId: appointment.id,
      screen: 'Schedule'
    });
  } catch (error) {
    console.error('Error sending in-service notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send cancellation notification - only to client if appointment was pending
 * @param {Object} appointment - Appointment data
 * @param {string} reason - Cancellation reason
 * @param {boolean} wasPending - Whether the appointment was in pending status
 * @returns {Promise<Object>} - Result
 */
export const sendCancellationNotification = async (appointment, reason = '', wasPending = false) => {
  try {
    const userRoles = [];
    
    // Always notify client
    if (appointment.clientId) {
      userRoles.push({ userId: appointment.clientId, role: 'client' });
    }
    
    // Only notify stylists if appointment was NOT pending (was already confirmed)
    if (!wasPending) {
      if (appointment.services && appointment.services.length > 0) {
        const uniqueStylistIds = [...new Set(
          appointment.services
            .map(service => service.stylistId)
            .filter(id => id)
        )];
        
        uniqueStylistIds.forEach(stylistId => {
          userRoles.push({ userId: stylistId, role: 'stylist' });
        });
      } else if (appointment.stylistId) {
        userRoles.push({ userId: appointment.stylistId, role: 'stylist' });
      }
    }
    
    const pushTokens = await getMultipleUserPushTokens(userRoles);
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found' };
    }
    
    const appointmentDate = toDate(appointment.appointmentDate);
    const dateStr = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    
    const title = 'Appointment Cancelled';
    const body = reason 
      ? `Your appointment on ${dateStr} has been cancelled. Reason: ${reason}`
      : `Your appointment on ${dateStr} has been cancelled.`;
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'appointment_cancelled',
      appointmentId: appointment.id,
      screen: 'Appointments'
    });
  } catch (error) {
    console.error('Error sending cancellation notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send portfolio approved notification to stylist
 * @param {Object} portfolio - Portfolio data
 * @param {string} stylistId - Stylist user ID
 * @returns {Promise<Object>} - Result
 */
export const sendPortfolioApprovedNotification = async (portfolio, stylistId) => {
  try {
    if (!stylistId) {
      return { success: false, message: 'No stylist ID' };
    }
    
    const pushTokens = await getUserPushTokens(stylistId, 'stylist');
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found' };
    }
    
    const title = 'Portfolio Approved';
    const body = portfolio.title 
      ? `Your portfolio "${portfolio.title}" has been approved and is now visible to clients.`
      : 'Your portfolio submission has been approved and is now visible to clients.';
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'portfolio_approved',
      portfolioId: portfolio.id,
      screen: 'Portfolio'
    });
  } catch (error) {
    console.error('Error sending portfolio approved notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send portfolio rejected notification to stylist
 * @param {Object} portfolio - Portfolio data
 * @param {string} stylistId - Stylist user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} - Result
 */
export const sendPortfolioRejectedNotification = async (portfolio, stylistId, reason = '') => {
  try {
    if (!stylistId) {
      return { success: false, message: 'No stylist ID' };
    }
    
    const pushTokens = await getUserPushTokens(stylistId, 'stylist');
    
    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found' };
    }
    
    const title = 'Portfolio Rejected';
    const body = reason 
      ? `Your portfolio submission was rejected. Reason: ${reason}`
      : 'Your portfolio submission was rejected. Please review and resubmit.';
    
    return await sendExpoPushNotification(pushTokens, title, body, {
      type: 'portfolio_rejected',
      portfolioId: portfolio.id,
      screen: 'Portfolio'
    });
  } catch (error) {
    console.error('Error sending portfolio rejected notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test function to send a push notification directly to a token
 * Call from browser console: window.testPushNotification('ExponentPushToken[xxx]')
 */
export const testPushNotification = async (token) => {
  console.log('=== TEST: Sending test push notification ===');
  console.log('Token:', token);
  
  const result = await sendExpoPushNotification(
    token,
    'Test Notification',
    'This is a test push notification from David\'s Salon web app.',
    { type: 'test', screen: 'Home' }
  );
  
  console.log('Result:', result);
  return result;
};

/**
 * Test function to send push notification to a user by their Firestore document ID
 * Call from browser console: window.testPushToUser('userId', 'client') or window.testPushToUser('userId', 'stylist')
 */
export const testPushToUser = async (userId, role = 'client') => {
  console.log('=== TEST: Sending test push to user ===');
  console.log('User ID:', userId);
  console.log('Role:', role);
  
  const tokens = await getUserPushTokens(userId, role);
  
  if (tokens.length === 0) {
    console.log('❌ No push tokens found for user');
    return { success: false, message: 'No push tokens found' };
  }
  
  console.log('✅ Tokens found:', tokens.length);
  
  const result = await sendExpoPushNotification(
    tokens,
    'Test Notification',
    'This is a test push notification from David\'s Salon web app.',
    { type: 'test', screen: 'Home' }
  );
  
  console.log('Result:', result);
  return result;
};

/**
 * Debug function to check if a user has push tokens
 * Call from browser console: window.checkPushToken('userId', 'client') or window.checkPushToken('userId', 'stylist')
 */
export const debugCheckPushToken = async (userId, role = 'client') => {
  console.log('=== DEBUG: Checking push tokens for user ===');
  console.log('User ID:', userId);
  console.log('Role:', role);
  
  const tokens = await getUserPushTokens(userId, role);
  
  if (tokens.length > 0) {
    console.log('✅ Push tokens found:', tokens.length);
    tokens.forEach((token, index) => {
      console.log(`Token ${index + 1}:`, token);
      console.log('Token is valid Expo format:', token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
    });
  } else {
    console.log('❌ No push tokens found');
    console.log(`The mobile app needs to save tokens to ${role}PushTokens array in the user document`);
  }
  
  return tokens;
};

// Expose debug functions to window for console access
if (typeof window !== 'undefined') {
  window.checkPushToken = debugCheckPushToken;
  window.testPushNotification = testPushNotification;
  window.testPushToUser = testPushToUser;
}

export default {
  sendExpoPushNotification,
  getUserPushToken,
  getUserPushTokens,
  getMultipleUserPushTokens,
  sendAppointmentConfirmedNotification,
  sendAppointmentCancelledNotification,
  sendAppointmentRescheduledNotification,
  sendAppointmentReminderNotification,
  sendNewAppointmentToStylistNotification,
  sendClientArrivedNotification,
  sendInServiceNotification,
  sendCancellationNotification,
  sendPortfolioApprovedNotification,
  sendPortfolioRejectedNotification,
  testPushNotification,
  testPushToUser,
  debugCheckPushToken
};
