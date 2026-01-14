/**
 * Price History Analytics Page - Enhanced UI/UX
 * For Operational Manager to view service price change history and sales impact
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  ShoppingCart,
  Calendar,
  Search,
  AlertCircle,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  X,
  User,
  Clock,
  Tag,
  Filter,
  Printer,
  Download,
  RefreshCw,
  DollarSign,
  Percent,
  History,
  ChevronDown,
  Check,
  Building2,
  Sparkles,
  Eye,
  ArrowRight,
  Zap,
  Target,
  PieChart as PieChartIcon
} from 'lucide-react';
import { format, subDays, isWithinInterval } from 'date-fns';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getPriceHistory, getPriceChangeImpact, getTransactionsForPricePeriod } from '../../services/priceHistoryService';
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
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';

// Custom Searchable Dropdown Component
const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  icon: Icon,
  label,
  disabled = false,
  renderOption
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-[#160B53]" />}
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 text-left bg-white border-2 rounded-xl transition-all duration-200 flex items-center justify-between gap-3 ${
          disabled 
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed text-gray-400' 
            : isOpen 
              ? 'border-[#160B53] ring-4 ring-[#160B53]/10 shadow-lg' 
              : 'border-gray-200 hover:border-[#160B53]/50 hover:shadow-md'
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${selectedOption ? 'text-[#160B53]' : 'text-gray-400'}`} />}
          <div className="flex-1 min-w-0">
            {selectedOption ? (
              <div>
                <p className="font-medium text-gray-900 truncate">{selectedOption.label}</p>
                {selectedOption.sublabel && (
                  <p className="text-xs text-gray-500 truncate">{selectedOption.sublabel}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-400">{placeholder}</p>
            )}
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:border-[#160B53] focus:ring-2 focus:ring-[#160B53]/10 outline-none transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No results found</p>
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-all duration-150 ${
                    value === option.value 
                      ? 'bg-[#160B53]/5 border-l-4 border-[#160B53]' 
                      : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  {renderOption ? renderOption(option) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${value === option.value ? 'text-[#160B53]' : 'text-gray-900'}`}>
                          {option.label}
                        </p>
                        {option.sublabel && (
                          <p className="text-xs text-gray-500 truncate">{option.sublabel}</p>
                        )}
                      </div>
                      {value === option.value && (
                        <Check className="h-5 w-5 text-[#160B53] flex-shrink-0" />
                      )}
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PriceHistoryAnalytics = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [priceHistory, setPriceHistory] = useState([]);
  const [impactData, setImpactData] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedPriceChange, setSelectedPriceChange] = useState(null);
  const [selectedPriceType, setSelectedPriceType] = useState(null);
  
  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [changeTypeFilter, setChangeTypeFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  useEffect(() => {
    loadServices();
    loadBranches();
  }, []);

  useEffect(() => {
    if (selectedServiceId && selectedBranchId) {
      loadPriceHistory();
    } else {
      setPriceHistory([]);
      setImpactData(null);
    }
  }, [selectedServiceId, selectedBranchId]);

  const loadServices = async () => {
    try {
      const servicesRef = collection(db, 'services');
      const q = query(servicesRef, where('isActive', '==', true), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const servicesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(servicesList);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    }
  };

  const loadBranches = async () => {
    try {
      const branchesList = await getAllBranches();
      setBranches(branchesList);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load branches');
    }
  };

  const loadPriceHistory = async () => {
    try {
      setLoading(true);
      const history = await getPriceHistory(selectedServiceId, selectedBranchId);
      setPriceHistory(history);
    } catch (error) {
      console.error('Error loading price history:', error);
      toast.error('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const loadImpactAnalysis = async (priceChange) => {
    try {
      setLoadingImpact(true);
      const impact = await getPriceChangeImpact(selectedServiceId, selectedBranchId, priceChange.changedAt, 30, 30);
      setImpactData({ ...impact, priceChange });
    } catch (error) {
      console.error('Error loading impact analysis:', error);
      toast.error('Failed to load impact analysis');
    } finally {
      setLoadingImpact(false);
    }
  };

  const loadTransactionsForPeriod = async (priceChange, priceType = 'old') => {
    try {
      setLoadingTransactions(true);
      setSelectedPriceChange(priceChange);
      setSelectedPriceType(priceType);
      const changeDate = new Date(priceChange.changedAt);
      const price = priceType === 'old' ? priceChange.oldPrice : priceChange.newPrice;
      
      const startDate = new Date(changeDate);
      const endDate = new Date(changeDate);
      
      if (priceType === 'old') {
        startDate.setDate(startDate.getDate() - 30);
        endDate.setDate(endDate.getDate() - 1);
      } else {
        startDate.setDate(startDate.getDate() + 1);
        endDate.setDate(endDate.getDate() + 30);
      }
      
      const transactionsData = await getTransactionsForPricePeriod(selectedServiceId, selectedBranchId, startDate, endDate, price);
      setTransactions(transactionsData);
      setIsTransactionsModalOpen(true);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Dropdown options
  const serviceOptions = useMemo(() => {
    return services
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(service => ({
        value: service.id,
        label: service.name,
        sublabel: service.category || 'Uncategorized',
        price: service.basePrice
      }));
  }, [services, searchTerm]);

  const branchOptions = useMemo(() => {
    return branches.map(branch => ({
      value: branch.id,
      label: branch.name || branch.branchName,
      sublabel: branch.address || 'No address'
    }));
  }, [branches]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(services.map(s => s.category).filter(Boolean))];
    return cats.sort();
  }, [services]);

  // Filter price history
  const filteredPriceHistory = useMemo(() => {
    return priceHistory.filter(change => {
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
      
      let matchesType = true;
      if (changeTypeFilter !== 'all') {
        const isIncrease = change.newPrice > change.oldPrice;
        matchesType = changeTypeFilter === 'increase' ? isIncrease : !isIncrease;
      }
      
      return matchesDate && matchesType;
    });
  }, [priceHistory, dateRangeFilter, changeTypeFilter, startDateFilter, endDateFilter]);

  // Statistics
  const stats = useMemo(() => {
    if (filteredPriceHistory.length === 0) {
      return { totalChanges: 0, avgPriceChange: 0, avgPercentChange: 0, increases: 0, decreases: 0 };
    }
    const increases = filteredPriceHistory.filter(c => c.newPrice > c.oldPrice);
    const decreases = filteredPriceHistory.filter(c => c.newPrice < c.oldPrice);
    const totalPriceChange = filteredPriceHistory.reduce((sum, c) => sum + (c.newPrice - c.oldPrice), 0);
    const totalPercentChange = filteredPriceHistory.reduce((sum, c) => {
      if (c.oldPrice === 0) return sum;
      return sum + ((c.newPrice - c.oldPrice) / c.oldPrice * 100);
    }, 0);

    return {
      totalChanges: filteredPriceHistory.length,
      avgPriceChange: totalPriceChange / filteredPriceHistory.length,
      avgPercentChange: totalPercentChange / filteredPriceHistory.length,
      increases: increases.length,
      decreases: decreases.length
    };
  }, [filteredPriceHistory]);

  const activeFilterCount = [categoryFilter !== 'all', dateRangeFilter !== 'all', changeTypeFilter !== 'all'].filter(Boolean).length;

  const clearFilters = () => {
    setCategoryFilter('all');
    setDateRangeFilter('all');
    setChangeTypeFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const getPriceChangePercentage = (oldPrice, newPrice) => {
    if (!oldPrice || oldPrice === 0) return 0;
    return ((newPrice - oldPrice) / oldPrice) * 100;
  };

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '₱0.00';
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Chart data
  const priceChartData = useMemo(() => {
    if (filteredPriceHistory.length === 0) return [];
    return [...filteredPriceHistory]
      .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))
      .map(change => ({
        date: format(new Date(change.changedAt), 'MMM dd'),
        fullDate: format(new Date(change.changedAt), 'MMM dd, yyyy'),
        oldPrice: change.oldPrice,
        newPrice: change.newPrice,
        change: change.newPrice - change.oldPrice
      }));
  }, [filteredPriceHistory]);

  const changeDistributionData = useMemo(() => {
    if (stats.totalChanges === 0) return [];
    return [
      { name: 'Increases', value: stats.increases, color: '#ef4444' },
      { name: 'Decreases', value: stats.decreases, color: '#22c55e' }
    ].filter(d => d.value > 0);
  }, [stats]);

  // Print functionality
  const handlePrint = () => {
    if (!selectedService || !selectedBranch || filteredPriceHistory.length === 0) {
      toast.error('Please select a service and branch with price history to print');
      return;
    }
    const printWindow = window.open('', '', 'height=600,width=800');
    let htmlContent = `
      <html><head><title>Price History Report - ${selectedService.name}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1f2937; }
        h1 { text-align: center; color: #160B53; font-size: 28px; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #6b7280; margin-bottom: 30px; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .summary-card { padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .summary-value { font-size: 24px; font-weight: 700; color: #1e293b; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 20px; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: linear-gradient(135deg, #160B53 0%, #3B2E7A 100%); color: white; padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .increase { color: #dc2626; font-weight: 600; }
        .decrease { color: #16a34a; font-weight: 600; }
        .footer { text-align: center; margin-top: 40px; color: #9ca3af; font-size: 11px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
      </style></head><body>
      <h1>📊 Price History Report</h1>
      <p class="subtitle">${selectedService.name} at ${selectedBranch.name || selectedBranch.branchName}<br/>Generated on ${format(new Date(), 'MMMM dd, yyyy • hh:mm a')}</p>
      <div class="summary">
        <div class="summary-card"><div class="summary-label">Total Changes</div><div class="summary-value">${stats.totalChanges}</div></div>
        <div class="summary-card"><div class="summary-label">Price Increases</div><div class="summary-value" style="color:#dc2626">${stats.increases}</div></div>
        <div class="summary-card"><div class="summary-label">Price Decreases</div><div class="summary-value" style="color:#16a34a">${stats.decreases}</div></div>
        <div class="summary-card"><div class="summary-label">Avg % Change</div><div class="summary-value">${stats.avgPercentChange >= 0 ? '+' : ''}${stats.avgPercentChange.toFixed(1)}%</div></div>
      </div>
      <table><thead><tr><th>Date Changed</th><th>Old Price</th><th>New Price</th><th>Change</th><th>% Change</th><th>Changed By</th></tr></thead><tbody>`;
    
    filteredPriceHistory.forEach(change => {
      const changePercent = getPriceChangePercentage(change.oldPrice, change.newPrice);
      const isIncrease = change.newPrice > change.oldPrice;
      htmlContent += `<tr>
        <td>${format(new Date(change.changedAt), 'MMM dd, yyyy • hh:mm a')}</td>
        <td>${formatCurrency(change.oldPrice)}</td>
        <td style="font-weight:600">${formatCurrency(change.newPrice)}</td>
        <td class="${isIncrease ? 'increase' : 'decrease'}">${isIncrease ? '+' : ''}${formatCurrency(change.newPrice - change.oldPrice)}</td>
        <td class="${isIncrease ? 'increase' : 'decrease'}">${isIncrease ? '+' : ''}${changePercent.toFixed(1)}%</td>
        <td>${change.changedByName || 'Unknown'}</td>
      </tr>`;
    });
    htmlContent += `</tbody></table><div class="footer">This report was automatically generated by the Price History Analytics system</div></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Export to CSV
  const handleExport = () => {
    if (!selectedService || !selectedBranch || filteredPriceHistory.length === 0) {
      toast.error('Please select a service and branch with price history to export');
      return;
    }
    const headers = ['Date Changed', 'Old Price', 'New Price', 'Price Change', '% Change', 'Changed By'];
    const rows = filteredPriceHistory.map(change => {
      const changePercent = getPriceChangePercentage(change.oldPrice, change.newPrice);
      return [format(new Date(change.changedAt), 'yyyy-MM-dd HH:mm:ss'), change.oldPrice, change.newPrice, (change.newPrice - change.oldPrice).toFixed(2), changePercent.toFixed(2), change.changedByName || 'Unknown'];
    });
    const csvContent = [`Price History Report - ${selectedService.name} at ${selectedBranch.name || selectedBranch.branchName}`, `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, '', headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `price_history_${selectedService.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Price history exported successfully!');
  };

  const handleRefresh = async () => {
    await loadServices();
    await loadBranches();
    if (selectedServiceId && selectedBranchId) await loadPriceHistory();
    toast.success('Data refreshed!');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#160B53] via-[#2D1F6E] to-[#3B2E7A] rounded-2xl p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                  <BarChart3 className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Price History Analytics</h1>
                  <p className="text-white/70 mt-1">Track service price changes and analyze their impact on sales</p>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-white/60 text-sm">Total Services</p>
                <p className="text-2xl font-bold">{services.length}</p>
              </div>
              <div className="w-px h-12 bg-white/20"></div>
              <div className="text-right">
                <p className="text-white/60 text-sm">Branches</p>
                <p className="text-2xl font-bold">{branches.length}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
        <div className="absolute -left-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
      </div>

      {/* Action Bar */}
      <Card className="p-4 border-2 border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-[70%]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search services by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:border-[#160B53] focus:ring-4 focus:ring-[#160B53]/10 outline-none transition-all bg-gray-50 hover:bg-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterModal(true)}
              className="relative p-3 text-gray-500 hover:text-[#160B53] hover:bg-[#160B53]/5 rounded-xl transition-all duration-200"
              title="Filter"
            >
              <Filter className="h-5 w-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#160B53] text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {filteredPriceHistory.length}
                </span>
              )}
            </button>
            <button onClick={handlePrint} className="p-3 text-gray-500 hover:text-[#160B53] hover:bg-[#160B53]/5 rounded-xl transition-all duration-200" title="Print Report">
              <Printer className="h-5 w-5" />
            </button>
            <button onClick={handleExport} className="p-3 text-gray-500 hover:text-[#160B53] hover:bg-[#160B53]/5 rounded-xl transition-all duration-200" title="Export CSV">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={handleRefresh} disabled={loading} className="p-3 text-gray-500 hover:text-[#160B53] hover:bg-[#160B53]/5 rounded-xl transition-all duration-200 disabled:opacity-50" title="Refresh">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* Selection Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Selection Card */}
        <Card className="p-6 border-2 border-gray-100 hover:border-[#160B53]/20 transition-all duration-300 hover:shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Select Service</h3>
              <p className="text-sm text-gray-500">Choose a service to analyze</p>
            </div>
          </div>
          <SearchableDropdown
            options={serviceOptions}
            value={selectedServiceId}
            onChange={setSelectedServiceId}
            placeholder="Search and select a service..."
            icon={Tag}
            renderOption={(option) => (
              <>
                <div className="p-2 bg-gradient-to-br from-[#160B53]/10 to-[#160B53]/5 rounded-lg">
                  <Tag className="h-4 w-4 text-[#160B53]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${selectedServiceId === option.value ? 'text-[#160B53]' : 'text-gray-900'}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{option.sublabel}</p>
                </div>
                {selectedServiceId === option.value && <Check className="h-5 w-5 text-[#160B53]" />}
              </>
            )}
          />
        </Card>

        {/* Branch Selection Card */}
        <Card className="p-6 border-2 border-gray-100 hover:border-[#160B53]/20 transition-all duration-300 hover:shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Select Branch</h3>
              <p className="text-sm text-gray-500">Choose a branch location</p>
            </div>
          </div>
          <SearchableDropdown
            options={branchOptions}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
            placeholder="Search and select a branch..."
            icon={Building2}
            disabled={!selectedServiceId}
            renderOption={(option) => (
              <>
                <div className="p-2 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-lg">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${selectedBranchId === option.value ? 'text-[#160B53]' : 'text-gray-900'}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{option.sublabel}</p>
                </div>
                {selectedBranchId === option.value && <Check className="h-5 w-5 text-[#160B53]" />}
              </>
            )}
          />
        </Card>
      </div>

      {/* Selected Service Info Banner */}
      {selectedService && selectedBranch && (
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white rounded-xl shadow-sm border border-blue-100">
                <Tag className="h-8 w-8 text-[#160B53]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Currently Analyzing</p>
                <h3 className="text-xl font-bold text-gray-900">{selectedService.name}</h3>
                <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4" />
                  {selectedBranch.name || selectedBranch.branchName}
                </p>
              </div>
            </div>
            {selectedService.branchPricing?.[selectedBranchId] && (
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Current Price</p>
                <p className="text-3xl font-bold text-[#160B53]">
                  {formatCurrency(selectedService.branchPricing[selectedBranchId])}
                </p>
              </div>
            )}
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl"></div>
        </div>
      )}

      {/* Stats Cards */}
      {selectedServiceId && selectedBranchId && filteredPriceHistory.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 hover:shadow-lg transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Changes</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalChanges}</p>
                <p className="text-xs text-slate-500 mt-1">Price modifications</p>
              </div>
              <div className="p-3 bg-slate-200 rounded-xl group-hover:scale-110 transition-transform">
                <History className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-5 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 hover:shadow-lg transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Increases</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.increases}</p>
                <p className="text-xs text-red-400 mt-1">{stats.totalChanges > 0 ? ((stats.increases / stats.totalChanges) * 100).toFixed(0) : 0}% of total</p>
              </div>
              <div className="p-3 bg-red-200 rounded-xl group-hover:scale-110 transition-transform">
                <TrendingUp className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 hover:shadow-lg transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-green-500 uppercase tracking-wider">Decreases</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.decreases}</p>
                <p className="text-xs text-green-400 mt-1">{stats.totalChanges > 0 ? ((stats.decreases / stats.totalChanges) * 100).toFixed(0) : 0}% of total</p>
              </div>
              <div className="p-3 bg-green-200 rounded-xl group-hover:scale-110 transition-transform">
                <TrendingDown className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
          
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 hover:shadow-lg transition-all duration-300 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider">Avg Change</p>
                <p className={`text-3xl font-bold mt-2 ${stats.avgPercentChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.avgPercentChange >= 0 ? '+' : ''}{stats.avgPercentChange.toFixed(1)}%
                </p>
                <p className="text-xs text-purple-400 mt-1">Per modification</p>
              </div>
              <div className="p-3 bg-purple-200 rounded-xl group-hover:scale-110 transition-transform">
                <Percent className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {selectedServiceId && selectedBranchId && (
        <>
          {loading ? (
            <Card className="p-16 border-2 border-gray-100">
              <div className="flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-[#160B53]/20 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#160B53] rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-500 font-medium">Loading price history...</p>
              </div>
            </Card>
          ) : priceHistory.length === 0 ? (
            <Card className="p-16 border-2 border-dashed border-gray-300 bg-gray-50/50">
              <div className="text-center">
                <div className="mx-auto w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                  <AlertCircle className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Price History Found</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  No price changes have been recorded for this service at this branch yet. Price history will appear here once changes are made.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Charts Section */}
              {filteredPriceHistory.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Price Trend Chart */}
                  <Card className="xl:col-span-2 p-6 border-2 border-gray-100 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-[#160B53] to-[#3B2E7A] rounded-xl text-white">
                          <Activity className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">Price Trend Over Time</h3>
                          <p className="text-sm text-gray-500">Historical price changes visualization</p>
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={priceChartData}>
                        <defs>
                          <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#160B53" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#160B53" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                        <YAxis tickFormatter={(value) => `₱${value}`} stroke="#9ca3af" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                          formatter={(value, name) => [`₱${value.toLocaleString()}`, name === 'newPrice' ? 'New Price' : 'Old Price']}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="newPrice" stroke="#160B53" strokeWidth={3} fill="url(#colorNew)" name="New Price" dot={{ r: 5, fill: '#160B53' }} />
                        <Line type="monotone" dataKey="oldPrice" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Old Price" dot={{ r: 4, fill: '#94a3b8' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Distribution Chart */}
                  <Card className="p-6 border-2 border-gray-100 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl text-white">
                        <PieChartIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Distribution</h3>
                        <p className="text-sm text-gray-500">Increases vs Decreases</p>
                      </div>
                    </div>
                    {changeDistributionData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={changeDistributionData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value">
                              {changeDistributionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-6 mt-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-sm text-gray-600">Increases ({stats.increases})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-sm text-gray-600">Decreases ({stats.decreases})</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-[200px] text-gray-400">No data</div>
                    )}
                  </Card>
                </div>
              )}

              {/* Price History Table */}
              <Card className="overflow-hidden border-2 border-gray-100 hover:shadow-lg transition-all duration-300">
                <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl text-white">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Price Change Timeline</h3>
                        <p className="text-sm text-gray-500">Click any row to view detailed impact analysis</p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                      {filteredPriceHistory.length} of {priceHistory.length} changes
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#160B53] to-[#3B2E7A]">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Old Price</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">New Price</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Change</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Changed By</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPriceHistory.map((change, idx) => {
                        const changePercent = getPriceChangePercentage(change.oldPrice, change.newPrice);
                        const isIncrease = change.newPrice > change.oldPrice;
                        
                        return (
                          <tr key={change.id} className={`hover:bg-[#160B53]/5 transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                  <Calendar className="h-4 w-4 text-gray-500" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{format(change.changedAt, 'MMM dd, yyyy')}</p>
                                  <p className="text-xs text-gray-500">{format(change.changedAt, 'hh:mm a')}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-600 font-medium">{formatCurrency(change.oldPrice)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-[#160B53]">{formatCurrency(change.newPrice)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                isIncrease ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {isIncrease ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                {Math.abs(changePercent).toFixed(1)}%
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{formatCurrency(Math.abs(change.newPrice - change.oldPrice))}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                  <User className="h-4 w-4 text-gray-500" />
                                </div>
                                <span className="font-medium text-gray-900">{change.changedByName || 'Unknown'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => loadImpactAnalysis(change)} className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-xl transition-all" title="Impact Analysis">
                                  <BarChart3 className="h-4 w-4" />
                                </button>
                                <button onClick={() => loadTransactionsForPeriod(change, 'old')} className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-all" title="Old Price Transactions">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button onClick={() => loadTransactionsForPeriod(change, 'new')} className="p-2.5 text-green-600 hover:bg-green-100 rounded-xl transition-all" title="New Price Transactions">
                                  <DollarSign className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* Impact Analysis Section */}
          {impactData && (
            <Card className="overflow-hidden border-2 border-gray-100">
              <div className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
                    <Target className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Sales Impact Analysis</h3>
                    <p className="text-sm text-gray-600">
                      Comparing 30 days before and after the price change on{' '}
                      <span className="font-semibold text-[#160B53]">{format(impactData.priceChange.changedAt, 'MMM dd, yyyy')}</span>
                    </p>
                  </div>
                </div>
              </div>

              {loadingImpact ? (
                <div className="p-16 flex justify-center">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-purple-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Impact Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-emerald-500 rounded-xl text-white">
                          <Banknote className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-gray-700">Revenue Change</p>
                      </div>
                      <p className={`text-4xl font-bold ${impactData.changes.revenueChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {impactData.changes.revenueChange >= 0 ? '+' : ''}{impactData.changes.revenueChange.toFixed(1)}%
                      </p>
                      <div className="mt-4 pt-4 border-t border-emerald-200 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Before</p>
                          <p className="font-bold text-gray-900">{formatCurrency(impactData.before.totalRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">After</p>
                          <p className="font-bold text-emerald-600">{formatCurrency(impactData.after.totalRevenue)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-purple-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-500 rounded-xl text-white">
                          <Activity className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-gray-700">Sales Count Change</p>
                      </div>
                      <p className={`text-4xl font-bold ${impactData.changes.salesCountChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {impactData.changes.salesCountChange >= 0 ? '+' : ''}{impactData.changes.salesCountChange.toFixed(1)}%
                      </p>
                      <div className="mt-4 pt-4 border-t border-purple-200 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Before</p>
                          <p className="font-bold text-gray-900">{impactData.before.totalSales} sales</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">After</p>
                          <p className="font-bold text-purple-600">{impactData.after.totalSales} sales</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comparison Charts */}
                  {impactData.before.salesByDate && impactData.after.salesByDate && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="p-6 bg-white rounded-2xl border-2 border-gray-100">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Banknote className="h-5 w-5 text-emerald-500" />
                          Daily Revenue Comparison
                        </h4>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={(() => {
                            const beforeDates = Object.keys(impactData.before.salesByDate || {});
                            const afterDates = Object.keys(impactData.after.salesByDate || {});
                            const allDates = [...new Set([...beforeDates, ...afterDates])].sort();
                            return allDates.slice(0, 10).map(date => ({
                              date: format(new Date(date), 'MMM dd'),
                              before: impactData.before.salesByDate[date]?.revenue || 0,
                              after: impactData.after.salesByDate[date]?.revenue || 0
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                            <YAxis stroke="#9ca3af" fontSize={11} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }} formatter={(value) => `₱${value.toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="before" fill="#94a3b8" name="Before" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="after" fill="#160B53" name="After" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="p-6 bg-white rounded-2xl border-2 border-gray-100">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Activity className="h-5 w-5 text-purple-500" />
                          Daily Sales Count
                        </h4>
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={(() => {
                            const beforeDates = Object.keys(impactData.before.salesByDate || {});
                            const afterDates = Object.keys(impactData.after.salesByDate || {});
                            const allDates = [...new Set([...beforeDates, ...afterDates])].sort();
                            return allDates.slice(0, 10).map(date => ({
                              date: format(new Date(date), 'MMM dd'),
                              before: impactData.before.salesByDate[date]?.count || 0,
                              after: impactData.after.salesByDate[date]?.count || 0
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                            <YAxis stroke="#9ca3af" fontSize={11} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '2px solid #e5e7eb' }} />
                            <Legend />
                            <Line type="monotone" dataKey="before" stroke="#94a3b8" strokeWidth={2} name="Before" dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="after" stroke="#8b5cf6" strokeWidth={2} name="After" dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Transactions Modal */}
          {isTransactionsModalOpen && selectedPriceChange && (
            <Modal
              isOpen={isTransactionsModalOpen}
              onClose={() => { setIsTransactionsModalOpen(false); setSelectedPriceChange(null); setSelectedPriceType(null); setTransactions([]); }}
              title={`Transactions - ${selectedPriceType === 'old' ? 'Old' : 'New'} Price Period`}
              size="xl"
            >
              {loadingTransactions ? (
                <div className="flex justify-center py-12">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-[#160B53] rounded-full border-t-transparent animate-spin"></div>
                  </div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No Transactions Found</h3>
                  <p className="text-gray-500">No transactions found for this price period.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Price Period</p>
                        <p className="text-2xl font-bold text-[#160B53]">
                          {formatCurrency(selectedPriceType === 'old' ? selectedPriceChange.oldPrice : selectedPriceChange.newPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Revenue</p>
                        <p className="text-xl font-bold text-emerald-600">
                          {formatCurrency(transactions.reduce((sum, t) => sum + t.itemPrice, 0))}
                        </p>
                        <p className="text-xs text-gray-500">{transactions.length} transactions</p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Price</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Payment</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stylist</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{format(transaction.transactionDate, 'MMM dd, yyyy')}</p>
                              <p className="text-xs text-gray-500">{format(transaction.transactionDate, 'hh:mm a')}</p>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{transaction.clientName}</td>
                            <td className="px-4 py-3 font-bold text-[#160B53]">{formatCurrency(transaction.itemPrice)}</td>
                            <td className="px-4 py-3 capitalize text-gray-600">{transaction.paymentMethod}</td>
                            <td className="px-4 py-3 text-gray-600">{transaction.stylistName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Modal>
          )}
        </>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <Modal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="Filter Price History" size="md">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Service Category</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    categoryFilter === 'all' ? 'bg-[#160B53] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Categories
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      categoryFilter === cat ? 'bg-[#160B53] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'all', label: 'All Time' },
                  { value: '7days', label: 'Last 7 Days' },
                  { value: '30days', label: 'Last 30 Days' },
                  { value: '90days', label: 'Last 90 Days' },
                  { value: 'custom', label: 'Custom Range' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDateRangeFilter(opt.value)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      dateRangeFilter === opt.value ? 'bg-[#160B53] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {dateRangeFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#160B53] focus:ring-2 focus:ring-[#160B53]/10 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#160B53] focus:ring-2 focus:ring-[#160B53]/10 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Change Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'all', label: 'All', icon: Activity },
                  { value: 'increase', label: 'Increases', icon: TrendingUp },
                  { value: 'decrease', label: 'Decreases', icon: TrendingDown }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setChangeTypeFilter(opt.value)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
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
              <button onClick={clearFilters} className="px-6 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all font-medium">
                Clear All
              </button>
              <button onClick={() => setShowFilterModal(false)} className="px-8 py-2.5 bg-[#160B53] text-white rounded-xl hover:bg-[#3B2E7A] transition-all font-medium">
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
