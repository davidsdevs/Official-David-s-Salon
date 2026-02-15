import { useState, useEffect } from 'react';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { playNotificationSound, requestNotificationPermission, getNotificationStatus } from '../../services/notificationSoundService';
import { toast } from 'react-hot-toast';

/**
 * NotificationBellButton
 * A bell icon button that:
 * 1. Shows notification permission status
 * 2. Allows enabling/disabling sound notifications
 * 3. Requests browser notification permission
 * 4. Plays test sound when clicked
 */
const NotificationBellButton = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Check initial notification status
    const status = getNotificationStatus();
    setNotificationPermission(status.permission);

    // Load sound preference from localStorage
    const savedPreference = localStorage.getItem('receptionistSoundEnabled');
    if (savedPreference !== null) {
      setSoundEnabled(savedPreference === 'true');
    }
  }, []);

  const handleBellClick = async () => {
    // If notifications not granted, request permission
    if (notificationPermission !== 'granted') {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        toast.success('Notifications enabled! You\'ll hear a sound when new appointments arrive.', {
          icon: '🔔',
          duration: 4000
        });
        // Play test sound
        await playNotificationSound();
      } else {
        toast.error('Notification permission denied. Please enable it in your browser settings.', {
          icon: '🔕',
          duration: 4000
        });
      }
      return;
    }

    // Toggle sound on/off
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    localStorage.setItem('receptionistSoundEnabled', String(newSoundEnabled));

    if (newSoundEnabled) {
      toast.success('Notification sounds enabled', {
        icon: '🔊',
        duration: 2000
      });
      // Play test sound
      await playNotificationSound();
    } else {
      toast('Notification sounds muted', {
        icon: '🔇',
        duration: 2000
      });
    }
  };

  const getBellIcon = () => {
    if (notificationPermission !== 'granted') {
      return <BellOff className="w-6 h-6" />;
    }
    return soundEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />;
  };

  const getBellColor = () => {
    if (notificationPermission !== 'granted') {
      return 'text-gray-400 hover:text-gray-600';
    }
    return soundEnabled ? 'text-primary-600 hover:text-primary-700' : 'text-gray-400 hover:text-gray-600';
  };

  const getTooltipText = () => {
    if (notificationPermission !== 'granted') {
      return 'Click to enable notifications';
    }
    return soundEnabled ? 'Sound ON - Click to mute' : 'Sound OFF - Click to enable';
  };

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative p-2 rounded-lg transition-all ${getBellColor()} hover:bg-gray-100`}
        aria-label="Toggle notification sounds"
      >
        {getBellIcon()}
        
        {/* Sound indicator badge */}
        {notificationPermission === 'granted' && (
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
            soundEnabled ? 'bg-green-500' : 'bg-gray-400'
          }`}>
            {soundEnabled ? (
              <Volume2 className="w-2.5 h-2.5 text-white" />
            ) : (
              <VolumeX className="w-2.5 h-2.5 text-white" />
            )}
          </div>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50">
          {getTooltipText()}
          <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      )}
    </div>
  );
};

export default NotificationBellButton;
