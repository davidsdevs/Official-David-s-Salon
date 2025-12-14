/**
 * Staff Schedule View - Receptionist
 * Read-only view of staff shifts and schedules with print functionality and leave display
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, Printer } from 'lucide-react';
import { getUsersByBranch } from '../../services/userService';
import { getLeaveRequestsByBranch } from '../../services/leaveManagementService';
import { getBranchById } from '../../services/branchService';
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
  const [allScheduleConfigs, setAllScheduleConfigs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [staffLeaveMap, setStaffLeaveMap] = useState({});
  const [branchInfo, setBranchInfo] = useState(null);
  const printRef = useRef();
  
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

  useEffect(() => {
    if (userBranch) {
      fetchBranchInfo();
      fetchAllScheduleConfigs();
      fetchLeaveRequests();
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

  const weekDates = getWeekDates();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Schedule</h1>
          <p className="text-gray-600">View staff shifts and schedules</p>
        </div>
        <button
          onClick={handlePrintSchedule}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Schedule
        </button>
      </div>

      {/* Week Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary-600" />
            <div className="text-center">
              <div className="font-semibold text-gray-900">{formatWeekRange()}</div>
              <button
                onClick={() => setCurrentWeek(() => {
                  const date = new Date();
                  const day = date.getDay();
                  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                  return new Date(date.setDate(diff));
                })}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Today
              </button>
            </div>
          </div>
          
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No staff members found</p>
                  </td>
                </tr>
              ) : (
                staff.map((member) => {
                  const memberName = getFullName(member);
                  const memberId = member.id || member.uid;
                  
                  return (
                     <tr key={memberId} className="hover:bg-gray-50">
                       <td className="px-3 py-2 sticky left-0 bg-white z-10">
                         <div className="font-medium text-sm text-gray-900">{memberName}</div>
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
                  fontWeight: 'bold'
                }}>
                  STAFF
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
              {staff.map((member, idx) => {
                const memberName = getFullName(member);
                const memberId = member.id || member.uid;
                
                return (
                  <tr key={memberId || idx} style={{
                    pageBreakInside: 'avoid'
                  }}>
                    <td style={{
                      border: '1px solid #000',
                      padding: '10px 8px',
                      textAlign: 'left',
                      fontWeight: '600'
                    }}>
                      {memberName}
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
