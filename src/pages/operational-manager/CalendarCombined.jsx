/**
 * Combined Calendar Page - Operational Manager
 * Combines Calendar View and Calendar Approval in a single page with tabs
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import OperationalManagerCalendar from './Calendar';
import CalendarApproval from './CalendarApproval';

const CalendarCombined = () => {
  const [activeTab, setActiveTab] = useState('view'); // 'view' or 'approval'
  const [pendingCount, setPendingCount] = useState(0);

  // Listen for pending entries count
  useEffect(() => {
    const calendarRef = collection(db, 'calendar');
    const pendingQuery = query(
      calendarRef,
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        setPendingCount(snapshot.size);
      },
      (error) => {
        console.error('Error listening for pending count:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('view')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'view'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Calendar View
            </button>
            <button
              onClick={() => setActiveTab('approval')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'approval'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Calendar Approval
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'view' ? (
          <OperationalManagerCalendar />
        ) : (
          <CalendarApproval />
        )}
      </div>
    </div>
  );
};

export default CalendarCombined;

