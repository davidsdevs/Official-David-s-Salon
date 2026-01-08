/**
 * Commission Page - Stylist
 * View product commissions (10% on products sold when stylist performs a service)
 * Similar to mobile StylistCommissionScreen
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Search, 
  ShoppingBag, 
  TrendingUp, 
  Receipt, 
  Package,
  ChevronDown,
  ArrowUpDown,
  MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDate, formatTime, formatCurrency } from '../../utils/helpers';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const StylistCommission = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('allTime');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);

  const [summary, setSummary] = useState({
    totalCommission: 0,
    productCount: 0,
    transactionCount: 0,
  });

  // Quick filter options
  const quickFilters = [
    { key: 'allTime', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'last7days', label: 'Last 7 Days' },
    { key: 'last30days', label: 'Last 30 Days' },
    { key: 'thisMonth', label: 'This Month' },
  ];

  // Apply quick date filter
  const applyQuickFilter = (filterKey) => {
    setSelectedQuickFilter(filterKey);
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    switch (filterKey) {
      case 'allTime':
        setStartDate(null);
        setEndDate(null);
        break;
      case 'today':
        setStartDate(startOfDay);
        setEndDate(endOfDay);
        break;
      case 'last7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        setStartDate(new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate()));
        setEndDate(endOfDay);
        break;
      case 'last30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        setStartDate(new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate()));
        setEndDate(endOfDay);
        break;
      case 'thisMonth':
        setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setEndDate(endOfDay);
        break;
      default:
        setStartDate(null);
        setEndDate(null);
    }
  };

  // Fetch product commissions with real-time updates
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const stylistId = currentUser.uid;

    const transactionsRef = collection(db, 'transactions');
    const paidTransactionsQuery = query(transactionsRef, where('status', '==', 'paid'));

    const unsubscribe = onSnapshot(paidTransactionsQuery, (querySnapshot) => {
      try {
        const fetchedCommissions = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();

          let createdAtDate;
          const createdAtField = data.createdAt;
          if (createdAtField?.toDate && typeof createdAtField.toDate === 'function') {
            createdAtDate = createdAtField.toDate();
          } else if (createdAtField instanceof Date) {
            createdAtDate = createdAtField;
          } else if (typeof createdAtField === 'string') {
            createdAtDate = new Date(createdAtField);
          } else {
            createdAtDate = new Date();
          }

          const transactionDate = createdAtDate;
          const clientName = data.clientName || data.clientInfo?.name || 'Unknown Client';
          const branchId = data.branchId || '';
          const branchName = data.branchName || '';

          // New schema: items[] array - only get PRODUCTS where stylist performed a service
          if (data.items && Array.isArray(data.items)) {
            const hasStylistService = data.items.some((item) => {
              const itemStylistId = item.stylistId || data.stylistId;
              return itemStylistId === stylistId && item.type !== 'product';
            });

            if (hasStylistService) {
              data.items.forEach((item, index) => {
                if (item.type !== 'product') return;

                const quantity = Number(item.quantity) || 1;
                const unitPrice = Number(item.price ?? item.basePrice ?? 0);
                const lineTotal = Number((unitPrice * quantity).toFixed(2));
                const productCommission = Number((lineTotal * 0.1).toFixed(2));

                fetchedCommissions.push({
                  id: doc.id + '_' + (item.id || index),
                  transactionId: doc.id,
                  clientName,
                  productName: String(item.name || item.productName || 'Product'),
                  quantity,
                  amount: lineTotal,
                  commission: productCommission,
                  date: transactionDate,
                  branchId,
                  branchName,
                });
              });
            }
          } else {
            // Backward compatibility: older schema with services[] & products[]
            const hasStylistService = data.services?.some((s) => {
              const serviceStylistId = s.stylistId || data.stylistId;
              return serviceStylistId === stylistId;
            });

            if (hasStylistService && data.products && Array.isArray(data.products) && data.products.length > 0) {
              data.products.forEach((product) => {
                const quantity = Number(product.quantity) || 1;
                const productTotal = Number((Number(product.price) || 0) * quantity);
                const productCommission = Number((productTotal * 0.1).toFixed(2));

                fetchedCommissions.push({
                  id: doc.id + '_' + (product.id || product.productId),
                  transactionId: doc.id,
                  clientName,
                  productName: String(product.name || product.productName || 'Product'),
                  quantity,
                  amount: productTotal,
                  commission: productCommission,
                  date: transactionDate,
                  branchId,
                  branchName,
                });
              });
            }
          }
        });

        // Sort by date descending
        fetchedCommissions.sort((a, b) => b.date.getTime() - a.date.getTime());

        setCommissions(fetchedCommissions);
        setLoading(false);
      } catch (error) {
        console.error('Error processing commissions:', error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Filter and sort commissions
  const filteredCommissions = useMemo(() => {
    let filtered = [...commissions];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.clientName.toLowerCase().includes(q) ||
          c.productName.toLowerCase().includes(q)
      );
    }

    // Date filter
    if (startDate || endDate) {
      filtered = filtered.filter((c) => {
        const date = new Date(c.date);
        date.setHours(0, 0, 0, 0);

        if (startDate && endDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return date >= start && date <= end;
        } else if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          return date >= start;
        } else if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return date <= end;
        }
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return b.date.getTime() - a.date.getTime();
        case 'date-asc':
          return a.date.getTime() - b.date.getTime();
        case 'amount-desc':
          return b.commission - a.commission;
        case 'amount-asc':
          return a.commission - b.commission;
        default:
          return 0;
      }
    });

    return filtered;
  }, [commissions, searchQuery, sortBy, startDate, endDate]);

  // Group commissions by transaction
  const groupedCommissions = useMemo(() => {
    const grouped = [];
    const groupedMap = {};

    filteredCommissions.forEach((c) => {
      const key = c.transactionId || c.id;

      if (!groupedMap[key]) {
        groupedMap[key] = {
          id: key,
          transactionId: c.transactionId,
          clientName: c.clientName,
          date: c.date,
          totalAmount: c.amount,
          totalCommission: c.commission,
          products: [{ name: c.productName, quantity: c.quantity, amount: c.amount, commission: c.commission }],
          branchId: c.branchId,
          branchName: c.branchName,
        };
        grouped.push(groupedMap[key]);
      } else {
        groupedMap[key].totalAmount += c.amount;
        groupedMap[key].totalCommission += c.commission;
        groupedMap[key].products.push({ name: c.productName, quantity: c.quantity, amount: c.amount, commission: c.commission });
      }
    });

    return grouped;
  }, [filteredCommissions]);

  // Update summary when filtered commissions change
  useEffect(() => {
    const totalComm = filteredCommissions.reduce((sum, c) => sum + c.commission, 0);
    const uniqueTransactions = new Set(filteredCommissions.map((c) => c.transactionId)).size;

    setSummary({
      totalCommission: totalComm,
      productCount: filteredCommissions.length,
      transactionCount: uniqueTransactions,
    });
  }, [filteredCommissions]);

  // Get filter count for badges
  const getFilterCount = (filterKey) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    let filtered = commissions;

    switch (filterKey) {
      case 'allTime':
        break;
      case 'today':
        filtered = commissions.filter((c) => {
          const date = new Date(c.date);
          date.setHours(0, 0, 0, 0);
          return date >= startOfDay && date <= endOfDay;
        });
        break;
      case 'last7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        filtered = commissions.filter((c) => {
          const date = new Date(c.date);
          date.setHours(0, 0, 0, 0);
          return date >= new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate()) && date <= endOfDay;
        });
        break;
      case 'last30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        filtered = commissions.filter((c) => {
          const date = new Date(c.date);
          date.setHours(0, 0, 0, 0);
          return date >= new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate()) && date <= endOfDay;
        });
        break;
      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        filtered = commissions.filter((c) => {
          const date = new Date(c.date);
          date.setHours(0, 0, 0, 0);
          return date >= startOfMonth && date <= endOfDay;
        });
        break;
    }

    const uniqueTransactionIds = new Set(filtered.map((c) => c.transactionId));
    return uniqueTransactionIds.size;
  };

  const visibleCommissions = groupedCommissions.slice(0, displayCount);
  const hasMore = displayCount < groupedCommissions.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Commission</h1>
        <p className="text-gray-600">Track your 10% commission from product sales</p>
      </div>

      {/* Summary Cards - Consistent with Receptionist Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Commission</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalCommission)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Products Sold</p>
              <p className="text-xl font-bold text-gray-900">{summary.productCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <Receipt className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-xl font-bold text-gray-900">{summary.transactionCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Filter Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-2">
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((filter) => {
            const count = getFilterCount(filter.key);
            return (
              <button
                key={filter.key}
                onClick={() => applyQuickFilter(filter.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedQuickFilter === filter.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
                {count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      selectedQuickFilter === filter.key
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Sort */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                {sortBy === 'date-desc' && 'Date: Newest'}
                {sortBy === 'date-asc' && 'Date: Oldest'}
                {sortBy === 'amount-desc' && 'Commission: High'}
                {sortBy === 'amount-asc' && 'Commission: Low'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {[
                  { value: 'date-desc', label: 'Date: Newest First' },
                  { value: 'date-asc', label: 'Date: Oldest First' },
                  { value: 'amount-desc', label: 'Commission: High to Low' },
                  { value: 'amount-asc', label: 'Commission: Low to High' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      sortBy === option.value ? 'text-primary-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commission List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Commission History ({groupedCommissions.length} transactions)
        </h2>

        {groupedCommissions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-lg border border-gray-100">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No product commissions found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery || selectedQuickFilter !== 'allTime'
                ? 'Try adjusting your filters'
                : 'Product commissions will appear here when you sell products during your services'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCommissions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-primary-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {transaction.clientName}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        +{formatCurrency(transaction.totalCommission)}
                      </span>
                    </div>

                    {/* Products */}
                    <div className="space-y-2 mb-3">
                      {transaction.products.map((product, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4 text-amber-500" />
                            <span className="text-gray-700">
                              {product.name}
                              {product.quantity > 1 && ` (x${product.quantity})`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500">{formatCurrency(product.amount)}</span>
                            <span className="text-green-600 ml-2">+{formatCurrency(product.commission)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(transaction.date)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(transaction.date)}</span>
                      </div>
                      {transaction.branchName && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{transaction.branchName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Sale</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(transaction.totalAmount)}</p>
                    <p className="text-xs text-gray-500 mt-1">10% Commission</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => setDisplayCount((prev) => prev + 10)}
                  className="px-6 py-2 text-primary-600 hover:text-primary-700 font-medium"
                >
                  Load More ({groupedCommissions.length - displayCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StylistCommission;
