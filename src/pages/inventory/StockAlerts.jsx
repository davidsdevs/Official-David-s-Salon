// src/pages/06_InventoryController/StockAlerts.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import {
  AlertTriangle,
  Filter,
  Eye,
  Download,
  RefreshCw,
  CheckCircle,
  Package,
  Bell,
  AlertCircle,
  TrendingDown,
  Settings,
  X,
  Printer,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { stockAlertsService } from '../../services/stockAlertsService';
import { getBranches } from '../../services/branchService';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-hot-toast';

const StockAlerts = () => {
  const { userData } = useAuth();
  
  // Data states
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [branches, setBranches] = useState([]);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [alertSettings, setAlertSettings] = useState({
    lowStockThreshold: 10,
    criticalThreshold: 0
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    priority: 'all',
    category: 'all',
    branch: 'all'
  });

  // Load alert settings
  const loadAlertSettings = async () => {
    try {
      setLoadingSettings(true);
      const settingsRef = doc(db, 'stock_alert_settings', 'default');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setAlertSettings({
          lowStockThreshold: data.lowStockThreshold || 10,
          criticalThreshold: data.criticalThreshold || 0
        });
      } else {
        await setDoc(settingsRef, {
          lowStockThreshold: 10,
          criticalThreshold: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setAlertSettings({
          lowStockThreshold: 10,
          criticalThreshold: 0
        });
      }
    } catch (error) {
      console.error('Error loading alert settings:', error);
      setAlertSettings({
        lowStockThreshold: 10,
        criticalThreshold: 0
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  // Save alert settings
  const saveAlertSettings = async () => {
    try {
      setLoadingSettings(true);
      const settingsRef = doc(db, 'stock_alert_settings', 'default');
      await setDoc(settingsRef, {
        lowStockThreshold: parseInt(alertSettings.lowStockThreshold) || 10,
        criticalThreshold: parseInt(alertSettings.criticalThreshold) || 0,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      await refreshAlerts();
      setIsSettingsModalOpen(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving alert settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Load branches
  const loadBranches = async () => {
    try {
      const branchesList = await getBranches(
        userData?.roles?.[0] || 'inventoryController',
        userData?.uid || '',
        1000
      );
      setBranches(branchesList || []);
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  };

  // Load alerts
  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await stockAlertsService.getAllAlerts({
        priority: filters.priority,
        branchId: filters.branch === 'all' ? null : filters.branch,
      });
      
      if (result.success) {
        setAlerts(result.alerts);
      } else {
        setError(result.message || 'Failed to load alerts');
        setAlerts([]);
      }
    } catch (err) {
      console.error('Error loading alerts:', err);
      setError(err.message);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  // Refresh alerts manually
  const refreshAlerts = async () => {
    try {
      setIsRefreshing(true);
      await loadAlerts();
      toast.success('Alerts refreshed');
    } catch (err) {
      console.error('Error refreshing alerts:', err);
      toast.error('Failed to refresh alerts');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load alerts and branches on mount
  useEffect(() => {
    loadBranches();
    loadAlertSettings();
    loadAlerts();
  }, []);

  // Auto-refresh alerts when stocks change
  useEffect(() => {
    const stocksRef = collection(db, 'stocks');
    const stocksQuery = query(
      stocksRef,
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(stocksQuery, async (snapshot) => {
      if (!isRefreshing) {
        setTimeout(async () => {
          try {
            await loadAlerts();
          } catch (error) {
            console.error('Error auto-refreshing alerts:', error);
          }
        }, 1000);
      }
    }, (error) => {
      console.error('Error in stocks listener:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [isRefreshing]);

  // Reload alerts when filters change
  useEffect(() => {
    if (!loading) {
      loadAlerts();
    }
  }, [filters.priority, filters.category, filters.branch]);

  // Get unique categories from alerts
  const categories = [...new Set(alerts.map(a => a.category))].filter(Boolean);

  // Helper function to get branch name from ID
  const getBranchName = (branchId) => {
    if (!branchId) return 'N/A';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branch?.branchName || branchId;
  };

  // Filter and sort alerts
  const filteredAlerts = alerts
    .filter(alert => {
      const matchesSearch = alert.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           alert.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           alert.alertType.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPriority = filters.priority === 'all' || alert.priority === filters.priority;
      const matchesCategory = filters.category === 'all' || alert.category === filters.category;
      const matchesBranch = filters.branch === 'all' || alert.branchId === filters.branch;
      
      return matchesSearch && matchesPriority && matchesCategory && matchesBranch;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'lastRestocked' || sortBy === 'expectedRestock') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  // Handle alert details
  const handleViewDetails = (alert) => {
    setSelectedAlert(alert);
    setIsDetailsModalOpen(true);
  };

  // Export alerts to CSV
  const handleExport = () => {
    try {
      const headers = ['Product Name', 'Current Stock', 'Min Stock', 'Priority', 'Branch', 'Alert Type', 'Created Date', 'Total Value'];
      
      const rows = filteredAlerts.map(alert => [
        alert.productName,
        alert.currentStock,
        alert.minStock,
        alert.priority,
        alert.branchName || getBranchName(alert.branchId),
        alert.alertType,
        format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm'),
        alert.totalValue
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock_alerts_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Exported ${filteredAlerts.length} alerts`);
    } catch (err) {
      console.error('Error exporting alerts:', err);
      toast.error('Failed to export alerts');
    }
  };

  // Print all alerts
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
    if (filters.priority !== 'all') activeFilters.push(`Priority: ${filters.priority}`);
    if (filters.status !== 'all') activeFilters.push(`Status: ${filters.status}`);
    if (filters.branch !== 'all') {
      const branch = branches.find(b => b.id === filters.branch);
      if (branch) activeFilters.push(`Branch: ${branch.name || branch.branchName}`);
    }
    if (filters.alertType !== 'all') activeFilters.push(`Alert Type: ${filters.alertType}`);
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Stock Alerts';

    const printWindow = window.open('', '', 'height=600,width=800');
    
    let htmlContent = `
      <html>
        <head>
          <title>Stock Alerts Report</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: A4 portrait;
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
              padding: 10px;
              color: #000;
              font-size: 9px;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 22px;
              font-weight: 700;
              margin: 0 0 5px 0;
            }
            .header h2 {
              font-size: 16px;
              font-weight: 600;
              margin: 0;
            }
            .filters {
              background: #fff;
              padding: 10px;
              border: 2px solid #333;
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
            .alert-card {
              border: 1px solid #333;
              margin-bottom: 10px;
              background: #fff;
              page-break-inside: avoid;
            }
            .alert-header {
              background: #f5f5f5;
              padding: 8px 12px;
              border-bottom: 1px solid #333;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .alert-name {
              font-size: 11px;
              font-weight: 700;
            }
            .priority-badge {
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
              border: 1px solid #333;
              background: #fff;
              color: #000;
            }
            .alert-body {
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
              width: 100px;
            }
            .info-value {
              color: #333;
            }
            .stock-critical {
              color: #000;
              font-weight: 700;
            }
            .stock-warning {
              color: #000;
              font-weight: 700;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 2px solid #333;
              font-size: 8px;
            }
            .footer-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 10px;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
            .footer-center {
              text-align: center;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #ccc;
              color: #666;
            }
            .footer-center p {
              margin: 3px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Stock Alerts Report</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>

          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-value">${alertStats.totalAlerts}</div>
              <div class="stat-label">Total Alerts</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${alertStats.criticalAlerts}</div>
              <div class="stat-label">Critical</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${alertStats.highPriorityAlerts}</div>
              <div class="stat-label">High Priority</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">₱${alertStats.totalValue.toLocaleString()}</div>
              <div class="stat-label">Total Value</div>
            </div>
          </div>
    `;

    filteredAlerts.forEach(alert => {
      const stockClass = alert.currentStock === 0 ? 'stock-critical' : 'stock-warning';
      
      htmlContent += `
        <div class="alert-card">
          <div class="alert-header">
            <div class="alert-name">${alert.productName}</div>
            <span class="priority-badge">${alert.priority}</span>
          </div>
          
          <div class="alert-body">
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Current Stock:</span>
                <span class="${stockClass}">${alert.currentStock} units</span>
              </div>
              <div class="info-row">
                <span class="info-label">Min Stock:</span>
                <span class="info-value">${alert.minStock} units</span>
              </div>
              <div class="info-row">
                <span class="info-label">Max Stock:</span>
                <span class="info-value">${alert.maxStock} units</span>
              </div>
              <div class="info-row">
                <span class="info-label">Branch:</span>
                <span class="info-value">${alert.branchName || getBranchName(alert.branchId)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Alert Type:</span>
                <span class="info-value">${alert.alertType}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Value:</span>
                <span class="info-value">₱${alert.totalValue.toLocaleString()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Brand:</span>
                <span class="info-value">${alert.brand || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Created:</span>
                <span class="info-value">${format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    htmlContent += `
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Inventory Controller'}<br>
                <strong>Position:</strong> Inventory Controller<br>
                <strong>Branch:</strong> ${branchName}
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br>
                <strong>Time:</strong> ${format(new Date(), 'HH:mm')}
              </div>
            </div>
            <div class="footer-center">
              <p style="font-weight: 600;">Stock Alerts Report - ${filteredAlerts.length} Alerts Total</p>
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

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical': return 'text-red-600 bg-red-100';
      case 'High': return 'text-orange-600 bg-orange-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'Critical': return <AlertCircle className="h-4 w-4" />;
      case 'High': return <AlertTriangle className="h-4 w-4" />;
      case 'Medium': return <Clock className="h-4 w-4" />;
      case 'Low': return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-red-600 bg-red-100';
      case 'Resolved': return 'text-green-600 bg-green-100';
      case 'Dismissed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active': return <AlertTriangle className="h-4 w-4" />;
      case 'Resolved': return <CheckCircle className="h-4 w-4" />;
      case 'Dismissed': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Calculate alert statistics
  const alertStats = {
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.priority === 'Critical').length,
    highPriorityAlerts: alerts.filter(a => a.priority === 'High').length,
    mediumPriorityAlerts: alerts.filter(a => a.priority === 'Medium').length,
    lowPriorityAlerts: alerts.filter(a => a.priority === 'Low').length,
    totalValue: alerts.reduce((sum, a) => sum + (a.totalValue || 0), 0)
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading stock alerts...</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Stock Alerts</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadAlerts} className="flex items-center gap-2">
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
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Alerts</h1>
          <p className="text-gray-600">Real-time notifications for low stock levels. Alerts automatically clear when stock is replenished.</p>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-3 md:p-4 bg-red-50 border border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
                <p className="text-xs md:text-sm text-red-800">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-4">
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Bell className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Alerts</p>
                <p className="text-base md:text-lg lg:text-xl font-bold text-gray-900">{alertStats.totalAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Critical</p>
                <p className="text-base md:text-lg lg:text-xl font-bold text-gray-900">{alertStats.criticalAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <TrendingDown className="h-6 w-6 md:h-8 md:w-8 text-orange-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-base md:text-lg lg:text-xl font-bold text-gray-900">{alertStats.highPriorityAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-base md:text-lg lg:text-xl font-bold text-gray-900">₱{alertStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Settings className="h-6 w-6 md:h-8 md:w-8 text-gray-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Threshold</p>
                <p className="text-base md:text-lg lg:text-xl font-bold text-gray-900">≤ {alertSettings.lowStockThreshold}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filter Row */}
        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Search Bar - 70% width */}
            <div className="flex-1">
              <SearchInput
                placeholder="Search by product name, brand, or alert type..."
                value={searchTerm}
                onChange={setSearchTerm}
                className="w-full text-sm"
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
                title="Print All"
              >
                <Printer className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button 
                variant="outline" 
                onClick={refreshAlerts}
                disabled={isRefreshing}
                className="p-2 md:p-2.5"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 md:h-5 md:w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 md:p-2.5"
                title="Settings"
              >
                <Settings className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Alerts Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{alert.productName}</div>
                      <div className="text-xs text-gray-500">{alert.brand}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-bold text-red-600">{alert.currentStock}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{alert.minStock}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                        {getPriorityIcon(alert.priority)}
                        {alert.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{format(new Date(alert.createdAt), 'MMM dd, yyyy')}</div>
                      <div className="text-xs text-gray-500">{format(new Date(alert.createdAt), 'HH:mm')}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(alert)}
                        className="flex items-center gap-1 text-xs px-2"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination Controls */}
        {filteredAlerts.length > 0 && (
          <Card className="p-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredAlerts.length)} of {filteredAlerts.length} alerts
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8 h-8 p-0"
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3"
              >
                Next
              </Button>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {filteredAlerts.length === 0 && (
          <Card className="p-6 md:p-8 lg:p-12 text-center">
            <Bell className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mx-auto mb-3 md:mb-4" />
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">No Stock Alerts Found</h3>
            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all')
                ? 'Try adjusting your search or filters'
                : 'Great! No stock alerts at the moment'
              }
            </p>
          </Card>
        )}

        {/* Alert Details Modal */}
        {isDetailsModalOpen && selectedAlert && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedAlert(null);
            }}
            title="Alert Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Alert Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedAlert.productName}</h2>
                  <p className="text-gray-600">{selectedAlert.brand} • {selectedAlert.category}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedAlert.priority)}`}>
                  {getPriorityIcon(selectedAlert.priority)}
                  {selectedAlert.priority}
                </span>
              </div>

              {/* Stock Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Stock</label>
                  <p className="text-2xl font-bold text-red-600">{selectedAlert.currentStock} units</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Minimum Stock</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedAlert.minStock} units</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Maximum Stock</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedAlert.maxStock || 100} units</p>
                </div>
              </div>

              {/* Stock Level Indicator */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Stock Level</h4>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      selectedAlert.currentStock <= selectedAlert.minStock ? 'bg-red-500' :
                      selectedAlert.currentStock <= selectedAlert.minStock * 1.5 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min((selectedAlert.currentStock / (selectedAlert.maxStock || 100)) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>0</span>
                  <span>{selectedAlert.minStock} (Min)</span>
                  <span>{selectedAlert.maxStock || 100} (Max)</span>
                </div>
              </div>

              {/* Alert Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Alert Type</label>
                  <p className="text-gray-900">{selectedAlert.alertType}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900">{format(new Date(selectedAlert.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This alert will automatically clear once stock is replenished above the minimum threshold.
                </p>
              </div>
            </div>
          </Modal>
        )}

        {/* Filter Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Filter Alerts"
            size="md"
          >
            <div className="space-y-6">
              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                <select
                  value={filters.branch}
                  onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      priority: 'all',
                      category: 'all',
                      branch: 'all'
                    });
                  }}
                  className="flex-1"
                >
                  Reset Filters
                </Button>
                <Button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Settings Modal */}
        {isSettingsModalOpen && (
          <Modal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            title="Stock Alert Settings"
            size="md"
          >
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Configure the threshold for automatic stock alerts. Alerts will be generated when product stock falls below these values.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Low Stock Threshold
                  <span className="text-gray-500 text-xs ml-2">(Default: 10)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  value={alertSettings.lowStockThreshold}
                  onChange={(e) => setAlertSettings({
                    ...alertSettings,
                    lowStockThreshold: parseInt(e.target.value) || 10
                  })}
                  placeholder="10"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alert will be triggered when realTimeStock is ≤ {alertSettings.lowStockThreshold}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Critical Stock Threshold
                  <span className="text-gray-500 text-xs ml-2">(Default: 0)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  value={alertSettings.criticalThreshold}
                  onChange={(e) => setAlertSettings({
                    ...alertSettings,
                    criticalThreshold: parseInt(e.target.value) || 0
                  })}
                  placeholder="0"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Critical alert will be triggered when realTimeStock is ≤ {alertSettings.criticalThreshold}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Settings:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Low Stock Alert: realTimeStock ≤ {alertSettings.lowStockThreshold}</li>
                  <li>• Critical Alert: realTimeStock ≤ {alertSettings.criticalThreshold}</li>
                  <li>• Alerts are automatically generated when stock changes</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSettingsModalOpen(false)}
                  disabled={loadingSettings}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={saveAlertSettings}
                  disabled={loadingSettings}
                  className="flex items-center gap-2"
                >
                  {loadingSettings ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
};

export default StockAlerts;
