// src/pages/06_InventoryController/StockAlerts.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import {
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Edit,
  Plus,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Calendar,
  Building,
  FileText,
  Bell,
  AlertCircle,
  TrendingDown,
  ShoppingCart,
  ArrowRight,
  Settings,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { stockAlertsService } from '../../services/stockAlertsService';
import { getBranches } from '../../services/branchService';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

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
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isGeneratingAlerts, setIsGeneratingAlerts] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [alertSettings, setAlertSettings] = useState({
    lowStockThreshold: 10, // Default: alert when realTimeStock <= 10
    criticalThreshold: 0 // Alert when realTimeStock === 0
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    priority: 'all',
    status: 'all',
    category: 'all',
    branch: 'all'
  });

  // Form states for creating alert
  const [newAlert, setNewAlert] = useState({
    productId: '',
    productName: '',
    branchId: '',
    priority: 'Medium',
    alertType: 'Low Stock',
    notes: ''
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
        // Create default settings if they don't exist
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
      // Use defaults if loading fails
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
      
      // Regenerate alerts with new settings
      await handleGenerateAlerts();
      setIsSettingsModalOpen(false);
    } catch (error) {
      console.error('Error saving alert settings:', error);
      setError('Failed to save settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  // Load branches
  const loadBranches = async () => {
    try {
      // Inventory Controller can see all branches
      const branchesList = await getBranches(
        userData?.roles?.[0] || 'inventoryController',
        userData?.uid || '',
        1000 // Large page size to get all branches
      );
      setBranches(branchesList || []);
    } catch (err) {
      console.error('Error loading branches:', err);
      // Fallback: try direct query
      try {
        const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
        const { db } = await import('../../config/firebase');
        const branchesQuery = query(collection(db, 'branches'), orderBy('name', 'asc'));
        const snapshot = await getDocs(branchesQuery);
        const branchesList = [];
        snapshot.forEach((doc) => {
          branchesList.push({ id: doc.id, name: doc.data().name || doc.id });
        });
        setBranches(branchesList);
      } catch (fallbackErr) {
        console.error('Error in fallback branch loading:', fallbackErr);
      }
    }
  };

  // Load alerts
  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all alerts (Inventory Controller can see all branches)
      const result = await stockAlertsService.getAllAlerts({
        status: filters.status,
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

  // Generate alerts automatically
  const handleGenerateAlerts = async () => {
    try {
      setIsGeneratingAlerts(true);
      setError(null);
      
      const result = await stockAlertsService.generateAlertsForLowStock(null, alertSettings);
      
      if (result.success) {
        // Reload alerts after generation
        await loadAlerts();
        // Don't show alert on auto-generation, only on manual refresh
        if (result.alertsCreated > 0) {
          console.log(`✅ Generated ${result.alertsCreated} new alerts`);
        }
      } else {
        setError(result.message || 'Failed to generate alerts');
      }
    } catch (err) {
      console.error('Error generating alerts:', err);
      setError(err.message);
    } finally {
      setIsGeneratingAlerts(false);
    }
  };

  // Load alerts and branches on mount
  useEffect(() => {
    loadBranches();
    loadAlertSettings();
    loadAlerts();
    // Automatically generate alerts on page load (after settings are loaded)
    setTimeout(() => {
      handleGenerateAlerts();
    }, 500);
  }, []);

  // Auto-generate alerts when stocks change (real-time listener)
  useEffect(() => {
    // Listen to stocks collection for automatic alert generation
    const stocksRef = collection(db, 'stocks');
    const stocksQuery = query(
      stocksRef,
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(stocksQuery, async (snapshot) => {
      // When stocks change, automatically generate alerts
      // Debounce to avoid too many calls
      if (!isGeneratingAlerts) {
        // Small delay to batch multiple changes
        setTimeout(async () => {
          try {
            await stockAlertsService.generateAlertsForLowStock(null, alertSettings);
            await loadAlerts(); // Reload alerts after generation
          } catch (error) {
            console.error('Error auto-generating alerts:', error);
          }
        }, 1000); // 1 second debounce
      }
    }, (error) => {
      console.error('Error in stocks listener:', error);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [isGeneratingAlerts, alertSettings]);

  // Reload alerts when filters change
  useEffect(() => {
    if (!loading) {
      loadAlerts();
    }
  }, [filters.status, filters.priority, filters.branch]);

  // Get unique categories from alerts
  const categories = [...new Set(alerts.map(a => a.category))].filter(Boolean);

  // Filter and sort alerts
  const filteredAlerts = alerts
    .filter(alert => {
      const matchesSearch = alert.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           alert.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           alert.alertType.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPriority = filters.priority === 'all' || alert.priority === filters.priority;
      const matchesStatus = filters.status === 'all' || alert.status === filters.status;
      const matchesCategory = filters.category === 'all' || alert.category === filters.category;
      const matchesBranch = filters.branch === 'all' || (alert.branchName || alert.branch?.name) === filters.branch;
      
      return matchesSearch && matchesPriority && matchesStatus && matchesCategory && matchesBranch;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'resolvedAt' || sortBy === 'lastRestocked' || sortBy === 'expectedRestock') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Handle alert details
  const handleViewDetails = (alert) => {
    setSelectedAlert(alert);
    setIsDetailsModalOpen(true);
  };

  // Handle create alert
  const handleCreateAlert = () => {
    setNewAlert({
      productId: '',
      productName: '',
      branchId: '',
      priority: 'Medium',
      alertType: 'Low Stock',
      notes: ''
    });
    setIsCreateModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Find branch name
      const selectedBranch = branches.find(b => b.id === newAlert.branchId);
      
      const alertData = {
        ...newAlert,
        branchName: selectedBranch?.name || selectedBranch?.branchName || '',
        createdBy: userData?.uid || '',
      };

      const result = await stockAlertsService.createAlert(alertData);
      
      if (result.success) {
        await loadAlerts();
        setIsCreateModalOpen(false);
        setNewAlert({
          productId: '',
          productName: '',
          branchId: '',
          priority: 'Medium',
          alertType: 'Low Stock',
          notes: ''
        });
      } else {
        setError(result.message || 'Failed to create alert');
      }
    } catch (err) {
      console.error('Error creating alert:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle resolve alert
  const handleResolveAlert = async (alertId) => {
    try {
      const result = await stockAlertsService.resolveAlert(
        alertId,
        'Manually resolved by user',
        userData?.uid || ''
      );
      
      if (result.success) {
        await loadAlerts();
        if (selectedAlert?.id === alertId) {
          setIsDetailsModalOpen(false);
          setSelectedAlert(null);
        }
      } else {
        setError(result.message || 'Failed to resolve alert');
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
      setError(err.message);
    }
  };

  // Handle dismiss alert
  const handleDismissAlert = async (alertId) => {
    try {
      const result = await stockAlertsService.dismissAlert(
        alertId,
        userData?.uid || ''
      );
      
      if (result.success) {
        await loadAlerts();
        if (selectedAlert?.id === alertId) {
          setIsDetailsModalOpen(false);
          setSelectedAlert(null);
        }
      } else {
        setError(result.message || 'Failed to dismiss alert');
      }
    } catch (err) {
      console.error('Error dismissing alert:', err);
      setError(err.message);
    }
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
    activeAlerts: alerts.filter(a => a.status === 'Active').length,
    resolvedAlerts: alerts.filter(a => a.status === 'Resolved').length,
    criticalAlerts: alerts.filter(a => a.priority === 'Critical').length,
    highPriorityAlerts: alerts.filter(a => a.priority === 'High').length,
    totalValue: alerts.reduce((sum, a) => sum + a.totalValue, 0)
  };

  if (loading) {
    return (
      <>>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading stock alerts...</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>>
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
    <>>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Stock Alerts</h1>
            <p className="text-sm md:text-base text-gray-600">Automatically monitor low stock levels and inventory alerts</p>
            <p className="text-xs text-gray-500 mt-1">
              Alerts are automatically generated when realTimeStock ≤ {alertSettings.lowStockThreshold} (Critical: ≤ {alertSettings.criticalThreshold})
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 text-xs md:text-sm"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button 
              variant="outline" 
              onClick={handleGenerateAlerts}
              disabled={isGeneratingAlerts}
              className="flex items-center gap-2 text-xs md:text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${isGeneratingAlerts ? 'animate-spin' : ''}`} />
              {isGeneratingAlerts ? 'Generating...' : 'Refresh Alerts'}
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleCreateAlert} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Alert
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 border border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <Bell className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Alerts</p>
                <p className="text-xl font-bold text-gray-900">{alertStats.totalAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-xl font-bold text-gray-900">{alertStats.activeAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-xl font-bold text-gray-900">{alertStats.resolvedAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Critical</p>
                <p className="text-xl font-bold text-gray-900">{alertStats.criticalAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-xl font-bold text-gray-900">{alertStats.highPriorityAlerts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-xl font-bold text-gray-900">₱{alertStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by product name, brand, or alert type..."
                value={searchTerm}
                onChange={setSearchTerm}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Resolved">Resolved</option>
                <option value="Dismissed">Dismissed</option>
              </select>
              <Button
                variant="outline"
                onClick={() => setIsFilterModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                More Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters({
                  priority: 'all',
                  status: 'all',
                  category: 'all',
                  branch: 'all'
                })}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alert Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{alert.productName}</div>
                        <div className="text-sm text-gray-500">{alert.brand} • {alert.category}</div>
                        <div className="text-xs text-gray-400">UPC: {alert.productId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{alert.currentStock}</div>
                      <div className="text-xs text-gray-500">Min: {alert.minStock}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                        {getPriorityIcon(alert.priority)}
                        {alert.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                        {getStatusIcon(alert.status)}
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{alert.branchName}</div>
                      <div className="text-xs text-gray-500">{alert.location}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{alert.alertType}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{format(new Date(alert.createdAt), 'MMM dd, yyyy')}</div>
                      <div className="text-xs text-gray-500">{format(new Date(alert.createdAt), 'HH:mm')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(alert)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        {alert.status === 'Active' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolveAlert(alert.id)}
                              className="flex items-center gap-1 text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Resolve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDismissAlert(alert.id)}
                              className="flex items-center gap-1 text-gray-600 hover:text-gray-700"
                            >
                              <XCircle className="h-3 w-3" />
                              Dismiss
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Empty State */}
        {filteredAlerts.length === 0 && (
          <Card className="p-12 text-center">
            <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Stock Alerts Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all')
                ? 'Try adjusting your search or filters'
                : 'Great! No stock alerts at the moment'
              }
            </p>
            <Button onClick={handleCreateAlert} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Create Alert
            </Button>
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
                <div className="flex gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(selectedAlert.priority)}`}>
                    {getPriorityIcon(selectedAlert.priority)}
                    {selectedAlert.priority}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedAlert.status)}`}>
                    {getStatusIcon(selectedAlert.status)}
                    {selectedAlert.status}
                  </span>
                </div>
              </div>

              {/* Alert Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Current Stock</label>
                    <p className="text-2xl font-bold text-red-600">{selectedAlert.currentStock} units</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Minimum Stock Level</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedAlert.minStock} units</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Maximum Stock Level</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedAlert.maxStock} units</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Alert Type</label>
                    <p className="text-gray-900">{selectedAlert.alertType}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Value</label>
                    <p className="text-2xl font-bold text-gray-900">₱{selectedAlert.totalValue.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Unit Cost</label>
                    <p className="text-lg font-semibold text-gray-900">₱{selectedAlert.unitCost.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Branch</label>
                    <p className="text-gray-900">{selectedAlert.branchName}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <p className="text-gray-900">{selectedAlert.location}</p>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Supplier</label>
                  <p className="text-gray-900">{selectedAlert.supplier}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Restocked</label>
                  <p className="text-gray-900">
                    {selectedAlert.lastRestocked 
                      ? format(new Date(selectedAlert.lastRestocked), 'MMM dd, yyyy')
                      : 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Expected Restock</label>
                  <p className="text-gray-900">
                    {selectedAlert.expectedRestock 
                      ? format(new Date(selectedAlert.expectedRestock), 'MMM dd, yyyy')
                      : 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900">{format(new Date(selectedAlert.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>

              {/* Notes and Action Taken */}
              <div>
                <label className="text-sm font-medium text-gray-500">Notes</label>
                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg mt-1">{selectedAlert.notes}</p>
              </div>

              {selectedAlert.actionTaken && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Action Taken</label>
                  <p className="text-gray-900 bg-green-50 p-3 rounded-lg mt-1">{selectedAlert.actionTaken}</p>
                </div>
              )}

              {selectedAlert.resolvedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Resolved At</label>
                  <p className="text-gray-900">{format(new Date(selectedAlert.resolvedAt), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              )}

              {/* Stock Level Indicator */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Stock Level Indicator</h4>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      selectedAlert.currentStock <= selectedAlert.minStock ? 'bg-red-500' :
                      selectedAlert.currentStock <= selectedAlert.minStock * 1.5 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min((selectedAlert.currentStock / selectedAlert.maxStock) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>0</span>
                  <span>{selectedAlert.minStock} (Min)</span>
                  <span>{selectedAlert.maxStock} (Max)</span>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedAlert.status === 'Active' && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => handleResolveAlert(selectedAlert.id)}
                    className="flex-1 flex items-center justify-center gap-2 text-green-600 hover:text-green-700 hover:border-green-300"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Resolve Alert
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDismissAlert(selectedAlert.id)}
                    className="flex-1 flex items-center justify-center gap-2 text-gray-600 hover:text-gray-700 hover:border-gray-300"
                  >
                    <XCircle className="h-4 w-4" />
                    Dismiss Alert
                  </Button>
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* Create Alert Modal */}
        {isCreateModalOpen && (
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create Stock Alert"
            size="md"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch *</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  required
                  value={newAlert.branchId}
                  onChange={(e) => setNewAlert({ ...newAlert, branchId: e.target.value })}
                >
                  <option value="">Select Branch</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                <Input
                  type="text"
                  value={newAlert.productName}
                  onChange={(e) => setNewAlert({ ...newAlert, productName: e.target.value })}
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product ID</label>
                <Input
                  type="text"
                  value={newAlert.productId}
                  onChange={(e) => setNewAlert({ ...newAlert, productId: e.target.value })}
                  placeholder="Enter product ID (optional)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  required
                  value={newAlert.priority}
                  onChange={(e) => setNewAlert({ ...newAlert, priority: e.target.value })}
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alert Type *</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  required
                  value={newAlert.alertType}
                  onChange={(e) => setNewAlert({ ...newAlert, alertType: e.target.value })}
                >
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Overstock">Overstock</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Additional notes about this alert..."
                  value={newAlert.notes}
                  onChange={(e) => setNewAlert({ ...newAlert, notes: e.target.value })}
                ></textarea>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Alert'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Advanced Filters Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Advanced Filters"
            size="md"
          >
            <div className="space-y-4">
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

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setFilters({
                  priority: 'all',
                  status: 'all',
                  category: 'all',
                  branch: 'all'
                })}>
                  Reset
                </Button>
                <Button onClick={() => setIsFilterModalOpen(false)}>
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
