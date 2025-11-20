/**
 * Calendar View Page - Operational Manager
 * Shows calendar entries from all branches in a calendar view
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Flag, Building2, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllBranches } from '../../services/branchService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getPublicHolidays } from '../../services/holidaysApiService';
import { getCalendarEntryTypes } from '../../services/branchCalendarService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const OperationalManagerCalendar = () => {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [holidayCache, setHolidayCache] = useState({});
  const [holidayYearsLoaded, setHolidayYearsLoaded] = useState({});
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    // Only fetch calendar after branches have been loaded (loading is false)
    if (!loading) {
      fetchCalendar();
    }
  }, [branches, selectedBranch, loading]);

  useEffect(() => {
    const year = currentMonth.getFullYear();
    if (!holidayYearsLoaded[year]) {
      fetchPhilippineHolidays(year);
    }
    // Preload next year's holidays when viewing December
    if (currentMonth.getMonth() === 11 && !holidayYearsLoaded[year + 1]) {
      fetchPhilippineHolidays(year + 1);
    }
  }, [currentMonth, holidayYearsLoaded]);

  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      setBranches(branchesData || []);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load branches');
      setBranches([]); // Set empty array on error
    } finally {
      // Set loading to false after branches are loaded (even if empty or error)
      setLoading(false);
    }
  };

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const calendarRef = collection(db, 'calendar');
      
      let allEntries = [];
      
      if (selectedBranch === 'all') {
        // Fetch all entries from all branches
        const branchIds = branches.map(b => b.id);
        if (branchIds.length === 0) {
          setEntries([]);
          setLoading(false);
          return;
        }
        
        // Fetch entries for all branches
        const entriesPromises = branchIds.map(async (branchId) => {
          try {
            const branchQuery = query(
              calendarRef,
              where('branchId', '==', branchId)
            );
            const snapshot = await getDocs(branchQuery);
            return snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              date: doc.data().date?.toDate(),
              branchId,
              branchName: branches.find(b => b.id === branchId)?.name || branches.find(b => b.id === branchId)?.branchName || 'Unknown Branch'
            }));
          } catch (error) {
            console.error(`Error fetching calendar for branch ${branchId}:`, error);
            return [];
          }
        });
        
        const entriesArrays = await Promise.all(entriesPromises);
        allEntries = entriesArrays.flat();
      } else {
        // Fetch entries for selected branch only
        const branchQuery = query(
          calendarRef,
          where('branchId', '==', selectedBranch)
        );
        const snapshot = await getDocs(branchQuery);
        const selectedBranchData = branches.find(b => b.id === selectedBranch);
        allEntries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate(),
          branchId: selectedBranch,
          branchName: selectedBranchData?.name || selectedBranchData?.branchName || 'Unknown Branch'
        }));
      }
      
      // Sort by date
      allEntries.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.getTime() - b.date.getTime();
      });
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching calendar:', error);
      toast.error('Failed to load calendar entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchPhilippineHolidays = async (year) => {
    try {
      setHolidaysLoading(true);
      const holidays = await getPublicHolidays(year, 'PH');
      setHolidayCache(prev => ({
        ...prev,
        [year]: holidays
      }));
      setHolidayYearsLoaded(prev => ({
        ...prev,
        [year]: true
      }));
    } catch (error) {
      console.error('Error fetching Philippine holidays:', error);
    } finally {
      setHolidaysLoading(false);
    }
  };

  const formatDateKey = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  };

  const generateCalendarDays = (month) => {
    const days = [];
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startDay = startOfMonth.getDay();
    const iterator = new Date(startOfMonth);
    iterator.setDate(iterator.getDate() - startDay);

    for (let i = 0; i < 42; i++) {
      days.push({
        date: new Date(iterator),
        inCurrentMonth: iterator.getMonth() === month.getMonth()
      });
      iterator.setDate(iterator.getDate() + 1);
    }

    return days;
  };

  const handleMonthChange = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  // All hooks must be called before any early returns
  const entryTypes = getCalendarEntryTypes();
  const calendarDays = useMemo(() => generateCalendarDays(currentMonth), [currentMonth]);
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(entry => {
      if (!entry.date) return;
      const key = formatDateKey(entry.date);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(entry);
    });
    return map;
  }, [entries]);

  const holidaysByDate = useMemo(() => {
    const map = {};
    Object.values(holidayCache).forEach(yearHolidays => {
      yearHolidays?.forEach(holiday => {
        map[holiday.date] = holiday;
      });
    });
    return map;
  }, [holidayCache]);

  const currentMonthHolidays = useMemo(() => {
    const yearHolidays = holidayCache[currentMonth.getFullYear()] || [];
    return yearHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === currentMonth.getMonth();
    });
  }, [holidayCache, currentMonth]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const upcomingEntries = useMemo(() => {
    return entries.filter(e => {
      const entryDate = new Date(e.date);
      entryDate.setHours(0, 0, 0, 0);
      // Include entries with 'approved' status or no status (legacy entries default to approved)
      const status = e.status || 'approved';
      return entryDate >= today && status === 'approved';
    });
  }, [entries, today]);

  const pendingEntries = useMemo(() => {
    return entries.filter(e => (e.status || 'approved') === 'pending');
  }, [entries]);

  if (loading && branches.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Branch Calendar</h1>
          <p className="text-sm md:text-base text-gray-600">View calendar entries from all branches</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name || branch.branchName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Entries</p>
              <p className="text-xl font-bold text-gray-900">{entries.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Branches</p>
              <p className="text-xl font-bold text-gray-900">{branches.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <span className="text-yellow-600 font-bold text-sm">{pendingEntries.length}</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-xl font-bold text-gray-900">{pendingEntries.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center">
            <Flag className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Upcoming</p>
              <p className="text-xl font-bold text-gray-900">{upcomingEntries.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 md:px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Calendar View</h2>
            <p className="text-sm text-gray-500">
              Philippines public holidays are automatically highlighted. {selectedBranch === 'all' ? 'Entries from all branches are shown.' : `Showing entries for selected branch.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMonthChange('prev')}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-[160px] text-center font-semibold text-gray-900 text-sm md:text-base">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              onClick={() => handleMonthChange('next')}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-4">
          {holidaysLoading && (
            <div className="text-sm text-gray-500">Syncing Philippine holidays...</div>
          )}
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-gray-500 tracking-wider uppercase">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map(({ date, inCurrentMonth }, index) => {
              const dateKey = formatDateKey(date);
              const dayEntries = entriesByDate[dateKey] || [];
              const holiday = holidaysByDate[dateKey];
              const isToday = date.getTime() === today.getTime();
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isDimmed = !inCurrentMonth;

              return (
                <div
                  key={`${dateKey}-${index}`}
                  className={`min-h-[120px] md:min-h-[140px] rounded-xl border p-2 flex flex-col gap-1 ${
                    isDimmed ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-white border-gray-200'
                  } ${isWeekend && inCurrentMonth ? 'bg-slate-50' : ''} ${isToday ? 'ring-2 ring-primary-500' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className={isDimmed ? 'text-gray-400' : 'text-gray-700'}>
                      {date.getDate()}
                    </span>
                    {holiday && (
                      <span className="text-[10px] font-semibold text-red-600 flex items-center gap-1 truncate max-w-[90px]">
                        <Flag className="w-3 h-3" />
                        <span className="hidden sm:inline">{holiday.localName || holiday.name}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {dayEntries.slice(0, 3).map(entry => {
                      const status = entry.status || 'approved'; // Default to approved if no status
                      const isPending = status === 'pending';
                      const typeInfo = entryTypes.find(t => t.value === entry.type);
                      const badgeClasses = isPending
                        ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                        : 'bg-green-50 text-green-800 border border-green-200';
                      
                      // Build tooltip with all relevant info
                      let tooltip = `${entry.title} - ${entry.branchName} (${isPending ? 'Pending' : 'Approved'})`;
                      if (entry.specialHours && !entry.allDay) {
                        tooltip += `\nHours: ${entry.specialHours.open} - ${entry.specialHours.close}`;
                      } else if (entry.allDay) {
                        tooltip += '\nAll Day';
                      }

                      return (
                        <div
                          key={entry.id}
                          className={`w-full text-left text-[10px] md:text-[11px] px-2 py-1 rounded-lg ${badgeClasses} truncate`}
                          title={tooltip}
                        >
                          <div className="truncate">{entry.title}</div>
                          {selectedBranch === 'all' && (
                            <div className="text-[9px] text-gray-600 truncate">{entry.branchName}</div>
                          )}
                          {entry.specialHours && !entry.allDay && (
                            <div className="text-[9px] text-gray-500 truncate">
                              {entry.specialHours.open} - {entry.specialHours.close}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {dayEntries.length > 3 && (
                      <p className="text-[10px] text-gray-500">
                        +{dayEntries.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              Approved Entry
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              Pending Entry
            </div>
            <div className="flex items-center gap-2">
              <Flag className="w-3 h-3 text-red-500" />
              Public Holiday (Philippines)
            </div>
          </div>
          {currentMonthHolidays.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
              <p className="font-semibold mb-1">Philippine Holidays this month:</p>
              <div className="flex flex-wrap gap-2">
                {currentMonthHolidays.map(holiday => (
                  <span key={holiday.date} className="px-2 py-1 bg-white rounded border border-red-200">
                    {holiday.localName || holiday.name} - {formatDate(new Date(holiday.date), 'MMM dd')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pending Entries Section */}
      {pendingEntries.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Pending Approval ({pendingEntries.length})</h3>
          </div>
          <p className="text-sm text-yellow-800 mb-4">
            These calendar entries are waiting for approval. Switch to the Calendar Approval tab to review them.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingEntries.slice(0, 6).map((entry) => {
              const typeInfo = entryTypes.find(t => t.value === entry.type);
              return (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CalendarIcon className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                      <p className="text-xs text-gray-500">{formatDate(entry.date, 'MMM dd, yyyy')}</p>
                      <p className="text-xs text-gray-500 truncate">{entry.branchName}</p>
                      {entry.specialHours && !entry.allDay && (
                        <p className="text-xs text-gray-500">
                          Hours: {entry.specialHours.open} - {entry.specialHours.close}
                        </p>
                      )}
                      {entry.allDay && (
                        <p className="text-xs text-gray-500">All Day</p>
                      )}
                    </div>
                    {typeInfo && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color} flex-shrink-0`}>
                        {typeInfo.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Entries */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-4 md:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Dates</h2>
        </div>
        <div className="p-4 md:p-6">
          {upcomingEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No upcoming dates scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingEntries.slice(0, 10).map((entry) => {
                const typeInfo = entryTypes.find(t => t.value === entry.type);
                return (
                  <div key={entry.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex-shrink-0">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(entry.date, 'MMM dd, yyyy')} ΓÇó {entry.branchName}
                        </p>
                        {entry.specialHours && !entry.allDay && (
                          <p className="text-xs text-gray-500 mt-1">
                            Hours: {entry.specialHours.open} - {entry.specialHours.close}
                          </p>
                        )}
                        {entry.allDay && (
                          <p className="text-xs text-gray-500 mt-1">All Day</p>
                        )}
                        {entry.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{entry.description}</p>
                        )}
                      </div>
                      {typeInfo && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color} flex-shrink-0`}>
                          {typeInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationalManagerCalendar;

