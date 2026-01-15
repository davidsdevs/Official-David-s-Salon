// Stock Alerts for Overall Inventory Controller
// Loads alerts from ALL branches with pagination, filters, and export
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
  Clock,
  Building,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { stockAlertsService } from '../../services/stockAlertsService';
import { getAllBranches } from '../../services/branchService';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-hot-toast';
import { exportToExcel } from '../../utils/excelExport';

const ITEMS_PER_PAGE = 20;

const OverallStockAlerts = () => {
  const { userData } = useAuth();
  
  // Data states
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [branches, setBranches] = useState([]);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [alertSettings, setAlertSettings] = useState({
    lowStockThreshold: 10,
    criticalThreshold: 0
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    priority: 'all',
    branch: 'all',
    usageType: 'all'
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
      }
    } catch (error) {
      console.error('Error loading alert settings:', error);
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
      
      await generateAlerts();
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
      const branchesList = await getAllBranches();
      setBranches(Array.isArray(branchesList) ? branchesList.filter(b => b.isActive !== false) : []);
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  };

  // Load alerts from ALL branches
  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use getAllAlerts without branch filter to get alerts from all branches
      const result = await stockAlertsService.getAllAlerts({
        priority: filters.priority !== 'all' ? filters.priority : null,
        branchId: filters.branch !== 'all' ? filters.branch : null,
        status: 'Active' // Only show active alerts
      });
      
      if (result.success) {
        // Enrich alerts with branch names
        const enrichedAlerts = result.alerts.map(alert => {
          const branch = branches.find(b => b.id === alert.branchId);
          return {
            ...alert,
            branchName: alert.branchName || branch?.name || branch?.branchName || 'Unknown Branch'
          };
        });
        setAlerts(enrichedAlerts);
        
        // If no alerts found and this is initial load, generate them
        if (enrichedAlerts.length === 0 && filters.priority === 'all' && filters.branch === 'all' && filters.usageType === 'all') {
          // Will be handled by the auto-generate useEffect
        }
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

  // Generate alerts from stock data
  const generateAlerts = async () => {
    try {
      setIsRefreshing(true);
      toast.loading('Generating alerts from stock data...', { id: 'generate-alerts' });
      
      const result = await stockAlertsService.generateAlertsForLowStock(null, alertSettings);
      
      if (result.success) {
        toast.success(`Generated ${result.alertsCreated} new alerts`, { id: 'generate-alerts' });
        await loadAlerts();
      } else {
        toast.error(result.message || 'Failed to generate alerts', { id: 'generate-alerts' });
      }
    } catch (err) {
      console.error('Error generating alerts:', err);
      toast.error('Failed to generate alerts', { id: 'generate-alerts' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Refresh alerts manually
  const refreshAlerts = async () => {
    try {
      setIsRefreshing(true);
      await generateAlerts();
      toast.success('Alerts refreshed');
    } catch (err) {
      console.error('Error refreshing alerts:', err);
      toast.error('Failed to refresh alerts');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadBranches();
    loadAlertSettings();
  }, []);

  // Load alerts when branches are loaded - auto-generate if none exist
  useEffect(() => {
    const initializeAlerts = async () => {
      if (branches.length > 0) {
        // First try to load existing alerts
        await loadAlerts();
      }
    };
    initializeAlerts();
  }, [branches]);

  // Auto-generate alerts if none exist after initial load
  useEffect(() => {
    const autoGenerate = async () => {
      if (!loading && branches.length > 0 && alerts.length === 0 && !isRefreshing) {
        // No alerts found, generate them automatically
        await generateAlerts();
      }
    };
    autoGenerate();
  }, [loading, branches.length, alerts.length]);

  // Reload alerts when filters change
  useEffect(() => {
    if (branches.length > 0 && !loading) {
      loadAlerts();
    }
  }, [filters.priority, filters.branch, filters.usageType]);

  // Helper function to get branch name from ID
  const getBranchName = (branchId) => {
    if (!branchId) return 'N/A';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branch?.branchName || branchId;
  };

  // Filter and sort alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          (alert.productName || '').toLowerCase().includes(searchLower) ||
          (alert.brand || '').toLowerCase().includes(searchLower) ||
          (alert.branchName || '').toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Usage type filter
      if (filters.usageType !== 'all') {
        const alertUsageType = alert.usageType || 'otc';
        if (alertUsageType !== filters.usageType) return false;
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by priority (Critical first) then by date
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      const aPriority = priorityOrder[a.priority] ?? 4;
      const bPriority = priorityOrder[b.priority] ?? 4;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [alerts, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE);
  const paginatedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAlerts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAlerts, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  // Handle alert details
  const handleViewDetails = (alert) => {
    setSelectedAlert(alert);
    setIsDetailsModalOpen(true);
  };

  // Export alerts to Excel
  const handleExport = () => {
    try {
      const exportData = filteredAlerts.map(alert => ({
        'Branch': alert.branchName || getBranchName(alert.branchId),
        'Product Name': alert.productName,
        'Brand': alert.brand || 'N/A',
        'Current Stock': alert.currentStock,
        'Min Stock': alert.minStock,
        'Priority': alert.priority,
        'Usage Type': (alert.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC',
        'Total Value': alert.totalValue || 0,
        'Created Date': format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm')
      }));

      if (exportData.length === 0) {
        toast.error('No data to export');
        return;
      }

      exportToExcel(exportData, `StockAlerts_${format(new Date(), 'yyyyMMdd_HHmmss')}`, 'Stock Alerts');
      toast.success(`Exported ${filteredAlerts.length} alerts`);
    } catch (err) {
      console.error('Error exporting alerts:', err);
      toast.error('Failed to export alerts');
    }
  };

  // Print all alerts
  const handlePrintAll = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    
    let htmlContent = `
      <html>
        <head>
          <title>Stock Alerts Report - All Branches</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            h1 { text-align: center; color: #333; }
            .summary { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .priority-critical { color: #dc2626; font-weight: bold; }
            .priority-high { color: #ea580c; font-weight: bold; }
            .priority-medium { color: #ca8a04; }
            .priority-low { color: #2563eb; }
          </style>
        </head>
        <body>
          <h1>Stock Alerts Report - All Branches</h1>
          <div class="summary">
            <p>Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}</p>
            <p>Total Active Alerts: ${filteredAlerts.length} | Total Value at Risk: ₱${alertStats.totalValue.toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Product</th>
                <th>Current Stock</th>
                <th>Min Stock</th>
                <th>Priority</th>
                <th>Usage</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
    `;

    filteredAlerts.forEach(alert => {
      const priorityClass = `priority-${alert.priority.toLowerCase()}`;
      const usageType = (alert.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC';
      htmlContent += `
        <tr>
          <td>${alert.branchName || getBranchName(alert.branchId)}</td>
          <td>${alert.productName}<br/><small>${alert.brand || ''}</small></td>
          <td class="${alert.currentStock === 0 ? 'priority-critical' : ''}">${alert.currentStock}</td>
          <td>${alert.minStock}</td>
          <td class="${priorityClass}">${alert.priority}</td>
          <td>${usageType}</td>
          <td>₱${(alert.totalValue || 0).toLocaleString()}</td>
        </tr>
      `;
    });

    htmlContent += `
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Low': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'Critical': return <AlertCircle className="h-3 w-3" />;
      case 'High': return <AlertTriangle className="h-3 w-3" />;
      case 'Medium': return <Clock className="h-3 w-3" />;
      case 'Low': return <Bell className="h-3 w-3" />;
      default: return <Bell className="h-3 w-3" />;
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilters({ priority: 'all', branch: 'all', usageType: 'all' });
    setCurrentPage(1);
  };

  // Calculate alert statistics
  const alertStats = useMemo(() => ({
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.priority === 'Critical').length,
    highPriorityAlerts: alerts.filter(a => a.priority === 'High').length,
    mediumPriorityAlerts: alerts.filter(a => a.priority === 'Medium').length,
    lowPriorityAlerts: alerts.filter(a => a.priority === 'Low').length,
    totalValue: alerts.reduce((sum, a) => sum + (a.totalValue || 0), 0),
    branchesAffected: new Set(alerts.map(a => a.branchId)).size
  }), [alerts]);

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading stock alerts from all branches...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6 p-4 md:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Stock Alerts</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">Real-time low stock notifications across all branches</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={filteredAlerts.length === 0} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={handlePrintAll} disabled={filteredAlerts.length === 0} className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={refreshAlerts} disabled={isRefreshing} className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></Button>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="p-3">
            <div className="flex items-center">
              <Bell className="h-6 w-6 text-blue-600" />
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">Total Alerts</p>
                <p className="text-lg font-bold text-gray-900">{alertStats.totalAlerts}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">Critical</p>
                <p className="text-lg font-bold text-gray-900">{alertStats.criticalAlerts}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center">
              <TrendingDown className="h-6 w-6 text-orange-600" />
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">High Priority</p>
                <p className="text-lg font-bold text-gray-900">{alertStats.highPriorityAlerts}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center">
              <Package className="h-6 w-6 text-purple-600" />
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">Total Value</p>
                <p className="text-lg font-bold text-gray-900">₱{alertStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center">
              <Building className="h-6 w-6 text-indigo-600" />
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">Branches</p>
                <p className="text-lg font-bold text-gray-900">{alertStats.branchesAffected}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 cursor-pointer hover:bg-gray-50" onClick={() => setIsSettingsModalOpen(true)}>
            <div className="flex items-center">
              <Settings className="h-6 w-6 text-gray-600" />
              <div className="ml-2">
                <p className="text-xs font-medium text-gray-600">Threshold</p>
                <p className="text-lg font-bold text-gray-900">≤ {alertSettings.lowStockThreshold}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by product, brand, branch..."
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
                  {(filters.priority !== 'all' || filters.branch !== 'all' || filters.usageType !== 'all') && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                      {[filters.priority !== 'all', filters.branch !== 'all', filters.usageType !== 'all'].filter(Boolean).length}
                    </span>
                  )}
                </Button>
                <Button variant="outline" onClick={handleResetFilters}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    value={filters.branch}
                    onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Branches</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name || branch.branchName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Type</label>
                  <select
                    value={filters.usageType}
                    onChange={(e) => setFilters(prev => ({ ...prev, usageType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="otc">OTC</option>
                    <option value="salon-use">Salon Use</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Alerts Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Min</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Usage</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Value</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-gray-500">Loading alerts...</p>
                    </td>
                  </tr>
                ) : paginatedAlerts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      <Bell className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="font-medium">No Stock Alerts Found</p>
                      <p className="text-sm mt-1">
                        {searchTerm || Object.values(filters).some(f => f !== 'all')
                          ? 'Try adjusting your search or filters'
                          : 'Great! No stock alerts at the moment'
                        }
                      </p>
                      <Button onClick={refreshAlerts} className="mt-4" disabled={isRefreshing}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Generate Alerts
                      </Button>
                    </td>
                  </tr>
                ) : (
                  paginatedAlerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-900 truncate max-w-[100px]">{alert.branchName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{alert.productName}</div>
                        <div className="text-xs text-gray-500">{alert.brand}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className={`text-sm font-bold ${alert.currentStock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                          {alert.currentStock}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm text-gray-900">{alert.minStock}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(alert.priority)}`}>
                          {getPriorityIcon(alert.priority)}
                          <span className="hidden sm:inline">{alert.priority}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          (alert.usageType || 'otc') === 'salon-use' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {(alert.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC'}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <div className="text-sm font-medium text-gray-900">₱{(alert.totalValue || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewDetails(alert)} className="px-2 py-1">
                          <Eye className="h-4 w-4" />
                        </Button>
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
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAlerts.length)} of {filteredAlerts.length} alerts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
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

      {/* Alert Details Modal */}
      {isDetailsModalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Alert Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setIsDetailsModalOpen(false)} className="text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Product Info */}
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedAlert.productName}</h3>
                <p className="text-gray-600">{selectedAlert.brand} • {selectedAlert.category}</p>
              </div>

              {/* Priority Badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(selectedAlert.priority)}`}>
                  {getPriorityIcon(selectedAlert.priority)}
                  {selectedAlert.priority} Priority
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                  {selectedAlert.alertType}
                </span>
              </div>

              {/* Stock Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Current Stock</p>
                  <p className="text-2xl font-bold text-red-600">{selectedAlert.currentStock} units</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Minimum Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedAlert.minStock} units</p>
                </div>
              </div>

              {/* Branch Info */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Branch</p>
                    <p className="font-semibold text-gray-900">{selectedAlert.branchName || getBranchName(selectedAlert.branchId)}</p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Total Value</span>
                  <span className="font-semibold">₱{(selectedAlert.totalValue || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Unit Cost</span>
                  <span className="font-semibold">₱{(selectedAlert.unitCost || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Max Stock</span>
                  <span className="font-semibold">{selectedAlert.maxStock || 'N/A'} units</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Created</span>
                  <span className="font-semibold">{format(new Date(selectedAlert.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                </div>
                {selectedAlert.supplier && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Supplier</span>
                    <span className="font-semibold">{selectedAlert.supplier}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedAlert.notes && (
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-gray-900">{selectedAlert.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-xl">
              <Button onClick={() => setIsDetailsModalOpen(false)} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Alert Settings
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setIsSettingsModalOpen(false)} className="text-white hover:bg-white/20">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                <Input
                  type="number"
                  min="1"
                  value={alertSettings.lowStockThreshold}
                  onChange={(e) => setAlertSettings(prev => ({ ...prev, lowStockThreshold: parseInt(e.target.value) || 10 }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Products with stock at or below this level will trigger alerts</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Critical Threshold</label>
                <Input
                  type="number"
                  min="0"
                  value={alertSettings.criticalThreshold}
                  onChange={(e) => setAlertSettings(prev => ({ ...prev, criticalThreshold: parseInt(e.target.value) || 0 }))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Products at or below this level will be marked as Critical priority</p>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex gap-2">
              <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={saveAlertSettings} disabled={loadingSettings} className="flex-1">
                {loadingSettings ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Save & Regenerate
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OverallStockAlerts;
