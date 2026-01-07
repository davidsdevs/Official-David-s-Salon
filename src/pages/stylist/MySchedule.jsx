/**
 * My Schedule Page - Stylist
 * View of stylist's shifts, leave requests, and lending assignments with calendar view
 * Aligned with mobile app functionality
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Clock, Download, Plus, MapPin, List, CalendarDays, Plane, AlertCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getAllScheduleConfigurations } from '../../services/scheduleService';
import { getLeaveRequestsByEmployee, LEAVE_TYPES } from '../../services/leaveManagementService';
import { getFullName, getInitials, formatTime12Hour } from '../../utils/helpers';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import LeaveRequestModal from '../../components/leave/LeaveRequestModal';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' }
];

const MySchedule = () => {
  const navigate = useNavigate();
  const { currentUser, userBranch, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allScheduleConfigs, setAllScheduleConfigs] = useState([]);
  const [dateSpecificShifts, setDateSpecificShifts] = useState({});
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [lendings, setLendings] = useState([]);
  const [myLeaveMap, setMyLeaveMap] = useState([]);
  const [branchName, setBranchName] = useState('');
  const [activeTab, setActiveTab] = useState('calendar');
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setDate(monday.getDate() + 6);
    monday.setHours(23, 59, 59, 999);
    return monday.toISOString().split('T')[0];
  });
  const [exporting, setExporting] = useState(false);
  const scheduleRef = useRef(null);

  // Fetch branch name
  useEffect(() => {
    if (!userBranch) { setBranchName(''); return; }
    const fetchBranchName = async () => {
      try {
        const branchDoc = await getDoc(doc(db, 'branches', userBranch));
        if (branchDoc.exists()) {
          const branchData = branchDoc.data();
          setBranchName(branchData.name || branchData.branchName || 'Unknown Branch');
        }
      } catch (error) {
        setBranchName('Unknown Branch');
      }
    };
    fetchBranchName();
  }, [userBranch]);

  useEffect(() => {
    if (currentUser && userBranch) {
      fetchScheduleData();
      fetchLeaveRequests();
    }
  }, [currentUser, userBranch, startDate, endDate]);

  // Set up real-time subscription for lending
  useEffect(() => {
    const stylistId = currentUser?.uid;
    if (!stylistId) { setLendings([]); return; }
    
    const lendingRef = collection(db, 'lending');
    const q1 = query(lendingRef, where('fromStylistId', '==', stylistId));
    const q2 = query(lendingRef, where('toStylistId', '==', stylistId));
    
    let lendingsAsLender = [];
    let lendingsAsBorrower = [];
    
    const updateLendings = () => {
      const allLendings = [...lendingsAsBorrower, ...lendingsAsLender];
      const uniqueLendings = allLendings.filter((lending, index, self) =>
        index === self.findIndex(l => l.id === lending.id)
      );
      setLendings(uniqueLendings);
    };
    
    const processLending = async (docSnapshot) => {
      const lendingData = docSnapshot.data();
      let date = lendingData.date;
      if (date?.toDate) { date = date.toDate().toISOString().split('T')[0]; }
      else if (date?.seconds) { date = new Date(date.seconds * 1000).toISOString().split('T')[0]; }
      else if (typeof date === 'string' && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(date).toISOString().split('T')[0];
      }
      
      let fromBranchName = '';
      let toBranchName = '';
      
      if (lendingData.fromBranchId) {
        try {
          const branchDoc = await getDoc(doc(db, 'branches', lendingData.fromBranchId));
          if (branchDoc.exists()) {
            fromBranchName = branchDoc.data().name || branchDoc.data().branchName || '';
          }
        } catch (error) { /* ignore */ }
      }
      
      if (lendingData.toBranchId) {
        try {
          const branchDoc = await getDoc(doc(db, 'branches', lendingData.toBranchId));
          if (branchDoc.exists()) {
            toBranchName = branchDoc.data().name || branchDoc.data().branchName || '';
          }
        } catch (error) { /* ignore */ }
      }
      
      return {
        id: docSnapshot.id,
        fromStylistId: lendingData.fromStylistId || '',
        toStylistId: lendingData.toStylistId || '',
        fromBranchId: lendingData.fromBranchId || '',
        toBranchId: lendingData.toBranchId || '',
        fromBranchName,
        toBranchName,
        date,
        shiftStart: lendingData.shiftStart || '',
        shiftEnd: lendingData.shiftEnd || '',
        status: lendingData.status || 'pending',
        reason: lendingData.reason || '',
      };
    };
    
    const unsubscribe1 = onSnapshot(q1, async (querySnapshot) => {
      const promises = [];
      querySnapshot.forEach((docSnapshot) => { promises.push(processLending(docSnapshot)); });
      lendingsAsLender = await Promise.all(promises);
      updateLendings();
    });
    
    const unsubscribe2 = onSnapshot(q2, async (querySnapshot) => {
      const promises = [];
      querySnapshot.forEach((docSnapshot) => { promises.push(processLending(docSnapshot)); });
      lendingsAsBorrower = await Promise.all(promises);
      updateLendings();
    });

    return () => { unsubscribe1(); unsubscribe2(); };
  }, [currentUser?.uid]);


  const fetchScheduleData = async () => {
    try {
      setLoading(true);
      if (userBranch && currentUser?.uid) {
        const configs = await getAllScheduleConfigurations(userBranch);
        setAllScheduleConfigs(configs);
        
        const rangeStartDate = new Date(startDate);
        rangeStartDate.setHours(0, 0, 0, 0);
        const rangeEndDate = new Date(endDate);
        rangeEndDate.setHours(23, 59, 59, 999);
        
        const schedulesRef = collection(db, 'schedules');
        const dateSpecificQuery = query(
          schedulesRef,
          where('branchId', '==', userBranch),
          where('employeeId', '==', currentUser.uid)
        );
        
        const dateSpecificSnapshot = await getDocs(dateSpecificQuery);
        const dateSpecificMap = {};
        
        dateSpecificSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.date) {
            let scheduleDate;
            if (data.date?.toDate) {
              scheduleDate = data.date.toDate();
            } else if (data.date instanceof Date) {
              scheduleDate = new Date(data.date);
            } else {
              scheduleDate = new Date(data.date);
            }
            
            const scheduleDateOnly = new Date(scheduleDate);
            scheduleDateOnly.setHours(0, 0, 0, 0);
            
            if (scheduleDateOnly >= rangeStartDate && scheduleDateOnly <= rangeEndDate) {
              const dateStr = scheduleDateOnly.toISOString().split('T')[0];
              if (data.startTime && data.endTime) {
                dateSpecificMap[dateStr] = {
                  start: data.startTime,
                  end: data.endTime,
                  date: scheduleDateOnly,
                  isDateSpecific: true
                };
              }
            }
          }
        });
        
        setDateSpecificShifts(dateSpecificMap);
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      if (currentUser?.uid) {
        const result = await getLeaveRequestsByEmployee(currentUser.uid, 1000);
        const leaves = result.requests || result;
        setLeaveRequests(Array.isArray(leaves) ? leaves : []);

        const leaveMap = [];
        const rangeStartDate = new Date(startDate);
        const rangeEndDate = new Date(endDate);
        rangeStartDate.setHours(0, 0, 0, 0);
        rangeEndDate.setHours(23, 59, 59, 999);
        
        leaves.forEach(leave => {
          // Include both approved and pending leaves for display
          if (leave.status === 'rejected' || leave.status === 'cancelled') return;
          
          let leaveStartDate, leaveEndDate;
          
          if (leave.startDate instanceof Date) {
            leaveStartDate = new Date(leave.startDate);
          } else if (leave.startDate && typeof leave.startDate.toDate === 'function') {
            leaveStartDate = leave.startDate.toDate();
          } else if (leave.startDate) {
            leaveStartDate = new Date(leave.startDate);
          } else return;
          
          if (leave.endDate instanceof Date) {
            leaveEndDate = new Date(leave.endDate);
          } else if (leave.endDate && typeof leave.endDate.toDate === 'function') {
            leaveEndDate = leave.endDate.toDate();
          } else if (leave.endDate) {
            leaveEndDate = new Date(leave.endDate);
          } else return;
          
          leaveStartDate.setHours(0, 0, 0, 0);
          leaveEndDate.setHours(23, 59, 59, 999);
          
          if (leaveStartDate > leaveEndDate) return;
          
          if (leaveEndDate >= rangeStartDate && leaveStartDate <= rangeEndDate) {
            leaveMap.push({
              id: leave.id,
              startDate: leaveStartDate,
              endDate: leaveEndDate,
              status: leave.status,
              type: leave.type,
              reason: leave.reason
            });
          }
        });
        
        setMyLeaveMap(leaveMap);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    }
  };


  // Get scheduled days from config (for weekly schedule view)
  const scheduledDays = useMemo(() => {
    const stylistId = currentUser?.uid;
    if (!stylistId || allScheduleConfigs.length === 0) return [];

    for (const config of allScheduleConfigs) {
      if (!config.shifts) continue;
      const stylistShifts = config.shifts[stylistId];
      
      if (stylistShifts) {
        const daysWithShifts = [];
        const dayMap = {
          'sunday': 'Sunday', 'monday': 'Monday', 'tuesday': 'Tuesday',
          'wednesday': 'Wednesday', 'thursday': 'Thursday', 'friday': 'Friday', 'saturday': 'Saturday',
        };
        const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        dayOrder.forEach(dayKey => {
          if (stylistShifts[dayKey] && stylistShifts[dayKey].start && stylistShifts[dayKey].end) {
            daysWithShifts.push({ dayName: dayKey, dayNameFull: dayMap[dayKey], shift: stylistShifts[dayKey] });
          }
        });
        return daysWithShifts;
      }
    }
    return [];
  }, [allScheduleConfigs, currentUser?.uid]);

  // Calculate stats
  const scheduleStats = useMemo(() => {
    const totalShifts = scheduledDays.length;
    let totalHours = 0;
    
    scheduledDays.forEach(day => {
      const parseTime = (timeStr) => {
        let hours = 0, minutes = 0;
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
          const parts = timeStr.split(' ');
          const time = parts[0] || '0:0';
          const period = parts[1] || 'AM';
          const timeParts = time.split(':').map(Number);
          const h = timeParts[0] ?? 0;
          const m = timeParts[1] ?? 0;
          hours = h === 12 ? (period === 'AM' ? 0 : 12) : (period === 'PM' ? h + 12 : h);
          minutes = m;
        } else {
          const timeParts = timeStr.split(':').map(Number);
          hours = timeParts[0] ?? 0;
          minutes = timeParts[1] ?? 0;
        }
        return hours + minutes / 60;
      };
      totalHours += parseTime(day.shift.end) - parseTime(day.shift.start);
    });
    
    const approvedLeaves = leaveRequests.filter(l => l.status === 'approved').length;
    const pendingLeaves = leaveRequests.filter(l => l.status === 'pending').length;
    
    return { totalShifts, totalHours: Math.round(totalHours * 10) / 10, approvedLeaves, pendingLeaves };
  }, [scheduledDays, leaveRequests]);

  const getDateRangeDates = () => {
    const dates = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const getDayKey = (date) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  const getScheduleForDate = (configs, targetDate) => {
    if (!targetDate || !configs || configs.length === 0) return null;
    
    const targetDateObj = new Date(targetDate);
    targetDateObj.setHours(0, 0, 0, 0);
    const targetTime = targetDateObj.getTime();
    
    const applicableConfigs = configs
      .filter(c => {
        if (!c.startDate) return false;
        const configStartDate = new Date(c.startDate);
        configStartDate.setHours(0, 0, 0, 0);
        return configStartDate.getTime() <= targetTime;
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    
    return applicableConfigs.length > 0 ? applicableConfigs[0] : null;
  };

  const getShiftForDay = (dayKey, date) => {
    if (!date || !currentUser?.uid) return null;

    if (dateSpecificShifts && date) {
      const dateStr = date.toISOString().split('T')[0];
      if (dateSpecificShifts[dateStr]) {
        return dateSpecificShifts[dateStr];
      }
    }

    if (allScheduleConfigs.length > 0) {
      const configForDate = getScheduleForDate(allScheduleConfigs, date);
      
      if (configForDate && configForDate.shifts) {
        const employeeId = currentUser.uid;
        let employeeShifts = configForDate.shifts[employeeId];
        
        if (!employeeShifts) {
          const availableIds = Object.keys(configForDate.shifts);
          const matchingId = availableIds.find(id => id === employeeId || id.includes(employeeId) || employeeId.includes(id));
          if (matchingId) employeeShifts = configForDate.shifts[matchingId];
        }
        
        if (employeeShifts && employeeShifts[dayKey] && employeeShifts[dayKey].start && employeeShifts[dayKey].end) {
          return { start: employeeShifts[dayKey].start, end: employeeShifts[dayKey].end, isRecurring: true };
        }
      }
    }
    
    return null;
  };

  const isOnLeave = (date) => {
    if (!date || myLeaveMap.length === 0) return false;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return myLeaveMap.some(leave => checkDate >= leave.startDate && checkDate <= leave.endDate);
  };

  const getLeaveInfoForDate = (date) => {
    if (!date || myLeaveMap.length === 0) return null;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return myLeaveMap.find(leave => checkDate >= leave.startDate && checkDate <= leave.endDate) || null;
  };

  const getLendingForDate = (date) => {
    if (!date || lendings.length === 0) return null;
    const dateStr = date.toISOString().split('T')[0];
    return lendings.find(l => l.date === dateStr && (l.status === 'approved' || l.status === 'pending')) || null;
  };

  const getLeaveTypeInfo = (type) => {
    const types = {
      vacation: { icon: Plane, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Vacation' },
      sick: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Sick Leave' },
      personal: { icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Personal' },
      other: { icon: Calendar, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Other' },
    };
    return types[type] || types.other;
  };


  const handleExportPNG = async () => {
    if (!scheduleRef.current) {
      toast.error('No schedule to export');
      return;
    }

    try {
      setExporting(true);
      toast.loading('Generating PNG...', { id: 'export' });
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(scheduleRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: scheduleRef.current.scrollWidth,
        windowHeight: scheduleRef.current.scrollHeight,
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to generate PNG', { id: 'export' });
          setExporting(false);
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `My_Schedule_${startDate}_to_${endDate}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Schedule exported as PNG!', { id: 'export' });
        setExporting(false);
      }, 'image/png', 1.0);
    } catch (error) {
      console.error('Error exporting PNG:', error);
      toast.error('Failed to export schedule', { id: 'export' });
      setExporting(false);
    }
  };

  const handleLeaveSubmit = async (leaveData) => {
    try {
      const { saveLeaveRequest } = await import('../../services/leaveManagementService');
      await saveLeaveRequest({
        ...leaveData,
        employeeId: currentUser.uid,
        branchId: userBranch,
      }, currentUser);
      
      await fetchLeaveRequests();
      setShowLeaveModal(false);
      toast.success('Leave request submitted successfully!');
    } catch (error) {
      console.error('Error submitting leave:', error);
    }
  };

  const dateRangeDates = useMemo(() => getDateRangeDates(), [startDate, endDate]);

  const shiftsCount = useMemo(() => {
    return dateRangeDates.filter(date => {
      const dayKey = getDayKey(date);
      return getShiftForDay(dayKey, date) !== null;
    }).length;
  }, [dateRangeDates, allScheduleConfigs, currentUser, dateSpecificShifts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Branch Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          {branchName && (
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4 text-primary-600" />
              <span className="text-gray-600">{branchName}</span>
            </div>
          )}
          <p className="text-gray-600 mt-1">View your work schedule and manage leaves</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPNG}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export PNG'}
          </button>
        </div>
      </div>

      {/* Request Leave Button - Prominent like mobile */}
      <div 
        onClick={() => setShowLeaveModal(true)}
        className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-4 cursor-pointer hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Request Leave</h3>
            <p className="text-white/80 text-sm">Submit a time-off request</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Stats Cards - Consistent with Receptionist Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <CalendarDays className="h-8 w-8 text-indigo-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Days/Week</p>
              <p className="text-xl font-bold text-gray-900">{scheduleStats.totalShifts}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Weekly Hours</p>
              <p className="text-xl font-bold text-gray-900">{scheduleStats.totalHours}h</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <Plane className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-xl font-bold text-gray-900">{scheduleStats.approvedLeaves}</p>
            </div>
          </div>
        </Card>

        {scheduleStats.pendingLeaves > 0 && (
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-xl font-bold text-gray-900">{scheduleStats.pendingLeaves}</p>
              </div>
            </div>
          </Card>
        )}
      </div>


      {/* Tab Switcher */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'calendar' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'list' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <List className="w-4 h-4" />
            Schedule
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <>
          {/* Legend */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-indigo-100 border-2 border-indigo-500"></div>
                <span className="text-sm text-gray-600">Shift</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-500"></div>
                <span className="text-sm text-gray-600">Leave (Approved)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-500"></div>
                <span className="text-sm text-gray-600">Leave (Pending)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-teal-100 border-2 border-teal-500"></div>
                <span className="text-sm text-gray-600">Lending</span>
              </div>
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Date Range:</span>
              </div>
              <div className="flex items-center gap-4 flex-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <label htmlFor="startDate" className="text-sm text-gray-600">From:</label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => {
                      if (e.target.value <= endDate) setStartDate(e.target.value);
                      else toast.error('Start date must be before end date');
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="endDate" className="text-sm text-gray-600">To:</label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => {
                      if (e.target.value >= startDate) setEndDate(e.target.value);
                      else toast.error('End date must be after start date');
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  {dateRangeDates.length} day{dateRangeDates.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div ref={scheduleRef} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {userData ? getInitials(userData) : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {userData ? getFullName(userData) : currentUser?.displayName || 'You'}
                  </div>
                  <div className="text-xs text-gray-500">{currentUser?.email}</div>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
                {dateRangeDates.map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dayKey = getDayKey(date);
                  const dayInfo = DAYS_OF_WEEK.find(d => d.key === dayKey);
                  const shift = getShiftForDay(dayKey, date);
                  const leaveInfo = getLeaveInfoForDate(date);
                  const lendingInfo = getLendingForDate(date);
                  const onLeave = !!leaveInfo;
                  
                  // Determine card styling based on status
                  let cardBg = 'border-gray-200';
                  let cardBorder = '';
                  if (isToday) {
                    cardBg = 'bg-primary-50';
                    cardBorder = 'border-primary-200';
                  }
                  if (onLeave) {
                    cardBg = leaveInfo.status === 'pending' ? 'bg-yellow-50' : 'bg-red-50';
                    cardBorder = leaveInfo.status === 'pending' ? 'border-yellow-300' : 'border-red-300';
                  }
                  if (lendingInfo) {
                    cardBg = 'bg-teal-50';
                    cardBorder = 'border-teal-300';
                  }
                  
                  return (
                    <div
                      key={index}
                      className={`border rounded-lg p-3 ${cardBg} ${cardBorder || 'border-gray-200'}`}
                    >
                      <div className={`text-center mb-3 pb-2 border-b ${isToday ? 'border-primary-200' : 'border-gray-200'}`}>
                        <div className="text-xs font-semibold text-gray-500 uppercase">{dayInfo?.short}</div>
                        <div className={`text-sm font-medium mt-1 ${isToday ? 'text-primary-700' : 'text-gray-900'}`}>
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      <div className="text-center space-y-2">
                        {lendingInfo ? (
                          <div className="space-y-1">
                            <div className={`px-2 py-1.5 rounded-lg text-xs font-medium ${
                              lendingInfo.toStylistId === currentUser?.uid 
                                ? 'bg-indigo-100 text-indigo-800' 
                                : 'bg-teal-100 text-teal-800'
                            }`}>
                              <div className="flex items-center justify-center gap-1">
                                {lendingInfo.toStylistId === currentUser?.uid 
                                  ? <ArrowDownCircle className="w-3 h-3" />
                                  : <ArrowUpCircle className="w-3 h-3" />
                                }
                                <span>{lendingInfo.toStylistId === currentUser?.uid ? 'BORROWED' : 'LENDING'}</span>
                              </div>
                            </div>
                            {lendingInfo.toBranchName && lendingInfo.toStylistId === currentUser?.uid && (
                              <div className="text-xs text-indigo-600">{lendingInfo.toBranchName}</div>
                            )}
                            <div className={`px-1 py-0.5 rounded text-xs ${
                              lendingInfo.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {lendingInfo.status}
                            </div>
                          </div>
                        ) : onLeave ? (
                          <div className="space-y-1">
                            <div className={`px-2 py-1.5 rounded-lg text-xs font-medium ${
                              leaveInfo.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {leaveInfo.status === 'pending' ? 'PENDING LEAVE' : 'ON LEAVE'}
                            </div>
                            <div className="text-xs text-gray-600">
                              {getLeaveTypeInfo(leaveInfo.type).label}
                            </div>
                          </div>
                        ) : shift ? (
                          <div className="px-2 py-1.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-medium">
                            <div className="flex flex-col items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span className="text-center leading-tight">
                                {formatTime12Hour(shift.start)} - {formatTime12Hour(shift.end)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">No shift</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* List View - Weekly Schedule */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Weekly Schedule</h2>
          </div>
          <div className="p-4">
            {scheduledDays.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarDays className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No Schedule Set</p>
                <p className="text-sm text-gray-400 mt-1">Contact your branch manager to set up your schedule.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledDays.map((scheduledDay) => (
                  <div key={scheduledDay.dayName} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="font-medium text-gray-900">{scheduledDay.dayNameFull}</div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime12Hour(scheduledDay.shift.start)} - {formatTime12Hour(scheduledDay.shift.end)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Lending Assignments Section */}
      {lendings.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Lending Assignments</h2>
            <span className="px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded-full">{lendings.length}</span>
          </div>
          <div className="divide-y divide-gray-200">
            {lendings.slice(0, 5).map((lending) => {
              const isBorrowing = lending.toStylistId === currentUser?.uid;
              
              return (
                <div key={lending.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isBorrowing ? 'bg-indigo-100' : 'bg-teal-100'}`}>
                      {isBorrowing 
                        ? <ArrowDownCircle className="w-5 h-5 text-indigo-600" />
                        : <ArrowUpCircle className="w-5 h-5 text-teal-600" />
                      }
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {isBorrowing ? 'Working at Another Branch' : 'Lending Your Shift'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          lending.status === 'approved' ? 'bg-green-100 text-green-700' :
                          lending.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          lending.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {lending.status.charAt(0).toUpperCase() + lending.status.slice(1)}
                        </span>
                      </div>
                      {isBorrowing && lending.toBranchName && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-indigo-600">
                          <MapPin className="w-3 h-3" />
                          <span>{lending.toBranchName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(lending.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      {lending.shiftStart && lending.shiftEnd && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime12Hour(lending.shiftStart)} - {formatTime12Hour(lending.shiftEnd)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      <LeaveRequestModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onSubmit={handleLeaveSubmit}
        isForStaff={false}
        currentUserId={currentUser?.uid}
      />
    </div>
  );
};

export default MySchedule;
