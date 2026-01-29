/**
 * Commissions Page - Branch Manager
 * View and track stylist commissions from product sales
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Banknote, Calendar, User, Search, Download, Filter, Receipt, Printer, X, Upload, ArrowUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PDFPreviewModal from '../../components/ui/PDFPreviewModal';
import { formatDate, formatCurrency, formatNumberWithCommas } from '../../utils/helpers';
import toast from 'react-hot-toast';

const Commissions = () => {
  const { userBranch, userData, currentUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedStylists, setSelectedStylists] = useState([]); // Array for multiple selection
  const [selectedItems, setSelectedItems] = useState([]); // Global filter for services or products
  const [itemFilterType, setItemFilterType] = useState('all'); // 'all', 'services', 'products'
  const [minCommission, setMinCommission] = useState('');
  const [maxCommission, setMaxCommission] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allServices, setAllServices] = useState([]); // All branch services
  const [allProducts, setAllProducts] = useState([]); // All branch products
  const printRef = useRef(null);

  useEffect(() => {
    if (userBranch) {
      fetchTransactions();
      fetchServicesAndProducts();
    }
  }, [userBranch]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch all paid transactions for this branch
      // Note: The collection is 'transactions', not 'bills' (see billingService.js)
      const billsRef = collection(db, 'transactions');
      
      let billsSnapshot;
      try {
        // Try query with status filter and orderBy
        const billsQuery = query(
          billsRef,
          where('branchId', '==', userBranch),
          where('status', '==', 'paid'),
          orderBy('createdAt', 'desc')
        );
        billsSnapshot = await getDocs(billsQuery);
      } catch (queryError) {
        console.warn('Query error (might need index), trying alternative:', queryError);
        // Fallback: Query all transactions for branch and filter in memory
        try {
          const billsQuery = query(
            billsRef,
            where('branchId', '==', userBranch),
            orderBy('createdAt', 'desc')
          );
          billsSnapshot = await getDocs(billsQuery);
          // Filter for paid status in memory
          const paidDocs = [];
          billsSnapshot.forEach((doc) => {
            if (doc.data().status === 'paid') {
              paidDocs.push(doc);
            }
          });
          // Create a mock snapshot-like object
          billsSnapshot = {
            size: paidDocs.length,
            forEach: (callback) => paidDocs.forEach(callback),
            docs: paidDocs
          };
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          // Last resort: query without orderBy
          const billsQuery = query(
            billsRef,
            where('branchId', '==', userBranch)
          );
          billsSnapshot = await getDocs(billsQuery);
          // Filter for paid status in memory
          const paidDocs = [];
          billsSnapshot.forEach((doc) => {
            if (doc.data().status === 'paid') {
              paidDocs.push(doc);
            }
          });
          billsSnapshot = {
            size: paidDocs.length,
            forEach: (callback) => paidDocs.forEach(callback),
            docs: paidDocs
          };
        }
      }
      const transactionsData = [];
      
      billsSnapshot.forEach((doc) => {
        const billData = doc.data();
        const items = billData.items || [];
        
        // Extract product items with commissions
        items.forEach((item, itemIndex) => {
          
          if (item.type === 'product') {
            // Commission data is stored at the ITEM level, not in batches
            // Check if item has commission data
            const hasCommissionData = item.commissionerId && item.commissionPoints != null && item.commissionPoints > 0;
            
            if (hasCommissionData) {
              // Commission data is stored at item level
              // If item has batches, distribute commission proportionally across batches
              // Otherwise, create a single commission record
              const batches = item.batches || [];
              const totalItemQuantity = item.quantity || 1;
              const totalCommissionPoints = item.commissionPoints || 0;
              
              if (batches.length > 0) {
                // Calculate total quantity across all batches
                const totalBatchQuantity = batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
                const quantityToUse = totalBatchQuantity > 0 ? totalBatchQuantity : totalItemQuantity;
                
                // Create commission record for each batch
                batches.forEach((batch, batchIndex) => {
                  const batchQuantity = batch.quantity || 0;
                  
                  // Distribute commission proportionally based on batch quantity
                  const batchCommissionPoints = quantityToUse > 0 
                    ? (totalCommissionPoints * batchQuantity) / quantityToUse
                    : totalCommissionPoints / batches.length;
                  
                  const transaction = {
                    id: `${doc.id}-${item.id}-${batchIndex}`,
                    billId: doc.id,
                    transactionDate: billData.createdAt,
                    itemType: 'product',
                    productName: item.name || 'Unknown Product',
                    productId: item.id,
                    serviceName: billData.serviceName || 'N/A',
                    serviceId: billData.serviceId || '',
                    batchId: batch.batchId || '',
                    batchNumber: batch.batchNumber || '',
                    quantity: batchQuantity,
                    unitCost: batch.unitCost || item.unitCost || 0,
                    commissionPercentage: item.commissionPercentage || 0,
                    commissionerId: item.commissionerId,
                    commissionerName: item.commissionerName || 'Unknown',
                    commissionPoints: Math.round(batchCommissionPoints * 100) / 100, // Round to 2 decimals
                    clientName: billData.clientName || 'Walk-in',
                    receiptNumber: billData.receiptNumber || 'N/A',
                    totalAmount: (batch.unitCost || item.unitCost || 0) * batchQuantity
                  };
                  
                  transactionsData.push(transaction);
                });
              } else {
                // No batches, use item-level data directly
                const transaction = {
                  id: `${doc.id}-${item.id}`,
                  billId: doc.id,
                  transactionDate: billData.createdAt,
                  itemType: 'product',
                  productName: item.name || 'Unknown Product',
                  productId: item.id,
                  serviceName: billData.serviceName || 'N/A',
                  serviceId: billData.serviceId || '',
                  batchId: '',
                  batchNumber: '',
                  quantity: totalItemQuantity,
                  unitCost: item.unitCost || 0,
                  commissionPercentage: item.commissionPercentage || 0,
                  commissionerId: item.commissionerId,
                  commissionerName: item.commissionerName || 'Unknown',
                  commissionPoints: totalCommissionPoints,
                  clientName: billData.clientName || 'Walk-in',
                  receiptNumber: billData.receiptNumber || 'N/A',
                  totalAmount: item.price || 0
                };
                
                transactionsData.push(transaction);
              }
            }
          } else if (item.type === 'service') {
            // Service commissions
            const hasCommissionData = item.commissionerId && item.commissionPoints != null && item.commissionPoints > 0;
            
            if (hasCommissionData) {
              const transaction = {
                id: `${doc.id}-service-${item.id || itemIndex}`,
                billId: doc.id,
                transactionDate: billData.createdAt,
                itemType: 'service',
                productName: 'N/A',
                productId: '',
                serviceName: item.name || 'Unknown Service',
                serviceId: item.id || '',
                batchId: '',
                batchNumber: '',
                quantity: item.quantity || 1,
                unitCost: item.price || 0,
                commissionPercentage: item.commissionPercentage || 0,
                commissionerId: item.commissionerId,
                commissionerName: item.commissionerName || 'Unknown',
                commissionPoints: item.commissionPoints || 0,
                clientName: billData.clientName || 'Walk-in',
                receiptNumber: billData.receiptNumber || 'N/A',
                totalAmount: (item.price || 0) * (item.quantity || 1)
              };
              
              transactionsData.push(transaction);
            }
          }
        });
      });
      
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load commission data');
    } finally {
      setLoading(false);
    }
  };

  const fetchServicesAndProducts = async () => {
    try {
      // Fetch all active services for this branch
      const servicesRef = collection(db, 'services');
      const servicesQuery = query(
        servicesRef,
        where('isActive', '==', true)
      );
      const servicesSnapshot = await getDocs(servicesQuery);
      console.log('[Commissions] Total services in DB:', servicesSnapshot.size);
      
      const services = servicesSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          const hasPrice = data.branchPricing && data.branchPricing[userBranch] !== undefined;
          if (!hasPrice) {
            console.log('[Commissions] Service without price:', data.name);
          }
          return hasPrice;
        })
        .map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().serviceName || 'Unknown Service'
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('[Commissions] Services with branch pricing:', services.length, services);
      setAllServices(services);

      // Fetch all products that belong to this branch
      const productsRef = collection(db, 'products');
      const productsQuery = query(
        productsRef,
        where('branches', 'array-contains', userBranch)
      );
      const productsSnapshot = await getDocs(productsQuery);
      console.log('[Commissions] Total products for branch:', productsSnapshot.size);
      
      const products = productsSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.status === 'Active' || !data.status; // Include active or products without status
        })
        .map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Unknown Product'
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('[Commissions] Active products for branch:', products.length, products);
      setAllProducts(products);
    } catch (error) {
      console.error('Error fetching services and products:', error);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchTerm !== '' ||
           selectedStylists.length > 0 ||
           selectedItems.length > 0 ||
           minCommission !== '' ||
           maxCommission !== '' ||
           startDate !== '' ||
           endDate !== '';
  }, [searchTerm, selectedStylists, selectedItems, minCommission, maxCommission, startDate, endDate]);

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm !== '') count++;
    if (selectedStylists.length > 0) count++;
    if (selectedItems.length > 0) count++;
    if (minCommission !== '') count++;
    if (maxCommission !== '') count++;
    if (startDate !== '') count++;
    if (endDate !== '') count++;
    return count;
  }, [searchTerm, selectedStylists, selectedItems, minCommission, maxCommission, startDate, endDate]);

  // Get unique services for filter dropdown (from branch services)
  const uniqueServices = useMemo(() => {
    return allServices.map(s => s.name);
  }, [allServices]);

  // Get unique products for filter dropdown (from branch products)
  const uniqueProducts = useMemo(() => {
    return allProducts.map(p => p.name);
  }, [allProducts]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.productName.toLowerCase().includes(searchLower) ||
        t.serviceName.toLowerCase().includes(searchLower) ||
        t.commissionerName.toLowerCase().includes(searchLower) ||
        t.clientName.toLowerCase().includes(searchLower) ||
        t.receiptNumber.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by selected stylists (multiple selection)
    if (selectedStylists.length > 0) {
      filtered = filtered.filter(t => selectedStylists.includes(t.commissionerName));
    }
    
    // Filter by selected items (services or products based on itemFilterType)
    if (selectedItems.length > 0) {
      if (itemFilterType === 'services') {
        filtered = filtered.filter(t => selectedItems.includes(t.serviceName));
      } else if (itemFilterType === 'products') {
        filtered = filtered.filter(t => selectedItems.includes(t.productName));
      }
    }
    
    // Filter by commission amount range
    if (minCommission !== '') {
      const min = parseFloat(minCommission);
      filtered = filtered.filter(t => t.commissionPoints >= min);
    }
    if (maxCommission !== '') {
      const max = parseFloat(maxCommission);
      filtered = filtered.filter(t => t.commissionPoints <= max);
    }
    
    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(t => {
        const transactionDate = t.transactionDate?.toDate ? t.transactionDate.toDate() : new Date(t.transactionDate);
        return transactionDate >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      filtered = filtered.filter(t => {
        const transactionDate = t.transactionDate?.toDate ? t.transactionDate.toDate() : new Date(t.transactionDate);
        return transactionDate <= end;
      });
    }
    
    return filtered.sort((a, b) => {
      const dateA = a.transactionDate?.toDate ? a.transactionDate.toDate() : new Date(a.transactionDate);
      const dateB = b.transactionDate?.toDate ? b.transactionDate.toDate() : new Date(b.transactionDate);
      return dateB - dateA;
    });
  }, [transactions, searchTerm, selectedStylists, selectedItems, itemFilterType, minCommission, maxCommission, startDate, endDate]);

  // Get unique stylists for filter dropdown
  const uniqueStylists = useMemo(() => {
    const stylists = new Set();
    transactions.forEach(t => {
      if (t.commissionerName) {
        stylists.add(t.commissionerName);
      }
    });
    return Array.from(stylists).sort();
  }, [transactions]);

  // Calculate commission summary by stylist
  const commissionSummary = useMemo(() => {
    const summary = {};
    
    filteredTransactions.forEach((transaction) => {
      const stylistId = transaction.commissionerId;
      if (!summary[stylistId]) {
        summary[stylistId] = {
          stylistId,
          stylistName: transaction.commissionerName,
          totalCommission: 0,
          transactionCount: 0,
          totalSales: 0
        };
      }
      
      summary[stylistId].totalCommission += transaction.commissionPoints;
      summary[stylistId].transactionCount += 1;
      summary[stylistId].totalSales += transaction.totalAmount;
    });
    
    return Object.values(summary).sort((a, b) => b.totalCommission - a.totalCommission);
  }, [filteredTransactions]);


  const handleExportCSV = () => {
    if (!filteredTransactions.length && commissionSummary.length === 0) {
      toast.error('No commission data to export');
      return;
    }

    let csvContent = '';

    // Commission Summary Section
    if (commissionSummary.length > 0) {
      csvContent += 'Commission Summary\n';
      const summaryHeaders = ['Stylist', 'Transactions', 'Total Sales (₱)', 'Total Commission (₱)'];
      const summaryRows = commissionSummary.map(summary => {
        return [
          summary.stylistName,
          summary.transactionCount,
          formatNumberWithCommas(summary.totalSales),
          formatNumberWithCommas(summary.totalCommission)
        ];
      });

      csvContent += [summaryHeaders, ...summaryRows].map(row => row.join(',')).join('\n') + '\n\n';
    }

    // Commission Transaction Section
    if (filteredTransactions.length > 0) {
      csvContent += 'Commission Transaction\n';
      const transactionHeaders = ['Date', 'Stylist', 'Type', 'Service/Product', 'Quantity', 'Unit Cost (₱)', 'Commission %', 'Commission Amount (₱)', 'Total Sale (₱)', 'Client', 'Receipt #'];
      const transactionRows = filteredTransactions.map(t => {
      const date = t.transactionDate?.toDate ? formatDate(t.transactionDate.toDate(), 'MMM dd, yyyy HH:mm') : 'N/A';
      const itemName = t.itemType === 'service' ? t.serviceName : t.productName;
      return [
        date,
        t.commissionerName,
        t.itemType === 'service' ? 'Service' : 'Product',
        itemName,
        t.quantity,
        formatNumberWithCommas(t.unitCost),
        `${t.commissionPercentage}%`,
        formatNumberWithCommas(t.commissionPoints),
        formatNumberWithCommas(t.totalAmount),
        t.clientName,
        t.receiptNumber
      ];
    });
    
      csvContent += [transactionHeaders, ...transactionRows].map(row => row.join(',')).join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commissions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Commissions exported to CSV');
  };


  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }
    
    // Wait for images to load before opening preview
    const images = printRef.current.querySelectorAll('img');
    if (images.length > 0) {
      Promise.all(
        Array.from(images).map((img) => {
          if (img.complete && img.naturalHeight !== 0) {
            return Promise.resolve();
          }
          return new Promise((resolve) => {
            if (img.src && !img.crossOrigin) {
              img.crossOrigin = 'anonymous';
            }
            const onLoad = () => {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              resolve();
            };
            const onError = () => {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              resolve(); // Continue even if image fails
            };
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
            setTimeout(() => {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              resolve();
            }, 3000);
          });
        })
      ).then(() => {
        // Additional wait to ensure rendering
        setTimeout(() => {
          setShowPDFPreview(true);
        }, 300);
      });
    } else {
      setShowPDFPreview(true);
    }
  };

  const handleImportCSV = () => {
    // TODO: Implement CSV import functionality
    toast.info('CSV import functionality will be implemented');
  };

  const totalCommission = filteredTransactions.reduce((sum, t) => sum + t.commissionPoints, 0);
  const totalSales = filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="h-6 w-6 text-purple-600" />
            Commissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track stylist commissions from services and product sales</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Commissions</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {formatCurrency(totalCommission)}
              </p>
            </div>
            <Banknote className="h-10 w-10 text-purple-200" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(totalSales)}
              </p>
            </div>
            <ArrowUp className="h-10 w-10 text-green-200" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {filteredTransactions.length}
              </p>
            </div>
            <Receipt className="h-10 w-10 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Commission Summary */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Commission Summary</h2>
          <p className="text-sm text-gray-500 mt-1">Breakdown of commissions earned by each stylist</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Commission</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {commissionSummary.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No commission data available</p>
                    <p className="text-sm text-gray-400 mt-1">Filtered results show no commissions</p>
                  </td>
                </tr>
              ) : (
                commissionSummary.map((summary) => {
                  return (
                    <tr key={summary.stylistId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-gray-400 mr-3" />
                          <div className="text-sm font-medium text-gray-900">
                            {summary.stylistName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {summary.transactionCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(summary.totalSales)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-purple-600">
                        {formatCurrency(summary.totalCommission)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Product, stylist, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilterModal(true)}
              className={`flex items-center justify-center w-10 h-10 border rounded-lg transition-colors relative ${
                hasActiveFilters
                  ? 'bg-purple-600 border-purple-600 text-white hover:bg-purple-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              title={`Filter - ${activeFilterCount} active filter${activeFilterCount !== 1 ? 's' : ''}`}
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleImportCSV}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="Import CSV"
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="Report"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Commission Transaction */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Commission Transaction</h2>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service/Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission %</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sale</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt #</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center">
                    <Banknote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No commission transactions found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => {
                  const date = transaction.transactionDate?.toDate 
                    ? formatDate(transaction.transactionDate.toDate(), 'MMM dd, yyyy HH:mm')
                    : formatDate(transaction.transactionDate, 'MMM dd, yyyy HH:mm');
                  
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900 font-medium">
                            {transaction.commissionerName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.itemType === 'service' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {transaction.itemType === 'service' ? 'Service' : 'Product'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.itemType === 'service' ? transaction.serviceName : transaction.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{transaction.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">₱{formatNumberWithCommas(transaction.unitCost)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{transaction.commissionPercentage}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-purple-600">
                        ₱{formatNumberWithCommas(transaction.commissionPoints)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">₱{formatNumberWithCommas(transaction.totalAmount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.clientName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.receiptNumber}</td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
        </div>
      </div>

      {/* Print View - Rendered off-screen for PDF generation */}
      <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <style>{`
          @media print {
            @page {
              margin: 0.4in 0.5in;
              size: letter;
            }
            * {
              color: #000 !important;
              background: transparent !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .print-break {
              page-break-after: always;
            }
            .print-avoid-break {
              page-break-inside: avoid;
            }
            table {
              font-size: 10px;
              border-collapse: collapse;
              line-height: 1.4;
            }
            th, td {
              padding: 6px 4px !important;
              border: 1px solid #333 !important;
              background: transparent !important;
              text-align: center !important;
              vertical-align: middle !important;
            }
            thead th {
              border-bottom: 2px solid #000 !important;
              font-weight: 700;
            }
            tbody tr {
              border-bottom: 1px solid #333 !important;
            }
          }
        `}</style>
        <div className="p-4" style={{ fontSize: '10px', padding: '0', lineHeight: '1.4' }}>
          <div className="text-center mb-4 border-b border-black pb-3" style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #000' }}>
            <h1 className="font-bold" style={{ fontSize: '24px', marginBottom: '6px', margin: '0 0 6px 0', fontWeight: '700' }}>DAVID'S SALON</h1>
            <h2 className="font-bold" style={{ fontSize: '18px', marginBottom: '6px', margin: '0 0 6px 0', fontWeight: '700' }}>Commissions Report</h2>
            <p style={{ fontSize: '11px', margin: '0' }}><strong>Generated:</strong> {formatDate(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
          
          {/* Applied Filters Section */}
          <div style={{ 
            marginBottom: '12px', 
            padding: '8px', 
            border: '2px solid #333', 
            background: '#f8f9fa',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '9px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>FILTERS APPLIED</div>
            <div style={{ fontSize: '8px', fontWeight: '600' }}>
              {(() => {
                const filters = [];
                
                // Date Range - always show first
                if (startDate && endDate) {
                  filters.push(`Date Range: ${startDate} to ${endDate}`);
                } else if (startDate) {
                  filters.push(`Date Range: From ${startDate}`);
                } else if (endDate) {
                  filters.push(`Date Range: Until ${endDate}`);
                } else {
                  // Calculate from transactions
                  if (filteredTransactions.length > 0) {
                    const dates = filteredTransactions.map(t => {
                      if (t.appointmentDate) {
                        return t.appointmentDate.toDate ? t.appointmentDate.toDate() : new Date(t.appointmentDate);
                      }
                      if (t.createdAt) {
                        return t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
                      }
                      return new Date();
                    }).filter(date => !isNaN(date.getTime())).sort((a, b) => a - b);
                    
                    if (dates.length > 0) {
                      const minDate = dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const maxDate = dates[dates.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      filters.push(`Date Range: ${minDate} to ${maxDate}`);
                    } else {
                      filters.push('Date Range: All Dates');
                    }
                  } else {
                    filters.push('Date Range: All Dates');
                  }
                }
                
                if (searchTerm) {
                  filters.push(`Search: "${searchTerm}"`);
                }
                if (selectedStylists.length > 0) {
                  const stylistNames = selectedStylists.map(id => {
                    const stylist = uniqueStylists.find(s => s.id === id);
                    return stylist ? stylist.name : id;
                  }).join(', ');
                  filters.push(`Stylists: ${stylistNames}`);
                }
                if (itemFilterType !== 'all') {
                  filters.push(`Type: ${itemFilterType === 'services' ? 'Services Only' : 'Products Only'}`);
                }
                if (selectedItems.length > 0) {
                  filters.push(`Items: ${selectedItems.length} selected`);
                }
                if (minCommission || maxCommission) {
                  filters.push(`Commission: ${minCommission ? formatCurrency(parseFloat(minCommission)) : 'Any'} - ${maxCommission ? formatCurrency(parseFloat(maxCommission)) : 'Any'}`);
                }
                
                return filters.join(' | ');
              })()}
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3 print-avoid-break" style={{ fontSize: '10px', marginBottom: '12px', gap: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="border border-black p-2 text-center" style={{ border: '1px solid #333', padding: '10px 8px', textAlign: 'center', background: '#fff' }}>
              <div className="font-bold" style={{ fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>₱{formatNumberWithCommas(totalCommission)}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Total Commissions</div>
            </div>
            <div className="border border-black p-2 text-center" style={{ border: '1px solid #333', padding: '10px 8px', textAlign: 'center', background: '#fff' }}>
              <div className="font-bold" style={{ fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>₱{formatNumberWithCommas(totalSales)}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Total Sales</div>
            </div>
            <div className="border border-black p-2 text-center" style={{ border: '1px solid #333', padding: '10px 8px', textAlign: 'center', background: '#fff' }}>
              <div className="font-bold" style={{ fontSize: '18px', marginBottom: '4px', fontWeight: '700' }}>{filteredTransactions.length}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Transactions</div>
            </div>
          </div>

          {/* Commission Summary */}
          {commissionSummary.length > 0 && (
            <div className="mb-4 print-avoid-break" style={{ marginBottom: '12px' }}>
              <h2 className="font-bold mb-2" style={{ fontSize: '13px', marginBottom: '6px', fontWeight: '700' }}>Commission Summary</h2>
              <table className="w-full" style={{ fontSize: '10px', borderCollapse: 'collapse', width: '100%', lineHeight: '1.4', border: '1px solid #333' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', background: '#fff' }}>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>STYLIST</th>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>TRANSACTIONS</th>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>TOTAL SALES</th>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>TOTAL COMMISSION</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionSummary.map((summary) => (
                    <tr key={summary.stylistId} style={{ pageBreakInside: 'avoid', borderBottom: '1px solid #333', background: '#fff' }}>
                      <td className="border border-black font-medium" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{summary.stylistName}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{summary.transactionCount}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>₱{formatNumberWithCommas(summary.totalSales)}</td>
                      <td className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>₱{formatNumberWithCommas(summary.totalCommission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transactions Table */}
          <div className="print-avoid-break" style={{ pageBreakInside: 'avoid' }}>
            <h2 className="font-bold mb-2" style={{ fontSize: '13px', marginBottom: '6px', fontWeight: '700' }}>Commission Transaction</h2>
            <table className="w-full" style={{ fontSize: '10px', borderCollapse: 'collapse', width: '100%', lineHeight: '1.4', border: '1px solid #333' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', background: '#fff' }}>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>DATE</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>STYLIST</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>TYPE</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>SERVICE/PRODUCT</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>QTY</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>UNIT COST</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>COMM %</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>COMMISSION</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>TOTAL SALE</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>CLIENT</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '8px 6px', fontSize: '11px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '700' }}>RECEIPT #</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => {
                  const date = transaction.transactionDate?.toDate 
                    ? formatDate(transaction.transactionDate.toDate(), 'MMM dd, yyyy HH:mm')
                    : formatDate(transaction.transactionDate, 'MMM dd, yyyy HH:mm');
                  const itemName = transaction.itemType === 'service' ? transaction.serviceName : transaction.productName;
                  
                  return (
                    <tr key={transaction.id} style={{ pageBreakInside: 'avoid', borderBottom: '1px solid #333', background: '#fff' }}>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{date}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.commissionerName}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.itemType === 'service' ? 'Service' : 'Product'}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{itemName}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.quantity}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>₱{formatNumberWithCommas(transaction.unitCost)}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.commissionPercentage}%</td>
                      <td className="border border-black font-semibold" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>₱{formatNumberWithCommas(transaction.commissionPoints)}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>₱{formatNumberWithCommas(transaction.totalAmount)}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.clientName}</td>
                      <td className="border border-black" style={{ border: '1px solid #333', padding: '6px', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.receiptNumber}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Footer - Report Info */}
          <div className="mt-6 pt-4 border-t-2 border-black" style={{ fontSize: '10px', marginTop: '20px', paddingTop: '12px', borderTop: '2px solid #333' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <div>
                <strong>Generated By:</strong> {userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : userData?.email || 'Branch Manager'}<br/>
                <strong>Position:</strong> Branch Manager
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Generated On:</strong> {formatDate(new Date(), 'MMMM dd, yyyy')}<br/>
                <strong>Time:</strong> {formatDate(new Date(), 'hh:mm a')}
              </div>
            </div>
            <div style={{ textAlign: 'center', color: '#666', marginTop: '8px' }}>
              <p>Page 1 of 1 | Commission Report</p>
              <p style={{ marginTop: '4px' }}>Total Commissions: ₱{formatNumberWithCommas(totalCommission)} | Total Sales: ₱{formatNumberWithCommas(totalSales)} | Transactions: {filteredTransactions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={showPDFPreview}
        onClose={() => setShowPDFPreview(false)}
        contentRef={printRef}
        title="Commissions Report - PDF Preview"
        fileName={`Commissions_Report_${new Date().toISOString().split('T')[0]}`}
      />

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Filter Commissions</h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Stylist Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stylists</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="select-all-stylists"
                        checked={selectedStylists.length === uniqueStylists.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStylists([...uniqueStylists]);
                          } else {
                            setSelectedStylists([]);
                          }
                        }}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <label htmlFor="select-all-stylists" className="ml-2 text-sm text-gray-700 font-medium">
                        Select All Stylists
                      </label>
                    </div>
                    <hr className="border-gray-200" />
                    {uniqueStylists.map((stylist) => (
                      <div key={stylist} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`stylist-${stylist}`}
                          checked={selectedStylists.includes(stylist)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStylists([...selectedStylists, stylist]);
                            } else {
                              setSelectedStylists(selectedStylists.filter(s => s !== stylist));
                            }
                          }}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`stylist-${stylist}`} className="ml-2 text-sm text-gray-700">
                          {stylist}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedStylists.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedStylists.length} stylist{selectedStylists.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                {/* Global Items Filter (Services or Products) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter Items By</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => {
                        setItemFilterType('all');
                        setSelectedItems([]);
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        itemFilterType === 'all'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All Items
                    </button>
                    <button
                      onClick={() => {
                        setItemFilterType('services');
                        setSelectedItems([]);
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        itemFilterType === 'services'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Services
                    </button>
                    <button
                      onClick={() => {
                        setItemFilterType('products');
                        setSelectedItems([]);
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        itemFilterType === 'products'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Products
                    </button>
                  </div>

                  {/* Items Selection */}
                  {itemFilterType !== 'all' && (
                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="select-all-items"
                          checked={selectedItems.length === (itemFilterType === 'services' ? uniqueServices.length : uniqueProducts.length)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(itemFilterType === 'services' ? [...uniqueServices] : [...uniqueProducts]);
                            } else {
                              setSelectedItems([]);
                            }
                          }}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <label htmlFor="select-all-items" className="ml-2 text-sm text-gray-700 font-medium">
                          Select All {itemFilterType === 'services' ? 'Services' : 'Products'}
                        </label>
                      </div>
                      <hr className="border-gray-200" />
                      {(itemFilterType === 'services' ? uniqueServices : uniqueProducts).length > 0 ? (
                        (itemFilterType === 'services' ? uniqueServices : uniqueProducts).map((item) => (
                          <div key={item} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`item-${item}`}
                              checked={selectedItems.includes(item)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems([...selectedItems, item]);
                                } else {
                                  setSelectedItems(selectedItems.filter(i => i !== item));
                                }
                              }}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`item-${item}`} className="ml-2 text-sm text-gray-700">
                              {item}
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No {itemFilterType === 'services' ? 'services' : 'products'} available</p>
                      )}
                    </div>
                  )}
                  {selectedItems.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                {/* Commission Amount Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Commission (₱)
                    </label>
                    <input
                      type="number"
                      value={minCommission}
                      onChange={(e) => setMinCommission(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Commission (₱)
                    </label>
                    <input
                      type="number"
                      value={maxCommission}
                      onChange={(e) => setMaxCommission(e.target.value)}
                      placeholder="9999.99"
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedStylists([]);
                    setSelectedItems([]);
                    setItemFilterType('all');
                    setMinCommission('');
                    setMaxCommission('');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Commissions;

