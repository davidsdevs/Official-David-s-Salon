/**
 * Notification Sound Service
 * Handles sound playback and browser notifications for new appointments
 */

// Free notification sound URL (pleasant chime)
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

// Audio element for playing notification sound
let notificationAudio = null;

/**
 * Initialize the audio element
 */
const initAudio = () => {
  if (!notificationAudio) {
    notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
    notificationAudio.volume = 0.7;
    // Preload the audio
    notificationAudio.load();
  }
  return notificationAudio;
};

/**
 * Play the notification sound
 */
export const playNotificationSound = async () => {
  try {
    const audio = initAudio();
    // Reset to beginning if already playing
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch (error) {
    console.error('Error playing notification sound:', error);
    return false;
  }
};

/**
 * Request browser notification permission
 * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'default'
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
};

/**
 * Show a browser notification for new appointment
 * @param {Object} appointment - Appointment data
 * @returns {Notification|null} The notification object or null if failed
 */
export const showAppointmentNotification = (appointment) => {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const clientName = appointment.clientName || 'Guest';
    const serviceName = appointment.services?.[0]?.serviceName || appointment.serviceName || 'Service';
    const appointmentDate = appointment.appointmentDate 
      ? new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : '';

    const notification = new Notification('New Appointment Booked', {
      body: `${clientName} booked ${serviceName}${appointmentDate ? ` - ${appointmentDate}` : ''}`,
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      tag: `appointment-${appointment.id}`,
      requireInteraction: true, // Keep notification until user interacts
      silent: false // Allow system sound if available
    });

    // Focus window when notification is clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
};

/**
 * Notify about a new appointment (plays sound + shows browser notification)
 * @param {Object} appointment - Appointment data
 */
export const notifyNewAppointment = async (appointment) => {
  // Play sound first
  await playNotificationSound();
  // Then show notification
  showAppointmentNotification(appointment);
};

/**
 * Check if notifications are supported and enabled
 * @returns {Object} Status object with supported and permission properties
 */
export const getNotificationStatus = () => {
  const supported = 'Notification' in window;
  return {
    supported,
    permission: supported ? Notification.permission : 'denied'
  };
};

/**
 * Preload the notification sound (call on user interaction)
 */
export const preloadNotificationSound = () => {
  initAudio();
};
