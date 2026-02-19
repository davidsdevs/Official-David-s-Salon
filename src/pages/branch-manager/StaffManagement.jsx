/**
 * Staff Management Page - Branch Manager
 * Manage staff within their branch only
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Users as UsersIcon, Plus, Search, Edit, Power, Mail, Scissors, Calendar, ArrowRight, ArrowLeftRight, Printer, Download, Filter, X, Key, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { getUsersByBranch, toggleUserStatus, getUserById } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { getBranchServices } from '../../services/branchServicesService';
import { getActiveLendingForBranch, getActiveLendingFromBranch, getActiveLending } from '../../services/stylistLendingService';
import { getActiveSchedulesByEmployee } from '../../services/scheduleService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants';
import { formatDate, getFullName, getInitials } from '../../utils/helpers';
import { generatePrintableReport } from '../../utils/reportHelpers';
import BranchStaffFormModal from '../../components/branch/BranchStaffFormModal';
import StaffServicesCertificatesModal from '../../components/branch/StaffServicesCertificatesModal';
import ResetPasswordModal from '../../components/branch/ResetPasswordModal';
import StaffDetailPrint from '../../components/branch/StaffDetailPrint';
import LendStylistModal from '../../components/branch/LendStylistModal';
import StaffSchedule from './StaffSchedule';
import StaffLending from './StaffLending';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RoleBadges from '../../components/ui/RoleBadges';
import ConfirmModal from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';

const StaffManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Staff Management | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [lendingFilter, setLendingFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [branchServices, setBranchServices] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showServicesCertificatesModal, setShowServicesCertificatesModal] = useState(false);
  const [selectedStaffForConfig, setSelectedStaffForConfig] = useState(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedStaffForPasswordReset, setSelectedStaffForPasswordReset] = useState(null);
  const [showStaffDetailPrint, setShowStaffDetailPrint] = useState(false);
  const [selectedStaffForPrint, setSelectedStaffForPrint] = useState(null);
  const [branchName, setBranchName] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [lentStaff, setLentStaff] = useState([]);
  const [lentOutStaff, setLentOutStaff] = useState({});
  const [branchCache, setBranchCache] = useState({});
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [staffToToggle, setStaffToToggle] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Fixed to 10 rows per page
  const [currentPage, setCurrentPage] = useState(1);
  const [scheduleEditTrigger, setScheduleEditTrigger] = useState(0); // Counter to trigger edit mode in StaffSchedule
  const [showRequestModal, setShowRequestModal] = useState(false); // For lending modal
  
  // Print refs
  const staffDetailPrintRef = useRef(); // For individual staff

  // Branch Manager can only manage these roles
  const MANAGEABLE_ROLES = [
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.STYLIST,
    USER_ROLES.INVENTORY_CONTROLLER
  ];

  useEffect(() => {
    if (userBranch) {
      fetchBranchDetails();
      fetchStaff();
      fetchBranchServicesData();
    }
  }, [userBranch]);

  // Fetch lending data after staff is loaded
  useEffect(() => {
    if (userBranch && staff.length > 0) {
      fetchLendingData();
    }
  }, [userBranch, staff.length]);

  // Fetch lending data - staff lent TO this branch and staff FROM this branch lent out
  const fetchLendingData = async () => {
    if (!userBranch) return;
    
    try {
      const today = new Date();
      
      // Get staff currently lent TO this branch (from other branches)
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsTo = await getActiveLendingForBranch(userBranch, null);
      
      console.log('Fetched active lendings TO this branch:', {
        branchId: userBranch,
        count: activeLendingsTo.length,
        lendings: activeLendingsTo
      });
      
      // Fetch the actual staff data for lent staff
      const lentStaffData = await Promise.all(
        activeLendingsTo.map(async (lending) => {
          try {
            const staffMember = await getUserById(lending.stylistId);
            const fromBranch = await getBranchById(lending.fromBranchId);
            
            // Check if staff member has any manageable role
            const userRoles = staffMember.roles || (staffMember.role ? [staffMember.role] : []);
            const hasManageableRole = userRoles.some(role => MANAGEABLE_ROLES.includes(role));
            
            console.log('Fetched lent staff member:', {
              staffId: lending.stylistId,
              staffName: getFullName(staffMember),
              fromBranch: fromBranch?.branchName || fromBranch?.name,
              roles: userRoles,
              hasManageableRole
            });
            
            // Only include if they have a manageable role (same as regular staff)
            if (!hasManageableRole) {
              console.log('Skipping lent staff member - no manageable role:', getFullName(staffMember));
              return null;
            }
            
            return {
              ...staffMember,
              isLent: true,
              lentFromBranch: fromBranch?.branchName || fromBranch?.name || 'Unknown Branch',
              lentFromBranchId: lending.fromBranchId,
              lendingStartDate: lending.startDate,
              lendingEndDate: lending.endDate
            };
          } catch (error) {
            console.error('Error fetching lent staff:', error);
            return null;
          }
        })
      );
      
      const validLentStaff = lentStaffData.filter(s => s !== null);
      console.log('Setting lent staff:', validLentStaff.length, validLentStaff);
      setLentStaff(validLentStaff);
      
      // Get staff FROM this branch that are lent out
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsFrom = await getActiveLendingFromBranch(userBranch, null);
      const lentOutMap = {};
      const branchIds = new Set();
      
      activeLendingsFrom.forEach(lending => {
        if (lending.stylistId) {
          branchIds.add(lending.toBranchId);
          const lendingInfo = {
            toBranchId: lending.toBranchId,
            startDate: lending.startDate,
            endDate: lending.endDate
          };
          
          // Store with stylistId (which is typically the Firebase Auth UID)
          lentOutMap[lending.stylistId] = lendingInfo;
          
          // Also try to find the staff member and store with their document ID if different
          // This ensures we can match regardless of which ID is used
          const staffMember = staff.find(s => {
            const sId = s.id || s.uid;
            const sUid = s.uid || s.id;
            return sId === lending.stylistId || sUid === lending.stylistId;
          });
          
          if (staffMember) {
            const docId = staffMember.id;
            const authUid = staffMember.uid;
            // Store with document ID if it exists and is different from stylistId
            if (docId && docId !== lending.stylistId) {
              lentOutMap[docId] = lendingInfo;
            }
            // Store with uid if it exists and is different from stylistId and docId
            if (authUid && authUid !== lending.stylistId && authUid !== docId) {
              lentOutMap[authUid] = lendingInfo;
            }
          }
        }
      });
      
      // Fetch branch names
      const branchPromises = Array.from(branchIds).map(async (id) => {
        if (!branchCache[id]) {
          try {
            const branch = await getBranchById(id);
            return { id, branch };
          } catch (error) {
            return { id, branch: null };
          }
        }
        return null;
      });
      
      const branchResults = await Promise.all(branchPromises);
      const newBranchCache = { ...branchCache };
      branchResults.forEach(result => {
        if (result && result.branch) {
          newBranchCache[result.id] = result.branch;
        }
      });
      setBranchCache(newBranchCache);
      
      // Update lentOutMap with branch names
      Object.keys(lentOutMap).forEach(staffId => {
        const branch = newBranchCache[lentOutMap[staffId].toBranchId];
        lentOutMap[staffId].toBranchName = branch?.branchName || branch?.name || 'Unknown Branch';
      });
      
      console.log('Lent out staff map:', lentOutMap);
      console.log('Active lendings from branch:', activeLendingsFrom);
      setLentOutStaff(lentOutMap);
    } catch (error) {
      console.error('Error fetching lending data:', error);
    }
  };

  const fetchBranchDetails = async () => {
    try {
      const branch = await getBranchById(userBranch);
      setBranchName(branch.name || branch.branchName);
    } catch (error) {
      console.error('Error fetching branch details:', error);
    }
  };

  // Fetch branch services for the service filter
  const fetchBranchServicesData = async () => {
    try {
      const services = await getBranchServices(userBranch);
      setBranchServices(services);
    } catch (error) {
      console.error('Error fetching branch services:', error);
    }
  };

  // Print handler - opens PDF preview immediately
  const handlePrint = async () => {
    // Build active filters array
    const filters = [];
    
    if (searchTerm) {
      filters.push(`Search: "${searchTerm}"`);
    }
    
    if (roleFilter !== 'all') {
      filters.push(`Role: ${ROLE_LABELS[roleFilter] || roleFilter}`);
    }
    
    if (statusFilter !== 'all') {
      filters.push(`Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`);
    }
    
    if (shiftFilter !== 'all') {
      const shiftLabel = shiftFilter === 'with-shifts' ? 'With Shifts' : 'No Shifts';
      filters.push(`Shifts: ${shiftLabel}`);
    }
    
    if (dateRangeFilter !== 'all') {
      const dateLabels = {
        'today': 'Today',
        'week': 'Last 7 Days',
        'month': 'Last 30 Days',
        'year': 'Last Year'
      };
      filters.push(`Joined: ${dateLabels[dateRangeFilter] || dateRangeFilter}`);
    }
    
    if (lendingFilter !== 'all') {
      const lendingLabels = {
        'lent-in': 'Lent In',
        'lent-out': 'Lent Out',
        'not-lent': 'Not Lent'
      };
      filters.push(`Lending: ${lendingLabels[lendingFilter] || lendingFilter}`);
    }
    
    if (serviceFilter !== 'all') {
      const service = branchServices.find(s => s.id === serviceFilter);
      if (service) {
        filters.push(`Service: ${service.name || service.serviceName}`);
      }
    }
    
    // Add summary filters
    filters.push(`Branch: ${branchName}`);
    filters.push(`Total Staff: ${filteredStaff.length}`);
    filters.push(`Active: ${filteredStaff.filter(s => s.isActive).length}`);
    filters.push(`Inactive: ${filteredStaff.filter(s => !s.isActive).length}`);
    
    // Build table content
    const tableRows = filteredStaff.map((member, index) => {
      const roles = member.roles || (member.role ? [member.role] : []);
      const shifts = member.shifts || {};
      const shiftCount = Object.keys(shifts).length;
      
      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td>${getFullName(member)}</td>
          <td>${member.email || 'N/A'}</td>
          <td>${member.phone || 'N/A'}</td>
          <td>${roles.map(role => ROLE_LABELS[role] || role).join(', ')}</td>
          <td>${member.isActive ? 'Active' : 'Inactive'}</td>
          <td>${shiftCount > 0 ? `${shiftCount} days` : 'None'}</td>
          <td>${member.createdAt ? formatDate(member.createdAt, 'MMM dd, yyyy') : 'N/A'}</td>
        </tr>
      `;
    }).join('');
    
    const content = `
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Roles</th>
            <th>Status</th>
            <th>Shifts</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
    
    const reportHTML = generatePrintableReport({
      title: 'Staff Data Report',
      filters: filters,
      content: content,
      currentUser: currentUser
    });
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Enhanced filtering with all filters
  const filteredStaff = useMemo(() => {
    const allStaff = [...staff, ...lentStaff];
    let filtered = [...allStaff];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(member => {
        const fullName = getFullName(member).toLowerCase();
        const email = member.email?.toLowerCase() || '';
        const phone = member.phone?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search) || phone.includes(search);
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(member => {
        const memberRoles = member.roles || (member.role ? [member.role] : []);
        return memberRoles.includes(roleFilter);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => {
        // Treat undefined/null as inactive (default behavior)
        // Explicitly check for true to be active, everything else is inactive
        if (statusFilter === 'active') {
          return member.isActive === true;
        }
        if (statusFilter === 'inactive') {
          // Include if explicitly false, undefined, or null
          return member.isActive === false || member.isActive === undefined || member.isActive === null;
        }
        return true;
      });
    }

    // Shift filter
    if (shiftFilter !== 'all') {
      filtered = filtered.filter(member => {
        const hasShifts = member.shifts && Object.keys(member.shifts).length > 0;
        if (shiftFilter === 'with-shifts') return hasShifts;
        if (shiftFilter === 'no-shifts') return !hasShifts;
        return true;
      });
    }

    // Date range filter
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(member => {
        if (!member.createdAt) return false;
        const createdDate = member.createdAt?.toDate ? member.createdAt.toDate() : new Date(member.createdAt);
        const diffTime = now - createdDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        switch (dateRangeFilter) {
          case 'today':
            return diffDays < 1;
          case 'week':
            return diffDays < 7;
          case 'month':
            return diffDays < 30;
          case 'year':
            return diffDays < 365;
          default:
            return true;
        }
      });
    }

    // Lending filter
    if (lendingFilter !== 'all') {
      filtered = filtered.filter(member => {
        const memberId = member.id || member.uid;
        const memberUid = member.uid || member.id;
        const isLentIn = member.isLent;
        // Check both id and uid in case they're stored differently
        const isLentOut = !!(lentOutStaff[memberId] || lentOutStaff[memberUid]);
        
        // Debug logging for lent-out filter
        if (lendingFilter === 'lent-out') {
          console.log('Checking member for lent-out:', {
            name: getFullName(member),
            memberId,
            memberUid,
            isLentOut,
            lentOutStaffKeys: Object.keys(lentOutStaff),
            matchById: !!lentOutStaff[memberId],
            matchByUid: !!lentOutStaff[memberUid]
          });
        }
        
        if (lendingFilter === 'lent-in') return isLentIn;
        if (lendingFilter === 'lent-out') return isLentOut;
        if (lendingFilter === 'not-lent') return !isLentIn && !isLentOut;
        return true;
      });
    }

    // Service filter - filter by services the staff can offer
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(member => {
        const memberServices = member.service_id || [];
        return memberServices.includes(serviceFilter);
      });
    }

    return filtered;
  }, [staff, lentStaff, searchTerm, roleFilter, statusFilter, shiftFilter, dateRangeFilter, lendingFilter, serviceFilter, lentOutStaff]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredStaff.length / itemsPerPage)), [filteredStaff.length, itemsPerPage]);
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStaff = useMemo(() => filteredStaff.slice(startIndex, endIndex), [filteredStaff, startIndex, endIndex]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const branchStaff = await getUsersByBranch(userBranch);
      // Filter to only show manageable roles
      const manageableStaff = branchStaff.filter(user => {
        // Check if user has any manageable role in their roles array
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.some(role => MANAGEABLE_ROLES.includes(role));
      });
      
      // Load shifts from schedules collection for each staff member
      const today = new Date();
      const staffWithSchedules = await Promise.all(
        manageableStaff.map(async (member) => {
          const memberId = member.id || member.uid;
          if (!memberId) return member;
          
          try {
            // Get active schedule configuration for today
            const { activeConfig } = await getActiveSchedulesByEmployee(memberId, userBranch, today);
            
            // Extract shifts from the active config
            const shifts = {};
            if (activeConfig && activeConfig.employeeShifts) {
              Object.entries(activeConfig.employeeShifts).forEach(([dayKey, shift]) => {
                if (shift && shift.start && shift.end) {
                  shifts[dayKey.toLowerCase()] = {
                    start: shift.start,
                    end: shift.end
                  };
                }
              });
            }
            
            return {
              ...member,
              shifts
            };
          } catch (error) {
            console.error(`Error loading schedules for ${memberId}:`, error);
            return { ...member, shifts: {} };
          }
        })
      );
      
      setStaff(staffWithSchedules);
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (!filteredStaff || filteredStaff.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = filteredStaff.map(member => {
      const roles = member.roles || (member.role ? [member.role] : []);
      const shifts = member.shifts || {};
      const shiftDays = Object.keys(shifts).map(day => {
        const shift = shifts[day];
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${shift.start}-${shift.end}`;
      }).join('; ');
      
      return {
        'Employee ID': member.id || member.uid || 'N/A',
        'First Name': member.firstName || '',
        'Middle Name': member.middleName || '',
        'Last Name': member.lastName || '',
        'Full Name': getFullName(member),
        'Email': member.email || '',
        'Phone': member.phone || '',
        'Roles': roles.map(r => ROLE_LABELS[r] || r).join('; '),
        'Status': member.isActive ? 'Active' : 'Inactive',
        'Shifts': shiftDays || 'No shifts assigned',
        'Date Joined': member.createdAt ? formatDate(member.createdAt) : 'N/A',
        'Branch': branchName,
        'Lent Status': member.isLent ? `Lent from ${member.lentFromBranch || 'Unknown'}` : (lentOutStaff[member.id || member.uid] ? `Lent to ${lentOutStaff[member.id || member.uid].toBranchName}` : 'Not lent')
      };
    });

    const csvHeaders = Object.keys(exportData[0] || {});
    const csvRows = [
      csvHeaders.join(','),
      ...exportData.map(row => {
        return csvHeaders.map(header => {
          const value = row[header] || '';
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        }).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const safeBranch = (branchName || 'Branch').replace(/[^a-z0-9]+/gi, '_');
    link.download = `Staff_Data_${safeBranch}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV file downloaded successfully');
  };

  const handleToggleStatus = (member, currentStatus) => {
    setStaffToToggle({ member, currentStatus });
    setShowDeactivateModal(true);
  };

  const confirmToggleStatus = async () => {
    if (!staffToToggle) return;
    
    try {
      await toggleUserStatus(staffToToggle.member.id, !staffToToggle.currentStatus, currentUser);
      await fetchStaff();
      setShowDeactivateModal(false);
      setStaffToToggle(null);
    } catch (error) {
      // Error handled in service
    }
  };

  const handleResetPassword = (member) => {
    setSelectedStaffForPasswordReset(member);
    setShowResetPasswordModal(true);
  };

  const handlePasswordResetSuccess = () => {
    // Refresh staff list after password reset
    fetchStaff();
  };

  const handleEditStaff = (member) => {
    setSelectedStaff(member);
    setShowStaffForm(true);
  };

  const handleStaffSaved = () => {
    setShowStaffForm(false);
    setSelectedStaff(null);
    fetchStaff();
  };

  const handleConfigureServices = (member) => {
    setSelectedStaffForConfig(member);
    setShowServicesCertificatesModal(true);
  };

  const handleViewServices = (member) => {
    // For lent staff, open in view-only mode with their original branch ID
    setSelectedStaffForConfig({ 
      ...member, 
      isLent: true,
      originalBranchId: member.lentFromBranchId || userBranch
    });
    setShowServicesCertificatesModal(true);
  };

  const handleServicesCertificatesSaved = () => {
    setShowServicesCertificatesModal(false);
    setSelectedStaffForConfig(null);
    fetchStaff();
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!userBranch) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">
          You need to be assigned to a branch to manage staff.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {activeTab === 'schedule' ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Staff Schedule</h1>
              <p className="text-gray-600 mt-1">Weekly view of staff shifts and availability</p>
            </>
          ) : activeTab === 'lending' ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Temporary Branch Assignment</h1>
              <p className="text-gray-600 mt-1">
                Manage temporary staff assignments between branches: <span className="font-semibold">{branchName || 'Loading...'}</span>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
              <p className="text-gray-600 mt-1">
                Manage staff members for branch: <span className="font-semibold">{branchName || 'Loading...'}</span>
              </p>
            </>
          )}
        </div>
        {activeTab === 'list' && (
          <button
            onClick={() => {
              setSelectedStaff(null);
              setShowStaffForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Staff
          </button>
        )}
        {activeTab === 'schedule' && (
          <button
            onClick={() => {
              setScheduleEditTrigger(prev => prev + 1);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Update Shift
          </button>
        )}
        {activeTab === 'lending' && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Request Help
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                Staff List
              </div>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'schedule'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Schedule
              </div>
            </button>
            <button
              onClick={() => setActiveTab('lending')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'lending'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                Lending
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' ? (
        <>
          {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{staff.length}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Staff</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {staff.filter(s => s.isActive).length}
              </p>
            </div>
            <Power className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Receptionists</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {staff.filter(s => {
                  const roles = s.roles || (s.role ? [s.role] : []);
                  return roles.includes(USER_ROLES.RECEPTIONIST);
                }).length}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stylists</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {staff.filter(s => {
                  const roles = s.roles || (s.role ? [s.role] : []);
                  return roles.includes(USER_ROLES.STYLIST);
                }).length}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
              (roleFilter !== 'all' || statusFilter !== 'all' || shiftFilter !== 'all' || dateRangeFilter !== 'all' || lendingFilter !== 'all')
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            title={`Filter - ${filteredStaff.length} staff`}
          >
            <Filter className="w-5 h-5" />
            {filteredStaff.length > 0 && (
              <span className="bg-primary-600 text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                {filteredStaff.length}
              </span>
            )}
          </button>

          {/* Action Buttons */}
          <button
            onClick={() => {
              if (!filteredStaff || filteredStaff.length === 0) {
                toast.error('No staff data to print');
                return;
              }
              handlePrint();
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Filter Staff</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                  {MANAGEABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
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
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Shift Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shifts
                </label>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="with-shifts">With Shifts</option>
                  <option value="no-shifts">No Shifts</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Joined Date
                </label>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="year">Last Year</option>
                </select>
              </div>

              {/* Lending Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lending Status
                </label>
                <select
                  value={lendingFilter}
                  onChange={(e) => setLendingFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="lent-in">Lent In</option>
                  <option value="lent-out">Lent Out</option>
                  <option value="not-lent">Not Lent</option>
                </select>
              </div>

              {/* Service Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Can Offer Service
                </label>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Services</option>
                  {branchServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name || service.serviceName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setShiftFilter('all');
                  setDateRangeFilter('all');
                  setLendingFilter('all');
                  setServiceFilter('all');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((member) => {
                  const memberId = member.id || member.uid;
                  const isLentToThisBranch = member.isLent; // Staff lent TO this branch
                  const isLentOut = lentOutStaff[memberId]; // Staff FROM this branch lent out
                  
                  return (
                  <tr key={memberId} className={`hover:bg-gray-50 ${isLentToThisBranch ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                          {(member.imageURL || member.photoURL) ? (
                            <img 
                              src={member.imageURL || member.photoURL} 
                              alt={getFullName(member)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const placeholder = e.target.parentElement.querySelector('.photo-initials');
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="photo-initials w-full h-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm" style={{ display: (member.imageURL || member.photoURL) ? 'none' : 'flex' }}>
                            {member.firstName?.[0]?.toUpperCase() || ''}{member.lastName?.[0]?.toUpperCase() || ''}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {getFullName(member)}
                            </div>
                            {isLentToThisBranch && (
                              <span className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                                (lent)
                              </span>
                            )}
                            {isLentOut && (
                              <span className="px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                Lent to {isLentOut.toBranchName}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                          {isLentToThisBranch && member.lentFromBranch && (
                            <div className="text-xs text-blue-600 mt-1">
                              From: {member.lentFromBranch}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadges user={member} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isLentToThisBranch ? (
                        // View-only actions for lent staff
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewServices(member)}
                            className="flex items-center justify-center w-9 h-9 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Services & Certificates (Read-only)"
                          >
                            <Scissors className="w-5 h-5" />
                          </button>
                          <span className="text-xs text-gray-400 italic">View only</span>
                        </div>
                      ) : (
                        // Full actions for regular staff
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditStaff(member)}
                            className="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Staff"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleConfigureServices(member)}
                            className="flex items-center justify-center w-9 h-9 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Configure Services & Certificates"
                          >
                            <Scissors className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(member)}
                            className="flex items-center justify-center w-9 h-9 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Reset Password"
                          >
                            <Key className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStaffForPrint(member);
                              setShowStaffDetailPrint(true);
                            }}
                            className="flex items-center justify-center w-9 h-9 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Print Staff Detail"
                          >
                            <Printer className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(member, member.isActive)}
                            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                              member.isActive 
                                ? 'text-red-600 hover:text-red-900 hover:bg-red-50' 
                                : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                            }`}
                            title={member.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredStaff.length > 0 && totalPages > 0 && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              {/* Top row: Items per page and page info */}
              <div className="flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value={10}>10</option>
                  </select>
                  <span className="text-xs text-gray-600">per page</span>
                </div>

                <div className="text-xs text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-gray-900">{Math.min(endIndex, filteredStaff.length)}</span> of{' '}
                  <span className="font-semibold text-gray-900">{filteredStaff.length.toLocaleString()}</span> staff
                </div>
              </div>

              {/* Bottom row: Navigation buttons */}
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {totalPages > 0 && (
                    <>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (safePage <= 3) {
                          pageNum = i + 1;
                        } else if (safePage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = safePage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1.5 text-xs min-w-[32px] rounded border transition-colors ${
                              safePage === pageNum
                                ? 'bg-primary-600 text-white border-primary-600 font-semibold'
                                : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {totalPages > 5 && (
                        <span className="px-2 text-xs text-gray-500">
                          ... of {totalPages}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Next page"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Last page"
                >
                  Last
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      ) : activeTab === 'schedule' ? (
        <StaffSchedule onEditTrigger={scheduleEditTrigger} />
      ) : (
        <StaffLending />
      )}

      {/* Modals */}
      {showStaffForm && (
        <BranchStaffFormModal
          staff={selectedStaff}
          branchId={userBranch}
          branchName={branchName}
          onClose={() => {
            setShowStaffForm(false);
            setSelectedStaff(null);
          }}
          onSave={handleStaffSaved}
        />
      )}

      {showServicesCertificatesModal && (
        <StaffServicesCertificatesModal
          isOpen={showServicesCertificatesModal}
          staff={selectedStaffForConfig}
          branchId={selectedStaffForConfig?.isLent ? (selectedStaffForConfig.originalBranchId || selectedStaffForConfig.lentFromBranchId) : userBranch}
          onClose={() => {
            setShowServicesCertificatesModal(false);
            setSelectedStaffForConfig(null);
          }}
          onSave={handleServicesCertificatesSaved}
          isReadOnly={selectedStaffForConfig?.isLent || false}
        />
      )}

      {showResetPasswordModal && selectedStaffForPasswordReset && (
        <ResetPasswordModal
          staff={selectedStaffForPasswordReset}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedStaffForPasswordReset(null);
          }}
          onSuccess={handlePasswordResetSuccess}
        />
      )}

      {showStaffDetailPrint && selectedStaffForPrint && (
        <StaffDetailPrint
          staff={selectedStaffForPrint}
          branchName={branchName}
          branchId={userBranch}
          onClose={() => {
            setShowStaffDetailPrint(false);
            setSelectedStaffForPrint(null);
          }}
        />
      )}

      {/* Deactivate/Activate Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => {
          setShowDeactivateModal(false);
          setStaffToToggle(null);
        }}
        onConfirm={confirmToggleStatus}
        title={staffToToggle?.currentStatus ? 'Deactivate Staff Member' : 'Activate Staff Member'}
        message={staffToToggle ? `Are you sure you want to ${staffToToggle.currentStatus ? 'deactivate' : 'activate'} ${getFullName(staffToToggle.member)}?` : ''}
        confirmText={staffToToggle?.currentStatus ? 'Deactivate' : 'Activate'}
        cancelText="Cancel"
        type={staffToToggle?.currentStatus ? 'danger' : 'success'}
      >
        {staffToToggle?.currentStatus && (
          <p className="text-sm text-red-600 mt-2 font-medium">
            This will prevent the staff member from accessing the system. They can be reactivated later.
          </p>
        )}
      </ConfirmModal>

      {/* Request Help Modal */}
      <LendStylistModal
        isOpen={showRequestModal}
        stylist={null}
        requestingBranchId={userBranch}
        onClose={() => setShowRequestModal(false)}
        onSave={() => {
          setShowRequestModal(false);
          // Optionally refresh lending data if needed
        }}
      />
    </div>
  );
};

export default StaffManagement;
