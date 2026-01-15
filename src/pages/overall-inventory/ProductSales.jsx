// src/pages/overall-inventory/ProductSales.jsx
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { getAllBranches } from '../../services/branchService';
import { db } from '../../config/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import {
  ShoppingCart,
  Eye,
  RefreshCw,
  Building,
  Printer,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Package,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

const ProductSales = () => {
  const [branches, setBranches] = useState([]);
  const [productTransactions, setProductTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('7');
  const [branchFilter, setBranchFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const ITEMS_PER_PAGE = 15;

  // Load branches
  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  };

  // Load Product Transactions from all branches
  const loadProductTransactions = async () => {
    try {
      setLoading(true);
      
      let transactionsQuery = query(
        collection(db, 'transactions'),
        orderBy('createdAt', 'desc')
      );

      // Apply date filter
      if (dateFilter !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter));
        transactionsQuery = query(
          collection(db, 'transactions'),
          where('createdAt', '>=', daysAgo),
          orderBy('createdAt', 'desc')
        );
      }

      const transactionsSnapshot = await getDocs(transactionsQuery);
      let transactions = [];
      
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include transactions that have products
        if (data.salesType === 'product' || data.salesType === 'mixed') {
          transactions.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
          });
        }
      });

      // Apply branch filter client-side
      if (branchFilter !== 'all') {
        transactions = transactions.filter(t => t.branchId === branchFilter);
      }

      // Enrich with branch names and extract product items
      const enrichedTransactions = transactions.map(transaction => {
        const branch = branches.find(b => b.id === transaction.branchId);
        const productItems = (transaction.items || []).filter(item => item.type === 'product');
        const totalProductQty = productItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalProductValue = productItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
        
        return {
          ...transaction,
          branchName: branch?.name || 'Unknown Branch',
          productItems,
          totalProductQty,
          totalProductValue
        };
      });

      setProductTransactions(enrichedTransactions);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading product transactions:', err);
      setProductTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      loadProductTransactions();
    }
  }, [branches, dateFilter, branchFilter]);

  // Pagination
  const totalPages = Math.ceil(productTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = productTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Summary stats
  const totalTransactions = productTransactions.length;
  const totalProductsSold = productTransactions.reduce((sum, t) => sum + t.totalProductQty, 0);
  const totalRevenue = productTransactions.reduce((sum, t) => sum + t.totalProductValue, 0);

  // Print function
  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=900');
    printWindow.document.write(`
      <html>
        <head>
          <title>Product Sales Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            .summary { margin-bottom: 20px; }
            .summary span { margin-right: 20px; }
          </style>
        </head>
        <body>
          <h1>Product Sales Report</h1>
          <p>Generated: ${format(new Date(), 'PPpp')}</p>
          <div class="summary">
            <span><strong>Total Transactions:</strong> ${totalTransactions}</span>
            <span><strong>Products Sold:</strong> ${totalProductsSold}</span>
            <span><strong>Total Revenue:</strong> ₱${totalRevenue.toLocaleString()}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Branch</th>
                <th>Products</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${productTransactions.map(t => `
                <tr>
                  <td>${format(t.createdAt, 'MMM dd, yyyy HH:mm')}</td>
                  <td>${t.id.slice(0, 8)}...</td>
                  <td>${t.branchName}</td>
                  <td>${t.productItems.map(p => p.name).join(', ')}</td>
                  <td>${t.totalProductQty}</td>
                  <td>₱${t.totalProductValue.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Sales</h1>
          <p className="text-gray-600">View all product sales transactions across branches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadProductTransactions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Transactions</p>
              <p className="text-xl font-bold">{totalTransactions}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Products Sold</p>
              <p className="text-xl font-bold">{totalProductsSold}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-xl font-bold">₱{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading transactions...
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No product transactions found
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {format(transaction.createdAt, 'MMM dd, yyyy')}
                      <br />
                      <span className="text-gray-500 text-xs">{format(transaction.createdAt, 'HH:mm')}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {transaction.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        {transaction.branchName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {transaction.productItems.slice(0, 2).map(p => p.name).join(', ')}
                      {transaction.productItems.length > 2 && ` +${transaction.productItems.length - 2} more`}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{transaction.totalProductQty}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">
                      ₱{transaction.totalProductValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
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
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, productTransactions.length)} of {productTransactions.length}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-3 py-1 text-sm">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transaction Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Transaction Details"
      >
        {selectedTransaction && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Transaction ID</p>
                <p className="font-mono text-sm">{selectedTransaction.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="text-sm">{format(selectedTransaction.createdAt, 'PPpp')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Branch</p>
                <p className="text-sm">{selectedTransaction.branchName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sales Type</p>
                <p className="text-sm capitalize">{selectedTransaction.salesType}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Products Sold</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedTransaction.productItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-sm">{item.name}</td>
                        <td className="px-3 py-2 text-sm">{item.quantity}</td>
                        <td className="px-3 py-2 text-sm">₱{(item.price || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-sm font-medium">
                          ₱{((item.price || 0) * (item.quantity || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="3" className="px-3 py-2 text-sm font-medium text-right">Total:</td>
                      <td className="px-3 py-2 text-sm font-bold text-green-600">
                        ₱{selectedTransaction.totalProductValue.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProductSales;
