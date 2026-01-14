import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

import { transactionApiService } from '../../services/transactionApiService';
import { appointmentApiService } from '../../services/appointmentApiService';
import { inventoryService } from '../../services/inventoryService';
import { getClientsByBranch } from '../../services/clientService';
import { getUsersByBranch } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Banknote,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
  PieChart,
  LineChart,
  FileText,
  RefreshCw,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ShoppingCart,
  Scissors,
  Building2,
  ArrowUpDown,
  Upload,
  FileSpreadsheet,
  Receipt
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';

const Reports = () => {
  const { userData } = useAuth();
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Salon_Reports_${format(new Date(), 'yyyy-MM-dd')}`,
  });

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Reports | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);

  // Date range states
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [reportType, setReportType] = useState(null); // null shows cards, otherwise shows specific report
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearlyView, setYearlyView] = useState(false);
  
  // Print modal states
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printTransactions, setPrintTransactions] = useState([]);
  const [printFilters, setPrintFilters] = useState({
    dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    transactionType: 'all', // 'all', 'service', 'product'
    status: 'paid', // 'all', 'paid', 'completed'
    viewType: 'period' // 'period', 'yearly'
  });

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [staffData, setStaffData] = useState([]);
  const [clientsData, setClientsData] = useState([]);
  const [branchInfo, setBranchInfo] = useState(null);

  // Load branch info once
  useEffect(() => {
    if (userData?.branchId && !branchInfo) {
      const loadBranchInfo = async () => {
        try {
          const branch = await getBranchById(
            userData.branchId,
            userData.roles?.[0] || 'branchManager',
            userData.uid
          );
          setBranchInfo(branch);
        } catch (err) {
          console.error('Error loading branch info:', err);
        }
      };
      loadBranchInfo();
    }
  }, [userData?.branchId]);

  // Load data only for the active report type
  useEffect(() => {
    if (userData?.branchId && reportType) {
      loadReportData();
    }
  }, [userData?.branchId, dateRange, reportType]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Revenue report doesn't load data automatically
      if (reportType === 'revenue') {
        setLoading(false);
        return;
      }

      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      // Only load data for the active report type
      switch (reportType) {
        case 'transactions':
          await loadTransactionsData(startDate, endDate);
          break;
        case 'appointments':
        case 'calendar':
          await loadAppointmentsData(startDate, endDate);
          break;
        case 'inventory':
          await loadInventoryData();
          break;
        case 'staff':
        case 'leave':
          await loadStaffData();
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error loading report data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionsData = async (startDate, endDate) => {
    // Load transactions with pagination, respecting the 10000 limit
    let allTransactions = [];
    let page = 1;
    let hasMore = true;
    const maxPages = 100; // Limit to 100 pages (100 * 100 = 10,000 max)
    
    while (hasMore && page <= maxPages) {
      const transactionsResult = await transactionApiService.getBranchTransactions(
        userData.branchId,
        userData.roles?.[0] || 'branchManager',
        {
          page,
          limit: 100,
          statusFilter: 'All'
        }
      );
      
      if (transactionsResult.success && transactionsResult.transactions) {
        // Filter by date range client-side
        const filtered = transactionsResult.transactions.filter(t => {
          if (!t.createdAt) return false;
          const transactionDate = t.createdAt?.toDate 
            ? t.createdAt.toDate() 
            : new Date(t.createdAt);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
        
        allTransactions.push(...filtered);
        hasMore = transactionsResult.hasMore && transactionsResult.transactions.length > 0;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    setTransactions(allTransactions);
  };

  const loadAppointmentsData = async (startDate, endDate) => {
    const appointmentsResult = await appointmentApiService.getAppointments(
      {
        branchId: userData.branchId,
        dateFrom: startDate,
        dateTo: endDate
      },
      'branchManager',
      userData.uid,
      1000 // Reduced from 10000 to 1000
    );
    setAppointments(appointmentsResult.appointments || []);
  };

  const loadInventoryData = async () => {
    const inventoryResult = await inventoryService.getInventoryStats(userData.branchId);
    if (inventoryResult.success) {
      const salesResult = await inventoryService.getInventorySales(
        userData.branchId,
        dateRange.start,
        dateRange.end
      );
      if (salesResult.success) {
        setInventoryData(salesResult.salesData || []);
      }
    }
  };

  const loadStaffData = async () => {
    try {
      const staff = await getUsersByBranch(userData.branchId);
      setStaffData(staff || []);
    } catch (err) {
      console.error('Error loading staff:', err);
    }
  };

  // Calculate filtered revenue stats for printing
  const calculateFilteredRevenueStats = (filters, transactionsToUse = null) => {
    // Use printTransactions if provided, otherwise use regular transactions
    const transactionsData = transactionsToUse || transactions;
    
    const startDate = new Date(filters.dateFrom);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(filters.dateTo);
    endDate.setHours(23, 59, 59, 999);

    // Filter transactions by date
    let filtered = transactionsData.filter(t => {
      if (!t.createdAt) return false;
      const transactionDate = t.createdAt?.toDate 
        ? t.createdAt.toDate() 
        : new Date(t.createdAt);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => {
        const status = (t.status || '').toLowerCase();
        return status === filters.status.toLowerCase();
      });
    }

    // Filter by transaction type
    if (filters.transactionType !== 'all') {
      filtered = filtered.filter(t => {
        const type = (t.transactionType || t.type || '').toLowerCase();
        return type === filters.transactionType.toLowerCase();
      });
    }

    const totalRevenue = filtered.reduce((sum, t) => 
      sum + (t.total || t.totalAmount || 0), 0
    );
    
    const serviceRevenue = filtered
      .filter(t => (t.transactionType || t.type || '').toLowerCase() === 'service')
      .reduce((sum, t) => sum + (t.total || t.totalAmount || 0), 0);
    
    const productRevenue = filtered
      .filter(t => (t.transactionType || t.type || '').toLowerCase() === 'product')
      .reduce((sum, t) => sum + (t.total || t.totalAmount || 0), 0);

    // Calculate yearly breakdown if yearly view
    const yearlyRevenue = {};
    if (filters.viewType === 'yearly') {
      filtered.forEach(t => {
        if (!t.createdAt) return;
        const transactionDate = t.createdAt?.toDate 
          ? t.createdAt.toDate() 
          : new Date(t.createdAt);
        const monthKey = format(transactionDate, 'yyyy-MM');
        const year = format(transactionDate, 'yyyy');
        
        if (!yearlyRevenue[year]) {
          yearlyRevenue[year] = {
            total: 0,
            service: 0,
            product: 0,
            months: {}
          };
        }
        
        const revenue = t.total || t.totalAmount || 0;
        yearlyRevenue[year].total += revenue;
        
        const isService = ((t.transactionType || t.type || '').toLowerCase() === 'service');
        if (isService) {
          yearlyRevenue[year].service += revenue;
        } else {
          yearlyRevenue[year].product += revenue;
        }
        
        if (!yearlyRevenue[year].months[monthKey]) {
          yearlyRevenue[year].months[monthKey] = {
            total: 0,
            service: 0,
            product: 0,
            monthName: format(transactionDate, 'MMMM yyyy')
          };
        }
        
        yearlyRevenue[year].months[monthKey].total += revenue;
        if (isService) {
          yearlyRevenue[year].months[monthKey].service += revenue;
        } else {
          yearlyRevenue[year].months[monthKey].product += revenue;
        }
      });
    }

    return {
      totalRevenue,
      serviceRevenue,
      productRevenue,
      totalTransactions: filtered.length,
      yearlyRevenue
    };
  };

  // Load transactions for printing based on filters
  const loadTransactionsForPrint = async (filters) => {
    try {
      setPrintLoading(true);
      const startDate = new Date(filters.dateFrom);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);

      // Load transactions with pagination
      let allTransactions = [];
      let page = 1;
      let hasMore = true;
      const maxPages = 100; // Limit to 100 pages (100 * 100 = 10,000 max)
      
      while (hasMore && page <= maxPages) {
        const transactionsResult = await transactionApiService.getBranchTransactions(
          userData.branchId,
          userData.roles?.[0] || 'branchManager',
          {
            page,
            limit: 100,
            statusFilter: 'All'
          }
        );
        
        if (transactionsResult.success && transactionsResult.transactions) {
          // Filter by date range client-side
          const filtered = transactionsResult.transactions.filter(t => {
            if (!t.createdAt) return false;
            const transactionDate = t.createdAt?.toDate 
              ? t.createdAt.toDate() 
              : new Date(t.createdAt);
            return transactionDate >= startDate && transactionDate <= endDate;
          });
          
          allTransactions.push(...filtered);
          hasMore = transactionsResult.hasMore && transactionsResult.transactions.length > 0;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      setPrintTransactions(allTransactions);
      return allTransactions;
    } catch (err) {
      console.error('Error loading transactions for print:', err);
      setError(err.message);
      return [];
    } finally {
      setPrintLoading(false);
    }
  };

  // Handle print with filters
  const handlePrintWithFilters = async () => {
    // Load data first based on filters
    await loadTransactionsForPrint(printFilters);
    
    // Close modal and print after data is loaded
    setShowPrintModal(false);
    
    // Small delay to ensure modal closes and data is set before printing
    setTimeout(() => {
      handlePrint();
    }, 200);
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    // Filter completed transactions - check multiple status formats
    const completedTransactions = transactions.filter(t => {
      const status = (t.status || '').toLowerCase();
      return status === 'paid' || status === 'completed' || status === 'Paid' || status === 'Completed';
    });
    
    const totalRevenue = completedTransactions.reduce((sum, t) => 
      sum + (t.total || t.totalAmount || 0), 0
    );
    
    const serviceRevenue = completedTransactions
      .filter(t => t.transactionType === 'service' || t.type === 'service')
      .reduce((sum, t) => sum + (t.total || t.totalAmount || 0), 0);
    
    const productRevenue = completedTransactions
      .filter(t => t.transactionType === 'product' || t.type === 'product')
      .reduce((sum, t) => sum + (t.total || t.totalAmount || 0), 0);
    
    const totalTransactions = completedTransactions.length;
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    const completedAppointments = appointments.filter(a => 
      a.status === 'completed' || a.status === 'confirmed'
    );
    
    const cancelledAppointments = appointments.filter(a => 
      a.status === 'cancelled'
    );
    
    const totalProductsSold = completedTransactions.reduce((sum, t) => {
      if (t.products && Array.isArray(t.products)) {
        return sum + t.products.reduce((pSum, p) => pSum + (p.quantity || 0), 0);
      }
      return sum;
    }, 0);

    // Calculate yearly revenue breakdown (by month)
    const yearlyRevenue = {};
    completedTransactions.forEach(t => {
      if (!t.createdAt) return;
      const transactionDate = t.createdAt?.toDate 
        ? t.createdAt.toDate() 
        : new Date(t.createdAt);
      const monthKey = format(transactionDate, 'yyyy-MM');
      const year = format(transactionDate, 'yyyy');
      
      if (!yearlyRevenue[year]) {
        yearlyRevenue[year] = {
          total: 0,
          service: 0,
          product: 0,
          months: {}
        };
      }
      
      const revenue = t.total || t.totalAmount || 0;
      yearlyRevenue[year].total += revenue;
      
      const isService = ((t.transactionType || t.type || '').toLowerCase() === 'service');
      if (isService) {
        yearlyRevenue[year].service += revenue;
      } else {
        yearlyRevenue[year].product += revenue;
      }
      
      if (!yearlyRevenue[year].months[monthKey]) {
        yearlyRevenue[year].months[monthKey] = {
          total: 0,
          service: 0,
          product: 0,
          monthName: format(transactionDate, 'MMMM yyyy')
        };
      }
      
      yearlyRevenue[year].months[monthKey].total += revenue;
      if (isService) {
        yearlyRevenue[year].months[monthKey].service += revenue;
      } else {
        yearlyRevenue[year].months[monthKey].product += revenue;
      }
    });

    return {
      totalRevenue,
      serviceRevenue,
      productRevenue,
      totalTransactions,
      avgTransactionValue,
      totalAppointments: appointments.length,
      completedAppointments: completedAppointments.length,
      cancelledAppointments: cancelledAppointments.length,
      totalProductsSold,
      activeStaff: staffData.filter(s => s.isActive !== false).length,
      totalClients: clientsData.length,
      yearlyRevenue
    };
  }, [transactions, appointments, staffData, clientsData]);

  // Export to CSV
  const exportToCSV = (data, filename, headers) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = [
      csvHeaders.join(','),
      ...data.map(row => {
        return csvHeaders.map(header => {
          const value = row[header] || '';
          // Escape quotes and wrap in quotes if contains comma
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
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export transactions
  const exportTransactions = () => {
    const completedTransactions = transactions.filter(t => 
      t.status === 'paid' || t.status === 'completed'
    );
    
    const exportData = completedTransactions.map(t => {
      const clientInfo = t.clientInfo || {};
      const services = t.services || [];
      const products = t.products || [];
      
      return {
        'Transaction ID': t.id || 'N/A',
        'Date': t.createdAt ? format(t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A',
        'Client Name': clientInfo.name || t.clientName || 'N/A',
        'Client Email': clientInfo.email || 'N/A',
        'Client Phone': clientInfo.phone || 'N/A',
        'Transaction Type': t.transactionType || t.type || 'N/A',
        'Services': services.map(s => s.serviceName || s.name || 'N/A').join('; '),
        'Products': products.map(p => `${p.name} (Qty: ${p.quantity})`).join('; '),
        'Subtotal': t.subtotal || 0,
        'Tax': t.tax || 0,
        'Discount': t.discount || 0,
        'Total': t.total || t.totalAmount || 0,
        'Payment Method': t.paymentMethod || 'N/A',
        'Status': t.status || 'N/A'
      };
    });

    exportToCSV(exportData, 'Transactions_Report', Object.keys(exportData[0] || {}));
  };

  // Export appointments
  const exportAppointments = () => {
    const exportData = appointments.map(a => {
      const services = a.serviceIds || [];
      const stylist = a.stylistId || 'Any Available';
      
      return {
        'Appointment ID': a.id || 'N/A',
        'Date': a.appointmentDate ? format(a.appointmentDate.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate), 'yyyy-MM-dd') : 'N/A',
        'Time': a.appointmentTime || 'N/A',
        'Client ID': a.clientId || 'N/A',
        'Services': services.join('; '),
        'Stylist': stylist,
        'Status': a.status || 'N/A',
        'Notes': a.notes || ''
      };
    });

    exportToCSV(exportData, 'Appointments_Report', Object.keys(exportData[0] || {}));
  };

  // Export inventory
  const exportInventory = () => {
    const exportData = inventoryData.map(item => ({
      'Product Name': item.productName || 'N/A',
      'Quantity Sold': item.quantitySold || 0,
      'Unit Cost': item.unitCost || 0,
      'Total Cost': (item.quantitySold || 0) * (item.unitCost || 0),
      'Revenue': item.totalRevenue || 0,
      'Profit': (item.totalRevenue || 0) - ((item.quantitySold || 0) * (item.unitCost || 0)),
      'Profit Margin': item.totalRevenue > 0 
        ? (((item.totalRevenue || 0) - ((item.quantitySold || 0) * (item.unitCost || 0))) / item.totalRevenue * 100).toFixed(2) + '%'
        : '0%'
    }));

    exportToCSV(exportData, 'Inventory_Report', Object.keys(exportData[0] || {}));
  };

  // Quick date range presets
  const setDateRangePreset = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = format(today, 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        start = format(startOfWeek(today), 'yyyy-MM-dd');
        end = format(endOfWeek(today), 'yyyy-MM-dd');
        break;
      case 'month':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      case 'last7days':
        start = format(subDays(today, 7), 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      case 'last30days':
        start = format(subDays(today, 30), 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      case 'year':
        start = format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd');
        end = format(new Date(today.getFullYear(), 11, 31), 'yyyy-MM-dd');
        break;
      default:
        return;
    }

    setDateRange({ start, end });
  };

  // Show loading only for reports that actually load data
  const shouldShowLoading = loading && reportType && reportType !== 'revenue';
  if (shouldShowLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600">Generate comprehensive reports for your branch operations</p>
      </div>


      {/* Report Cards Grid */}
      {!reportType || reportType === 'overview' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { 
              id: 'revenue', 
              label: 'Revenue Report', 
              description: 'View revenue breakdown by service and product',
              icon: Banknote,
              bgColor: 'bg-green-100',
              iconColor: 'text-green-600'
            },
            { 
              id: 'transactions', 
              label: 'Transaction Report', 
              description: 'Detailed transaction history and records',
              icon: Receipt,
              bgColor: 'bg-blue-100',
              iconColor: 'text-blue-600'
            },
            { 
              id: 'appointments', 
              label: 'Appointment Report', 
              description: 'Appointment schedules and status',
              icon: Calendar,
              bgColor: 'bg-purple-100',
              iconColor: 'text-purple-600'
            },
            { 
              id: 'inventory', 
              label: 'Inventory Sales Report', 
              description: 'Product sales, revenue, and profit analysis',
              icon: Package,
              bgColor: 'bg-orange-100',
              iconColor: 'text-orange-600'
            },
            { 
              id: 'staff', 
              label: 'Staff List Report', 
              description: 'Staff information and performance',
              icon: Users,
              bgColor: 'bg-teal-100',
              iconColor: 'text-teal-600'
            },
            { 
              id: 'calendar', 
              label: 'Calendar Report', 
              description: 'Schedule and calendar overview',
              icon: Calendar,
              bgColor: 'bg-indigo-100',
              iconColor: 'text-indigo-600'
            },
            { 
              id: 'leave', 
              label: 'Leave Management Report', 
              description: 'Staff leave requests and approvals',
              icon: Clock,
              bgColor: 'bg-pink-100',
              iconColor: 'text-pink-600'
            }
          ].map(report => (
            <Card 
              key={report.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setReportType(report.id)}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 ${report.bgColor} rounded-lg`}>
                    <report.icon className={`h-6 w-6 ${report.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {report.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {report.description}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Back Button */}
          <Button
            variant="outline"
            onClick={() => setReportType(null)}
            className="mb-4"
          >
            ← Back to Reports
          </Button>
        </div>
      )}

      {/* Print Content */}
      {reportType === 'revenue' && (
        <div ref={printRef} className="hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                {branchInfo?.name || 'Salon'} - Revenue Report
              </h1>
              <p className="text-gray-600 mt-2">
                {format(parseISO(printFilters.dateFrom), 'MMMM dd, yyyy')} - {format(parseISO(printFilters.dateTo), 'MMMM dd, yyyy')}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Generated on {format(new Date(), 'MMMM dd, yyyy HH:mm')}
              </p>
            </div>

            {/* Filter Information */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded">
              <h3 className="font-semibold text-gray-900 mb-2">Applied Filters:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Date Range: </span>
                  <span>{format(parseISO(printFilters.dateFrom), 'MMM dd, yyyy')} - {format(parseISO(printFilters.dateTo), 'MMM dd, yyyy')}</span>
                </div>
                <div>
                  <span className="font-medium">Transaction Type: </span>
                  <span className="capitalize">{printFilters.transactionType === 'all' ? 'All Types' : printFilters.transactionType}</span>
                </div>
                <div>
                  <span className="font-medium">Status: </span>
                  <span className="capitalize">{printFilters.status === 'all' ? 'All Statuses' : printFilters.status}</span>
                </div>
                <div>
                  <span className="font-medium">View Type: </span>
                  <span className="capitalize">{printFilters.viewType === 'yearly' ? 'Yearly Breakdown' : 'Period Summary'}</span>
                </div>
              </div>
            </div>

            {/* Revenue Stats */}
            {(() => {
              const filteredStats = calculateFilteredRevenueStats(printFilters, printTransactions);
              return (
                <>
                  {printFilters.viewType === 'period' ? (
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="border border-gray-300 p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">₱{filteredStats.totalRevenue.toLocaleString()}</p>
                      </div>
                      <div className="border border-gray-300 p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Service Revenue</p>
                        <p className="text-2xl font-bold text-blue-600">₱{filteredStats.serviceRevenue.toLocaleString()}</p>
                      </div>
                      <div className="border border-gray-300 p-4 text-center">
                        <p className="text-sm text-gray-600 mb-1">Product Revenue</p>
                        <p className="text-2xl font-bold text-purple-600">₱{filteredStats.productRevenue.toLocaleString()}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 mb-8">
                      {Object.keys(filteredStats.yearlyRevenue || {}).sort().reverse().map(year => {
                        const yearData = filteredStats.yearlyRevenue[year];
                        const months = Object.keys(yearData.months).sort();
                        return (
                          <div key={year} className="border border-gray-300 p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-bold text-gray-900">{year}</h3>
                              <div className="flex gap-4">
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Total</p>
                                  <p className="text-xl font-bold text-gray-900">₱{yearData.total.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Service</p>
                                  <p className="text-lg font-semibold text-blue-600">₱{yearData.service.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Product</p>
                                  <p className="text-lg font-semibold text-purple-600">₱{yearData.product.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-4">
                              {months.map(monthKey => {
                                const monthData = yearData.months[monthKey];
                                return (
                                  <div key={monthKey} className="border border-gray-200 p-3">
                                    <p className="font-semibold text-gray-900 mb-2">{monthData.monthName}</p>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Total:</span>
                                        <span className="font-semibold">₱{monthData.total.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Service:</span>
                                        <span className="font-semibold text-blue-600">₱{monthData.service.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Product:</span>
                                        <span className="font-semibold text-purple-600">₱{monthData.product.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-4 text-sm text-gray-600">
                    Total Transactions: {filteredStats.totalTransactions}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}


      {/* Revenue Report */}
      {reportType === 'revenue' && (
        <Card>
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Revenue Report</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setYearlyView(!yearlyView)}
                >
                  {yearlyView ? 'Period View' : 'Yearly View'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPrintModal(true)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={exportTransactions}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6">
              
            {!yearlyView ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    ₱{summaryStats.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Service Revenue</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    ₱{summaryStats.serviceRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Product Revenue</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    ₱{summaryStats.productRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(summaryStats.yearlyRevenue || {}).sort().reverse().map(year => {
                  const yearData = summaryStats.yearlyRevenue[year];
                  const months = Object.keys(yearData.months).sort();
                    
                  return (
                    <div key={year} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">{year}</h3>
                        <div className="flex gap-4">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-xl font-bold text-gray-900">
                              ₱{yearData.total.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Service</p>
                            <p className="text-lg font-semibold text-blue-600">
                              ₱{yearData.service.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Product</p>
                            <p className="text-lg font-semibold text-purple-600">
                              ₱{yearData.product.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                        
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {months.map(monthKey => {
                          const monthData = yearData.months[monthKey];
                          return (
                            <div key={monthKey} className="border border-gray-200 rounded-lg p-4">
                              <p className="font-semibold text-gray-900 mb-2">{monthData.monthName}</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-600">Total:</span>
                                  <span className="text-sm font-semibold text-gray-900">
                                    ₱{monthData.total.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-600">Service:</span>
                                  <span className="text-sm font-semibold text-blue-600">
                                    ₱{monthData.service.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-600">Product:</span>
                                  <span className="text-sm font-semibold text-purple-600">
                                    ₱{monthData.product.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                  
                {Object.keys(summaryStats.yearlyRevenue || {}).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No revenue data available for the selected period
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Transactions Report */}
      {reportType === 'transactions' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Transaction Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={exportTransactions}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions
                  .filter(t => t.status === 'paid' || t.status === 'completed')
                  .slice(0, 100)
                  .map(transaction => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.createdAt 
                          ? format(transaction.createdAt.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')
                          : 'N/A'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.id || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.clientInfo?.name || transaction.clientName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.transactionType || transaction.type || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ₱{(transaction.total || transaction.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.status === 'paid' || transaction.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Appointments Report */}
      {reportType === 'appointments' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Appointment Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={exportAppointments}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Services
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointments.slice(0, 100).map(appointment => (
                  <tr key={appointment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.appointmentDate 
                        ? format(appointment.appointmentDate.toDate ? appointment.appointmentDate.toDate() : new Date(appointment.appointmentDate), 'MMM dd, yyyy')
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.appointmentTime || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.clientId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(appointment.serviceIds || []).join(', ') || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        appointment.status === 'completed' || appointment.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : appointment.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {appointment.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Inventory Report */}
      {reportType === 'inventory' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Inventory Sales Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={exportInventory}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity Sold
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventoryData.slice(0, 100).map((item, index) => {
                  const profit = (item.totalRevenue || 0) - ((item.quantitySold || 0) * (item.unitCost || 0));
                  const margin = (item.totalRevenue || 0) > 0 
                    ? (profit / item.totalRevenue) * 100 
                    : 0;
                  return (
                    <tr key={item.productId || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.productName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantitySold || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₱{(item.totalRevenue || 0).toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ₱{profit.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        margin >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Staff Report */}
      {reportType === 'staff' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Staff List Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportToCSV(
                    staffData.map(s => ({
                      'Name': `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'N/A',
                      'Role': s.roles?.[0] || s.role || 'N/A',
                      'Email': s.email || 'N/A',
                      'Phone': s.phone || 'N/A',
                      'Status': s.isActive !== false ? 'Active' : 'Inactive'
                    })),
                    'Staff_Report'
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffData.map(staff => (
                  <tr key={staff.uid || staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {`${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.roles?.[0] || staff.role || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.phone || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        staff.isActive !== false
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {staff.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Calendar Report */}
      {reportType === 'calendar' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Calendar Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={exportAppointments}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Services
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointments.slice(0, 100).map(appointment => (
                  <tr key={appointment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.appointmentDate 
                        ? format(appointment.appointmentDate.toDate ? appointment.appointmentDate.toDate() : new Date(appointment.appointmentDate), 'MMM dd, yyyy')
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.appointmentTime || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.clientId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(appointment.serviceIds || []).join(', ') || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        appointment.status === 'completed' || appointment.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : appointment.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {appointment.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Leave Management Report */}
      {reportType === 'leave' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Leave Management Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => exportToCSV(
                    staffData.map(s => ({
                      'Name': `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'N/A',
                      'Role': s.roles?.[0] || s.role || 'N/A',
                      'Email': s.email || 'N/A',
                      'Status': s.isActive !== false ? 'Active' : 'Inactive'
                    })),
                    'Leave_Management_Report'
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-600 mb-4">
              Leave management data will be displayed here. This report shows staff leave requests and approvals.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffData.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                        No staff data available
                      </td>
                    </tr>
                  ) : (
                    staffData.map(staff => (
                      <tr key={staff.uid || staff.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {`${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {staff.roles?.[0] || staff.role || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            staff.isActive !== false
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {staff.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Print Modal for Revenue Report */}
      {showPrintModal && reportType === 'revenue' && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title="Print Revenue Report"
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date From
                </label>
                <Input
                  type="date"
                  value={printFilters.dateFrom}
                  onChange={(e) => setPrintFilters({ ...printFilters, dateFrom: e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date To
                </label>
                <Input
                  type="date"
                  value={printFilters.dateTo}
                  onChange={(e) => setPrintFilters({ ...printFilters, dateTo: e.target.value })}
                  className="w-full"
                />
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Type
                </label>
                <select
                  value={printFilters.transactionType}
                  onChange={(e) => setPrintFilters({ ...printFilters, transactionType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="all">All Types</option>
                  <option value="service">Service Only</option>
                  <option value="product">Product Only</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={printFilters.status}
                  onChange={(e) => setPrintFilters({ ...printFilters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* View Type */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  View Type
                </label>
                <select
                  value={printFilters.viewType}
                  onChange={(e) => setPrintFilters({ ...printFilters, viewType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="period">Period Summary</option>
                  <option value="yearly">Yearly Breakdown</option>
                </select>
              </div>
            </div>

            {/* Preview Summary - Only show if data is loaded */}
            {printTransactions.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview Summary:</p>
                {(() => {
                  const previewStats = calculateFilteredRevenueStats(printFilters, printTransactions);
                  return (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Total Revenue: </span>
                        <span className="font-semibold">₱{previewStats.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Service Revenue: </span>
                        <span className="font-semibold text-blue-600">₱{previewStats.serviceRevenue.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Product Revenue: </span>
                        <span className="font-semibold text-purple-600">₱{previewStats.productRevenue.toLocaleString()}</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-gray-600">Total Transactions: </span>
                        <span className="font-semibold">{previewStats.totalTransactions}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintTransactions([]);
                }}
                className="flex-1"
                disabled={printLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePrintWithFilters}
                className="flex-1 bg-[#160B53] hover:bg-[#12094A] text-white"
                disabled={printLoading}
              >
                {printLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading Data...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4 mr-2" />
                    Print Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {error && (
        <Card className="p-6 border-l-4 border-red-400 bg-red-50">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}
    </div>
    
  );
};

export default Reports;

