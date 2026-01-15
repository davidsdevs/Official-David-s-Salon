import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyAehuymW1M3_OuAb0_QKGe5SvF50RQMXyc',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'official-david-salon-a6450.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'official-david-salon-a6450',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'official-david-salon-a6450.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '842310549544',
  appId: env.VITE_FIREBASE_APP_ID || '1:842310549544:web:751ba88fa246e6b362751d',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-2KD6VW398N',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
