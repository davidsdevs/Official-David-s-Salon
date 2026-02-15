import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { playNotificationSound, showAppointmentNotification, requestNotificationPermission } from '../../services/notificationSoundService';
import { toast } from 'react-hot-toast';

/**
 * AppointmentNotificationListener
 * Listens for new appointments in real-time and plays notification sound
 * Used by Receptionist to get alerted when clients book appointments online
 */
const AppointmentNotificationListener = () => {
  const { userData } = useAuth();
  const lastAppointmentIdRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    if (!userData?.branchId) return;

    // Request notification permission on mount (only once)
    if (!permissionRequestedRef.current) {
      requestNotificationPermission().then(permission => {
        if (permission === 'granted') {
          console.log('✅ Notification permission granted');
        } else {
          console.log('⚠️ Notification permission denied or not granted');
        }
      });
      permissionRequestedRef.current = true;
    }

    console.log('🔔 Starting appointment notification listener for branch:', userData.branchId);

    // Listen to appointments for this branch, ordered by creation time
    const appointmentsRef = collection(db, 'appointments');
    const appointmentsQuery = query(
      appointmentsRef,
      where('branchId', '==', userData.branchId),
      orderBy('createdAt', 'desc'),
      limit(1) // Only get the most recent appointment
    );

    const unsubscribe = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const appointment = {
              id: change.doc.id,
              ...change.doc.data()
            };

            // Skip initial load (don't notify for existing appointments)
            if (isInitialLoadRef.current) {
              lastAppointmentIdRef.current = appointment.id;
              isInitialLoadRef.current = false;
              console.log('📋 Initial appointment loaded, skipping notification');
              return;
            }

            // Skip if we've already seen this appointment
            if (lastAppointmentIdRef.current === appointment.id) {
              return;
            }

            // New appointment detected!
            console.log('🆕 New appointment detected:', appointment.id);
            lastAppointmentIdRef.current = appointment.id;

            // Check if sound is enabled (from localStorage)
            const soundEnabled = localStorage.getItem('receptionistSoundEnabled');
            const shouldPlaySound = soundEnabled === null || soundEnabled === 'true';

            // Play notification sound if enabled
            if (shouldPlaySound) {
              playNotificationSound().then(played => {
                if (played) {
                  console.log('🔊 Notification sound played');
                }
              });
            } else {
              console.log('🔇 Notification sound muted by user');
            }

            // Show browser notification
            showAppointmentNotification(appointment);

            // Show toast notification
            const clientName = appointment.clientName || 'Guest';
            const serviceName = appointment.services?.[0]?.serviceName || appointment.serviceName || 'Service';
            
            toast.success(
              `New appointment: ${clientName} booked ${serviceName}`,
              {
                duration: 5000,
                icon: '📅',
                style: {
                  background: '#10b981',
                  color: '#fff',
                  fontWeight: '500'
                }
              }
            );
          }
        });
      },
      (error) => {
        console.error('❌ Error listening to appointments:', error);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🔕 Stopping appointment notification listener');
      unsubscribe();
    };
  }, [userData?.branchId]);

  // This component doesn't render anything
  return null;
};

export default AppointmentNotificationListener;
