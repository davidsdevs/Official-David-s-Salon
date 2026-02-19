/**
 * Staff Schedule Page - Branch Manager
 * Weekly view of staff shifts
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, ArrowRight, Edit, Plus, X, History, Printer, Search, Filter, Download } from 'lucide-react';
import PDFPreviewModal from '../../components/ui/PDFPreviewModal';
import { getUsersByBranch, getUserById } from '../../services/userService';
import { getLendingRequests, getActiveLending, getActiveLendingFromBranch, getActiveLendingForBranch } from '../../services/stylistLendingService';
import { getLeaveRequestsByBranch } from '../../services/leaveManagementService';
import { getBranchById } from '../../services/branchService';
import {
  getActiveSchedulesByEmployee,
  getAllScheduleConfigurations,
  createOrUpdateScheduleWithHistory,
  createOrUpdateScheduleConfiguration,
  getScheduleConfigurationsByBranch,
  deactivateSchedule,
  convertDayKeyToDayOfWeek,
  getScheduleHistoryByEmployee
} from '../../services/scheduleService';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { getFullName, getInitials, formatTime12Hour, formatDate, formatDateLocal } from '../../utils/helpers';
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

const StaffSchedule = ({ onEditTrigger }) => {
  const { userBranch, currentUser } = useAuth();
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lendingData, setLendingData] = useState({}); // { stylistId: { branchName, startDate, endDate } } - staff lent TO other branches
  const [lentOutData, setLentOutData] = useState({}); // { stylistId: { toBranchName, startDate, endDate } } - staff lent OUT FROM this branch
  const [lentToBranchStaff, setLentToBranchStaff] = useState([]); // Staff lent TO this branch (from other branches)
  const [allScheduleConfigs, setAllScheduleConfigs] = useState([]); // All schedule configurations for date-based lookup
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [shiftForm, setShiftForm] = useState({ start: '', end: '', date: '', type: 'regular' });
  const [selectedStaffIds, setSelectedStaffIds] = useState([]); // Array of selected staff IDs
  const [selectedDays, setSelectedDays] = useState([]); // Array of selected day keys (legacy, not used anymore)
  const [staffTimes, setStaffTimes] = useState({}); // { staffId: { start: '', end: '' } }
  const [staffDays, setStaffDays] = useState({}); // { staffId: [dayKey1, dayKey2, ...] }
  const [saving, setSaving] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showBulkConfigModal, setShowBulkConfigModal] = useState(false);
  const [bulkShifts, setBulkShifts] = useState({}); // { employeeId: { monday: {start, end}, ... } }
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [showEditShiftModal, setShowEditShiftModal] = useState(false); // Simple modal for editing/adding single shift
  const [isEditMode, setIsEditMode] = useState(false); // Calendar edit mode
  const [editableShifts, setEditableShifts] = useState({}); // { staffId: { dayKey: {start, end}, ... } }
  const [configStartDate, setConfigStartDate] = useState(''); // Start date for the configuration
  const [isAddingShift, setIsAddingShift] = useState(false); // Track if we're adding (true) or editing (false) in modal
  const [branchHours, setBranchHours] = useState(null); // Branch operating hours
  const [leaveRequests, setLeaveRequests] = useState([]); // All leave requests for the branch
  const [staffLeaveMap, setStaffLeaveMap] = useState({}); // { staffId: [{ startDate, endDate, status, type }] }
  const [showQuickBulkModal, setShowQuickBulkModal] = useState(false); // Quick bulk shift modal per employee
  const [quickBulkEmployee, setQuickBulkEmployee] = useState(null); // Employee for quick bulk shifts
  const [quickBulkForm, setQuickBulkForm] = useState({ start: '', end: '', days: [] }); // Quick bulk form data
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterModalSchedule, setShowFilterModalSchedule] = useState(false);
  const [showPDFPreviewSchedule, setShowPDFPreviewSchedule] = useState(false);
  const [filters, setFilters] = useState({
    roles: [], // Array of selected roles
    shiftStatus: 'all', // 'all', 'withShifts', 'withoutShifts'
    availabilityStatus: 'all', // 'all', 'available', 'onLeave', 'lentOut', 'lentIn'
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date;
  });
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false);
  const [selectedDayDetails, setSelectedDayDetails] = useState({ date: null, staff: [] });
  const [currentWeek, setCurrentWeek] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(date.setDate(diff));
  });

  // Print ref
  const printRef = useRef();

  // Branch info for print
  const [branchInfo, setBranchInfo] = useState(null);
  const [printOnlyWithSchedules, setPrintOnlyWithSchedules] = useState(false);
  const [staffPage, setStaffPage] = useState(1);
  const [staffItemsPerPage, setStaffItemsPerPage] = useState(25);

  const MANAGEABLE_ROLES = [
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.STYLIST,
    USER_ROLES.INVENTORY_CONTROLLER
  ];

  useEffect(() => {
    if (userBranch) {
      fetchBranchHours();
      fetchAllScheduleConfigs();
      fetchLeaveRequests();
      fetchStaff();
    }
  }, [userBranch, currentWeek]); // Reload when week changes

  // Export schedules to CSV
  const exportSchedulesToCSV = () => {
    if (!staff || staff.length === 0) {
      toast.error('No schedule data to export');
      return;
    }

    const exportData = staff.map(member => {
      const roles = member.roles || (member.role ? [member.role] : []);
      const shifts = member.shifts || {};
      const shiftDays = Object.keys(shifts).map(day => {
        const shift = shifts[day];
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${shift.start || ''}-${shift.end || ''}`;
      }).join('; ');

      return {
        'Employee ID': member.id || member.uid || '',
        'Full Name': getFullName(member),
        'Email': member.email || '',
        'Phone': member.phone || '',
        'Roles': roles.join('; '),
        'Shifts': shiftDays || 'No shifts',
      };
    });

    const csvHeaders = Object.keys(exportData[0] || {});
    const csvRows = [
      csvHeaders.join(','),
      ...exportData.map(row => csvHeaders.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `Staff_Schedules_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    if (userBranch && staff.length > 0) {
      fetchLendingData();
    }
  }, [currentWeek, userBranch, staff]);

  // Set default bulk start date to current week when modal opens
  useEffect(() => {
    if (showBulkConfigModal && !bulkStartDate) {
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      setBulkStartDate(formatDateLocal(weekStart));
    }
  }, [showBulkConfigModal, currentWeek, bulkStartDate]);

  // Handle external edit trigger from parent component
  useEffect(() => {
    if (onEditTrigger) {
      // Enter edit mode - initialize editable shifts with current shifts
      const initialEditableShifts = {};
      staff.forEach(member => {
        const memberId = member.id || member.uid;
        if (memberId) {
          initialEditableShifts[memberId] = {};
          DAYS_OF_WEEK.forEach(day => {
            const existingShift = member.shifts?.[day.key];
            if (existingShift) {
              initialEditableShifts[memberId][day.key] = {
                start: existingShift.start || '',
                end: existingShift.end || '',
                type: existingShift.type || 'regular'
              };
            }
          });
        }
      });
      setEditableShifts(initialEditableShifts);

      // Set start date to the current week being viewed
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      setConfigStartDate(formatDateLocal(weekStart));

      setIsEditMode(true);
    }
  }, [onEditTrigger, staff, currentWeek]);

  const fetchBranchHours = async () => {
    try {
      if (userBranch) {
        const branch = await getBranchById(userBranch);
        setBranchHours(branch?.operatingHours || null);
        setBranchInfo(branch); // Store branch info for printing
      }
    } catch (error) {
      console.error('Error fetching branch hours:', error);
      toast.error('Failed to load branch operating hours');
    }
  };

  const fetchAllScheduleConfigs = async () => {
    try {
      if (userBranch) {
        const configs = await getAllScheduleConfigurations(userBranch);
        setAllScheduleConfigs(configs);
      }
    } catch (error) {
      console.error('[fetchAllScheduleConfigs] Error fetching schedule configurations:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      if (userBranch) {
        const leaves = await getLeaveRequestsByBranch(userBranch);
        setLeaveRequests(leaves);

        // Fetched leave requests

        // Create a map of staff leaves for quick lookup
        const leaveMap = {};
        leaves.forEach(leave => {
          // Only include approved leaves (pending leaves don't affect schedules until approved)
          if (leave.status === 'approved') {
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
              console.warn('Invalid startDate for leave:', leave);
              return; // Skip this leave if dates are invalid
            }

            if (leave.endDate instanceof Date) {
              endDate = new Date(leave.endDate);
            } else if (leave.endDate && typeof leave.endDate.toDate === 'function') {
              endDate = leave.endDate.toDate();
            } else if (leave.endDate) {
              endDate = new Date(leave.endDate);
            } else {
              console.warn('Invalid endDate for leave:', leave);
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

            // Added leave to map
          }
        });

        // Staff leave map created
        setStaffLeaveMap(leaveMap);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      // Try fetching without orderBy if the index doesn't exist
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../config/firebase');
        const q = query(
          collection(db, 'leave_requests'),
          where('branchId', '==', userBranch)
        );
        const snapshot = await getDocs(q);
        const leaves = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate(),
          endDate: doc.data().endDate?.toDate(),
          requestedAt: doc.data().requestedAt?.toDate(),
        }));

        setLeaveRequests(leaves);

        // Create leave map
        const leaveMap = {};
        leaves.forEach(leave => {
          // Only include approved leaves (pending leaves don't affect schedules until approved)
          if (leave.status === 'approved') {
            const employeeId = leave.employeeId;
            if (!leaveMap[employeeId]) {
              leaveMap[employeeId] = [];
            }

            const startDate = leave.startDate instanceof Date
              ? leave.startDate
              : (leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate));
            const endDate = leave.endDate instanceof Date
              ? leave.endDate
              : (leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate));

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
      } catch (fallbackError) {
        console.error('Error in fallback leave fetch:', fallbackError);
      }
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


      // Load schedules for each staff member and merge with staff data
      const staffWithSchedules = await Promise.all(
        manageableStaff.map(async (member) => {
          const memberId = member.id || member.uid;
          if (!memberId) {
            // Member has no ID or UID, skipping schedule lookup
            return member;
          }

          try {
            // Get active schedule configuration, inactive configs, and date-specific shifts
            // Try both member.id and member.uid in case they're stored differently
            const { activeConfig, inactiveConfigs, dateSpecificShifts: dateSpecificShiftsList } = await getActiveSchedulesByEmployee(memberId, userBranch, weekStart);


            // Note: We no longer pre-populate member.shifts here
            // The getShiftForDay function will find the correct schedule for each date
            // based on startDate. This prevents showing "Inactive" for future dates.
            const shifts = {};

            // Only add shifts from the config that applies to the current week start
            // This is just for backward compatibility/fallback
            if (activeConfig && activeConfig.employeeShifts) {
              Object.entries(activeConfig.employeeShifts).forEach(([dayKey, shift]) => {
                if (shift && shift.start && shift.end) {
                  // Normalize dayKey to lowercase to match getDayKey format
                  const normalizedDayKey = dayKey.toLowerCase();
                  shifts[normalizedDayKey] = {
                    start: shift.start,
                    end: shift.end,
                    isRecurring: true,
                    isActive: true,
                    configId: activeConfig.id,
                    startDate: activeConfig.startDate
                  };
                }
              });
            }


            // Convert date-specific shifts to dateSpecificShifts format
            const dateSpecificShifts = {}; // Store by date string for easy lookup
            dateSpecificShiftsList.forEach(schedule => {
              const dateStr = formatDateLocal(schedule.date);
              dateSpecificShifts[dateStr] = {
                start: schedule.startTime,
                end: schedule.endTime,
                date: schedule.date,
                isDateSpecific: true,
                scheduleId: schedule.id,
                type: schedule.type // Add this
              };
            });

            return {
              ...member,
              shifts,
              dateSpecificShifts,
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

      // Fetch staff lent TO this branch and add them to the staff list
      await fetchLentToBranchStaff();
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const fetchLentToBranchStaff = async () => {
    if (!userBranch) return;

    try {
      // Get all staff currently lent TO this branch (from other branches)
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsTo = await getActiveLendingForBranch(userBranch, null);

      // Fetch the actual staff data for lent staff
      const lentStaffData = await Promise.all(
        activeLendingsTo.map(async (lending) => {
          try {
            const staffMember = await getUserById(lending.stylistId);
            const fromBranch = await getBranchById(lending.fromBranchId);

            // Get week start date for filtering date-specific shifts
            const weekStart = new Date(currentWeek);
            weekStart.setHours(0, 0, 0, 0);

            // Load schedules for the lent staff member from their original branch
            const memberId = staffMember.id || staffMember.uid;
            let shifts = {};
            let dateSpecificShifts = {};

            if (memberId) {
              try {
                const { activeConfig, inactiveConfigs, dateSpecificShifts: dateSpecificShiftsList } =
                  await getActiveSchedulesByEmployee(memberId, lending.fromBranchId, weekStart);

                // Build shifts object from active config
                if (activeConfig && activeConfig.shifts && activeConfig.shifts[memberId]) {
                  shifts = activeConfig.shifts[memberId];
                }

                // Build date-specific shifts map
                if (dateSpecificShiftsList && dateSpecificShiftsList.length > 0) {
                  dateSpecificShiftsList.forEach(schedule => {
                    if (schedule.date) {
                      const dateStr = formatDateLocal(schedule.date);
                      dateSpecificShifts[dateStr] = {
                        start: schedule.startTime,
                        end: schedule.endTime,
                        date: schedule.date,
                        isDateSpecific: true,
                        scheduleId: schedule.id,
                        type: schedule.type // Add type for on-call shifts
                      };
                    }
                  });
                }
              } catch (error) {
                console.error(`Error loading schedules for lent staff ${memberId}:`, error);
              }
            }

            return {
              ...staffMember,
              isLent: true,
              lentFromBranch: fromBranch?.branchName || fromBranch?.name || 'Unknown Branch',
              lentFromBranchId: lending.fromBranchId,
              lendingStartDate: lending.startDate,
              lendingEndDate: lending.endDate,
              shifts,
              dateSpecificShifts
            };
          } catch (error) {
            console.error('Error fetching lent staff:', error);
            return null;
          }
        })
      );

      const validLentStaff = lentStaffData.filter(s => s !== null);
      setLentToBranchStaff(validLentStaff);

      // Add lent staff to the main staff list for display
      setStaff(prevStaff => {
        // Remove any previously added lent staff to avoid duplicates
        const regularStaff = prevStaff.filter(s => !s.isLent);
        return [...regularStaff, ...validLentStaff];
      });
    } catch (error) {
      console.error('Error fetching staff lent to branch:', error);
    }
  };

  const fetchLendingData = async () => {
    if (!staff.length || !userBranch) return;

    try {
      const dates = getWeekDates();
      const lendingMap = {}; // Staff lent TO other branches (for display)
      const lentOutMap = {}; // Staff lent OUT FROM this branch (for validation)

      // Fetch all active lending where staff FROM this branch are lent out
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsFromBranch = await getActiveLendingFromBranch(userBranch, null);

      // Check each staff member for active lending during the week (staff lent TO other branches)
      for (const member of staff) {
        const memberId = member.id || member.uid;
        if (!memberId) continue;

        // Check today's date for active lending
        const today = new Date();
        const activeLending = await getActiveLending(memberId, today);
        if (activeLending) {
          // Get branch name
          const toBranch = await getBranchById(activeLending.toBranchId);
          lendingMap[memberId] = {
            branchName: toBranch?.branchName || toBranch?.name || 'Unknown Branch',
            startDate: activeLending.startDate,
            endDate: activeLending.endDate
          };
        }
      }

      // Wait for all branch name fetches to complete
      await Promise.all(
        activeLendingsFromBranch.map(lending =>
          lending.stylistId ? getBranchById(lending.toBranchId).then(toBranch => {
            lentOutMap[lending.stylistId] = {
              toBranchName: toBranch?.branchName || toBranch?.name || 'Unknown Branch',
              startDate: lending.startDate,
              endDate: lending.endDate,
              lendingId: lending.id
            };
          }).catch(() => {
            lentOutMap[lending.stylistId] = {
              toBranchName: 'Unknown Branch',
              startDate: lending.startDate,
              endDate: lending.endDate,
              lendingId: lending.id
            };
          }) : Promise.resolve()
        )
      );

      // Fetched lending data

      setLendingData(lendingMap);
      setLentOutData(lentOutMap);
    } catch (error) {
      console.error('Error fetching lending data:', error);
    }
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

  const getMonthDates = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDay.getDay();
    const startDate = new Date(firstDay);
    // Adjust to Monday (if firstDayOfWeek is 0 (Sunday), go back 6 days, otherwise go back firstDayOfWeek - 1 days)
    startDate.setDate(firstDay.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));

    const dates = [];
    const current = new Date(startDate);

    // Generate 6 weeks (42 days) to cover all possible month layouts
    for (let i = 0; i < 42; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const getDayKey = (date) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Helper function to find the schedule configuration that applies to a specific date
  const getScheduleForDate = (configs, targetDate) => {
    if (!targetDate || !configs || configs.length === 0) return null;

    // Normalize target date to start of day for comparison
    const targetDateObj = new Date(targetDate);
    targetDateObj.setHours(0, 0, 0, 0);
    const targetTime = targetDateObj.getTime();

    // Filter configs that have startDate <= targetDate, then find the most recent one
    // Note: We include both active and inactive configs - the isActive flag doesn't matter for date-based lookup
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

  const getShiftForDay = (member, dayKey, date) => {
    // Check if staff member is lent out on this date
    const memberId = member.id || member.uid;
    if (memberId && lendingData[memberId] && date) {
      const lending = lendingData[memberId];
      const dateStr = formatDateLocal(date);
      const lendingStart = lending.startDate ? formatDateLocal(lending.startDate) : null;
      const lendingEnd = lending.endDate ? formatDateLocal(lending.endDate) : null;

      if (lendingStart && lendingEnd && dateStr >= lendingStart && dateStr <= lendingEnd) {
        return {
          isLending: true,
          lendingBranch: lending.branchName
        };
      }
    }

    // First check for date-specific shift (these override recurring shifts)
    if (member.dateSpecificShifts && date) {
      const dateStr = formatDateLocal(date);
      if (member.dateSpecificShifts[dateStr]) {
        return {
          ...member.dateSpecificShifts[dateStr],
          type: member.dateSpecificShifts[dateStr].type || 'oncall' // Date-specific shifts default to oncall
        };
      }
    }

    // Find the schedule configuration that applies to this specific date
    // This is the primary method - it finds the config with the most recent startDate <= date
    // Note: We check ALL configs (both active and inactive) - the isActive flag doesn't matter for date-based lookup
    if (date && allScheduleConfigs.length > 0) {
      const configForDate = getScheduleForDate(allScheduleConfigs, date);

      // Config found for date-based lookup

      if (configForDate && configForDate.shifts) {
        // Collect ALL possible ID variations for this staff member
        const possibleIds = [];
        if (member.id) possibleIds.push(member.id);
        if (member.uid && member.uid !== member.id) possibleIds.push(member.uid);
        // Also check if there's a user document ID stored differently
        if (member.userId && !possibleIds.includes(member.userId)) possibleIds.push(member.userId);

        // Remove duplicates and empty values
        const uniqueIds = [...new Set(possibleIds.filter(id => id))];
        const memberId = uniqueIds[0] || member.id || member.uid;

        // Looking for shifts for member

        // Try to find shifts using any of the possible IDs
        let employeeShifts = null;
        let matchedId = null;

        for (const id of uniqueIds) {
          if (id && configForDate.shifts[id]) {
            employeeShifts = configForDate.shifts[id];
            matchedId = id;
            // Found direct ID match
            break;
          }
        }

        // If no direct match, try partial matching (check if IDs contain each other)
        if (!employeeShifts) {
          const availableIds = Object.keys(configForDate.shifts);
          // No direct match found, trying partial matching

          for (const id of uniqueIds) {
            if (!id) continue;

            // Try exact reverse match
            const reverseMatch = availableIds.find(availId =>
              availId === id ||
              availId === String(id) ||
              String(availId) === id
            );
            if (reverseMatch) {
              employeeShifts = configForDate.shifts[reverseMatch];
              matchedId = reverseMatch;
              // Found exact reverse match
              break;
            }

            // Try substring matching (if one contains the other)
            const substringMatch = availableIds.find(availId =>
              (typeof availId === 'string' && typeof id === 'string') &&
              (availId.includes(id) || id.includes(availId))
            );
            if (substringMatch) {
              employeeShifts = configForDate.shifts[substringMatch];
              matchedId = substringMatch;
              // Found substring match
              break;
            }
          }
        }

        if (employeeShifts && employeeShifts[dayKey] && employeeShifts[dayKey].start && employeeShifts[dayKey].end) {
          // Always mark as active when found via date-based lookup
          // The isActive flag on the config is just for marking "current" config, not for historical/future dates
          // Shift found

          return {
            start: employeeShifts[dayKey].start,
            end: employeeShifts[dayKey].end,
            isRecurring: true,
            isActive: true, // Always true when found via date-based lookup
            configId: configForDate.id,
            startDate: configForDate.startDate,
            type: employeeShifts[dayKey].type || 'regular'
          };
        }
      }
    }

    // Fall back to member.shifts (for backward compatibility or if configs not loaded yet)
    // But only if it doesn't have isActive: false (which would be from old inactive configs)
    if (member.shifts && member.shifts[dayKey]) {
      const fallbackShift = member.shifts[dayKey];
      // If the fallback shift is marked inactive, don't use it - return null instead
      // This prevents showing "Inactive" for future dates
      if (fallbackShift.isActive === false) {
        return null;
      }
      return fallbackShift;
    }

    return null;
  };

  // Helper function to check if a staff member is lent out on a specific date
  const isStaffLentOut = (memberId, date) => {
    if (!memberId || !date) return false;

    // Check if staff member has any lending data
    if (!lentOutData[memberId]) {
      return false;
    }

    const lending = lentOutData[memberId];
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Handle both Date objects and timestamps
    const startDate = lending.startDate instanceof Date
      ? new Date(lending.startDate)
      : new Date(lending.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = lending.endDate instanceof Date
      ? new Date(lending.endDate)
      : new Date(lending.endDate);
    endDate.setHours(23, 59, 59, 999);

    const isLentOut = checkDate >= startDate && checkDate <= endDate;

    if (isLentOut) {
      console.log('Staff is lent out:', {
        memberId,
        checkDate: checkDate.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        lending
      });
    }

    return isLentOut;
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

    // Check if date falls within any approved leave period (pending leaves don't block scheduling)
    const isOnLeave = leaves.some(leave => {
      if (!leave.startDate || !leave.endDate) return false;

      // Only check approved leaves
      if (leave.status !== 'approved') return false;

      // Dates should already be normalized Date objects from fetchLeaveRequests
      const startDate = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
      const endDate = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);

      const startTime = startDate.getTime();
      const endTime = endDate.getTime();

      const result = checkTime >= startTime && checkTime <= endTime;

      return result;
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

    // Find the leave that covers this date
    const leave = leaves.find(leave => {
      if (!leave.startDate || !leave.endDate) return false;

      // Ensure dates are Date objects
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

  // Helper function to check if a staff member is lent TO this branch and if date is outside lending period
  const isBorrowedStaffOutsideLendingPeriod = (member, date) => {
    if (!member || !date) return false;

    // Check if this is a borrowed staff member (lent TO this branch)
    if (!member.isLent || !member.lendingStartDate || !member.lendingEndDate) {
      return false;
    }

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Handle both Date objects and timestamps
    const startDate = member.lendingStartDate instanceof Date
      ? new Date(member.lendingStartDate)
      : new Date(member.lendingStartDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = member.lendingEndDate instanceof Date
      ? new Date(member.lendingEndDate)
      : new Date(member.lendingEndDate);
    endDate.setHours(23, 59, 59, 999);

    // Return true if date is OUTSIDE the lending period (before start or after end)
    const isOutside = checkDate < startDate || checkDate > endDate;

    return isOutside;
  };

  const handleEditShift = (member, dayKey, date) => {
    // Only allow editing if in edit mode
    if (!isEditMode) return;

    const memberId = member.id || member.uid;

    // Check if staff is lent out on this date (staff lent OUT FROM this branch)
    if (date && isStaffLentOut(memberId, date)) {
      const lending = lentOutData[memberId];
      toast.error(`Cannot edit shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
      return;
    }

    // Check if borrowed staff (lent TO this branch) and date is outside lending period
    if (date && isBorrowedStaffOutsideLendingPeriod(member, date)) {
      toast.error(`Cannot edit shift: Staff member is only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}`);
      return;
    }

    const existingShift = editableShifts[memberId]?.[dayKey];

    setSelectedStaff(member);
    setSelectedDay(dayKey);
    setSelectedDate(date);
    const savedShift = date && member.dateSpecificShifts?.[formatDateLocal(date)];

    setShiftForm({
      start: existingShift?.start || savedShift?.start || '',
      end: existingShift?.end || savedShift?.end || '',
      date: date ? formatDateLocal(date) : '',
      type: existingShift?.type || savedShift?.type || (savedShift ? 'oncall' : 'regular') // Date-specific shifts default to oncall
    });
    setIsAddingShift(false);
    setShowEditShiftModal(true);
  };

  const handleAddShift = (member, dayKey, date) => {
    // Only allow adding if in edit mode
    if (!isEditMode) return;

    const memberId = member.id || member.uid;

    // Check if staff is on leave on this date
    if (date && isStaffOnLeave(memberId, date)) {
      const leave = getLeaveInfoForDate(memberId, date);
      toast.error(`Cannot add shift: Staff member is on leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`);
      return;
    }

    // Check if staff is lent out on this date (staff lent OUT FROM this branch)
    if (date && isStaffLentOut(memberId, date)) {
      const lending = lentOutData[memberId];
      toast.error(`Cannot add shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
      return;
    }

    // Check if borrowed staff (lent TO this branch) and date is outside lending period
    if (date && isBorrowedStaffOutsideLendingPeriod(member, date)) {
      toast.error(`Cannot add shift: Staff member is only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}`);
      return;
    }

    // Auto-set configStartDate to the Monday of the current week if not already set
    if (!configStartDate) {
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      setConfigStartDate(formatDateLocal(weekStart));
    }

    setSelectedStaff(member);
    setSelectedDay(dayKey);
    setSelectedDate(date);
    setShiftForm({
      start: '',
      end: '',
      date: date ? date.toISOString().split('T')[0] : '',
      type: 'regular'
    });
    setIsAddingShift(true);
    setShowEditShiftModal(true);
  };

  const handleOpenQuickBulk = (member) => {
    setQuickBulkEmployee(member);
    setQuickBulkForm({ start: '', end: '', days: [] });
    setShowQuickBulkModal(true);
  };

  const handleSaveQuickBulk = async () => {
    if (!quickBulkEmployee || !quickBulkForm.start || !quickBulkForm.end || quickBulkForm.days.length === 0) {
      toast.error('Please fill in start time, end time, and select at least one day');
      return;
    }

    if (!userBranch || !configStartDate) {
      toast.error('Please set a start date for this configuration');
      return;
    }

    const memberId = quickBulkEmployee.id || quickBulkEmployee.uid;

    // Update editableShifts with all selected days
    const updatedShifts = { ...editableShifts };
    if (!updatedShifts[memberId]) {
      updatedShifts[memberId] = {};
    }

    quickBulkForm.days.forEach(dayKey => {
      updatedShifts[memberId][dayKey] = {
        start: quickBulkForm.start,
        end: quickBulkForm.end
      };
    });

    setEditableShifts(updatedShifts);

    // Auto-save to database
    try {
      // Prepare shifts data
      const shiftsData = {};
      Object.entries(updatedShifts).forEach(([employeeId, employeeShifts]) => {
        const cleanedShifts = {};
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          if (shift.start && shift.end) {
            cleanedShifts[dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });
        if (Object.keys(cleanedShifts).length > 0) {
          shiftsData[employeeId] = cleanedShifts;
        }
      });

      // Save to database
      await createOrUpdateScheduleConfiguration({
        branchId: userBranch,
        shifts: shiftsData,
        startDate: configStartDate,
        notes: 'Calendar-based configuration'
      });

      toast.success(`${quickBulkForm.days.length} shift${quickBulkForm.days.length > 1 ? 's' : ''} added and saved ✓`);

      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error saving bulk shifts:', error);
      toast.error('Failed to save shifts: ' + (error.message || 'Unknown error'));
      // Revert state on error
      setEditableShifts(editableShifts);
      return;
    }

    setShowQuickBulkModal(false);
    setQuickBulkEmployee(null);
    setQuickBulkForm({ start: '', end: '', days: [] });
  };

  const handleRemoveShiftFromEditModal = async () => {
    if (!selectedStaff || !selectedDay) {
      return;
    }

    if (!confirm(`Remove this shift?`)) {
      return;
    }

    const memberId = selectedStaff.id || selectedStaff.uid;

    // Remove from editableShifts
    const updatedShifts = { ...editableShifts };
    if (updatedShifts[memberId]) {
      delete updatedShifts[memberId][selectedDay];
      // If no shifts left for this member, remove the member key
      if (Object.keys(updatedShifts[memberId]).length === 0) {
        delete updatedShifts[memberId];
      }
    }

    setEditableShifts(updatedShifts);

    // Auto-save to database
    try {
      if (!userBranch || !configStartDate) {
        toast.error('Configuration error');
        return;
      }

      // Prepare shifts data from updated state
      const shiftsData = {};
      Object.entries(updatedShifts).forEach(([employeeId, employeeShifts]) => {
        const cleanedShifts = {};
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          if (shift.start && shift.end) {
            cleanedShifts[dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });
        if (Object.keys(cleanedShifts).length > 0) {
          shiftsData[employeeId] = cleanedShifts;
        }
      });

      // Save to database (empty shifts data if all removed)
      await createOrUpdateScheduleConfiguration({
        branchId: userBranch,
        shifts: shiftsData,
        startDate: configStartDate,
        notes: 'Calendar-based configuration'
      });

      toast.success('Shift removed and saved ✓');

      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error removing shift:', error);
      toast.error('Failed to remove shift: ' + (error.message || 'Unknown error'));
      // Revert the state change on error
      setEditableShifts(editableShifts);
      return;
    }

    setShowEditShiftModal(false);
    setSelectedStaff(null);
    setSelectedDay(null);
    setSelectedDate(null);
    setShiftForm({ start: '', end: '', date: '', type: 'regular' });
    setIsAddingShift(false);
  };

  const handleSaveShift = async () => {
    // Auto-save shift immediately to database
    if (!selectedStaff || !selectedDay) {
      toast.error('Please select a staff member and day');
      return;
    }

    if (!shiftForm.start || !shiftForm.end) {
      toast.error('Please enter both start and end times');
      return;
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(shiftForm.start) || !timeRegex.test(shiftForm.end)) {
      toast.error('Invalid time format. Use HH:mm format (e.g., 09:00)');
      return;
    }

    // Validate start time is before end time
    const [startHour, startMin] = shiftForm.start.split(':').map(Number);
    const [endHour, endMin] = shiftForm.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      toast.error('End time must be after start time');
      return;
    }

    const memberId = selectedStaff.id || selectedStaff.uid;

    // Check if staff is on leave on the date being edited
    if (selectedDate && isStaffOnLeave(memberId, selectedDate)) {
      const leave = getLeaveInfoForDate(memberId, selectedDate);
      toast.error(`Cannot save shift: Staff member is on leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`);
      return;
    }

    // Check if staff is lent out on the date being edited (staff lent OUT FROM this branch)
    // For recurring shifts, check if staff is lent out during the config start date period
    if (selectedDate && isStaffLentOut(memberId, selectedDate)) {
      const lending = lentOutData[memberId];
      toast.error(`Cannot save shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
      return;
    }

    // Check if borrowed staff (lent TO this branch) and date is outside lending period
    if (selectedDate && isBorrowedStaffOutsideLendingPeriod(selectedStaff, selectedDate)) {
      toast.error(`Cannot save shift: Staff member is only lent to this branch from ${formatDate(selectedStaff.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(selectedStaff.lendingEndDate, 'MMM dd, yyyy')}`);
      return;
    }

    // For recurring shifts (no specific date), we need to check the actual date for that day of the week
    // Use the week dates to find the correct date for the selected day
    if (!selectedDate && configStartDate && selectedDay) {
      const weekDates = getWeekDates();
      const dayIndex = DAYS_OF_WEEK.findIndex(d => d.key === selectedDay);

      if (dayIndex !== -1 && weekDates[dayIndex]) {
        const actualDate = weekDates[dayIndex];

        // Check if staff is on leave
        if (isStaffOnLeave(memberId, actualDate)) {
          const leave = getLeaveInfoForDate(memberId, actualDate);
          toast.error(`Cannot save shift: Staff member is on leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`);
          return;
        }

        // Check if staff is lent out (lent OUT FROM this branch)
        if (isStaffLentOut(memberId, actualDate)) {
          const lending = lentOutData[memberId];
          toast.error(`Cannot save shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
          return;
        }

        // Check if borrowed staff (lent TO this branch) and date is outside lending period
        if (isBorrowedStaffOutsideLendingPeriod(selectedStaff, actualDate)) {
          toast.error(`Cannot save shift: Staff member is only lent to this branch from ${formatDate(selectedStaff.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(selectedStaff.lendingEndDate, 'MMM dd, yyyy')}`);
          return;
        }
      }
    }

    // Update editableShifts state first
    const updatedShifts = {
      ...editableShifts,
      [memberId]: {
        ...(editableShifts[memberId] || {}),
        [selectedDay]: {
          start: shiftForm.start,
          end: shiftForm.end
        }
      }
    };

    setEditableShifts(updatedShifts);

    // If On-Call (BIGLAAN), save as date-specific shift using a separate service call
    if (shiftForm.type === 'oncall') {
      if (!selectedDate) {
        toast.error('Date is required for On-Call shifts');
        return;
      }

      await createOrUpdateScheduleWithHistory({
        branchId: userBranch,
        employeeId: memberId,
        date: shiftForm.date, // Use the date from form or selectedDate
        startTime: shiftForm.start,
        endTime: shiftForm.end,
        type: 'oncall',
        notes: 'BIGLAAN shift'
      });

      toast.success('On-Call (BIGLAAN) shift saved ✓');
      await fetchStaff();
      setShowEditShiftModal(false);
      return;
    }

    // Auto-save to database immediately
    try {
      if (!userBranch || !configStartDate) {
        toast.error('Please set a start date for this configuration');
        return;
      }

      // Default logic for Regular (recurring) shifts
      // IMPORTANT: Merge with existing shifts from all staff members
      // This ensures we don't lose shifts from other staff when saving
      const existingShiftsFromStaff = {};
      staff.forEach(member => {
        const staffId = member.id || member.uid;
        if (staffId && member.shifts && Object.keys(member.shifts).length > 0) {
          existingShiftsFromStaff[staffId] = {};
          Object.entries(member.shifts).forEach(([dayKey, shift]) => {
            if (shift && shift.start && shift.end) {
              existingShiftsFromStaff[staffId][dayKey] = {
                start: shift.start,
                end: shift.end
              };
            }
          });
        }
      });

      // Merge existing shifts with updated shifts (updated shifts take priority)
      const mergedShifts = { ...existingShiftsFromStaff };
      Object.entries(updatedShifts).forEach(([employeeId, employeeShifts]) => {
        if (!mergedShifts[employeeId]) {
          mergedShifts[employeeId] = {};
        }
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          if (shift.start && shift.end) {
            mergedShifts[employeeId][dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });
      });

      // Clean up empty entries
      const shiftsData = {};
      Object.entries(mergedShifts).forEach(([employeeId, employeeShifts]) => {
        const cleanedShifts = {};
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          if (shift.start && shift.end) {
            cleanedShifts[dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });
        if (Object.keys(cleanedShifts).length > 0) {
          shiftsData[employeeId] = cleanedShifts;
        }
      });

      // Save to database
      await createOrUpdateScheduleConfiguration({
        branchId: userBranch,
        shifts: shiftsData,
        startDate: configStartDate,
        notes: 'Calendar-based configuration'
      });

      toast.success(isAddingShift ? 'Shift added and saved ✓' : 'Shift updated and saved ✓');

      // Reload staff schedules to show updated data
      await fetchStaff();
      await fetchAllScheduleConfigs();
    } catch (error) {
      console.error('Error auto-saving shift:', error);
      toast.error('Failed to save shift: ' + (error.message || 'Unknown error'));
      // Revert the state change on error
      setEditableShifts(editableShifts);
      return;
    }

    setShowEditShiftModal(false);
    setSelectedStaff(null);
    setSelectedDay(null);
    setSelectedDate(null);
    setShiftForm({ start: '', end: '', date: '' });
    setIsAddingShift(false);
  };

  const handleSaveAllShifts = async () => {
    if (!userBranch || !configStartDate) {
      toast.error('Please set a start date for this configuration');
      return;
    }

    // Validate that shifts are not being added for days when staff are lent out
    // Only block if there are shifts configured for days when staff are lent out
    const weekDates = getWeekDates();
    const validationErrors = [];

    Object.entries(editableShifts).forEach(([memberId, employeeShifts]) => {
      const staffMember = staff.find(s => (s.id || s.uid) === memberId);
      const memberName = staffMember ? getFullName(staffMember) : 'Staff member';

      // Check each day that has a shift configured
      Object.keys(employeeShifts).forEach(dayKey => {
        const shift = employeeShifts[dayKey];
        // Only check if shift has both start and end times
        if (shift.start && shift.end) {
          // Find the date for this day of the week using weekDates
          const dayIndex = DAYS_OF_WEEK.findIndex(d => d.key === dayKey);
          if (dayIndex !== -1 && weekDates[dayIndex]) {
            const actualDate = weekDates[dayIndex];

            // Check if staff is on leave on this specific date
            if (isStaffOnLeave(memberId, actualDate)) {
              const leave = getLeaveInfoForDate(memberId, actualDate);
              const dayLabel = DAYS_OF_WEEK[dayIndex]?.label || dayKey;
              validationErrors.push(
                `${memberName} - ${dayLabel} (${formatDate(actualDate, 'MMM dd, yyyy')}): On leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`
              );
              return; // Skip this day - use return instead of continue in forEach
            }

            // Check if staff is lent out on this specific date (lent OUT FROM this branch)
            if (isStaffLentOut(memberId, actualDate)) {
              const lending = lentOutData[memberId];
              const dayLabel = DAYS_OF_WEEK[dayIndex]?.label || dayKey;
              validationErrors.push(
                `${memberName} - ${dayLabel} (${formatDate(actualDate, 'MMM dd, yyyy')}): Lent out to ${lending.toBranchName}`
              );
            }

            // Check if borrowed staff (lent TO this branch) and date is outside lending period
            if (staffMember && isBorrowedStaffOutsideLendingPeriod(staffMember, actualDate)) {
              const dayLabel = DAYS_OF_WEEK[dayIndex]?.label || dayKey;
              validationErrors.push(
                `${memberName} - ${dayLabel} (${formatDate(actualDate, 'MMM dd, yyyy')}): Only lent to this branch from ${formatDate(staffMember.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(staffMember.lendingEndDate, 'MMM dd, yyyy')}`
              );
            }
          }
        }
      });
    });

    if (validationErrors.length > 0) {
      toast.error(`Cannot save shifts for the following:\n${validationErrors.join('\n')}`, { duration: 6000 });
      return;
    }

    try {
      setSaving(true);

      // Validate all shifts against branch hours
      const validationErrors = [];
      Object.entries(editableShifts).forEach(([employeeId, employeeShifts]) => {
        const member = staff.find(s => (s.id || s.uid) === employeeId);
        const memberName = member ? getFullName(member) : 'Staff member';

        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          if (shift.start && shift.end) {
            const validation = validateShiftAgainstBranchHours(dayKey, shift.start, shift.end);
            if (!validation.valid) {
              validationErrors.push(`${memberName} - ${DAYS_OF_WEEK.find(d => d.key === dayKey)?.label}: ${validation.message}`);
            }
          }
        });
      });

      if (validationErrors.length > 0) {
        toast.error(`Invalid shifts:\n${validationErrors.join('\n')}`, { duration: 5000 });
        setSaving(false);
        return;
      }

      // Prepare shifts data structure: { employeeId: { monday: {start, end}, ... }, ... }
      const shiftsData = {};

      Object.entries(editableShifts).forEach(([employeeId, employeeShifts]) => {
        const cleanedShifts = {};
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          // Only include shifts that have both start and end times
          if (shift.start && shift.end) {
            cleanedShifts[dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });

        // Only add employee if they have at least one shift
        if (Object.keys(cleanedShifts).length > 0) {
          shiftsData[employeeId] = cleanedShifts;
        }
      });

      if (Object.keys(shiftsData).length === 0) {
        toast.error('Please configure at least one shift for at least one staff member');
        setSaving(false);
        return;
      }

      // Save all shifts at once as ONE document
      await createOrUpdateScheduleConfiguration({
        branchId: userBranch,
        shifts: shiftsData,
        startDate: configStartDate,
        notes: 'Calendar-based configuration'
      });

      toast.success('All shifts saved successfully!');
      setIsEditMode(false);
      setEditableShifts({});
      setConfigStartDate('');

      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error saving shifts:', error);
      toast.error(error.message || 'Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (member, dayKey, date) => {
    const shift = getShiftForDay(member, dayKey, date);
    const isDateSpecific = shift?.isDateSpecific;
    const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const dayLabel = DAYS_OF_WEEK.find(d => d.key === dayKey)?.label;

    if (!confirm(`Remove shift for ${isDateSpecific ? dateStr : dayLabel}?`)) {
      return;
    }

    if (!userBranch) {
      toast.error('Branch information not available');
      return;
    }

    try {
      const memberId = member.id || member.uid;

      if (isDateSpecific && date) {
        // For date-specific shifts, we need to deactivate by date
        // We'll need to update the deactivateSchedule function or create a new one
        // For now, let's use a workaround - find and deactivate the specific schedule
        const weekStart = new Date(currentWeek);
        weekStart.setHours(0, 0, 0, 0);
        const { dateSpecificShifts: schedules } = await getActiveSchedulesByEmployee(memberId, userBranch, weekStart);
        const scheduleToDelete = schedules.find(s => {
          if (s.date) {
            const sDate = formatDateLocal(s.date);
            const targetDate = formatDateLocal(date);
            return sDate === targetDate;
          }
          return false;
        });

        if (scheduleToDelete) {
          const { deleteSchedule } = await import('../../services/scheduleService');
          await deleteSchedule(scheduleToDelete.id);
        }
      } else {
        // Recurring shift
        const dayOfWeek = convertDayKeyToDayOfWeek(dayKey);
        if (!dayOfWeek) {
          throw new Error('Invalid day selected');
        }
        await deactivateSchedule(memberId, dayOfWeek, userBranch);
      }

      // Reload schedules
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      const schedules = await getActiveSchedulesByEmployee(memberId, userBranch, weekStart);
      const shifts = {};
      const dateSpecificShifts = {};

      schedules.forEach(schedule => {
        if (schedule.date) {
          const dateStr = formatDateLocal(schedule.date);
          dateSpecificShifts[dateStr] = {
            start: schedule.startTime,
            end: schedule.endTime,
            date: schedule.date,
            isDateSpecific: true,
            scheduleId: schedule.id,
            type: schedule.type || 'oncall'
          };
        } else {
          const dayKey = schedule.dayOfWeek?.toLowerCase();
          if (dayKey) {
            shifts[dayKey] = {
              start: schedule.startTime,
              end: schedule.endTime,
              isRecurring: true,
              scheduleId: schedule.id
            };
          }
        }
      });

      // Update local state
      setStaff(prev => prev.map(s => {
        const sId = s.id || s.uid;
        if (sId === memberId) {
          return { ...s, shifts, dateSpecificShifts };
        }
        return s;
      }));

      toast.success('Shift removed successfully');
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error(error.message || 'Failed to remove shift');
    }
  };

  const handleViewHistory = async (member) => {
    if (!userBranch) {
      toast.error('Branch information not available');
      return;
    }

    try {
      setLoadingHistory(true);
      setSelectedStaff(member);
      const memberId = member.id || member.uid;

      // Fetch shift history
      const history = await getScheduleHistoryByEmployee(memberId, userBranch);
      setShiftHistory(history);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading shift history:', error);
      toast.error('Failed to load shift history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const validateShiftAgainstBranchHours = (dayKey, startTime, endTime) => {
    if (!branchHours) return { valid: true }; // If no branch hours, allow any time

    const dayHours = branchHours[dayKey];
    if (!dayHours || !dayHours.isOpen) {
      return {
        valid: false,
        message: `${DAYS_OF_WEEK.find(d => d.key === dayKey)?.label} is closed`
      };
    }

    if (startTime >= endTime) {
      return {
        valid: false,
        message: 'End time must be after start time'
      };
    }

    if (startTime < dayHours.open) {
      return {
        valid: false,
        message: `Start time must be after branch opening time (${dayHours.open})`
      };
    }

    if (endTime > dayHours.close) {
      return {
        valid: false,
        message: `End time must be before branch closing time (${dayHours.close})`
      };
    }

    return { valid: true };
  };

  const handleSaveBulkShiftsFromModal = async () => {
    if (!userBranch) {
      toast.error('Branch information not available');
      return;
    }

    if (selectedStaffIds.length === 0) {
      toast.error('Please select at least one stylist');
      return;
    }

    // Validate each selected staff has times and days set
    const invalidStaff = selectedStaffIds.filter(staffId => {
      const times = staffTimes[staffId];
      const days = staffDays[staffId] || [];
      return !times || !times.start || !times.end || days.length === 0;
    });

    if (invalidStaff.length > 0) {
      const member = staff.find(s => (s.id || s.uid) === invalidStaff[0]);
      toast.error(`Please set times and select at least one day for ${getFullName(member)}`);
      return;
    }

    // Validate time format and logic for each staff
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const staffId of selectedStaffIds) {
      const times = staffTimes[staffId];
      if (!timeRegex.test(times.start) || !timeRegex.test(times.end)) {
        const member = staff.find(s => (s.id || s.uid) === staffId);
        toast.error(`Invalid time format for ${getFullName(member)}. Use HH:mm format (e.g., 09:00)`);
        return;
      }

      const [startHour, startMin] = times.start.split(':').map(Number);
      const [endHour, endMin] = times.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        const member = staff.find(s => (s.id || s.uid) === staffId);
        toast.error(`End time must be after start time for ${getFullName(member)}`);
        return;
      }
    }

    try {
      setSaving(true);

      // Get current active configuration to update it
      const allConfigs = await getScheduleConfigurationsByBranch(userBranch);
      const activeConfig = allConfigs.find(c => c.isActive);

      // Prepare shifts data structure
      const shiftsData = activeConfig?.shifts || {};

      // Add shifts for all selected staff with their individual days and times
      selectedStaffIds.forEach(employeeId => {
        if (!shiftsData[employeeId]) {
          shiftsData[employeeId] = {};
        }

        const times = staffTimes[employeeId];
        const days = staffDays[employeeId] || [];

        // Add shifts for each day this employee is scheduled
        days.forEach(dayKey => {
          shiftsData[employeeId][dayKey] = {
            start: times.start,
            end: times.end
          };
        });
      });

      if (activeConfig) {
        // Update existing configuration
        await updateDoc(doc(db, 'schedules', activeConfig.id), {
          shifts: shiftsData,
          updatedAt: Timestamp.now()
        });
      } else {
        // Create new configuration with start date = current week start
        const weekStart = new Date(currentWeek);
        weekStart.setHours(0, 0, 0, 0);
        await createOrUpdateScheduleConfiguration({
          branchId: userBranch,
          shifts: shiftsData,
          startDate: weekStart.toISOString().split('T')[0],
          notes: 'Bulk shift creation'
        });
      }

      const totalShifts = selectedStaffIds.reduce((sum, id) => {
        const days = staffDays[id] || [];
        return sum + days.length;
      }, 0);

      toast.success(`Successfully created ${totalShifts} shift(s)!`);
      setShowShiftModal(false);
      setSelectedStaffIds([]);
      setSelectedDays([]);
      setStaffTimes({});
      setStaffDays({});
      setShiftForm({ start: '', end: '', date: '' });

      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error saving bulk shifts:', error);
      toast.error(error.message || 'Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulkShifts = async () => {
    if (!userBranch || !bulkStartDate) {
      toast.error('Please select a start date');
      return;
    }

    try {
      setSaving(true);

      // Prepare shifts data structure: { employeeId: { monday: {start, end}, ... }, ... }
      const shiftsData = {};

      Object.entries(bulkShifts).forEach(([employeeId, employeeShifts]) => {
        const cleanedShifts = {};
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          // Only include shifts that have both start and end times
          if (shift.start && shift.end) {
            cleanedShifts[dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });

        // Only add employee if they have at least one shift
        if (Object.keys(cleanedShifts).length > 0) {
          shiftsData[employeeId] = cleanedShifts;
        }
      });

      if (Object.keys(shiftsData).length === 0) {
        toast.error('Please configure at least one shift for at least one staff member');
        return;
      }

      // Save all shifts at once
      await createOrUpdateScheduleConfiguration({
        branchId: userBranch,
        shifts: shiftsData,
        startDate: bulkStartDate,
        notes: 'Bulk configuration - all staff shifts'
      });

      toast.success('All shifts configured successfully!');
      setShowBulkConfigModal(false);

      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error saving bulk shifts:', error);
      toast.error(error.message || 'Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };


  const navigateWeek = (direction) => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const goToToday = () => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeek(new Date(date.setDate(diff)));
  };

  const weekDates = useMemo(() => getWeekDates(), [currentWeek]);
  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return today >= weekStart && today <= weekEnd;
  }, [currentWeek]);

  const staffForPrint = useMemo(() => {
    if (!printOnlyWithSchedules) return staff;
    return staff.filter((member) =>
      weekDates.some((date, idx) => {
        const dayKey = DAYS_OF_WEEK[idx]?.key || '';
        const shift = getShiftForDay(member, dayKey, date);
        return shift && shift.start && shift.end;
      })
    );
  }, [printOnlyWithSchedules, staff, weekDates]);

  // Filter staff based on search term and filters
  const filteredStaff = useMemo(() => {
    let result = [...staff];

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(member => {
        const fullName = getFullName(member).toLowerCase();
        const email = (member.email || '').toLowerCase();
        return fullName.includes(searchLower) || email.includes(searchLower);
      });
    }

    // Filter by roles
    if (filters.roles.length > 0) {
      result = result.filter(member => {
        const userRoles = member.roles || (member.role ? [member.role] : []);
        return filters.roles.some(role => userRoles.includes(role));
      });
    }

    // Filter by shift status
    if (filters.shiftStatus === 'withShifts') {
      result = result.filter(member => {
        return weekDates.some(date => {
          const dayKey = getDayKey(date);
          const shift = getShiftForDay(member, dayKey, date);
          return shift && shift.start && shift.end;
        });
      });
    } else if (filters.shiftStatus === 'withoutShifts') {
      result = result.filter(member => {
        return !weekDates.some(date => {
          const dayKey = getDayKey(date);
          const shift = getShiftForDay(member, dayKey, date);
          return shift && shift.start && shift.end;
        });
      });
    }

    // Filter by availability status
    if (filters.availabilityStatus === 'onLeave') {
      result = result.filter(member => {
        const memberId = member.id || member.uid;
        return weekDates.some(date => isStaffOnLeave(memberId, date));
      });
    } else if (filters.availabilityStatus === 'lentOut') {
      result = result.filter(member => {
        const memberId = member.id || member.uid;
        return weekDates.some(date => isStaffLentOut(memberId, date));
      });
    } else if (filters.availabilityStatus === 'lentIn') {
      result = result.filter(member => member.isLent);
    } else if (filters.availabilityStatus === 'available') {
      result = result.filter(member => {
        const memberId = member.id || member.uid;
        const hasLeave = weekDates.some(date => isStaffOnLeave(memberId, date));
        const isLent = weekDates.some(date => isStaffLentOut(memberId, date));
        return !hasLeave && !isLent && !member.isLent;
      });
    }

    return result;
  }, [staff, searchTerm, filters, weekDates, lendingData, lentOutData, staffLeaveMap, allScheduleConfigs]);

  const totalStaffPages = useMemo(() => Math.max(1, Math.ceil(filteredStaff.length / staffItemsPerPage)), [filteredStaff.length, staffItemsPerPage]);
  const safeStaffPage = Math.min(staffPage, totalStaffPages);
  const staffStartIndex = (safeStaffPage - 1) * staffItemsPerPage;
  const staffEndIndex = staffStartIndex + staffItemsPerPage;
  const paginatedStaff = useMemo(() => filteredStaff.slice(staffStartIndex, staffEndIndex), [filteredStaff, staffStartIndex, staffEndIndex]);

  useEffect(() => {
    if (staffPage > totalStaffPages) {
      setStaffPage(totalStaffPages);
    }
  }, [staffPage, totalStaffPages]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setStaffPage(1);
  }, [filters, searchTerm]);

  // Print handler using window.open method
  const handlePrintSchedule = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }

    // Wait a moment to ensure content is fully rendered
    setTimeout(() => {
      if (!printRef.current) {
        toast.error('Print content not ready. Please try again.');
        return;
      }

      // Get the inner HTML of the print content (includes inline styles)
      const printContentHTML = printRef.current.innerHTML;

      // Get all computed styles from the document
      let styles = '';
      try {
        styles = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              return Array.from(sheet.cssRules || [])
                .map((rule) => rule.cssText)
                .join('\n');
            } catch (e) {
              // Cross-origin stylesheets will throw an error, skip them
              return '';
            }
          })
          .join('\n');
      } catch (e) {
        console.warn('Could not extract all styles:', e);
      }

      // Create print window
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the schedule');
        return;
      }

      // Write HTML content
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
                margin: 0.3in 0.4in 0.75in 0.4in;
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
              header, footer {
                display: none;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: white;
              color: #000;
              counter-reset: page 1;
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
              // Calculate total pages
              setTimeout(function() {
                const pageHeight = 700; // Landscape letter size usable height
                const contentHeight = document.body.scrollHeight;
                const totalPages = Math.max(1, Math.ceil(contentHeight / pageHeight));
                
                // Inject page numbering style for the existing page-number-display element
                const printStyle = document.createElement('style');
                printStyle.textContent = '.page-number-display::before { content: "Page " counter(page) " of ' + totalPages + '"; } body { counter-reset: page 1; }';
                document.head.appendChild(printStyle);
                
                // Print after calculating pages
                setTimeout(function() {
                  window.print();
                  // Close window after print dialog is closed
                  window.onafterprint = function() {
                    setTimeout(function() {
                      window.close();
                    }, 100);
                  };
                  // Fallback: close after 30 seconds if print dialog doesn't trigger
                  setTimeout(function() {
                    if (!window.closed) {
                      window.close();
                    }
                  }, 30000);
                }, 100);
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
      <>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
        {/* Always render print component even when loading */}
        <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
          <div className="print-content" style={{ fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', padding: '20px' }}>
            <p>Loading schedule data...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Modal */}
      {showFilterModalSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Filter Staff Schedules</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select filters to refine the staff schedule view
                </p>
              </div>
              <button
                onClick={() => setShowFilterModalSchedule(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Filter by Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Filter by Role
                </label>
                <div className="space-y-2">
                  {MANAGEABLE_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.roles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              roles: [...prev.roles, role]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              roles: prev.roles.filter(r => r !== role)
                            }));
                          }
                        }}
                        className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        {role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filter by Shift Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Filter by Shift Status
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'all', label: 'All Staff' },
                    { value: 'withShifts', label: 'With Shifts' },
                    { value: 'withoutShifts', label: 'Without Shifts' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="shiftStatus"
                        value={option.value}
                        checked={filters.shiftStatus === option.value}
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            shiftStatus: e.target.value
                          }));
                        }}
                        className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filter by Availability Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Filter by Availability Status
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'all', label: 'All Staff' },
                    { value: 'available', label: 'Available' },
                    { value: 'onLeave', label: 'On Leave' },
                    { value: 'lentOut', label: 'Lent Out' },
                    { value: 'lentIn', label: 'Lent In' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="availabilityStatus"
                        value={option.value}
                        checked={filters.availabilityStatus === option.value}
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            availabilityStatus: e.target.value
                          }));
                        }}
                        className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active Filters Summary */}
              {(filters.roles.length > 0 || filters.shiftStatus !== 'all' || filters.availabilityStatus !== 'all') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Active Filters:</p>
                  <div className="flex flex-wrap gap-2">
                    {filters.roles.map(role => (
                      <span key={role} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')}
                      </span>
                    ))}
                    {filters.shiftStatus !== 'all' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {filters.shiftStatus === 'withShifts' ? 'With Shifts' : 'Without Shifts'}
                      </span>
                    )}
                    {filters.availabilityStatus !== 'all' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {filters.availabilityStatus === 'available' ? 'Available' :
                          filters.availabilityStatus === 'onLeave' ? 'On Leave' :
                            filters.availabilityStatus === 'lentOut' ? 'Lent Out' :
                              filters.availabilityStatus === 'lentIn' ? 'Lent In' : filters.availabilityStatus}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setFilters({
                    roles: [],
                    shiftStatus: 'all',
                    availabilityStatus: 'all'
                  });
                  setStaffPage(1);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear All Filters
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilterModalSchedule(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowFilterModalSchedule(false);
                    setStaffPage(1);
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print choice modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowPrintModal(false)} />
          <div className="bg-white rounded-lg shadow-lg z-10 w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-3">Print Weekly Schedules</h3>
            <p className="text-sm text-gray-600 mb-4">Choose which schedules to include in the printout.</p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => {
                  setPrintOnlyWithSchedules(false);
                  setShowPrintModal(false);
                  // Allow state to update/render before printing
                  setTimeout(() => handlePrintSchedule(), 50);
                }}
              >
                Print All Schedules
              </button>
              <button
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
                onClick={() => {
                  setPrintOnlyWithSchedules(true);
                  setShowPrintModal(false);
                  setTimeout(() => handlePrintSchedule(), 50);
                }}
              >
                Only Staff With Schedules
              </button>
            </div>
            <div className="text-right mt-4">
              <button className="text-sm text-gray-600" onClick={() => setShowPrintModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'week'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'month'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Month
            </button>
          </div>
        </div>
        {/* Edit mode indicator and exit button */}
        {isEditMode && (
          <div className="flex items-center gap-2 flex-nowrap">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Auto-save enabled</span>
            </div>
            <button
              onClick={() => {
                setIsEditMode(false);
                setEditableShifts({});
                setConfigStartDate('');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              Done
            </button>
          </div>
        )}
        {/* Right side: Navigation controls */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
          <button
            onClick={() => viewMode === 'week' ? navigateWeek('prev') : setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title={viewMode === 'week' ? 'Previous Week' : 'Previous Month'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={viewMode === 'week' ? goToToday : () => {
              const today = new Date();
              today.setDate(1);
              setCurrentMonth(today);
            }}
            className={`px-4 py-2 rounded-lg border transition-colors text-sm ${viewMode === 'week'
              ? (isCurrentWeek ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
              : (currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
              }`}
          >
            Today
          </button>
          <button
            onClick={() => viewMode === 'week' ? navigateWeek('next') : setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title={viewMode === 'week' ? 'Next Week' : 'Next Month'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="min-w-[200px] text-right font-semibold text-gray-900">
            {viewMode === 'week' ? (
              <>
                {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </>
            ) : (
              currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            )}
          </div>
        </div>
      </div>

      {/* Search and Actions - single row */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff or schedules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            onClick={() => setShowFilterModalSchedule(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm ${(filters.roles.length > 0 || filters.shiftStatus !== 'all' || filters.availabilityStatus !== 'all')
              ? 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100'
              : 'border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Filter className="w-5 h-5" />
            <span className="px-1.5 py-0.5 bg-primary-600 text-white text-xs rounded-full">
              {filteredStaff.length}
            </span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Printer className="w-5 h-5 text-gray-600" />
          </button>

          <button
            onClick={() => exportSchedulesToCSV()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Download className="w-5 h-5 text-gray-600" />
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
                {staff.filter(s => s.shifts && Object.keys(s.shifts).length > 0).length}
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
                    return s.shifts[dayKey];
                  });
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Schedule Content - Weekly or Monthly View */}
      {viewMode === 'week' ? (
        /* Weekly Schedule Table */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="text-sm text-gray-700">
              Showing {filteredStaff.length > 0 ? staffStartIndex + 1 : 0} to {Math.min(staffEndIndex, filteredStaff.length)} of {filteredStaff.length} staff
              {filteredStaff.length !== staff.length && (
                <span className="text-gray-500"> (filtered from {staff.length} total)</span>
              )}
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
                  onClick={() => setStaffPage(prev => Math.max(1, prev - 1))}
                  disabled={safeStaffPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalStaffPages) }, (_, i) => {
                    let pageNum;
                    if (totalStaffPages <= 5) {
                      pageNum = i + 1;
                    } else if (safeStaffPage <= 3) {
                      pageNum = i + 1;
                    } else if (safeStaffPage >= totalStaffPages - 2) {
                      pageNum = totalStaffPages - 4 + i;
                    } else {
                      pageNum = safeStaffPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setStaffPage(pageNum)}
                        className={`px-3 py-1 border rounded-lg text-sm ${safeStaffPage === pageNum
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
                  onClick={() => setStaffPage(prev => Math.min(totalStaffPages, prev + 1))}
                  disabled={safeStaffPage === totalStaffPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                    Staff Member
                  </th>
                  {weekDates.map((date, index) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    const dayKey = getDayKey(date);
                    const dayInfo = DAYS_OF_WEEK.find(d => d.key === dayKey);

                    return (
                      <th
                        key={index}
                        className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider min-w-[140px] ${isToday ? 'bg-primary-50 text-primary-700' : 'text-gray-500'
                          }`}
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-semibold">{dayInfo?.short}</span>
                          <span className="text-xs font-normal mt-1">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedStaff.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      No staff members found
                    </td>
                  </tr>
                ) : (
                  paginatedStaff.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {getInitials(member)}
                          </div>
                          {isEditMode && (
                            <button
                              onClick={() => handleOpenQuickBulk(member)}
                              className="flex-shrink-0 w-8 h-8 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-colors shadow-sm"
                              title="Quick add shifts"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900">
                                {getFullName(member)}
                                {member.isLent && (
                                  <span className="ml-2 text-xs font-normal text-blue-600">(lent)</span>
                                )}
                                {!member.isLent && lentOutData[member.id || member.uid] && (
                                  <span className="ml-2 text-xs font-normal text-orange-600">(lent)</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleViewHistory(member)}
                                className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                title="View shift history"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="text-xs text-gray-500">
                              {member.email}
                            </div>
                            {member.isLent && member.lentFromBranch && (
                              <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                From: {member.lentFromBranch}
                              </div>
                            )}
                            {!member.isLent && lendingData[member.id || member.uid] && (
                              <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                Lent to {lendingData[member.id || member.uid].branchName}
                              </div>
                            )}
                            {!member.isLent && lentOutData[member.id || member.uid] && (
                              <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                Lent to {lentOutData[member.id || member.uid].toBranchName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {weekDates.map((date, index) => {
                        const dayKey = getDayKey(date);
                        const shift = getShiftForDay(member, dayKey, date);
                        const isToday = date.toDateString() === new Date().toDateString();
                        const isDateSpecific = shift?.isDateSpecific;

                        return (
                          <td
                            key={index}
                            className={`px-4 py-4 text-center ${isToday ? 'bg-primary-50' : ''
                              }`}
                          >
                            {isEditMode ? (
                              // Edit Mode - Show shifts from editableShifts or Add button
                              (() => {
                                const memberId = member.id || member.uid;
                                let editableShift = editableShifts[memberId]?.[dayKey];
                                
                                // Check for date-specific shift (these override recurring shifts)
                                if (date && member.dateSpecificShifts) {
                                  const dateStr = formatDateLocal(date);
                                  const dateSpecificShift = member.dateSpecificShifts[dateStr];
                                  if (dateSpecificShift) {
                                    // Use date-specific shift instead of editable shift
                                    editableShift = {
                                      start: dateSpecificShift.start,
                                      end: dateSpecificShift.end,
                                      type: dateSpecificShift.type || 'oncall',
                                      isDateSpecific: true
                                    };
                                  }
                                }

                                // Check if staff is on leave on this date
                                const onLeave = date && isStaffOnLeave(memberId, date);
                                const leaveInfo = date && onLeave ? getLeaveInfoForDate(memberId, date) : null;

                                // Check if there's a lending day (can't edit)
                                if (shift?.isLending) {
                                  return (
                                    <>
                                      <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${shift.isLentToBranch
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-purple-100 text-purple-800'
                                        }`}>
                                        LENDING
                                      </div>
                                      {shift.lendingBranch && (
                                        <div className={`text-xs font-medium ${shift.isLentToBranch
                                          ? 'text-blue-600'
                                          : 'text-purple-600'
                                          }`}>
                                          {shift.isLentToBranch ? 'From: ' : 'To: '}{shift.lendingBranch}
                                        </div>
                                      )}
                                    </>
                                  );
                                }

                                // Check if staff is on leave (show leave indicator, can't edit)
                                if (onLeave && leaveInfo) {
                                  const leaveTypeLabels = {
                                    vacation: 'Vacation',
                                    sick: 'Sick',
                                    personal: 'Personal',
                                    emergency: 'Emergency',
                                    maternity: 'Maternity',
                                    paternity: 'Paternity',
                                    bereavement: 'Bereavement',
                                    undetermined: 'Undetermined'
                                  };
                                  return (
                                    <>
                                      <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-800">
                                        ON LEAVE
                                      </div>
                                      <div className="text-xs text-orange-600 font-medium">
                                        {leaveTypeLabels[leaveInfo.type] || 'Leave'}
                                      </div>
                                      {leaveInfo.status === 'pending' && (
                                        <div className="text-xs text-yellow-600">
                                          (Pending)
                                        </div>
                                      )}
                                    </>
                                  );
                                }

                                // Check if staff is lent out on this date (lent OUT FROM this branch)
                                const isLentOut = date && isStaffLentOut(memberId, date);
                                const lendingInfo = date && isLentOut ? lentOutData[memberId] : null;

                                // Show lent out indicator if staff is lent out (can't edit)
                                if (isLentOut && lendingInfo) {
                                  return (
                                    <>
                                      <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-800">
                                        LENT OUT
                                      </div>
                                      <div className="text-xs text-blue-600 font-medium text-center">
                                        {lendingInfo.toBranchName}
                                      </div>
                                    </>
                                  );
                                }

                                // Check if borrowed staff (lent TO this branch) and date is outside lending period
                                const isBorrowedOutsidePeriod = date && isBorrowedStaffOutsideLendingPeriod(member, date);

                                // Combined check: cannot edit if on leave, lent out OR borrowed outside period
                                const cannotEdit = onLeave || isLentOut || isBorrowedOutsidePeriod;

                                // Show editable shift if exists
                                if (editableShift && editableShift.start && editableShift.end) {
                                  return (
                                    <div className="relative group">
                                      <div
                                        className={`flex flex-col items-center gap-1 ${cannotEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        onClick={() => !cannotEdit && handleEditShift(member, dayKey, date)}
                                        title={cannotEdit ? (onLeave ? `Cannot edit: Staff member is on leave from ${formatDate(leaveInfo.startDate, 'MMM dd, yyyy')} to ${formatDate(leaveInfo.endDate, 'MMM dd, yyyy')}` : isBorrowedOutsidePeriod ? `Cannot edit: Staff only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}` : 'Cannot edit: Staff member is lent out') : 'Click to edit'}
                                      >
                                        <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${cannotEdit
                                          ? 'bg-gray-100 text-gray-500'
                                          : editableShift.type === 'oncall'
                                            ? 'bg-orange-100 text-orange-800 border border-orange-200 shadow-sm'
                                            : 'bg-primary-100 text-primary-800 hover:bg-primary-200'
                                          }`}>
                                          {formatTime12Hour(editableShift.start)} - {formatTime12Hour(editableShift.end)}
                                        </div>
                                        {editableShift.type === 'oncall' && (
                                          <div className="text-[10px] text-orange-600 font-bold uppercase tracking-tight">
                                            BIGLAAN (On-Call)
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-500">
                                          {Math.round(
                                            ((new Date(`2000-01-01 ${editableShift.end}`) - new Date(`2000-01-01 ${editableShift.start}`)) / (1000 * 60 * 60)) * 10
                                          ) / 10}h
                                        </div>
                                        {cannotEdit ? (
                                          <div className="text-xs text-red-600 font-medium">
                                            {onLeave ? 'On Leave' : isBorrowedOutsidePeriod ? 'Outside lending period' : 'Lent out'}
                                          </div>
                                        ) : (
                                          <div className="text-xs text-primary-600 font-medium">
                                            Click to edit
                                          </div>
                                        )}
                                      </div>
                                      {!cannotEdit && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveShiftFromEditModal();
                                          }}
                                          onMouseEnter={() => {
                                            setSelectedStaff(member);
                                            setSelectedDay(dayKey);
                                            setSelectedDate(date);
                                          }}
                                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 hidden group-hover:flex"
                                          title="Remove shift"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                }

                                // Show Add button (disabled if lent out or borrowed outside period)
                                return (
                                  <button
                                    onClick={() => handleAddShift(member, dayKey, date)}
                                    disabled={cannotEdit}
                                    className={`w-full py-2 text-xs rounded transition-colors flex items-center justify-center gap-1 ${cannotEdit
                                      ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                                      : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                                      }`}
                                    title={cannotEdit ? (onLeave ? `Cannot add shift: Staff member is on leave from ${formatDate(leaveInfo.startDate, 'MMM dd, yyyy')} to ${formatDate(leaveInfo.endDate, 'MMM dd, yyyy')}` : isBorrowedOutsidePeriod ? `Cannot add shift: Staff only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}` : 'Cannot add shift: Staff member is lent out') : 'Add shift'}
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add
                                  </button>
                                );
                              })()
                            ) : (
                              // View Mode - Display existing shifts
                              (() => {
                                const memberId = member.id || member.uid;
                                const onLeave = date && isStaffOnLeave(memberId, date);
                                const leaveInfo = date && onLeave ? getLeaveInfoForDate(memberId, date) : null;

                                // Check if staff is lent out on this date (lent OUT FROM this branch)
                                const isLentOut = date && isStaffLentOut(memberId, date);
                                const lendingInfo = date && isLentOut ? lentOutData[memberId] : null;

                                // Show leave indicator if staff is on leave
                                if (onLeave && leaveInfo) {
                                  const leaveTypeLabels = {
                                    vacation: 'Vacation',
                                    sick: 'Sick',
                                    personal: 'Personal',
                                    emergency: 'Emergency',
                                    maternity: 'Maternity',
                                    paternity: 'Paternity',
                                    bereavement: 'Bereavement',
                                    undetermined: 'Undetermined'
                                  };
                                  return (
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-800">
                                        ON LEAVE
                                      </div>
                                      <div className="text-xs text-orange-600 font-medium">
                                        {leaveTypeLabels[leaveInfo.type] || 'Leave'}
                                      </div>
                                      {leaveInfo.status === 'pending' && (
                                        <div className="text-xs text-yellow-600">
                                          (Pending)
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // Show lent out indicator if staff is lent out
                                if (isLentOut && lendingInfo) {
                                  return (
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-800">
                                        LENT OUT
                                      </div>
                                      <div className="text-xs text-blue-600 font-medium text-center">
                                        To {lendingInfo.toBranchName}
                                      </div>
                                    </div>
                                  );
                                }

                                // Show shift if exists
                                return shift ? (
                                  <div
                                    className="flex flex-col items-center gap-1 group relative"
                                  >
                                    {shift.isLending ? (
                                      <>
                                        <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${shift.isLentToBranch
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-purple-100 text-purple-800'
                                          }`}>
                                          LENDING
                                        </div>
                                        {shift.lendingBranch && (
                                          <div className={`text-xs font-medium ${shift.isLentToBranch
                                            ? 'text-blue-600'
                                            : 'text-purple-600'
                                            }`}>
                                            {shift.isLentToBranch ? 'From: ' : 'To: '}{shift.lendingBranch}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <div
                                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${shift.type === 'oncall'
                                            ? 'bg-orange-100 text-orange-800 border border-orange-200 shadow-sm'
                                            : isDateSpecific
                                              ? 'bg-blue-100 text-blue-800'
                                              : shift.isActive === false
                                                ? 'bg-gray-100 text-gray-500 line-through'
                                                : 'bg-primary-100 text-primary-800'
                                            }`}
                                        >
                                          {formatTime12Hour(shift.start)} - {formatTime12Hour(shift.end)}
                                        </div>
                                        {shift.type === 'oncall' && (
                                          <div className="text-[10px] text-orange-600 font-bold uppercase tracking-tight">
                                            BIGLAAN (On-Call)
                                          </div>
                                        )}
                                        {isDateSpecific && shift.type !== 'oncall' && (
                                          <div className="text-xs text-blue-600 font-medium">
                                            One-Time
                                          </div>
                                        )}
                                        {shift.isRecurring && shift.isActive === false && (
                                          <div className="text-xs font-medium text-gray-500 line-through">
                                            Inactive
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-500">
                                          {Math.round(
                                            ((new Date(`2000-01-01 ${shift.end}`) - new Date(`2000-01-01 ${shift.start}`)) / (1000 * 60 * 60)) * 10
                                          ) / 10}h
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-300">-</div>
                                );
                              })()
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Monthly Calendar View */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center font-semibold text-gray-700 py-2 text-sm">
                  {day}
                </div>
              ))}
              {/* Calendar dates */}
              {getMonthDates().map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isToday = date.toDateString() === new Date().toDateString();
                const dayKey = getDayKey(date);

                // Count staff with shifts on this day
                const staffWithShifts = staff.filter(member => {
                  const shift = getShiftForDay(member, dayKey, date);
                  return shift && shift.start && shift.end;
                });

                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (isCurrentMonth && staffWithShifts.length > 0) {
                        setSelectedDayDetails({ date, staff: staffWithShifts });
                        setShowDayDetailsModal(true);
                      }
                    }}
                    className={`min-h-[100px] border rounded-lg p-2 ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      } ${isToday ? 'ring-2 ring-primary-500' : ''
                      } ${isCurrentMonth && staffWithShifts.length > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                      }`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      } ${isToday ? 'text-primary-600' : ''
                      }`}>
                      {date.getDate()}
                    </div>
                    {isCurrentMonth && staffWithShifts.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-gray-600 font-medium">
                          {staffWithShifts.length} staff
                        </div>
                        {staffWithShifts.slice(0, 2).map(member => {
                          const shift = getShiftForDay(member, dayKey, date);
                          return (
                            <div
                              key={member.id}
                              className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded truncate"
                              title={`${getFullName(member)}: ${formatTime12Hour(shift.start)} - ${formatTime12Hour(shift.end)}`}
                            >
                              {getFullName(member).split(' ')[0]}
                            </div>
                          );
                        })}
                        {staffWithShifts.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{staffWithShifts.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Shift Modal - Full Page */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-full h-full max-w-full max-h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Add Shift</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select stylists and days, then set the time. This will create recurring shifts for all selected combinations.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowShiftModal(false);
                  setSelectedStaff(null);
                  setSelectedDay(null);
                  setSelectedDate(null);
                  setShiftForm({ start: '', end: '', date: '' });
                  setSelectedStaffIds([]);
                  setSelectedDays([]);
                  setStaffTimes({});
                  setStaffDays({});
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content - Full Height */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                  {/* Stylists with Individual Days and Times */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Configure Each Stylist's Shifts
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Select each stylist, choose their days, and set their times. Each stylist can have different days and times.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                      {staff.length === 0 ? (
                        <p className="text-gray-500 text-sm col-span-2">No staff members found</p>
                      ) : (
                        staff.map((member) => {
                          const memberId = member.id || member.uid;
                          if (!memberId) return null;
                          const isSelected = selectedStaffIds.includes(memberId);
                          const times = staffTimes[memberId] || { start: '', end: '' };
                          const days = staffDays[memberId] || [];

                          return (
                            <div
                              key={memberId}
                              className={`p-5 rounded-lg transition-colors ${isSelected
                                ? 'bg-primary-50 border-2 border-primary-500'
                                : 'bg-white border-2 border-gray-200'
                                }`}
                            >
                              {/* Stylist Selection */}
                              <label className="flex items-center gap-3 cursor-pointer mb-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStaffIds([...selectedStaffIds, memberId]);
                                      // Initialize times and days if not set
                                      if (!staffTimes[memberId]) {
                                        setStaffTimes(prev => ({
                                          ...prev,
                                          [memberId]: { start: '', end: '' }
                                        }));
                                      }
                                      if (!staffDays[memberId]) {
                                        setStaffDays(prev => ({
                                          ...prev,
                                          [memberId]: []
                                        }));
                                      }
                                    } else {
                                      setSelectedStaffIds(selectedStaffIds.filter(id => id !== memberId));
                                    }
                                  }}
                                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                                    {getInitials(member)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-medium text-gray-900">
                                      {getFullName(member)}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                  </div>
                                </div>
                              </label>

                              {isSelected && (
                                <div className="mt-4 pt-4 border-t border-gray-300 space-y-4">
                                  {/* Days Selection for this Stylist */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                      Select Days for {getFullName(member)} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                                      {DAYS_OF_WEEK.map((day) => {
                                        const isDaySelected = days.includes(day.key);
                                        return (
                                          <label
                                            key={day.key}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${isDaySelected
                                              ? 'bg-primary-100 border-2 border-primary-500'
                                              : 'bg-white border-2 border-gray-200 hover:border-primary-300'
                                              }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isDaySelected}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setStaffDays(prev => ({
                                                    ...prev,
                                                    [memberId]: [...(prev[memberId] || []), day.key]
                                                  }));
                                                } else {
                                                  setStaffDays(prev => ({
                                                    ...prev,
                                                    [memberId]: (prev[memberId] || []).filter(d => d !== day.key)
                                                  }));
                                                }
                                              }}
                                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                            />
                                            <div className="text-center">
                                              <p className="text-xs font-medium text-gray-900">{day.short}</p>
                                              <p className="text-xs text-gray-500">{day.label}</p>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-2">
                                      <button
                                        onClick={() => {
                                          if (days.length === DAYS_OF_WEEK.length) {
                                            setStaffDays(prev => ({
                                              ...prev,
                                              [memberId]: []
                                            }));
                                          } else {
                                            setStaffDays(prev => ({
                                              ...prev,
                                              [memberId]: DAYS_OF_WEEK.map(d => d.key)
                                            }));
                                          }
                                        }}
                                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                      >
                                        {days.length === DAYS_OF_WEEK.length ? 'Deselect All Days' : 'Select All Days'}
                                      </button>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {days.length} of {DAYS_OF_WEEK.length} days selected
                                      </p>
                                    </div>
                                  </div>

                                  {/* Time Selection for this Stylist */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Start Time <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="time"
                                        value={times.start}
                                        onChange={(e) => {
                                          setStaffTimes(prev => ({
                                            ...prev,
                                            [memberId]: {
                                              ...prev[memberId],
                                              start: e.target.value
                                            }
                                          }));
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required={isSelected}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        End Time <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="time"
                                        value={times.end}
                                        onChange={(e) => {
                                          setStaffTimes(prev => ({
                                            ...prev,
                                            [memberId]: {
                                              ...prev[memberId],
                                              end: e.target.value
                                            }
                                          }));
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required={isSelected}
                                      />
                                    </div>
                                  </div>
                                  {times.start && times.end && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                                      <p className="text-xs text-blue-800">
                                        <strong>Duration:</strong>{' '}
                                        {(() => {
                                          const [startHour, startMin] = times.start.split(':').map(Number);
                                          const [endHour, endMin] = times.end.split(':').map(Number);
                                          const startMinutes = startHour * 60 + startMin;
                                          const endMinutes = endHour * 60 + endMin;
                                          const duration = (endMinutes - startMinutes) / 60;
                                          return `${duration.toFixed(1)} hours`;
                                        })()}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {selectedStaffIds.length > 0 && (
                  <div className="mt-6 max-w-4xl mx-auto">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800 mb-3">
                        <strong>Summary:</strong> Creating recurring shifts for{' '}
                        <strong>{selectedStaffIds.length}</strong> stylist{selectedStaffIds.length !== 1 ? 's' : ''}
                      </p>
                      <div className="mt-2 space-y-2">
                        {selectedStaffIds.map(staffId => {
                          const member = staff.find(s => (s.id || s.uid) === staffId);
                          const times = staffTimes[staffId] || { start: '', end: '' };
                          const days = staffDays[staffId] || [];
                          if (!times.start || !times.end || days.length === 0) return null;
                          const dayLabels = days.map(d => DAYS_OF_WEEK.find(day => day.key === d)?.short).join(', ');
                          return (
                            <div key={staffId} className="bg-white rounded p-2 border border-green-200">
                              <p className="text-xs text-green-800 font-medium">
                                ΓÇó {getFullName(member)}: {times.start} - {times.end} on {dayLabels} ({days.length} day{days.length !== 1 ? 's' : ''})
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {selectedStaffIds.some(id => {
                        const times = staffTimes[id];
                        const days = staffDays[id] || [];
                        return times?.start && times?.end && days.length > 0;
                      }) && (
                          <p className="text-xs text-green-700 mt-3">
                            Total: <strong>{selectedStaffIds.reduce((sum, id) => {
                              const days = staffDays[id] || [];
                              return sum + days.length;
                            }, 0)}</strong> shift{selectedStaffIds.reduce((sum, id) => {
                              const days = staffDays[id] || [];
                              return sum + days.length;
                            }, 0) !== 1 ? 's' : ''} will be created
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  <p>ΓÜá∩╕Å This will create recurring shifts that automatically appear every week.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowShiftModal(false);
                      setSelectedStaff(null);
                      setSelectedDay(null);
                      setSelectedDate(null);
                      setShiftForm({ start: '', end: '', date: '' });
                      setSelectedStaffIds([]);
                      setSelectedDays([]);
                      setStaffTimes({});
                      setStaffDays({});
                    }}
                    className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBulkShiftsFromModal}
                    disabled={saving || selectedStaffIds.length === 0 || selectedStaffIds.some(id => {
                      const times = staffTimes[id];
                      const days = staffDays[id] || [];
                      return !times || !times.start || !times.end || days.length === 0;
                    })}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {saving ? 'Saving...' : (() => {
                      const totalShifts = selectedStaffIds.reduce((sum, id) => {
                        const days = staffDays[id] || [];
                        return sum + days.length;
                      }, 0);
                      return `Save ${totalShifts} Shift${totalShifts !== 1 ? 's' : ''}`;
                    })()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift History Modal */}
      {showHistoryModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Shift History</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {getFullName(selectedStaff)} - All shift changes over time
                </p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedStaff(null);
                  setShiftHistory([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={loadingHistory}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : shiftHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No shift history found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shiftHistory.map((config) => (
                    <div
                      key={config.id}
                      className={`border rounded-lg p-4 ${config.isActive
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${config.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                              }`}>
                              {config.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Recurring Configuration
                            </span>
                          </div>

                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Start Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {config.startDate?.toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) || 'N/A'}
                            </p>
                            {config.endDate && (
                              <>
                                <p className="text-xs text-gray-500 mb-1 mt-2">End Date</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {config.endDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                              </>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                            {DAYS_OF_WEEK.map((day) => {
                              const dayKey = day.key;
                              const shift = config.shifts?.[dayKey];
                              return (
                                <div key={dayKey} className="border rounded p-2">
                                  <p className="text-xs font-medium text-gray-700 mb-1">{day.label}</p>
                                  {shift && shift.start && shift.end ? (
                                    <p className="text-sm text-gray-900">
                                      {formatTime12Hour(shift.start)} - {formatTime12Hour(shift.end)}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-400">No shift</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Created: {config.createdAt?.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) || 'N/A'}
                            </p>
                          </div>

                          {config.endDate && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-500">
                                Ended: {config.endDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Configure All Shifts Modal */}
      {showBulkConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Configure All Staff Shifts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Set recurring shifts for all staff members at once. This will create a new shift configuration.
                </p>
              </div>
              <button
                onClick={() => setShowBulkConfigModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Start Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Start Date *
                </label>
                <input
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  required
                  min={(() => {
                    const weekStart = new Date(currentWeek);
                    weekStart.setHours(0, 0, 0, 0);
                    return weekStart.toISOString().split('T')[0];
                  })()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This date marks when this shift configuration starts. All shifts will be recurring until a new configuration is created.
                </p>
              </div>

              {/* Staff Shifts Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                        Staff Member
                      </th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.key} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[140px]">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staff.map((member) => {
                      const memberId = member.id || member.uid;
                      if (!memberId) return null;

                      return (
                        <tr key={memberId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {getInitials(member)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {getFullName(member)}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          {DAYS_OF_WEEK.map(day => {
                            const shift = bulkShifts[memberId]?.[day.key] || { start: '', end: '' };
                            return (
                              <td key={day.key} className="px-3 py-3 border-r border-gray-100">
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Start</label>
                                    <input
                                      type="time"
                                      value={shift.start}
                                      onChange={(e) => {
                                        setBulkShifts(prev => ({
                                          ...prev,
                                          [memberId]: {
                                            ...(prev[memberId] || {}),
                                            [day.key]: {
                                              ...shift,
                                              start: e.target.value
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">End</label>
                                    <input
                                      type="time"
                                      value={shift.end}
                                      onChange={(e) => {
                                        setBulkShifts(prev => ({
                                          ...prev,
                                          [memberId]: {
                                            ...(prev[memberId] || {}),
                                            [day.key]: {
                                              ...shift,
                                              end: e.target.value
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                                    />
                                  </div>
                                  {shift.start && shift.end && (
                                    <button
                                      onClick={() => {
                                        setBulkShifts(prev => ({
                                          ...prev,
                                          [memberId]: {
                                            ...(prev[memberId] || {}),
                                            [day.key]: { start: '', end: '' }
                                          }
                                        }));
                                      }}
                                      className="text-xs text-red-600 hover:text-red-800"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {staff.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No staff members found</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <p>ΓÜá∩╕Å This will create a new shift configuration. The current active configuration will be marked as inactive.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkConfigModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBulkShifts}
                  disabled={saving || !bulkStartDate}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save All Shifts'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Edit/Add Shift Modal */}
      {showEditShiftModal && selectedStaff && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isAddingShift ? 'Add Shift' : 'Edit Shift'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedStaff && getFullName(selectedStaff)} - {DAYS_OF_WEEK.find(d => d.key === selectedDay)?.label}
                  {selectedDate && ` (${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditShiftModal(false);
                  setSelectedStaff(null);
                  setSelectedDay(null);
                  setSelectedDate(null);
                  setShiftForm({ start: '', end: '', date: '' });
                  setIsAddingShift(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={shiftForm.start}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setShiftForm(prev => ({
                        ...prev,
                        start: newStart,
                        // Clear end time if it's before or equal to new start
                        end: prev.end && newStart >= prev.end ? '' : prev.end
                      }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={shiftForm.end}
                    onChange={(e) => setShiftForm(prev => ({ ...prev, end: e.target.value }))}
                    min={shiftForm.start || undefined}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                    disabled={!shiftForm.start}
                    required
                  />
                </div>
              </div>

              {/* Shift Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Shift Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShiftForm(prev => ({ ...prev, type: 'regular' }))}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${shiftForm.type === 'regular'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    <Clock className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-sm font-bold leading-none">Regular</p>
                      <p className="text-[10px] opacity-70 mt-1">Recurring weekly</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftForm(prev => ({ ...prev, type: 'oncall' }))}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${shiftForm.type === 'oncall'
                      ? 'border-orange-600 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-sm font-bold leading-none">On-Call</p>
                      <p className="text-[10px] opacity-70 mt-1">BIGLAAN (One-time)</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Branch Hours Info */}
              {branchHours && branchHours[selectedDay] && branchHours[selectedDay].isOpen && (
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  Branch hours: {formatTime12Hour(branchHours[selectedDay].open)} - {formatTime12Hour(branchHours[selectedDay].close)}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200">
              <div>
                {!isAddingShift && (
                  <button
                    onClick={handleRemoveShiftFromEditModal}
                    className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium"
                  >
                    Remove Shift
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowEditShiftModal(false);
                    setSelectedStaff(null);
                    setSelectedDay(null);
                    setSelectedDate(null);
                    setShiftForm({ start: '', end: '', date: '' });
                    setIsAddingShift(false);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveShift}
                  disabled={!shiftForm.start || !shiftForm.end}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingShift ? 'Add Shift' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Bulk Shift Modal - Per Employee */}
      {showQuickBulkModal && quickBulkEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Quick Add Shifts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {getFullName(quickBulkEmployee)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowQuickBulkModal(false);
                  setQuickBulkEmployee(null);
                  setQuickBulkForm({ start: '', end: '', days: [] });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={quickBulkForm.start}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setQuickBulkForm(prev => ({
                        ...prev,
                        start: newStart,
                        end: prev.end && newStart >= prev.end ? '' : prev.end
                      }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={quickBulkForm.end}
                    onChange={(e) => setQuickBulkForm(prev => ({ ...prev, end: e.target.value }))}
                    min={quickBulkForm.start || undefined}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                    disabled={!quickBulkForm.start}
                    required
                  />
                </div>
              </div>

              {/* Day Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Days *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setQuickBulkForm(prev => ({
                          ...prev,
                          days: prev.days.includes(day.key)
                            ? prev.days.filter(d => d !== day.key)
                            : [...prev.days, day.key]
                        }));
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${quickBulkForm.days.includes(day.key)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {quickBulkForm.days.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {quickBulkForm.days.length} day{quickBulkForm.days.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {/* Preview */}
              {quickBulkForm.start && quickBulkForm.end && quickBulkForm.days.length > 0 && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary-900 mb-1">Preview:</p>
                  <p className="text-sm text-primary-700">
                    {formatTime12Hour(quickBulkForm.start)} - {formatTime12Hour(quickBulkForm.end)} on{' '}
                    {quickBulkForm.days.map(d => DAYS_OF_WEEK.find(day => day.key === d)?.short).join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowQuickBulkModal(false);
                  setQuickBulkEmployee(null);
                  setQuickBulkForm({ start: '', end: '', days: [] });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuickBulk}
                disabled={!quickBulkForm.start || !quickBulkForm.end || quickBulkForm.days.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Add {quickBulkForm.days.length > 0 ? `${quickBulkForm.days.length} Shift${quickBulkForm.days.length > 1 ? 's' : ''}` : 'Shifts'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Details Modal - Monthly View */}
      {showDayDetailsModal && selectedDayDetails.date && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedDayDetails.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedDayDetails.staff.length} staff member{selectedDayDetails.staff.length !== 1 ? 's' : ''} scheduled
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDayDetailsModal(false);
                  setSelectedDayDetails({ date: null, staff: [] });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {selectedDayDetails.staff.map(member => {
                  const dayKey = getDayKey(selectedDayDetails.date);
                  const shift = getShiftForDay(member, dayKey, selectedDayDetails.date);

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {getInitials(member)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {getFullName(member)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.role}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {formatTime12Hour(shift.start)} - {formatTime12Hour(shift.end)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {Math.round(
                            ((new Date(`2000-01-01 ${shift.end}`) - new Date(`2000-01-01 ${shift.start}`)) / (1000 * 60 * 60)) * 10
                          ) / 10}h
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDayDetailsModal(false);
                  setSelectedDayDetails({ date: null, staff: [] });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Component - Poppins, ink-friendly */}
      <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
          @media print {
            @page {
              size: letter landscape;
              margin: 0.3in 0.4in 1in 0.4in;
            }
            body {
              counter-reset: page 1;
            }
            * {
              color: #000 !important;
              background: transparent !important;
            }
          }
        `}</style>
        <div className="print-content" style={{
          fontFamily: "'Poppins', sans-serif",
          color: '#000',
          background: '#fff',
          padding: '0'
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: '16px',
            borderBottom: '2px solid #333',
            paddingBottom: '10px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              David Salon
            </div>
            <h1 style={{
              fontSize: '26px',
              fontWeight: 700,
              marginBottom: '8px',
              letterSpacing: '0.5px',
              margin: '0 0 8px 0'
            }}>
              WEEKLY SCHEDULE
            </h1>
            
            {/* Applied Filters Section - Center */}
            {(filters.roles.length > 0 || filters.shiftStatus !== 'all' || filters.availabilityStatus !== 'all' || searchTerm.trim()) && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '11px',
                display: 'inline-block'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Active Filters:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {searchTerm.trim() && (
                    <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '3px', border: '1px solid #ccc' }}>
                      Search: "{searchTerm}"
                    </span>
                  )}
                  {filters.roles.length > 0 && (
                    <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '3px', border: '1px solid #ccc' }}>
                      Roles: {filters.roles.map(role => {
                        const roleLabels = {
                          'branch-manager': 'Branch Manager',
                          'stylist': 'Stylist',
                          'receptionist': 'Receptionist',
                          'inventory': 'Inventory'
                        };
                        return roleLabels[role] || role;
                      }).join(', ')}
                    </span>
                  )}
                  {filters.shiftStatus !== 'all' && (
                    <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '3px', border: '1px solid #ccc' }}>
                      Shift Status: {filters.shiftStatus === 'withShifts' ? 'With Shifts' : 'Without Shifts'}
                    </span>
                  )}
                  {filters.availabilityStatus !== 'all' && (
                    <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '3px', border: '1px solid #ccc' }}>
                      Availability: {
                        filters.availabilityStatus === 'available' ? 'Available' :
                        filters.availabilityStatus === 'onLeave' ? 'On Leave' :
                        filters.availabilityStatus === 'lentOut' ? 'Lent Out' :
                        filters.availabilityStatus === 'lentIn' ? 'Lent In' : ''
                      }
                    </span>
                  )}
                  <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '3px', border: '1px solid #ccc' }}>
                    Branch: {branchInfo?.branchName || branchInfo?.name || 'Branch'}
                  </span>
                  <span style={{ background: '#fff', padding: '2px 8px', borderRadius: '3px', border: '1px solid #ccc' }}>
                    Week: {weekDates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #333',
            fontSize: '12px'
          }}>
            <thead>
              <tr>
                <th style={{
                  border: '1px solid #333',
                  padding: '10px 8px',
                  textAlign: 'center',
                  fontWeight: 700,
                  background: '#f0f0f0',
                  fontSize: '13px',
                  width: '40px'
                }}>
                  #
                </th>
                <th style={{
                  border: '1px solid #333',
                  padding: '10px 8px',
                  textAlign: 'left',
                  fontWeight: 700,
                  background: '#f0f0f0',
                  fontSize: '13px'
                }}>
                  STAFF
                </th>
                {weekDates.map((date, index) => {
                  const dayName = DAYS_OF_WEEK[index]?.label || '';
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <th key={index} style={{
                      border: '1px solid #333',
                      padding: '10px 8px',
                      textAlign: 'center',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      background: '#f0f0f0',
                      fontSize: '13px'
                    }}>
                      {dayName.toUpperCase()}<br />
                      <span style={{ fontSize: '11px', fontWeight: 400 }}>{dateStr}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffForPrint.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ border: '1px solid #333', padding: '12px 10px', textAlign: 'center', fontSize: '12px' }}>
                    No staff with schedules for this week.
                  </td>
                </tr>
              )}
              {staffForPrint.map((member, idx) => {
                const memberName = getFullName(member);
                const memberId = member.id || member.uid;

                return (
                  <tr key={memberId || idx} style={{
                    pageBreakInside: 'avoid',
                    background: idx % 2 === 0 ? '#fff' : '#fafafa'
                  }}>
                    <td style={{
                      border: '1px solid #333',
                      padding: '10px 8px',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}>
                      {idx + 1}
                    </td>
                    <td style={{
                      border: '1px solid #333',
                      padding: '10px 8px',
                      textAlign: 'left',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}>
                      {memberName}
                    </td>
                    {weekDates.map((date, dateIdx) => {
                      const dayKey = DAYS_OF_WEEK[dateIdx]?.key || '';

                      // Use the same getShiftForDay function as the display view
                      const shift = getShiftForDay(member, dayKey, date);

                      let cellContent = '-';
                      let cellStyle = {
                        border: '1px solid #333',
                        padding: '10px 8px',
                        textAlign: 'center',
                        fontSize: '12px'
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
                        cellStyle = { ...cellStyle, fontStyle: 'italic', whiteSpace: 'pre-line', fontSize: '11px' };
                      }
                      // Check if staff is lent out on this date (lent OUT FROM this branch)
                      else if (isStaffLentOut(memberId, date)) {
                        const lendingInfo = lentOutData[memberId];
                        cellContent = lendingInfo?.toBranchName ? `LENT OUT\nTo ${lendingInfo.toBranchName}` : 'LENT OUT';
                        cellStyle = { ...cellStyle, fontStyle: 'italic', whiteSpace: 'pre-line', fontSize: '11px' };
                      }
                      // Check for lending (staff lent OUT from this branch) - legacy check
                      else if (shift?.isLending) {
                        cellContent = 'LENT OUT';
                        cellStyle = { ...cellStyle, fontStyle: 'italic', fontSize: '11px' };
                      }
                      // Check if shift exists
                      else if (shift && shift.start && shift.end) {
                        cellContent = `${formatTime12Hour(shift.start)} - ${formatTime12Hour(shift.end)}`;
                        cellStyle = { ...cellStyle, fontWeight: 600 };
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
          
          {/* Footer with metadata and page number */}
          <div style={{
            position: 'fixed',
            bottom: '0.5cm',
            left: '1.5cm',
            right: '1.5cm',
            borderTop: '1px solid #333',
            paddingTop: '10px',
            fontSize: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div><strong>Generated by:</strong> {currentUser ? getFullName(currentUser) : 'Manager'}</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1, fontWeight: 600 }}>
              <span className="page-number-display"></span>
            </div>
            <div style={{ textAlign: 'right', flex: 1 }}>
              <div><strong>Generated on:</strong> {new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
            </div>
          </div>
        </div>
      </div>
    </div>


  );
};

export default StaffSchedule;

