import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { Card } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/SearchInput';
import { Eye, Receipt, Calendar, CreditCard, Tag, Percent, FileText, Package, Scissors, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientTransactions() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    paymentMethod: 'all'
  });

  useEffect(() => {
    if (!currentUser) return;
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('clientId', '==', currentUser.uid),
        where('status', '==', 'paid'),
        orderBy('createdAt', 'desc')
      );
      // Note: Refunded transactions are excluded (status must be 'paid')

      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = transactions;

    // Apply search term
    if (searchTerm) {
      result = result.filter(t => {
        const idMatch = t.id?.toLowerCase()?.includes(searchTerm.toLowerCase());
        const receiptMatch = t.receiptNumber?.toLowerCase()?.includes(searchTerm.toLowerCase());
        const branchMatch = (t.branchName || '')?.toLowerCase()?.includes(searchTerm.toLowerCase());
        const itemsMatch = (t.items || []).some(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
        return idMatch || receiptMatch || branchMatch || itemsMatch;
      });
    }

    // Apply filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter(t => {
        const txDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
        return txDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(t => {
        const txDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
        return txDate <= toDate;
      });
    }

    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      result = result.filter(t => (t.total || t.amount || 0) >= min);
    }

    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      result = result.filter(t => (t.total || t.amount || 0) <= max);
    }

    if (filters.paymentMethod !== 'all') {
      result = result.filter(t => 
        (t.paymentMethod || t.payMethod || '').toLowerCase() === filters.paymentMethod.toLowerCase()
      );
    }

    return result;
  }, [transactions, searchTerm, filters]);

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      paymentMethod: 'all'
    });
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.minAmount || filters.maxAmount || filters.paymentMethod !== 'all';

  // Separate items by type
  const getItemsByType = (items = []) => {
    const services = items.filter(item => item.type === 'service');
    const products = items.filter(item => item.type === 'product');
    return { services, products };
  };

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchInput 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Search by transaction ID, receipt number, branch or item..." 
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && !showFilters && (
              <span className="ml-1 px-2 py-0.5 bg-white text-primary-600 rounded-full text-xs font-bold">
                •
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={filters.paymentMethod}
                  onChange={e => setFilters({ ...filters, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="card">Card</option>
                  <option value="bank transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Amount (₱)
                </label>
                <input
                  type="number"
                  value={filters.minAmount}
                  onChange={e => setFilters({ ...filters, minAmount: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Amount (₱)
                </label>
                <input
                  type="number"
                  value={filters.maxAmount}
                  onChange={e => setFilters({ ...filters, maxAmount: e.target.value })}
                  placeholder="No limit"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Active filters:</span>
                {filters.dateFrom && <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded">From: {filters.dateFrom}</span>}
                {filters.dateTo && <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded">To: {filters.dateTo}</span>}
                {filters.minAmount && <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded">Min: ₱{filters.minAmount}</span>}
                {filters.maxAmount && <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded">Max: ₱{filters.maxAmount}</span>}
                {filters.paymentMethod !== 'all' && <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded">{filters.paymentMethod}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transactions List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'Try adjusting your search terms' : "You don't have any paid transactions yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tx => {
            const { services, products } = getItemsByType(tx.items);
            return (
              <Card 
                key={tx.id} 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer" 
                onClick={() => { setSelectedTransaction(tx); setShowDetails(true); }}
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Receipt #</div>
                    <div className="font-semibold text-gray-900">{tx.receiptNumber || tx.id}</div>
                    <div className="text-xs text-gray-500 mt-1">{tx.branchName || 'Branch'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Total Paid</div>
                    <div className="font-bold text-lg text-primary-600">{formatCurrency(tx.total || tx.amount || 0)}</div>
                  </div>
                </div>

                {/* Quick Summary */}
                <div className="space-y-1 mb-3">
                  {services.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Scissors className="w-3 h-3" />
                      <span>{services.length} service(s)</span>
                    </div>
                  )}
                  {products.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Package className="w-3 h-3" />
                      <span>{products.length} product(s)</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t text-xs text-gray-500 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(tx.createdAt || tx.createdAt?.toDate?.())}
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-600 rounded font-medium">
                    <Eye className="w-3 h-3" />
                    Details
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Enhanced Details Modal */}
      {showDetails && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold">Transaction Details</h2>
                <p className="text-primary-100 text-sm">Receipt #{selectedTransaction.receiptNumber || selectedTransaction.id}</p>
              </div>
              <button 
                onClick={() => { setShowDetails(false); setSelectedTransaction(null); }} 
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" />
                    Date & Time
                  </div>
                  <div className="font-semibold text-gray-900">
                    {selectedTransaction.createdAt?.toDate ? 
                      selectedTransaction.createdAt.toDate().toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 
                      formatDate(selectedTransaction.createdAt)
                    }
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </div>
                  <div className="font-semibold text-gray-900">
                    {selectedTransaction.paymentMethod || selectedTransaction.payMethod || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Branch Info */}
              {selectedTransaction.branchName && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-600 font-medium mb-1">Branch</div>
                  <div className="font-semibold text-gray-900">{selectedTransaction.branchName}</div>
                </div>
              )}

              {/* Services */}
              {(() => {
                const { services } = getItemsByType(selectedTransaction.items);
                if (services.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-primary-600" />
                      Services ({services.length})
                    </h3>
                    <div className="space-y-2">
                      {services.map((item, i) => (
                        <div key={i} className="flex items-start justify-between border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name || item.title || 'Service'}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              Qty: {item.quantity || 1}
                              {item.stylistName && ` • Stylist: ${item.stylistName}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">{formatCurrency(item.price || 0)}</div>
                            {item.quantity > 1 && (
                              <div className="text-xs text-gray-500">{formatCurrency((item.price || 0) / item.quantity)} each</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Products */}
              {(() => {
                const { products } = getItemsByType(selectedTransaction.items);
                if (products.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary-600" />
                      Products ({products.length})
                    </h3>
                    <div className="space-y-2">
                      {products.map((item, i) => (
                        <div key={i} className="flex items-start justify-between border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name || item.productName || 'Product'}</div>
                            <div className="text-xs text-gray-500 mt-1">Qty: {item.quantity || 1}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">{formatCurrency(item.price || 0)}</div>
                            {item.quantity > 1 && (
                              <div className="text-xs text-gray-500">{formatCurrency((item.price || 0) / item.quantity)} each</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Pricing Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Pricing Breakdown</h3>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(selectedTransaction.subtotal || 0)}</span>
                </div>

                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Discount
                      {selectedTransaction.discountType === 'percent' && selectedTransaction.discountValue && 
                        ` (${selectedTransaction.discountValue}%)`
                      }
                      {selectedTransaction.promotionCode && ` - ${selectedTransaction.promotionCode}`}:
                    </span>
                    <span className="font-medium">-{formatCurrency(selectedTransaction.discount)}</span>
                  </div>
                )}

                {selectedTransaction.promotionDiscount > 0 && !selectedTransaction.discount && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Promo ({selectedTransaction.promotionCode}):
                    </span>
                    <span className="font-medium">-{formatCurrency(selectedTransaction.promotionDiscount)}</span>
                  </div>
                )}

                {selectedTransaction.loyaltyPointsUsed > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      Loyalty Points ({selectedTransaction.loyaltyPointsUsed} pts):
                    </span>
                    <span className="font-medium">-{formatCurrency(selectedTransaction.loyaltyDiscount || 0)}</span>
                  </div>
                )}

                {selectedTransaction.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">VAT (12%):</span>
                    <span className="font-medium text-gray-900">{formatCurrency(selectedTransaction.tax)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-300 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total Paid:</span>
                  <span className="font-bold text-2xl text-primary-600">{formatCurrency(selectedTransaction.total || selectedTransaction.amount || 0)}</span>
                </div>

                {selectedTransaction.paymentMethod === 'Cash' && selectedTransaction.amountReceived && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Amount Received:</span>
                      <span>{formatCurrency(selectedTransaction.amountReceived)}</span>
                    </div>
                    {selectedTransaction.change > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Change:</span>
                        <span>{formatCurrency(selectedTransaction.change)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Notes */}
              {selectedTransaction.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-yellow-900 mb-1">Notes</div>
                      <div className="text-sm text-yellow-800">{selectedTransaction.notes}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
              <button
                onClick={() => { setShowDetails(false); setSelectedTransaction(null); }}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
