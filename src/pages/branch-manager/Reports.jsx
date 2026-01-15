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

  // Also load initial data when component mounts for overview
  useEffect(() => {
    if (userData?.branchId && !reportType) {
      // Load basic data for overview cards
      const loadOverviewData = async () => {
        try {
          setLoading(true);
          const startDate = new Date(dateRange.start);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);

          // Load all data for overview
          await Promise.all([
            loadTransactionsData(startDate, endDate),
            loadAppointmentsData(startDate, endDate),
            loadStaffData()
          ]);
        } catch (err) {
          console.error('Error loading overview data:', err);
        } finally {
          setLoading(false);
        }
      };
      loadOverviewData();
    }
  }, [userData?.branchId, dateRange]);

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
        case 'revenue':
        case 'services':
        case 'products':
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
    console.log('📊 Loading transactions data...', { startDate, endDate, branchId: userData.branchId });
    
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
      
      console.log(`📄 Page ${page} result:`, transactionsResult);
      
      if (transactionsResult.success && transactionsResult.transactions) {
        // Filter by date range client-side
        const filtered = transactionsResult.transactions.filter(t => {
          if (!t.createdAt) return false;
          const transactionDate = t.createdAt?.toDate 
            ? t.createdAt.toDate() 
            : new Date(t.createdAt);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
        
        console.log(`✅ Page ${page}: ${filtered.length} transactions in date range`);
        allTransactions.push(...filtered);
        hasMore = transactionsResult.hasMore && transactionsResult.transactions.length > 0;
        page++;
      } else {
        console.log('❌ No more transactions or error');
        hasMore = false;
      }
    }
    
    console.log(`📊 Total transactions loaded: ${allTransactions.length}`);
    setTransactions(allTransactions);
  };

  const loadAppointmentsData = async (startDate, endDate) => {
    console.log('📅 Loading appointments data...', { startDate, endDate, branchId: userData.branchId });
    
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
    
    console.log('📅 Appointments result:', appointmentsResult);
    console.log(`✅ Loaded ${appointmentsResult.appointments?.length || 0} appointments`);
    
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
    console.log('📊 ========== CALCULATING SUMMARY STATS ==========');
    console.log('📊 Total transactions loaded:', transactions.length);
    console.log('📅 Date range:', dateRange);
    
    // Filter completed transactions - check multiple status formats
    const completedTransactions = transactions.filter(t => {
      const status = (t.status || '').toLowerCase();
      return status === 'paid' || status === 'completed' || status === 'Paid' || status === 'Completed';
    });
    
    console.log('✅ Completed transactions:', completedTransactions.length);
    
    // Log first few transactions to understand the data
    if (completedTransactions.length > 0) {
      console.log('📦 Sample transactions (first 3):');
      completedTransactions.slice(0, 3).forEach((t, i) => {
        console.log(`  ${i + 1}.`, {
          id: t.id,
          salesType: t.salesType,
          subtotal: t.subtotal,
          total: t.total,
          status: t.status,
          itemCount: t.items?.length,
          date: t.createdAt?.toDate?.() || t.createdAt
        });
      });
    }
    
    const totalRevenue = completedTransactions.reduce((sum, t) => 
      sum + (t.total || t.totalAmount || 0), 0
    );
    
    console.log('💰 Total Revenue:', totalRevenue);
    
    // Calculate service and product revenue
    let serviceRevenue = 0;
    let productRevenue = 0;
    let serviceCount = 0;
    let productCount = 0;
    let mixedCount = 0;
    
    completedTransactions.forEach((t, index) => {
      const txnTotal = t.total || t.totalAmount || 0;
      const salesType = t.salesType;
      
      console.log(`Transaction ${index + 1}:`, {
        id: t.id,
        salesType: salesType,
        transactionType: t.transactionType,
        type: t.type,
        total: txnTotal,
        subtotal: t.subtotal,
        hasItems: !!t.items,
        itemsLength: t.items?.length
      });
      
      // Check salesType field first (most reliable for mixed transactions)
      // Handle both undefined and "undefined" string
      if (salesType && salesType !== 'undefined' && salesType !== undefined) {
        console.log(`  → Has valid salesType: "${salesType}"`);
        if (salesType === 'service') {
          serviceRevenue += txnTotal;
          serviceCount++;
          console.log(`  ✓ Service transaction: +₱${txnTotal}`);
        } else if (salesType === 'product') {
          // For product transactions, use subtotal (before tax/discount)
          const productAmount = t.subtotal || txnTotal;
          productRevenue += productAmount;
          productCount++;
          console.log(`  ✓ Product transaction: +₱${productAmount} (subtotal: ${t.subtotal}, total: ${txnTotal})`);
        } else if (salesType === 'mixed') {
          mixedCount++;
          console.log(`  ✓ Mixed transaction - calculating from items:`);
          // For mixed transactions, sum up items by type
          if (t.items && Array.isArray(t.items)) {
            t.items.forEach((item) => {
              const itemTotal = (item.price || 0) * (item.quantity || 1);
              if (item.type === 'service') {
                serviceRevenue += itemTotal;
                console.log(`    → Service item "${item.name}": +₱${itemTotal}`);
              } else if (item.type === 'product') {
                productRevenue += itemTotal;
                console.log(`    → Product item "${item.name}": +₱${itemTotal}`);
              }
            });
          }
        }
      } else if (t.items && Array.isArray(t.items) && t.items.length > 0) {
        // No valid salesType, calculate from items
        console.log(`  ⚠ No valid salesType - calculating from ${t.items.length} items:`);
        t.items.forEach((item) => {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          if (item.type === 'service') {
            serviceRevenue += itemTotal;
            serviceCount++;
            console.log(`    → Service item "${item.name}": +₱${itemTotal}`);
          } else if (item.type === 'product') {
            productRevenue += itemTotal;
            productCount++;
            console.log(`    → Product item "${item.name}": +₱${itemTotal}`);
          }
        });
      } else if (t.transactionType || t.type) {
        // Old schema: transactionType or type field
        console.log(`  ⚠ Using old schema - transactionType: "${t.transactionType}", type: "${t.type}"`);
        if (t.transactionType === 'service' || t.type === 'service') {
          serviceRevenue += txnTotal;
          serviceCount++;
          console.log(`  ✓ Service (old schema): +₱${txnTotal}`);
        } else if (t.transactionType === 'product' || t.type === 'product') {
          const productAmount = t.subtotal || txnTotal;
          productRevenue += productAmount;
          productCount++;
          console.log(`  ✓ Product (old schema): +₱${productAmount}`);
        }
      } else {
        // No type information at all - assume it's a service transaction (most common)
        console.warn(`  ⚠ No type info found - assuming service: +₱${txnTotal}`);
        serviceRevenue += txnTotal;
        serviceCount++;
      }
    });
    
    console.log('💰 ========== REVENUE SUMMARY ==========');
    console.log('💰 Total Revenue:', totalRevenue);
    console.log('💰 Service Revenue:', serviceRevenue, `(${serviceCount} transactions)`);
    console.log('💰 Product Revenue:', productRevenue, `(${productCount} transactions)`);
    console.log('💰 Mixed Transactions:', mixedCount);
    console.log('💰 Service + Product =', serviceRevenue + productRevenue, 'vs Total =', totalRevenue);
    console.log('💰 ========================================');
    
    const totalTransactions = completedTransactions.length;
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    const completedAppointments = appointments.filter(a => 
      a.status === 'completed' || a.status === 'confirmed'
    );
    
    const cancelledAppointments = appointments.filter(a => 
      a.status === 'cancelled'
    );
    
    const totalProductsSold = completedTransactions.reduce((sum, t) => {
      if (t.items && Array.isArray(t.items)) {
        return sum + t.items.filter(item => item.type === 'product').reduce((pSum, p) => pSum + (p.quantity || 0), 0);
      } else if (t.products && Array.isArray(t.products)) {
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
      
      // Calculate service/product split using salesType
      const salesType = t.salesType;
      if (salesType && salesType !== 'undefined' && salesType !== undefined) {
        if (salesType === 'service') {
          yearlyRevenue[year].service += revenue;
        } else if (salesType === 'product') {
          // For product transactions, use subtotal
          const productAmount = t.subtotal || revenue;
          yearlyRevenue[year].product += productAmount;
        } else if (salesType === 'mixed' && t.items && Array.isArray(t.items)) {
          // For mixed, sum items by type
          t.items.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            if (item.type === 'service') {
              yearlyRevenue[year].service += itemTotal;
            } else if (item.type === 'product') {
              yearlyRevenue[year].product += itemTotal;
            }
          });
        }
      } else if (t.items && Array.isArray(t.items) && t.items.length > 0) {
        // No valid salesType, calculate from items
        t.items.forEach(item => {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          if (item.type === 'service') {
            yearlyRevenue[year].service += itemTotal;
          } else if (item.type === 'product') {
            yearlyRevenue[year].product += itemTotal;
          }
        });
      } else if (t.transactionType || t.type) {
        // Old schema
        const isService = ((t.transactionType || t.type || '').toLowerCase() === 'service');
        if (isService) {
          yearlyRevenue[year].service += revenue;
        } else {
          const productAmount = t.subtotal || revenue;
          yearlyRevenue[year].product += productAmount;
        }
      } else {
        // No type info - assume service
        yearlyRevenue[year].service += revenue;
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
      
      // Calculate monthly service/product split using same salesType variable
      // (already declared above, so we reuse it)
      if (salesType && salesType !== 'undefined' && salesType !== undefined) {
        if (salesType === 'service') {
          yearlyRevenue[year].months[monthKey].service += revenue;
        } else if (salesType === 'product') {
          // For product transactions, use subtotal
          const productAmount = t.subtotal || revenue;
          yearlyRevenue[year].months[monthKey].product += productAmount;
        } else if (salesType === 'mixed' && t.items && Array.isArray(t.items)) {
          // For mixed, sum items by type
          t.items.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            if (item.type === 'service') {
              yearlyRevenue[year].months[monthKey].service += itemTotal;
            } else if (item.type === 'product') {
              yearlyRevenue[year].months[monthKey].product += itemTotal;
            }
          });
        }
      } else if (t.items && Array.isArray(t.items) && t.items.length > 0) {
        // No valid salesType, calculate from items
        t.items.forEach(item => {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          if (item.type === 'service') {
            yearlyRevenue[year].months[monthKey].service += itemTotal;
          } else if (item.type === 'product') {
            yearlyRevenue[year].months[monthKey].product += itemTotal;
          }
        });
      } else if (t.transactionType || t.type) {
        // Old schema
        const isService = ((t.transactionType || t.type || '').toLowerCase() === 'service');
        if (isService) {
          yearlyRevenue[year].months[monthKey].service += revenue;
        } else {
          const productAmount = t.subtotal || revenue;
          yearlyRevenue[year].months[monthKey].product += productAmount;
        }
      } else {
        // No type info - assume service
        yearlyRevenue[year].months[monthKey].service += revenue;
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
        <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        <p className="text-gray-600">Revenue, transactions, appointments, and inventory reports with monthly and annual breakdowns</p>
      </div>


      {/* Report Cards Grid */}
      {!reportType || reportType === 'overview' ? (
        <div className="space-y-6">
          {/* Revenue Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Banknote className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₱{summaryStats.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Scissors className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Service Revenue</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ₱{summaryStats.serviceRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Product Revenue</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ₱{summaryStats.productRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Receipt className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summaryStats.totalTransactions}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Report Type Cards */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { 
                  id: 'revenue', 
                  label: 'Revenue Report', 
                  description: 'Monthly and annual revenue breakdown with service/product split',
                  icon: Banknote,
                  bgColor: 'bg-green-100',
                  iconColor: 'text-green-600'
                },
                { 
                  id: 'transactions', 
                  label: 'Transaction Report', 
                  description: 'Detailed sales transactions with payment and client information',
                  icon: Receipt,
                  bgColor: 'bg-blue-100',
                  iconColor: 'text-blue-600'
                },
                { 
                  id: 'appointments', 
                  label: 'Appointment Report', 
                  description: 'Monthly and annual appointment statistics and completion rates',
                  icon: Calendar,
                  bgColor: 'bg-purple-100',
                  iconColor: 'text-purple-600'
                },
                { 
                  id: 'inventory', 
                  label: 'Inventory Report', 
                  description: 'Monthly and annual product sales, stock movement, and profitability',
                  icon: Package,
                  bgColor: 'bg-orange-100',
                  iconColor: 'text-orange-600'
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
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Back Button and Date Range Controls */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setReportType(null)}
            >
              ← Back to Reports
            </Button>
            
            {/* Date Range Controls */}
            <div className="flex items-center gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setDateRangePreset('today')}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Today
                </button>
                <button
                  onClick={() => setDateRangePreset('week')}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  This Week
                </button>
                <button
                  onClick={() => setDateRangePreset('month')}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  This Month
                </button>
                <button
                  onClick={() => setDateRangePreset('year')}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  This Year
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-40"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-40"
                />
              </div>
            </div>
          </div>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setYearlyView(!yearlyView)}
                >
                  {yearlyView ? 'Detailed View' : 'Annual View'}
                </Button>
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
          
          {!yearlyView ? (
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
                      Client
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
                        {appointment.clientName || appointment.clientId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
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
          ) : (
            <div className="p-6">
              {(() => {
                const monthlyStats = {};
                appointments.forEach(apt => {
                  if (!apt.appointmentDate) return;
                  const aptDate = apt.appointmentDate.toDate ? apt.appointmentDate.toDate() : new Date(apt.appointmentDate);
                  const monthKey = format(aptDate, 'yyyy-MM');
                  const year = format(aptDate, 'yyyy');
                  
                  if (!monthlyStats[year]) {
                    monthlyStats[year] = { total: 0, completed: 0, cancelled: 0, pending: 0, months: {} };
                  }
                  
                  monthlyStats[year].total++;
                  if (apt.status === 'completed' || apt.status === 'confirmed') monthlyStats[year].completed++;
                  else if (apt.status === 'cancelled') monthlyStats[year].cancelled++;
                  else monthlyStats[year].pending++;
                  
                  if (!monthlyStats[year].months[monthKey]) {
                    monthlyStats[year].months[monthKey] = {
                      total: 0,
                      completed: 0,
                      cancelled: 0,
                      pending: 0,
                      monthName: format(aptDate, 'MMMM yyyy')
                    };
                  }
                  
                  monthlyStats[year].months[monthKey].total++;
                  if (apt.status === 'completed' || apt.status === 'confirmed') monthlyStats[year].months[monthKey].completed++;
                  else if (apt.status === 'cancelled') monthlyStats[year].months[monthKey].cancelled++;
                  else monthlyStats[year].months[monthKey].pending++;
                });
                
                return (
                  <div className="space-y-6">
                    {Object.keys(monthlyStats).sort().reverse().map(year => {
                      const yearData = monthlyStats[year];
                      const months = Object.keys(yearData.months).sort();
                      const completionRate = yearData.total > 0 ? ((yearData.completed / yearData.total) * 100).toFixed(1) : 0;
                      
                      return (
                        <div key={year} className="border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">{year}</h3>
                            <div className="flex gap-6">
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="text-xl font-bold text-gray-900">{yearData.total}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Completed</p>
                                <p className="text-lg font-semibold text-green-600">{yearData.completed}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Cancelled</p>
                                <p className="text-lg font-semibold text-red-600">{yearData.cancelled}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Completion Rate</p>
                                <p className="text-lg font-semibold text-blue-600">{completionRate}%</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            {months.map(monthKey => {
                              const monthData = yearData.months[monthKey];
                              const monthCompletionRate = monthData.total > 0 ? ((monthData.completed / monthData.total) * 100).toFixed(1) : 0;
                              
                              return (
                                <div key={monthKey} className="border border-gray-200 rounded-lg p-4">
                                  <p className="font-semibold text-gray-900 mb-2">{monthData.monthName}</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-gray-600">Total:</span>
                                      <span className="text-sm font-semibold text-gray-900">{monthData.total}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-gray-600">Completed:</span>
                                      <span className="text-sm font-semibold text-green-600">{monthData.completed}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-gray-600">Cancelled:</span>
                                      <span className="text-sm font-semibold text-red-600">{monthData.cancelled}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-gray-600">Completion:</span>
                                      <span className="text-sm font-semibold text-blue-600">{monthCompletionRate}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {Object.keys(monthlyStats).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No appointment data available for the selected period
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      )}

      {/* Service Performance Report */}
      {reportType === 'services' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Service Performance Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const serviceStats = {};
                  transactions.filter(t => t.status === 'paid' || t.status === 'completed').forEach(t => {
                    if (t.items && Array.isArray(t.items)) {
                      t.items.filter(item => item.type === 'service').forEach(service => {
                        const serviceName = service.name || service.serviceName || 'Unknown';
                        if (!serviceStats[serviceName]) {
                          serviceStats[serviceName] = { count: 0, revenue: 0 };
                        }
                        serviceStats[serviceName].count += 1;
                        serviceStats[serviceName].revenue += (service.price || 0) * (service.quantity || 1);
                      });
                    }
                  });
                  const exportData = Object.entries(serviceStats).map(([name, stats]) => ({
                    'Service Name': name,
                    'Times Booked': stats.count,
                    'Total Revenue': stats.revenue,
                    'Avg Revenue': stats.count > 0 ? (stats.revenue / stats.count).toFixed(2) : 0
                  }));
                  exportToCSV(exportData, 'Service_Performance_Report');
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {(() => {
              const serviceStats = {};
              transactions.filter(t => t.status === 'paid' || t.status === 'completed').forEach(t => {
                if (t.items && Array.isArray(t.items)) {
                  t.items.filter(item => item.type === 'service').forEach(service => {
                    const serviceName = service.name || service.serviceName || 'Unknown';
                    if (!serviceStats[serviceName]) {
                      serviceStats[serviceName] = { count: 0, revenue: 0 };
                    }
                    serviceStats[serviceName].count += 1;
                    serviceStats[serviceName].revenue += (service.price || 0) * (service.quantity || 1);
                  });
                }
              });
              
              const sortedServices = Object.entries(serviceStats)
                .sort((a, b) => b[1].revenue - a[1].revenue);
              
              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Times Booked
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedServices.length > 0 ? (
                        sortedServices.map(([serviceName, stats]) => (
                          <tr key={serviceName} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {serviceName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {stats.count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                              ₱{stats.revenue.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ₱{(stats.revenue / stats.count).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                            No service data available for the selected period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Product Sales Report */}
      {reportType === 'products' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Product Sales Report</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const productStats = {};
                  transactions.filter(t => t.status === 'paid' || t.status === 'completed').forEach(t => {
                    if (t.items && Array.isArray(t.items)) {
                      t.items.filter(item => item.type === 'product').forEach(product => {
                        const productName = product.name || product.productName || 'Unknown';
                        if (!productStats[productName]) {
                          productStats[productName] = { quantity: 0, revenue: 0 };
                        }
                        productStats[productName].quantity += product.quantity || 1;
                        productStats[productName].revenue += (product.price || 0) * (product.quantity || 1);
                      });
                    }
                  });
                  const exportData = Object.entries(productStats).map(([name, stats]) => ({
                    'Product Name': name,
                    'Quantity Sold': stats.quantity,
                    'Total Revenue': stats.revenue,
                    'Avg Price': stats.quantity > 0 ? (stats.revenue / stats.quantity).toFixed(2) : 0
                  }));
                  exportToCSV(exportData, 'Product_Sales_Report');
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {(() => {
              const productStats = {};
              transactions.filter(t => t.status === 'paid' || t.status === 'completed').forEach(t => {
                if (t.items && Array.isArray(t.items)) {
                  t.items.filter(item => item.type === 'product').forEach(product => {
                    const productName = product.name || product.productName || 'Unknown';
                    if (!productStats[productName]) {
                      productStats[productName] = { quantity: 0, revenue: 0 };
                    }
                    productStats[productName].quantity += product.quantity || 1;
                    productStats[productName].revenue += (product.price || 0) * (product.quantity || 1);
                  });
                }
              });
              
              const sortedProducts = Object.entries(productStats)
                .sort((a, b) => b[1].revenue - a[1].revenue);
              
              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity Sold
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedProducts.length > 0 ? (
                        sortedProducts.map(([productName, stats]) => (
                          <tr key={productName} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {productName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {stats.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-purple-600">
                              ₱{stats.revenue.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ₱{(stats.revenue / stats.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                            No product sales data available for the selected period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setYearlyView(!yearlyView)}
                >
                  {yearlyView ? 'Detailed View' : 'Annual View'}
                </Button>
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
          
          {!yearlyView ? (
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
                      Avg Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const productStats = {};
                    transactions.filter(t => t.status === 'paid' || t.status === 'completed').forEach(t => {
                      if (t.items && Array.isArray(t.items)) {
                        t.items.filter(item => item.type === 'product').forEach(product => {
                          const productName = product.name || product.productName || 'Unknown';
                          if (!productStats[productName]) {
                            productStats[productName] = { quantity: 0, revenue: 0 };
                          }
                          productStats[productName].quantity += product.quantity || 1;
                          productStats[productName].revenue += (product.price || 0) * (product.quantity || 1);
                        });
                      }
                    });
                    
                    const sortedProducts = Object.entries(productStats).sort((a, b) => b[1].revenue - a[1].revenue);
                    
                    return sortedProducts.length > 0 ? (
                      sortedProducts.map(([productName, stats]) => (
                        <tr key={productName} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {productName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stats.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-purple-600">
                            ₱{stats.revenue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ₱{(stats.revenue / stats.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                          No product sales data available for the selected period
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              {(() => {
                const monthlyStats = {};
                transactions.filter(t => t.status === 'paid' || t.status === 'completed').forEach(t => {
                  if (!t.createdAt) return;
                  const txnDate = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
                  const monthKey = format(txnDate, 'yyyy-MM');
                  const year = format(txnDate, 'yyyy');
                  
                  if (t.items && Array.isArray(t.items)) {
                    t.items.filter(item => item.type === 'product').forEach(product => {
                      if (!monthlyStats[year]) {
                        monthlyStats[year] = { quantity: 0, revenue: 0, months: {} };
                      }
                      
                      const qty = product.quantity || 1;
                      const rev = (product.price || 0) * qty;
                      
                      monthlyStats[year].quantity += qty;
                      monthlyStats[year].revenue += rev;
                      
                      if (!monthlyStats[year].months[monthKey]) {
                        monthlyStats[year].months[monthKey] = {
                          quantity: 0,
                          revenue: 0,
                          monthName: format(txnDate, 'MMMM yyyy')
                        };
                      }
                      
                      monthlyStats[year].months[monthKey].quantity += qty;
                      monthlyStats[year].months[monthKey].revenue += rev;
                    });
                  }
                });
                
                return (
                  <div className="space-y-6">
                    {Object.keys(monthlyStats).sort().reverse().map(year => {
                      const yearData = monthlyStats[year];
                      const months = Object.keys(yearData.months).sort();
                      
                      return (
                        <div key={year} className="border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">{year}</h3>
                            <div className="flex gap-6">
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Total Quantity</p>
                                <p className="text-xl font-bold text-gray-900">{yearData.quantity}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Total Revenue</p>
                                <p className="text-xl font-bold text-purple-600">₱{yearData.revenue.toLocaleString()}</p>
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
                                      <span className="text-sm text-gray-600">Quantity:</span>
                                      <span className="text-sm font-semibold text-gray-900">{monthData.quantity}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-gray-600">Revenue:</span>
                                      <span className="text-sm font-semibold text-purple-600">
                                        ₱{monthData.revenue.toLocaleString()}
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
                    
                    {Object.keys(monthlyStats).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No inventory sales data available for the selected period
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      )}
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

