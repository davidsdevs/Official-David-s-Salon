/**
 * Staff Schedule View - Receptionist
 * Read-only view of staff shifts and schedules
 */

import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { getUsersByBranch } from '../../services/userService';
import { 
  getActiveSchedulesByEmployee,
  getScheduleConfigurationsByBranch
} from '../../services/scheduleService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { getFullName, formatTime12Hour } from '../../utils/helpers';
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
  const { userBranch } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
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
      fetchStaff();
    }
  }, [userBranch, currentWeek]);

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
            
            // Add date-specific shifts for this week
            dateSpecificShifts.forEach((shiftDoc) => {
              if (shiftDoc.employeeId === memberId && shiftDoc.date) {
                const shiftDate = shiftDoc.date instanceof Date 
                  ? shiftDoc.date 
                  : shiftDoc.date.toDate 
                    ? shiftDoc.date.toDate() 
                    : new Date(shiftDoc.date);
                
                // Check if shift is within current week
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                
                if (shiftDate >= weekStart && shiftDate <= weekEnd) {
                  const dayOfWeek = shiftDate.getDay();
                  const dayKey = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1].key;
                  
                  weeklyShifts[dayKey] = {
                    start: shiftDoc.startTime,
                    end: shiftDoc.endTime,
                    isDateSpecific: true,
                    date: shiftDate
                  };
                }
              }
            });
            
            return {
              ...member,
              shifts: weeklyShifts
            };
          } catch (error) {
            console.error(`Error loading schedules for ${memberId}:`, error);
            return { ...member, shifts: {} };
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
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getShiftForDay = (memberShifts, dayKey) => {
    return memberShifts[dayKey] || null;
  };

  const formatWeekRange = () => {
    const start = new Date(currentWeek);
    const end = new Date(currentWeek);
    end.setDate(end.getDate() + 6);
    
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    return `${startStr} - ${endStr}`;
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
                  const memberShifts = member.shifts || {};
                  
                  return (
                     <tr key={member.id || member.uid} className="hover:bg-gray-50">
                       <td className="px-3 py-2 sticky left-0 bg-white z-10">
                         <div className="font-medium text-sm text-gray-900">{memberName}</div>
                       </td>
                       {DAYS_OF_WEEK.map((day) => {
                         const shift = getShiftForDay(memberShifts, day.key);
                         
                         return (
                           <td key={day.key} className="px-1.5 py-2 text-center">
                             {shift ? (
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

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
            <span>Regular Shift</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-medium">(O)</span>
            <span>= Date-specific shift</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistStaffSchedule;

