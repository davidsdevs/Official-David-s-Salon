// src/pages/06_InventoryController/Stocks.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import { productService } from '../../services/productService';
import { inventoryService } from '../../services/inventoryService';
import { logActivity as activityServiceLogActivity } from '../../services/activityService';
import { stockListenerService } from '../../services/stockListenerService';
import { weeklyStockRecorder } from '../../services/weeklyStockRecorder';
import { db, auth } from '../../config/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, updateDoc, doc, getDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { verifyRolePassword } from '../../services/rolePasswordService';
import { USER_ROLES } from '../../utils/constants';
import { 
  Package, 
  Search,
  Filter,
  Eye,
  Edit,
  Plus,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Calendar,
  Banknote,
  Tag,
  Building,
  Clock,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Package2,
  Activity,
  Home,
  ArrowRight,
  ArrowRightLeft,
  QrCode,
  ShoppingCart,
  Truck,
  ClipboardList,
  UserCog,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

const Stocks = () => {
  const { userData } = useAuth();

  // Note: menuItems are defined in InventoryLayout, not needed here
  
  // Data states
  const [stocks, setStocks] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]); // For delivery tracking
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25); // Items per page
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('productName');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Virtual scrolling / visible items
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleEndIndex, setVisibleEndIndex] = useState(50); // Show 50 items at a time
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null); // For viewing stock history
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState('all'); // 'all', '7days', '30days', '90days', '1year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState(new Set()); // Track which product groups are expanded
  
  // Stock deduction history states
  const [stockDeductions, setStockDeductions] = useState([]);
  const [loadingDeductions, setLoadingDeductions] = useState(false);
  const [showDeductionHistory, setShowDeductionHistory] = useState(false);
  const [deductionSearchTerm, setDeductionSearchTerm] = useState('');
  const [deductionDateFilter, setDeductionDateFilter] = useState('7days'); // 'all', '7days', '30days', '90days'
  
  // Stock adjustments history states
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [showAdjustmentsHistory, setShowAdjustmentsHistory] = useState(false);

  // Allocated quantities from transactions (for computed stock display)
  const [allocatedQuantities, setAllocatedQuantities] = useState(new Map()); // batchId -> total allocated
  const [adjustmentStartDate, setAdjustmentStartDate] = useState('');
  const [adjustmentEndDate, setAdjustmentEndDate] = useState('');
  const [adjustmentSearchTerm, setAdjustmentSearchTerm] = useState('');
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);
  const adjustmentsPerPage = 5;
  
  // Manual salon-use deduction states
  const [isSalonUseDeductionModalOpen, setIsSalonUseDeductionModalOpen] = useState(false);
  const [salonUseDeductionForm, setSalonUseDeductionForm] = useState({
    stockId: '',
    productId: '',
    productName: '',
    batchId: '',
    batchNumber: '',
    currentStock: '',
    quantity: '',
    reason: '',
    notes: ''
  });
  const [salonUseDeductionErrors, setSalonUseDeductionErrors] = useState({});
  const [isSubmittingDeduction, setIsSubmittingDeduction] = useState(false);
  
  // Bulk salon-use deduction states
  const [isBulkDeductionModalOpen, setIsBulkDeductionModalOpen] = useState(false);
  const [bulkDeductionItems, setBulkDeductionItems] = useState([]); // Array of { stockId, productId, productName, batchNumber, currentStock, quantity }
  const [bulkDeductionReason, setBulkDeductionReason] = useState('');
  const [bulkDeductionNotes, setBulkDeductionNotes] = useState('');
  const [bulkDeductionErrors, setBulkDeductionErrors] = useState({});
  const [isSubmittingBulkDeduction, setIsSubmittingBulkDeduction] = useState(false);
  
  // Edit stock form state (removed - no longer using week stocks)
  // const [editStockForm, setEditStockForm] = useState({});
  // const [editStockErrors, setEditStockErrors] = useState({});
  // const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  
  // Product selection states for big data
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [branchName, setBranchName] = useState('Main Branch');
  
  // Memoized filtered products for performance (big data friendly)
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products;
    const search = productSearchTerm.toLowerCase();
    return products.filter(product => 
      product.name?.toLowerCase().includes(search) ||
      product.brand?.toLowerCase().includes(search) ||
      product.category?.toLowerCase().includes(search) ||
      product.upc?.toLowerCase().includes(search)
    );
  }, [products, productSearchTerm]);
  
  // Limit displayed products for better performance (show first 50, rest via scrolling)
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, 100); // Show first 100 products initially
  }, [filteredProducts]);
  
  const hasMoreProducts = filteredProducts.length > 100;
  
  // Create stock form states
  
  // Force adjust states
  
  // Import modal states
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    stockRange: { min: '', max: '' },
    lowStock: false,
    usageType: 'all', // 'all', 'otc', 'salon-use'
    batchNumber: '', // Filter by batch number
    condition: 'all' // 'all', 'good', 'expired', 'depleted'
  });

  // Mock stock data - in real app, this would come from API
  const mockStocks = [
    {
      id: '1',
      productId: 'prod1',
      productName: 'Olaplex No.3 Hair Perfector',
      brand: 'Olaplex',
      category: 'Hair Care',
      upc: '123456789114',
      currentStock: 45,
      minStock: 10,
      maxStock: 100,
      unitCost: 900,
      totalValue: 40500,
      lastUpdated: new Date('2024-01-15'),
      status: 'In Stock',
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      location: 'Shelf A-1',
      supplier: 'Olaplex Philippines',
      lastRestocked: new Date('2024-01-10'),
      expiryDate: new Date('2025-12-31')
    },
    {
      id: '2',
      productId: 'prod2',
      productName: 'L\'Oréal Professional Hair Color',
      brand: 'L\'Oréal',
      category: 'Hair Color',
      upc: '123456789115',
      currentStock: 5,
      minStock: 15,
      maxStock: 50,
      unitCost: 1200,
      totalValue: 6000,
      lastUpdated: new Date('2024-01-14'),
      status: 'Low Stock',
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      location: 'Shelf B-2',
      supplier: 'L\'Oréal Philippines',
      lastRestocked: new Date('2024-01-05'),
      expiryDate: new Date('2025-06-30')
    },
    {
      id: '3',
      productId: 'prod3',
      productName: 'Kerastase Shampoo',
      brand: 'Kerastase',
      category: 'Hair Care',
      upc: '123456789116',
      currentStock: 0,
      minStock: 5,
      maxStock: 30,
      unitCost: 800,
      totalValue: 0,
      lastUpdated: new Date('2024-01-13'),
      status: 'Out of Stock',
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      location: 'Shelf C-1',
      supplier: 'Kerastase Philippines',
      lastRestocked: new Date('2024-01-01'),
      expiryDate: new Date('2025-03-15')
    }
  ];


  // Helper function to log activity
  const logActivity = async (action, entityType, entityId, entityName, changes, reason = '', notes = '') => {
    try {
      const branchName = await getBranchName(userData?.branchId);
      const userName = userData?.displayName || userData?.name || userData?.email || 'Unknown User';
      const userRole = userData?.roles?.[0] || userData?.role || 'unknown';

      await activityServiceLogActivity({
        action: `stock_${action}`,
        performedBy: userData?.uid || '',
        branchId: userData?.branchId || '',
        details: {
          module: 'stocks',
          action,
          entityType,
          entityId,
          entityName,
          branchName,
          userName,
          userRole,
          changes,
          reason,
          notes
        }
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - activity logging should not break the main flow
    }
  };

  // Load stocks and products
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load products
      const productsResult = await productService.getAllProducts();
      if (productsResult.success) {
        setProducts(productsResult.products);
      }
      
      // Load purchase orders to track deliveries
      if (userData?.branchId) {
        try {
          const poRef = collection(db, 'purchaseOrders');
          const poQuery = query(
            poRef, 
            where('branchId', '==', userData.branchId),
            where('status', '==', 'Delivered')
          );
          const poSnapshot = await getDocs(poQuery);
          const poData = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setPurchaseOrders(poData);
        } catch (poErr) {
          console.error('Error loading purchase orders:', poErr);
        }
      }
      
      // Load stocks from Firestore for the current branch with pagination
      if (!userData?.branchId) {
        setStocks([]);
        setTotalItems(0);
      } else {
        const stocksRef = collection(db, 'stocks');
        
        // Get total count (for display purposes)
        try {
          const countQuery = query(stocksRef, where('branchId', '==', userData.branchId));
          const countSnapshot = await getCountFromServer(countQuery);
          setTotalItems(countSnapshot.data().count);
        } catch (countErr) {
          console.error('Error getting count:', countErr);
        }
        
        // Load first page only (paginated) - include both regular stocks and batch_stocks
        // Fetch data first, then sort in JavaScript to avoid needing a Firestore index
        const q = query(
          stocksRef, 
          where('branchId', '==', userData.branchId),
          limit(itemsPerPage * 2) // Fetch more to account for sorting, then limit after sorting
        );
        
        const snapshot = await getDocs(q);
        let stocksData = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            ...data,
            // Convert Firestore timestamps to dates
            startPeriod: data.startPeriod?.toDate ? data.startPeriod.toDate() : (data.startPeriod ? new Date(data.startPeriod) : null),
            endPeriod: data.endPeriod?.toDate ? data.endPeriod.toDate() : (data.endPeriod ? new Date(data.endPeriod) : null),
            expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : (data.expirationDate ? new Date(data.expirationDate) : null),
            receivedDate: data.receivedDate?.toDate ? data.receivedDate.toDate() : (data.receivedDate ? new Date(data.receivedDate) : null),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
          };
        });
        
        // Sort in JavaScript by createdAt descending (newest first), then by startPeriod
        stocksData = stocksData.sort((a, b) => {
          // First sort by createdAt (newest first)
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (createdB !== createdA) {
            return createdB - createdA; // Descending order
          }
          // If createdAt is same, sort by startPeriod
          const dateA = a.startPeriod ? new Date(a.startPeriod).getTime() : 0;
          const dateB = b.startPeriod ? new Date(b.startPeriod).getTime() : 0;
          return dateB - dateA; // Descending order
        });
        
        // Limit to itemsPerPage after sorting
        stocksData = stocksData.slice(0, itemsPerPage);
        
        // Update pagination state
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(snapshot.docs.length >= itemsPerPage);
        setCurrentPage(1);
        
        setStocks(stocksData);
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      // Load allocated quantities for computed stock display
      await loadAllocatedQuantities();
      setLoading(false);
    }
  };

  // Load more stocks (pagination)
  const loadMoreStocks = async () => {
    if (!hasMore || loadingMore || !userData?.branchId || !lastVisible) return;
    
    try {
      setLoadingMore(true);
      const stocksRef = collection(db, 'stocks');
      const q = query(
        stocksRef,
        where('branchId', '==', userData.branchId),
        startAfter(lastVisible),
        limit(itemsPerPage)
      );
      
      const snapshot = await getDocs(q);
      const newStocks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startPeriod: data.startPeriod?.toDate ? data.startPeriod.toDate() : (data.startPeriod ? new Date(data.startPeriod) : null),
          endPeriod: data.endPeriod?.toDate ? data.endPeriod.toDate() : (data.endPeriod ? new Date(data.endPeriod) : null),
          expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : (data.expirationDate ? new Date(data.expirationDate) : null),
          receivedDate: data.receivedDate?.toDate ? data.receivedDate.toDate() : (data.receivedDate ? new Date(data.receivedDate) : null),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        };
      });
      
      // Sort and append
      const sortedNewStocks = newStocks.sort((a, b) => {
        const dateA = a.startPeriod ? new Date(a.startPeriod) : new Date(0);
        const dateB = b.startPeriod ? new Date(b.startPeriod) : new Date(0);
        return dateB - dateA;
      });
      
      setStocks(prev => [...prev, ...sortedNewStocks]);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(snapshot.docs.length === itemsPerPage);
      setCurrentPage(prev => prev + 1);
    } catch (err) {
      console.error('Error loading more stocks:', err);
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Calculate computed stock (same logic as Branch Manager)
  const getComputedStock = (stock) => {
    // Use same priority as Branch Manager: remainingQuantity || realTimeStock || beginningStock
    const baseStock = stock.remainingQuantity || stock.realTimeStock || stock.beginningStock || 0;
    // Debug logging for salon-use stocks
    if (stock.usageType === 'salon-use' && stock.batchNumber) {
      console.log(`📊 Computing stock for ${stock.batchNumber}:`, {
        remainingQuantity: stock.remainingQuantity,
        realTimeStock: stock.realTimeStock,
        beginningStock: stock.beginningStock,
        computed: baseStock
      });
    }
    // Don't subtract allocated quantities - use raw remaining stock
    return Math.max(0, baseStock);
  };

  // Load allocated quantities from transactions (keeping for future use, but not subtracting from stock)
  const loadAllocatedQuantities = async () => {
    if (!userData?.branchId) return;

    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('branchId', '==', userData.branchId),
        where('stockDeducted', '==', true),
        where('status', 'in', ['paid', 'completed', 'Paid', 'Completed'])
      );

      const snapshot = await getDocs(q);
      const allocations = new Map();

      snapshot.docs.forEach(doc => {
        const transaction = doc.data();
        const items = transaction.items || [];

        items.forEach(item => {
          if (item.type === 'product' && item.batches) {
            item.batches.forEach(batch => {
              const batchId = batch.batchId;
              const allocatedQty = batch.allocatedQuantity || 0;

              if (batchId && allocatedQty > 0) {
                const current = allocations.get(batchId) || 0;
                allocations.set(batchId, current + allocatedQty);
              }
            });
          }
        });
      });

      setAllocatedQuantities(allocations);
    } catch (error) {
      console.error('Error loading allocated quantities:', error);
      setAllocatedQuantities(new Map());
    }
  };

  // Reset and reload (for filters/search)
  const reloadStocks = async () => {
    setCurrentPage(1);
    setLastVisible(null);
    setHasMore(true);
    setStocks([]); // Clear existing stocks
    setAllocatedQuantities(new Map()); // Clear allocations
    await loadData();
  };

  // Debounce search term for big data performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Load branch name on mount
  useEffect(() => {
    const loadBranchName = async () => {
      if (userData?.branchId) {
        try {
          const { getBranchById } = await import('../../services/branchService');
          const branch = await getBranchById(userData.branchId);
          setBranchName(branch?.name || branch?.branchName || 'Unknown Branch');
        } catch (error) {
          console.error('Error fetching branch name:', error);
          setBranchName('Unknown Branch');
        }
      }
    };
    loadBranchName();
  }, [userData?.branchId]);

  // Start stock listener on mount
  useEffect(() => {
    if (userData?.branchId) {
      console.log('Starting stock listener for branch:', userData.branchId);
      
      const unsubscribe = stockListenerService.startListening(
        userData.branchId,
        (transactionId, transactionData) => {
          console.log('Stock updated from transaction:', transactionId);
          // Reload stocks to reflect changes
          reloadStocks();
        }
      );

      // Cleanup: stop listener on unmount
      return () => {
        if (unsubscribe) {
          stockListenerService.stopListening(userData.branchId);
        }
      };
    }
  }, [userData?.branchId]);

  // Reset visible range when filters change
  useEffect(() => {
    setVisibleStartIndex(0);
    setVisibleEndIndex(50);
  }, [debouncedSearchTerm, filters, sortBy, sortOrder]);

  // Calculate deliveries for a product in a given month
  const getDeliveriesForMonth = (productId, startDate, endDate) => {
    return purchaseOrders.reduce((total, po) => {
      if (!po.actualDelivery) return total;
      const deliveryDate = po.actualDelivery?.toDate ? po.actualDelivery.toDate() : new Date(po.actualDelivery);
      
      if (deliveryDate >= startDate && deliveryDate <= endDate && po.items) {
        const item = po.items.find(item => item.productId === productId);
        if (item) {
          return total + (item.quantity || 0);
        }
      }
      return total;
    }, 0);
  };

  // Calculate ending stock for a month (beginningStock of next month + deliveries)
  const calculateEndingStock = (productId, currentMonthStart, currentMonthEnd) => {
    // Find next month's beginning stock
    const nextMonthStart = new Date(currentMonthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
    nextMonthStart.setDate(1);
    
    const nextMonthStock = stocks.find(s => 
      s.productId === productId &&
      s.startPeriod &&
      format(new Date(s.startPeriod), 'yyyy-MM-dd') === format(nextMonthStart, 'yyyy-MM-dd')
    );
    
    const nextMonthBeginningStock = nextMonthStock?.beginningStock || 0;
    
    // Get deliveries in current month
    const deliveries = getDeliveriesForMonth(productId, currentMonthStart, currentMonthEnd);
    
    return {
      endingStock: nextMonthBeginningStock,
      deliveries: deliveries,
      calculatedEndingStock: nextMonthBeginningStock + deliveries
    };
  };

  // Get stock history for a product
  const getStockHistoryForProduct = (productId) => {
    return stocks
      .filter(s => s.productId === productId && (s.batchId || s.batchNumber)) // Only include batch stocks
      .sort((a, b) => {
        // Sort by received date (newest first), then by batch number
        const dateA = a.receivedDate ? new Date(a.receivedDate) : (a.createdAt ? new Date(a.createdAt) : new Date(0));
        const dateB = b.receivedDate ? new Date(b.receivedDate) : (b.createdAt ? new Date(b.createdAt) : new Date(0));
        const dateDiff = dateB - dateA;

        if (dateDiff !== 0) return dateDiff;

        // If dates are equal, sort by batch number
        const batchA = a.batchNumber || '';
        const batchB = b.batchNumber || '';
        return batchA.localeCompare(batchB);
      })
      .map(stock => {
        const currentStock = getComputedStock(stock);
        const status = calculateStockStatus(stock);
        
        return {
          ...stock,
          currentStock: currentStock,
          status: status,
          receivedDateFormatted: stock.receivedDate ? format(new Date(stock.receivedDate), 'MMM dd, yyyy') : 'N/A',
          expirationDateFormatted: stock.expirationDate ? format(new Date(stock.expirationDate), 'MMM dd, yyyy') : 'N/A',
          createdDateFormatted: stock.createdAt ? format(new Date(stock.createdAt), 'MMM dd, yyyy') : 'N/A'
        };
      });
  };

  // Calculate stock status based on current stock levels (not batch)
  // Low stock threshold is below 5 (items with less than 5 are "Low Stock")
  const calculateStockStatus = (stock) => {
    const currentStock = getComputedStock(stock);
    const LOW_STOCK_THRESHOLD = 5; // Items below this are "Low Stock"
    const HIGH_STOCK_THRESHOLD = 10; // Items above this are "High Stock"
    
    if (currentStock === 0) {
      return 'Out of Stock';
    } else if (currentStock < LOW_STOCK_THRESHOLD) {
      return 'Low Stock';
    } else if (currentStock >= HIGH_STOCK_THRESHOLD) {
      return 'High Stock';
    } else {
      return 'In Stock';
    }
  };
  
  // Get stock level indicator (High/Low/Normal) based on current stock
  const getStockLevel = (stock) => {
    const status = calculateStockStatus(stock);
    if (status === 'High Stock') return 'high';
    if (status === 'Low Stock' || status === 'Out of Stock') return 'low';
    return 'normal';
  };

  // Get all stocks (including all batches for each product)
  // For batch stocks, show all active batches. For regular stocks, show current month only.
  const getCurrentStocksByProduct = () => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const stockList = [];
    const processedRegularStocks = new Set(); // Track regular stocks to avoid duplicates
    
    stocks.forEach(stock => {
      // Check if stock is expired
      const expirationDate = stock.expirationDate ? new Date(stock.expirationDate) : null;
      const isExpired = expirationDate && expirationDate < currentDate;
      
      // Don't skip expired stocks here - let the filter logic handle them
      // This allows users to view expired stocks when they select the "Expired" filter

      const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
      
      if (isBatchStock) {
        // For batch stocks, show ALL batches (even if depleted, so you can see history)
        // Salon-use stocks should always be visible regardless of stock level
        const isSalonUse = stock.usageType === 'salon-use';
        
        const stockStart = stock.startPeriod ? new Date(stock.startPeriod) : null;
        const isCurrentMonth = stockStart && 
          stockStart.getMonth() === currentMonthStart.getMonth() &&
          stockStart.getFullYear() === currentMonthStart.getFullYear();
        
        const realTimeStock = stock.realTimeStock || 0;
        // Show batch if: salon-use (always), has stock, is current month, or was created recently
        if (isSalonUse || realTimeStock > 0 || isCurrentMonth || (stockStart && stockStart >= currentMonthStart)) {
          // Always calculate status based on current stock levels to ensure it matches filter options
          const calculatedStatus = calculateStockStatus(stock);
          stockList.push({
            ...stock,
            status: calculatedStatus, // Ensure status matches filter options: 'In Stock', 'Low Stock', 'Out of Stock'
            product: products.find(p => p.id === stock.productId),
            stockHistory: getStockHistoryForProduct(stock.productId)
          });
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
          // Always calculate status based on current stock levels to ensure it matches filter options
          const calculatedStatus = calculateStockStatus(stock);
          stockList.push({
            ...stock,
            status: calculatedStatus, // Ensure status matches filter options: 'In Stock', 'Low Stock', 'Out of Stock'
            product: products.find(p => p.id === stock.productId),
            stockHistory: getStockHistoryForProduct(stock.productId)
          });
        }
      }
    });
    
    return stockList;
  };

  // Get current month stocks for display (only from loaded stocks)
  const currentMonthStocks = getCurrentStocksByProduct();

  // Get unique categories (from loaded data only - memoized for performance)
  const categories = useMemo(() => {
    return [...new Set(currentMonthStocks.map(s => s.category || s.product?.category))].filter(Boolean);
  }, [currentMonthStocks]);

  // Filter and sort current month stocks (memoized for big data performance)
  const filteredStocks = useMemo(() => {
    return currentMonthStocks
      .filter(stockData => {
        const stock = stockData;
        const product = stockData.product;
        
        // Use debounced search term for better performance
        const matchesSearch = 
          !debouncedSearchTerm ||
          (stock.productName || product?.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (stock.brand || product?.brand || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (stock.upc || product?.upc || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
        
        const matchesStatus = filters.status === 'all' || stock.status === filters.status;
        const matchesCategory = filters.category === 'all' || 
          (stock.category || product?.category || '') === filters.category;
        
        // Usage type filter
        const stockUsageType = stock.usageType || 'otc'; // Default to 'otc' for backward compatibility
        const matchesUsageType = filters.usageType === 'all' || stockUsageType === filters.usageType;
        
        const currentStock = getComputedStock(stock);
        const matchesStockRange = (!filters.stockRange.min || currentStock >= parseFloat(filters.stockRange.min)) &&
                                 (!filters.stockRange.max || currentStock <= parseFloat(filters.stockRange.max));
        
        const LOW_STOCK_THRESHOLD = 5;
        const matchesLowStock = !filters.lowStock || stock.status === 'Low Stock';
        
        // Batch number filter - check if batch number matches (for batch stocks)
        const stockBatchNumber = stock.batchNumber || '';
        const matchesBatch = !filters.batchNumber ||
          stockBatchNumber.toLowerCase().includes(filters.batchNumber.toLowerCase());

        // Condition filter - good, expired, or depleted
        let matchesCondition = true;
        if (filters.condition !== 'all') {
          const now = new Date();
          const expirationDate = stock.expirationDate ? new Date(stock.expirationDate) : null;
          const isExpired = expirationDate && expirationDate < now;
          const isDepleted = currentStock <= 0 || stock.status === 'Out of Stock';
          
          if (filters.condition === 'good') {
            // Good = Active, not expired, has stock
            matchesCondition = !isExpired && !isDepleted && stock.status !== 'Out of Stock';
          } else if (filters.condition === 'expired') {
            // Expired = Past expiration date
            matchesCondition = isExpired;
          } else if (filters.condition === 'depleted') {
            // Depleted = Zero stock or Out of Stock status
            matchesCondition = isDepleted;
          }
        } else {
          // When "All Conditions" is selected, exclude expired stocks by default
          const now = new Date();
          const expirationDate = stock.expirationDate ? new Date(stock.expirationDate) : null;
          const isExpired = expirationDate && expirationDate < now;
          matchesCondition = !isExpired;
        }

        return matchesSearch && matchesStatus && matchesCategory && matchesUsageType && matchesStockRange && matchesLowStock && matchesBatch && matchesCondition;
      })
      .sort((a, b) => {
        const aStock = a.productName || a.product?.name || '';
        const bStock = b.productName || b.product?.name || '';
        
        if (sortBy === 'productName') {
          return sortOrder === 'asc' 
            ? aStock.localeCompare(bStock)
            : bStock.localeCompare(aStock);
        }
        
        let aValue = a[sortBy] || a.product?.[sortBy];
        let bValue = b[sortBy] || b.product?.[sortBy];
        
        if (sortBy === 'startPeriod' || sortBy === 'endPeriod' || sortBy === 'lastUpdated') {
          aValue = aValue ? new Date(aValue) : new Date(0);
          bValue = bValue ? new Date(bValue) : new Date(0);
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [currentMonthStocks, debouncedSearchTerm, filters, sortBy, sortOrder]);

  // Group stocks by productId and usageType (for batch stocks)
  const groupedStocks = useMemo(() => {
    const groups = new Map();
    const nonBatchStocks = [];
    
    filteredStocks.forEach(stock => {
      const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
      
      if (isBatchStock) {
        // Group batch stocks by productId + usageType
        const groupKey = `${stock.productId}_${stock.usageType || 'otc'}`;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            productId: stock.productId,
            usageType: stock.usageType || 'otc',
            product: stock.product,
            productName: stock.productName || stock.product?.name || 'Unknown Product',
            brand: stock.brand || stock.product?.brand || '',
            upc: stock.upc || stock.product?.upc || '',
            category: stock.category || stock.product?.category || '',
            batches: [],
            totalStock: 0,
            totalBeginningStock: 0
          });
        }
        
        const group = groups.get(groupKey);
        const currentStock = getComputedStock(stock);
        const beginningStock = stock.beginningStock || 0;
        
        group.batches.push(stock);
        group.totalStock += currentStock;
        group.totalBeginningStock += beginningStock;
      } else {
        // Non-batch stocks - keep as individual items
        nonBatchStocks.push({
          productId: stock.productId,
          usageType: stock.usageType || 'otc',
          product: stock.product,
          productName: stock.productName || stock.product?.name || 'Unknown Product',
          brand: stock.brand || stock.product?.brand || '',
          upc: stock.upc || stock.product?.upc || '',
          category: stock.category || stock.product?.category || '',
          batches: [stock],
          totalStock: stock.realTimeStock || stock.remainingQuantity || stock.beginningStock || 0,
          totalBeginningStock: stock.beginningStock || 0,
          isNonBatch: true
        });
      }
    });
    
    // Sort batches within each group by batch number or received date
    groups.forEach(group => {
      group.batches.sort((a, b) => {
        // Sort by batch number if available, otherwise by received date
        if (a.batchNumber && b.batchNumber) {
          return a.batchNumber.localeCompare(b.batchNumber);
        }
        if (a.receivedDate && b.receivedDate) {
          return new Date(a.receivedDate) - new Date(b.receivedDate);
        }
        return 0;
      });
    });
    
    // Combine grouped batch stocks and non-batch stocks
    return [...Array.from(groups.values()), ...nonBatchStocks];
  }, [filteredStocks]);

  // Visible stocks for virtual scrolling (big data optimization)
  const visibleStocks = useMemo(() => {
    return groupedStocks.slice(visibleStartIndex, visibleEndIndex);
  }, [groupedStocks, visibleStartIndex, visibleEndIndex]);

  // Calculate total pages for pagination
  const totalPages = useMemo(() => {
    return Math.ceil(groupedStocks.length / 50);
  }, [groupedStocks.length]);

  const currentPageNumber = useMemo(() => {
    return Math.floor(visibleStartIndex / 50) + 1;
  }, [visibleStartIndex]);

  // Load more visible items (virtual scroll)
  const loadMoreVisible = useCallback(() => {
    if (visibleEndIndex < groupedStocks.length) {
      setVisibleEndIndex(prev => Math.min(prev + 50, groupedStocks.length));
    }
  }, [groupedStocks.length, visibleEndIndex]);

  // Export stocks to Excel
  const handleExportStocks = () => {
    if (!filteredStocks.length) {
      toast.error('No stocks to export');
      return;
    }

    try {
      const headers = [
        { key: 'productName', label: 'Product Name' },
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category' },
        { key: 'upc', label: 'UPC' },
        { key: 'batchNumber', label: 'Batch Number' },
        { key: 'beginningStock', label: 'Beginning Stock' },
        { key: 'realTimeStock', label: 'Current Stock' },
        { key: 'status', label: 'Status' },
        { key: 'expirationDate', label: 'Expiration Date' },
        { key: 'receivedDate', label: 'Received Date' },
        { key: 'startPeriod', label: 'Start Period' },
        { key: 'endPeriod', label: 'End Period' }
      ];

      // Prepare data with formatted dates and status
      const exportData = filteredStocks.map(stock => {
        const product = stock.product || {};
        const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
        const currentStock = getComputedStock(stock);
        const status = calculateStockStatus(stock);

        return {
          productName: stock.productName || product.name || 'Unknown',
          brand: stock.brand || product.brand || '',
          category: stock.category || product.category || '',
          upc: stock.upc || product.upc || '',
          batchNumber: isBatchStock ? (stock.batchNumber || 'N/A') : 'N/A',
          beginningStock: stock.beginningStock || 0,
          realTimeStock: currentStock,
          status: status,
          expirationDate: stock.expirationDate 
            ? format(new Date(stock.expirationDate), 'MMM dd, yyyy')
            : 'N/A',
          receivedDate: stock.receivedDate
            ? format(new Date(stock.receivedDate), 'MMM dd, yyyy')
            : 'N/A',
          startPeriod: stock.startPeriod
            ? format(new Date(stock.startPeriod), 'MMM dd, yyyy')
            : 'N/A',
          endPeriod: stock.endPeriod
            ? format(new Date(stock.endPeriod), 'MMM dd, yyyy')
            : 'N/A'
        };
      });

      exportToExcel(exportData, 'stocks_export', 'Stocks', headers);
      toast.success('Stocks exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting stocks:', error);
      toast.error('Failed to export stocks');
    }
  };

  // Handle stock details
  const handleViewDetails = (stock) => {
    setSelectedStock(stock);
    setIsDetailsModalOpen(true);
  };

  // Handle salon-use deduction
  const handleDeductSalonUse = (stock) => {
    console.log('🔍 handleDeductSalonUse called with stock:', stock);
    try {
      const currentStock = getComputedStock(stock);
      console.log('🔍 Current stock calculated:', currentStock);
      console.log('🔍 Stock details:', {
        id: stock.id,
        stockId: stock.stockId,
        batchId: stock.batchId,
        productId: stock.productId,
        productName: stock.productName,
        batchNumber: stock.batchNumber,
        usageType: stock.usageType
      });
      
      setSalonUseDeductionForm({
        stockId: stock.id || stock.stockId || '',
        productId: stock.productId || '',
        productName: stock.productName || stock.product?.name || 'Unknown Product',
        batchId: stock.batchId || stock.id || '',
        batchNumber: stock.batchNumber || 'N/A',
        currentStock: currentStock.toString(),
        quantity: '',
        reason: '',
        notes: ''
      });
      
      console.log('🔍 Form data set:', {
        stockId: stock.id || stock.stockId || '',
        productId: stock.productId || '',
        batchId: stock.batchId || stock.id || '',
        batchNumber: stock.batchNumber || 'N/A',
        currentStock: currentStock.toString()
      });
      
      setSalonUseDeductionErrors({});
      setIsSalonUseDeductionModalOpen(true);
      console.log('✅ Modal should be open now');
    } catch (error) {
      console.error('❌ Error in handleDeductSalonUse:', error);
      toast.error('Failed to open deduction modal. Please try again.');
    }
  };

  // Handle view stock history
  const handleViewHistory = (stock) => {
    setSelectedProductId(stock.productId);
    setIsHistoryModalOpen(true);
  };

  // Handle edit stock - REMOVED: No longer using week stocks

  // Handle force adjust stock (focus on batch)
  
  // Verify manager code by checking ANY branch manager's role password in the branch
  const verifyManagerCode = async (code, branchId) => {
    try {
      if (!branchId || !code) {
        return false;
      }

      // Get ALL branch managers for this branch
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('branchId', '==', branchId),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.error('No active users found for branch:', branchId);
        return false;
      }

      // Check each user to see if they are a branch manager and verify their role password
      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Check if user is a branch manager (check both role and roles array)
        const isBranchManager = userData.role === USER_ROLES.BRANCH_MANAGER || 
                                (userData.roles && userData.roles.includes(USER_ROLES.BRANCH_MANAGER));
        
        if (isBranchManager) {
          // Verify using this branch manager's role password
          const isValid = await verifyRolePassword(userId, USER_ROLES.BRANCH_MANAGER, code);
          
          if (isValid === true) {
            return { valid: true, managerId: userId, managerName: userData.displayName || userData.name || userData.email };
          }
          
          if (isValid === null) {
            // No role password set - fallback to Firebase Auth for backward compatibility
            if (userData.email) {
              try {
                const userCredential = await signInWithEmailAndPassword(auth, userData.email, code);
                if (userCredential.user) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                  await signOut(auth);
                  return { valid: true, managerId: userId, managerName: userData.displayName || userData.name || userData.email };
                }
              } catch (authError) {
                // Continue to next manager
                continue;
              }
            }
          }
        }
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Error verifying manager code:', error);
      return { valid: false };
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'High Stock': return 'text-blue-600 bg-blue-100';
      case 'In Stock': return 'text-green-600 bg-green-100';
      case 'Low Stock': return 'text-yellow-600 bg-yellow-100';
      case 'Out of Stock': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'High Stock': return <TrendingUp className="h-4 w-4" />;
      case 'In Stock': return <CheckCircle className="h-4 w-4" />;
      case 'Low Stock': return <AlertTriangle className="h-4 w-4" />;
      case 'Out of Stock': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };// Print/Report function for PDF generation
  const handlePrintDeductionHistory = () => {
    // Get filtered deductions
    const filteredDeductions = stockDeductions.filter(deduction => {
      if (!deductionSearchTerm) return true;
      const search = deductionSearchTerm.toLowerCase();
      return (
        deduction.productName?.toLowerCase().includes(search) ||
        deduction.clientName?.toLowerCase().includes(search) ||
        deduction.transactionId?.toLowerCase().includes(search) ||
        deduction.movementId?.toLowerCase().includes(search) ||
        deduction.transferId?.toLowerCase().includes(search) ||
        deduction.toBranchName?.toLowerCase().includes(search) ||
        deduction.notes?.toLowerCase().includes(search)
      );
    });

    if (!filteredDeductions.length) {
      toast.error('No deductions to print');
      return;
    }

    // Get branch name
    const branchName = userData?.branchName || 'N/A';
    const currentDate = format(new Date(), 'MMMM dd, yyyy');
    const currentTime = format(new Date(), 'hh:mm a');

    // Get date range label
    let dateRangeLabel = 'All Time';
    if (deductionDateFilter === '7days') dateRangeLabel = 'Last 7 Days';
    else if (deductionDateFilter === '30days') dateRangeLabel = 'Last 30 Days';
    else if (deductionDateFilter === '90days') dateRangeLabel = 'Last 90 Days';

    // Calculate totals
    const totalQuantity = filteredDeductions.reduce((sum, d) => sum + (d.quantity || 0), 0);
    const totalAmount = filteredDeductions.reduce((sum, d) => sum + (d.total || 0), 0);

    // Create printable HTML
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Deduction History - ${branchName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

            @media print {
              @page {
                margin: 1cm;
                size: A4 landscape;
              }
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
              .no-print { display: none; }
            }

            * {
              box-sizing: border-box;
            }

            body {
              font-family: 'Poppins', sans-serif;
              padding: 20px;
              color: #333;
              line-height: 1.5;
              background: white;
              margin: 0;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #160B53;
              padding-bottom: 20px;
              margin-bottom: 30px;
              background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
              padding: 20px;
              border-radius: 8px;
            }
            .header h1 {
              color: #160B53;
              margin: 0;
              font-size: 28px;
              font-weight: 700;
              font-family: 'Poppins', sans-serif;
              letter-spacing: -0.5px;
            }
            .header-info {
              display: flex;
              flex-direction: column;
              gap: 5px;
              font-size: 12px;
              color: #666;
              text-align: right;
            }
            .header-info div {
              font-weight: 500;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 30px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 8px;
              border: 1px solid #ccc;
            }
            .summary-box {
              text-align: center;
              padding: 15px;
              background: white;
              border-radius: 6px;
              border: 1px solid #999;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .summary-box h3 {
              margin: 0 0 10px 0;
              font-size: 12px;
              color: #666;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .summary-box .value {
              font-size: 24px;
              font-weight: 700;
              color: #160B53;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 11px;
              background: white;
            }
            thead {
              background: #160B53;
              color: white;
            }
            th {
              padding: 12px 8px;
              text-align: left;
              font-weight: 600;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
              border: 1px solid #0a0533;
            }
            td {
              padding: 10px 8px;
              border: 1px solid #ddd;
              vertical-align: top;
            }
            tbody tr:nth-child(even) {
              background: #f9f9f9;
            }
            tbody tr:hover {
              background: #f0f0f0;
            }
            .badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 9px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .badge-salon-use {
              background: #fed7aa;
              color: #9a3412;
            }
            .badge-transfer {
              background: #bfdbfe;
              color: #1e3a8a;
            }
            .badge-service {
              background: #e9d5ff;
              color: #6b21a8;
            }
            .badge-transaction {
              background: #d1fae5;
              color: #065f46;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .font-mono {
              font-family: 'Courier New', monospace;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #ddd;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Stock Deduction History</h1>
              <div style="margin-top: 10px; font-size: 14px; color: #666;">
                <div><strong>Branch:</strong> ${branchName}</div>
                <div><strong>Date Range:</strong> ${dateRangeLabel}</div>
                ${deductionSearchTerm ? `<div><strong>Search:</strong> "${deductionSearchTerm}"</div>` : ''}
              </div>
            </div>
            <div class="header-info">
              <div>Generated: ${currentDate}</div>
              <div>Time: ${currentTime}</div>
              <div>Total Records: ${filteredDeductions.length}</div>
            </div>
          </div>

          <div class="summary">
            <div class="summary-box">
              <h3>Total Deductions</h3>
              <div class="value">${filteredDeductions.length}</div>
            </div>
            <div class="summary-box">
              <h3>Total Quantity</h3>
              <div class="value">${totalQuantity.toLocaleString()}</div>
            </div>
            <div class="summary-box">
              <h3>Total Amount</h3>
              <div class="value">₱${totalAmount.toLocaleString()}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th class="text-center">Quantity</th>
                <th>Source / Reason</th>
                <th>Reference ID</th>
                <th class="text-right">Amount</th>
                <th>Processed By</th>
              </tr>
            </thead>
            <tbody>
              ${filteredDeductions.map(deduction => {
                const dateStr = format(deduction.createdAt, 'MMM dd, yyyy');
                const timeStr = format(deduction.createdAt, 'hh:mm a');
                
                // Determine source badge
                let sourceBadge = '';
                let sourceText = deduction.clientName || 'N/A';
                
                if (deduction.source === 'salon-use') {
                  sourceBadge = '<span class="badge badge-salon-use">Salon Use</span>';
                  sourceText = deduction.reason || deduction.clientName || 'Salon Use Deduction';
                  if (deduction.notes) {
                    sourceText += `<br><small style="color: #666; font-size: 9px;">${deduction.notes}</small>`;
                  }
                } else if (deduction.source === 'transfer' || deduction.source === 'stock_transfer') {
                  sourceBadge = '<span class="badge badge-transfer">Transfer</span>';
                } else if (deduction.source === 'service') {
                  sourceBadge = '<span class="badge badge-service">Service</span>';
                } else if (deduction.source === 'transaction') {
                  sourceBadge = '<span class="badge badge-transaction">Sale</span>';
                }
                
                const refId = deduction.transactionId 
                  ? `#${deduction.transactionId.slice(-8)}` 
                  : deduction.movementId 
                    ? `#${deduction.movementId.slice(-8)}` 
                    : deduction.transferId 
                      ? `#${deduction.transferId.slice(-8)}` 
                      : 'N/A';
                
                const batchInfo = deduction.batchDeductions && deduction.batchDeductions.length > 0
                  ? `<br><small style="color: #666; font-size: 9px;">Batches: ${deduction.batchDeductions.map(b => b.batchNumber || b.batchId).join(', ')}</small>`
                  : '';
                
                return `
                  <tr>
                    <td>
                      <div>${dateStr}</div>
                      <div style="font-size: 9px; color: #666;">${timeStr}</div>
                    </td>
                    <td><strong>${deduction.productName || 'Unknown Product'}</strong></td>
                    <td class="text-center"><strong style="color: #dc2626;">-${deduction.quantity || 0}</strong></td>
                    <td>
                      ${sourceBadge}
                      <div style="margin-top: 4px;">${sourceText}</div>
                    </td>
                    <td class="font-mono">
                      ${refId}
                      ${batchInfo}
                    </td>
                    <td class="text-right">
                      ${deduction.total > 0 ? `₱${deduction.total.toLocaleString()}` : 'N/A'}
                    </td>
                    <td>${deduction.createdBy || 'System'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This report was generated from the Stock Management System</p>
            <p>Branch: ${branchName} | Date Range: ${dateRangeLabel} | Generated on ${currentDate} at ${currentTime}</p>
          </div>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      toast.error('Please allow popups to print the report');
    }
  };

  const handlePrintReport = async () => {
    if (!filteredStocks.length) {
      toast.error('No stocks to print');
      return;
    }

    // Get branch name if not available in userData
    let branchName = userData?.branchName || 'N/A';
    if (branchName === 'N/A' && userData?.branchId) {
      try {
        const { getBranchById } = await import('../../services/branchService');
        const branch = await getBranchById(userData.branchId);
        branchName = branch?.name || branch?.branchName || 'N/A';
      } catch (error) {
        console.error('Error fetching branch name:', error);
        branchName = 'N/A';
      }
    }

    // Build filters display
    const activeFilters = [];
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    if (selectedStatus !== 'all') activeFilters.push(`Status: ${selectedStatus}`);
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Stocks';

    // Create standardized print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Inventory Report - ${branchName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 landscape;
              margin: 0.4in;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: 'Poppins', Arial, sans-serif;
            }
            body {
              font-family: 'Poppins', Arial, sans-serif;
              padding: 10px;
              color: #000;
              font-size: 9px;
            }
            .header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 2px solid #333;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .header h1 {
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 4px 0;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .header h2 {
              font-size: 16px;
              font-weight: 600;
              margin: 0;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .filters {
              background: #fff;
              padding: 10px;
              border: 2px solid #333;
              margin: 10px 0;
              text-align: center;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .filters-title {
              font-size: 10px;
              font-weight: 700;
              margin-bottom: 5px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .filters-content {
              font-size: 9px;
              font-weight: 600;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 15px;
              padding: 10px;
              background: #fff;
              border: 1px solid #333;
            }
            .stat-box {
              text-align: center;
              padding: 10px;
              background: #fff;
              border: 1px solid #333;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .stat-value {
              font-size: 18px;
              font-weight: 700;
              color: #000;
              margin-bottom: 3px;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .stat-label {
              font-size: 9px;
              color: #000;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 600;
              font-family: 'Poppins', Arial, sans-serif;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 9px;
              border: 1px solid #333;
              font-family: 'Poppins', Arial, sans-serif;
            }
            th, td {
              border: 1px solid #333;
              padding: 6px 4px;
              text-align: left;
              vertical-align: top;
              font-family: 'Poppins', Arial, sans-serif;
            }
            th {
              background-color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
              font-family: 'Poppins', Arial, sans-serif;
            }
            tr:nth-child(even) {
              background-color: #fff;
            }
            tr:nth-child(odd) {
              background-color: #fff;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .footer {
              margin-top: 12px;
              padding-top: 10px;
              border-top: 2px solid #333;
              font-size: 8px;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .footer-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 10px;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .footer-left {
              text-align: left;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .footer-right {
              text-align: right;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .footer-center {
              text-align: center;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #ccc;
              color: #666;
              font-family: 'Poppins', Arial, sans-serif;
            }
            .footer-center p {
              margin: 3px 0;
              font-family: 'Poppins', Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Stock Inventory Report - ${branchName}</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>

          <div class="stats">
            <div class="stat-box">
              <div class="stat-value">${stockStats.totalItems}</div>
              <div class="stat-label">Total Items</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stockStats.inStock}</div>
              <div class="stat-label">In Stock</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stockStats.lowStock}</div>
              <div class="stat-label">Low Stock</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${stockStats.outOfStock}</div>
              <div class="stat-label">Out of Stock</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Batch</th>
                <th>UPC</th>
                <th>Usage Type</th>
                <th class="text-center">Beginning</th>
                <th class="text-center">Current</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStocks.map(stock => {
                const product = stock.product || {};
                const currentStock = getComputedStock(stock);
                const status = calculateStockStatus(stock);
                const usageType = stock.usageType || product.usageType || 'otc';
                const usageTypeDisplay = usageType === 'salon-use' ? 'Salon Use' : 'OTC';
                return `
                  <tr>
                    <td style="font-weight: 600;">${stock.productName || product.name || 'N/A'}</td>
                    <td>${stock.brand || product.brand || 'N/A'}</td>
                    <td>${stock.category || product.category || 'N/A'}</td>
                    <td style="font-family: monospace; font-size: 8px;">${stock.batchNumber || 'N/A'}</td>
                    <td style="font-family: monospace; font-size: 8px;">${stock.upc || product.upc || 'N/A'}</td>
                    <td style="font-size: 8px;">${usageTypeDisplay}</td>
                    <td class="text-center" style="font-weight: 600;">${stock.beginningStock || 0}</td>
                    <td class="text-center" style="font-weight: 700;">${currentStock}</td>
                    <td>${status}</td>
                    <td>${stock.expirationDate ? format(new Date(stock.expirationDate), 'MMM dd, yyyy') : 'N/A'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.name || 'Inventory Controller'}<br>
                <strong>Position:</strong> Inventory Controller<br>
                <strong>Branch:</strong> ${branchName}
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
                <strong>Time:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div class="footer-center">
              <p style="font-weight: 600; font-size: 9px;">Stock Inventory Report - ${filteredStocks.length} Items Total</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Calculate stock statistics (memoized for performance)
  const stockStats = useMemo(() => {
    // Count items by status - "High Stock" and "In Stock" both count as "In Stock" for summary
    const inStockCount = currentMonthStocks.filter(s => 
      s.status === 'In Stock' || s.status === 'High Stock'
    ).length;
    const lowStockCount = currentMonthStocks.filter(s => s.status === 'Low Stock').length;
    const outOfStockCount = currentMonthStocks.filter(s => s.status === 'Out of Stock').length;
    
    // Total items should be the count of loaded stocks (currentMonthStocks)
    // since totalItems from Firestore might include inactive/old stocks
    const totalItemsCount = currentMonthStocks.length;
    
    return {
      totalItems: totalItemsCount,
      loadedItems: currentMonthStocks.length,
      inStock: inStockCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      totalValue: currentMonthStocks.reduce((sum, s) => {
        const currentStock = getComputedStock(s);
        // Check stock's unitCost first, then fall back to product's unitCost
        const unitCost = s.unitCost || s.product?.unitCost || 0;
        return sum + (currentStock * unitCost);
      }, 0),
      lowStockItems: currentMonthStocks.filter(s => {
        const currentStock = getComputedStock(s);
        return currentStock <= (s.minStock || 0);
      })
    };
  }, [currentMonthStocks]);


  // Load activity logs for a product
  const loadActivityLogs = async (productId, stockId) => {
    if (!productId) return;
    
    try {
      setLoadingActivityLogs(true);
      const { getActivityLogs } = await import('../../services/activityService');
      
      let startDate = null;
      let endDate = null;
      
      if (historyDateFilter === 'custom') {
        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) {
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        }
      } else if (historyDateFilter !== 'all') {
        const now = new Date();
        endDate = now;
        if (historyDateFilter === '7days') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (historyDateFilter === '30days') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (historyDateFilter === '90days') {
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        } else if (historyDateFilter === '1year') {
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        }
      }
      
      const allLogs = [];
      
      // 1. Load from activity service
      try {
        const logs = await getActivityLogs({
          branchId: userData?.branchId,
          limit: 100
        });
        
        // Filter by product/stock and date
        const filteredLogs = logs.filter(log => {
          const details = log.details || {};
          if (details.entityId !== stockId && details.entityId !== productId) return false;
          if (startDate && log.timestamp && new Date(log.timestamp) < startDate) return false;
          if (endDate && log.timestamp && new Date(log.timestamp) > endDate) return false;
          return true;
        });
        
        allLogs.push(...filteredLogs);
      } catch (error) {
        console.error('Error loading activity logs:', error);
      }
      
      // 2. Load transfers from inventory_movements for this product
      try {
        const movementsRef = collection(db, 'inventory_movements');
        // Query without productId filter first to avoid index issues, then filter client-side
        let movementsQuery = query(
          movementsRef,
          where('branchId', '==', userData?.branchId),
          where('type', '==', 'stock_out'),
          orderBy('createdAt', 'desc'),
          limit(500) // Get more to filter client-side
        );
        
        const movementsSnapshot = await getDocs(movementsQuery);
        movementsSnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Filter by productId client-side
          if (data.productId !== productId) return;
          
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          
          // Filter by date if needed
          if (startDate && createdAt < startDate) return;
          if (endDate && createdAt > endDate) return;
          
          // Check if it's a transfer
          if (data.reason === 'Stock Transfer' || data.notes?.includes('Transfer')) {
            const transferMatch = data.notes?.match(/Transfer to (.+)/) || 
                                 data.notes?.match(/Transfer from (.+)/);
            const transferInfo = transferMatch ? transferMatch[1] : 'Another Branch';
            
            allLogs.push({
              id: doc.id,
              action: 'transfer',
              entity: 'stock',
              entityId: productId,
              timestamp: createdAt,
              user: data.createdBy || 'System',
              details: {
                type: 'stock_transfer',
                productId: data.productId,
                productName: data.productName,
                quantity: data.quantity,
                reason: `Stock Transfer - ${transferInfo}`,
                notes: data.notes,
                batchDeductions: data.batchDeductions || []
              }
            });
          }
        });
      } catch (error) {
        console.error('Error loading transfer movements:', error);
        // If query fails, try without orderBy
        try {
          const movementsRef = collection(db, 'inventory_movements');
          const movementsQuery = query(
            movementsRef,
            where('branchId', '==', userData?.branchId),
            where('type', '==', 'stock_out'),
            limit(500)
          );
          
          const movementsSnapshot = await getDocs(movementsQuery);
          movementsSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.productId !== productId) return;
            if (data.reason === 'Stock Transfer' || data.notes?.includes('Transfer')) {
              const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
              if (startDate && createdAt < startDate) return;
              if (endDate && createdAt > endDate) return;
              
              const transferMatch = data.notes?.match(/Transfer to (.+)/) || 
                                   data.notes?.match(/Transfer from (.+)/);
              const transferInfo = transferMatch ? transferMatch[1] : 'Another Branch';
              
              allLogs.push({
                id: doc.id,
                action: 'transfer',
                entity: 'stock',
                entityId: productId,
                timestamp: createdAt,
                user: data.createdBy || 'System',
                details: {
                  type: 'stock_transfer',
                  productId: data.productId,
                  productName: data.productName,
                  quantity: data.quantity,
                  reason: `Stock Transfer - ${transferInfo}`,
                  notes: data.notes,
                  batchDeductions: data.batchDeductions || []
                }
              });
            }
          });
        } catch (fallbackError) {
          console.error('Error loading transfer movements (fallback):', fallbackError);
        }
      }
      
      // 3. Load stock transfers from stock_transfer collection
      try {
        const transfersRef = collection(db, 'stock_transfer');
        // Get outgoing transfers (where this branch sent stock)
        const outgoingQuery = query(
          transfersRef,
          where('fromBranchId', '==', userData?.branchId),
          orderBy('transferDate', 'desc'),
          limit(100)
        );
        
        const outgoingSnapshot = await getDocs(outgoingQuery);
        outgoingSnapshot.forEach((doc) => {
          const data = doc.data();
          const transferDate = data.transferDate?.toDate ? data.transferDate.toDate() : new Date(data.transferDate);
          
          // Filter by date if needed
          if (startDate && transferDate < startDate) return;
          if (endDate && transferDate > endDate) return;
          
          // Check if this transfer includes the product
          const items = data.items || [];
          const productItem = items.find(item => item.productId === productId);
          
          if (productItem) {
            allLogs.push({
              id: `${doc.id}_transfer`,
              action: 'transfer',
              entity: 'stock',
              entityId: productId,
              timestamp: transferDate,
              user: data.createdBy || 'System',
              details: {
                type: 'stock_transfer',
                productId: productId,
                productName: productItem.productName,
                quantity: productItem.quantity,
                reason: `Stock Transfer to ${data.toBranchName || 'Another Branch'}`,
                notes: `Transfer ID: ${doc.id}`,
                transferId: doc.id,
                transferType: data.transferType || 'transfer',
                status: data.status
              }
            });
          }
        });
        
        // Get incoming transfers (where this branch received stock)
        const incomingQuery = query(
          transfersRef,
          where('toBranchId', '==', userData?.branchId),
          orderBy('transferDate', 'desc'),
          limit(100)
        );
        
        const incomingSnapshot = await getDocs(incomingQuery);
        incomingSnapshot.forEach((doc) => {
          const data = doc.data();
          const transferDate = data.transferDate?.toDate ? data.transferDate.toDate() : new Date(data.transferDate);
          
          // Filter by date if needed
          if (startDate && transferDate < startDate) return;
          if (endDate && transferDate > endDate) return;
          
          // Check if this transfer includes the product
          const items = data.items || [];
          const productItem = items.find(item => item.productId === productId);
          
          if (productItem) {
            allLogs.push({
              id: `${doc.id}_received`,
              action: 'receive',
              entity: 'stock',
              entityId: productId,
              timestamp: transferDate,
              user: data.receivedBy || data.createdBy || 'System',
              details: {
                type: 'stock_received',
                productId: productId,
                productName: productItem.productName,
                quantity: productItem.quantity,
                reason: `Stock Received from ${data.fromBranchName || 'Another Branch'}`,
                notes: `Transfer ID: ${doc.id}`,
                transferId: doc.id,
                transferType: data.transferType || 'transfer',
                status: data.status
              }
            });
          }
        });
      } catch (error) {
        console.error('Error loading stock transfers:', error);
      }

      // 4. Load Stock Adjustments (from stockAdjustments collection)
      try {
        const adjustmentsRef = collection(db, 'stockAdjustments');
        let adjustmentsQuery = query(
          adjustmentsRef,
          where('branchId', '==', userData?.branchId),
          orderBy('createdAt', 'desc'),
          limit(200) // Get recent adjustments
        );

        const adjustmentsSnapshot = await getDocs(adjustmentsQuery);
        adjustmentsSnapshot.forEach((doc) => {
          const data = doc.data();

          // Filter by productId client-side
          if (data.productId !== productId) return;

          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

          // Filter by date if needed
          if (startDate && createdAt < startDate) return;
          if (endDate && createdAt > endDate) return;

          allLogs.push({
            id: doc.id,
            action: 'adjust',
            entity: 'stock',
            entityId: productId,
            timestamp: createdAt,
            user: data.adjustedBy || 'System',
            details: {
              type: 'stock_adjustment',
              productId: data.productId,
              previousStock: data.previousStock,
              newStock: data.newStock,
              adjustmentQuantity: data.adjustmentQuantity,
              reason: data.reason || 'Stock Adjustment',
              notes: data.notes,
              managerCode: data.managerCode,
              adjustmentType: 'Force Adjustment'
            }
          });
        });
      } catch (error) {
        console.error('Error loading stock adjustments:', error);
      }

      // 5. Load transaction deductions (sales)
      try {
        const transactionsRef = collection(db, 'transactions');
        let transactionsQuery = query(
          transactionsRef,
          where('branchId', '==', userData?.branchId),
          where('status', '==', 'paid'),
          orderBy('createdAt', 'desc'),
          limit(200) // Get recent transactions
        );

        const transactionsSnapshot = await getDocs(transactionsQuery);
        transactionsSnapshot.forEach((doc) => {
          const transactionData = doc.data();
          const transactionId = doc.id;

          // Check if transaction has products
          const salesType = transactionData.salesType || '';
          if (salesType !== 'product' && salesType !== 'mixed') return;

          // Filter date if needed
          const createdAt = transactionData.createdAt?.toDate ?
            transactionData.createdAt.toDate() :
            new Date(transactionData.createdAt);

          if (startDate && createdAt < startDate) return;
          if (endDate && createdAt > endDate) return;

          // Check if transaction includes the product
          const items = transactionData.items || [];
          const productItems = items.filter(item => item.type === 'product');

          productItems.forEach((item) => {
            // Check if this item matches the product we're looking for
            if (item.id === productId) {
              allLogs.push({
                id: `${transactionId}_${item.id}`,
                action: 'sale',
                entity: 'stock',
                entityId: productId,
                timestamp: createdAt,
                user: transactionData.createdByName || transactionData.createdBy || 'System',
                details: {
                  type: 'sale',
                  productId: item.id,
                  productName: item.name,
                  quantity: item.quantity || 1,
                  reason: 'Product Sale',
                  notes: `Transaction ID: ${transactionId}`,
                  transactionId: transactionId,
                  unitPrice: item.price || 0,
                  totalAmount: (item.price || 0) * (item.quantity || 1),
                  clientName: transactionData.clientName || 'Walk-in',
                  batchDeductions: item.batchDeductions || []
                }
              });
            }
          });
        });
      } catch (error) {
        console.error('Error loading transaction deductions:', error);
      }
      
      // Sort all logs by timestamp (newest first)
      allLogs.sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const timeB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return timeB.getTime() - timeA.getTime();
      });
      
      setActivityLogs(allLogs);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  };

  // Load stock deduction history from transactions and inventory movements (transfers, etc.)
  const loadStockDeductions = async () => {
    if (!userData?.branchId) return;
    
    try {
      setLoadingDeductions(true);
      
      // Calculate date range
      let startDate = null;
      const now = new Date();
      const endDate = now;
      
      if (deductionDateFilter === '7days') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (deductionDateFilter === '30days') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (deductionDateFilter === '90days') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }
      
      const deductions = [];
      
      // 1. Load deductions from transactions (sales)
      try {
        const transactionsRef = collection(db, 'transactions');
        let transactionsQuery = query(
          transactionsRef,
          where('branchId', '==', userData.branchId),
          where('status', '==', 'paid'),
          orderBy('createdAt', 'desc'),
          limit(500) // Limit to recent transactions
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        transactionsSnapshot.forEach((doc) => {
          const transactionData = doc.data();
          const transactionId = doc.id;
          
          // Check if transaction has products
          const salesType = transactionData.salesType || '';
          if (salesType !== 'product' && salesType !== 'mixed') return;
          
          // Filter date if needed
          if (startDate) {
            const createdAt = transactionData.createdAt?.toDate ? 
              transactionData.createdAt.toDate() : 
              new Date(transactionData.createdAt);
            if (createdAt < startDate) return;
          }
          
          // Extract product items
          const items = transactionData.items || [];
          const productItems = items.filter(item => item.type === 'product');
          
          productItems.forEach((item) => {
            deductions.push({
              id: `${transactionId}_${item.id}`,
              transactionId: transactionId,
              productId: item.id,
              productName: item.name,
              quantity: item.quantity || 1,
              price: item.price || 0,
              total: (item.price || 0) * (item.quantity || 1),
              clientName: transactionData.clientName || 'Walk-in',
              createdAt: transactionData.createdAt?.toDate ? 
                transactionData.createdAt.toDate() : 
                new Date(transactionData.createdAt),
              createdBy: transactionData.createdByName || transactionData.createdBy || 'Unknown',
              branchName: transactionData.branchName || '',
              paymentMethod: transactionData.paymentMethod || 'cash',
              source: 'transaction'
            });
          });
        });
      } catch (error) {
        console.error('Error loading transaction deductions:', error);
      }
      
      // 2. Load deductions from inventory_movements (transfers, adjustments, etc.)
      try {
        const movementsRef = collection(db, 'inventory_movements');
        let movementsQuery = query(
          movementsRef,
          where('branchId', '==', userData.branchId),
          where('type', '==', 'stock_out'),
          orderBy('createdAt', 'desc'),
          limit(500) // Limit to recent movements
        );
        
        const movementsSnapshot = await getDocs(movementsQuery);
        
        movementsSnapshot.forEach((doc) => {
          const movementData = doc.data();
          const movementId = doc.id;
          
          // Filter date if needed
          if (startDate) {
            const createdAt = movementData.createdAt?.toDate ? 
              movementData.createdAt.toDate() : 
              new Date(movementData.createdAt);
            if (createdAt < startDate) return;
          }
          
          // Determine source type from reason/notes
          let sourceType = 'adjustment';
          let displayReason = movementData.reason || 'Stock Deduction';
          
          // Check for salon-use deductions (manual deductions)
          const notes = (movementData.notes || '').toLowerCase();
          const reason = (movementData.reason || '').toLowerCase();
          
          if (notes.includes('salon-use') || notes.includes('salon use') || 
              notes.includes('manual salon') || notes.includes('bulk deduction') ||
              reason.includes('salon-use') || reason.includes('salon use')) {
            sourceType = 'salon-use';
            displayReason = movementData.reason || 'Salon Use Deduction';
          } else if (movementData.reason === 'Stock Transfer' || movementData.notes?.includes('Transfer')) {
            sourceType = 'transfer';
            // Extract transfer info from notes
            const transferMatch = movementData.notes?.match(/Transfer to (.+)/) || 
                                 movementData.notes?.match(/Transfer from (.+)/);
            if (transferMatch) {
              displayReason = `Stock Transfer - ${transferMatch[1]}`;
            } else {
              displayReason = 'Stock Transfer';
            }
          } else if (movementData.reason === 'Service Use' || movementData.notes?.includes('Service')) {
            sourceType = 'service';
            displayReason = 'Service Use';
          }
          
          deductions.push({
            id: movementId,
            movementId: movementId,
            productId: movementData.productId,
            productName: movementData.productName || 'Unknown Product',
            quantity: movementData.quantity || 0,
            price: 0, // Movements don't have price
            total: 0,
            clientName: displayReason,
            createdAt: movementData.createdAt?.toDate ? 
              movementData.createdAt.toDate() : 
              new Date(movementData.createdAt),
            createdBy: movementData.createdBy || 'System',
            branchName: userData.branchName || '',
            paymentMethod: 'N/A',
            source: sourceType,
            reason: movementData.reason || displayReason,
            notes: movementData.notes || '',
            batchDeductions: movementData.batchDeductions || []
          });
        });
      } catch (error) {
        console.error('Error loading inventory movement deductions:', error);
      }

      // 3. Load deductions from stock_transfer collection (outgoing transfers)
      try {
        const transfersRef = collection(db, 'stock_transfer');
        const outgoingQuery = query(
          transfersRef,
          where('fromBranchId', '==', userData.branchId),
          orderBy('transferDate', 'desc'),
          limit(500)
        );
        
        const outgoingSnapshot = await getDocs(outgoingQuery);
        
        outgoingSnapshot.forEach((doc) => {
          const transferData = doc.data();
          const transferId = doc.id;
          
          // Filter date if needed
          if (startDate) {
            const transferDate = transferData.transferDate?.toDate ? 
              transferData.transferDate.toDate() : 
              new Date(transferData.transferDate);
            if (transferDate < startDate) return;
          }
          
          // Extract transfer items
          const items = transferData.items || [];
          
          items.forEach((item) => {
            deductions.push({
              id: `${transferId}_${item.productId}`,
              transferId: transferId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity || 0,
              price: item.unitCost || 0,
              total: (item.unitCost || 0) * (item.quantity || 0),
              clientName: `Transfer to ${transferData.toBranchName || 'Another Branch'}`,
              createdAt: transferData.transferDate?.toDate ? 
                transferData.transferDate.toDate() : 
                new Date(transferData.transferDate),
              createdBy: transferData.createdByName || transferData.createdBy || 'Unknown',
              branchName: userData.branchName || '',
              paymentMethod: 'Transfer',
              source: 'stock_transfer',
              status: transferData.status || 'Pending',
              toBranchName: transferData.toBranchName,
              toBranchId: transferData.toBranchId,
              reason: transferData.reason || 'Stock Transfer',
              notes: transferData.notes || '',
              batchDeductions: item.batches || []
            });
          });
        });
      } catch (error) {
        console.error('Error loading stock transfer deductions:', error);
      }
      
      // Sort by date (newest first)
      deductions.sort((a, b) => b.createdAt - a.createdAt);
      
      setStockDeductions(deductions);
    } catch (error) {
      console.error('Error loading stock deductions:', error);
      setStockDeductions([]);
    } finally {
      setLoadingDeductions(false);
    }
  };

  // Load deductions when showing history or date filter changes
  useEffect(() => {
    if (showDeductionHistory) {
      loadStockDeductions();
    }
  }, [showDeductionHistory, deductionDateFilter, userData?.branchId]);

  // Load stock adjustments history (includes: Force Adjustments, Transactions, Stock Transfers)
  const loadStockAdjustments = async () => {
    if (!userData?.branchId) return;
    
    try {
      setLoadingAdjustments(true);
      setAdjustmentsPage(1); // Reset to first page
      const allAdjustments = [];
      
      // Use custom date range if provided
      let startTimestamp = null;
      let endTimestamp = null;
      
      if (adjustmentStartDate) {
        const start = new Date(adjustmentStartDate);
        start.setHours(0, 0, 0, 0);
        startTimestamp = Timestamp.fromDate(start);
      }
      
      if (adjustmentEndDate) {
        const end = new Date(adjustmentEndDate);
        end.setHours(23, 59, 59, 999);
        endTimestamp = Timestamp.fromDate(end);
      }

      // 1. Load Force Adjustments (from stockAdjustments collection)
      try {
        const adjustmentsRef = collection(db, 'stockAdjustments');
        let adjustmentsSnapshot;
        
        try {
          // Try with orderBy first (requires composite index)
          let adjustmentsQuery = query(
            adjustmentsRef,
            where('branchId', '==', userData.branchId),
            orderBy('createdAt', 'desc')
          );
          if (startTimestamp) {
            adjustmentsQuery = query(adjustmentsQuery, where('createdAt', '>=', startTimestamp));
          }
          adjustmentsSnapshot = await getDocs(adjustmentsQuery);
        } catch (indexError) {
          // Fallback: query without orderBy and sort client-side
          console.warn('Index missing for stockAdjustments, using client-side sort:', indexError.message);
          const fallbackQuery = query(
            adjustmentsRef,
            where('branchId', '==', userData.branchId)
          );
          adjustmentsSnapshot = await getDocs(fallbackQuery);
        }
        
        const forceAdjustments = [];
        adjustmentsSnapshot.forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                           data.createdAt instanceof Date ? data.createdAt :
                           data.createdAt ? new Date(data.createdAt) : new Date();
          
          // Apply date filter if using fallback
          if (startTimestamp && createdAt < startDate) {
            return; // Skip if before start date
          }
          
          forceAdjustments.push({
            id: doc.id,
            type: 'force_adjustment',
            adjustmentType: 'Force Adjustment',
            productId: data.productId,
            previousStock: data.previousStock,
            newStock: data.newStock,
            adjustmentQuantity: data.adjustmentQuantity,
            reason: data.reason,
            notes: data.notes,
            adjustedBy: data.adjustedBy,
            managerCode: data.managerCode,
            createdAt: createdAt,
          });
        });
        
        // Sort by createdAt descending (in case we used fallback)
        forceAdjustments.sort((a, b) => b.createdAt - a.createdAt);
        allAdjustments.push(...forceAdjustments);
      } catch (error) {
        console.error('Error loading force adjustments:', error);
      }

      // 2. Load Transactions (from inventory_movements collection - stock_out type)
      try {
        const movementsRef = collection(db, 'inventory_movements');
        let movementsQuery = query(
          movementsRef,
          where('branchId', '==', userData.branchId),
          where('type', '==', 'stock_out'),
          orderBy('createdAt', 'desc')
        );
        if (startTimestamp) {
          movementsQuery = query(movementsQuery, where('createdAt', '>=', startTimestamp));
        }
        const movementsSnapshot = await getDocs(movementsQuery);
        movementsSnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Determine if this is a salon-use deduction or transaction sale
          const reason = data.reason || '';
          const isSalonUse = reason.toLowerCase().includes('salon') || 
                            reason.toLowerCase().includes('salon-use') ||
                            reason.toLowerCase().includes('salon use');
          
          allAdjustments.push({
            id: doc.id,
            type: isSalonUse ? 'salon_use' : 'transaction',
            adjustmentType: isSalonUse ? 'Salon Use Deduction' : 'Transaction Sale',
            productId: data.productId,
            previousStock: null, // Transactions don't track previous stock
            newStock: null,
            adjustmentQuantity: -data.quantity, // Negative for deductions
            reason: data.reason || (isSalonUse ? 'Salon Use' : 'Transaction Sale'),
            notes: data.notes || (data.transactionId ? `Transaction: ${data.transactionId}` : ''),
            adjustedBy: data.createdBy,
            transactionId: data.transactionId,
            batchesUsed: data.batchDeductions,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt instanceof Date ? data.createdAt :
                       data.createdAt ? new Date(data.createdAt) : new Date(),
          });
        });
      } catch (error) {
        console.error('Error loading transactions:', error);
      }

      // 3. Load Stock Transfers (from stock_transfer collection)
      try {
        const transfersRef = collection(db, 'stock_transfer');
        // Get transfers where this branch is sender (outgoing) or receiver (incoming)
        const outgoingQuery = query(
          transfersRef,
          where('fromBranchId', '==', userData.branchId),
          orderBy('transferDate', 'desc')
        );
        const incomingQuery = query(
          transfersRef,
          where('toBranchId', '==', userData.branchId),
          orderBy('transferDate', 'desc')
        );
        
        const [outgoingSnapshot, incomingSnapshot] = await Promise.all([
          getDocs(outgoingQuery),
          getDocs(incomingQuery)
        ]);

        // Process outgoing transfers (deductions from this branch)
        outgoingSnapshot.forEach((doc) => {
          const data = doc.data();
          if (startTimestamp && data.transferDate?.toDate && data.transferDate.toDate() < startTimestamp.toDate()) {
            return; // Skip if before start date
          }
          data.items?.forEach((item) => {
            allAdjustments.push({
              id: `${doc.id}-${item.productId}`,
              type: 'transfer_out',
              adjustmentType: `Transfer Out → ${data.toBranchName || 'Other Branch'}`,
              productId: item.productId,
              previousStock: null,
              newStock: null,
              adjustmentQuantity: -item.quantity, // Negative for outgoing
              reason: 'Stock Transfer',
              notes: `Transfer ID: ${data.transferId || doc.id} | Batches: ${item.batches?.map(b => b.batchNumber).join(', ') || 'N/A'}`,
              adjustedBy: data.createdBy,
              transferId: data.transferId || doc.id,
              batchesUsed: item.batches,
              createdAt: data.transferDate?.toDate ? data.transferDate.toDate() : 
                         data.createdAt?.toDate ? data.createdAt.toDate() :
                         data.createdAt instanceof Date ? data.createdAt :
                         data.createdAt ? new Date(data.createdAt) : new Date(),
            });
          });
        });

        // Process incoming transfers (additions to this branch)
        incomingSnapshot.forEach((doc) => {
          const data = doc.data();
          if (startTimestamp && data.transferDate?.toDate && data.transferDate.toDate() < startTimestamp.toDate()) {
            return; // Skip if before start date
          }
          if (data.status === 'completed' || data.status === 'received') {
            data.items?.forEach((item) => {
              allAdjustments.push({
                id: `${doc.id}-${item.productId}-in`,
                type: 'transfer_in',
                adjustmentType: `Transfer In ← ${data.fromBranchName || 'Other Branch'}`,
                productId: item.productId,
                previousStock: null,
                newStock: null,
                adjustmentQuantity: item.quantity, // Positive for incoming
                reason: 'Stock Transfer Received',
                notes: `Transfer ID: ${data.transferId || doc.id} | Received: ${data.receivedAt ? format(data.receivedAt.toDate ? data.receivedAt.toDate() : new Date(data.receivedAt), 'MMM dd, yyyy') : 'N/A'}`,
                adjustedBy: data.receivedBy || data.createdBy,
                transferId: data.transferId || doc.id,
                batchesReceived: item.batches,
                createdAt: data.receivedAt?.toDate ? data.receivedAt.toDate() : 
                           data.transferDate?.toDate ? data.transferDate.toDate() :
                           data.createdAt?.toDate ? data.createdAt.toDate() :
                           data.createdAt instanceof Date ? data.createdAt :
                           data.createdAt ? new Date(data.createdAt) : new Date(),
              });
            });
          }
        });
      } catch (error) {
        console.error('Error loading stock transfers:', error);
      }

      // Sort all adjustments by date (newest first)
      allAdjustments.sort((a, b) => b.createdAt - a.createdAt);

      // Get product names for each adjustment
      const adjustmentsWithProducts = allAdjustments.map((adj) => {
        const product = products.find(p => p.id === adj.productId);
        return {
          ...adj,
          productName: product?.name || 'Unknown Product',
          productSku: product?.sku || product?.upc || 'N/A'
        };
      });

      // Filter by search term if provided
      const filtered = adjustmentSearchTerm
        ? adjustmentsWithProducts.filter(adj =>
            adj.productName.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
            adj.adjustmentType?.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
            adj.reason?.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
            adj.notes?.toLowerCase().includes(adjustmentSearchTerm.toLowerCase())
          )
        : adjustmentsWithProducts;

      setStockAdjustments(filtered);
    } catch (error) {
      console.error('Error loading stock adjustments:', error);
      setStockAdjustments([]);
    } finally {
      setLoadingAdjustments(false);
    }
  };

  // Paginated adjustments
  const paginatedAdjustments = useMemo(() => {
    const startIndex = (adjustmentsPage - 1) * adjustmentsPerPage;
    const endIndex = startIndex + adjustmentsPerPage;
    return stockAdjustments.slice(startIndex, endIndex);
  }, [stockAdjustments, adjustmentsPage, adjustmentsPerPage]);

  // Print adjustments function
  const handlePrintAdjustments = () => {
    const branchName = userData?.branchName || 'Branch';
    const dateRange = adjustmentStartDate && adjustmentEndDate 
      ? `${format(new Date(adjustmentStartDate), 'MMM dd, yyyy')} - ${format(new Date(adjustmentEndDate), 'MMM dd, yyyy')}`
      : 'All Time';
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Adjustments History - ${branchName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #160B53; margin-bottom: 5px; }
            .subtitle { color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
            th { background-color: #160B53; color: white; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .positive { color: green; font-weight: bold; }
            .negative { color: red; font-weight: bold; }
            .print-date { text-align: right; color: #666; font-size: 12px; margin-bottom: 10px; }
            @media print {
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="print-date">Printed: ${format(new Date(), 'MMM dd, yyyy hh:mm a')}</div>
          <h1>Stock Adjustments History</h1>
          <div class="subtitle">${branchName} | ${dateRange}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 12%;">Date & Time</th>
                <th style="width: 12%;">Type</th>
                <th style="width: 20%;">Product</th>
                <th style="width: 8%;">Previous</th>
                <th style="width: 8%;">New</th>
                <th style="width: 8%;">Adjustment</th>
                <th style="width: 18%;">Reason</th>
                <th style="width: 14%;">Adjusted By</th>
              </tr>
            </thead>
            <tbody>
              ${stockAdjustments.map(adj => `
                <tr>
                  <td>${format(adj.createdAt, 'MMM dd, yyyy')}<br/><small>${format(adj.createdAt, 'hh:mm a')}</small></td>
                  <td>${adj.adjustmentType || 'Adjustment'}</td>
                  <td><strong>${adj.productName}</strong><br/><small>SKU: ${adj.productSku}</small></td>
                  <td style="text-align: center;"><strong>${adj.previousStock !== null && adj.previousStock !== undefined && adj.previousStock !== '-' ? adj.previousStock : '-'}</strong></td>
                  <td style="text-align: center;"><strong>${adj.newStock !== null && adj.newStock !== undefined && adj.newStock !== '-' ? adj.newStock : '-'}</strong></td>
                  <td style="text-align: center;" class="${(adj.adjustmentQuantity || 0) >= 0 ? 'positive' : 'negative'}">
                    <strong>${(adj.adjustmentQuantity || 0) >= 0 ? '+' : ''}${adj.adjustmentQuantity || 0}</strong>
                  </td>
                  <td>${adj.reason || 'N/A'}</td>
                  <td>${adj.adjustedBy || 'Unknown'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Load adjustments when showing history or filters change
  useEffect(() => {
    if (showAdjustmentsHistory) {
      loadStockAdjustments();
    }
  }, [showAdjustmentsHistory, adjustmentStartDate, adjustmentEndDate, userData?.branchId, products, adjustmentSearchTerm]);

  // Load activity logs when history modal opens
  useEffect(() => {
    if (isHistoryModalOpen && selectedProductId) {
      loadActivityLogs(selectedProductId, null);
    }
  }, [isHistoryModalOpen, selectedProductId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading stock data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Stock Data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadData} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">Stock Management</h1>
          <p className="text-xs md:text-sm text-gray-600">Track inventory levels and stock movements</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3 lg:gap-4">
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Total Items</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stockStats.totalItems}</p>
                {stockStats.totalItems > stockStats.loadedItems && (
                  <p className="text-xs text-gray-500">({stockStats.loadedItems} loaded)</p>
                )}
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">In Stock</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stockStats.inStock}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-yellow-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Low Stock</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stockStats.lowStock}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <XCircle className="h-6 w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Out of Stock</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{stockStats.outOfStock}</p>
              </div>
            </div>
          </Card>

          <Card className="p-2 md:p-3 lg:p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center">
              <Banknote className="h-6 w-6 md:h-8 md:w-8 text-purple-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Total Value</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">₱{stockStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Stock Adjustments History */}
        {showAdjustmentsHistory && (
          <Card className="p-3 md:p-4 lg:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6">
              <div>
                <h2 className="text-base md:text-lg lg:text-xl font-bold text-gray-900">Stock Adjustments History</h2>
                <p className="text-gray-600 text-xs md:text-sm mt-1 hidden md:block">View all stock movements: Force Adjustments, Transactions (Sales), and Stock Transfers</p>
              </div>
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                {/* Custom Date Range */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={adjustmentStartDate}
                    onChange={(e) => setAdjustmentStartDate(e.target.value)}
                    className="text-xs md:text-sm w-36"
                    placeholder="Start Date"
                  />
                  <span className="text-gray-500">to</span>
                  <Input
                    type="date"
                    value={adjustmentEndDate}
                    onChange={(e) => setAdjustmentEndDate(e.target.value)}
                    className="text-xs md:text-sm w-36"
                    placeholder="End Date"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadStockAdjustments}
                  disabled={loadingAdjustments}
                  className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                >
                  <RefreshCw className={`h-3.5 w-3.5 md:h-4 md:w-4 ${loadingAdjustments ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintAdjustments}
                  className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                >
                  <Printer className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-3 md:mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by product name, reason, or notes..."
                  value={adjustmentSearchTerm}
                  onChange={(e) => setAdjustmentSearchTerm(e.target.value)}
                  className="pl-10 w-full text-sm"
                />
              </div>
            </div>

            {/* Adjustments Table */}
            {loadingAdjustments ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
                <span className="ml-2 text-gray-600">Loading adjustments history...</span>
              </div>
            ) : stockAdjustments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No stock adjustments found for the selected period</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Previous Stock
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          New Stock
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Adjustment
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Reason / Details
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Adjusted By
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedAdjustments.map((adjustment) => {
                        const typeColors = {
                          'force_adjustment': 'bg-orange-100 text-orange-800 border-orange-200',
                          'transaction': 'bg-blue-100 text-blue-800 border-blue-200',
                          'salon_use': 'bg-teal-100 text-teal-800 border-teal-200',
                          'transfer_out': 'bg-purple-100 text-purple-800 border-purple-200',
                          'transfer_in': 'bg-green-100 text-green-800 border-green-200'
                        };
                        const typeIcons = {
                          'force_adjustment': <AlertTriangle className="h-3 w-3" />,
                          'transaction': <ShoppingCart className="h-3 w-3" />,
                          'salon_use': <Package className="h-3 w-3" />,
                          'transfer_out': <ArrowRight className="h-3 w-3" />,
                          'transfer_in': <ArrowRightLeft className="h-3 w-3" />
                        };
                        
                        return (
                          <tr key={adjustment.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {format(adjustment.createdAt, 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(adjustment.createdAt, 'hh:mm a')}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${typeColors[adjustment.type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                {typeIcons[adjustment.type]}
                                {adjustment.adjustmentType || 'Adjustment'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">
                                {adjustment.productName}
                              </div>
                              <div className="text-xs text-gray-500">
                                SKU: {adjustment.productSku}
                              </div>
                              {adjustment.batchesUsed && adjustment.batchesUsed.length > 0 && (
                                <div className="text-xs text-blue-600 mt-1">
                                  Batches: {adjustment.batchesUsed.map(b => b.batchNumber || b.batchId).slice(0, 2).join(', ')}
                                  {adjustment.batchesUsed.length > 2 && ` +${adjustment.batchesUsed.length - 2} more`}
                                </div>
                              )}
                              {adjustment.batchesReceived && adjustment.batchesReceived.length > 0 && (
                                <div className="text-xs text-green-600 mt-1">
                                  Received Batches: {adjustment.batchesReceived.map(b => b.batchNumber || b.batchId).slice(0, 2).join(', ')}
                                  {adjustment.batchesReceived.length > 2 && ` +${adjustment.batchesReceived.length - 2} more`}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm text-gray-900 font-medium">
                                {adjustment.previousStock !== null && adjustment.previousStock !== undefined ? adjustment.previousStock : '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm text-gray-900 font-medium">
                                {adjustment.newStock !== null && adjustment.newStock !== undefined ? adjustment.newStock : '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                (adjustment.adjustmentQuantity || 0) >= 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {(adjustment.adjustmentQuantity || 0) >= 0 ? '+' : ''}{adjustment.adjustmentQuantity || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900 max-w-xs" title={adjustment.reason || adjustment.notes}>
                                <div className="font-medium">{adjustment.reason || 'N/A'}</div>
                                {adjustment.notes && (
                                  <div className="text-xs text-gray-600 mt-1 truncate">{adjustment.notes}</div>
                                )}
                                {adjustment.transferId && (
                                  <div className="text-xs text-gray-500 mt-1">ID: {adjustment.transferId.slice(-8)}</div>
                                )}
                                {adjustment.transactionId && (
                                  <div className="text-xs text-gray-500 mt-1">Txn: {adjustment.transactionId.slice(-8)}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-600">
                                {adjustment.adjustedBy || 'Unknown'}
                              </div>
                              {adjustment.managerCode && (
                                <div className="text-xs text-gray-500">
                                  Code: {adjustment.managerCode}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {stockAdjustments.length > adjustmentsPerPage && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      Showing {((adjustmentsPage - 1) * adjustmentsPerPage) + 1} to {Math.min(adjustmentsPage * adjustmentsPerPage, stockAdjustments.length)} of {stockAdjustments.length} adjustments
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdjustmentsPage(prev => Math.max(1, prev - 1))}
                        disabled={adjustmentsPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {adjustmentsPage} of {Math.ceil(stockAdjustments.length / adjustmentsPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdjustmentsPage(prev => Math.min(Math.ceil(stockAdjustments.length / adjustmentsPerPage), prev + 1))}
                        disabled={adjustmentsPage >= Math.ceil(stockAdjustments.length / adjustmentsPerPage)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* Stock Deduction History */}
        {showDeductionHistory && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stock Deduction History</h2>
                <p className="text-gray-600 text-sm mt-1">View all stock deductions from transactions, transfers, and services</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={deductionDateFilter}
                  onChange={(e) => setDeductionDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadStockDeductions}
                  disabled={loadingDeductions}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingDeductions ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintDeductionHistory}
                  disabled={loadingDeductions || stockDeductions.length === 0}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by product name, client name, or transaction ID..."
                  value={deductionSearchTerm}
                  onChange={(e) => setDeductionSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {/* Deductions Table */}
            {loadingDeductions ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading deduction history...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Source / Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Reference ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Processed By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockDeductions
                      .filter(deduction => {
                        if (!deductionSearchTerm) return true;
                        const search = deductionSearchTerm.toLowerCase();
                        return (
                          deduction.productName?.toLowerCase().includes(search) ||
                          deduction.clientName?.toLowerCase().includes(search) ||
                          deduction.transactionId?.toLowerCase().includes(search) ||
                          deduction.movementId?.toLowerCase().includes(search) ||
                          deduction.transferId?.toLowerCase().includes(search) ||
                          deduction.toBranchName?.toLowerCase().includes(search) ||
                          deduction.notes?.toLowerCase().includes(search)
                        );
                      })
                      .map((deduction) => (
                        <tr key={deduction.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {format(deduction.createdAt, 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(deduction.createdAt, 'hh:mm a')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {deduction.productName}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              -{deduction.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {deduction.source === 'salon-use' ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  Salon Use
                                </span>
                                <div className="flex flex-col">
                                  <span className="text-sm text-gray-700">{deduction.clientName}</span>
                                  {deduction.notes && (
                                    <span className="text-xs text-gray-500 mt-0.5">{deduction.notes}</span>
                                  )}
                                </div>
                              </div>
                            ) : deduction.source === 'transfer' ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Transfer
                                </span>
                                <span className="text-sm text-gray-700">{deduction.clientName}</span>
                              </div>
                            ) : deduction.source === 'stock_transfer' ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Transfer
                                </span>
                                <span className="text-sm text-gray-700">{deduction.clientName}</span>
                              </div>
                            ) : deduction.source === 'service' ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Service
                                </span>
                                <span className="text-sm text-gray-700">{deduction.clientName}</span>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-900">{deduction.clientName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600 font-mono">
                              {deduction.transactionId ? `#${deduction.transactionId.slice(-8)}` : 
                               deduction.movementId ? `#${deduction.movementId.slice(-8)}` :
                               deduction.transferId ? `#${deduction.transferId.slice(-8)}` : 'N/A'}
                            </div>
                            {deduction.batchDeductions && deduction.batchDeductions.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Batches: {deduction.batchDeductions.map(b => b.batchNumber || b.batchId).join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {deduction.total > 0 ? `₱${deduction.total.toLocaleString()}` : 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">{deduction.createdBy}</div>
                          </td>
                        </tr>
                      ))}
                    {stockDeductions.filter(deduction => {
                      if (!deductionSearchTerm) return true;
                      const search = deductionSearchTerm.toLowerCase();
                      return (
                        deduction.productName?.toLowerCase().includes(search) ||
                        deduction.clientName?.toLowerCase().includes(search) ||
                        deduction.transactionId?.toLowerCase().includes(search)
                      );
                    }).length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p>No stock deductions found</p>
                          {deductionSearchTerm && (
                            <p className="text-sm mt-1">Try adjusting your search</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {!loadingDeductions && stockDeductions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Total Deductions: <span className="font-semibold text-gray-900">{stockDeductions.length}</span>
                  </span>
                  <span className="text-gray-600">
                    Total Quantity Deducted: <span className="font-semibold text-red-600">
                      -{stockDeductions.reduce((sum, d) => sum + d.quantity, 0)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Filter Row */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product, brand, or UPC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
              />
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
                (filters.status !== 'all' || filters.category !== 'all' || 
                 filters.stockRange.min || filters.stockRange.max || 
                 filters.lowStock || filters.usageType !== 'all' || filters.batchNumber || filters.condition !== 'all')
                  ? 'bg-[#160B53]/10 border-[#160B53]/30 text-[#160B53] hover:bg-[#160B53]/20'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
              title={`Filter - ${visibleStocks.length} stocks`}
            >
              <Filter className="w-5 h-5" />
              <span className="bg-[#160B53] text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                {visibleStocks.length}
              </span>
            </button>

            {/* Export Button */}
            <button
              onClick={handleExportStocks}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export Stocks Data"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrintReport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Print Report"
            >
              <Printer className="w-5 h-5 text-gray-600" />
            </button>

            {/* Show Deductions Button */}
            <button
              onClick={() => {
                setShowDeductionHistory(!showDeductionHistory);
                if (!showDeductionHistory) {
                  loadStockDeductions();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showDeductionHistory 
                  ? 'bg-blue-50 border-blue-300 text-blue-700' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
              title="Show Deduction History"
            >
              <Activity className="w-5 h-5" />
            </button>

            {/* Show Adjustments Button */}
            <button
              onClick={() => {
                setShowAdjustmentsHistory(!showAdjustmentsHistory);
                if (!showAdjustmentsHistory) {
                  loadStockAdjustments();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                showAdjustmentsHistory 
                  ? 'bg-orange-50 border-orange-300 text-orange-700' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
              title="Show Adjustments History"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>

            {/* Bulk Deduct Button */}
            <button
              onClick={() => {
                // Get all salon-use stocks
                const salonUseStocks = groupedStocks.filter(group => 
                  group.usageType === 'salon-use' || 
                  (group.batches && group.batches[0]?.usageType === 'salon-use')
                );
                
                // Initialize bulk deduction items
                const initialItems = salonUseStocks.map(group => {
                  const stock = group.batches[0];
                  const currentStock = getComputedStock(stock);
                  return {
                    stockId: stock.id || stock.stockId || '',
                    productId: stock.productId || group.productId || '',
                    productName: stock.productName || group.productName || stock.product?.name || 'Unknown Product',
                    batchId: stock.batchId || stock.id || '',
                    batchNumber: stock.batchNumber || group.batchNumber || 'N/A',
                    currentStock: currentStock,
                    quantity: ''
                  };
                });
                
                setBulkDeductionItems(initialItems);
                setBulkDeductionReason('');
                setBulkDeductionNotes('');
                setBulkDeductionErrors({});
                setIsBulkDeductionModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-blue-300 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              title="Bulk Deduct Salon Use Products"
            >
              <Minus className="w-5 h-5" />
              <span className="hidden sm:inline">Bulk Deduct</span>
            </button>
          </div>
        </div>

        {/* Stock Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 md:px-4 lg:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product / Batch
                  </th>
                  <th className="px-2 md:px-4 lg:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Beginning
                  </th>
                  <th className="px-2 md:px-4 lg:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current
                  </th>
                  <th className="px-2 md:px-4 lg:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Status
                  </th>
                  <th className="px-2 md:px-4 lg:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleStocks.map((groupData) => {
                const firstBatch = groupData.batches[0];
                const product = groupData.product;
                const productName = groupData.productName;
                const brand = groupData.brand;
                const upc = groupData.upc;
                const category = groupData.category;
                const isExpanded = expandedProducts.has(`${groupData.productId}_${groupData.usageType}`);
                const hasMultipleBatches = groupData.batches.length > 1 && !groupData.isNonBatch;
                
                // For non-batch stocks, render as before
                if (groupData.isNonBatch) {
                  const stock = firstBatch;
                  const currentStock = getComputedStock(stock);
                  const monthLabel = stock.startPeriod ? format(new Date(stock.startPeriod), 'MMMM yyyy') : 'Unknown';
                  
                  return (
                    <tr key={stock.id} className="hover:bg-gray-50">
                      <td className="px-2 md:px-4 lg:px-6 py-2 md:py-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                            <div className="text-xs md:text-sm font-medium text-gray-900 truncate">{productName}</div>
                            {stock.usageType && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                                stock.usageType === 'salon-use'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {stock.usageType === 'salon-use' ? 'Salon' : 'OTC'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{brand} • {upc}</div>
                          <div className="text-xs text-gray-400 hidden lg:block">{category}</div>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 lg:px-6 py-2 md:py-4 hidden lg:table-cell">
                        <div className="text-sm font-medium text-blue-900">{stock.beginningStock || 0}</div>
                        <div className="text-xs text-blue-600">Beginning</div>
                      </td>
                      <td className="px-2 md:px-4 lg:px-6 py-2 md:py-4">
                        <div className="text-xs md:text-sm font-medium text-gray-900">{currentStock}</div>
                        <div className="text-xs text-gray-500 hidden md:block">{monthLabel}</div>
                      </td>
                      <td className="px-2 md:px-4 lg:px-6 py-2 md:py-4 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs font-medium ${getStatusColor(stock.status || 'In Stock')}`}>
                          {getStatusIcon(stock.status || 'In Stock')}
                          <span className="hidden lg:inline">{stock.status || 'In Stock'}</span>
                        </span>
                      </td>
                      <td className="px-2 md:px-4 lg:px-6 py-2 md:py-4 text-sm font-medium">
                        <div className="flex gap-1 md:gap-2">
                          <button 
                            onClick={() => handleViewDetails(stock)} 
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleViewHistory(stock)} 
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors hidden md:block"
                            title="View history"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                          {(() => {
                            // Check if this is a salon-use product
                            const stockUsageType = stock.usageType || groupData?.usageType || '';
                            const isSalonUse = stockUsageType === 'salon-use';
                            
                            if (!isSalonUse) return null;
                            
                            return (
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('Deduct button clicked for stock:', stock);
                                  handleDeductSalonUse(stock);
                                }} 
                                className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                                title="Deduct salon use stock"
                                type="button"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                }
                
                // For batch stocks with grouping
                const firstBatchStock = getComputedStock(firstBatch);
                const firstBatchBeginningStock = firstBatch.beginningStock || 0;
                const firstBatchNumber = firstBatch.batchNumber || 'N/A';
                const firstBatchExpiration = firstBatch.expirationDate ? format(new Date(firstBatch.expirationDate), 'MMM dd, yyyy') : null;
                const firstBatchReceived = firstBatch.receivedDate ? format(new Date(firstBatch.receivedDate), 'MMM dd, yyyy') : null;
                
                return (
                  <React.Fragment key={`${groupData.productId}_${groupData.usageType}`}>
                      {/* Main row - First batch */}
                      <tr className="hover:bg-gray-50 bg-blue-50/30">
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-sm font-medium text-gray-900">{productName}</div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                Batch: {firstBatchNumber}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                groupData.usageType === 'salon-use'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-green-100 text-green-800 border border-green-200'
                              }`}>
                                {groupData.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                              </span>
                              {hasMultipleBatches && (
                                <button
                                  onClick={() => {
                                    const key = `${groupData.productId}_${groupData.usageType}`;
                                    setExpandedProducts(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(key)) {
                                        newSet.delete(key);
                                      } else {
                                        newSet.add(key);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 transition-colors"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Hide ({groupData.batches.length - 1})
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show ({groupData.batches.length - 1})
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">{brand} • {upc}</div>
                            <div className="text-xs text-gray-400 hidden md:block">
                              {category}
                              {firstBatchExpiration && (
                                <span className="ml-2 text-orange-600">• Expires: {firstBatchExpiration}</span>
                              )}
                            </div>
                            {firstBatchReceived && (
                              <div className="text-xs text-gray-400 hidden md:block">
                                Received: {firstBatchReceived}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                          <div className="text-sm font-medium text-blue-900">{firstBatchBeginningStock}</div>
                          <div className="text-xs text-blue-600">Beginning</div>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-sm font-medium text-green-600">{firstBatchStock}</div>
                              <div className="text-xs text-green-600">Current</div>
                            </div>
                            {hasMultipleBatches && (
                              <div className="ml-2 pl-2 border-l border-gray-300">
                                <div className="text-sm font-bold text-[#160B53]">{groupData.totalStock}</div>
                                <div className="text-xs text-gray-500">Total</div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(firstBatch.status || 'In Stock')}`}>
                            {getStatusIcon(firstBatch.status || 'In Stock')}
                            {firstBatch.status || 'In Stock'}
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleViewDetails(firstBatch)} 
                              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleViewHistory(firstBatch)} 
                              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              title="View history"
                            >
                              <Calendar className="h-4 w-4" />
                            </button>
                            {groupData.usageType === 'salon-use' && (
                              <button 
                                onClick={() => handleDeductSalonUse(firstBatch)} 
                                className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                                title="Deduct salon use stock"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded rows - Other batches */}
                      {isExpanded && hasMultipleBatches && groupData.batches.slice(1).map((batch, idx) => {
                        const batchStock = getComputedStock(batch);
                        const batchNumber = batch.batchNumber || 'N/A';
                        const batchExpiration = batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : null;
                        const batchReceived = batch.receivedDate ? format(new Date(batch.receivedDate), 'MMM dd, yyyy') : null;
                        
                        return (
                          <tr key={`${batch.id || batch.batchId}_${idx}`} className="hover:bg-gray-50 bg-blue-50/20">
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-start">
                                <div className="flex-shrink-0 w-8 md:w-12 flex items-center justify-center">
                                  <ArrowRight className="h-4 w-4 text-gray-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                      Batch: {batchNumber}
                                    </span>
                                  </div>
                                  {batchExpiration && (
                                    <div className="text-xs text-gray-400 hidden md:block mt-1">
                                      Expires: {batchExpiration}
                                    </div>
                                  )}
                                  {batchReceived && (
                                    <div className="text-xs text-gray-400 hidden md:block mt-1">
                                      Received: {batchReceived}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <div className="text-sm font-medium text-blue-900">{batch.beginningStock || 0}</div>
                              <div className="text-xs text-blue-600">Beginning</div>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{batchStock}</div>
                              <div className="text-xs text-gray-500">Current</div>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status || 'In Stock')}`}>
                                {getStatusIcon(batch.status || 'In Stock')}
                                {batch.status || 'In Stock'}
                              </span>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleViewDetails(batch)} 
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button 
                                  onClick={() => handleViewHistory(batch)} 
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="View history"
                                >
                                  <Calendar className="h-4 w-4" />
                                </button>
                                {groupData.usageType === 'salon-use' && (
                                  <button 
                                    onClick={() => handleDeductSalonUse(batch)} 
                                    className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                                    title="Deduct salon use stock"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="px-6 py-4 bg-gray-50 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Pagination Info */}
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{visibleStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(visibleEndIndex, groupedStocks.length)}</span> of{' '}
              <span className="font-medium">{groupedStocks.length}</span> filtered items
              {stockStats.totalItems > stockStats.loadedItems && (
                <span className="ml-2 text-blue-600">
                  ({stockStats.loadedItems} loaded, {totalItems} total in database)
                </span>
              )}
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newStart = Math.max(0, visibleStartIndex - 50);
                  setVisibleStartIndex(newStart);
                  setVisibleEndIndex(newStart + 50);
                }}
                disabled={visibleStartIndex === 0}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <span className="text-sm text-gray-600 px-3 min-w-[120px] text-center">
                Page {currentPageNumber} of {totalPages || 1}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newStart = Math.min(groupedStocks.length - 50, visibleStartIndex + 50);
                  setVisibleStartIndex(newStart);
                  setVisibleEndIndex(Math.min(newStart + 50, groupedStocks.length));
                }}
                disabled={visibleEndIndex >= groupedStocks.length}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Load More from Database Button */}
          {hasMore && groupedStocks.length > 0 && !loadingMore && (
            <div className="px-6 py-3 bg-blue-50 border-t flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreStocks}
                disabled={loadingMore}
                className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Package className="h-4 w-4" />
                Load More from Database ({totalItems - stocks.length} remaining)
              </Button>
            </div>
          )}
          
          {/* Loading More from Database Indicator */}
          {loadingMore && (
            <div className="px-6 py-3 bg-blue-50 border-t flex justify-center">
              <div className="flex items-center gap-2 text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading more items from database...</span>
              </div>
            </div>
          )}

          {/* Load More Visible Items (Virtual Scroll) */}
          {visibleEndIndex < groupedStocks.length && !loadingMore && (
            <div className="px-6 py-3 bg-gray-50 border-t flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMoreVisible}
                className="flex items-center gap-2"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Show More ({groupedStocks.length - visibleEndIndex} more items)
              </Button>
            </div>
          )}
        </Card>

        {/* Empty State */}
        {groupedStocks.length === 0 && !loading && (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Stock Items Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all' && f !== '')
                ? 'Try adjusting your search or filters'
                : 'Get started by adding stock items'
              }
            </p>
            {(userData?.role === 'systemAdmin' || userData?.role === 'operationalManager') ? (
              <Button 
                className="flex items-center gap-2 mx-auto"
                onClick={() => setIsCreateStockModalOpen(true)}
                title="Manual stock creation is restricted. All new stock should come from Purchase Orders."
              >
                <Plus className="h-4 w-4" />
                Add Stock Item (Admin Only)
              </Button>
            ) : (
              <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Stock must be created through Purchase Orders to maintain proper batch tracking.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Stock Details Modal */}
        {isDetailsModalOpen && selectedStock && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedStock(null);
            }}
            title="Stock Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Stock Header */}
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Package className="h-16 w-16 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedStock.productName || selectedStock.product?.name || 'Unknown Product'}
                      </h2>
                      {(selectedStock.stockType === 'batch' || selectedStock.batchId || selectedStock.batchNumber) && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                            Batch: {selectedStock.batchNumber || 'N/A'}
                          </span>
                          {selectedStock.purchaseOrderId && (
                            <span className="text-xs text-gray-500">
                              PO: {selectedStock.purchaseOrderId}
                            </span>
                          )}
                          {/* Usage Type Badge */}
                          {selectedStock.usageType && (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                              selectedStock.usageType === 'salon-use'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              {selectedStock.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Show usage type even for non-batch stocks */}
                      {(!selectedStock.stockType || selectedStock.stockType !== 'batch') && selectedStock.usageType && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                            selectedStock.usageType === 'salon-use'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {selectedStock.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedStock.status || 'In Stock')}`}>
                      {getStatusIcon(selectedStock.status || 'In Stock')}
                      {selectedStock.status || 'In Stock'}
                    </span>
                  </div>
                  <p className="text-lg text-gray-600 mb-2">
                    {selectedStock.brand || selectedStock.product?.brand || ''}
                  </p>
                  <p className="text-sm text-gray-500">
                    UPC: {selectedStock.upc || selectedStock.product?.upc || 'N/A'}
                  </p>
                  {(selectedStock.stockType === 'batch' || selectedStock.batchId) && selectedStock.expirationDate && (
                    <p className="text-sm text-orange-600 mt-1 font-medium">
                      Expiration: {format(new Date(selectedStock.expirationDate), 'MMM dd, yyyy')}
                    </p>
                  )}
                  {(selectedStock.stockType === 'batch' || selectedStock.batchId) && selectedStock.receivedDate && (
                    <p className="text-sm text-gray-500 mt-1">
                      Received: {format(new Date(selectedStock.receivedDate), 'MMM dd, yyyy')}
                    </p>
                  )}
                </div>
              </div>

              {/* Monthly Stock Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Monthly Stock Record</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-blue-700">Beginning Stock</label>
                    <p className="text-lg font-bold text-blue-900">{selectedStock.beginningStock || 0} units</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-blue-700">Current Stock</label>
                    <p className="text-lg font-bold text-green-600">{getComputedStock(selectedStock)} units</p>
                  </div>
                </div>
              </div>

              {/* Ending Stock Calculation */}
              {selectedStock.startPeriod && selectedStock.endPeriod && (() => {
                const endingStockInfo = calculateEndingStock(
                  selectedStock.productId,
                  new Date(selectedStock.startPeriod),
                  new Date(selectedStock.endPeriod)
                );
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-3">Ending Stock Calculation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-green-700">Next Month Beginning</label>
                        <p className="text-lg font-bold text-green-900">{endingStockInfo.endingStock} units</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-700">Deliveries This Month</label>
                        <p className="text-lg font-bold text-green-900">{endingStockInfo.deliveries} units</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-700">Calculated Ending Stock</label>
                        <p className="text-xl font-bold text-green-600">{endingStockInfo.calculatedEndingStock} units</p>
                        <p className="text-xs text-green-600 mt-1">(Next Month Beginning + Deliveries)</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Stock Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Branch</label>
                    <p className="text-gray-900">{branchName || 'Unknown Branch'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tracking Mode</label>
                    <p className="text-gray-900 capitalize">{selectedStock.weekTrackingMode || selectedStock.trackingMode || 'Manual'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Stock Mode</label>
                    <p className="text-gray-900 capitalize">{selectedStock.endStockMode || 'Manual'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created At</label>
                    <p className="text-gray-900">
                      {selectedStock.createdAt ? format(new Date(selectedStock.createdAt), 'MMM dd, yyyy HH:mm') : 'Not available'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Updated At</label>
                    <p className="text-gray-900">
                      {selectedStock.updatedAt ? format(new Date(selectedStock.updatedAt), 'MMM dd, yyyy HH:mm') : 'Not available'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
            </div>
          </Modal>
        )}


        {/* Stock History Modal */}
        {isHistoryModalOpen && selectedProductId && (() => {
          const historyStocks = getStockHistoryForProduct(selectedProductId);
          const selectedProduct = products.find(p => p.id === selectedProductId);
          const selectedStock = stocks.find(s => s.productId === selectedProductId);
          return (
            <Modal
              isOpen={isHistoryModalOpen}
              onClose={() => {
                setIsHistoryModalOpen(false);
                setSelectedProductId(null);
                setActivityLogs([]);
                setHistoryDateFilter('all');
              }}
              title={`Stock History & Activity Logs - ${selectedProduct?.name || 'Unknown Product'}`}
              size="xl"
            >
              <div className="space-y-6">
                {/* Date Filter */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                  <select
                    value={historyDateFilter}
                    onChange={(e) => {
                      setHistoryDateFilter(e.target.value);
                      if (e.target.value !== 'custom') {
                        loadActivityLogs(selectedProductId, selectedStock?.id);
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="90days">Last 90 Days</option>
                    <option value="1year">Last Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {historyDateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-3 py-2"
                      />
                      <span className="text-gray-500">to</span>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-3 py-2"
                      />
                      <Button
                        size="sm"
                        onClick={() => loadActivityLogs(selectedProductId, selectedStock?.id)}
                        className="flex items-center gap-2"
                      >
                        <Search className="h-4 w-4" />
                        Apply
                      </Button>
                    </div>
                  )}
                </div>

                {/* Stock History Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Batch History</h3>
                  {historyStocks.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No batch history found for this product</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Number</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beginning Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historyStocks.map((stock) => {
                            const hasStock = stock.currentStock > 0;
                            const displayStatus = hasStock ? 'In Stock' : 'Out of Stock';
                            const statusColor = hasStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                            return (
                              <tr key={stock.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 font-mono">{stock.batchNumber || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stock.beginningStock || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{stock.currentStock || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                    {displayStatus}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stock.receivedDateFormatted}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stock.expirationDateFormatted}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Activity Logs */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Activity Logs & Adjustments</h3>
                  {loadingActivityLogs ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-gray-600">Loading activity logs...</p>
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Activity className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No activity logs found for this period</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto p-4">
                      {activityLogs.map((log) => {
                        const actionColors = {
                          create: 'bg-green-100 text-green-800',
                          update: 'bg-blue-100 text-blue-800',
                          adjust: 'bg-orange-100 text-orange-800',
                          delete: 'bg-red-100 text-red-800',
                          transfer: 'bg-blue-100 text-blue-800',
                          receive: 'bg-green-100 text-green-800',
                          sale: 'bg-purple-100 text-purple-800'
                        };
                        const actionIcons = {
                          create: <Plus className="h-4 w-4" />,
                          update: <Edit className="h-4 w-4" />,
                          adjust: <AlertTriangle className="h-4 w-4" />,
                          delete: <XCircle className="h-4 w-4" />,
                          transfer: <ArrowRightLeft className="h-4 w-4" />,
                          receive: <Package className="h-4 w-4" />,
                          sale: <ShoppingCart className="h-4 w-4" />
                        };
                        
                        // Handle transfer logs
                        const isTransfer = log.details?.type === 'stock_transfer' || log.details?.type === 'stock_received';
                        const isSale = log.details?.type === 'sale';
                        const displayName = log.entityName || log.details?.productName || 'Stock';
                        const displayReason = log.reason || log.details?.reason || '';
                        const displayNotes = log.notes || log.details?.notes || '';
                        const displayQuantity = log.details?.quantity;
                        const displayUser = log.user || log.createdBy || 'System';
                        
                        return (
                          <div key={log.id} className="border-b border-gray-200 last:border-b-0 py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                                    {actionIcons[log.action] || <Activity className="h-4 w-4" />}
                                    {log.action ? log.action.toUpperCase() : 'ACTIVITY'}
                                  </span>
                                <span className="text-sm text-gray-900 font-medium">
                                    {format(log.timestamp || log.createdAt || new Date(), 'MMM dd, yyyy HH:mm')}
                                  </span>
                                {isSale && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                    Sale
                                    </span>
                                  )}
                                <span className="text-sm font-medium text-gray-900">{displayName}</span>
                                </div>
                              <div className="text-right">
                                {displayQuantity && (
                                  <div className="text-sm font-medium text-gray-900">
                                    {isSale ? '-' : ''}{displayQuantity}
                                      </div>
                                    )}
                                {isSale && log.details?.clientName && (
                                  <div className="text-xs text-gray-600">{log.details.clientName}</div>
                                    )}
                                  </div>
                                </div>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              {isSale && log.details?.transactionId && (
                <div>
                                  <span className="font-medium text-gray-500">Reference:</span>
                                  <span className="ml-1 text-gray-900">#{log.details.transactionId.slice(-8)}</span>
                    </div>
                              )}
                              {isSale && log.details?.totalAmount && (
                <div>
                                  <span className="font-medium text-gray-500">Amount:</span>
                                  <span className="ml-1 text-gray-900">₱{log.details.totalAmount.toLocaleString()}</span>
                </div>
                              )}
                              {isTransfer && log.details?.transferId && (
                <div>
                                  <span className="font-medium text-gray-500">Transfer ID:</span>
                                  <span className="ml-1 text-gray-900">#{log.details.transferId.slice(-8)}</span>
                    </div>
                              )}
                              {isTransfer && log.action === 'transfer' && log.details?.reason && (
                <div>
                                  <span className="font-medium text-gray-500">Destination:</span>
                                  <span className="ml-1 text-gray-900">{log.details.reason}</span>
                    </div>
                              )}
                              {isTransfer && log.action === 'receive' && log.details?.reason && (
                <div>
                                  <span className="font-medium text-gray-500">Source:</span>
                                  <span className="ml-1 text-gray-900">{log.details.reason}</span>
                    </div>
                              )}
                <div>
                                <span className="font-medium text-gray-500">Processed By:</span>
                                <span className="ml-1 text-gray-900">{displayUser}</span>
              </div>
                      <div>
                                <span className="font-medium text-gray-500">Branch:</span>
                                <span className="ml-1 text-gray-900">{branchName}</span>
                      </div>
                      </div>
                    </div>
                        );
                      })}
                  </div>
                </div>
              )}
                  </div>
                </div>
            </Modal>
          );
        })()}

        {/* Force Adjust Stock Modal - REMOVED: Now handled by Overall Inventory Controller */}
        {false && isForceAdjustModalOpen && (
          <Modal
            isOpen={isForceAdjustModalOpen}
            onClose={() => {
              setIsForceAdjustModalOpen(false);
              setForceAdjustForm({
                productId: '',
                stockId: '',
                currentStock: '',
                newStock: '',
                adjustmentQuantity: '',
                reason: '',
                managerCode: '',
                notes: ''
              });
              setForceAdjustErrors({});
            }}
            title="Force Adjust Stock"
            size="lg"
          >
            <div className="space-y-6">
              {/* Current Stock Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Current Stock Information</h4>
                <p className="text-sm text-blue-700">Current Stock: <strong className="text-blue-900">{forceAdjustForm.currentStock}</strong> units</p>
              </div>

              {/* New Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Stock Level <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter new stock quantity"
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
                  className={forceAdjustErrors.newStock ? 'border-red-500' : ''}
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
                  <option value="damage">Damage/Loss</option>
                  <option value="theft">Theft</option>
                  <option value="count_error">Counting Error</option>
                  <option value="restock">Restock/Correction</option>
                  <option value="expiry">Expired Items</option>
                  <option value="system_error">System Error</option>
                  <option value="manual_correction">Manual Correction</option>
                  <option value="other">Other</option>
                </select>
                {forceAdjustErrors.reason && (
                  <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.reason}</p>
                )}
              </div>

              {/* Manager Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Manager Authorization Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Enter branch manager code"
                    value={forceAdjustForm.managerCode}
                    onChange={(e) => {
                      setForceAdjustForm(prev => ({ ...prev, managerCode: e.target.value }));
                      setForceAdjustErrors(prev => ({ ...prev, managerCode: '' }));
                    }}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      forceAdjustErrors.managerCode ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Requires branch manager authorization code</p>
                {forceAdjustErrors.managerCode && (
                  <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.managerCode}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  rows="3"
                  placeholder="Enter any additional notes or details about this adjustment..."
                  value={forceAdjustForm.notes}
                  onChange={(e) => {
                    setForceAdjustForm(prev => ({ ...prev, notes: e.target.value }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Error Message */}
              {forceAdjustErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{forceAdjustErrors.general}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsForceAdjustModalOpen(false);
                    setForceAdjustForm({
                      productId: '',
                      stockId: '',
                      currentStock: '',
                      newStock: '',
                      adjustmentQuantity: '',
                      reason: '',
                      managerCode: '',
                      notes: ''
                    });
                    setForceAdjustErrors({});
                  }}
                  disabled={isSubmittingAdjust}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
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
                      return;
                    }
                    
                    // Verify manager code
                    try {
                      setIsSubmittingAdjust(true);
                      setForceAdjustErrors({});
                      
                      const verificationResult = await verifyManagerCode(forceAdjustForm.managerCode, userData?.branchId);
                      
                      if (!verificationResult.valid) {
                        setForceAdjustErrors({ managerCode: 'Invalid branch manager role password. Please contact a branch manager.' });
                        setIsSubmittingAdjust(false);
                        return;
                      }
                      
                      const verifiedManagerId = verificationResult.managerId;
                      const verifiedManagerName = verificationResult.managerName;
                      
                      // Get stock document reference
                      const stocksRef = collection(db, 'stocks');
                      const stockDocRef = doc(db, 'stocks', forceAdjustForm.stockId);
                      
                      // Create adjustment record in separate collection
                      const adjustmentData = {
                        stockId: forceAdjustForm.stockId,
                        productId: forceAdjustForm.productId,
                        productName: forceAdjustForm.productName || 'Unknown Product',
                        batchNumber: forceAdjustForm.batchNumber || '',
                        branchId: userData?.branchId,
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
                      
                      // Update the stock record's realTimeStock
                      await updateDoc(stockDocRef, {
                        realTimeStock: parseInt(forceAdjustForm.newStock),
                        updatedAt: serverTimestamp()
                      });
                      
                      // Get product name for logging
                      const stockDoc = await getDoc(stockDocRef);
                      const stockData = stockDoc.data();
                      const productName = stockData?.productName || 'Unknown Product';
                      
                      // Log activity with detailed information
                      await activityServiceLogActivity({
                        action: 'stock_force_adjustment',
                        performedBy: userData?.uid,
                        targetUser: null,
                        branchId: userData?.branchId,
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
                          authorizedBy: verifiedManagerId,
                          authorizedByName: verifiedManagerName
                        }
                      });
                      
                      // Reset form and close modal
                      setForceAdjustForm({
                        productId: '',
                        stockId: '',
                        batchNumber: '',
                        currentStock: '',
                        newStock: '',
                        adjustmentQuantity: '',
                        reason: '',
                        managerCode: '',
                        notes: ''
                      });
                      setIsForceAdjustModalOpen(false);
                      
                      // Reload data
                      await reloadStocks();
                      
                      alert('Stock adjusted successfully!');
                    } catch (error) {
                      console.error('Error adjusting stock:', error);
                      setForceAdjustErrors({ general: 'Failed to adjust stock. Please try again.' });
                    } finally {
                      setIsSubmittingAdjust(false);
                    }
                  }}
                  disabled={isSubmittingAdjust}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isSubmittingAdjust ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Force Adjust Stock
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Advanced Filters Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Filter Stocks"
            size="md"
          >
            <div className="space-y-6">
              {/* Results Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{visibleStocks.length}</span> of <span className="font-semibold text-gray-900">{groupedStocks.length}</span> stocks
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value="all">All Status</option>
                    <option value="High Stock">High Stock</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* Stock Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock Range</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      placeholder="Min Stock"
                      value={filters.stockRange.min}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        stockRange: { ...prev.stockRange, min: e.target.value }
                      }))}
                    />
                    <Input
                      type="number"
                      placeholder="Max Stock"
                      value={filters.stockRange.max}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        stockRange: { ...prev.stockRange, max: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                {/* Usage Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usage Type</label>
                  <select
                    value={filters.usageType}
                    onChange={(e) => setFilters(prev => ({ ...prev, usageType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value="all">All Usage Types</option>
                    <option value="otc">OTC Only</option>
                    <option value="salon-use">Salon Use Only</option>
                  </select>
                </div>

                {/* Stock Condition */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock Condition</label>
                  <select
                    value={filters.condition}
                    onChange={(e) => setFilters(prev => ({ ...prev, condition: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value="all">All Conditions</option>
                    <option value="good">Good (Active, Not Expired, Has Stock)</option>
                    <option value="expired">Expired</option>
                    <option value="depleted">Depleted (Zero Stock)</option>
                  </select>
                </div>

                {/* Batch Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
                  <Input
                    type="text"
                    placeholder="Filter by batch number"
                    value={filters.batchNumber}
                    onChange={(e) => setFilters(prev => ({ ...prev, batchNumber: e.target.value }))}
                    className="w-full"
                  />
                </div>

                {/* Low Stock Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="lowStock"
                    checked={filters.lowStock}
                    onChange={(e) => setFilters(prev => ({ ...prev, lowStock: e.target.checked }))}
                    className="h-4 w-4 text-[#160B53] focus:ring-[#160B53] border-gray-300 rounded"
                  />
                  <label htmlFor="lowStock" className="ml-2 block text-sm text-gray-900">
                    Show only low stock items
                  </label>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      status: 'all',
                      category: 'all',
                      stockRange: { min: '', max: '' },
                      lowStock: false,
                      usageType: 'all',
                      batchNumber: '',
                      condition: 'all'
                    });
                  }}
                >
                  Reset Filters
                </Button>
                <Button onClick={() => setIsFilterModalOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Manual Salon-Use Deduction Modal */}
        {isSalonUseDeductionModalOpen && (
          <Modal
            isOpen={isSalonUseDeductionModalOpen}
            onClose={() => {
              setIsSalonUseDeductionModalOpen(false);
              setSalonUseDeductionForm({
                stockId: '',
                productId: '',
                productName: '',
                batchId: '',
                batchNumber: '',
                currentStock: '',
                quantity: '',
                reason: '',
                notes: ''
              });
              setSalonUseDeductionErrors({});
            }}
            title="Deduct Salon Use Stock"
            size="md"
          >
            <div className="space-y-6">
              {/* Product Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">{salonUseDeductionForm.productName}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-700">Batch:</span>
                    <span className="ml-2 font-medium text-blue-900">{salonUseDeductionForm.batchNumber}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Current Stock:</span>
                    <span className="ml-2 font-medium text-blue-900">{salonUseDeductionForm.currentStock} units</span>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    Salon Use Only - Manual Counting Required
                  </span>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity to Deduct <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  max={salonUseDeductionForm.currentStock}
                  step="1"
                  placeholder="Enter quantity to deduct"
                  value={salonUseDeductionForm.quantity}
                  onChange={(e) => {
                    const qty = e.target.value;
                    setSalonUseDeductionForm(prev => ({ ...prev, quantity: qty }));
                    setSalonUseDeductionErrors(prev => ({ ...prev, quantity: '' }));
                  }}
                  className={salonUseDeductionErrors.quantity ? 'border-red-500' : ''}
                />
                {salonUseDeductionErrors.quantity && (
                  <p className="text-xs text-red-500 mt-1">{salonUseDeductionErrors.quantity}</p>
                )}
                {salonUseDeductionForm.quantity && parseInt(salonUseDeductionForm.quantity) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    New stock after deduction: <span className="font-medium text-gray-900">
                      {Math.max(0, parseInt(salonUseDeductionForm.currentStock) - parseInt(salonUseDeductionForm.quantity))} units
                    </span>
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Service: Haircut for Client X, or Manual count adjustment"
                  value={salonUseDeductionForm.reason}
                  onChange={(e) => {
                    setSalonUseDeductionForm(prev => ({ ...prev, reason: e.target.value }));
                    setSalonUseDeductionErrors(prev => ({ ...prev, reason: '' }));
                  }}
                  className={salonUseDeductionErrors.reason ? 'border-red-500' : ''}
                />
                {salonUseDeductionErrors.reason && (
                  <p className="text-xs text-red-500 mt-1">{salonUseDeductionErrors.reason}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Required for audit trail</p>
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional details about this deduction..."
                  value={salonUseDeductionForm.notes}
                  onChange={(e) => setSalonUseDeductionForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsSalonUseDeductionModalOpen(false);
                    setSalonUseDeductionForm({
                      stockId: '',
                      productId: '',
                      productName: '',
                      batchId: '',
                      batchNumber: '',
                      currentStock: '',
                      quantity: '',
                      reason: '',
                      notes: ''
                    });
                    setSalonUseDeductionErrors({});
                  }}
                  disabled={isSubmittingDeduction}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    // Validation
                    const errors = {};
                    
                    if (!salonUseDeductionForm.quantity || parseInt(salonUseDeductionForm.quantity) <= 0) {
                      errors.quantity = 'Quantity must be greater than 0';
                    } else if (parseInt(salonUseDeductionForm.quantity) > parseInt(salonUseDeductionForm.currentStock)) {
                      errors.quantity = `Cannot deduct more than current stock (${salonUseDeductionForm.currentStock} units)`;
                    }
                    
                    if (!salonUseDeductionForm.reason || salonUseDeductionForm.reason.trim() === '') {
                      errors.reason = 'Reason is required';
                    }
                    
                    if (Object.keys(errors).length > 0) {
                      setSalonUseDeductionErrors(errors);
                      return;
                    }
                    
                    try {
                      setIsSubmittingDeduction(true);
                      setSalonUseDeductionErrors({});
                      
                      // Deduct using inventoryService
                      console.log('🔍 Deduction data being sent:', {
                        branchId: userData?.branchId,
                        productId: salonUseDeductionForm.productId,
                        quantity: parseInt(salonUseDeductionForm.quantity),
                        usageType: 'salon-use',
                        batchId: salonUseDeductionForm.batchId,
                        batches: salonUseDeductionForm.batchId ? [{ batchId: salonUseDeductionForm.batchId }] : undefined
                      });
                      
                      const deductionResult = await inventoryService.deductStockFIFO({
                        branchId: userData?.branchId,
                        productId: salonUseDeductionForm.productId,
                        quantity: parseInt(salonUseDeductionForm.quantity),
                        reason: salonUseDeductionForm.reason,
                        notes: salonUseDeductionForm.notes || `Manual salon-use deduction. ${salonUseDeductionForm.reason}`,
                        createdBy: userData?.uid || 'system',
                        productName: salonUseDeductionForm.productName,
                        usageType: 'salon-use', // Only deduct from salon-use batches
                        batches: salonUseDeductionForm.batchId ? [{ batchId: salonUseDeductionForm.batchId }] : undefined
                      });
                      
                      console.log('🔍 Deduction result:', deductionResult);
                      
                      if (!deductionResult.success) {
                        console.error('❌ Deduction failed:', deductionResult.message);
                        setSalonUseDeductionErrors({ general: deductionResult.message || 'Failed to deduct stock. Please try again.' });
                        setIsSubmittingDeduction(false);
                        return;
                      }
                      
                      // Log activity
                      await activityServiceLogActivity({
                        action: 'salon_use_deduction',
                        performedBy: userData?.uid,
                        targetUser: null,
                        branchId: userData?.branchId,
                        details: {
                          stockId: salonUseDeductionForm.stockId,
                          productId: salonUseDeductionForm.productId,
                          productName: salonUseDeductionForm.productName,
                          batchNumber: salonUseDeductionForm.batchNumber,
                          quantity: parseInt(salonUseDeductionForm.quantity),
                          previousStock: parseInt(salonUseDeductionForm.currentStock),
                          newStock: parseInt(salonUseDeductionForm.currentStock) - parseInt(salonUseDeductionForm.quantity),
                          reason: salonUseDeductionForm.reason,
                          notes: salonUseDeductionForm.notes
                        }
                      });
                      
                      // Reset form and close modal
                      setSalonUseDeductionForm({
                        stockId: '',
                        productId: '',
                        productName: '',
                        batchId: '',
                        batchNumber: '',
                        currentStock: '',
                        quantity: '',
                        reason: '',
                        notes: ''
                      });
                      setIsSalonUseDeductionModalOpen(false);
                      
                      toast.success(`Successfully deducted ${salonUseDeductionForm.quantity} units from salon-use stock`);
                      
                      // Force reload stocks to show updated values
                      // Add delay to ensure Firestore has propagated the change
                      console.log('🔄 Reloading stocks after deduction...');
                      setTimeout(async () => {
                        setStocks([]); // Clear current stocks to force fresh load
                        setCurrentPage(1);
                        setLastVisible(null);
                        setHasMore(true);
                        await loadData(); // Use loadData instead of reloadStocks to ensure fresh fetch
                        console.log('✅ Stocks reloaded');
                      }, 1000); // 1000ms delay to ensure Firestore propagation
                    } catch (error) {
                      console.error('Error deducting salon-use stock:', error);
                      setSalonUseDeductionErrors({ general: 'Failed to deduct stock. Please try again.' });
                    } finally {
                      setIsSubmittingDeduction(false);
                    }
                  }}
                  disabled={isSubmittingDeduction}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmittingDeduction ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Minus className="h-4 w-4 mr-2" />
                      Deduct Stock
                    </>
                  )}
                </Button>
              </div>
              
              {salonUseDeductionErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{salonUseDeductionErrors.general}</p>
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* Bulk Salon-Use Deduction Modal */}
        {isBulkDeductionModalOpen && (
          <Modal
            isOpen={isBulkDeductionModalOpen}
            onClose={() => {
              setIsBulkDeductionModalOpen(false);
              setBulkDeductionItems([]);
              setBulkDeductionReason('');
              setBulkDeductionNotes('');
              setBulkDeductionErrors({});
            }}
            title="Bulk Deduct Salon Use Products"
            size="xl"
          >
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Bulk Deduction for Salon Use Products</h4>
                    <p className="text-sm text-blue-700">
                      Enter quantities to deduct for each product. All deductions will be processed together with a single reason.
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason (Required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for All Deductions <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Weekly usage for week of Jan 1-7, 2026"
                  value={bulkDeductionReason}
                  onChange={(e) => {
                    setBulkDeductionReason(e.target.value);
                    setBulkDeductionErrors(prev => ({ ...prev, reason: '' }));
                  }}
                  className={bulkDeductionErrors.reason ? 'border-red-500' : ''}
                />
                {bulkDeductionErrors.reason && (
                  <p className="text-xs text-red-500 mt-1">{bulkDeductionErrors.reason}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">This reason will apply to all deductions</p>
              </div>

              {/* Products List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Products to Deduct ({bulkDeductionItems.filter(item => item.quantity && parseInt(item.quantity) > 0).length} selected)
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Batch
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Current Stock
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity to Deduct
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          New Stock
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bulkDeductionItems.map((item, index) => {
                        const quantity = parseInt(item.quantity) || 0;
                        const newStock = Math.max(0, item.currentStock - quantity);
                        const hasError = quantity > item.currentStock;
                        
                        return (
                          <tr key={index} className={hasError ? 'bg-red-50' : 'hover:bg-gray-50'}>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-600">{item.batchNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">{item.currentStock} units</div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                max={item.currentStock}
                                step="1"
                                placeholder="0"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...bulkDeductionItems];
                                  newItems[index].quantity = e.target.value;
                                  setBulkDeductionItems(newItems);
                                }}
                                className={`w-24 ${hasError ? 'border-red-500' : ''}`}
                              />
                              {hasError && (
                                <p className="text-xs text-red-500 mt-1">Exceeds stock</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className={`text-sm font-medium ${hasError ? 'text-red-600' : 'text-gray-900'}`}>
                                {newStock} units
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {bulkDeductionItems.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                            <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p>No salon-use products found</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              {bulkDeductionItems.filter(item => item.quantity && parseInt(item.quantity) > 0).length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Products to Deduct:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {bulkDeductionItems.filter(item => item.quantity && parseInt(item.quantity) > 0).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Quantity:</span>
                      <span className="ml-2 font-medium text-red-600">
                        -{bulkDeductionItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)} units
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional details about this bulk deduction..."
                  value={bulkDeductionNotes}
                  onChange={(e) => setBulkDeductionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsBulkDeductionModalOpen(false);
                    setBulkDeductionItems([]);
                    setBulkDeductionReason('');
                    setBulkDeductionNotes('');
                    setBulkDeductionErrors({});
                  }}
                  disabled={isSubmittingBulkDeduction}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    // Validation
                    const errors = {};
                    
                    if (!bulkDeductionReason || bulkDeductionReason.trim() === '') {
                      errors.reason = 'Reason is required';
                    }
                    
                    const itemsToDeduct = bulkDeductionItems.filter(item => 
                      item.quantity && parseInt(item.quantity) > 0
                    );
                    
                    if (itemsToDeduct.length === 0) {
                      errors.general = 'Please enter at least one quantity to deduct';
                    }
                    
                    // Check for quantity errors
                    const hasQuantityErrors = itemsToDeduct.some(item => 
                      parseInt(item.quantity) > item.currentStock
                    );
                    
                    if (hasQuantityErrors) {
                      errors.general = 'Some quantities exceed available stock. Please adjust.';
                    }
                    
                    if (Object.keys(errors).length > 0) {
                      setBulkDeductionErrors(errors);
                      return;
                    }
                    
                    try {
                      setIsSubmittingBulkDeduction(true);
                      setBulkDeductionErrors({});
                      
                      // Process all deductions
                      const deductionPromises = itemsToDeduct.map(async (item) => {
                        const deductionResult = await inventoryService.deductStockFIFO({
                          branchId: userData?.branchId,
                          productId: item.productId,
                          quantity: parseInt(item.quantity),
                          reason: bulkDeductionReason,
                          notes: bulkDeductionNotes || `Bulk deduction: ${bulkDeductionReason}`,
                          createdBy: userData?.uid || 'system',
                          productName: item.productName,
                          usageType: 'salon-use',
                          batches: item.batchId ? [{ batchId: item.batchId }] : undefined
                        });
                        
                        if (!deductionResult.success) {
                          throw new Error(`${item.productName}: ${deductionResult.message}`);
                        }
                        
                        // Log activity
                        await activityServiceLogActivity({
                          action: 'salon_use_deduction',
                          performedBy: userData?.uid,
                          targetUser: null,
                          branchId: userData?.branchId,
                          details: {
                            stockId: item.stockId,
                            productId: item.productId,
                            productName: item.productName,
                            batchNumber: item.batchNumber,
                            quantity: parseInt(item.quantity),
                            previousStock: item.currentStock,
                            newStock: item.currentStock - parseInt(item.quantity),
                            reason: bulkDeductionReason,
                            notes: bulkDeductionNotes,
                            isBulkDeduction: true
                          }
                        });
                        
                        return { success: true, productName: item.productName, quantity: parseInt(item.quantity) };
                      });
                      
                      const results = await Promise.all(deductionPromises);
                      
                      // Reset form and close modal
                      setBulkDeductionItems([]);
                      setBulkDeductionReason('');
                      setBulkDeductionNotes('');
                      setIsBulkDeductionModalOpen(false);
                      
                      // Reload stocks
                      await reloadStocks();
                      
                      const totalQuantity = results.reduce((sum, r) => sum + r.quantity, 0);
                      toast.success(`Successfully deducted ${totalQuantity} units from ${results.length} salon-use product(s)`);
                    } catch (error) {
                      console.error('Error in bulk deduction:', error);
                      setBulkDeductionErrors({ general: error.message || 'Failed to process bulk deduction. Please try again.' });
                    } finally {
                      setIsSubmittingBulkDeduction(false);
                    }
                  }}
                  disabled={isSubmittingBulkDeduction}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmittingBulkDeduction ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Minus className="h-4 w-4 mr-2" />
                      Deduct All ({bulkDeductionItems.filter(item => item.quantity && parseInt(item.quantity) > 0).length} items)
                    </>
                  )}
                </Button>
              </div>
              
              {bulkDeductionErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{bulkDeductionErrors.general}</p>
                </div>
              )}
              {bulkDeductionErrors.reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{bulkDeductionErrors.reason}</p>
                </div>
              )}
            </div>
          </Modal>
        )}

      </div>
    </>
  );
};

export default Stocks;