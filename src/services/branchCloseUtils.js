// Utility to check if a branch is closed on a given date
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Checks if the branch is closed on a given date (approved branch_close entry)
 * @param {string} branchId
 * @param {string|Date} date - YYYY-MM-DD or Date
 * @returns {Promise<{closed: boolean, entry?: object}>}
 */
export async function isBranchClosedOnDate(branchId, date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
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
    // Support both single date and date range (startDate, endDate)
    let start = entry.startDate?.toDate ? entry.startDate.toDate() : (entry.startDate ? new Date(entry.startDate) : null);
    let end = entry.endDate?.toDate ? entry.endDate.toDate() : (entry.endDate ? new Date(entry.endDate) : null);
    if (!start && entry.date) {
      start = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
    }
    if (!end && entry.date) {
      end = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
    }
    if (start && end) {
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (dateObj >= start && dateObj <= end) {
        return { closed: true, entry };
      }
    }
  }
  return { closed: false };
}
