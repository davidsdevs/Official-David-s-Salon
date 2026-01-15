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
 * Get user's Expo push token from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} - Push token or null
 */
export const getUserPushToken = async (userId) => {
  try {
    if (!userId) {
      console.log('📱 getUserPushToken: No userId provided');
      return null;
    }
    
    console.log('📱 Fetching push token for user:', userId);
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const token = userData.expoPushToken || userData.pushToken || null;
      
      if (token) {
        console.log('📱 Found push token for user', userId, ':', token.substring(0, 30) + '...');
      } else {
        console.log('📱 No push token found for user', userId);
        console.log('📱 User data fields:', Object.keys(userData).join(', '));
      }
      
      return token;
    }
    
    console.log('📱 User document not found:', userId);
    return null;
  } catch (error) {
    console.error('Error getting user push token:', error);
    return null;
  }
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
 * Get multiple users' push tokens
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<string[]>} - Array of push tokens
 */
export const getMultipleUserPushTokens = async (userIds) => {
  try {
    const tokens = await Promise.all(
      userIds.map(userId => getUserPushToken(userId))
    );
    return tokens.filter(token => token !== null);
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
    const userIds = [];
    
    console.log('📱 sendAppointmentConfirmedNotification called with:', {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      services: appointment.services?.length || 0
    });
    
    // Get client's push token
    if (appointment.clientId) {
      userIds.push(appointment.clientId);
    }
    
    // Get stylist(s) push tokens
    if (appointment.services && appointment.services.length > 0) {
      // Multi-service appointment
      appointment.services.forEach(service => {
        if (service.stylistId && !userIds.includes(service.stylistId)) {
          userIds.push(service.stylistId);
        }
      });
    } else if (appointment.stylistId) {
      // Single-service appointment
      if (!userIds.includes(appointment.stylistId)) {
        userIds.push(appointment.stylistId);
      }
    }
    
    console.log('📱 User IDs to fetch tokens for:', userIds);
    
    // Get all push tokens
    const pushTokens = await getMultipleUserPushTokens(userIds);
    
    console.log('📱 Push tokens retrieved:', pushTokens);
    
    if (pushTokens.length === 0) {
      console.log('📱 No push tokens found for appointment notification');
      console.log('📱 Make sure users have expoPushToken field in their Firestore document');
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
    const userIds = [];
    
    console.log('📱 sendAppointmentCancelledNotification called with:', {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      reason
    });
    
    // Get client's push token
    if (appointment.clientId) {
      userIds.push(appointment.clientId);
    }
    
    // Get stylist(s) push tokens
    if (appointment.services && appointment.services.length > 0) {
      appointment.services.forEach(service => {
        if (service.stylistId && !userIds.includes(service.stylistId)) {
          userIds.push(service.stylistId);
        }
      });
    } else if (appointment.stylistId) {
      if (!userIds.includes(appointment.stylistId)) {
        userIds.push(appointment.stylistId);
      }
    }
    
    console.log('📱 User IDs to fetch tokens for:', userIds);
    
    const pushTokens = await getMultipleUserPushTokens(userIds);
    
    console.log('📱 Push tokens retrieved:', pushTokens);
    
    if (pushTokens.length === 0) {
      console.log('📱 No push tokens found for cancellation notification');
      console.log('📱 Make sure users have expoPushToken field in their Firestore document');
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
    const userIds = [];
    
    if (appointment.clientId) {
      userIds.push(appointment.clientId);
    }
    
    if (appointment.services && appointment.services.length > 0) {
      appointment.services.forEach(service => {
        if (service.stylistId && !userIds.includes(service.stylistId)) {
          userIds.push(service.stylistId);
        }
      });
    } else if (appointment.stylistId) {
      if (!userIds.includes(appointment.stylistId)) {
        userIds.push(appointment.stylistId);
      }
    }
    
    const pushTokens = await getMultipleUserPushTokens(userIds);
    
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
    
    const pushToken = await getUserPushToken(appointment.clientId);
    
    if (!pushToken) {
      return { success: false, message: 'No push token found' };
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
    
    return await sendExpoPushNotification(pushToken, title, body, {
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
    const stylistIds = [];
    
    if (appointment.services && appointment.services.length > 0) {
      appointment.services.forEach(service => {
        if (service.stylistId && !stylistIds.includes(service.stylistId)) {
          stylistIds.push(service.stylistId);
        }
      });
    } else if (appointment.stylistId) {
      stylistIds.push(appointment.stylistId);
    }
    
    if (stylistIds.length === 0) {
      return { success: false, message: 'No stylist assigned' };
    }
    
    const pushTokens = await getMultipleUserPushTokens(stylistIds);
    
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
    const stylistIds = [];
    
    if (appointment.services && appointment.services.length > 0) {
      appointment.services.forEach(service => {
        if (service.stylistId && !stylistIds.includes(service.stylistId)) {
          stylistIds.push(service.stylistId);
        }
      });
    } else if (appointment.stylistId) {
      stylistIds.push(appointment.stylistId);
    }
    
    if (stylistIds.length === 0) {
      return { success: false, message: 'No stylist assigned' };
    }
    
    const pushTokens = await getMultipleUserPushTokens(stylistIds);
    
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
    const stylistIds = [];
    
    // Get stylist(s) push tokens
    if (appointment.services && appointment.services.length > 0) {
      appointment.services.forEach(service => {
        if (service.stylistId && !stylistIds.includes(service.stylistId)) {
          stylistIds.push(service.stylistId);
        }
      });
    } else if (appointment.stylistId) {
      stylistIds.push(appointment.stylistId);
    }
    
    if (stylistIds.length === 0) {
      return { success: false, message: 'No stylist assigned' };
    }
    
    const pushTokens = await getMultipleUserPushTokens(stylistIds);
    
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
    const userIds = [];
    
    // Always notify client
    if (appointment.clientId) {
      userIds.push(appointment.clientId);
    }
    
    // Only notify stylists if appointment was NOT pending (was already confirmed)
    if (!wasPending) {
      if (appointment.services && appointment.services.length > 0) {
        appointment.services.forEach(service => {
          if (service.stylistId && !userIds.includes(service.stylistId)) {
            userIds.push(service.stylistId);
          }
        });
      } else if (appointment.stylistId) {
        if (!userIds.includes(appointment.stylistId)) {
          userIds.push(appointment.stylistId);
        }
      }
    }
    
    const pushTokens = await getMultipleUserPushTokens(userIds);
    
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
    
    const pushToken = await getUserPushToken(stylistId);
    
    if (!pushToken) {
      return { success: false, message: 'No push token found' };
    }
    
    const title = 'Portfolio Approved';
    const body = portfolio.title 
      ? `Your portfolio "${portfolio.title}" has been approved and is now visible to clients.`
      : 'Your portfolio submission has been approved and is now visible to clients.';
    
    return await sendExpoPushNotification(pushToken, title, body, {
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
    
    const pushToken = await getUserPushToken(stylistId);
    
    if (!pushToken) {
      return { success: false, message: 'No push token found' };
    }
    
    const title = 'Portfolio Rejected';
    const body = reason 
      ? `Your portfolio submission was rejected. Reason: ${reason}`
      : 'Your portfolio submission was rejected. Please review and resubmit.';
    
    return await sendExpoPushNotification(pushToken, title, body, {
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
 * Call from browser console: window.testPushToUser('userId')
 */
export const testPushToUser = async (userId) => {
  console.log('=== TEST: Sending test push to user ===');
  console.log('User ID:', userId);
  
  const token = await getUserPushToken(userId);
  
  if (!token) {
    console.log('❌ No push token found for user');
    return { success: false, message: 'No push token found' };
  }
  
  console.log('✅ Token found:', token);
  
  const result = await sendExpoPushNotification(
    token,
    'Test Notification',
    'This is a test push notification from David\'s Salon web app.',
    { type: 'test', screen: 'Home' }
  );
  
  console.log('Result:', result);
  return result;
};

// Expose test functions to window for console access
if (typeof window !== 'undefined') {
  window.checkPushToken = debugCheckPushToken;
  window.testPushNotification = testPushNotification;
  window.testPushToUser = testPushToUser;
}

export default {
  sendExpoPushNotification,
  getUserPushToken,
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
  testPushToUser
};
