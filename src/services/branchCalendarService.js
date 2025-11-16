/**
 * Branch Calendar Service
 * Manages holidays and special dates for branches (top-level collection)
 * Updated: Changed from subcollection to top-level collection with branchId field
 */

import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

/**
 * Get all calendar entries for a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of calendar entries
 */
export const getBranchCalendar = async (branchId) => {
  try {
    const calendarRef = collection(db, 'calendar');
    const q = query(
      calendarRef,
      where('branchId', '==', branchId),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() // Convert Firestore Timestamp to Date
    }));
  } catch (error) {
    console.error('Error fetching branch calendar:', error);
    throw error;
  }
};

/**
 * Get upcoming holidays/closures
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of upcoming calendar entries
 */
export const getUpcomingClosures = async (branchId) => {
  try {
    const today = Timestamp.fromDate(new Date());
    const calendarRef = collection(db, 'calendar');
    const q = query(
      calendarRef,
      where('branchId', '==', branchId),
      where('date', '>=', today),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching upcoming closures:', error);
    throw error;
  }
};

/**
 * Add or update a calendar entry
 * @param {string} branchId - Branch ID
 * @param {Object} entryData - Calendar entry data
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<string>} Entry ID
 */
export const saveBranchCalendarEntry = async (branchId, entryData, currentUser) => {
  try {
    const entryId = entryData.id || doc(collection(db, 'calendar')).id;
    const entryRef = doc(db, 'calendar', entryId);
    
    const data = {
      branchId, // Add branchId to the document
      date: Timestamp.fromDate(new Date(entryData.date)),
      title: entryData.title,
      description: entryData.description || '',
      type: entryData.type || 'holiday', // 'holiday', 'closure', 'special_hours'
      allDay: entryData.allDay !== undefined ? entryData.allDay : true,
      specialHours: entryData.specialHours || null,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    if (!entryData.id) {
      data.createdAt = Timestamp.now();
      data.createdBy = currentUser.uid;
    }
    
    await setDoc(entryRef, data, { merge: true });
    
    // Log activity
    await logActivity({
      action: entryData.id ? 'branch_calendar_updated' : 'branch_calendar_added',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        entryId,
        title: entryData.title,
        date: entryData.date,
        type: entryData.type
      }
    });
    
    toast.success(`Calendar entry ${entryData.id ? 'updated' : 'added'} successfully!`);
    return entryId;
  } catch (error) {
    console.error('Error saving calendar entry:', error);
    toast.error('Failed to save calendar entry');
    throw error;
  }
};

/**
 * Delete a calendar entry
 * @param {string} branchId - Branch ID
 * @param {string} entryId - Entry ID
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const deleteBranchCalendarEntry = async (branchId, entryId, currentUser) => {
  try {
    const entryRef = doc(db, 'calendar', entryId);
    await deleteDoc(entryRef);
    
    // Log activity
    await logActivity({
      action: 'branch_calendar_deleted',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        entryId
      }
    });
    
    toast.success('Calendar entry deleted successfully!');
  } catch (error) {
    console.error('Error deleting calendar entry:', error);
    toast.error('Failed to delete calendar entry');
    throw error;
  }
};

/**
 * Get calendar entry types
 * @returns {Array<Object>} Array of entry types
 */
export const getCalendarEntryTypes = () => {
  return [
    { value: 'holiday', label: 'Holiday', color: 'bg-red-100 text-red-700' },
    { value: 'closure', label: 'Temporary Closure', color: 'bg-orange-100 text-orange-700' },
    { value: 'special_hours', label: 'Special Hours', color: 'bg-blue-100 text-blue-700' }
  ];
};
