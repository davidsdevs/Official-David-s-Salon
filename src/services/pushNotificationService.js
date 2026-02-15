/**
 * Push Notification Service
 * Handles PWA push notifications and service worker registration
 */

/**
 * Register service worker for PWA support
 */
export const registerServiceWorker = async () => {
  try {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported in this browser');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    console.log('✅ Service Worker registered successfully:', registration);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60000); // Check every minute

    return registration;
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
    return null;
  }
};

/**
 * Unregister service worker
 */
export const unregisterServiceWorker = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }
      console.log('✅ Service Worker unregistered');
    }
  } catch (error) {
    console.error('❌ Failed to unregister Service Worker:', error);
  }
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return false;
    }

    if (Notification.permission === 'granted') {
      console.log('Notification permission already granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied by user');
      return false;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';

    if (granted) {
      console.log('✅ Notification permission granted');
    } else {
      console.warn('❌ Notification permission denied');
    }

    return granted;
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Show a local notification
 */
export const showLocalNotification = async (title, options = {}) => {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      tag: 'salon-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      ...options
    });

    console.log('✅ Local notification shown:', title);
    return true;
  } catch (error) {
    console.error('❌ Error showing notification:', error);
    return false;
  }
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPushNotifications = async (publicKey) => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    console.log('✅ Subscribed to push notifications');
    return subscription;
  } catch (error) {
    console.error('❌ Push notification subscription failed:', error);
    return null;
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPushNotifications = async () => {
  try {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log('✅ Unsubscribed from push notifications');
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Error unsubscribing from push notifications:', error);
    return false;
  }
};

/**
 * Get push notification subscription
 */
export const getPushNotificationSubscription = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription;
  } catch (error) {
    console.error('❌ Error getting push subscription:', error);
    return null;
  }
};

/**
 * Check if notifications are enabled
 */
export const isNotificationsEnabled = () => {
  if (!('Notification' in window)) {
    return false;
  }

  return Notification.permission === 'granted';
};

/**
 * Check if service worker is available
 */
export const isServiceWorkerAvailable = () => {
  return 'serviceWorker' in navigator;
};

/**
 * Check if PWA is installed (standalone mode)
 */
export const isPWAInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
};

/**
 * Get installation prompt event (for install banner)
 */
export const getInstallPrompt = (callback) => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    callback(e);
  });
};

/**
 * Trigger install prompt
 */
export const triggerInstallPrompt = (deferredPrompt) => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    return deferredPrompt.userChoice;
  }
  return null;
};

/**
 * Helper function to convert VAPID public key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Initialize push notifications on app startup
 */
export const initializePushNotifications = async () => {
  try {
    // Register service worker
    const registration = await registerServiceWorker();

    if (!registration) {
      console.warn('Service Worker registration failed');
      return false;
    }

    // Request notification permission if not already granted
    if (Notification.permission === 'default') {
      await requestNotificationPermission();
    }

    console.log('✅ Push notifications initialized');
    return true;
  } catch (error) {
    console.error('❌ Error initializing push notifications:', error);
    return false;
  }
};
