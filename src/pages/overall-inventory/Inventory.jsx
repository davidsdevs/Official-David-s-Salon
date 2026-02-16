// src/pages/overall-inventory/Inventory.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import { getAllBranches } from '../../services/branchService';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { db } from '../../config/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, writeBatch, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { verifyManagerCode } from '../../services/authService';
import {
  Package,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Building,
  Banknote,
  ArrowLeft,
  ChevronRight,
  History,
  Printer,
  Download,
  ChevronLeft,
  Filter,
  ShoppingCart,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';

const OverallInventoryControllerInventory = () => {
  const { userData } = useAuth();

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null); // null = showing branch cards, branchId = showing that branch's inventory
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [branchStats, setBranchStats] = useState({}); // Store stats for each branch

  // Force Adjust states
  const [isForceAdjustModalOpen, setIsForceAdjustModalOpen] = useState(false);
  const [forceAdjustStep, setForceAdjustStep] = useState('selectType'); // 'selectType', 'selectBatch', 'adjustStock', 'confirm'
  const [selectedUsageType, setSelectedUsageType] = useState(null); // 'otc' or 'salon-use'
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState(null);
  const [productBatches, setProductBatches] = useState([]); // Batches for selected product
  const [selectedBatchForAdjust, setSelectedBatchForAdjust] = useState(null);
  const [forceAdjustForm, setForceAdjustForm] = useState({
    stockId: '',
    productId: '',
    currentStock: '',
    adjustmentQuantity: '', // Primary input: positive to add, negative to deduct
    reason: '',
    customReason: '', // For "Other" reason option
    managerCode: '',
    notes: '',
    batchNumber: ''
  });
  const [forceAdjustErrors, setForceAdjustErrors] = useState({});
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [verifiedManager, setVerifiedManager] = useState(null); // Store verified manager info for confirmation

  // Force Adjust Logs states
  const [showAdjustLogs, setShowAdjustLogs] = useState(false);
  const [adjustLogs, setAdjustLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsDateFilter, setLogsDateFilter] = useState('7'); // days: '7', '30', '90', 'all'
  const [logsBranchFilter, setLogsBranchFilter] = useState('all');
  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isLogDetailsModalOpen, setIsLogDetailsModalOpen] = useState(false);
  const LOGS_PER_PAGE = 15;

  // Product Transactions states
  const [showProductTransactions, setShowProductTransactions] = useState(false);
  const [productTransactions, setProductTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [transactionsDateFilter, setTransactionsDateFilter] = useState('7');
  const [transactionsBranchFilter, setTransactionsBranchFilter] = useState('all');
  const [transactionsCurrentPage, setTransactionsCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isTransactionDetailsModalOpen, setIsTransactionDetailsModalOpen] = useState(false);
  const TRANSACTIONS_PER_PAGE = 15;

  // Active tab state: 'branches', 'transactions', 'adjustLogs'
  const [activeTab, setActiveTab] = useState('branches');

  // Helper function to get computed stock (same as Inventory Controller)
  const getComputedStock = (stock) => {
    return stock.remainingQuantity || stock.realTimeStock || stock.beginningStock || stock.currentStock || 0;
  };

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

  // Load branch statistics for all branches
  const loadBranchStats = async () => {
    try {
      setLoading(true);
      const activeBranches = branches.filter(b => b.isActive !== false);
      const stats = {};

      // Load all products first to get unitCost
      let allProducts = [];
      try {
        const productsResult = await productService.getAllProducts();
        if (productsResult.success) {
          allProducts = productsResult.products;
        }
      } catch (err) {
        console.warn('Error loading products for stats:', err);
      }

      // Helper to calculate stock status (same as Inventory Controller)
      const calculateStockStatus = (stock) => {
        const currentStock = getComputedStock(stock);
        const LOW_STOCK_THRESHOLD = 5;
        const HIGH_STOCK_THRESHOLD = 10;
        
        if (currentStock === 0) return 'Out of Stock';
        if (currentStock < LOW_STOCK_THRESHOLD) return 'Low Stock';
        if (currentStock >= HIGH_STOCK_THRESHOLD) return 'High Stock';
        return 'In Stock';
      };

      // Helper to filter stocks same as Inventory Controller's getCurrentStocksByProduct
      const filterCurrentMonthStocks = (stocks) => {
        const currentDate = new Date();
        const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        const stockList = [];
        const processedRegularStocks = new Set();
        
        stocks.forEach(stock => {
          const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
          
          if (isBatchStock) {
            // For batch stocks, show if has stock, or is current month, or was created recently
            const stockStart = stock.startPeriod ? new Date(stock.startPeriod) : null;
            const isCurrentMonth = stockStart && 
              stockStart.getMonth() === currentMonthStart.getMonth() &&
              stockStart.getFullYear() === currentMonthStart.getFullYear();
            
            const realTimeStock = stock.realTimeStock || 0;
            if (realTimeStock > 0 || isCurrentMonth || (stockStart && stockStart >= currentMonthStart)) {
              stockList.push(stock);
            }
          } else {
            // For regular stocks (non-batch), show current month only (one per product)
            if (!stock.startPeriod) return;
            const stockStart = new Date(stock.startPeriod);
            const isCurrentMonth = 
              stockStart.getMonth() === currentMonthStart.getMonth() &&
              stockStart.getFullYear() === currentMonthStart.getFullYear();
            
            if (isCurrentMonth && !processedRegularStocks.has(stock.productId)) {
              processedRegularStocks.add(stock.productId);
              stockList.push(stock);
            }
          }
        });
        
        return stockList;
      };

      for (const branch of activeBranches) {
        try {
          const stocksResult = await inventoryService.getBranchStocks(branch.id);
          if (stocksResult.success) {
            // Filter stocks same as Inventory Controller
            const currentMonthStocks = filterCurrentMonthStocks(stocksResult.stocks);
            
            // Total Items = count of filtered stocks (same as Inventory Controller)
            const totalItems = currentMonthStocks.length;
            
            // Calculate total value (same as Inventory Controller's stockStats)
            const totalValue = currentMonthStocks.reduce((sum, stock) => {
              const currentStock = getComputedStock(stock);
              const product = allProducts.find(p => p.id === stock.productId);
              const unitCost = stock.unitCost || product?.unitCost || 0;
              return sum + (currentStock * unitCost);
            }, 0);
            
            // Count by status (same logic as Inventory Controller)
            const inStockCount = currentMonthStocks.filter(stock => {
              const status = calculateStockStatus(stock);
              return status === 'In Stock' || status === 'High Stock';
            }).length;
            
            const lowStockCount = currentMonthStocks.filter(stock => {
              const status = calculateStockStatus(stock);
              return status === 'Low Stock';
            }).length;
            
            const outOfStockCount = currentMonthStocks.filter(stock => {
              const status = calculateStockStatus(stock);
              return status === 'Out of Stock';
            }).length;

            stats[branch.id] = {
              totalProducts: totalItems,
              totalValue,
              lowStock: lowStockCount,
              outOfStock: outOfStockCount,
              inStock: inStockCount,
              totalItems
            };
          } else {
            stats[branch.id] = {
              totalProducts: 0,
              totalValue: 0,
              lowStock: 0,
              outOfStock: 0,
              inStock: 0,
              totalItems: 0
            };
          }
        } catch (err) {
          console.warn(`Error loading stats for branch ${branch.name || branch.branchName}:`, err);
          stats[branch.id] = {
            totalProducts: 0,
            totalValue: 0,
            lowStock: 0,
            outOfStock: 0,
            inStock: 0,
            totalItems: 0
          };
        }
      }

      setBranchStats(stats);
    } catch (err) {
      console.error('Error loading branch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Force Adjust Logs from all branches
  const loadAdjustLogs = async () => {
    try {
      setLoadingLogs(true);
      
      // First load all products to get names
      let productsMap = {};
      try {
        const productsResult = await productService.getAllProducts();
        if (productsResult.success) {
          productsResult.products.forEach(p => {
            productsMap[p.id] = p.name || p.productName || 'Unknown Product';
          });
        }
      } catch (err) {
        console.warn('Error loading products for logs:', err);
      }
      
      let logsQuery = query(
        collection(db, 'stockAdjustments'),
        orderBy('createdAt', 'desc')
      );

      // Apply date filter
      if (logsDateFilter !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(logsDateFilter));
        logsQuery = query(
          collection(db, 'stockAdjustments'),
          where('createdAt', '>=', daysAgo),
          orderBy('createdAt', 'desc')
        );
      }

      const logsSnapshot = await getDocs(logsQuery);
      let logs = [];
      
      logsSnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        });
      });

      // Apply branch filter client-side (since we can't combine multiple where clauses easily)
      if (logsBranchFilter !== 'all') {
        logs = logs.filter(log => log.branchId === logsBranchFilter);
      }

      // Enrich with branch names and product names
      const enrichedLogs = logs.map(log => {
        const branch = branches.find(b => b.id === log.branchId);
        // Get product name from the log itself, or from products map, or show 'Unknown'
        const productName = log.productName || productsMap[log.productId] || 'Unknown Product';
        return {
          ...log,
          branchName: branch?.name || branch?.branchName || 'Unknown Branch',
          productName: productName
        };
      });

      setAdjustLogs(enrichedLogs);
      setLogsCurrentPage(1);
    } catch (err) {
      console.error('Error loading adjust logs:', err);
      setAdjustLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Load Product Transactions from all branches (products sold or used in services)
  const loadProductTransactions = async () => {
    try {
      setLoadingTransactions(true);
      
      let transactionsQuery = query(
        collection(db, 'transactions'),
        orderBy('createdAt', 'desc')
      );

      // Apply date filter
      if (transactionsDateFilter !== 'all') {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(transactionsDateFilter));
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
        // Only include transactions that have products (salesType: 'product' or 'mixed')
        if (data.salesType === 'product' || data.salesType === 'mixed') {
          transactions.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
          });
        }
      });

      // Apply branch filter client-side
      if (transactionsBranchFilter !== 'all') {
        transactions = transactions.filter(t => t.branchId === transactionsBranchFilter);
      }

      // Enrich with branch names and extract product items
      const enrichedTransactions = transactions.map(transaction => {
        const branch = branches.find(b => b.id === transaction.branchId);
        const productItems = (transaction.items || []).filter(item => item.type === 'product');
        const totalProductQty = productItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalProductValue = productItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
        
        return {
          ...transaction,
          branchName: branch?.name || branch?.branchName || transaction.branchName || 'Unknown Branch',
          productItems,
          totalProductQty,
          totalProductValue
        };
      });

      setProductTransactions(enrichedTransactions);
      setTransactionsCurrentPage(1);
    } catch (err) {
      console.error('Error loading product transactions:', err);
      setProductTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Calculate product transaction summary
  const transactionSummary = useMemo(() => {
    const totalTransactions = productTransactions.length;
    const totalProductsSold = productTransactions.reduce((sum, t) => sum + (t.totalProductQty || 0), 0);
    const totalProductRevenue = productTransactions.reduce((sum, t) => sum + (t.totalProductValue || 0), 0);
    const productOnlyTransactions = productTransactions.filter(t => t.salesType === 'product').length;
    const mixedTransactions = productTransactions.filter(t => t.salesType === 'mixed').length;
    
    return {
      totalTransactions,
      totalProductsSold,
      totalProductRevenue,
      productOnlyTransactions,
      mixedTransactions
    };
  }, [productTransactions]);

  // Load inventory for selected branch - aggregated by product
  const loadInventory = async () => {
    if (!selectedBranch) return;

    try {
      setLoading(true);
      setError(null);

      // Load all products first
      const productsResult = await productService.getAllProducts();
      let loadedProducts = [];
      if (productsResult.success) {
        loadedProducts = productsResult.products;
        setProducts(loadedProducts);
      }

      // Load inventory for selected branch
      const stocksResult = await inventoryService.getBranchStocks(selectedBranch);
      if (stocksResult.success) {
        const branch = branches.find(b => b.id === selectedBranch);
        
        // Aggregate stocks by productId
        const productMap = new Map();
        
        stocksResult.stocks.forEach(stock => {
          const computedStock = getComputedStock(stock);
          const product = loadedProducts.find(p => p.id === stock.productId);
          const unitCost = stock.unitCost || product?.unitCost || product?.price || 0;
          const category = stock.category || product?.category || '-';
          const brand = stock.brand || product?.brand || '-';
          const productName = stock.productName || product?.name || 'Unknown Product';
          
          if (productMap.has(stock.productId)) {
            // Add to existing product
            const existing = productMap.get(stock.productId);
            existing.totalStock += computedStock;
            existing.totalValue += computedStock * unitCost;
            existing.batches.push({
              ...stock,
              computedStock,
              unitCost
            });
          } else {
            // Create new product entry
            productMap.set(stock.productId, {
              productId: stock.productId,
              productName: productName,
              brand: brand,
              category: category,
              unitCost: unitCost,
              totalStock: computedStock,
              totalValue: computedStock * unitCost,
              branchId: selectedBranch,
              branchName: branch?.name || branch?.branchName || 'Unknown Branch',
              product: product,
              batches: [{
                ...stock,
                computedStock,
                unitCost
              }]
            });
          }
        });
        
        // Convert map to array
        const aggregatedInventory = Array.from(productMap.values());
        setInventory(aggregatedInventory);
      } else {
        setInventory([]);
      }
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      loadBranchStats();
    }
  }, [branches.length, selectedBranch]);

  useEffect(() => {
    if (selectedBranch) {
      loadInventory();
    }
  }, [selectedBranch]);

  // Load adjust logs when showing logs or filters change
  useEffect(() => {
    if (activeTab === 'adjustLogs' && branches.length > 0) {
      loadAdjustLogs();
    }
  }, [activeTab, logsDateFilter, logsBranchFilter, branches.length]);

  // Load product transactions when showing or filters change
  useEffect(() => {
    if (activeTab === 'transactions' && branches.length > 0) {
      loadProductTransactions();
    }
  }, [activeTab, transactionsDateFilter, transactionsBranchFilter, branches.length]);

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(inventory.map(item => item.category).filter(Boolean))];
  }, [inventory]);

  // Filter inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = 
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.branchName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      
      // Calculate status for filtering
      const totalStock = item.totalStock || 0;
      let status = 'In Stock';
      if (totalStock === 0) status = 'Out of Stock';
      else if (totalStock < 5) status = 'Low Stock';
      
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventory, searchTerm, categoryFilter, statusFilter]);

  // Calculate statistics for current branch view
  const stats = useMemo(() => {
    if (!selectedBranch) {
      return {
        totalProducts: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
        totalBranches: branches.filter(b => b.isActive !== false).length
      };
    }

    const totalProducts = inventory.length;
    const totalValue = inventory.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const lowStock = inventory.filter(item => {
      const totalStock = item.totalStock || 0;
      return totalStock > 0 && totalStock < 5;
    }).length;
    const outOfStock = inventory.filter(item => (item.totalStock || 0) === 0).length;

    return {
      totalProducts,
      totalValue,
      lowStock,
      outOfStock,
      totalBranches: 1
    };
  }, [inventory, selectedBranch, branches.length]);

  // Handle view details
  const handleViewDetails = (item) => {
    setSelectedProduct(item);
    setIsDetailsModalOpen(true);
  };

  // Get status color (for aggregated product)
  const getStatusColor = (item) => {
    const totalStock = item.totalStock || 0;
    
    if (totalStock === 0) return 'text-red-600 bg-red-100';
    if (totalStock < 5) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  // Get status text (for aggregated product)
  const getStatusText = (item) => {
    const totalStock = item.totalStock || 0;
    
    if (totalStock === 0) return 'Out of Stock';
    if (totalStock < 5) return 'Low Stock';
    return 'In Stock';
  };

  // Handle branch card click
  const handleBranchClick = (branchId) => {
    setSelectedBranch(branchId);
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  // Handle back to branches
  const handleBackToBranches = () => {
    setSelectedBranch(null);
    setInventory([]);
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  // Print Force Adjust Logs
  const handlePrintLogs = () => {
    const printWindow = window.open('', '', 'height=600,width=900');
    
    const dateFilterText = logsDateFilter === 'all' ? 'All Time' : `Last ${logsDateFilter} Days`;
    const branchFilterText = logsBranchFilter === 'all' ? 'All Branches' : branches.find(b => b.id === logsBranchFilter)?.name || logsBranchFilter;
    
    let htmlContent = `
      <html>
        <head>
          <title>Force Adjust Logs Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
            h1 { text-align: center; color: #333; font-size: 18px; }
            .summary { text-align: center; margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .positive { color: #16a34a; }
            .negative { color: #dc2626; }
            .date { font-size: 10px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Force Adjust Logs Report</h1>
          <div class="summary">
            <p>Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
            <p>Filter: ${dateFilterText} | Branch: ${branchFilterText} | Total Records: ${adjustLogs.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Branch</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Previous</th>
                <th>New</th>
                <th>Change</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
    `;

    adjustLogs.forEach(log => {
      const change = (log.newStock || 0) - (log.previousStock || 0);
      const changeClass = change >= 0 ? 'positive' : 'negative';
      const changeText = change >= 0 ? `+${change}` : change;
      
      htmlContent += `
        <tr>
          <td class="date">${format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}</td>
          <td>${log.branchName || 'Unknown'}</td>
          <td>${log.productName}</td>
          <td>${log.batchNumber || 'N/A'}</td>
          <td>${log.previousStock || 0}</td>
          <td>${log.newStock || 0}</td>
          <td class="${changeClass}">${changeText}</td>
          <td>${log.reason || 'N/A'}</td>
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

  // Print Product Transactions
  const handlePrintTransactions = () => {
    const printWindow = window.open('', '', 'height=600,width=900');
    
    const dateFilterText = transactionsDateFilter === 'all' ? 'All Time' : `Last ${transactionsDateFilter} Days`;
    const branchFilterText = transactionsBranchFilter === 'all' ? 'All Branches' : branches.find(b => b.id === transactionsBranchFilter)?.name || transactionsBranchFilter;
    
    let htmlContent = `
      <html>
        <head>
          <title>Product Transactions Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
            h1 { text-align: center; color: #333; font-size: 18px; }
            .summary { text-align: center; margin-bottom: 15px; color: #666; }
            .stats { display: flex; justify-content: center; gap: 30px; margin-bottom: 20px; }
            .stat-box { text-align: center; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            .stat-value { font-size: 16px; font-weight: bold; color: #333; }
            .stat-label { font-size: 10px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .product-only { color: #2563eb; }
            .mixed { color: #7c3aed; }
            .date { font-size: 10px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Product Transactions Report</h1>
          <div class="summary">
            <p>Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
            <p>Filter: ${dateFilterText} | Branch: ${branchFilterText}</p>
          </div>
          <div class="stats">
            <div class="stat-box">
              <div class="stat-value">${transactionSummary.totalTransactions}</div>
              <div class="stat-label">Total Transactions</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${transactionSummary.totalProductsSold}</div>
              <div class="stat-label">Products Sold</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">₱${transactionSummary.totalProductRevenue.toLocaleString()}</div>
              <div class="stat-label">Product Revenue</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${transactionSummary.productOnlyTransactions}</div>
              <div class="stat-label">Product Only</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${transactionSummary.mixedTransactions}</div>
              <div class="stat-label">With Services</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Branch</th>
                <th>Client</th>
                <th>Type</th>
                <th>Products</th>
                <th>Qty</th>
                <th>Product Value</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
    `;

    productTransactions.forEach(t => {
      const typeClass = t.salesType === 'product' ? 'product-only' : 'mixed';
      const typeText = t.salesType === 'product' ? 'Product Only' : 'With Service';
      const productNames = t.productItems.map(p => p.name).join(', ');
      
      htmlContent += `
        <tr>
          <td class="date">${format(new Date(t.createdAt), 'MMM dd, yyyy HH:mm')}</td>
          <td>${t.id}</td>
          <td>${t.branchName}</td>
          <td>${t.clientName || 'Walk-in'}</td>
          <td class="${typeClass}">${typeText}</td>
          <td>${productNames || 'N/A'}</td>
          <td>${t.totalProductQty}</td>
          <td>₱${(t.totalProductValue || 0).toLocaleString()}</td>
          <td>₱${(t.total || 0).toLocaleString()}</td>
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

  // Print Branch Inventory Report
  const handlePrintInventory = async () => {
    if (!selectedBranch || !currentBranch) return;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    
    // Build filters text
    const filters = [];
    if (searchTerm) filters.push(`Search: "${searchTerm}"`);
    if (categoryFilter !== 'all') filters.push(`Category: ${categoryFilter}`);
    if (statusFilter !== 'all') filters.push(`Status: ${statusFilter}`);
    const filtersText = filters.length > 0 ? filters.join(' • ') : 'No filters applied';

    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Branch Inventory Report</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: letter;
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
              padding: 0;
              color: #000;
              font-size: 9px;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
            }
            .header h1 {
              font-size: 14px;
              font-weight: 600;
              margin: 0 0 5px 0;
              letter-spacing: 1px;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
            }
            .filters {
              background: #fff;
              padding: 8px;
              border: 1px solid #333;
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
            .product-card {
              border: 1px solid #333;
              margin-bottom: 10px;
              background: #fff;
              page-break-inside: avoid;
            }
            .product-header {
              background: #fff;
              padding: 8px 12px;
              border-bottom: 1px solid #333;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .product-name {
              font-size: 11px;
              font-weight: 700;
            }
            .status-badge {
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
              border: 1px solid #333;
              background: #fff;
              color: #000;
            }
            .product-body {
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
              width: 110px;
            }
            .info-value {
              color: #333;
            }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 10px 0.4in;
              border-top: 2px solid #333;
              font-size: 8px;
              background: #fff;
            }
            .footer-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .footer-left, .footer-right {
              flex: 1;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Branch Inventory Report - ${currentBranch.name || currentBranch.branchName}</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>

          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-value">${stats.totalProducts}</div>
              <div class="stat-label">Total Products</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">₱${stats.totalValue.toLocaleString()}</div>
              <div class="stat-label">Total Value</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.lowStock}</div>
              <div class="stat-label">Low Stock</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stats.outOfStock}</div>
              <div class="stat-label">Out of Stock</div>
            </div>
          </div>
    `;

    filteredInventory.forEach(item => {
      const totalStock = item.batches.reduce((sum, b) => sum + (b.computedStock || 0), 0);
      const totalValue = item.batches.reduce((sum, b) => sum + ((b.computedStock || 0) * (b.unitCost || 0)), 0);
      
      htmlContent += `
        <div class="product-card">
          <div class="product-header">
            <div class="product-name">${item.productName}</div>
            <span class="status-badge">${item.status}</span>
          </div>
          
          <div class="product-body">
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Brand:</span>
                <span class="info-value">${item.brand || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Category:</span>
                <span class="info-value">${item.category || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Stock:</span>
                <span class="info-value">${totalStock} units</span>
              </div>
              <div class="info-row">
                <span class="info-label">Batches:</span>
                <span class="info-value">${item.batches.length}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Value:</span>
                <span class="info-value">₱${totalValue.toLocaleString()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${item.status}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    htmlContent += `
          <div class="footer">
            <div class="footer-content">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Overall Inventory Controller'}<br>
                <strong>Position:</strong> Overall Inventory Controller<br>
                <strong>Branch:</strong> ${currentBranch.name || currentBranch.branchName}
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br>
                <strong>Time:</strong> ${format(new Date(), 'HH:mm:ss')}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Print All Branches Inventory Overview
  const handlePrintAllBranches = async () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    const activeBranches = branches.filter(b => b.isActive !== false);
    
    // Calculate overall stats
    const totalBranches = activeBranches.length;
    const totalProducts = Object.values(branchStats).reduce((sum, stat) => sum + (stat.totalProducts || 0), 0);
    const totalValue = Object.values(branchStats).reduce((sum, stat) => sum + (stat.totalValue || 0), 0);
    const totalLowStock = Object.values(branchStats).reduce((sum, stat) => sum + (stat.lowStock || 0), 0);
    const totalOutOfStock = Object.values(branchStats).reduce((sum, stat) => sum + (stat.outOfStock || 0), 0);

    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>All Branches Inventory Overview</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: letter;
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
              padding: 0;
              color: #000;
              font-size: 9px;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
            }
            .header h1 {
              font-size: 14px;
              font-weight: 600;
              margin: 0 0 5px 0;
              letter-spacing: 1px;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0;
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
            .branch-card {
              border: 1px solid #333;
              margin-bottom: 10px;
              background: #fff;
              page-break-inside: avoid;
            }
            .branch-header {
              background: #fff;
              padding: 8px 12px;
              border-bottom: 1px solid #333;
            }
            .branch-name {
              font-size: 11px;
              font-weight: 700;
            }
            .branch-body {
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
              width: 110px;
            }
            .info-value {
              color: #333;
            }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 10px 0.4in;
              border-top: 2px solid #333;
              font-size: 8px;
              background: #fff;
            }
            .footer-content {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .footer-left, .footer-right {
              flex: 1;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Inventory Overview - All Branches</h2>
          </div>

          <div class="summary-stats">
            <div class="stat-box">
              <div class="stat-value">${totalBranches}</div>
              <div class="stat-label">Total Branches</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalProducts}</div>
              <div class="stat-label">Total Products</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">₱${totalValue.toLocaleString()}</div>
              <div class="stat-label">Total Value</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalLowStock + totalOutOfStock}</div>
              <div class="stat-label">Alerts</div>
            </div>
          </div>
    `;

    activeBranches.forEach(branch => {
      const stats = branchStats[branch.id] || {
        totalProducts: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
        inStock: 0
      };
      
      htmlContent += `
        <div class="branch-card">
          <div class="branch-header">
            <div class="branch-name">${branch.name || branch.branchName}</div>
          </div>
          
          <div class="branch-body">
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">Total Products:</span>
                <span class="info-value">${stats.totalProducts}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Value:</span>
                <span class="info-value">₱${stats.totalValue.toLocaleString()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">In Stock:</span>
                <span class="info-value">${stats.inStock}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Low Stock:</span>
                <span class="info-value">${stats.lowStock}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Out of Stock:</span>
                <span class="info-value">${stats.outOfStock}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${branch.isActive !== false ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    htmlContent += `
          <div class="footer">
            <div class="footer-content">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Overall Inventory Controller'}<br>
                <strong>Position:</strong> Overall Inventory Controller<br>
                <strong>Branch:</strong> Overall Inventory
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br>
                <strong>Time:</strong> ${format(new Date(), 'HH:mm:ss')}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  // Handle opening Force Adjust modal
  const handleOpenForceAdjust = (item) => {
    setSelectedProductForAdjust(item);
    setForceAdjustStep('selectType');
    setSelectedUsageType(null);
    setProductBatches([]);
    setSelectedBatchForAdjust(null);
    setIsForceAdjustModalOpen(true);
  };

  // Handle selecting usage type (OTC or Salon Use)
  const handleSelectUsageType = (usageType) => {
    setSelectedUsageType(usageType);
    
    // Filter batches by usage type
    // Check both usageType field and isSalonUse field for backward compatibility
    const filteredBatches = selectedProductForAdjust.batches.filter(batch => {
      const batchUsageType = batch.usageType || (batch.isSalonUse ? 'salon-use' : 'otc');
      return batchUsageType === usageType;
    });
    
    console.log('Filtering batches for usage type:', usageType, {
      totalBatches: selectedProductForAdjust.batches.length,
      filteredBatches: filteredBatches.length,
      batchDetails: selectedProductForAdjust.batches.map(b => ({
        id: b.id,
        batchNumber: b.batchNumber,
        usageType: b.usageType,
        isSalonUse: b.isSalonUse,
        computed: b.usageType || (b.isSalonUse ? 'salon-use' : 'otc')
      }))
    });
    
    setProductBatches(filteredBatches);
    setForceAdjustStep('selectBatch');
  };

  // Handle selecting a batch to adjust
  const handleSelectBatch = (batch) => {
    const batchUsageType = batch.usageType || (batch.isSalonUse ? 'salon-use' : 'otc');
    console.log('Selected batch for adjustment:', {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      usageType: batch.usageType,
      isSalonUse: batch.isSalonUse,
      computedUsageType: batchUsageType,
      selectedUsageType: selectedUsageType,
      stock: batch.computedStock
    });
    
    setSelectedBatchForAdjust(batch);
    setForceAdjustForm({
      stockId: batch.id,
      productId: batch.productId,
      productName: selectedProductForAdjust.productName,
      currentStock: batch.computedStock?.toString() || '0',
      adjustmentQuantity: '',
      reason: '',
      customReason: '',
      managerCode: '',
      notes: '',
      batchNumber: batch.batchNumber || ''
    });
    setForceAdjustStep('adjustStock');
  };

  // Reset Force Adjust modal
  const resetForceAdjustModal = () => {
    setIsForceAdjustModalOpen(false);
    setForceAdjustStep('selectType');
    setSelectedUsageType(null);
    setSelectedProductForAdjust(null);
    setProductBatches([]);
    setSelectedBatchForAdjust(null);
    setForceAdjustForm({
      stockId: '',
      productId: '',
      currentStock: '',
      adjustmentQuantity: '',
      reason: '',
      customReason: '',
      managerCode: '',
      notes: '',
      batchNumber: ''
    });
    setForceAdjustErrors({});
    setVerifiedManager(null);
  };

  // Validate and proceed to confirmation step
  const handleProceedToConfirm = async () => {
    try {
      setIsSubmittingAdjust(true);
      setForceAdjustErrors({});

      // Validation
      const errors = {};
      if (!forceAdjustForm.newStock || parseInt(forceAdjustForm.newStock) < 0) {
        errors.newStock = 'New stock must be 0 or greater';
      }

      if (!forceAdjustForm.reason) {
        errors.reason = 'Reason is required';
      }

      if (!forceAdjustForm.managerCode) {
        errors.managerCode = 'Manager authorization code is required';
      }

      if (Object.keys(errors).length > 0) {
        setForceAdjustErrors(errors);
        setIsSubmittingAdjust(false);
        return;
      }

      // Verify manager code (this should work for any branch since Overall Inventory is auditor)
      const verificationResult = await verifyManagerCode(forceAdjustForm.managerCode, selectedBranch);

      if (!verificationResult.valid) {
        setForceAdjustErrors({ managerCode: 'Invalid manager authorization code. Please contact a branch manager.' });
        setIsSubmittingAdjust(false);
        return;
      }

      // Store verified manager info and proceed to confirmation
      setVerifiedManager(verificationResult);
      setForceAdjustStep('confirm');
      setIsSubmittingAdjust(false);

    } catch (error) {
      console.error('Error validating adjustment:', error);
      setForceAdjustErrors({ general: 'Failed to validate. Please try again.' });
      setIsSubmittingAdjust(false);
    }
  };

  // Handle Force Adjust Stock (actual adjustment after confirmation)
  const handleForceAdjust = async () => {
    try {
      setIsSubmittingAdjust(true);
      setForceAdjustErrors({});

      const stockDocRef = doc(db, 'stocks', forceAdjustForm.stockId);

      // Create adjustment record in separate collection
      const adjustmentData = {
        stockId: forceAdjustForm.stockId,
        productId: forceAdjustForm.productId,
        productName: forceAdjustForm.productName || selectedProductForAdjust?.productName || 'Unknown Product',
        batchNumber: forceAdjustForm.batchNumber || selectedBatchForAdjust?.batchNumber || '',
        branchId: selectedBranch,
        previousStock: parseInt(forceAdjustForm.currentStock),
        newStock: parseInt(forceAdjustForm.newStock),
        adjustmentQuantity: parseInt(forceAdjustForm.adjustmentQuantity),
        reason: forceAdjustForm.reason,
        notes: forceAdjustForm.notes || '',
        adjustedBy: userData?.uid,
        managerCode: forceAdjustForm.managerCode.substring(0, 4) + '****', // Partially mask for security
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'completed'
      };

      // Save to stockAdjustments collection (separate collection for audit trail)
      await addDoc(collection(db, 'stockAdjustments'), adjustmentData);

      // Update the stock record's realTimeStock and remainingQuantity
      await updateDoc(stockDocRef, {
        realTimeStock: parseInt(forceAdjustForm.newStock),
        remainingQuantity: parseInt(forceAdjustForm.newStock),
        updatedAt: serverTimestamp()
      });

      // CRITICAL: Also update the corresponding product_batch record
      if (forceAdjustForm.batchNumber) {
        const batchQuery = query(
          collection(db, 'product_batches'),
          where('batchNumber', '==', forceAdjustForm.batchNumber),
          where('branchId', '==', selectedBranch),
          where('productId', '==', forceAdjustForm.productId)
        );
        const batchSnapshot = await getDocs(batchQuery);
        
        if (!batchSnapshot.empty) {
          const batchDoc = batchSnapshot.docs[0];
          const newStatus = parseInt(forceAdjustForm.newStock) <= 0 ? 'depleted' : 'active';
          await updateDoc(doc(db, 'product_batches', batchDoc.id), {
            remainingQuantity: parseInt(forceAdjustForm.newStock),
            status: newStatus,
            updatedAt: serverTimestamp()
          });
          console.log('✅ Updated product_batch:', batchDoc.id, 'to', forceAdjustForm.newStock);
        } else {
          console.warn('⚠️ No product_batch found for batch:', forceAdjustForm.batchNumber);
        }
      }

      // Get product name for logging
      const stockDoc = await getDoc(stockDocRef);
      const stockData = stockDoc.data();
      const productName = stockData?.productName || 'Unknown Product';

      // Log activity with detailed information
      const { logActivity } = await import('../../services/activityService');
      await logActivity({
        action: 'stock_force_adjustment',
        performedBy: userData?.uid,
        targetUser: null,
        branchId: selectedBranch,
        details: {
          stockId: forceAdjustForm.stockId,
          productId: forceAdjustForm.productId,
          productName: productName,
          batchNumber: forceAdjustForm.batchNumber || 'N/A',
          previousStock: parseInt(forceAdjustForm.currentStock),
          newStock: parseInt(forceAdjustForm.newStock),
          adjustmentQuantity: parseInt(forceAdjustForm.adjustmentQuantity),
          reason: forceAdjustForm.reason,
          notes: forceAdjustForm.notes || '',
          authorizedBy: verifiedManager?.managerId,
          authorizedByName: verifiedManager?.managerName
        }
      });

      // Close modal and reset form
      resetForceAdjustModal();

      // Reload inventory to show updated stock
      loadInventory();

      alert('Stock adjusted successfully! Both stocks and product_batches updated.');

    } catch (error) {
      console.error('Error adjusting stock:', error);
      setForceAdjustErrors({ general: 'Failed to adjust stock. Please try again.' });
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  if (loading && !selectedBranch && Object.keys(branchStats).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading branches...</span>
      </div>
    );
  }

  // Show branch cards if no branch is selected
  if (!selectedBranch) {
    const activeBranches = branches.filter(b => b.isActive !== false);

    // Pagination for logs
    const totalLogsPages = Math.ceil(adjustLogs.length / LOGS_PER_PAGE);
    const paginatedLogs = adjustLogs.slice(
      (logsCurrentPage - 1) * LOGS_PER_PAGE,
      logsCurrentPage * LOGS_PER_PAGE
    );

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Overview</h1>
            <p className="text-gray-600">Monitor inventory across all branches</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'branches' && (
              <Button 
                variant="outline"
                onClick={handlePrintAllBranches} 
                className="flex items-center gap-2"
                disabled={activeBranches.length === 0}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            )}
            <Button onClick={loadBranchStats} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('branches')}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'branches'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building className="h-4 w-4" />
              Branches
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Product Sales
            </button>
            <button
              onClick={() => setActiveTab('adjustLogs')}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'adjustLogs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <History className="h-4 w-4" />
              Adjust Logs
            </button>
          </nav>
        </div>

        {/* Force Adjust Logs Section */}
        {activeTab === 'adjustLogs' && (
          <Card className="p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-900">Force Adjust Logs</h2>
                <span className="text-sm text-gray-500">({adjustLogs.length} records)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={logsDateFilter}
                  onChange={(e) => setLogsDateFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="all">All Time</option>
                </select>
                <select
                  value={logsBranchFilter}
                  onChange={(e) => setLogsBranchFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Branches</option>
                  {activeBranches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name || branch.branchName}</option>
                  ))}
                </select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrintLogs}
                  disabled={adjustLogs.length === 0}
                  className="flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadAdjustLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Batch</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Previous</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">New</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Reason</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-gray-500">Loading logs...</p>
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                        <History className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p>No force adjust logs found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => {
                      const change = (log.newStock || 0) - (log.previousStock || 0);
                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="text-sm text-gray-900">{format(new Date(log.createdAt), 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-gray-500">{format(new Date(log.createdAt), 'HH:mm')}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3 text-gray-400" />
                              <span className="text-sm text-gray-900 truncate max-w-[100px]">{log.branchName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                              {log.productName}
                            </div>
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell">
                            <div className="text-sm text-gray-600">{log.batchNumber || 'N/A'}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-sm text-gray-900">{log.previousStock || 0}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-sm font-medium text-gray-900">{log.newStock || 0}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-sm font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {change >= 0 ? '+' : ''}{change}
                            </span>
                          </td>
                          <td className="px-3 py-2 hidden lg:table-cell">
                            <div className="text-sm text-gray-600 truncate max-w-[150px]">{log.reason || 'N/A'}</div>
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLog(log);
                                setIsLogDetailsModalOpen(true);
                              }}
                              className="px-2 py-1"
                            >
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
            {totalLogsPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {((logsCurrentPage - 1) * LOGS_PER_PAGE) + 1} to {Math.min(logsCurrentPage * LOGS_PER_PAGE, adjustLogs.length)} of {adjustLogs.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsCurrentPage(p => Math.max(1, p - 1))}
                    disabled={logsCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {logsCurrentPage} of {totalLogsPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsCurrentPage(p => Math.min(totalLogsPages, p + 1))}
                    disabled={logsCurrentPage === totalLogsPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Product Transactions Section */}
        {activeTab === 'transactions' && (
          <Card className="p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Product Transactions</h2>
                <span className="text-sm text-gray-500">({productTransactions.length} records)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={transactionsDateFilter}
                  onChange={(e) => setTransactionsDateFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="all">All Time</option>
                </select>
                <select
                  value={transactionsBranchFilter}
                  onChange={(e) => setTransactionsBranchFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Branches</option>
                  {activeBranches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name || branch.branchName}</option>
                  ))}
                </select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrintTransactions}
                  disabled={productTransactions.length === 0}
                  className="flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadProductTransactions}
                  disabled={loadingTransactions}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingTransactions ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">Total Transactions</p>
                <p className="text-lg font-bold text-blue-600">{transactionSummary.totalTransactions}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">Products Sold</p>
                <p className="text-lg font-bold text-green-600">{transactionSummary.totalProductsSold}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">Product Revenue</p>
                <p className="text-lg font-bold text-purple-600">₱{transactionSummary.totalProductRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">Product Only</p>
                <p className="text-lg font-bold text-cyan-600">{transactionSummary.productOnlyTransactions}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">With Services</p>
                <p className="text-lg font-bold text-orange-600">{transactionSummary.mixedTransactions}</p>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transaction</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Client</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Products</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loadingTransactions ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-gray-500">Loading transactions...</p>
                      </td>
                    </tr>
                  ) : productTransactions.slice((transactionsCurrentPage - 1) * TRANSACTIONS_PER_PAGE, transactionsCurrentPage * TRANSACTIONS_PER_PAGE).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                        <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p>No product transactions found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                      </td>
                    </tr>
                  ) : (
                    productTransactions.slice((transactionsCurrentPage - 1) * TRANSACTIONS_PER_PAGE, transactionsCurrentPage * TRANSACTIONS_PER_PAGE).map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="text-sm text-gray-900">{format(new Date(transaction.createdAt), 'MMM dd, yyyy')}</div>
                          <div className="text-xs text-gray-500">{format(new Date(transaction.createdAt), 'HH:mm')}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium text-blue-600">{transaction.id}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3 text-gray-400" />
                            <span className="text-sm text-gray-900 truncate max-w-[100px]">{transaction.branchName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <div className="text-sm text-gray-900">{transaction.clientName || 'Walk-in'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            transaction.salesType === 'product' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {transaction.salesType === 'product' ? 'Product' : 'Mixed'}
                          </span>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell">
                          <div className="text-sm text-gray-600 truncate max-w-[150px]">
                            {transaction.productItems.map(p => p.name).join(', ') || 'N/A'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium text-gray-900">{transaction.totalProductQty}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium text-green-600">₱{(transaction.totalProductValue || 0).toLocaleString()}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setIsTransactionDetailsModalOpen(true);
                            }}
                            className="px-2 py-1"
                          >
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
            {Math.ceil(productTransactions.length / TRANSACTIONS_PER_PAGE) > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {((transactionsCurrentPage - 1) * TRANSACTIONS_PER_PAGE) + 1} to {Math.min(transactionsCurrentPage * TRANSACTIONS_PER_PAGE, productTransactions.length)} of {productTransactions.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransactionsCurrentPage(p => Math.max(1, p - 1))}
                    disabled={transactionsCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {transactionsCurrentPage} of {Math.ceil(productTransactions.length / TRANSACTIONS_PER_PAGE)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTransactionsCurrentPage(p => Math.min(Math.ceil(productTransactions.length / TRANSACTIONS_PER_PAGE), p + 1))}
                    disabled={transactionsCurrentPage === Math.ceil(productTransactions.length / TRANSACTIONS_PER_PAGE)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Branch Cards Grid */}
        {activeTab === 'branches' && (
          <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeBranches.map((branch) => {
            const stats = branchStats[branch.id] || {
              totalProducts: 0,
              totalValue: 0,
              lowStock: 0,
              outOfStock: 0,
              totalItems: 0
            };

            return (
              <Card
                key={branch.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-gray-200 hover:border-blue-500"
                onClick={() => handleBranchClick(branch.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {branch.name || branch.branchName}
                      </h3>
                      <p className="text-sm text-gray-500">{branch.address || 'No address'}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-xs text-gray-600">Total Items</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.totalItems}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-gray-600">Total Value</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      ₱{stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-xs text-gray-600">Low Stock</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.lowStock}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs text-gray-600">Out of Stock</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.outOfStock}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {activeBranches.length === 0 && activeTab === 'branches' && (
          <Card className="p-12 text-center">
            <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Branches</h3>
            <p className="text-gray-600">No active branches found in the system.</p>
          </Card>
        )}
          </>
        )}
      </div>
    );
  }

  // Show inventory view for selected branch
  const currentBranch = branches.find(b => b.id === selectedBranch);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleBackToBranches}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Branches
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentBranch?.name || currentBranch?.branchName || 'Branch'} Inventory
            </h1>
            <p className="text-gray-600">Viewing inventory for this branch</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handlePrintInventory} 
            variant="outline" 
            className="flex items-center gap-2"
            disabled={filteredInventory.length === 0}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={loadInventory} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <Banknote className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-xl font-bold text-gray-900">₱{stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-xl font-bold text-gray-900">{stats.lowStock}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-xl font-bold text-gray-900">{stats.outOfStock}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <Building className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Branches</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalBranches}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search by product name, brand, or category..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Inventory Table */}
      {filteredInventory.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batches
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.productId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                        <div className="text-xs text-gray-500">{item.brand}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.category || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.totalStock || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-blue-600">{item.batches?.length || 0} batches</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₱{(item.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item)}`}>
                        {getStatusText(item) === 'Out of Stock' && <XCircle className="h-3 w-3" />}
                        {getStatusText(item) === 'Low Stock' && <AlertTriangle className="h-3 w-3" />}
                        {getStatusText(item) === 'In Stock' && <CheckCircle className="h-3 w-3" />}
                        {getStatusText(item)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(item)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenForceAdjust(item)}
                          className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Force Adjust
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Inventory Found</h3>
          <p className="text-gray-600">
            {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No inventory data available'}
          </p>
        </Card>
      )}

      {/* Product Details Modal */}
      {isDetailsModalOpen && selectedProduct && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedProduct(null);
          }}
          title="Stock Batch Details"
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Product Name</label>
                <p className="text-gray-900 font-semibold">{selectedProduct.productName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Branch</label>
                <p className="text-gray-900">{selectedProduct.branchName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Brand</label>
                <p className="text-gray-900">{selectedProduct.brand || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Category</label>
                <p className="text-gray-900">{selectedProduct.category || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Stock</label>
                <p className="text-gray-900 font-semibold">{selectedProduct.totalStock || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Batches</label>
                <p className="text-gray-900">{selectedProduct.batches?.length || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Value</label>
                <p className="text-gray-900 font-semibold text-green-600">
                  ₱{(selectedProduct.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedProduct)}`}>
                  {getStatusText(selectedProduct)}
                </span>
              </div>
            </div>
            
            {/* Batches List */}
            {selectedProduct.batches && selectedProduct.batches.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Stock Batches</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedProduct.batches.map((batch, index) => {
                    // Safely format expiration date
                    let expirationDateStr = null;
                    if (batch.expirationDate) {
                      try {
                        const expDate = batch.expirationDate?.toDate ? batch.expirationDate.toDate() : new Date(batch.expirationDate);
                        if (!isNaN(expDate.getTime())) {
                          expirationDateStr = format(expDate, 'MMM dd, yyyy');
                        }
                      } catch (e) {
                        console.warn('Invalid expiration date:', batch.expirationDate);
                      }
                    }
                    
                    return (
                    <div key={batch.id || index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-blue-600">{batch.batchNumber || 'No Batch Number'}</p>
                          <p className="text-sm text-gray-600">
                            Stock: <strong>{batch.computedStock || 0}</strong> | 
                            Type: <span className={batch.usageType === 'salon-use' ? 'text-purple-600' : 'text-blue-600'}>
                              {batch.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                            </span>
                          </p>
                          {expirationDateStr && (
                            <p className="text-xs text-gray-500">
                              Expires: {expirationDateStr}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">₱{(batch.unitCost || 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">per unit</p>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Force Adjust Stock Modal - Multi-step */}
      {isForceAdjustModalOpen && (
        <Modal
          isOpen={isForceAdjustModalOpen}
          onClose={resetForceAdjustModal}
          title={
            forceAdjustStep === 'selectType' ? `Force Adjust - ${selectedProductForAdjust?.productName}` :
            forceAdjustStep === 'selectBatch' ? `Select ${selectedUsageType === 'otc' ? 'OTC' : 'Salon Use'} Batch` :
            forceAdjustStep === 'confirm' ? 'Confirm Stock Adjustment' :
            `Adjust Batch - ${forceAdjustForm.batchNumber}`
          }
          size="lg"
        >
          <div className="space-y-6">
            {/* Step 1: Select Usage Type */}
            {forceAdjustStep === 'selectType' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-medium text-blue-900">Product Information</h3>
                  </div>
                  <p className="text-sm text-blue-700">Product: <strong className="text-blue-900">{selectedProductForAdjust?.productName}</strong></p>
                  <p className="text-sm text-blue-700">Total Stock: <strong className="text-blue-900">{selectedProductForAdjust?.totalStock || 0}</strong> units</p>
                  <p className="text-sm text-blue-700">Total Batches: <strong className="text-blue-900">{selectedProductForAdjust?.batches?.length || 0}</strong></p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Stock Type to Adjust</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleSelectUsageType('otc')}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                    >
                      <Package className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                      <h4 className="font-semibold text-gray-900">OTC Stock</h4>
                      <p className="text-sm text-gray-500 mt-1">Over-the-counter products for sale</p>
                      <p className="text-xs text-blue-600 mt-2">
                        {selectedProductForAdjust?.batches?.filter(b => (b.usageType || 'otc') === 'otc').length || 0} batches
                      </p>
                    </button>
                    <button
                      onClick={() => handleSelectUsageType('salon-use')}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-center"
                    >
                      <Building className="h-10 w-10 text-purple-600 mx-auto mb-3" />
                      <h4 className="font-semibold text-gray-900">Salon Use Stock</h4>
                      <p className="text-sm text-gray-500 mt-1">Products for salon services</p>
                      <p className="text-xs text-purple-600 mt-2">
                        {selectedProductForAdjust?.batches?.filter(b => b.usageType === 'salon-use').length || 0} batches
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={resetForceAdjustModal} variant="outline">
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {/* Step 2: Select Batch */}
            {forceAdjustStep === 'selectBatch' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">Product: <strong className="text-blue-900">{selectedProductForAdjust?.productName}</strong></p>
                  <p className="text-sm text-blue-700">Type: <strong className="text-blue-900">{selectedUsageType === 'otc' ? 'OTC' : 'Salon Use'}</strong></p>
                </div>

                {productBatches.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {productBatches.map((batch) => {
                      // Safely format expiration date
                      let expirationDateStr = null;
                      if (batch.expirationDate) {
                        try {
                          const expDate = batch.expirationDate?.toDate ? batch.expirationDate.toDate() : new Date(batch.expirationDate);
                          if (!isNaN(expDate.getTime())) {
                            expirationDateStr = format(expDate, 'MMM dd, yyyy');
                          }
                        } catch (e) {
                          console.warn('Invalid expiration date:', batch.expirationDate);
                        }
                      }
                      
                      // Get usage type for display
                      const batchUsageType = batch.usageType || batch.isSalonUse ? 'salon-use' : 'otc';
                      const usageTypeLabel = batchUsageType === 'salon-use' ? 'Salon Use' : 'OTC';
                      
                      return (
                      <button
                        key={batch.id}
                        onClick={() => handleSelectBatch(batch)}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-blue-600">{batch.batchNumber || 'No Batch Number'}</p>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                batchUsageType === 'salon-use' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {usageTypeLabel}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">Stock: <strong>{batch.computedStock || 0}</strong> units</p>
                            {expirationDateStr && (
                              <p className="text-xs text-gray-500 mt-1">
                                Expires: {expirationDateStr}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">₱{(batch.unitCost || 0).toFixed(2)}</p>
                            <p className="text-xs text-gray-500">per unit</p>
                          </div>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No {selectedUsageType === 'otc' ? 'OTC' : 'Salon Use'} batches found for this product.</p>
                    <p className="text-sm text-gray-500 mt-2">All batches for this product may be of a different usage type.</p>
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t">
                  <Button onClick={() => setForceAdjustStep('selectType')} variant="outline">
                    Back
                  </Button>
                  <Button onClick={resetForceAdjustModal} variant="outline">
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Adjust Stock */}
            {forceAdjustStep === 'adjustStock' && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    <h3 className="text-sm font-medium text-blue-900">Batch Information</h3>
                  </div>
                  <p className="text-sm text-blue-700">Product: <strong className="text-blue-900">{forceAdjustForm.productName}</strong></p>
                  <p className="text-sm text-blue-700">Batch: <strong className="text-blue-900">{forceAdjustForm.batchNumber || 'N/A'}</strong></p>
                  <p className="text-sm text-blue-700">Type: <strong className="text-blue-900">{selectedUsageType === 'otc' ? 'OTC' : 'Salon Use'}</strong></p>
                  <p className="text-sm text-blue-700">Current Stock: <strong className="text-blue-900">{forceAdjustForm.currentStock}</strong> units</p>
                </div>

            {/* New Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Stock Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={forceAdjustForm.newStock}
                onChange={(e) => {
                  const newStock = e.target.value;
                  const adjustment = parseInt(newStock) - parseInt(forceAdjustForm.currentStock || 0);
                  setForceAdjustForm(prev => ({
                    ...prev,
                    newStock: newStock,
                    adjustmentQuantity: isNaN(adjustment) ? '' : adjustment.toString()
                  }));
                  setForceAdjustErrors(prev => ({ ...prev, newStock: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  forceAdjustErrors.newStock ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter new stock quantity"
              />
              {forceAdjustForm.adjustmentQuantity && (
                <p className={`text-xs mt-1 font-medium ${
                  parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Adjustment: {parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? '+' : ''}{forceAdjustForm.adjustmentQuantity} units
                </p>
              )}
              {forceAdjustErrors.newStock && (
                <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.newStock}</p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Adjustment <span className="text-red-500">*</span>
              </label>
              <select
                value={forceAdjustForm.reason}
                onChange={(e) => {
                  setForceAdjustForm(prev => ({ ...prev, reason: e.target.value }));
                  setForceAdjustErrors(prev => ({ ...prev, reason: '' }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  forceAdjustErrors.reason ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select a reason</option>
                <option value="Physical Count Discrepancy">Physical Count Discrepancy</option>
                <option value="Damaged/Lost Stock">Damaged/Lost Stock</option>
                <option value="Supplier Return">Supplier Return</option>
                <option value="System Correction">System Correction</option>
                <option value="Audit Adjustment">Audit Adjustment</option>
                <option value="Other">Other</option>
              </select>
              {forceAdjustErrors.reason && (
                <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.reason}</p>
              )}
            </div>

            {/* Manager Authorization Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manager Authorization Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  value={forceAdjustForm.managerCode}
                  onChange={(e) => {
                    setForceAdjustForm(prev => ({ ...prev, managerCode: e.target.value }));
                    setForceAdjustErrors(prev => ({ ...prev, managerCode: '' }));
                    // Clear verified manager when code changes
                    if (verifiedManager) {
                      setVerifiedManager(null);
                    }
                  }}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    forceAdjustErrors.managerCode ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter branch manager authorization code"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Enter the password of a branch manager assigned to this branch</p>
              {forceAdjustErrors.managerCode && (
                <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.managerCode}</p>
              )}
              {verifiedManager && forceAdjustStep === 'adjustStock' && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-900">Authorized by:</p>
                    <p className="text-sm text-green-800">{verifiedManager.managerName}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
              <textarea
                value={forceAdjustForm.notes}
                onChange={(e) => setForceAdjustForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional additional notes about this adjustment"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <Button onClick={() => setForceAdjustStep('selectBatch')} variant="outline">
                Back
              </Button>
              <div className="flex gap-3">
                <Button onClick={resetForceAdjustModal} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={handleProceedToConfirm}
                  disabled={isSubmittingAdjust}
                  className="flex items-center gap-2"
                >
                  {isSubmittingAdjust && <RefreshCw className="h-4 w-4 animate-spin" />}
                  Review & Confirm
                </Button>
              </div>
            </div>
              </>
            )}

            {/* Step 4: Confirmation */}
            {forceAdjustStep === 'confirm' && (
              <>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h3 className="text-sm font-semibold text-orange-900">Confirm Stock Adjustment</h3>
                  </div>
                  <p className="text-sm text-orange-700">
                    Please review the details below before confirming. This action cannot be undone.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Product</label>
                      <p className="text-sm font-semibold text-gray-900">{forceAdjustForm.productName}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Batch Number</label>
                      <p className="text-sm font-semibold text-gray-900">{forceAdjustForm.batchNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Stock Type</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedUsageType === 'otc' ? 'OTC' : 'Salon Use'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Reason</label>
                      <p className="text-sm font-semibold text-gray-900">{forceAdjustForm.reason}</p>
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-center gap-8">
                      <div className="text-center">
                        <label className="text-xs font-medium text-gray-500">Current Stock</label>
                        <p className="text-2xl font-bold text-gray-900">{forceAdjustForm.currentStock}</p>
                      </div>
                      <div className="text-center">
                        <ChevronRight className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <label className="text-xs font-medium text-gray-500">New Stock</label>
                        <p className="text-2xl font-bold text-blue-600">{forceAdjustForm.newStock}</p>
                      </div>
                      <div className="text-center">
                        <label className="text-xs font-medium text-gray-500">Change</label>
                        <p className={`text-2xl font-bold ${parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? '+' : ''}{forceAdjustForm.adjustmentQuantity}
                        </p>
                      </div>
                    </div>
                  </div>

                  {forceAdjustForm.notes && (
                    <div className="border-t pt-3 mt-3">
                      <label className="text-xs font-medium text-gray-500">Notes</label>
                      <p className="text-sm text-gray-700">{forceAdjustForm.notes}</p>
                    </div>
                  )}

                  <div className="border-t pt-3 mt-3">
                    <label className="text-xs font-medium text-gray-500">Authorized By</label>
                    <p className="text-sm font-semibold text-green-700">
                      <CheckCircle className="h-4 w-4 inline mr-1" />
                      {verifiedManager?.managerName || 'Branch Manager'}
                    </p>
                  </div>
                </div>

                {forceAdjustErrors.general && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 text-sm">{forceAdjustErrors.general}</p>
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t">
                  <Button onClick={() => setForceAdjustStep('adjustStock')} variant="outline">
                    Back
                  </Button>
                  <div className="flex gap-3">
                    <Button onClick={resetForceAdjustModal} variant="outline">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleForceAdjust}
                      disabled={isSubmittingAdjust}
                      className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
                    >
                      {isSubmittingAdjust && <RefreshCw className="h-4 w-4 animate-spin" />}
                      Confirm Adjustment
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Log Details Modal */}
      {isLogDetailsModalOpen && selectedLog && (
        <Modal
          isOpen={isLogDetailsModalOpen}
          onClose={() => {
            setIsLogDetailsModalOpen(false);
            setSelectedLog(null);
          }}
          title="Force Adjust Log Details"
          size="md"
        >
          <div className="space-y-4">
            {/* Header Info */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-orange-900">Stock Adjustment Record</h3>
              </div>
              <p className="text-sm text-orange-700">
                {format(new Date(selectedLog.createdAt), 'MMMM dd, yyyy \'at\' HH:mm:ss')}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Product</label>
                <p className="text-sm font-semibold text-gray-900">{selectedLog.productName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Branch</label>
                <p className="text-sm font-semibold text-gray-900">{selectedLog.branchName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Batch Number</label>
                <p className="text-sm font-semibold text-gray-900">{selectedLog.batchNumber || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Reason</label>
                <p className="text-sm font-semibold text-gray-900">{selectedLog.reason || 'N/A'}</p>
              </div>
            </div>

            {/* Stock Change */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-xs font-medium text-gray-500 block mb-3">Stock Change</label>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Previous</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedLog.previousStock || 0}</p>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-400" />
                <div className="text-center">
                  <p className="text-xs text-gray-500">New</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedLog.newStock || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Change</p>
                  <p className={`text-2xl font-bold ${(selectedLog.newStock - selectedLog.previousStock) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(selectedLog.newStock - selectedLog.previousStock) >= 0 ? '+' : ''}{selectedLog.newStock - selectedLog.previousStock}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedLog.notes && (
              <div>
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-1">{selectedLog.notes}</p>
              </div>
            )}

            {/* Authorization Info */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs font-medium text-gray-500">Adjusted By</label>
                  <p className="text-gray-900">{selectedLog.adjustedBy || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Manager Code</label>
                  <p className="text-gray-900">{selectedLog.managerCode || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Stock ID</label>
                  <p className="text-gray-500 text-xs font-mono">{selectedLog.stockId || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3" />
                    {selectedLog.status || 'Completed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => {
                setIsLogDetailsModalOpen(false);
                setSelectedLog(null);
              }}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transaction Details Modal */}
      {isTransactionDetailsModalOpen && selectedTransaction && (
        <Modal
          isOpen={isTransactionDetailsModalOpen}
          onClose={() => {
            setIsTransactionDetailsModalOpen(false);
            setSelectedTransaction(null);
          }}
          title="Transaction Details"
          size="lg"
        >
          <div className="space-y-4">
            {/* Header Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">{selectedTransaction.id}</h3>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  selectedTransaction.salesType === 'product' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {selectedTransaction.salesType === 'product' ? 'Product Only' : 'Mixed (Service + Product)'}
                </span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                {format(new Date(selectedTransaction.createdAt), 'MMMM dd, yyyy \'at\' HH:mm:ss')}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Branch</label>
                <p className="text-sm font-semibold text-gray-900">{selectedTransaction.branchName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Client</label>
                <p className="text-sm font-semibold text-gray-900">{selectedTransaction.clientName || 'Walk-in'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Payment Method</label>
                <p className="text-sm font-semibold text-gray-900 capitalize">{selectedTransaction.paymentMethod || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Receipt #</label>
                <p className="text-sm font-semibold text-gray-900">{selectedTransaction.receiptNumber || 'N/A'}</p>
              </div>
            </div>

            {/* Products List */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Products in Transaction</label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {selectedTransaction.productItems && selectedTransaction.productItems.length > 0 ? (
                  selectedTransaction.productItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">₱{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">₱{(item.price || 0).toLocaleString()} each</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No products</p>
                )}
              </div>
            </div>

            {/* Services List (if mixed) */}
            {selectedTransaction.salesType === 'mixed' && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">Services in Transaction</label>
                <div className="bg-purple-50 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                  {(selectedTransaction.items || []).filter(i => i.type === 'service').map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-purple-200 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        {item.stylistName && <p className="text-xs text-gray-500">Stylist: {item.stylistName}</p>}
                      </div>
                      <p className="text-sm font-medium text-gray-900">₱{(item.price || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Product Subtotal</span>
                  <span className="font-medium">₱{(selectedTransaction.totalProductValue || 0).toLocaleString()}</span>
                </div>
                {selectedTransaction.salesType === 'mixed' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Service Subtotal</span>
                    <span className="font-medium">₱{((selectedTransaction.subtotal || 0) - (selectedTransaction.totalProductValue || 0)).toLocaleString()}</span>
                  </div>
                )}
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Discount</span>
                    <span>-₱{(selectedTransaction.discount || 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-green-600">₱{(selectedTransaction.total || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedTransaction.notes && (
              <div>
                <label className="text-xs font-medium text-gray-500">Notes</label>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-1">{selectedTransaction.notes}</p>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => {
                setIsTransactionDetailsModalOpen(false);
                setSelectedTransaction(null);
              }}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OverallInventoryControllerInventory;












