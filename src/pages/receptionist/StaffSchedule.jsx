/**
 * Staff Schedule View - Receptionist
 * Read-only view of staff shifts and schedules with print functionality and leave display
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, Printer, Filter, Download, Search, Building2, UserCheck, UserX, AlertCircle, BarChart3 } from 'lucide-react';
import { getUsersByBranch } from '../../services/userService';
import { getLendingRequests, getActiveLending, getActiveLendingFromBranch, getActiveLendingForBranch } from '../../services/stylistLendingService';
import { getLeaveRequestsByBranch } from '../../services/leaveManagementService';
import { getBranchById, getBranchOperatingHours } from '../../services/branchService';
import {
  getActiveSchedulesByEmployee,
  getAllScheduleConfigurations
} from '../../services/scheduleService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { getFullName, formatTime12Hour, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
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

const ReceptionistStaffSchedule = () => {
  const { userBranch, currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lendingData, setLendingData] = useState({}); // Staff lent TO other branches
  const [lentOutData, setLentOutData] = useState({}); // Staff lent OUT FROM this branch
  const [lentToBranchStaff, setLentToBranchStaff] = useState([]); // Staff lent TO this branch
  const [allScheduleConfigs, setAllScheduleConfigs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [staffLeaveMap, setStaffLeaveMap] = useState({});
  const [branchInfo, setBranchInfo] = useState(null);
  const [branchHours, setBranchHours] = useState(null);
  const printRef = useRef();

  // Enhanced UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'scheduled', 'on-leave', 'lent-out', 'lent-in'
  const [showFilters, setShowFilters] = useState(false);
  const [staffPage, setStaffPage] = useState(1);
  const [staffItemsPerPage, setStaffItemsPerPage] = useState(25);
  const [printOnlyWithSchedules, setPrintOnlyWithSchedules] = useState(false);
  
  const [currentWeek, setCurrentWeek] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(date.setDate(diff));
  });

  const MANAGEABLE_ROLES = [
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.STYLIST,
    USER_ROLES.INVENTORY_CONTROLLER
  ];

  const getWeekDates = () => {
    const dates = [];
    const start = new Date(currentWeek);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Get week dates for filtering logic
  const weekDates = getWeekDates();

  useEffect(() => {
    if (userBranch) {
      fetchBranchInfo();
      fetchBranchHours();
      fetchAllScheduleConfigs();
      fetchLeaveRequests();
      fetchLendingData();
      fetchStaff();
    }
  }, [userBranch, currentWeek]);

  const fetchBranchInfo = async () => {
    try {
      if (userBranch) {
        const branch = await getBranchById(userBranch);
        setBranchInfo(branch);
      }
    } catch (error) {
      console.error('Error fetching branch info:', error);
    }
  };

  const fetchBranchHours = async () => {
    try {
      if (userBranch) {
        const hours = await getBranchOperatingHours(userBranch);
        setBranchHours(hours);
      }
    } catch (error) {
      console.error('Error fetching branch hours:', error);
    }
  };

  const fetchLendingData = async () => {
    try {
      if (userBranch) {
        // Get staff lent TO other branches (from this branch)
        const lendingToOthers = await getActiveLendingFromBranch(userBranch);
        const lendingMap = {};
        lendingToOthers.forEach(lending => {
          lendingMap[lending.stylistId] = {
            branchName: lending.toBranchName,
            startDate: lending.startDate,
            endDate: lending.endDate,
            status: lending.status
          };
        });
        setLendingData(lendingMap);

        // Get staff lent OUT FROM this branch (to other branches)
        const lentOut = await getActiveLendingForBranch(userBranch);
        const lentOutMap = {};
        lentOut.forEach(lending => {
          lentOutMap[lending.stylistId] = {
            toBranchName: lending.fromBranchName,
            startDate: lending.startDate,
            endDate: lending.endDate,
            status: lending.status
          };
        });
        setLentOutData(lentOutMap);

        // Get staff lent TO this branch (from other branches)
        const lentToBranch = await getActiveLending(userBranch);
        setLentToBranchStaff(lentToBranch || []);
      }
    } catch (error) {
      console.error('Error fetching lending data:', error);
    }
  };

  const fetchAllScheduleConfigs = async () => {
    try {
      if (userBranch) {
        const configs = await getAllScheduleConfigurations(userBranch);
        setAllScheduleConfigs(configs);
      }
    } catch (error) {
      console.error('Error fetching schedule configurations:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      if (userBranch) {
        const leaves = await getLeaveRequestsByBranch(userBranch);
        setLeaveRequests(leaves);

        // Create a map of staff leaves for quick lookup
        const leaveMap = {};
        leaves.forEach(leave => {
          // Only include approved or pending leaves
          if (leave.status === 'approved' || leave.status === 'pending') {
            const employeeId = leave.employeeId;
            if (!leaveMap[employeeId]) {
              leaveMap[employeeId] = [];
            }
            
            // Ensure dates are Date objects - handle Firestore Timestamps
            let startDate, endDate;
            
            if (leave.startDate instanceof Date) {
              startDate = new Date(leave.startDate);
            } else if (leave.startDate && typeof leave.startDate.toDate === 'function') {
              startDate = leave.startDate.toDate();
            } else if (leave.startDate) {
              startDate = new Date(leave.startDate);
            } else {
              return; // Skip this leave if dates are invalid
            }
            
            if (leave.endDate instanceof Date) {
              endDate = new Date(leave.endDate);
            } else if (leave.endDate && typeof leave.endDate.toDate === 'function') {
              endDate = leave.endDate.toDate();
            } else if (leave.endDate) {
              endDate = new Date(leave.endDate);
            } else {
              return; // Skip this leave if dates are invalid
            }
            
            // Normalize dates to start of day
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            
            leaveMap[employeeId].push({
              startDate,
              endDate,
              status: leave.status,
              type: leave.type,
              reason: leave.reason
            });
          }
        });
        
        setStaffLeaveMap(leaveMap);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const branchStaff = await getUsersByBranch(userBranch);
      const manageableStaff = branchStaff.filter(user => {
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.some(role => MANAGEABLE_ROLES.includes(role));
      });
      
      // Get week start date for filtering date-specific shifts
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      
      // Load schedules for each staff member
      const staffWithSchedules = await Promise.all(
        manageableStaff.map(async (member) => {
          const memberId = member.id || member.uid;
          if (!memberId) return member;
          
          try {
            // Get active schedule configuration and date-specific shifts
            const { activeConfig, dateSpecificShifts } = await getActiveSchedulesByEmployee(
              memberId, 
              userBranch, 
              weekStart
            );
            
            // Extract shifts from the active config
            const weeklyShifts = {};
            if (activeConfig && activeConfig.employeeShifts) {
              Object.entries(activeConfig.employeeShifts).forEach(([dayKey, shift]) => {
                if (shift && shift.start && shift.end) {
                  weeklyShifts[dayKey.toLowerCase()] = {
                    start: shift.start,
                    end: shift.end,
                    isDateSpecific: false
                  };
                }
              });
            }
            
            // Build date-specific shifts map
            const dateSpecificShiftsMap = {};
            dateSpecificShifts.forEach((schedule) => {
              if (schedule.date) {
                const dateStr = schedule.date instanceof Date
                  ? schedule.date.toISOString().split('T')[0]
                  : (schedule.date.toDate ? schedule.date.toDate().toISOString().split('T')[0] : new Date(schedule.date).toISOString().split('T')[0]);
                dateSpecificShiftsMap[dateStr] = {
                  start: schedule.startTime,
                  end: schedule.endTime,
                  date: schedule.date instanceof Date ? schedule.date : (schedule.date.toDate ? schedule.date.toDate() : new Date(schedule.date)),
                  isDateSpecific: true,
                  scheduleId: schedule.id
                };
              }
            });
            
            return {
              ...member,
              shifts: weeklyShifts,
              dateSpecificShifts: dateSpecificShiftsMap,
              activeConfigId: activeConfig?.id,
              configStartDate: activeConfig?.startDate
            };
          } catch (error) {
            console.error(`Error loading schedules for ${memberId}:`, error);
            return { ...member, shifts: {}, dateSpecificShifts: {} };
          }
        })
      );
      
      setStaff(staffWithSchedules);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff schedules');
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction) => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  // Helper function to find the schedule configuration that applies to a specific date
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
        const configStartTime = configStartDate.getTime();
        return configStartTime <= targetTime;
      })
      .sort((a, b) => {
        const aTime = new Date(a.startDate).getTime();
        const bTime = new Date(b.startDate).getTime();
        return bTime - aTime; // Most recent first
      });
    
    return applicableConfigs.length > 0 ? applicableConfigs[0] : null;
  };

  const getDayKey = (date) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  const getShiftForDay = (member, dayKey, date) => {
    // First check for date-specific shift (these override recurring shifts)
    if (member.dateSpecificShifts && date) {
      const dateStr = date.toISOString().split('T')[0];
      if (member.dateSpecificShifts[dateStr]) {
        return member.dateSpecificShifts[dateStr];
      }
    }
    
    // Find the schedule configuration that applies to this specific date
    if (date && allScheduleConfigs.length > 0) {
      const configForDate = getScheduleForDate(allScheduleConfigs, date);
      
      if (configForDate && configForDate.shifts) {
        const memberId = member.id || member.uid;
        const possibleIds = [];
        if (member.id) possibleIds.push(member.id);
        if (member.uid && member.uid !== member.id) possibleIds.push(member.uid);
        if (member.userId && !possibleIds.includes(member.userId)) possibleIds.push(member.userId);
        
        const uniqueIds = [...new Set(possibleIds.filter(id => id))];
        
        let employeeShifts = null;
        for (const id of uniqueIds) {
          if (id && configForDate.shifts[id]) {
            employeeShifts = configForDate.shifts[id];
            break;
          }
        }
        
        if (employeeShifts && employeeShifts[dayKey] && employeeShifts[dayKey].start && employeeShifts[dayKey].end) {
          return {
            start: employeeShifts[dayKey].start,
            end: employeeShifts[dayKey].end,
            isRecurring: true,
            isActive: true,
            configId: configForDate.id,
            startDate: configForDate.startDate
          };
        }
      }
    }
    
    // Fall back to member.shifts
    if (member.shifts && member.shifts[dayKey]) {
      const fallbackShift = member.shifts[dayKey];
      if (fallbackShift.isActive === false) {
        return null;
      }
      return fallbackShift;
    }
    
    return null;
  };

  // Helper function to check if a staff member is on leave on a specific date
  const isStaffOnLeave = (memberId, date) => {
    if (!memberId || !date) return false;
    
    const leaves = staffLeaveMap[memberId];
    if (!leaves || leaves.length === 0) {
      return false;
    }
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const checkTime = checkDate.getTime();
    
    const isOnLeave = leaves.some(leave => {
      if (!leave.startDate || !leave.endDate) return false;
      
      const startDate = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
      const endDate = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);
      
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      
      return checkTime >= startTime && checkTime <= endTime;
    });
    
    return isOnLeave;
  };

  // Helper function to get leave info for a specific date
  const getLeaveInfoForDate = (memberId, date) => {
    if (!memberId || !date) return null;
    
    const leaves = staffLeaveMap[memberId];
    if (!leaves || leaves.length === 0) {
      return null;
    }
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const leave = leaves.find(leave => {
      if (!leave.startDate || !leave.endDate) return false;
      
      const startDate = leave.startDate instanceof Date 
        ? new Date(leave.startDate) 
        : (leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate));
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = leave.endDate instanceof Date 
        ? new Date(leave.endDate) 
        : (leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate));
      endDate.setHours(23, 59, 59, 999);
      
      return checkDate >= startDate && checkDate <= endDate;
    });
    
    return leave || null;
  };

  // Filtered and paginated staff
  const filteredStaff = useMemo(() => {
    let filtered = [...staff];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(member =>
        getFullName(member).toLowerCase().includes(searchLower) ||
        (member.email && member.email.toLowerCase().includes(searchLower))
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(member => {
        const userRoles = member.roles || (member.role ? [member.role] : []);
        return userRoles.includes(roleFilter);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => {
        const memberId = member.id || member.uid;

        switch (statusFilter) {
          case 'scheduled':
            // Has at least one shift this week
            return weekDates.some(date => {
              const dayKey = getDayKey(date);
              const shift = getShiftForDay(member, dayKey, date);
              return shift && !isStaffOnLeave(memberId, date);
            });

          case 'on-leave':
            // On leave for at least one day this week
            return weekDates.some(date => isStaffOnLeave(memberId, date));

          case 'lent-out':
            // Lent out to another branch
            return lendingData[memberId];

          case 'lent-in':
            // Lent in from another branch (check if in lentToBranchStaff)
            return lentToBranchStaff && lentToBranchStaff.some(lent => lent.stylistId === memberId);

          default:
            return true;
        }
      });
    }

    return filtered;
  }, [staff, searchTerm, roleFilter, statusFilter, weekDates, lendingData, lentToBranchStaff]);

  // Paginated staff
  const paginatedStaff = useMemo(() => {
    const startIndex = (staffPage - 1) * staffItemsPerPage;
    const endIndex = startIndex + staffItemsPerPage;
    return filteredStaff.slice(startIndex, endIndex);
  }, [filteredStaff, staffPage, staffItemsPerPage]);

  // Total pages
  const totalStaffPages = Math.ceil(filteredStaff.length / staffItemsPerPage);

  // Check if current week is the current week
  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    currentWeekStart.setHours(0, 0, 0, 0);

    const displayedWeekStart = new Date(currentWeek);
    displayedWeekStart.setHours(0, 0, 0, 0);

    return currentWeekStart.getTime() === displayedWeekStart.getTime();
  }, [currentWeek]);

  const formatWeekRange = () => {
    const start = new Date(currentWeek);
    const end = new Date(currentWeek);
    end.setDate(end.getDate() + 6);

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `${startStr} - ${endStr}`;
  };

  // Print handler
  const handlePrintSchedule = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }

    setTimeout(() => {
      if (!printRef.current) {
        toast.error('Print content not ready. Please try again.');
        return;
      }

      const printContentHTML = printRef.current.innerHTML;
      
      let styles = '';
      try {
        styles = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              return Array.from(sheet.cssRules || [])
                .map((rule) => rule.cssText)
                .join('\n');
            } catch (e) {
              return '';
            }
          })
          .join('\n');
      } catch (e) {
        console.warn('Could not extract all styles:', e);
      }

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the schedule');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Weekly Schedule - ${weekDates[0]?.toISOString().split('T')[0] || 'Schedule'}</title>
          <meta charset="utf-8">
          <style>
            ${styles}
            @media print {
              @page {
                size: letter landscape;
                margin: 0.75in;
              }
              * {
                color: #000 !important;
                background: transparent !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
              color: #000;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid #000;
              padding: 10px 8px;
            }
            th {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          ${printContentHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  setTimeout(function() {
                    window.close();
                  }, 100);
                };
                setTimeout(function() {
                  window.close();
                }, 30000);
              }, 250);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }, 100);
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Staff Schedule</h1>
          <p className="text-gray-600 mt-1">Weekly view of staff shifts and availability</p>
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 whitespace-nowrap">
            <input
              type="checkbox"
              checked={printOnlyWithSchedules}
              onChange={(e) => setPrintOnlyWithSchedules(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            Print only staff with schedules
          </label>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
              <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                {(searchTerm ? 1 : 0) + (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
          <button
            onClick={handlePrintSchedule}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print Schedule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{staff.length}</p>
            </div>
            <Users className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Staff with Shifts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {staff.filter(member =>
                  weekDates.some(date => {
                    const dayKey = getDayKey(date);
                    const shift = getShiftForDay(member, dayKey, date);
                    return shift && !isStaffOnLeave(member.id || member.uid, date);
                  })
                ).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active This Week</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {staff.filter(s => {
                  if (!s.shifts) return false;
                  return weekDates.some(date => {
                    const dayKey = getDayKey(date);
                    return getShiftForDay(s, dayKey, date);
                  });
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Staff
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value={USER_ROLES.STYLIST}>Stylist</option>
                <option value={USER_ROLES.RECEPTIONIST}>Receptionist</option>
                <option value={USER_ROLES.INVENTORY_CONTROLLER}>Inventory Controller</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="on-leave">On Leave</option>
                <option value="lent-out">Lent Out</option>
                <option value="lent-in">Lent In</option>
              </select>
            </div>

            {/* Items per page */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Items per page
              </label>
              <select
                value={staffItemsPerPage}
                onChange={(e) => {
                  setStaffItemsPerPage(Number(e.target.value));
                  setStaffPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Showing {paginatedStaff.length} of {filteredStaff.length} staff members
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={printOnlyWithSchedules}
                  onChange={(e) => setPrintOnlyWithSchedules(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Print only staff with schedules
              </label>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('all');
                setStatusFilter('all');
                setStaffPage(1);
              }}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentWeek(() => {
                const date = new Date();
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(date.setDate(diff));
              })}
              className={`px-4 py-2 rounded-lg border transition-colors text-sm ${
                isCurrentWeek
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Today
            </button>
            <div className="min-w-[200px] text-center font-semibold text-gray-900">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <button
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Next Week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="text-sm text-gray-700">
            Showing {Math.min((staffPage - 1) * staffItemsPerPage + 1, filteredStaff.length)} to{' '}
            {Math.min(staffPage * staffItemsPerPage, filteredStaff.length)} of {filteredStaff.length} staff
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              Items per page:
              <select
                value={staffItemsPerPage}
                onChange={(e) => {
                  setStaffItemsPerPage(Number(e.target.value));
                  setStaffPage(1);
                }}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              >
                {[10, 25, 50, 100].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStaffPage(Math.max(1, staffPage - 1))}
                disabled={staffPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalStaffPages) }, (_, i) => {
                  let pageNum;
                  if (totalStaffPages <= 5) {
                    pageNum = i + 1;
                  } else if (staffPage <= 3) {
                    pageNum = i + 1;
                  } else if (staffPage >= totalStaffPages - 2) {
                    pageNum = totalStaffPages - 4 + i;
                  } else {
                    pageNum = staffPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setStaffPage(pageNum)}
                      className={`px-3 py-1 border rounded-lg text-sm ${
                        staffPage === pageNum
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStaffPage(Math.min(totalStaffPages, staffPage + 1))}
                disabled={staffPage === totalStaffPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50 border-b">
              <tr>
                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[150px]">
                   <div className="flex items-center gap-2">
                     <Users className="w-3.5 h-3.5" />
                     Staff Member
                   </div>
                 </th>
                 {DAYS_OF_WEEK.map((day, index) => (
                   <th key={day.key} className="px-1.5 py-2 text-center text-xs font-medium text-gray-500 uppercase w-[11%]">
                     <div>
                       <div className="font-semibold">{day.short}</div>
                       <div className="text-[10px] text-gray-400 mt-0.5">
                         {weekDates[index].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                       </div>
                     </div>
                   </th>
                 ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No staff members found</p>
                    {filteredStaff.length > 0 && (
                      <p className="text-sm text-gray-400 mt-1">
                        Try adjusting your filters
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((member) => {
                  const memberName = getFullName(member);
                  const memberId = member.id || member.uid;
                  
                  return (
                     <tr key={memberId} className="hover:bg-gray-50">
                       <td className="px-3 py-2 sticky left-0 bg-white z-10 min-w-[200px]">
                         <div className="font-medium text-sm text-gray-900">{memberName}</div>
                         <div className="flex flex-wrap gap-1 mt-1">
                           {/* Role badges */}
                           {(member.roles || [member.role]).filter(Boolean).map(role => (
                             <span key={role} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                               {role === USER_ROLES.STYLIST ? 'Stylist' :
                                role === USER_ROLES.RECEPTIONIST ? 'Receptionist' :
                                role === USER_ROLES.INVENTORY_CONTROLLER ? 'Inventory' : role}
                             </span>
                           ))}

                           {/* Lending status */}
                           {lendingData[memberId] && (
                             <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                               <UserCheck className="w-2.5 h-2.5 mr-1" />
                               Lent to {lendingData[memberId].branchName}
                             </span>
                           )}

                           {lentToBranchStaff && lentToBranchStaff.some(lent => lent.stylistId === memberId) && (
                             <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                               <Building2 className="w-2.5 h-2.5 mr-1" />
                               From {lentToBranchStaff.find(lent => lent.stylistId === memberId)?.fromBranchName}
                             </span>
                           )}
                         </div>
                       </td>
                       {DAYS_OF_WEEK.map((day, index) => {
                         const date = weekDates[index];
                         const shift = getShiftForDay(member, day.key, date);
                         const onLeave = isStaffOnLeave(memberId, date);
                         const leaveInfo = onLeave ? getLeaveInfoForDate(memberId, date) : null;
                         
                         return (
                           <td key={day.key} className="px-1.5 py-2 text-center">
                             {onLeave && leaveInfo ? (
                               <div className="inline-flex flex-col items-center gap-0.5 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded text-xs">
                                 <span className="font-medium text-red-900">ON LEAVE</span>
                                 <span className="text-[10px] text-red-700">
                                   {leaveInfo.type ? leaveInfo.type.charAt(0).toUpperCase() + leaveInfo.type.slice(1) : 'Leave'}
                                 </span>
                               </div>
                             ) : shift ? (
                               <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs">
                                 <Clock className="w-2.5 h-2.5 text-blue-700 flex-shrink-0" />
                                 <span className="font-medium text-blue-900 whitespace-nowrap">
                                   {formatTime12Hour(shift.start).replace(' ', '')}-{formatTime12Hour(shift.end).replace(' ', '')}
                                 </span>
                                 {shift.isDateSpecific && (
                                   <span className="text-[10px] text-blue-600 whitespace-nowrap ml-0.5">(O)</span>
                                 )}
                               </div>
                             ) : (
                               <span className="text-gray-300 text-xs">—</span>
                             )}
                           </td>
                         );
                       })}
                     </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Print Component */}
      <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <style>{`
          @media print {
            @page {
              size: letter landscape;
              margin: 0.75in;
            }
            * {
              color: #000 !important;
              background: transparent !important;
            }
          }
        `}</style>
        <div className="print-content" style={{ 
          fontFamily: 'Arial, sans-serif',
          color: '#000',
          background: '#fff',
          padding: '20px'
        }}>
          {/* Header */}
          <div style={{ 
            textAlign: 'center',
            marginBottom: '30px',
            borderBottom: '2px solid #000',
            paddingBottom: '15px'
          }}>
            <h1 style={{ 
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '10px',
              letterSpacing: '1px'
            }}>
              WEEKLY SCHEDULE
            </h1>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
              {branchInfo?.branchName || branchInfo?.name || 'Branch'}
            </div>
            <div style={{ 
              fontSize: '11px',
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <div style={{ textAlign: 'left' }}>
                <div>Week: {weekDates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div>Printed by: {currentUser ? getFullName(currentUser) : 'Receptionist'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Printed: {new Date().toLocaleString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</div>
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #000',
            fontSize: '11px'
          }}>
            <thead>
              <tr>
                <th style={{
                  border: '1px solid #000',
                  padding: '10px 8px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  minWidth: '200px'
                }}>
                  STAFF MEMBER
                </th>
                {weekDates.map((date, index) => {
                  const dayName = DAYS_OF_WEEK[index]?.label || '';
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <th key={index} style={{
                      border: '1px solid #000',
                      padding: '10px 8px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      {dayName.toUpperCase()}<br />
                      <span style={{ fontSize: '9px', fontWeight: 'normal' }}>{dateStr}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(printOnlyWithSchedules
                ? filteredStaff.filter(member =>
                    weekDates.some(date => {
                      const dayKey = getDayKey(date);
                      const shift = getShiftForDay(member, dayKey, date);
                      return shift && !isStaffOnLeave(member.id || member.uid, date);
                    })
                  )
                : filteredStaff
              ).map((member, idx) => {
                const memberName = getFullName(member);
                const memberId = member.id || member.uid;
                
                return (
                  <tr key={memberId || idx} style={{
                    pageBreakInside: 'avoid'
                  }}>
                    <td style={{
                      border: '1px solid #000',
                      padding: '10px 8px',
                      textAlign: 'left'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{memberName}</div>
                      <div style={{ fontSize: '9px', color: '#666' }}>
                        {/* Roles */}
                        {(member.roles || [member.role]).filter(Boolean).map(role =>
                          role === USER_ROLES.STYLIST ? 'Stylist' :
                          role === USER_ROLES.RECEPTIONIST ? 'Receptionist' :
                          role === USER_ROLES.INVENTORY_CONTROLLER ? 'Inventory' : role
                        ).join(', ')}
                        {/* Lending status */}
                        {lendingData[memberId] && ` • Lent to ${lendingData[memberId].branchName}`}
                        {lentToBranchStaff && lentToBranchStaff.some(lent => lent.stylistId === memberId) &&
                          ` • From ${lentToBranchStaff.find(lent => lent.stylistId === memberId)?.fromBranchName}`}
                      </div>
                    </td>
                    {weekDates.map((date, dateIdx) => {
                      const dayKey = DAYS_OF_WEEK[dateIdx]?.key || '';
                      const shift = getShiftForDay(member, dayKey, date);
                      
                      let cellContent = '-';
                      let cellStyle = {
                        border: '1px solid #000',
                        padding: '10px 8px',
                        textAlign: 'center'
                      };

                      // Check for leave
                      if (staffLeaveMap && isStaffOnLeave(memberId, date)) {
                        const leaveInfo = getLeaveInfoForDate(memberId, date);
                        const leaveTypeLabels = {
                          vacation: 'Vacation',
                          sick: 'Sick',
                          personal: 'Personal',
                          emergency: 'Emergency',
                          maternity: 'Maternity',
                          paternity: 'Paternity',
                          bereavement: 'Bereavement'
                        };
                        const leaveType = leaveInfo?.type ? leaveTypeLabels[leaveInfo.type] || leaveInfo.type : '';
                        cellContent = leaveType ? `ON LEAVE\n${leaveType}` : 'ON LEAVE';
                        cellStyle = { ...cellStyle, fontStyle: 'italic', whiteSpace: 'pre-line' };
                      } 
                      // Check if shift exists
                      else if (shift && shift.start && shift.end) {
                        cellContent = `${formatTime12Hour(shift.start)} - ${formatTime12Hour(shift.end)}`;
                        cellStyle = { ...cellStyle, fontWeight: '600' };
                      }

                      return (
                        <td key={dateIdx} style={cellStyle}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistStaffSchedule;
