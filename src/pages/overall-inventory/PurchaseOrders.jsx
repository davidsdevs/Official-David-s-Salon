// Purchase Orders Approval Page for Overall Inventory Controller
// With pagination, branch filter, date range filter, and reports
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  ShoppingCart,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  RefreshCw,
  AlertTriangle,
  FileText,
  X,
  Truck,
  Calendar,
  Package,
  TrendingDown,
  TrendingUp,
  Building,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart3,
  Printer
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { inventoryService } from '../../services/inventoryService';
import { getAllBranches } from '../../services/branchService';
import { exportToExcel } from '../../utils/excelExport';

const ITEMS_PER_PAGE = 20;

const OverallInventoryControllerPurchaseOrders = () => {
  const { userData } = useAuth();
  
  // Data states
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState(null);
  const [pageCache, setPageCache] = useState({}); // Cache for pagination

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // 'all', '7days', '30days', '90days', 'thisMonth', 'lastMonth', 'custom'
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // UI states
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [branchStocks, setBranchStocks] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [isConfirmApproveModalOpen, setIsConfirmApproveModalOpen] = useState(false);
  const [isConfirmRejectModalOpen, setIsConfirmRejectModalOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Stats (calculated from all data, not just current page)
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingApproval: 0,
    approvedOrders: 0,
    rejectedOrders: 0,
    totalValue: 0
  });

  // Load branches on mount
  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      setBranches(Array.isArray(branchesData) ? branchesData.filter(b => b.isActive !== false) : []);
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  };

  // Get date range for filtering
  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    switch (dateRange) {
      case '7days':
        startDate = subDays(now, 7);
        break;
      case '30days':
        startDate = subDays(now, 30);
        break;
      case '90days':
        startDate = subDays(now, 90);
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case 'custom':
        if (customDateStart) startDate = new Date(customDateStart);
        if (customDateEnd) endDate = new Date(customDateEnd);
        break;
      default:
        break;
    }

    return { startDate, endDate };
  }, [dateRange, customDateStart, customDateEnd]);

  // Load purchase orders with filters and pagination
  const loadPurchaseOrders = useCallback(async (page = 1, resetCache = false) => {
    try {
      setLoading(true);
      setError(null);

      if (resetCache) {
        setPageCache({});
        setLastDoc(null);
      }

      // Check cache first
      if (pageCache[page] && !resetCache) {
        setPurchaseOrders(pageCache[page].orders);
        setLastDoc(pageCache[page].lastDoc);
        setCurrentPage(page);
        setLoading(false);
        return;
      }

      const purchaseOrdersRef = collection(db, 'purchaseOrders');
      const { startDate, endDate } = getDateRange();

      // Build query constraints
      let constraints = [where('createdByRole', '==', 'inventoryController')];

      // Branch filter
      if (selectedBranch !== 'all') {
        constraints.push(where('branchId', '==', selectedBranch));
      }

      // Status filter
      if (selectedStatus !== 'all') {
        constraints.push(where('status', '==', selectedStatus));
      }

      // Always order by createdAt
      constraints.push(orderBy('createdAt', 'desc'));

      // Build and execute query
      let q = query(purchaseOrdersRef, ...constraints);

      // For pagination, we need to get all matching docs first for accurate count
      // Then slice for current page (client-side pagination for complex filters)
      const snapshot = await getDocs(q);

      let ordersList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                         (data.createdAt ? new Date(data.createdAt) : new Date());

        // Apply date filter client-side (Firestore doesn't support multiple range queries)
        if (startDate && createdAt < startDate) return;
        if (endDate && createdAt > endDate) return;

        // Apply search filter client-side
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = 
            (data.orderId || '').toLowerCase().includes(searchLower) ||
            (data.supplierName || '').toLowerCase().includes(searchLower) ||
            (data.notes || '').toLowerCase().includes(searchLower) ||
            (data.branchName || '').toLowerCase().includes(searchLower);
          if (!matchesSearch) return;
        }

        ordersList.push({
          id: doc.id,
          ...data,
          status: data.status ? String(data.status).trim() : data.status,
          orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
          expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : new Date(data.expectedDelivery),
          createdAt: createdAt,
          receivedAt: data.receivedAt?.toDate ? data.receivedAt.toDate() : (data.receivedAt ? new Date(data.receivedAt) : null),
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
          rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt ? new Date(data.rejectedAt) : null),
          rejectionNote: data.rejectionNote || null,
        });
      });

      // Sort by createdAt descending
      ordersList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Calculate stats from all filtered data
      const newStats = {
        totalOrders: ordersList.length,
        pendingApproval: ordersList.filter(o => o.status === 'Pending Overall Approval' || o.status === 'Pending').length,
        approvedOrders: ordersList.filter(o => o.status === 'Approved' || o.status === 'In Transit').length,
        rejectedOrders: ordersList.filter(o => o.status === 'Rejected by Overall' || o.status === 'Rejected by Branch' || o.status === 'Rejected').length,
        totalValue: ordersList.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
      };
      setStats(newStats);
      setTotalCount(ordersList.length);

      // Paginate
      const startIndex = (page - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const paginatedOrders = ordersList.slice(startIndex, endIndex);

      // Cache the page
      setPageCache(prev => ({
        ...prev,
        [page]: { orders: paginatedOrders, lastDoc: null }
      }));

      setPurchaseOrders(paginatedOrders);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error loading purchase orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedStatus, searchTerm, getDateRange, pageCache]);

  // Load on mount and when filters change
  useEffect(() => {
    loadPurchaseOrders(1, true);
  }, [selectedBranch, selectedStatus, dateRange, customDateStart, customDateEnd]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPurchaseOrders(1, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Pagination handlers
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadPurchaseOrders(newPage);
    }
  };

  // Export to Excel
  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Get all filtered data for export
      const purchaseOrdersRef = collection(db, 'purchaseOrders');
      const { startDate, endDate } = getDateRange();

      let constraints = [where('createdByRole', '==', 'inventoryController')];
      if (selectedBranch !== 'all') {
        constraints.push(where('branchId', '==', selectedBranch));
      }
      if (selectedStatus !== 'all') {
        constraints.push(where('status', '==', selectedStatus));
      }
      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(purchaseOrdersRef, ...constraints);
      const snapshot = await getDocs(q);

      const exportData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

        if (startDate && createdAt < startDate) return;
        if (endDate && createdAt > endDate) return;

        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = 
            (data.orderId || '').toLowerCase().includes(searchLower) ||
            (data.supplierName || '').toLowerCase().includes(searchLower);
          if (!matchesSearch) return;
        }

        exportData.push({
          'Order ID': data.orderId || doc.id,
          'Branch': data.branchName || 'Unknown',
          'Supplier': data.supplierName || 'Unknown',
          'Status': data.status || 'Unknown',
          'Order Date': data.orderDate?.toDate ? format(data.orderDate.toDate(), 'yyyy-MM-dd') : 'N/A',
          'Expected Delivery': data.expectedDelivery?.toDate ? format(data.expectedDelivery.toDate(), 'yyyy-MM-dd') : 'N/A',
          'Total Amount': data.totalAmount || 0,
          'Items Count': data.items?.length || 0,
          'Created By': data.createdByName || 'Unknown',
          'Created At': createdAt ? format(createdAt, 'yyyy-MM-dd HH:mm') : 'N/A',
          'Approved By': data.approvedByName || '',
          'Approved At': data.approvedAt?.toDate ? format(data.approvedAt.toDate(), 'yyyy-MM-dd HH:mm') : '',
          'Rejected By': data.rejectedByName || '',
          'Rejection Note': data.rejectionNote || ''
        });
      });

      if (exportData.length === 0) {
        setError('No data to export');
        return;
      }

      const fileName = `PurchaseOrders_${format(new Date(), 'yyyyMMdd_HHmmss')}`;
      exportToExcel(exportData, fileName, 'Purchase Orders');
    } catch (err) {
      console.error('Error exporting:', err);
      setError('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Print Purchase Orders Report
  const handlePrint = async () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    
    // Build filters text
    const filters = [];
    if (searchTerm) filters.push(`Search: "${searchTerm}"`);
    if (selectedStatus !== 'all') filters.push(`Status: ${selectedStatus}`);
    if (selectedBranch !== 'all') {
      const branch = branches.find(b => b.id === selectedBranch);
      if (branch) filters.push(`Branch: ${branch.name || branch.branchName}`);
    }
    if (dateRange !== 'all') {
      if (dateRange === 'custom' && customDateStart && customDateEnd) {
        filters.push(`Date: ${format(new Date(customDateStart), 'MMM dd, yyyy')} - ${format(new Date(customDateEnd), 'MMM dd, yyyy')}`);
      } else {
        filters.push(`Date Range: ${dateRange}`);
      }
    }
    const filtersText = filters.length > 0 ? filters.join(' • ') : 'No filters applied';

    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Orders Report</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: letter;
                margin: 0.4in 0.4in 0.75in 0.4in;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: 'Poppins', Arial, sans-serif;
            }
            body {
              font-family: 'Poppins', Arial, sans-serif;
              padding: 0;
              color: #000;
              font-size: 9px;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
            }
            .header h1 {
              font-size: 14px;
              font-weight: 600;
              margin: 0 0 5px 0;
              letter-spacing: 1px;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
            }
            .filters {
              background: #fff;
              padding: 8px;
              border: 1px solid #333;
              margin: 10px 0 15px 0;
              text-align: center;
            }
            .filters-title {
              font-size: 10px;
              font-weight: 700;
              margin-bottom: 5px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .filters-content {
              font-size: 9px;
              font-weight: 600;
            }
            .summary-stats {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 15px 0;
            }
            .stat-box {
              text-align: center;
              padding: 10px;
              background: #fff;
              border: 1px solid #333;
            }
            .stat-value {
              font-size: 16px;
              font-weight: 700;
              color: #000;
              margin-bottom: 3px;
            }
            .stat-label {
              font-size: 9px;
              color: #000;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 600;
            }
            .order-card {
              border: 1px solid #333;
              margin-bottom: 10px;
              background: #fff;
              page-break-inside: avoid;
            }
            .order-header {
              background: #fff;
              padding: 8px 12px;
              border-bottom: 1px solid #333;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .order-id {
              font-size: 11px;
              font-weight: 700;
            }
            .status-badge {
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
              border: 1px solid #333;
              background: #fff;
              color: #000;
            }
            .order-body {
              padding: 10px 12px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
            }
            .info-row {
              padding: 4px 0;
              border-bottom: 1px dotted #ddd;
              font-size: 9px;
            }
            .info-label {
              font-weight: 600;
              display: inline-block;
              width: 110px;
            }
            .info-value {
              color: #333;
            }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 10px 0.4in;
              border-top: 2px solid #333;
              font-size: 8px;
              background: #fff;
            }
            .footer-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .footer-left, .footer-right {
              flex: 1;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Purchase Orders Report - All Branches</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>

          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-value">${stats.totalOrders}</div>
              <div class="stat-label">Total Orders</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.pendingApproval}</div>
              <div class="stat-label">Pending</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.approvedOrders}</div>
              <div class="stat-label">Approved</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">₱${stats.totalValue.toLocaleString()}</div>
              <div class="stat-label">Total Value</div>
            </div>
          </div>
    `;

    purchaseOrders.forEach(order => {
      const orderDate = order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM dd, yyyy') : 'N/A';
      const expectedDelivery = order.expectedDelivery?.toDate ? format(order.expectedDelivery.toDate(), 'MMM dd, yyyy') : 'N/A';
      const itemsCount = order.items?.length || 0;
      
      htmlContent += `
        <div class="order-card">
          <div class="order-header">
            <div class="order-id">${order.orderId || order.id}</div>
            <span class="status-badge">${order.status || 'Unknown'}</span>
          </div>
          
          <div class="order-body">
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Branch:</span>
                <span class="info-value">${order.branchName || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Supplier:</span>
                <span class="info-value">${order.supplierName || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Order Date:</span>
                <span class="info-value">${orderDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Expected Delivery:</span>
                <span class="info-value">${expectedDelivery}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Items:</span>
                <span class="info-value">${itemsCount} items</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Amount:</span>
                <span class="info-value">₱${(order.totalAmount || 0).toLocaleString()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Created By:</span>
                <span class="info-value">${order.createdByName || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${order.status || 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    htmlContent += `
          <div class="footer">
            <div class="footer-content">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Overall Inventory Controller'}<br>
                <strong>Position:</strong> Overall Inventory Controller<br>
                <strong>Branch:</strong> Overall Inventory
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br>
                <strong>Time:</strong> ${format(new Date(), 'HH:mm:ss')}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setSelectedBranch('all');
    setDateRange('all');
    setCustomDateStart('');
    setCustomDateEnd('');
    setCurrentPage(1);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending Branch Approval': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Pending Overall Approval': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Pending': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Received': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Approved': return 'text-green-600 bg-green-100 border-green-200';
      case 'In Transit': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Rejected by Branch': return 'text-red-600 bg-red-100 border-red-200';
      case 'Rejected by Overall': return 'text-rose-700 bg-rose-100 border-rose-200';
      case 'Rejected': return 'text-red-600 bg-red-100 border-red-200';
      case 'Shipped': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Delivered': return 'text-green-600 bg-green-100 border-green-200';
      case 'Cancelled': return 'text-red-600 bg-red-100 border-red-200';
      case 'Overdue': return 'text-orange-600 bg-orange-100 border-orange-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending Branch Approval': return <Clock className="h-3 w-3" />;
      case 'Pending Overall Approval': return <Clock className="h-3 w-3" />;
      case 'Pending': return <Clock className="h-3 w-3" />;
      case 'Received': return <CheckCircle className="h-3 w-3" />;
      case 'Approved': return <CheckCircle className="h-3 w-3" />;
      case 'In Transit': return <Truck className="h-3 w-3" />;
      case 'Rejected by Branch': return <XCircle className="h-3 w-3" />;
      case 'Rejected by Overall': return <XCircle className="h-3 w-3" />;
      case 'Rejected': return <XCircle className="h-3 w-3" />;
      case 'Shipped': return <Truck className="h-3 w-3" />;
      case 'Delivered': return <CheckCircle className="h-3 w-3" />;
      case 'Cancelled': return <XCircle className="h-3 w-3" />;
      case 'Overdue': return <AlertTriangle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  // Approve/Reject handlers
  const handleOpenApproveModal = (orderId) => {
    const order = purchaseOrders.find(o => o.id === orderId);
    console.log('Opening approve modal for order:', order);
    if (order && order.branchId) {
      console.log('Loading stocks for branchId:', order.branchId);
      loadBranchStocks(order.branchId);
    } else {
      console.log('No order or branchId found');
    }
    setPendingOrderId(orderId);
    setIsConfirmApproveModalOpen(true);
  };

  const handleApproveOrder = async () => {
    if (!pendingOrderId) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      const orderRef = doc(db, 'purchaseOrders', pendingOrderId);
      await updateDoc(orderRef, {
        status: 'Approved',
        overallApprovedBy: userData.uid || userData.id,
        overallApprovedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        overallApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await loadPurchaseOrders(currentPage, true);
      setIsConfirmApproveModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedOrder(null);
      setBranchStocks([]);
      setPendingOrderId(null);
    } catch (err) {
      console.error('Error approving order:', err);
      setError('Failed to approve order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenRejectModal = (order) => {
    setSelectedOrder(order);
    setRejectionNote('');
    setIsRejectModalOpen(true);
  };

  const handleRejectOrderConfirm = () => {
    if (!selectedOrder || !rejectionNote.trim()) {
      setError('Rejection note is required');
      return;
    }
    setIsConfirmRejectModalOpen(true);
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder || !rejectionNote.trim()) {
      setError('Rejection note is required');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Rejected by Overall',
        overallRejectedBy: userData.uid || userData.id,
        overallRejectedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        overallRejectedAt: serverTimestamp(),
        overallRejectionNote: rejectionNote.trim(),
        updatedAt: serverTimestamp()
      });
      await loadPurchaseOrders(currentPage, true);
      setIsConfirmRejectModalOpen(false);
      setIsRejectModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedOrder(null);
      setRejectionNote('');
    } catch (err) {
      console.error('Error rejecting order:', err);
      setError('Failed to reject order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const canApproveOrReject = (order) => order.status === 'Pending Overall Approval';

  // Load branch stocks for order details
  const loadBranchStocks = async (branchId) => {
    if (!branchId) {
      console.log('No branchId provided to loadBranchStocks');
      setBranchStocks([]);
      return;
    }
    try {
      setLoadingStocks(true);
      console.log('Loading stocks for branchId:', branchId);
      const result = await inventoryService.getBranchStocks(branchId);
      console.log('Stock result:', result);
      console.log('Stocks data:', result.success ? result.stocks : 'Failed');
      setBranchStocks(result.success ? result.stocks : []);
    } catch (err) {
      console.error('Error loading branch stocks:', err);
      setBranchStocks([]);
    } finally {
      setLoadingStocks(false);
    }
  };

  const getCurrentStock = (productId, usageType = 'otc') => {
    console.log('Getting stock for productId:', productId, 'usageType:', usageType);
    console.log('Available stocks:', branchStocks);
    const stock = branchStocks.find(s => s.productId === productId && s.usageType === usageType);
    console.log('Found stock:', stock);
    
    // Check multiple possible field names for stock quantity
    if (!stock) return null;
    
    const stockQty = stock.remainingQuantity ?? stock.currentStock ?? stock.quantity ?? 0;
    console.log('Stock quantity:', stockQty);
    return stockQty;
  };

  const getStockStatus = (productId, orderedQty, usageType = 'otc') => {
    const currentStock = getCurrentStock(productId, usageType);
    if (currentStock === null) return { text: 'No stock data', color: 'text-gray-500', icon: null };
    
    const stock = branchStocks.find(s => s.productId === productId && s.usageType === usageType);
    const minStock = stock?.minStock || stock?.minQuantity || 0;
    
    if (currentStock <= 0) {
      return { text: `Out of Stock (0)`, color: 'text-red-600', icon: <TrendingDown className="h-3 w-3" /> };
    } else if (currentStock <= minStock) {
      return { text: `Low (${currentStock})`, color: 'text-red-600', icon: <TrendingDown className="h-3 w-3" /> };
    } else if (currentStock < orderedQty) {
      return { text: `Current: ${currentStock}`, color: 'text-amber-600', icon: <AlertTriangle className="h-3 w-3" /> };
    } else {
      return { text: `Current: ${currentStock}`, color: 'text-green-600', icon: <CheckCircle className="h-3 w-3" /> };
    }
  };

  const handleOpenDetailsModal = (order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
    if (order.branchId) {
      loadBranchStocks(order.branchId);
    }
  };

  // Get branch name helper
  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branch?.branchName || 'Unknown Branch';
  };

  if (loading && purchaseOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading purchase orders...</span>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Monitor and manage purchase orders across all branches</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={totalCount === 0}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || totalCount === 0}
            className="flex items-center gap-2"
          >
            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
          <Button
            onClick={() => loadPurchaseOrders(1, true)}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <Card className="p-3 md:p-4">
          <div className="flex items-center">
            <ShoppingCart className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
            <div className="ml-2 md:ml-3">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="flex items-center">
            <Clock className="h-6 w-6 md:h-8 md:w-8 text-yellow-600" />
            <div className="ml-2 md:ml-3">
              <p className="text-xs md:text-sm font-medium text-gray-600">Pending</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{stats.pendingApproval}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
            <div className="ml-2 md:ml-3">
              <p className="text-xs md:text-sm font-medium text-gray-600">Approved</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{stats.approvedOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="flex items-center">
            <XCircle className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
            <div className="ml-2 md:ml-3">
              <p className="text-xs md:text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">{stats.rejectedOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center">
            <Banknote className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
            <div className="ml-2 md:ml-3">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-lg md:text-xl font-bold text-gray-900">₱{stats.totalValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 md:p-6">
        <div className="space-y-4">
          {/* Search and Toggle */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by order ID, supplier, branch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {(selectedBranch !== 'all' || selectedStatus !== 'all' || dateRange !== 'all') && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                    {[selectedBranch !== 'all', selectedStatus !== 'all', dateRange !== 'all'].filter(Boolean).length}
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={handleResetFilters} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t">
              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name || branch.branchName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="Approved">Approved</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Range */}
              {dateRange === 'custom' && (
                <div className="sm:col-span-2 lg:col-span-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                    <input
                      type="date"
                      value={customDateStart}
                      onChange={(e) => setCustomDateStart(e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                    <input
                      type="date"
                      value={customDateEnd}
                      onChange={(e) => setCustomDateEnd(e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Purchase Orders Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Supplier</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Order Date</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-gray-500">Loading...</p>
                  </td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p>No purchase orders found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.orderId || order.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-900 truncate max-w-[100px]">
                          {order.branchName || getBranchName(order.branchId)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm text-gray-900 truncate max-w-[150px]">{order.supplierName || 'Unknown'}</div>
                    </td>
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                      <div className="text-sm text-gray-900">
                        {order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₱{(order.totalAmount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-3 md:px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleOpenDetailsModal(order)} className="px-2 py-1">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canApproveOrReject(order) && (
                          <>
                            <Button size="sm" onClick={() => handleOpenApproveModal(order.id)} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => handleOpenRejectModal(order)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} orders
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              
              <div className="flex items-center gap-1">
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      disabled={loading}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>

    {/* Order Details Modal */}
    {isDetailsModalOpen && selectedOrder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 md:p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <FileText className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold">Purchase Order Details</h2>
                  <p className="text-white/80 text-sm">{selectedOrder.orderId || selectedOrder.id}</p>
                </div>
              </div>
              <Button variant="ghost" onClick={() => { setIsDetailsModalOpen(false); setSelectedOrder(null); setBranchStocks([]); }} className="text-white hover:bg-white/20 rounded-full p-2">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {/* Order Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedOrder.supplierName || 'Unknown Supplier'}</h3>
                <p className="text-sm text-gray-600">Branch: {selectedOrder.branchName || getBranchName(selectedOrder.branchId)}</p>
                <p className="text-sm text-gray-600">Order Date: {selectedOrder.orderDate ? format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy') : 'N/A'}</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedOrder.status)}`}>
                {getStatusIcon(selectedOrder.status)}
                {selectedOrder.status}
              </span>
            </div>

            {/* Order Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs font-medium text-gray-500">Expected Delivery</label>
                <p className="text-sm font-semibold text-gray-900">{selectedOrder.expectedDelivery ? format(new Date(selectedOrder.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs font-medium text-gray-500">Total Amount</label>
                <p className="text-sm font-bold text-green-600">₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs font-medium text-gray-500">Created By</label>
                <p className="text-sm font-semibold text-gray-900">{selectedOrder.createdByName || 'Unknown'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs font-medium text-gray-500">Items</label>
                <p className="text-sm font-semibold text-gray-900">{selectedOrder.items?.length || 0} products</p>
              </div>
            </div>

            {/* Approval/Rejection Info */}
            {/* Branch Manager Approval */}
            {selectedOrder.branchApprovedByName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800"><strong>Branch Manager Approved by:</strong> {selectedOrder.branchApprovedByName}</p>
                {selectedOrder.branchApprovedAt && <p className="text-xs text-blue-600">{format(new Date(selectedOrder.branchApprovedAt.toDate ? selectedOrder.branchApprovedAt.toDate() : selectedOrder.branchApprovedAt), 'MMM dd, yyyy HH:mm')}</p>}
              </div>
            )}
            
            {/* Overall Inventory Controller Approval */}
            {selectedOrder.overallApprovedByName && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800"><strong>Overall Inventory Approved by:</strong> {selectedOrder.overallApprovedByName}</p>
                {selectedOrder.overallApprovedAt && <p className="text-xs text-green-600">{format(new Date(selectedOrder.overallApprovedAt.toDate ? selectedOrder.overallApprovedAt.toDate() : selectedOrder.overallApprovedAt), 'MMM dd, yyyy HH:mm')}</p>}
              </div>
            )}
            
            {/* Legacy Approval (for backward compatibility) */}
            {selectedOrder.approvedByName && !selectedOrder.overallApprovedByName && !selectedOrder.branchApprovedByName && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800"><strong>Approved by:</strong> {selectedOrder.approvedByName}</p>
                {selectedOrder.approvedAt && <p className="text-xs text-green-600">{format(new Date(selectedOrder.approvedAt.toDate ? selectedOrder.approvedAt.toDate() : selectedOrder.approvedAt), 'MMM dd, yyyy HH:mm')}</p>}
              </div>
            )}
            
            {/* Branch Manager Rejection */}
            {selectedOrder.branchRejectedByName && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800"><strong>Branch Manager Rejected by:</strong> {selectedOrder.branchRejectedByName}</p>
                {selectedOrder.branchRejectedAt && <p className="text-xs text-orange-600">{format(new Date(selectedOrder.branchRejectedAt.toDate ? selectedOrder.branchRejectedAt.toDate() : selectedOrder.branchRejectedAt), 'MMM dd, yyyy HH:mm')}</p>}
                {selectedOrder.branchRejectionNote && <p className="text-sm text-orange-700 mt-2 italic">"{selectedOrder.branchRejectionNote}"</p>}
              </div>
            )}
            
            {/* Overall Inventory Controller Rejection */}
            {selectedOrder.overallRejectedByName && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800"><strong>Overall Inventory Rejected by:</strong> {selectedOrder.overallRejectedByName}</p>
                {selectedOrder.overallRejectedAt && <p className="text-xs text-red-600">{format(new Date(selectedOrder.overallRejectedAt.toDate ? selectedOrder.overallRejectedAt.toDate() : selectedOrder.overallRejectedAt), 'MMM dd, yyyy HH:mm')}</p>}
                {selectedOrder.overallRejectionNote && <p className="text-sm text-red-700 mt-2 italic">"{selectedOrder.overallRejectionNote}"</p>}
              </div>
            )}
            
            {/* Legacy Rejection (for backward compatibility) */}
            {selectedOrder.rejectedByName && !selectedOrder.overallRejectedByName && !selectedOrder.branchRejectedByName && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800"><strong>Rejected by:</strong> {selectedOrder.rejectedByName}</p>
                {selectedOrder.rejectedAt && <p className="text-xs text-red-600">{format(new Date(selectedOrder.rejectedAt.toDate ? selectedOrder.rejectedAt.toDate() : selectedOrder.rejectedAt), 'MMM dd, yyyy HH:mm')}</p>}
                {selectedOrder.rejectionNote && <p className="text-sm text-red-700 mt-2 italic">"{selectedOrder.rejectionNote}"</p>}
              </div>
            )}

            {/* Order Items Table */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Order Items</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Usage Type</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Current Stock</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedOrder.items?.map((item, index) => {
                      const usageType = item.usageType || item.usage_type || 'otc';
                      const stockStatus = getStockStatus(item.productId, item.quantity, usageType);
                      const usageTypeDisplay = usageType === 'otc' ? 'OTC' : 'Salon Use';
                      const usageTypeColor = usageType === 'otc' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
                      
                      return (
                        <tr key={index}>
                          <td className="px-3 py-2 font-medium text-gray-900">{item.productName}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${usageTypeColor}`}>
                              {usageTypeDisplay}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-center">
                            {loadingStocks ? (
                              <RefreshCw className="h-3 w-3 animate-spin mx-auto" />
                            ) : (
                              <span className={`flex items-center justify-center gap-1 ${stockStatus.color}`}>
                                {stockStatus.icon}
                                {stockStatus.text}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">₱{(item.unitPrice || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold">₱{(item.totalPrice || 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="border-t p-4 bg-gray-50 flex justify-end gap-2">
            {canApproveOrReject(selectedOrder) && (
              <>
                <Button onClick={() => handleOpenRejectModal(selectedOrder)} className="bg-red-600 hover:bg-red-700 text-white">Reject</Button>
                <Button onClick={() => handleOpenApproveModal(selectedOrder.id)} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
              </>
            )}
            <Button variant="outline" onClick={() => { setIsDetailsModalOpen(false); setSelectedOrder(null); setBranchStocks([]); }}>Close</Button>
          </div>
        </div>
      </div>
    )}

    {/* Rejection Modal */}
    {isRejectModalOpen && selectedOrder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6" />
                <h2 className="text-lg font-bold">Reject Purchase Order</h2>
              </div>
              <Button variant="ghost" onClick={() => { setIsRejectModalOpen(false); setRejectionNote(''); }} className="text-white hover:bg-white/20 rounded-full p-2">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm"><strong>Order:</strong> {selectedOrder.orderId || selectedOrder.id}</p>
              <p className="text-sm"><strong>Supplier:</strong> {selectedOrder.supplierName}</p>
              <p className="text-sm"><strong>Amount:</strong> ₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Note <span className="text-red-500">*</span></label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          <div className="border-t p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsRejectModalOpen(false); setRejectionNote(''); }}>Cancel</Button>
            <Button onClick={handleRejectOrderConfirm} disabled={!rejectionNote.trim()} className="bg-red-600 hover:bg-red-700 text-white">Continue</Button>
          </div>
        </div>
      </div>
    )}

    {/* Approve Confirmation Modal */}
    {isConfirmApproveModalOpen && pendingOrderId && (() => {
      const order = purchaseOrders.find(o => o.id === pendingOrderId);
      if (!order) return null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" />
                <h2 className="text-lg font-bold">Confirm Approval</h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-sm"><strong>Order:</strong> {order.orderId || order.id}</p>
                <p className="text-sm"><strong>Supplier:</strong> {order.supplierName}</p>
                <p className="text-sm"><strong>Branch:</strong> {order.branchName || getBranchName(order.branchId)}</p>
                <p className="text-sm"><strong>Amount:</strong> ₱{(order.totalAmount || 0).toLocaleString()}</p>
              </div>

              {/* Stock Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Current Stock Levels</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Usage Type</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Order Qty</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Current Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {order.items?.map((item, index) => {
                        const usageType = item.usageType || item.usage_type || 'otc';
                        const stockStatus = getStockStatus(item.productId, item.quantity, usageType);
                        const usageTypeDisplay = usageType === 'otc' ? 'OTC' : 'Salon Use';
                        const usageTypeColor = usageType === 'otc' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
                        
                        return (
                          <tr key={index}>
                            <td className="px-3 py-2 font-medium text-gray-900">{item.productName}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${usageTypeColor}`}>
                                {usageTypeDisplay}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                            <td className="px-3 py-2 text-center">
                              {loadingStocks ? (
                                <RefreshCw className="h-3 w-3 animate-spin mx-auto" />
                              ) : (
                                <span className={`flex items-center justify-center gap-1 ${stockStatus.color}`}>
                                  {stockStatus.icon}
                                  {stockStatus.text}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">Approving will change status to "Approved". This action cannot be undone.</p>
              </div>
            </div>
            <div className="border-t p-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setIsConfirmApproveModalOpen(false); setPendingOrderId(null); setBranchStocks([]); }} disabled={isProcessing}>Cancel</Button>
              <Button onClick={handleApproveOrder} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white">
                {isProcessing ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Approving...</> : 'Confirm Approval'}
              </Button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Reject Confirmation Modal */}
    {isConfirmRejectModalOpen && selectedOrder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6" />
              <h2 className="text-lg font-bold">Confirm Rejection</h2>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-sm"><strong>Order:</strong> {selectedOrder.orderId || selectedOrder.id}</p>
              <p className="text-sm"><strong>Amount:</strong> ₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
              <p className="text-sm text-red-700 mt-1">{rejectionNote}</p>
            </div>
          </div>
          <div className="border-t p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsConfirmRejectModalOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button onClick={handleRejectOrder} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 text-white">
              {isProcessing ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Rejecting...</> : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default OverallInventoryControllerPurchaseOrders;
