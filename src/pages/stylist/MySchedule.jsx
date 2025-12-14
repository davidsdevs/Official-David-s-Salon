/**
 * My Schedule Page - Stylist
 * Calendar view showing schedules, leave requests, and stylist lending
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Building2, CalendarDays, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllScheduleConfigurations } from '../../services/scheduleService';
import { getLeaveRequestsByEmployee } from '../../services/leaveManagementService';
import { getActiveLending } from '../../services/stylistLendingService';
import { getBranchById } from '../../services/branchService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDate, formatTime12Hour, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const MySchedule = () => {
  const { currentUser, userBranch, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('week'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Stylist - My Schedule | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);

  // Debug: Log component mount and props
  useEffect(() => {
    console.log('MySchedule component mounted', { 
      hasCurrentUser: !!currentUser, 
      userBranch, 
      hasUserData: !!userData 
    });
  }, []);
  
  // Data
  const [allScheduleConfigs, setAllScheduleConfigs] = useState([]);
  const [dateSpecificShifts, setDateSpecificShifts] = useState({});
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [lendingPeriods, setLendingPeriods] = useState([]);
  const [branchCache, setBranchCache] = useState({});
  const [currentBranchName, setCurrentBranchName] = useState('');

  useEffect(() => {
    if (currentUser && userBranch) {
      fetchAllData();
      fetchCurrentBranchName();
    } else if (currentUser && !userBranch) {
      // If user is logged in but no branch, still stop loading
      setLoading(false);
    }
  }, [currentUser, userBranch]);

  const fetchCurrentBranchName = async () => {
    try {
      if (userBranch) {
        const branch = await getBranchById(userBranch);
        setCurrentBranchName(branch?.branchName || branch?.name || 'Your Branch');
      }
    } catch (error) {
      console.error('Error fetching current branch name:', error);
      setCurrentBranchName('Your Branch');
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchScheduleData(),
        fetchLeaveRequests(),
        fetchLendingPeriods()
      ]);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleData = async () => {
    try {
      if (!userBranch) {
        console.warn('userBranch is not available');
        setAllScheduleConfigs([]);
        return;
      }
      if (!currentUser?.uid) {
        setAllScheduleConfigs([]);
        return;
      }
      // Get all schedule configurations
      const configs = await getAllScheduleConfigurations(userBranch);
      setAllScheduleConfigs(Array.isArray(configs) ? configs : []);
      
      // Get date-specific shifts
      const schedulesRef = collection(db, 'schedules');
      if (!userBranch || !currentUser?.uid) {
        return;
      }
      
      const dateSpecificQuery = query(
        schedulesRef,
        where('branchId', '==', userBranch),
        where('employeeId', '==', currentUser.uid)
      );
      
      const dateSpecificSnapshot = await getDocs(dateSpecificQuery);
      const dateSpecificMap = {};
      
      dateSpecificSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date && data.startTime && data.endTime) {
          let scheduleDate;
          if (data.date?.toDate) {
            scheduleDate = data.date.toDate();
          } else {
            scheduleDate = new Date(data.date);
          }
          
          const dateStr = scheduleDate.toISOString().split('T')[0];
          dateSpecificMap[dateStr] = {
            start: data.startTime,
            end: data.endTime,
            date: scheduleDate,
            isDateSpecific: true
          };
        }
      });
      
      setDateSpecificShifts(dateSpecificMap);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      if (!currentUser?.uid) {
        return;
      }
      const requests = await getLeaveRequestsByEmployee(currentUser.uid);
      const leaves = Array.isArray(requests) ? requests : [];
      
      // Filter to only approved leaves and safely convert dates
      const approvedLeaves = leaves
        .filter(leave => leave && leave.status === 'approved')
        .map(leave => {
          try {
            let startDate, endDate;
            
            if (leave.startDate) {
              if (leave.startDate?.toDate && typeof leave.startDate.toDate === 'function') {
                startDate = leave.startDate.toDate();
              } else if (leave.startDate instanceof Date) {
                startDate = leave.startDate;
              } else {
                startDate = new Date(leave.startDate);
              }
            }
            
            if (leave.endDate) {
              if (leave.endDate?.toDate && typeof leave.endDate.toDate === 'function') {
                endDate = leave.endDate.toDate();
              } else if (leave.endDate instanceof Date) {
                endDate = leave.endDate;
              } else {
                endDate = new Date(leave.endDate);
              }
            }
            
            if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              return null;
            }
            
            return {
              ...leave,
              startDate,
              endDate
            };
          } catch (err) {
            console.warn('Error processing leave request:', err, leave);
            return null;
          }
        })
        .filter(leave => leave !== null);
      
      setLeaveRequests(approvedLeaves);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      setLeaveRequests([]);
    }
  };

  const fetchLendingPeriods = async () => {
    try {
      if (!currentUser?.uid) {
        setLendingPeriods([]);
        return;
      }
      const lendingRef = collection(db, 'stylist_lending');
      const approvedQuery = query(
        lendingRef,
        where('stylistId', '==', currentUser.uid),
        where('status', '==', 'approved')
      );
      const activeQuery = query(
        lendingRef,
        where('stylistId', '==', currentUser.uid),
        where('status', '==', 'active')
      );
      
      const [approvedSnapshot, activeSnapshot] = await Promise.all([
        getDocs(approvedQuery),
        getDocs(activeQuery)
      ]);
      
      const allLendings = [];
      const branchIds = new Set();
      
      [...approvedSnapshot.docs, ...activeSnapshot.docs].forEach((doc) => {
        const data = doc.data();
        const startDate = data.startDate?.toDate();
        const endDate = data.endDate?.toDate();
        
        if (startDate && endDate) {
          allLendings.push({
            id: doc.id,
            startDate,
            endDate,
            toBranchId: data.toBranchId,
            fromBranchId: data.fromBranchId,
            status: data.status,
            reason: data.reason
          });
          
          if (data.toBranchId) branchIds.add(data.toBranchId);
          if (data.fromBranchId) branchIds.add(data.fromBranchId);
        }
      });
      
      // Fetch branch names
      const branchMap = {};
      await Promise.all(
        Array.from(branchIds).map(async (branchId) => {
          try {
            const branch = await getBranchById(branchId);
            branchMap[branchId] = branch?.branchName || branch?.name || 'Unknown Branch';
          } catch (error) {
            branchMap[branchId] = 'Unknown Branch';
          }
        })
      );
      
      setBranchCache(branchMap);
      setLendingPeriods(allLendings);
    } catch (error) {
      console.error('Error fetching lending periods:', error);
    }
  };

  // Get schedule for a specific date
  const getScheduleForDate = (date) => {
    if (!date || !currentUser?.uid) return null;
    
    try {
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return null;
      }
      const dateStr = date.toISOString().split('T')[0];
    
      // Check date-specific shift first
      if (dateSpecificShifts[dateStr]) {
        return dateSpecificShifts[dateStr];
      }

      // Check recurring shift from schedule configuration
      const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
      
      // Find the most recent config that applies to this date
      const applicableConfig = allScheduleConfigs
        .filter(c => {
          if (!c || !c.startDate) return false;
          try {
            const configStart = new Date(c.startDate);
            if (isNaN(configStart.getTime())) return false;
            configStart.setHours(0, 0, 0, 0);
            const checkDate = new Date(date);
            checkDate.setHours(0, 0, 0, 0);
            return configStart <= checkDate;
          } catch (err) {
            return false;
          }
        })
        .sort((a, b) => {
          try {
            return new Date(b.startDate) - new Date(a.startDate);
          } catch (err) {
            return 0;
          }
        })[0];

      if (applicableConfig?.shifts?.[currentUser.uid]?.[dayKey]) {
        const shift = applicableConfig.shifts[currentUser.uid][dayKey];
        return {
          start: shift.start,
          end: shift.end,
          isRecurring: true
        };
      }

      return null;
    } catch (error) {
      console.error('Error in getScheduleForDate:', error);
      return null;
    }
  };

  // Get leave info for a date
  const getLeaveForDate = (date) => {
    if (!date || !leaveRequests || leaveRequests.length === 0) return null;
    
    try {
      const checkDate = new Date(date);
      if (isNaN(checkDate.getTime())) return null;
      checkDate.setHours(0, 0, 0, 0);
      
      return leaveRequests.find(leave => {
        if (!leave || !leave.startDate || !leave.endDate) return false;
        try {
          const start = new Date(leave.startDate);
          if (isNaN(start.getTime())) return false;
          start.setHours(0, 0, 0, 0);
          const end = new Date(leave.endDate);
          if (isNaN(end.getTime())) return false;
          end.setHours(23, 59, 59, 999);
          return checkDate >= start && checkDate <= end;
        } catch (err) {
          return false;
        }
      });
    } catch (error) {
      console.error('Error in getLeaveForDate:', error);
      return null;
    }
  };

  // Get lending info for a date
  const getLendingForDate = (date) => {
    if (!date || !lendingPeriods || lendingPeriods.length === 0) return null;
    
    try {
      const checkDate = new Date(date);
      if (isNaN(checkDate.getTime())) return null;
      checkDate.setHours(0, 0, 0, 0);
      
      return lendingPeriods.find(lending => {
        if (!lending || !lending.startDate || !lending.endDate) return false;
        try {
          const start = new Date(lending.startDate);
          if (isNaN(start.getTime())) return false;
          start.setHours(0, 0, 0, 0);
          const end = new Date(lending.endDate);
          if (isNaN(end.getTime())) return false;
          end.setHours(23, 59, 59, 999);
          return checkDate >= start && checkDate <= end;
        } catch (err) {
          return false;
        }
      });
    } catch (error) {
      console.error('Error in getLendingForDate:', error);
      return null;
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getWeekDates = (date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Show message if branch is not available
  if (!userBranch) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-600">View your shifts, leaves, and lending assignments</p>
        </div>
        <Card>
          <div className="p-6 text-center">
            <p className="text-gray-500">Branch information not available. Please contact your administrator.</p>
          </div>
        </Card>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-600">View your shifts, leaves, and lending assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
          >
            Today
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <Card>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'day' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setView('day')}
            >
              Daily
            </Button>
            <Button
              variant={view === 'week' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setView('week')}
            >
              Weekly
            </Button>
            <Button
              variant={view === 'month' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setView('month')}
            >
              Monthly
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
              {view === 'day' && formatDate(currentDate, 'MMMM dd, yyyy')}
              {view === 'week' && (() => {
                const week = getWeekDates(currentDate);
                return `${formatDate(week[0], 'MMM dd')} - ${formatDate(week[6], 'MMM dd, yyyy')}`;
              })()}
              {view === 'month' && formatDate(currentDate, 'MMMM yyyy')}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar Views */}
      {view === 'day' && (
        <Card>
          <div className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {formatDate(currentDate, 'EEEE, MMMM dd, yyyy')}
              </h2>
            </div>

            <div className="space-y-4">
              {/* Schedule */}
              {(() => {
                const schedule = getScheduleForDate(currentDate);
                const leave = getLeaveForDate(currentDate);
                const lending = getLendingForDate(currentDate);
                
                return (
                  <div className="space-y-3">
                    {schedule && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-blue-900">Shift Schedule</h3>
                        </div>
                        <div className="space-y-1">
                          <p className="text-blue-800 font-medium">
                            {formatTime12Hour(schedule.start)} - {formatTime12Hour(schedule.end)}
                          </p>
                          <p className="text-sm text-blue-700">
                            {schedule.isRecurring ? 'Recurring Schedule' : 'Date-Specific Shift'}
                          </p>
                          {currentBranchName && (
                            <p className="text-xs text-blue-600 mt-2">
                              Branch: {currentBranchName}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {leave && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CalendarDays className="w-5 h-5 text-orange-600" />
                          <h3 className="font-semibold text-orange-900">On Leave</h3>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-orange-800 font-medium">
                              Leave Type: {leave.type || 'N/A'}
                            </p>
                            {leave.reason && (
                              <p className="text-sm text-orange-700 mt-1">
                                Reason: {leave.reason}
                              </p>
                            )}
                          </div>
                          <div className="pt-2 border-t border-orange-200">
                            <p className="text-sm text-orange-700">
                              <span className="font-medium">Period:</span> {formatDate(leave.startDate)} to {formatDate(leave.endDate)}
                            </p>
                            {leave.status && (
                              <p className="text-xs text-orange-600 mt-1">
                                Status: {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {lending && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Building2 className="w-5 h-5 text-purple-600" />
                          <h3 className="font-semibold text-purple-900">Lent to Branch</h3>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-purple-600 mb-1">Destination Branch:</p>
                            <p className="text-purple-800 font-semibold text-lg">
                              {branchCache[lending.toBranchId] || 'Unknown Branch'}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-purple-200">
                            <p className="text-sm text-purple-700">
                              <span className="font-medium">Period:</span> {formatDate(lending.startDate)} to {formatDate(lending.endDate)}
                            </p>
                            {lending.reason && (
                              <p className="text-sm text-purple-700 mt-1">
                                <span className="font-medium">Reason:</span> {lending.reason}
                              </p>
                            )}
                            {lending.status && (
                              <p className="text-xs text-purple-600 mt-1">
                                Status: {lending.status.charAt(0).toUpperCase() + lending.status.slice(1)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {!schedule && !leave && !lending && (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>No schedule, leave, or lending assignment for this day</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </Card>
      )}

      {view === 'week' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  {getWeekDates(currentDate).map((date, idx) => {
                    const isToday = date.toDateString() === today.toDateString();
                    return (
                      <th
                        key={idx}
                        className={`px-4 py-3 text-center text-xs font-medium uppercase ${
                          isToday ? 'bg-primary-50 text-primary-700' : 'text-gray-500'
                        }`}
                      >
                        <div>{formatDate(date, 'EEE')}</div>
                        <div className={`text-sm font-bold mt-1 ${isToday ? 'text-primary-900' : 'text-gray-900'}`}>
                          {formatDate(date, 'dd')}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from({ length: 24 }, (_, hour) => (
                  <tr key={hour}>
                    <td className="px-4 py-2 text-xs text-gray-500 border-r border-gray-200">
                      {hour.toString().padStart(2, '0')}:00
                    </td>
                    {getWeekDates(currentDate).map((date, dayIdx) => {
                      const schedule = getScheduleForDate(date);
                      const leave = getLeaveForDate(date);
                      const lending = getLendingForDate(date);
                      const isToday = date.toDateString() === today.toDateString();
                      
                      // Check if this hour is within schedule
                      const hourStr = hour.toString().padStart(2, '0');
                      let isInSchedule = false;
                      if (schedule && schedule.start && schedule.end) {
                        try {
                          const startHour = parseInt(schedule.start.split(':')[0]);
                          const endHour = parseInt(schedule.end.split(':')[0]);
                          if (!isNaN(startHour) && !isNaN(endHour)) {
                            isInSchedule = startHour <= hour && endHour > hour;
                          }
                        } catch (err) {
                          // Ignore parsing errors
                        }
                      }
                      
                      return (
                        <td
                          key={dayIdx}
                          className={`px-2 py-1 border-r border-gray-200 ${
                            isToday ? 'bg-primary-50' : ''
                          }`}
                        >
                          {hour === 0 && (
                            <div className="space-y-1">
                              {schedule && (
                                <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {formatTime12Hour(schedule.start)} - {formatTime12Hour(schedule.end)}
                                </div>
                              )}
                              {leave && (
                                <div className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded" title={`Leave: ${leave.type}${leave.reason ? ' - ' + leave.reason : ''}`}>
                                  <CalendarDays className="w-3 h-3 inline mr-1" />
                                  Leave: {leave.type}
                                </div>
                              )}
                              {lending && (
                                <div className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded" title={`Lent to: ${branchCache[lending.toBranchId] || 'Unknown Branch'}`}>
                                  <Building2 className="w-3 h-3 inline mr-1" />
                                  {branchCache[lending.toBranchId]?.substring(0, 15) || 'Lent'}...
                                </div>
                              )}
                            </div>
                          )}
                          {isInSchedule && (
                            <div className="h-full bg-blue-200 rounded"></div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'month' && (
        <Card>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentDate).map((date, idx) => {
                if (!date) {
                  return <div key={idx} className="aspect-square"></div>;
                }
                
                const isToday = date.toDateString() === today.toDateString();
                const schedule = getScheduleForDate(date);
                const leave = getLeaveForDate(date);
                const lending = getLendingForDate(date);
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                
                return (
                  <div
                    key={idx}
                    className={`aspect-square border border-gray-200 rounded-lg p-2 ${
                      isToday ? 'bg-primary-50 border-primary-300' : ''
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${
                      isToday ? 'text-primary-700' : 'text-gray-700'
                    }`}>
                      {formatDate(date, 'd')}
                    </div>
                    <div className="space-y-1">
                      {schedule && (
                        <div className="bg-blue-100 text-blue-800 text-[10px] px-1 py-0.5 rounded truncate">
                          <Clock className="w-2 h-2 inline mr-0.5" />
                          {formatTime12Hour(schedule.start)}-{formatTime12Hour(schedule.end)}
                        </div>
                      )}
                      {leave && (
                        <div className="bg-orange-100 text-orange-800 text-[10px] px-1 py-0.5 rounded truncate">
                          <CalendarDays className="w-2 h-2 inline mr-0.5" />
                          Leave
                        </div>
                      )}
                      {lending && (
                        <div className="bg-purple-100 text-purple-800 text-[10px] px-1 py-0.5 rounded truncate" title={`Lent to: ${branchCache[lending.toBranchId] || 'Unknown Branch'}`}>
                          <Building2 className="w-2 h-2 inline mr-0.5" />
                          {branchCache[lending.toBranchId]?.substring(0, 10) || 'Lent'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
              <span className="text-sm text-gray-700">Shift Schedule</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded"></div>
              <span className="text-sm text-gray-700">On Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border border-purple-200 rounded"></div>
              <span className="text-sm text-gray-700">Lent to Branch</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default MySchedule;
