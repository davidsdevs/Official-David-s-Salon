/**
 * Price History Analytics Page - Data-Focused Table View
 * Shows all price changes across services with old vs new price comparison
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  Calendar,
  Search,
  AlertCircle,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Activity,
  User,
  Clock,
  Tag,
  Filter,
  Printer,
  Download,
  RefreshCw,
  Percent,
  History,
  Building2,
  Eye,
  ChevronDown,
  ChevronUp,
  Target,
  X,
  Layers,
  ArrowRight
} from 'lucide-react';
import { format, subDays, isWithinInterval } from 'date-fns';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getPriceChangeImpact } from '../../services/priceHistoryService';
import { getAllBranches } from '../../services/branchService';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const PriceHistoryAnalytics = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [priceChanges, setPriceChanges] = useState([]);
  const [services, setServices] = useState({});
  const [branches, setBranches] = useState({});
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [changeTypeFilter, setChangeTypeFilter] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState('changedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Detail view
  const [selectedChange, setSelectedChange] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [impactData, setImpactData] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  
  // Expanded rows for inline details
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Load branches
      const branchesList = await getAllBranches();
      const branchesMap = {};
      branchesList.forEach(b => { branchesMap[b.id] = b.name || b.branchName || b.id; });
      setBranches(branchesMap);
      
      // Load services
      const servicesRef = collection(db, 'services');
      const servicesSnap = await getDocs(query(servicesRef, where('isActive', '==', true)));
      const servicesMap = {};
      servicesSnap.docs.forEach(doc => {
        servicesMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setServices(servicesMap);
      
      // Load all price history
      const priceHistoryRef = collection(db, 'priceHistory');
      const priceHistorySnap = await getDocs(query(priceHistoryRef, orderBy('changedAt', 'desc'), limit(500)));
      
      const changes = priceHistorySnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          changedAt: data.changedAt?.toDate ? data.changedAt.toDate() : new Date(data.changedAt),
          serviceName: servicesMap[data.serviceId]?.name || 'Unknown Service',
          serviceCategory: servicesMap[data.serviceId]?.category || 'Uncategorized',
          branchName: branchesMap[data.branchId] || 'Unknown Branch'
        };
      });
      
      setPriceChanges(changes);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters
  const uniqueBranches = useMemo(() => [...new Set(priceChanges.map(c => c.branchId))], [priceChanges]);
  const uniqueCategories = useMemo(() => [...new Set(priceChanges.map(c => c.serviceCategory).filter(Boolean))], [priceChanges]);

  // Filter and sort data
  const filteredChanges = useMemo(() => {
    let filtered = priceChanges.filter(change => {
      // Search
      const matchesSearch = !searchTerm || 
        change.serviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        change.branchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        change.changedByName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Branch filter
      const matchesBranch = branchFilter === 'all' || change.branchId === branchFilter;
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || change.serviceCategory === categoryFilter;
      
      // Date range filter
      let matchesDate = true;
      if (dateRangeFilter !== 'all') {
        const changeDate = new Date(change.changedAt);
        const now = new Date();
        if (dateRangeFilter === '7days') matchesDate = changeDate >= subDays(now, 7);
        else if (dateRangeFilter === '30days') matchesDate = changeDate >= subDays(now, 30);
        else if (dateRangeFilter === '90days') matchesDate = changeDate >= subDays(now, 90);
        else if (dateRangeFilter === 'custom' && startDateFilter && endDateFilter) {
          matchesDate = isWithinInterval(changeDate, { start: new Date(startDateFilter), end: new Date(endDateFilter) });
        }
      }
      
      // Change type filter
      let matchesType = true;
      if (changeTypeFilter !== 'all') {
        const isIncrease = change.newPrice > change.oldPrice;
        matchesType = changeTypeFilter === 'increase' ? isIncrease : !isIncrease;
      }
      
      return matchesSearch && matchesBranch && matchesCategory && matchesDate && matchesType;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'changedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (sortField === 'changePercent') {
        aVal = a.oldPrice ? ((a.newPrice - a.oldPrice) / a.oldPrice) * 100 : 0;
        bVal = b.oldPrice ? ((b.newPrice - b.oldPrice) / b.oldPrice) * 100 : 0;
      }
      if (sortDirection === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    
    return filtered;
  }, [priceChanges, searchTerm, branchFilter, categoryFilter, dateRangeFilter, changeTypeFilter, startDateFilter, endDateFilter, sortField, sortDirection]);

  // Statistics
  const stats = useMemo(() => {
    const increases = filteredChanges.filter(c => c.newPrice > c.oldPrice);
    const decreases = filteredChanges.filter(c => c.newPrice < c.oldPrice);
    const totalOldValue = filteredChanges.reduce((sum, c) => sum + (c.oldPrice || 0), 0);
    const totalNewValue = filteredChanges.reduce((sum, c) => sum + (c.newPrice || 0), 0);
    const avgPercentChange = filteredChanges.length > 0 
      ? filteredChanges.reduce((sum, c) => c.oldPrice ? sum + ((c.newPrice - c.oldPrice) / c.oldPrice * 100) : sum, 0) / filteredChanges.length 
      : 0;
    const totalDifference = totalNewValue - totalOldValue;
    
    return {
      total: filteredChanges.length,
      increases: increases.length,
      decreases: decreases.length,
      avgPercentChange,
      totalOldValue,
      totalNewValue,
      totalDifference,
      uniqueServices: new Set(filteredChanges.map(c => c.serviceId)).size,
      uniqueBranches: new Set(filteredChanges.map(c => c.branchId)).size
    };
  }, [filteredChanges]);

  const activeFilterCount = [branchFilter !== 'all', categoryFilter !== 'all', dateRangeFilter !== 'all', changeTypeFilter !== 'all'].filter(Boolean).length;

  const clearFilters = () => {
    setBranchFilter('all');
    setCategoryFilter('all');
    setDateRangeFilter('all');
    setChangeTypeFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setSearchTerm('');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleRowExpand = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const formatCurrency = (amount) => (typeof amount !== 'number' || isNaN(amount)) ? '₱0.00' : `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const getChangePercent = (oldPrice, newPrice) => (!oldPrice || oldPrice === 0) ? 0 : ((newPrice - oldPrice) / oldPrice) * 100;

  const loadImpactForChange = async (change) => {
    try {
      setLoadingImpact(true);
      setSelectedChange(change);
      setShowDetailModal(true);
      const impact = await getPriceChangeImpact(change.serviceId, change.branchId, change.changedAt, 30, 30);
      setImpactData(impact);
    } catch (error) {
      console.error('Error loading impact:', error);
      toast.error('Failed to load impact data');
    } finally {
      setLoadingImpact(false);
    }
  };

  // Print
  const handlePrint = () => {
    if (filteredChanges.length === 0) { toast.error('No data to print'); return; }
    const printWindow = window.open('', '', 'height=800,width=1200');
    let html = `<html><head><title>Price History Report</title><style>
      body{font-family:'Segoe UI',Arial,sans-serif;margin:30px;color:#1f2937;font-size:12px}
      h1{color:#160B53;font-size:24px;margin-bottom:5px}
      .meta{color:#6b7280;margin-bottom:20px}
      .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}
      .stat{padding:15px;background:#f8fafc;border-radius:8px;text-align:center}
      .stat-label{font-size:10px;color:#64748b;text-transform:uppercase}
      .stat-value{font-size:20px;font-weight:700;color:#1e293b}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#160B53;color:white;padding:10px 8px;text-align:left;font-weight:600}
      td{padding:10px 8px;border-bottom:1px solid #e5e7eb}
      tr:nth-child(even){background:#f9fafb}
      .increase{color:#dc2626}.decrease{color:#16a34a}
      .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600}
      .badge-up{background:#fee2e2;color:#dc2626}.badge-down{background:#dcfce7;color:#16a34a}
    </style></head><body>
    <h1>📊 Price History Report</h1>
    <p class="meta">Generated: ${format(new Date(), 'MMMM dd, yyyy • hh:mm a')} | ${filteredChanges.length} records</p>
    <div class="stats">
      <div class="stat"><div class="stat-label">Total Changes</div><div class="stat-value">${stats.total}</div></div>
      <div class="stat"><div class="stat-label">Increases</div><div class="stat-value" style="color:#dc2626">↑ ${stats.increases}</div></div>
      <div class="stat"><div class="stat-label">Decreases</div><div class="stat-value" style="color:#16a34a">↓ ${stats.decreases}</div></div>
      <div class="stat"><div class="stat-label">Avg Change</div><div class="stat-value">${stats.avgPercentChange >= 0 ? '+' : ''}${stats.avgPercentChange.toFixed(1)}%</div></div>
      <div class="stat"><div class="stat-label">Net Difference</div><div class="stat-value">${formatCurrency(stats.totalDifference)}</div></div>
    </div>
    <table><thead><tr><th>Date</th><th>Service</th><th>Category</th><th>Branch</th><th>Old Price</th><th>New Price</th><th>Change</th><th>Changed By</th></tr></thead><tbody>`;
    filteredChanges.forEach(c => {
      const pct = getChangePercent(c.oldPrice, c.newPrice);
      const inc = c.newPrice > c.oldPrice;
      html += `<tr>
        <td>${format(new Date(c.changedAt), 'MMM dd, yyyy')}</td>
        <td><strong>${c.serviceName}</strong></td>
        <td>${c.serviceCategory}</td>
        <td>${c.branchName}</td>
        <td>${formatCurrency(c.oldPrice)}</td>
        <td><strong>${formatCurrency(c.newPrice)}</strong></td>
        <td><span class="badge badge-${inc ? 'up' : 'down'}">${inc ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%</span></td>
        <td>${c.changedByName || '-'}</td>
      </tr>`;
    });
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Export
  const handleExport = () => {
    if (filteredChanges.length === 0) { toast.error('No data to export'); return; }
    const rows = filteredChanges.map(c => [
      format(new Date(c.changedAt), 'yyyy-MM-dd HH:mm'),
      c.serviceName,
      c.serviceCategory,
      c.branchName,
      c.oldPrice,
      c.newPrice,
      (c.newPrice - c.oldPrice).toFixed(2),
      getChangePercent(c.oldPrice, c.newPrice).toFixed(2),
      c.changedByName || ''
    ]);
    const csv = ['Date,Service,Category,Branch,Old Price,New Price,Difference,% Change,Changed By', ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `price_history_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported!');
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="h-4 w-4 text-gray-400" />;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />;
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-gradient-to-br from-[#160B53] to-[#3B2E7A] rounded-xl text-white">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Price History Analytics</h1>
          </div>
          <p className="text-gray-500 ml-[52px]">View and analyze all service price changes across branches</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">{filteredChanges.length} records</span>
          <button onClick={handlePrint} className="p-2.5 text-gray-500 hover:text-[#160B53] hover:bg-[#160B53]/5 rounded-xl transition-all" title="Print"><Printer className="h-5 w-5" /></button>
          <button onClick={handleExport} className="p-2.5 text-gray-500 hover:text-[#160B53] hover:bg-[#160B53]/5 rounded-xl transition-all" title="Export CSV"><Download className="h-5 w-5" /></button>
          <button onClick={loadAllData} disabled={loading} className="p-2.5 text-gray-500 hover:text-[#160B53] hover:bg-[#160B53]/5 rounded-xl transition-all" title="Refresh">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Changes</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <History className="h-8 w-8 text-slate-400" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-50 to-orange-50 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Increases</p>
              <p className="text-2xl font-bold text-red-600">{stats.increases}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-red-400" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wider">Decreases</p>
              <p className="text-2xl font-bold text-green-600">{stats.decreases}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-green-400" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">Avg Change</p>
              <p className={`text-2xl font-bold ${stats.avgPercentChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.avgPercentChange >= 0 ? '+' : ''}{stats.avgPercentChange.toFixed(1)}%
              </p>
            </div>
            <Percent className="h-8 w-8 text-purple-400" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Services</p>
              <p className="text-2xl font-bold text-blue-600">{stats.uniqueServices}</p>
            </div>
            <Tag className="h-8 w-8 text-blue-400" />
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">Branches</p>
              <p className="text-2xl font-bold text-amber-600">{stats.uniqueBranches}</p>
            </div>
            <Building2 className="h-8 w-8 text-amber-400" />
          </div>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="p-4 border border-gray-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by service, branch, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:border-[#160B53] focus:ring-2 focus:ring-[#160B53]/10 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Filters */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:border-[#160B53] outline-none bg-white min-w-[140px]"
            >
              <option value="all">All Branches</option>
              {uniqueBranches.map(id => <option key={id} value={id}>{branches[id]}</option>)}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:border-[#160B53] outline-none bg-white min-w-[140px]"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <button
              onClick={() => setShowFilterModal(true)}
              className="relative px-4 py-3 text-sm border-2 border-gray-200 rounded-xl hover:border-[#160B53] transition-all flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              More Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#160B53] text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="px-3 py-3 text-sm text-gray-500 hover:text-red-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Data Table */}
      <Card className="overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-[#160B53]/20 rounded-full"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-[#160B53] rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-500">Loading price history...</p>
          </div>
        ) : filteredChanges.length === 0 ? (
          <div className="p-16 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Price Changes Found</h3>
            <p className="text-gray-500">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-[#160B53] to-[#3B2E7A] text-white">
                  <th className="w-10 px-4 py-4"></th>
                  <th className="px-4 py-4 text-left">
                    <button onClick={() => handleSort('changedAt')} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white/80">
                      Date <SortIcon field="changedAt" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-left">
                    <button onClick={() => handleSort('serviceName')} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white/80">
                      Service <SortIcon field="serviceName" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider">Branch</th>
                  <th className="px-4 py-4 text-right">
                    <button onClick={() => handleSort('oldPrice')} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white/80 ml-auto">
                      Old Price <SortIcon field="oldPrice" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider">→</th>
                  <th className="px-4 py-4 text-right">
                    <button onClick={() => handleSort('newPrice')} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white/80 ml-auto">
                      New Price <SortIcon field="newPrice" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-right">
                    <button onClick={() => handleSort('changePercent')} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white/80 ml-auto">
                      Change <SortIcon field="changePercent" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider">Changed By</th>
                  <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredChanges.map((change, idx) => {
                  const pct = getChangePercent(change.oldPrice, change.newPrice);
                  const isIncrease = change.newPrice > change.oldPrice;
                  const diff = change.newPrice - change.oldPrice;
                  const isExpanded = expandedRows.has(change.id);
                  
                  return (
                    <>
                      <tr key={change.id} className={`hover:bg-[#160B53]/5 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isExpanded ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleRowExpand(change.id)} className="p-1 hover:bg-gray-200 rounded transition-colors">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{format(new Date(change.changedAt), 'MMM dd, yyyy')}</p>
                            <p className="text-xs text-gray-500">{format(new Date(change.changedAt), 'hh:mm a')}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900">{change.serviceName}</p>
                            <p className="text-xs text-gray-500">{change.serviceCategory}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-sm text-gray-700">
                            <Building2 className="h-3.5 w-3.5" />
                            {change.branchName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg text-sm">
                            {formatCurrency(change.oldPrice)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ArrowRight className={`h-5 w-5 mx-auto ${isIncrease ? 'text-red-400' : 'text-green-400'}`} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono font-bold px-3 py-1.5 rounded-lg text-sm ${isIncrease ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {formatCurrency(change.newPrice)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isIncrease ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {isIncrease ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                              {Math.abs(pct).toFixed(1)}%
                            </span>
                            <span className={`text-xs ${isIncrease ? 'text-red-500' : 'text-green-500'}`}>
                              {isIncrease ? '+' : ''}{formatCurrency(diff)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
                              <User className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                            <span className="text-sm text-gray-700">{change.changedByName || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => loadImpactForChange(change)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all" title="View Impact">
                              <Target className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Row Details */}
                      {isExpanded && (
                        <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-white rounded-xl border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Price Difference</p>
                                <p className={`text-xl font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                                  {isIncrease ? '+' : ''}{formatCurrency(diff)}
                                </p>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Percentage Change</p>
                                <p className={`text-xl font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                                  {isIncrease ? '+' : ''}{pct.toFixed(2)}%
                                </p>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Service Category</p>
                                <p className="text-lg font-semibold text-gray-900">{change.serviceCategory}</p>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Change Reason</p>
                                <p className="text-sm text-gray-700">{change.reason || 'No reason provided'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Table Footer Summary */}
        {filteredChanges.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-6">
                <span className="text-gray-500">
                  Showing <span className="font-semibold text-gray-900">{filteredChanges.length}</span> of <span className="font-semibold text-gray-900">{priceChanges.length}</span> records
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Total Old:</span>
                  <span className="font-mono font-semibold text-gray-700">{formatCurrency(stats.totalOldValue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Total New:</span>
                  <span className="font-mono font-semibold text-gray-700">{formatCurrency(stats.totalNewValue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Net:</span>
                  <span className={`font-mono font-bold ${stats.totalDifference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.totalDifference >= 0 ? '+' : ''}{formatCurrency(stats.totalDifference)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Impact Detail Modal */}
      {showDetailModal && selectedChange && (
        <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedChange(null); setImpactData(null); }} title="Price Change Impact Analysis" size="xl">
          <div className="space-y-6">
            {/* Change Summary */}
            <div className="p-5 bg-gradient-to-r from-[#160B53]/5 to-[#160B53]/10 rounded-xl border border-[#160B53]/20">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Service</p>
                  <p className="text-xl font-bold text-gray-900">{selectedChange.serviceName}</p>
                  <p className="text-sm text-gray-500 mt-1">{selectedChange.branchName} • {format(new Date(selectedChange.changedAt), 'MMM dd, yyyy')}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase">Old Price</p>
                    <p className="text-xl font-mono font-semibold text-gray-600">{formatCurrency(selectedChange.oldPrice)}</p>
                  </div>
                  <ArrowRight className={`h-6 w-6 ${selectedChange.newPrice > selectedChange.oldPrice ? 'text-red-500' : 'text-green-500'}`} />
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase">New Price</p>
                    <p className={`text-xl font-mono font-bold ${selectedChange.newPrice > selectedChange.oldPrice ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(selectedChange.newPrice)}
                    </p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl ${selectedChange.newPrice > selectedChange.oldPrice ? 'bg-red-100' : 'bg-green-100'}`}>
                    <p className={`text-2xl font-bold ${selectedChange.newPrice > selectedChange.oldPrice ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedChange.newPrice > selectedChange.oldPrice ? '+' : ''}{getChangePercent(selectedChange.oldPrice, selectedChange.newPrice).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Data */}
            {loadingImpact ? (
              <div className="py-12 flex justify-center">
                <div className="relative">
                  <div className="w-10 h-10 border-4 border-gray-200 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-10 h-10 border-4 border-[#160B53] rounded-full border-t-transparent animate-spin"></div>
                </div>
              </div>
            ) : impactData ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Banknote className="h-5 w-5 text-emerald-600" />
                      <p className="font-semibold text-gray-700">Revenue Impact</p>
                    </div>
                    <p className={`text-3xl font-bold ${impactData.changes?.revenueChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {impactData.changes?.revenueChange >= 0 ? '+' : ''}{(impactData.changes?.revenueChange || 0).toFixed(1)}%
                    </p>
                    <div className="mt-3 pt-3 border-t border-emerald-200 grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Before:</span> <span className="font-semibold">{formatCurrency(impactData.before?.totalRevenue || 0)}</span></div>
                      <div><span className="text-gray-500">After:</span> <span className="font-semibold text-emerald-600">{formatCurrency(impactData.after?.totalRevenue || 0)}</span></div>
                    </div>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-5 w-5 text-purple-600" />
                      <p className="font-semibold text-gray-700">Sales Volume Impact</p>
                    </div>
                    <p className={`text-3xl font-bold ${impactData.changes?.salesCountChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {impactData.changes?.salesCountChange >= 0 ? '+' : ''}{(impactData.changes?.salesCountChange || 0).toFixed(1)}%
                    </p>
                    <div className="mt-3 pt-3 border-t border-purple-200 grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Before:</span> <span className="font-semibold">{impactData.before?.totalSales || 0} sales</span></div>
                      <div><span className="text-gray-500">After:</span> <span className="font-semibold text-purple-600">{impactData.after?.totalSales || 0} sales</span></div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                {impactData.before?.salesByDate && Object.keys(impactData.before.salesByDate).length > 0 && (
                  <div className="p-5 bg-white rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-4">30-Day Comparison</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={Object.keys(impactData.before.salesByDate || {}).slice(0, 15).map(date => ({
                        date: format(new Date(date), 'MMM dd'),
                        before: impactData.before.salesByDate[date]?.revenue || 0,
                        after: impactData.after?.salesByDate?.[date]?.revenue || 0
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                        <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="before" fill="#94a3b8" name="Before" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="after" fill="#160B53" name="After" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No impact data available for this price change</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <Modal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="Filter Options" size="md">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date Range</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'all', label: 'All Time' },
                  { value: '7days', label: '7 Days' },
                  { value: '30days', label: '30 Days' },
                  { value: '90days', label: '90 Days' },
                  { value: 'custom', label: 'Custom' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDateRangeFilter(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      dateRangeFilter === opt.value ? 'bg-[#160B53] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {dateRangeFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#160B53] outline-none"
                  />
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[#160B53] outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Change Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'all', label: 'All', icon: Layers },
                  { value: 'increase', label: 'Increases', icon: TrendingUp },
                  { value: 'decrease', label: 'Decreases', icon: TrendingDown }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setChangeTypeFilter(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                      changeTypeFilter === opt.value ? 'bg-[#160B53] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              <button onClick={clearFilters} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all text-sm font-medium">
                Clear All
              </button>
              <button onClick={() => setShowFilterModal(false)} className="px-6 py-2 bg-[#160B53] text-white rounded-lg hover:bg-[#3B2E7A] transition-all text-sm font-medium">
                Apply Filters
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PriceHistoryAnalytics;
