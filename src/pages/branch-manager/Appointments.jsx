/**
 * Appointments Overview Page - Branch Manager
 * For monitoring and analyzing branch appointments with comprehensive filtering, sorting, pagination, and reporting
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, TrendingUp, Users, Clock, CheckCircle, XCircle, AlertCircle, BarChart3, Printer, Search, Filter, ChevronUp, ChevronDown, X, ArrowUpDown, Download, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByBranch,
  getAppointmentStats,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { USER_ROLES } from '../../utils/constants';
import { getFullName, formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE_OPTIONS = [15, 25, 50, 100, 200];

const BranchManagerAppointments = () => {
  const { userBranch, userBranchData, currentUser, userData } = useAuth();
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Appointments | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stylistFilter, setStylistFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [dateFilterType, setDateFilterType] = useState('all'); // 'all', 'today', 'thisWeek', 'thisMonth', 'custom'
  
  // Sorting
  const [sortColumn, setSortColumn] = useState('appointmentDate');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // View appointment details
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);

  useEffect(() => {
    if (userBranch) {
      fetchData();
    }
  }, [userBranch]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, stylistFilter, serviceFilter, startDateFilter, endDateFilter, sortColumn, sortDirection]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch appointments
      const appointmentsData = await getAppointmentsByBranch(userBranch);
      
      // Fetch services, stylists, and clients for enrichment
      const servicesData = await getBranchServices(userBranch);
      
      const stylistsData = await getUsersByRole(USER_ROLES.STYLIST);
      const branchStylists = stylistsData.filter(s => s.branchId === userBranch);
      
      const clientsData = await getUsersByRole(USER_ROLES.CLIENT);
      
      setServices(servicesData);
      setStylists(branchStylists);
      
      // Enrich appointments
      const enrichedAppointments = appointmentsData.map(apt => {
        // Get client information
        const client = clientsData.find(c => c.id === apt.clientId);
        const clientName = client 
          ? `${client.firstName || ''} ${client.lastName || ''}`.trim() 
          : (apt.clientName || 'Unknown Client');
        
        // Handle multi-service appointments
        if (apt.services && apt.services.length > 0) {
          const enrichedServices = apt.services.map(svc => {
            const serviceData = servicesData.find(s => s.id === svc.serviceId);
            const stylist = branchStylists.find(st => st.id === svc.stylistId);
            return {
              ...svc,
              serviceName: svc.serviceName || serviceData?.name || 'Unknown Service',
              isChemical: serviceData?.isChemical || false,
              stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Unassigned'
            };
          });
          
          const totalAmount = enrichedServices.reduce((sum, svc) => sum + (svc.price || 0), 0);
          
          return {
            ...apt,
            services: enrichedServices,
            clientName: clientName,
            client: client ? {
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              phone: client.phone || client.phoneNumber
            } : apt.client || null,
            branchName: userBranchData?.name || userBranchData?.branchName || '',
            totalAmount: totalAmount
          };
        }
        
        // Handle single service appointments (backward compatibility)
        const service = servicesData.find(s => s.id === apt.serviceId);
        const stylist = branchStylists.find(s => s.id === apt.stylistId);
        return {
          ...apt,
          serviceName: service?.name || 'Unknown Service',
          isChemical: service?.isChemical || false,
          stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Unassigned',
          clientName: clientName,
          client: client ? {
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone || client.phoneNumber
          } : apt.client || null,
          branchName: userBranchData?.name || userBranchData?.branchName || '',
          totalAmount: apt.totalAmount || apt.price || 0
        };
      });
      
      // Set all appointments (no date range filtering by default)
      setAllAppointments(enrichedAppointments);
      
      // Calculate stats from all appointments
      const statsData = await getAppointmentStats(userBranch, null, null);
      setStats(statsData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch appointments data');
    } finally {
      setLoading(false);
    }
  };


  // Get unique values for filter dropdowns
  const uniqueServices = useMemo(() => {
    const serviceSet = new Set();
    allAppointments.forEach(apt => {
      if (apt.services && apt.services.length > 0) {
        apt.services.forEach(svc => {
          serviceSet.add(svc.serviceName || 'Unknown Service');
        });
      } else {
        serviceSet.add(apt.serviceName || 'Unknown Service');
      }
    });
    return Array.from(serviceSet).sort();
  }, [allAppointments]);

  const uniqueStylists = useMemo(() => {
    const stylistSet = new Set();
    allAppointments.forEach(apt => {
      if (apt.services && apt.services.length > 0) {
        apt.services.forEach(svc => {
          if (svc.stylistName) stylistSet.add(svc.stylistName);
        });
      } else {
        if (apt.stylistName) stylistSet.add(apt.stylistName);
      }
    });
    return Array.from(stylistSet).sort();
  }, [allAppointments]);

  // Filter and search appointments
  const filteredAppointments = useMemo(() => {
    return allAppointments.filter(apt => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesClient = apt.clientName?.toLowerCase().includes(searchLower);
        const matchesEmail = apt.client?.email?.toLowerCase().includes(searchLower);
        const matchesPhone = (apt.client?.phone || apt.client?.phoneNumber)?.toLowerCase().includes(searchLower);
        const matchesService = (apt.services && apt.services.length > 0) 
          ? apt.services.some(svc => svc.serviceName?.toLowerCase().includes(searchLower))
          : apt.serviceName?.toLowerCase().includes(searchLower);
        const matchesStylist = (apt.services && apt.services.length > 0)
          ? apt.services.some(svc => svc.stylistName?.toLowerCase().includes(searchLower))
          : apt.stylistName?.toLowerCase().includes(searchLower);
        
        if (!matchesClient && !matchesEmail && !matchesPhone && !matchesService && !matchesStylist) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && apt.status !== statusFilter) {
        return false;
      }

      // Stylist filter
      if (stylistFilter !== 'all') {
        const matchesStylist = (apt.services && apt.services.length > 0)
          ? apt.services.some(svc => svc.stylistName === stylistFilter)
          : apt.stylistName === stylistFilter;
        if (!matchesStylist) return false;
      }

      // Service filter
      if (serviceFilter !== 'all') {
        const matchesService = (apt.services && apt.services.length > 0)
          ? apt.services.some(svc => svc.serviceName === serviceFilter)
          : apt.serviceName === serviceFilter;
        if (!matchesService) return false;
      }

      // Date range filters
      if (startDateFilter) {
        const aptDate = apt.appointmentDate?.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        const filterDate = new Date(startDateFilter);
        filterDate.setHours(0, 0, 0, 0);
        if (aptDate < filterDate) return false;
      }

      if (endDateFilter) {
        const aptDate = apt.appointmentDate?.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        const filterDate = new Date(endDateFilter);
        filterDate.setHours(23, 59, 59, 999);
        if (aptDate > filterDate) return false;
      }

      return true;
    });
  }, [allAppointments, searchTerm, statusFilter, stylistFilter, serviceFilter, startDateFilter, endDateFilter]);

  // Sort appointments
  const sortedAppointments = useMemo(() => {
    const sorted = [...filteredAppointments];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumn) {
        case 'clientName':
          aValue = a.clientName || '';
          bValue = b.clientName || '';
          break;
        case 'appointmentDate':
          aValue = a.appointmentDate?.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate);
          bValue = b.appointmentDate?.toDate ? b.appointmentDate.toDate() : new Date(b.appointmentDate);
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'totalAmount':
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredAppointments, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedAppointments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAppointments = sortedAppointments.slice(startIndex, endIndex);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400 ml-1" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary-600 ml-1" />
      : <ChevronDown className="w-4 h-4 text-primary-600 ml-1" />;
  };

  // Helper function to get date range based on preset type
  const getDateRange = (type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (type) {
      case 'today':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      
      case 'thisWeek':
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        return {
          startDate: thisWeekStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };

      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          startDate: thisMonthStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      
      default:
        return { startDate: '', endDate: '' };
    }
  };

  // Handle date filter type change
  const handleDateFilterTypeChange = (type) => {
    setDateFilterType(type);
    if (type === 'all') {
      setStartDateFilter('');
      setEndDateFilter('');
    } else if (type !== 'custom') {
      const range = getDateRange(type);
      setStartDateFilter(range.startDate);
      setEndDateFilter(range.endDate);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStylistFilter('all');
    setServiceFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setDateFilterType('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || stylistFilter !== 'all' || 
    serviceFilter !== 'all' || startDateFilter || endDateFilter;

  // Calculate analytics
  const calculateAnalytics = () => {
    if (!filteredAppointments.length) return null;

    // Service popularity
    const serviceCount = {};
    filteredAppointments.forEach(apt => {
      if (apt.services && apt.services.length > 0) {
        apt.services.forEach(svc => {
          const serviceName = svc.serviceName || 'Unknown Service';
          serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
        });
      } else {
        const serviceName = apt.serviceName || 'Unknown Service';
        serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
      }
    });
    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Stylist performance
    const stylistCount = {};
    filteredAppointments.forEach(apt => {
      if (apt.services && apt.services.length > 0) {
        apt.services.forEach(svc => {
          if (svc.stylistId && svc.stylistName) {
            stylistCount[svc.stylistName] = (stylistCount[svc.stylistName] || 0) + 1;
          }
        });
      } else {
        if (apt.stylistId && apt.stylistName) {
          stylistCount[apt.stylistName] = (stylistCount[apt.stylistName] || 0) + 1;
        }
      }
    });
    const topStylists = Object.entries(stylistCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Hourly distribution
    const hourlyCount = {};
    filteredAppointments.forEach(apt => {
      const aptDate = apt.appointmentDate?.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
      const hour = aptDate.getHours();
      hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
    });
    const peakHours = Object.entries(hourlyCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => {
        const h = parseInt(hour);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${displayHour}:00 ${period}`;
      });

    // Completion rate
    const completed = filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length;
    const completionRate = filteredAppointments.length > 0 ? ((completed / filteredAppointments.length) * 100).toFixed(1) : 0;

    // Cancellation rate
    const cancelled = filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length;
    const cancellationRate = filteredAppointments.length > 0 ? ((cancelled / filteredAppointments.length) * 100).toFixed(1) : 0;

    // Total revenue
    const totalRevenue = filteredAppointments.reduce((sum, apt) => sum + (apt.totalAmount || 0), 0);

    return {
      topServices,
      topStylists,
      peakHours,
      completionRate,
      cancellationRate,
      totalRevenue
    };
  };

  const analytics = calculateAnalytics();

  const handleExportCSV = async () => {
    try {
      // Get branch name - try userBranchData first, then fetch from database if needed
      let branchName = userBranchData?.name || userBranchData?.branchName;

      if (!branchName && userBranch) {
        try {
          const branchData = await getBranchById(userBranch);
          branchName = branchData?.name || branchData?.branchName || userBranch;
        } catch (error) {
          console.warn('Could not fetch branch data:', error);
          branchName = userBranch;
        }
      }

      // Final fallback
      branchName = branchName || 'Branch';

      // Get exporter name
      const exporterName = currentUser && userData ? getFullName(userData) : (currentUser?.displayName || 'Manager');
      const sanitizedExporterName = exporterName.replace(/[^a-zA-Z0-9]/g, '_');

      // Get current date and time
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
      const readableDate = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).replace(/ /g, '_');

      // Sanitize branch name for filename
      const sanitizedBranchName = branchName.replace(/[^a-zA-Z0-9]/g, '_');

      // Build filter suffix for filename
      const filterParts = [];
      if (statusFilter !== 'all') filterParts.push(`status-${statusFilter}`);
      if (startDateFilter) filterParts.push(`from-${startDateFilter.replace(/-/g, '')}`);
      if (endDateFilter) filterParts.push(`to-${endDateFilter.replace(/-/g, '')}`);
      const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';

      // Generate formatted filename: Appointments_[Branch]_[Exporter]_[Date].csv
      const filename = `Appointments_${sanitizedBranchName}_${sanitizedExporterName}_${readableDate}${filterSuffix}.csv`;
      
      // CSV Headers
      const headers = [
        'Appointment ID',
        'Client Name',
        'Client Email',
        'Client Phone',
        'Date',
        'Time',
        'Services',
        'Stylists',
        'Status',
        'Total Amount (₱)',
        'Notes'
      ];
      
      // Format appointments data
      const csvRows = [headers.join(',')];
      
      sortedAppointments.forEach(apt => {
        const aptDate = apt.appointmentDate?.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        const formattedDate = formatDate(aptDate, 'MMM dd, yyyy');
        const formattedTime = formatTime(aptDate);
        
        // Get services list
        const servicesList = (apt.services && apt.services.length > 0)
          ? apt.services.map(svc => svc.serviceName || 'Unknown Service').join('; ')
          : apt.serviceName || 'N/A';
        
        // Get stylists list
        const stylistsList = (apt.services && apt.services.length > 0)
          ? [...new Set(apt.services.map(svc => svc.stylistName || 'Unassigned'))].join('; ')
          : apt.stylistName || 'Unassigned';
        
        // Escape values that contain commas
        const escapeCSV = (value) => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        const row = [
          escapeCSV(apt.id || ''),
          escapeCSV(apt.clientName || 'Unknown'),
          escapeCSV(apt.client?.email || ''),
          escapeCSV(apt.client?.phone || apt.client?.phoneNumber || ''),
          escapeCSV(formattedDate),
          escapeCSV(formattedTime),
          escapeCSV(servicesList),
          escapeCSV(stylistsList),
          escapeCSV(apt.status || 'pending'),
          escapeCSV((apt.totalAmount || 0).toFixed(2)),
          escapeCSV(apt.notes || '')
        ];
        
        csvRows.push(row.join(','));
      });
      
      // Create CSV content
      const csvContent = csvRows.join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${sortedAppointments.length} appointments to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV file');
    }
  };

  const handlePrintReport = async () => {
    try {
      // Get branch name - try userBranchData first, then fetch from database if needed
      let branchName = userBranchData?.name || userBranchData?.branchName;

      if (!branchName && userBranch) {
        try {
          const branchData = await getBranchById(userBranch);
          branchName = branchData?.name || branchData?.branchName || userBranch;
        } catch (error) {
          console.warn('Could not fetch branch data:', error);
          branchName = userBranch;
        }
      }

      // Final fallback
      branchName = branchName || 'Branch';

      const generatedAt = new Date().toLocaleString();

      // Calculate summary
      const totalAppointments = filteredAppointments.length;
      const completed = filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length;
      const cancelled = filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length;
      const pending = filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length;
      const confirmed = filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length;
      const totalRevenue = filteredAppointments.reduce((sum, apt) => sum + (apt.totalAmount || 0), 0);

      // Create print window
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the report');
        return;
      }

      // Generate appointment rows
      const appointmentRows = sortedAppointments.map(apt => {
        const aptDate = apt.appointmentDate?.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
        const dateStr = aptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = aptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const servicesList = (apt.services && apt.services.length > 0)
          ? apt.services.map(svc => svc.serviceName || 'Unknown Service').join(', ')
          : apt.serviceName || 'N/A';

        const stylistsList = (apt.services && apt.services.length > 0)
          ? [...new Set(apt.services.map(svc => svc.stylistName || 'Unassigned'))].join(', ')
          : apt.stylistName || 'Unassigned';

        // Enhanced status styling
        const status = apt.status || 'pending';
        const statusClass = `status-badge status-${status.toLowerCase().replace('_', '')}`;
        const statusText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace('_', ' ');

        return `
          <tr>
            <td style="font-weight: 600;">${apt.clientName || 'Unknown Client'}</td>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td style="max-width: 200px; word-wrap: break-word;">${servicesList}</td>
            <td>${stylistsList}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td style="font-weight: 600; text-align: right;">₱${(apt.totalAmount || 0).toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>David's Salon - Appointment Report - ${branchName}</title>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
            @media print {
              @page {
                size: A4;
                margin: 1.5cm;
              }
            }
            * {
              font-family: 'Poppins', sans-serif;
              box-sizing: border-box;
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 0;
              color: #000000;
              background: #fff;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 25px;
              border-bottom: 3px solid #000000;
              position: relative;
            }
            .header::after {
              content: '';
              position: absolute;
              bottom: -3px;
              left: 50%;
              transform: translateX(-50%);
              width: 100px;
              height: 3px;
              background: #000000;
            }
            .brand-section {
              margin-bottom: 20px;
            }
            .brand-title {
              font-family: 'Poppins', sans-serif;
              font-size: 32px;
              font-weight: 700;
              color: #000000;
              margin: 0;
              letter-spacing: 1px;
            }
            .brand-subtitle {
              font-family: 'Poppins', sans-serif;
              font-size: 14px;
              font-weight: 400;
              color: #000000;
              margin: 5px 0 0 0;
              letter-spacing: 0.5px;
            }
            .report-title {
              font-family: 'Poppins', sans-serif;
              font-size: 28px;
              font-weight: 700;
              color: #000000;
              margin: 20px 0 10px 0;
              letter-spacing: 0.5px;
            }
            .branch-name {
              font-family: 'Poppins', sans-serif;
              font-size: 18px;
              font-weight: 600;
              color: #000000;
              margin: 5px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header-meta {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              font-weight: 500;
              font-family: 'Poppins', sans-serif;
              color: #000000;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #000000;
            }
            .header-meta-left, .header-meta-right {
              flex: 1;
            }
            .header-meta-left {
              text-align: left;
            }
            .header-meta-right {
              text-align: right;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 20px;
              margin: 30px 0;
            }
            .summary-card {
              padding: 20px;
              background: #ffffff;
              border: 2px solid #000000;
              border-radius: 12px;
              text-align: center;
            }
            .summary-card .label {
              font-size: 12px;
              font-weight: 600;
              font-family: 'Poppins', sans-serif;
              color: #000000;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .summary-card .value {
              font-size: 24px;
              font-weight: 700;
              font-family: 'Poppins', sans-serif;
              color: #000000;
              margin: 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
              font-size: 12px;
              font-family: 'Poppins', sans-serif;
              border: 2px solid #000000;
              border-radius: 8px;
              overflow: hidden;
            }
            thead {
              background: #000000;
              color: white;
            }
            th {
              padding: 15px 12px;
              text-align: left;
              font-family: 'Poppins', sans-serif;
              font-weight: 600;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #000000;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #000000;
              font-family: 'Poppins', sans-serif;
              color: #000000;
            }
            tbody tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .status-badge {
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              background-color: #000000;
              color: white;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #000000;
              text-align: center;
              font-size: 11px;
              font-weight: 500;
              font-family: 'Poppins', sans-serif;
              color: #000000;
            }
            .footer p {
              margin: 8px 0;
              font-family: 'Poppins', sans-serif;
            }
            .footer .brand {
              font-family: 'Poppins', sans-serif;
              font-weight: 700;
              color: #000000;
              font-size: 14px;
            }
            @media print {
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand-section">
              <h1 class="brand-title">DAVID'S SALON</h1>
              <p class="brand-subtitle">Professional Beauty & Wellness Services</p>
            </div>
            <h2 class="report-title">Appointment Report</h2>
            <div class="branch-name">${branchName}</div>
            <div class="header-meta">
              <div class="header-meta-left">
                <div><strong>Generated by:</strong> ${currentUser && userData ? getFullName(userData) : (currentUser?.displayName || 'Manager')}</div>
              </div>
              <div class="header-meta-right">
                <div><strong>Generated:</strong> ${new Date().toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</div>
              </div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card total">
              <div class="label">Total Appointments</div>
              <div class="value">${totalAppointments}</div>
            </div>
            <div class="summary-card completed">
              <div class="label">Completed</div>
              <div class="value">${completed}</div>
            </div>
            <div class="summary-card cancelled">
              <div class="label">Cancelled</div>
              <div class="value">${cancelled}</div>
            </div>
            <div class="summary-card pending">
              <div class="label">Pending</div>
              <div class="value">${pending}</div>
            </div>
            <div class="summary-card confirmed">
              <div class="label">Confirmed</div>
              <div class="value">${confirmed}</div>
            </div>
            <div class="summary-card total">
              <div class="label">Total Revenue</div>
              <div class="value">₱${totalRevenue.toFixed(2)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Date</th>
                <th>Time</th>
                <th>Services</th>
                <th>Stylist</th>
                <th>Status</th>
                <th>Amount (₱)</th>
              </tr>
            </thead>
            <tbody>
              ${appointmentRows || '<tr><td colspan="7" style="text-align: center; padding: 40px; font-style: italic;">No appointments found</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <p class="brand">DAVID'S SALON</p>
            <p>Professional Beauty & Wellness Management System</p>
            <p>Report generated with ${totalAppointments} appointment record${totalAppointments !== 1 ? 's' : ''}</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 250);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Error generating print report:', error);
      toast.error('Failed to generate print report');
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments Overview</h1>
          <p className="text-gray-600">Monitor and analyze branch appointments</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Appointments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{filteredAppointments.length}</p>
                <p className="text-xs text-gray-500 mt-1">of {allAppointments.length} total</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  ₱{filteredAppointments.reduce((sum, apt) => sum + (apt.totalAmount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section - simplified single row */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-[240px] flex-1">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search client/service/stylist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="all">All Status</option>
            {Object.values(APPOINTMENT_STATUS).map(status => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={stylistFilter}
            onChange={(e) => setStylistFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="all">All Stylists</option>
            {uniqueStylists.map(stylist => (
              <option key={stylist} value={stylist}>{stylist}</option>
            ))}
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="all">All Services</option>
            {uniqueServices.map(service => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>

          <select
            value={dateFilterType}
            onChange={(e) => handleDateFilterTypeChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
          </select>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <span className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-full">
                Filters Active
              </span>
            )}
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Completion Rate</span>
                  <span className="text-sm font-semibold text-green-600">{analytics.completionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${analytics.completionRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Cancellation Rate</span>
                  <span className="text-sm font-semibold text-red-600">{analytics.cancellationRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full transition-all"
                    style={{ width: `${analytics.cancellationRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Peak Hours */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Peak Hours</h2>
            </div>
            <div className="space-y-3">
              {analytics.peakHours.length > 0 ? (
                analytics.peakHours.map((hour, index) => (
                  <div key={hour} className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-700">{hour}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appointments Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Appointments</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              {ITEMS_PER_PAGE_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('clientName')}
                >
                  <div className="flex items-center">
                    Client
                    <SortIcon column="clientName" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('appointmentDate')}
                >
                  <div className="flex items-center">
                    Date & Time
                    <SortIcon column="appointmentDate" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Services
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stylist
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon column="status" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalAmount')}
                >
                  <div className="flex items-center">
                    Total
                    <SortIcon column="totalAmount" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAppointments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No appointments found</p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                      >
                        Clear filters to see all appointments
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedAppointments.map((appointment) => {
                  const aptDate = appointment.appointmentDate?.toDate 
                    ? appointment.appointmentDate.toDate() 
                    : new Date(appointment.appointmentDate);
                  const dateStr = aptDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  });
                  const timeStr = aptDate.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  });
                  
                  // Get services list
                  let servicesList = [];
                  if (appointment.services && appointment.services.length > 0) {
                    servicesList = appointment.services.map(svc => svc.serviceName || 'Unknown Service');
                  } else {
                    servicesList = [appointment.serviceName || 'Unknown Service'];
                  }
                  
                  // Get stylists list
                  let stylistsList = [];
                  if (appointment.services && appointment.services.length > 0) {
                    stylistsList = appointment.services
                      .map(svc => svc.stylistName || 'Unassigned')
                      .filter((name, index, self) => self.indexOf(name) === index);
                  } else {
                    stylistsList = [appointment.stylistName || 'Unassigned'];
                  }
                  
                  const statusColors = {
                    [APPOINTMENT_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
                    [APPOINTMENT_STATUS.CONFIRMED]: 'bg-blue-100 text-blue-800',
                    [APPOINTMENT_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
                    [APPOINTMENT_STATUS.CANCELLED]: 'bg-red-100 text-red-800',
                    [APPOINTMENT_STATUS.NO_SHOW]: 'bg-gray-100 text-gray-800',
                    [APPOINTMENT_STATUS.IN_SERVICE]: 'bg-purple-100 text-purple-800'
                  };
                  
                  return (
                    <tr key={appointment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {appointment.clientName || 'Unknown Client'}
                          </div>
                          {appointment.client?.email && (
                            <div className="text-sm text-gray-500">{appointment.client.email}</div>
                          )}
                          {(appointment.client?.phone || appointment.client?.phoneNumber) && (
                            <div className="text-sm text-gray-500">{appointment.client.phone || appointment.client.phoneNumber}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{dateStr}</div>
                        <div className="text-sm text-gray-500">{timeStr}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {servicesList.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {servicesList.slice(0, 2).map((service, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs"
                                >
                                  {service}
                                </span>
                              ))}
                              {servicesList.length > 2 && (
                                <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">
                                  +{servicesList.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">No services</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {stylistsList.length > 0 ? (
                            <div className="space-y-1">
                              {stylistsList.map((stylist, idx) => (
                                <div key={idx}>{stylist}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          statusColors[appointment.status] || 'bg-gray-100 text-gray-800'
                        }`}>
                          {appointment.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ₱{(appointment.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setShowAppointmentDetails(true);
                          }}
                          className="text-primary-600 hover:text-primary-900 p-1 rounded hover:bg-primary-50 transition-colors"
                          title="View appointment details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {sortedAppointments.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, sortedAppointments.length)} of {sortedAppointments.length} appointments
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} / {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Appointment Details Modal */}
      {showAppointmentDetails && selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => {
            setShowAppointmentDetails(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
};

export default BranchManagerAppointments;
