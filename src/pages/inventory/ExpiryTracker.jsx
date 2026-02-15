// src/pages/06_InventoryController/ExpiryTracker.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import {
  Calendar,
  Search,
  Filter,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  FileText,
  Bell,
  TrendingDown,
  ShoppingCart,
  Trash2,
  X,
  Home,
  TrendingUp,
  ArrowRightLeft,
  QrCode,
  BarChart3,
  ClipboardList,
  UserCog,
  Truck,
  PackageCheck,
  Download,
  Printer
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { inventoryService } from '../../services/inventoryService';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-hot-toast';

const ExpiryTracker = () => {
  const { userData } = useAuth();
  
  
  
  // Data states
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productsMap, setProductsMap] = useState({}); // { productId: productName }
  const [usersMap, setUsersMap] = useState({}); // { userId: userName }
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDaysAhead, setSelectedDaysAhead] = useState(30);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Load batches on mount
  useEffect(() => {
    if (userData?.branchId) {
      loadBatches();
      // Auto-update expiration status every time batches are loaded
      updateExpirationStatus();
    }
  }, [userData?.branchId]);

  // Load product names - returns map directly
  const loadProductsMap = async () => {
    try {
      const productsRef = collection(db, 'products');
      const productsSnapshot = await getDocs(productsRef);
      const products = {};
      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        products[doc.id] = data.name || 'Unknown Product';
      });
      setProductsMap(products);
      return products;
    } catch (err) {
      console.error('Error loading products:', err);
      return {};
    }
  };

  // Load user names - returns map directly
  const loadUsersMap = async () => {
    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const users = {};
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const userName = (data.firstName && data.lastName 
          ? `${data.firstName} ${data.lastName}`.trim() 
          : data.name || data.email || 'Unknown User');
        users[doc.id] = userName;
      });
      setUsersMap(users);
      return users;
    } catch (err) {
      console.error('Error loading users:', err);
      return {};
    }
  };

  const loadBatches = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userData?.branchId) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }

      // Load products and users first and get their maps
      const productsMapData = await loadProductsMap();
      const usersMapData = await loadUsersMap();

      // Only show batches for this Inventory Controller's branch (no branch filtering needed)
      const batchesResult = await inventoryService.getBranchBatches(userData.branchId); // Automatically filtered to user's branch only
      if (!batchesResult.success) {
        throw new Error(batchesResult.message || 'Failed to load batches');
      }

      // Enrich batches with product names and user names
      const enrichedBatches = batchesResult.batches.map(batch => ({
        ...batch,
        productName: batch.productName || productsMapData[batch.productId] || 'Unknown Product',
        receivedByName: batch.receivedBy ? (usersMapData[batch.receivedBy] || batch.receivedBy) : null
      }));

      setBatches(enrichedBatches);
    } catch (err) {
      console.error('Error loading batches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateExpirationStatus = async () => {
    if (!userData?.branchId) return;
    try {
      // Only update batches for this Inventory Controller's branch
      await inventoryService.updateBatchExpirationStatus(userData.branchId);
    } catch (err) {
      console.error('Error updating expiration status:', err);
    }
  };

  // Calculate expiry status for a batch
  const getExpiryStatus = (expirationDate) => {
    if (!expirationDate) return 'No Expiry';
    
    const expiry = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    
    const daysUntilExpiry = differenceInDays(expiry, today);
    
    if (daysUntilExpiry < 0) return 'Expired';
    if (daysUntilExpiry <= 7) return 'Critical';
    if (daysUntilExpiry <= 30) return 'Expiring Soon';
    return 'Good';
  };

  // Filter batches
  const filteredBatches = useMemo(() => {
    let filtered = batches.filter(batch => {
      // Filter by search term
      const matchesSearch = 
        batch.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.purchaseOrderId?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filter by status
      const status = getExpiryStatus(batch.expirationDate);
      const matchesStatus = selectedStatus === 'all' || 
        (selectedStatus === 'active' && batch.status === 'active') ||
        (selectedStatus === 'expired' && (batch.status === 'expired' || status === 'Expired')) ||
        (selectedStatus === 'depleted' && batch.status === 'depleted') ||
        (selectedStatus === 'critical' && status === 'Critical') ||
        (selectedStatus === 'expiring_soon' && status === 'Expiring Soon') ||
        (selectedStatus === 'good' && status === 'Good');

      // Filter by days ahead (only for active batches with expiration dates)
      let matchesDaysAhead = true;
      if (selectedDaysAhead !== 'all' && batch.expirationDate && batch.status === 'active') {
        const daysLeft = differenceInDays(batch.expirationDate, new Date());
        matchesDaysAhead = daysLeft >= 0 && daysLeft <= selectedDaysAhead;
      }

      return matchesSearch && matchesStatus && matchesDaysAhead && batch.remainingQuantity > 0;
    });

    // Sort by expiration date (soonest first)
    filtered.sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0;
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      
      const aDate = a.expirationDate instanceof Date ? a.expirationDate : new Date(a.expirationDate);
      const bDate = b.expirationDate instanceof Date ? b.expirationDate : new Date(b.expirationDate);
      return aDate.getTime() - bDate.getTime();
    });

    return filtered;
  }, [batches, searchTerm, selectedStatus, selectedDaysAhead]);

  // Calculate statistics
  const stats = useMemo(() => {
    const activeBatches = batches.filter(b => b.status === 'active' && b.remainingQuantity > 0);
    const expiredBatches = batches.filter(b => b.status === 'expired' || (b.expirationDate && differenceInDays(new Date(b.expirationDate), new Date()) < 0));
    
    let criticalCount = 0;
    let expiringSoonCount = 0;
    let goodCount = 0;
    let totalValue = 0;
    let atRiskValue = 0;

    activeBatches.forEach(batch => {
      if (!batch.expirationDate) return;
      
      const status = getExpiryStatus(batch.expirationDate);
      const value = (batch.remainingQuantity || 0) * (batch.unitCost || 0);
      totalValue += value;

      if (status === 'Critical') {
        criticalCount++;
        atRiskValue += value;
      } else if (status === 'Expiring Soon') {
        expiringSoonCount++;
        atRiskValue += value;
      } else if (status === 'Good') {
        goodCount++;
      }
    });

    return {
      totalBatches: activeBatches.length,
      goodBatches: goodCount,
      expiringSoon: expiringSoonCount,
      criticalBatches: criticalCount,
      expiredBatches: expiredBatches.length,
      totalValue: totalValue,
      atRiskValue: atRiskValue
    };
  }, [batches]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Good': return 'text-green-600 bg-green-100 border-green-200';
      case 'Expiring Soon': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Critical': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'Expired': return 'text-red-600 bg-red-100 border-red-200';
      case 'No Expiry': return 'text-gray-600 bg-gray-100 border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Good': return <CheckCircle className="h-3 w-3" />;
      case 'Expiring Soon': return <Clock className="h-3 w-3" />;
      case 'Critical': return <AlertTriangle className="h-3 w-3" />;
      case 'Expired': return <XCircle className="h-3 w-3" />;
      default: return <Package className="h-3 w-3" />;
    }
  };

  // Export batches to CSV
  const handleExport = () => {
    try {
      const headers = ['Product', 'Batch Number', 'Purchase Order', 'Quantity', 'Expiration Date', 'Days Left', 'Status', 'Unit Cost', 'Total Value'];
      
      const rows = filteredBatches.map(batch => {
        const status = getExpiryStatus(batch.expirationDate);
        const daysLeft = batch.expirationDate 
          ? differenceInDays(batch.expirationDate, new Date())
          : null;
        const batchValue = (batch.remainingQuantity || 0) * (batch.unitCost || 0);
        
        return [
          batch.productName || productsMap[batch.productId] || 'Unknown Product',
          batch.batchNumber || 'N/A',
          batch.purchaseOrderId || 'N/A',
          `${batch.remainingQuantity || 0} / ${batch.quantity || 0}`,
          batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'No Expiry',
          daysLeft === null ? 'N/A' : daysLeft < 0 ? 'Expired' : `${daysLeft} days`,
          status,
          batch.unitCost || 0,
          batchValue
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expiry_tracker_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Exported ${filteredBatches.length} batches`);
    } catch (err) {
      console.error('Error exporting batches:', err);
      toast.error('Failed to export batches');
    }
  };

  // Print all batches
  const handlePrintAll = async () => {
    // Get branch name if not available in userData
    let branchName = userData?.branchName || 'N/A';
    if (branchName === 'N/A' && userData?.branchId) {
      try {
        const { getBranchById } = await import('../../services/branchService');
        const branch = await getBranchById(userData.branchId);
        branchName = branch?.name || branch?.branchName || 'N/A';
      } catch (error) {
        console.error('Error fetching branch name:', error);
        branchName = 'N/A';
      }
    }

    // Build filters display
    const activeFilters = [];
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    if (selectedStatus !== 'all') activeFilters.push(`Status: ${selectedStatus}`);
    if (selectedDaysAhead) activeFilters.push(`Days Ahead: ${selectedDaysAhead} days`);
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Batches';

    const printWindow = window.open('', '', 'height=600,width=800');
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Batch Expiration Report</title>
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
            .batch-card {
              border: 1px solid #333;
              margin-bottom: 10px;
              background: #fff;
              page-break-inside: avoid;
            }
            .batch-header {
              background: #fff;
              padding: 8px 12px;
              border-bottom: 1px solid #333;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .batch-name {
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
            .batch-body {
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
            <h2>Batch Expiration Report</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>

          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-value">${stats.totalBatches}</div>
              <div class="stat-label">Total Batches</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.goodBatches}</div>
              <div class="stat-label">Good</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.expiringSoon}</div>
              <div class="stat-label">Expiring Soon</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.expired}</div>
              <div class="stat-label">Expired</div>
            </div>
          </div>
    `;

    filteredBatches.forEach(batch => {
      const status = getExpiryStatus(batch.expirationDate);
      const daysLeft = batch.expirationDate 
        ? differenceInDays(batch.expirationDate, new Date())
        : null;
      const batchValue = (batch.remainingQuantity || 0) * (batch.unitCost || 0);
      
      htmlContent += `
        <div class="batch-card">
          <div class="batch-header">
            <div class="batch-name">${batch.productName || productsMap[batch.productId] || 'Unknown Product'}</div>
            <span class="status-badge">${status}</span>
          </div>
          
          <div class="batch-body">
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Batch Number:</span>
                <span class="info-value">${batch.batchNumber || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Purchase Order:</span>
                <span class="info-value">${batch.purchaseOrderId || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Quantity:</span>
                <span class="info-value">${batch.remainingQuantity || 0} / ${batch.quantity || 0} units</span>
              </div>
              <div class="info-row">
                <span class="info-label">Expiration Date:</span>
                <span class="info-value">${batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'No Expiry'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Days Left:</span>
                <span class="info-value">${daysLeft === null ? 'N/A' : daysLeft < 0 ? 'Expired' : `${daysLeft} days`}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Unit Cost:</span>
                <span class="info-value">₱${(batch.unitCost || 0).toLocaleString()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Value:</span>
                <span class="info-value">₱${batchValue.toLocaleString()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Received Date:</span>
                <span class="info-value">${batch.receivedDate ? format(new Date(batch.receivedDate), 'MMM dd, yyyy') : 'N/A'}</span>
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
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Inventory Controller'}<br>
                <strong>Position:</strong> Inventory Controller<br>
                <strong>Branch:</strong> ${branchName}
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
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (loading && batches.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-[#160B53]" />
          <span className="ml-2 text-gray-600">Loading batch expiration data...</span>
        </div>
      </>
    );
  }

  if (error && !userData?.branchId) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Batch Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadBatches} className="flex items-center gap-2 mx-auto">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batch Expiration Tracker</h1>
          <p className="text-gray-600">Monitor product batches and expiration dates</p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 lg:gap-4">
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Batches</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.totalBatches}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Good</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.goodBatches}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Clock className="h-6 w-6 md:h-8 md:w-8 text-yellow-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Expiring Soon</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.expiringSoon}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-orange-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Critical</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.criticalBatches}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <XCircle className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Expired</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.expiredBatches}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <TrendingDown className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">At Risk Value</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">₱{stats.atRiskValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filter Row */}
        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Search Bar - 70% width */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by product name, batch number, or PO ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 text-sm"
              />
            </div>
            
            {/* Icon Buttons Only */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="outline"
                onClick={() => setIsFilterModalOpen(true)}
                className="p-2 md:p-2.5"
                title="Filter"
              >
                <Filter className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                className="p-2 md:p-2.5"
                title="Export"
              >
                <Download className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button
                variant="outline"
                onClick={handlePrintAll}
                className="p-2 md:p-2.5"
                title="Print"
              >
                <Printer className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Batches Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Batch Number
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Purchase Order
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Left
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Usage Type
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Value
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-2 md:px-4 py-4 md:py-8 text-center text-xs md:text-sm text-gray-500">
                      {batches.length === 0 
                        ? 'No batches found. Batches will be created when purchase orders are marked as delivered.'
                        : 'No batches match your filters. Try adjusting your search or filters.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch) => {
                    const status = getExpiryStatus(batch.expirationDate);
                    const daysLeft = batch.expirationDate 
                      ? differenceInDays(batch.expirationDate, new Date())
                      : null;
                    const batchValue = (batch.remainingQuantity || 0) * (batch.unitCost || 0);
                    
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-2 md:px-4 py-2 md:py-4">
                          <div>
                            <div className="text-xs md:text-sm font-semibold text-gray-900">{batch.productName || productsMap[batch.productId] || 'Unknown Product'}</div>
                            <div className="text-xs text-gray-500 mt-1 hidden md:block">ID: {batch.productId}</div>
                          </div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden md:table-cell">
                          <div className="text-xs md:text-sm font-medium text-gray-900">{batch.batchNumber || 'N/A'}</div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden lg:table-cell">
                          <div className="text-xs md:text-sm text-gray-900">{batch.purchaseOrderId || 'N/A'}</div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <div className="text-xs md:text-sm text-gray-900">
                            {batch.remainingQuantity || 0} / {batch.quantity || 0}
                          </div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <div className="text-xs md:text-sm text-gray-900">
                            {batch.expirationDate 
                              ? format(new Date(batch.expirationDate), 'MMM dd, yyyy')
                              : 'No Expiry'}
                          </div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <div className={`text-xs md:text-sm font-medium ${
                            daysLeft === null ? 'text-gray-600' :
                            daysLeft < 0 ? 'text-red-600' : 
                            daysLeft <= 7 ? 'text-orange-600' : 
                            daysLeft <= 30 ? 'text-yellow-600' : 
                            'text-green-600'
                          }`}>
                            {daysLeft === null ? 'N/A' : daysLeft < 0 ? 'Expired' : `${daysLeft} days`}
                          </div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden lg:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            (batch.usageType || 'otc') === 'salon-use'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {(batch.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC'}
                          </span>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-medium border ${getStatusColor(status)}`}>
                            {getStatusIcon(status)}
                            <span className="hidden sm:inline">{status}</span>
                          </span>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden md:table-cell">
                          <div className="text-xs md:text-sm font-medium text-gray-900">₱{batchValue.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">₱{(batch.unitCost || 0).toLocaleString()}/unit</div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setIsDetailsModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-xs md:text-sm px-2 md:px-3"
                          >
                            <Eye className="h-3 w-3 md:h-3.5 md:w-3.5" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Batch Details Modal */}
        {isDetailsModalOpen && selectedBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Package className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Batch Details</h2>
                      <p className="text-white/80 text-sm mt-1">{selectedBatch.batchNumber}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setSelectedBatch(null);
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Batch Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedBatch.productName || productsMap[selectedBatch.productId] || 'Unknown Product'}</h3>
                      <p className="text-gray-600">Batch: {selectedBatch.batchNumber || 'N/A'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(getExpiryStatus(selectedBatch.expirationDate))}`}>
                      {getStatusIcon(getExpiryStatus(selectedBatch.expirationDate))}
                      {getExpiryStatus(selectedBatch.expirationDate)}
                    </span>
                  </div>

                  {/* Batch Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Product Name</label>
                        <p className="text-gray-900 font-semibold">{selectedBatch.productName || productsMap[selectedBatch.productId] || 'Unknown Product'}</p>
                        <p className="text-xs text-gray-500 mt-1">ID: {selectedBatch.productId}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Purchase Order</label>
                        <p className="text-gray-900">{selectedBatch.purchaseOrderId || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Received Date</label>
                        <p className="text-gray-900">
                          {selectedBatch.receivedDate 
                            ? format(new Date(selectedBatch.receivedDate), 'MMM dd, yyyy')
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Received By</label>
                        <p className="text-gray-900">
                          {selectedBatch.receivedByName || 
                           (selectedBatch.receivedBy ? (usersMap[selectedBatch.receivedBy] || selectedBatch.receivedBy) : 'Unknown')}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Expiration Date</label>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedBatch.expirationDate 
                            ? format(new Date(selectedBatch.expirationDate), 'MMM dd, yyyy')
                            : 'No Expiry Date'}
                        </p>
                        {selectedBatch.expirationDate && (
                          <p className={`text-sm mt-1 ${
                            differenceInDays(new Date(selectedBatch.expirationDate), new Date()) < 0 
                              ? 'text-red-600' 
                              : differenceInDays(new Date(selectedBatch.expirationDate), new Date()) <= 7
                              ? 'text-orange-600'
                              : 'text-gray-600'
                          }`}>
                            {differenceInDays(new Date(selectedBatch.expirationDate), new Date()) < 0 
                              ? 'Expired' 
                              : `${differenceInDays(new Date(selectedBatch.expirationDate), new Date())} days remaining`}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Quantity</label>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedBatch.remainingQuantity || 0} / {selectedBatch.quantity || 0} units
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {((selectedBatch.remainingQuantity || 0) / (selectedBatch.quantity || 1) * 100).toFixed(1)}% remaining
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Unit Cost</label>
                        <p className="text-gray-900">₱{(selectedBatch.unitCost || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Value</label>
                        <p className="text-2xl font-bold text-[#160B53]">
                          ₱{((selectedBatch.remainingQuantity || 0) * (selectedBatch.unitCost || 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setSelectedBatch(null);
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Filter Batches</h2>
                  <Button
                    variant="ghost"
                    onClick={() => setIsFilterModalOpen(false)}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="good">Good (30+ days)</option>
                    <option value="expiring_soon">Expiring Soon (8-30 days)</option>
                    <option value="critical">Critical (0-7 days)</option>
                    <option value="expired">Expired</option>
                    <option value="depleted">Depleted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                  <select
                    value={selectedDaysAhead}
                    onChange={(e) => setSelectedDaysAhead(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="7">Next 7 Days</option>
                    <option value="30">Next 30 Days</option>
                    <option value="60">Next 60 Days</option>
                    <option value="90">Next 90 Days</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedDaysAhead(30);
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Reset
                </Button>
                <Button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-[#160B53] text-white hover:bg-[#12094A]"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ExpiryTracker;
