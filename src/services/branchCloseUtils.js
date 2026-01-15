// Utility to check if a branch is closed on a given date
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Checks if the branch is closed on a given date (approved branch_close entry)
 * Handles both single dates and date ranges (startDate/endDate)
 * @param {string} branchId
 * @param {string|Date} date - YYYY-MM-DD or Date
 * @returns {Promise<{closed: boolean, entry?: object}>}
 */
export async function isBranchClosedOnDate(branchId, date) {
  const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  dateObj.setHours(0, 0, 0, 0);

  const calendarRef = collection(db, 'calendar');
  const q = query(
    calendarRef,
    where('branchId', '==', branchId),
    where('type', '==', 'branch_close'),
    where('status', '==', 'approved')
  );
  const snapshot = await getDocs(q);
  
  for (const doc of snapshot.docs) {
    const entry = doc.data();
    
    // Handle date ranges (startDate/endDate)
    if (entry.startDate && entry.endDate) {
      let start = entry.startDate?.toDate ? entry.startDate.toDate() : new Date(entry.startDate);
      let end = entry.endDate?.toDate ? entry.endDate.toDate() : new Date(entry.endDate);
      
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      
      if (dateObj >= start && dateObj <= end) {
        return { closed: true, entry };
      }
    }
    // Handle single date entries (legacy support)
    else if (entry.date) {
      let entryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      
      if (dateObj.getTime() === entryDate.getTime()) {
        return { closed: true, entry };
      }
    }
    // Fallback: check if startDate exists without endDate
    else if (entry.startDate) {
      let start = entry.startDate?.toDate ? entry.startDate.toDate() : new Date(entry.startDate);
      start.setHours(0, 0, 0, 0);
      
      if (dateObj.getTime() === start.getTime()) {
        return { closed: true, entry };
      }
    }
  }
  
  return { closed: false };
}
