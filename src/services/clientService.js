/**
 * Client Service
 * Handles client/customer data operations
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

const USERS_COLLECTION = 'users';

/**
 * Get all clients (users with role 'client')
 * @returns {Promise<Array>} - Array of clients
 */
export const getClients = async () => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where('role', '==', 'client'),
      where('isActive', '==', true),
      orderBy('firstName', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
};

/**
 * Get client by ID
 * @param {string} clientId - Client ID
 * @returns {Promise<Object|null>} - Client data or null
 */
export const getClientById = async (clientId) => {
  try {
    const clientRef = doc(db, USERS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      return null;
    }
    
    return {
      id: clientSnap.id,
      ...clientSnap.data(),
      createdAt: clientSnap.data().createdAt?.toDate(),
      updatedAt: clientSnap.data().updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
};

/**
 * Create a new client (guest/walk-in)
 * @param {Object} clientData - Client information
 * @returns {Promise<string>} - Client ID
 */
export const createClient = async (clientData) => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    
    const client = {
      firstName: clientData.firstName || '',
      lastName: clientData.lastName || '',
      email: clientData.email || '',
      phoneNumber: clientData.phoneNumber || '',
      role: 'client',
      isActive: true,
      isGuest: clientData.isGuest || false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(usersRef, client);
    toast.success('Client created successfully');
    return docRef.id;
  } catch (error) {
    console.error('Error creating client:', error);
    toast.error('Failed to create client');
    throw error;
  }
};

/**
 * Update client information
 * @param {string} clientId - Client ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateClient = async (clientId, updates) => {
  try {
    const clientRef = doc(db, USERS_COLLECTION, clientId);
    await updateDoc(clientRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    toast.success('Client updated successfully');
  } catch (error) {
    console.error('Error updating client:', error);
    toast.error('Failed to update client');
    throw error;
  }
};

/**
 * Search clients by name or phone
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} - Array of matching clients
 */
export const searchClients = async (searchTerm) => {
  try {
    const clients = await getClients();
    const term = searchTerm.toLowerCase();
    
    return clients.filter(client => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const phone = client.phoneNumber || '';
      return fullName.includes(term) || phone.includes(searchTerm);
    });
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
};
