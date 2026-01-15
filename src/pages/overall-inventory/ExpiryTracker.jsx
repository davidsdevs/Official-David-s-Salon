// Expiration Tracker for Overall Inventory Controller
// With pagination, branch filter, status filter, and export
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
  X,
  TrendingDown,
  Download,
  Building,
  ChevronLeft,
  ChevronRight,
  Printer
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { inventoryService } from '../../services/inventoryService';
import { getAllBranches } from '../../services/branchService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { exportToExcel } from '../../utils/excelExport';

const ITEMS_PER_PAGE = 25;

const OverallExpiryTracker = () => {
  const { userData } = useAuth();
  
  // Data states
  const [allBatches, setAllBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDaysAhead, setSelectedDaysAhead] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  // UI states
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load branches on mount
  useEffect(() => {
    loadBranches();
    loadProductsMap();
  }, []);

  // Load batches when branches are loaded
  useEffect(() => {
    if (branches.length > 0) {
      loadAllBatches();
    }
  }, [branches]);

  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      setBranches(Array.isArray(branchesData) ? branchesData.filter(b => b.isActive !== false) : []);
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  };

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

  const loadAllBatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const allBatchesData = [];

      // Load batches from all branches
      for (const branch of branches) {
        try {
          const batchesResult = await inventoryService.getBranchBatches(branch.id);
          if (batchesResult.success && batchesResult.batches) {
            const enrichedBatches = batchesResult.batches.map(batch => ({
              ...batch,
              branchId: branch.id,
              branchName: branch.name || branch.branchName || 'Unknown Branch',
              productName: batch.productName || productsMap[batch.productId] || 'Unknown Product'
            }));
            allBatchesData.push(...enrichedBatches);
          }
        } catch (err) {
          console.warn(`Error loading batches for branch ${branch.name}:`, err);
        }
      }

      // Sort by expiration date (soonest first)
      allBatchesData.sort((a, b) => {
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        const aDate = a.expirationDate instanceof Date ? a.expirationDate : new Date(a.expirationDate);
        const bDate = b.expirationDate instanceof Date ? b.expirationDate : new Date(b.expirationDate);
        return aDate.getTime() - bDate.getTime();
      });

      setAllBatches(allBatchesData);
    } catch (err) {
      console.error('Error loading batches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate expiry status
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
    let filtered = allBatches.filter(batch => {
      // Only show batches with remaining quantity
      if ((batch.remainingQuantity || 0) <= 0) return false;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          (batch.productName || '').toLowerCase().includes(searchLower) ||
          (batch.batchNumber || '').toLowerCase().includes(searchLower) ||
          (batch.purchaseOrderId || '').toLowerCase().includes(searchLower) ||
          (batch.branchName || '').toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Branch filter
      if (selectedBranch !== 'all' && batch.branchId !== selectedBranch) return false;

      // Status filter
      const status = getExpiryStatus(batch.expirationDate);
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'expired' && status !== 'Expired') return false;
        if (selectedStatus === 'critical' && status !== 'Critical') return false;
        if (selectedStatus === 'expiring_soon' && status !== 'Expiring Soon') return false;
        if (selectedStatus === 'good' && status !== 'Good') return false;
      }

      // Days ahead filter
      if (selectedDaysAhead !== 'all' && batch.expirationDate) {
        const daysLeft = differenceInDays(new Date(batch.expirationDate), new Date());
        if (daysLeft < 0 || daysLeft > parseInt(selectedDaysAhead)) return false;
      }

      return true;
    });

    return filtered;
  }, [allBatches, searchTerm, selectedBranch, selectedStatus, selectedDaysAhead]);

  // Pagination
  const totalPages = Math.ceil(filteredBatches.length / ITEMS_PER_PAGE);
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBatches.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBatches, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedStatus, selectedDaysAhead]);

  // Calculate statistics
  const stats = useMemo(() => {
    const activeBatches = allBatches.filter(b => (b.remainingQuantity || 0) > 0);
    let criticalCount = 0, expiringSoonCount = 0, goodCount = 0, expiredCount = 0;
    let totalValue = 0, atRiskValue = 0;

    activeBatches.forEach(batch => {
      const status = getExpiryStatus(batch.expirationDate);
      const value = (batch.remainingQuantity || 0) * (batch.unitCost || 0);
      totalValue += value;

      if (status === 'Expired') { expiredCount++; atRiskValue += value; }
      else if (status === 'Critical') { criticalCount++; atRiskValue += value; }
      else if (status === 'Expiring Soon') { expiringSoonCount++; atRiskValue += value; }
      else if (status === 'Good') { goodCount++; }
    });

    return {
      totalBatches: activeBatches.length,
      goodBatches: goodCount,
      expiringSoon: expiringSoonCount,
      criticalBatches: criticalCount,
      expiredBatches: expiredCount,
      totalValue,
      atRiskValue
    };
  }, [allBatches]);

  // Status helpers
  const getStatusColor = (status) => {
    switch (status) {
      case 'Good': return 'text-green-600 bg-green-100 border-green-200';
      case 'Expiring Soon': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Critical': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'Expired': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Good': return <CheckCircle className="h-3 w-3" />;
      case 'Expiring Soon': return <Clock className="h-3 w-3" />;
      case 'Critical': return <AlertTriangle className="h-3 w-3" />;
      case 'Expired': return <XCircle className="h-3 w-3" />;
      default: return <Package className="h-3 w-3" />;
    }
  };

  // Export to Excel
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const exportData = filteredBatches.map(batch => {
        const status = getExpiryStatus(batch.expirationDate);
        const daysLeft = batch.expirationDate ? differenceInDays(new Date(batch.expirationDate), new Date()) : null;
        return {
          'Branch': batch.branchName || 'Unknown',
          'Product': batch.productName || 'Unknown',
          'Batch Number': batch.batchNumber || 'N/A',
          'Purchase Order': batch.purchaseOrderId || 'N/A',
          'Quantity': `${batch.remainingQuantity || 0} / ${batch.quantity || 0}`,
          'Expiration Date': batch.expirationDate ? format(new Date(batch.expirationDate), 'yyyy-MM-dd') : 'No Expiry',
          'Days Left': daysLeft === null ? 'N/A' : daysLeft < 0 ? 'Expired' : daysLeft,
          'Status': status,
          'Unit Cost': batch.unitCost || 0,
          'Total Value': (batch.remainingQuantity || 0) * (batch.unitCost || 0),
          'Usage Type': (batch.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC'
        };
      });

      if (exportData.length === 0) {
        setError('No data to export');
        return;
      }

      exportToExcel(exportData, `ExpiryTracker_${format(new Date(), 'yyyyMMdd_HHmmss')}`, 'Expiry Tracker');
    } catch (err) {
      console.error('Error exporting:', err);
      setError('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Print report
  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    let html = `
      <html><head><title>Expiry Tracker Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h1 { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
        .expired { color: #dc2626; }
        .critical { color: #ea580c; }
        .expiring { color: #ca8a04; }
        .good { color: #16a34a; }
      </style></head><body>
      <h1>Expiry Tracker Report</h1>
      <p style="text-align:center">Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
      <p style="text-align:center">Total: ${filteredBatches.length} batches | At Risk Value: ₱${stats.atRiskValue.toLocaleString()}</p>
      <table>
        <thead><tr><th>Branch</th><th>Product</th><th>Batch</th><th>Qty</th><th>Expiry</th><th>Days</th><th>Status</th><th>Value</th></tr></thead>
        <tbody>
    `;
    
    filteredBatches.forEach(batch => {
      const status = getExpiryStatus(batch.expirationDate);
      const daysLeft = batch.expirationDate ? differenceInDays(new Date(batch.expirationDate), new Date()) : null;
      const value = (batch.remainingQuantity || 0) * (batch.unitCost || 0);
      const statusClass = status.toLowerCase().replace(' ', '-');
      
      html += `<tr>
        <td>${batch.branchName || 'Unknown'}</td>
        <td>${batch.productName || 'Unknown'}</td>
        <td>${batch.batchNumber || 'N/A'}</td>
        <td>${batch.remainingQuantity || 0}</td>
        <td>${batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'N/A'}</td>
        <td class="${statusClass}">${daysLeft === null ? 'N/A' : daysLeft < 0 ? 'Expired' : daysLeft}</td>
        <td class="${statusClass}">${status}</td>
        <td>₱${value.toLocaleString()}</td>
      </tr>`;
    });
    
    html += '</tbody></table></body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedBranch('all');
    setSelectedStatus('all');
    setSelectedDaysAhead('all');
    setCurrentPage(1);
  };

  if (loading && allBatches.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading expiration data from all branches...</span>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Expiration Tracker</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Monitor batch expirations across all branches</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={isExporting || filteredBatches.length === 0} className="flex items-center gap-2">
            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={filteredBatches.length === 0} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={loadAllBatches} className="flex items-center gap-2">
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
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></Button>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-center">
            <Package className="h-6 w-6 text-blue-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-gray-600">Total Batches</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalBatches}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-gray-600">Good</p>
              <p className="text-lg font-bold text-gray-900">{stats.goodBatches}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center">
            <Clock className="h-6 w-6 text-yellow-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-gray-600">Expiring Soon</p>
              <p className="text-lg font-bold text-gray-900">{stats.expiringSoon}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-gray-600">Critical</p>
              <p className="text-lg font-bold text-gray-900">{stats.criticalBatches}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center">
            <XCircle className="h-6 w-6 text-red-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-gray-600">Expired</p>
              <p className="text-lg font-bold text-gray-900">{stats.expiredBatches}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center">
            <TrendingDown className="h-6 w-6 text-purple-600" />
            <div className="ml-2">
              <p className="text-xs font-medium text-gray-600">At Risk Value</p>
              <p className="text-lg font-bold text-gray-900">₱{stats.atRiskValue.toLocaleString()}</p>
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
                placeholder="Search by product, batch number, branch..."
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
                {(selectedBranch !== 'all' || selectedStatus !== 'all' || selectedDaysAhead !== 'all') && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                    {[selectedBranch !== 'all', selectedStatus !== 'all', selectedDaysAhead !== 'all'].filter(Boolean).length}
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
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name || branch.branchName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="good">Good</option>
                  <option value="expiring_soon">Expiring Soon (≤30 days)</option>
                  <option value="critical">Critical (≤7 days)</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiring Within</label>
                <select
                  value={selectedDaysAhead}
                  onChange={(e) => setSelectedDaysAhead(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                  <option value="90">90 Days</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Batches Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Batch</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Value</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-gray-500">Loading...</p>
                  </td>
                </tr>
              ) : paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p>No batches found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch) => {
                  const status = getExpiryStatus(batch.expirationDate);
                  const daysLeft = batch.expirationDate ? differenceInDays(new Date(batch.expirationDate), new Date()) : null;
                  const value = (batch.remainingQuantity || 0) * (batch.unitCost || 0);

                  return (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-900 truncate max-w-[100px]">{batch.branchName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{batch.productName}</div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <div className="text-sm text-gray-900">{batch.batchNumber || 'N/A'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm text-gray-900">{batch.remainingQuantity || 0}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm text-gray-900">
                          {batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className={`text-sm font-medium ${
                          daysLeft === null ? 'text-gray-600' :
                          daysLeft < 0 ? 'text-red-600' :
                          daysLeft <= 7 ? 'text-orange-600' :
                          daysLeft <= 30 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {daysLeft === null ? 'N/A' : daysLeft < 0 ? 'Expired' : `${daysLeft}d`}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                          {getStatusIcon(status)}
                          <span className="hidden sm:inline">{status}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <div className="text-sm font-medium text-gray-900">₱{value.toLocaleString()}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedBatch(batch); setIsDetailsModalOpen(true); }} className="px-2 py-1">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredBatches.length)} of {filteredBatches.length} batches
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

    {/* Batch Details Modal */}
    {isDetailsModalOpen && selectedBatch && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6" />
                <h2 className="text-lg font-bold">Batch Details</h2>
              </div>
              <Button variant="ghost" onClick={() => { setIsDetailsModalOpen(false); setSelectedBatch(null); }} className="text-white hover:bg-white/20 rounded-full p-2">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {(() => {
              const status = getExpiryStatus(selectedBatch.expirationDate);
              const daysLeft = selectedBatch.expirationDate ? differenceInDays(new Date(selectedBatch.expirationDate), new Date()) : null;
              const value = (selectedBatch.remainingQuantity || 0) * (selectedBatch.unitCost || 0);

              return (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{selectedBatch.productName}</h3>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status)}`}>
                      {getStatusIcon(status)}
                      {status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Branch</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedBatch.branchName}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Batch Number</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedBatch.batchNumber || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Purchase Order</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedBatch.purchaseOrderId || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Usage Type</label>
                      <p className="text-sm font-semibold text-gray-900">{(selectedBatch.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Quantity</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedBatch.remainingQuantity || 0} / {selectedBatch.quantity || 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Unit Cost</label>
                      <p className="text-sm font-semibold text-gray-900">₱{(selectedBatch.unitCost || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Total Value</label>
                      <p className="text-sm font-semibold text-green-600">₱{value.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Days Until Expiry</label>
                      <p className={`text-sm font-semibold ${
                        daysLeft === null ? 'text-gray-600' :
                        daysLeft < 0 ? 'text-red-600' :
                        daysLeft <= 7 ? 'text-orange-600' :
                        daysLeft <= 30 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {daysLeft === null ? 'No Expiry' : daysLeft < 0 ? `Expired ${Math.abs(daysLeft)} days ago` : `${daysLeft} days`}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <label className="text-xs font-medium text-gray-500">Expiration Date</label>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedBatch.expirationDate ? format(new Date(selectedBatch.expirationDate), 'MMMM dd, yyyy') : 'No Expiration Date'}
                    </p>
                  </div>

                  {selectedBatch.receivedDate && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="text-xs font-medium text-gray-500">Received Date</label>
                      <p className="text-sm font-semibold text-gray-900">{format(new Date(selectedBatch.receivedDate), 'MMMM dd, yyyy')}</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="border-t p-4 flex justify-end">
            <Button variant="outline" onClick={() => { setIsDetailsModalOpen(false); setSelectedBatch(null); }}>Close</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default OverallExpiryTracker;
