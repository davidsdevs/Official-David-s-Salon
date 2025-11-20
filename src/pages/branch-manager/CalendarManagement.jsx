/**
 * Calendar Management Page
 * For Branch Managers to manage holidays and special dates
 */

import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar as CalendarIcon, Trash2, Edit, AlertCircle, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  saveBranchCalendarEntry, 
  deleteBranchCalendarEntry,
  getCalendarEntryTypes 
} from '../../services/branchCalendarService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CalendarFormModal from '../../components/branch/CalendarFormModal';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { getPublicHolidays } from '../../services/holidaysApiService';

const CalendarManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [holidayCache, setHolidayCache] = useState({});
  const [holidayYearsLoaded, setHolidayYearsLoaded] = useState({});
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [selectedDateForNewEntry, setSelectedDateForNewEntry] = useState('');

  useEffect(() => {
    if (userBranch) {
      fetchCalendar();
    }
  }, [userBranch]);

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

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      // Fetch all entries for this branch (approved and pending)
      const calendarRef = collection(db, 'calendar');
      const branchQuery = query(
        calendarRef,
        where('branchId', '==', userBranch)
      );
      const branchSnapshot = await getDocs(branchQuery);
      const allEntries = branchSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate()
        }))
        .sort((a, b) => {
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
      toast.error('Failed to load Philippine holidays');
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

  const handleDayClick = (date) => {
    const dateKey = formatDateKey(date);
    setSelectedEntry(null);
    setSelectedDateForNewEntry(dateKey);
    setShowModal(true);
  };

  const handleAddEntry = () => {
    const todayKey = formatDateKey(new Date());
    setSelectedEntry(null);
    setSelectedDateForNewEntry(todayKey);
    setShowModal(true);
  };

  const handleEditEntry = (entry) => {
    setSelectedEntry(entry);
    setSelectedDateForNewEntry('');
    setShowModal(true);
  };

  const handleDeleteEntry = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    
    try {
      setDeleting(true);
      await deleteBranchCalendarEntry(userBranch, entryToDelete.id, currentUser);
      await fetchCalendar();
      setShowDeleteModal(false);
    } catch (error) {
      // Error handled in service
    } finally {
      setDeleting(false);
      setEntryToDelete(null);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      setSaving(true);
      const entryData = {
        ...formData,
        id: selectedEntry?.id
      };
      
      await saveBranchCalendarEntry(userBranch, entryData, currentUser);
      setShowModal(false);
      setSelectedDateForNewEntry('');
      await fetchCalendar();
    } catch (error) {
      // Error handled in service
    } finally {
      setSaving(false);
    }
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
      return entryDate >= today && e.status === 'approved';
    });
  }, [entries, today]);

  const pastEntries = useMemo(() => {
    return entries.filter(e => {
      const entryDate = new Date(e.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate < today && e.status === 'approved';
    });
  }, [entries, today]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar & Holidays</h1>
          <p className="text-gray-600">Manage branch closures and special dates</p>
        </div>
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Entry
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Calendar Management</p>
          <p>Add holidays, temporary closures, or special operating hours. All new entries require approval from the Operational Manager before being applied.</p>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Calendar View</h2>
            <p className="text-sm text-gray-500">
              Philippines public holidays are automatically highlighted. Click any day to add a branch entry.
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
            <div className="min-w-[160px] text-center font-semibold text-gray-900">
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
        <div className="p-6 space-y-4">
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
              const canAddEntry = inCurrentMonth;

              return (
                <div
                  key={`${dateKey}-${index}`}
                  className={`min-h-[140px] rounded-xl border p-2 flex flex-col gap-1 ${
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
                        {holiday.localName || holiday.name}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {dayEntries.slice(0, 3).map(entry => {
                      const isPending = entry.status === 'pending';
                      const badgeClasses = isPending
                        ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                        : 'bg-green-50 text-green-800 border border-green-200';

                      return (
                        <button
                          key={entry.id}
                          onClick={() => handleEditEntry(entry)}
                          className={`w-full text-left text-[11px] px-2 py-1 rounded-lg ${badgeClasses} truncate`}
                          title={`${entry.title} (${isPending ? 'Pending' : 'Approved'})`}
                        >
                          {entry.title}
                        </button>
                      );
                    })}
                    {dayEntries.length > 3 && (
                      <p className="text-[11px] text-gray-500">
                        +{dayEntries.length - 3} more
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDayClick(date)}
                    disabled={!canAddEntry}
                    className={`text-[11px] font-medium flex items-center gap-1 justify-start mt-auto ${
                      canAddEntry
                        ? 'text-primary-600 hover:text-primary-700'
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
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

      {/* Pending Entries */}
      {entries.filter(e => e.status === 'pending').length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Pending Approval</h3>
          </div>
          <p className="text-sm text-yellow-800 mb-3">
            You have {entries.filter(e => e.status === 'pending').length} calendar {entries.filter(e => e.status === 'pending').length === 1 ? 'entry' : 'entries'} waiting for approval.
          </p>
          <div className="space-y-2">
            {entries.filter(e => e.status === 'pending').map((entry) => {
              const typeInfo = entryTypes.find(t => t.value === entry.type);
              return (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-4 h-4 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                      <p className="text-xs text-gray-500">{formatDate(entry.date, 'MMM dd, yyyy')}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                      {typeInfo?.label}
                    </span>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    Pending
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Entries */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Dates</h2>
        </div>
        <div className="p-6">
          {upcomingEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No upcoming dates scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingEntries.map((entry) => {
                const typeInfo = entryTypes.find(t => t.value === entry.type);
                return (
                  <div key={entry.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex-shrink-0">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                            {typeInfo?.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{formatDate(entry.date, 'EEEE, MMMM dd, yyyy')}</p>
                        {entry.description && (
                          <p className="text-sm text-gray-500">{entry.description}</p>
                        )}
                        {entry.type === 'special_hours' && entry.specialHours && (
                          <p className="text-sm text-gray-600 mt-1">
                            Special Hours: {entry.specialHours.open} - {entry.specialHours.close}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="p-2 text-red-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Past Entries */}
      {pastEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Past Dates</h2>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {pastEntries.slice(0, 5).map((entry) => {
                const typeInfo = entryTypes.find(t => t.value === entry.type);
                return (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                        <p className="text-xs text-gray-500">{formatDate(entry.date, 'MMM dd, yyyy')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                        {typeInfo?.label}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry)}
                      className="p-2 text-red-600 hover:bg-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {pastEntries.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  +{pastEntries.length - 5} more past entries
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entry Form Modal */}
      <CalendarFormModal
        isOpen={showModal}
        entry={selectedEntry}
        defaultDate={selectedEntry ? '' : selectedDateForNewEntry}
        onClose={() => {
          if (!saving) {
            setShowModal(false);
            setSelectedEntry(null);
            setSelectedDateForNewEntry('');
          }
        }}
        onSubmit={handleSubmit}
        loading={saving}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!deleting) {
            setShowDeleteModal(false);
            setEntryToDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Delete Calendar Entry"
        message={`Are you sure you want to delete "${entryToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />
    </div>
  );
};

export default CalendarManagement;
