import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  ShoppingCart,
  Search,
  Eye,
  Plus,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  Package,
  Building,
  FileText,
  Truck,
  ArrowRight,
  Trash2,
  X,
  Loader2,
  Home,
  TrendingUp,
  ArrowRightLeft,
  QrCode,
  Calendar,
  BarChart3,
  ClipboardList,
  UserCog,
  PackageCheck,
  Mail,
  Phone,
  Filter,
  Printer,
  Edit,
  Minus,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { inventoryService } from '../../services/inventoryService';
import toast from 'react-hot-toast';
import { exportToExcel } from '../../utils/excelExport';
import { sendEmail } from '../../services/emailService';

// Debounce hook for search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const PurchaseOrders = () => {
  const { userData } = useAuth();

  

  // Data states
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branchProducts, setBranchProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedReceivedStatus, setSelectedReceivedStatus] = useState('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryExpirationDates, setDeliveryExpirationDates] = useState({}); // { productId: expirationDate }
  const [isMarkingDelivered, setIsMarkingDelivered] = useState(false);
  const [isConfirmOrderModalOpen, setIsConfirmOrderModalOpen] = useState(false);
  const [isHighStockWarningModalOpen, setIsHighStockWarningModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [createdOrderDetails, setCreatedOrderDetails] = useState(null);
  const [pendingProduct, setPendingProduct] = useState(null); // Product waiting for confirmation
  const [pendingCurrentStock, setPendingCurrentStock] = useState(0);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  
  // Email states
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailOrder, setEmailOrder] = useState(null);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailPdfUrl, setEmailPdfUrl] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Big data optimizations
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300);
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const productsPerPage = 20; // Pagination for products

  // Form states - Step 1: Select Supplier
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [showProductSelection, setShowProductSelection] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');

  // Form states - Step 2: Select Products
  const [orderItems, setOrderItems] = useState([]);
  const [initialOrderItems, setInitialOrderItems] = useState([]); // Store initial items for edit mode
  const [orderFormData, setOrderFormData] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: '',
    managerNotes: ''
  });
  const [defaultOrderType, setDefaultOrderType] = useState('otc'); // 'otc' or 'salon-use'

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [userData?.branchId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userData?.branchId) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }

      // Load suppliers
      await loadSuppliers();

      // Load branch products
      await loadBranchProducts();

      // Load purchase orders created by Inventory Controller for this branch
      await loadPurchaseOrders();
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const suppliersRef = collection(db, 'suppliers');
      const suppliersSnapshot = await getDocs(suppliersRef);
      const suppliersList = [];
      suppliersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          suppliersList.push({
            id: doc.id,
            name: data.name || 'Unknown Supplier',
            contactPerson: data.contactPerson || '',
            email: data.email || '',
            phone: data.phone || '',
            ...data
          });
        }
      });
      setSuppliers(suppliersList);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      throw err;
    }
  };

  const loadBranchProducts = async () => {
    try {
      if (!userData?.branchId) return;

      // Only show products available to this Inventory Controller's branch (no branch filtering needed)
      const productsRef = collection(db, 'products');
      const productsSnapshot = await getDocs(productsRef);

      const branchProductsList = [];
      productsSnapshot.forEach((doc) => {
        const productData = doc.data();

        // Only include products available to this branch (automatically filtered)
        const isAvailableToBranch = productData.branches && 
          productData.branches.includes(userData.branchId);

        if (isAvailableToBranch) {
          branchProductsList.push({
            id: doc.id,
            name: productData.name,
            category: productData.category,
            brand: productData.brand,
            unitCost: productData.unitCost || 0,
            suppliers: productData.suppliers || (productData.supplier ? [productData.supplier] : []), // Suppliers array
            supplier: productData.supplier, // Keep for backward compatibility
            imageUrl: productData.imageUrl,
            description: productData.description,
            sku: productData.sku,
            ...productData
          });
        }
      });

      setBranchProducts(branchProductsList);
    } catch (err) {
      console.error('Error loading branch products:', err);
      throw err;
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      if (!userData?.branchId) return;

      // Only show purchase orders for this Inventory Controller's branch (no branch filtering needed)
      const purchaseOrdersRef = collection(db, 'purchaseOrders');
      const q = query(
        purchaseOrdersRef,
        where('branchId', '==', userData.branchId), // Automatically filtered to user's branch only
        where('createdByRole', '==', 'inventoryController')
      );
      const snapshot = await getDocs(q);

      const ordersList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        ordersList.push({
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
          expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : new Date(data.expectedDelivery),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
          rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt ? new Date(data.rejectedAt) : null),
          approvedByName: data.approvedByName || null,
          rejectedByName: data.rejectedByName || null,
          rejectionNote: data.rejectionNote || null
        });
      });

      // Sort by createdAt descending (most recent first)
      ordersList.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setPurchaseOrders(ordersList);
    } catch (err) {
      console.error('Error loading purchase orders:', err);
      // If query fails due to index, try without createdByRole filter
      try {
        const purchaseOrdersRef = collection(db, 'purchaseOrders');
        const q = query(
          purchaseOrdersRef,
          where('branchId', '==', userData.branchId)
        );
        const snapshot = await getDocs(q);
        const ordersList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Filter client-side for inventoryController role
          if (data.createdByRole === 'inventoryController') {
            ordersList.push({
              id: doc.id,
              ...data,
              orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
              expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : new Date(data.expectedDelivery),
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
            });
          }
        });
        ordersList.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        setPurchaseOrders(ordersList);
      } catch (fallbackErr) {
        throw err;
      }
    }
  };

  // When supplier is selected, filter products (suppliers is now an array)
  useEffect(() => {
    if (selectedSupplierId && branchProducts.length > 0) {
      const filtered = branchProducts.filter(product => {
        // Check if suppliers is an array and contains the selected supplier ID
        if (Array.isArray(product.suppliers)) {
          return product.suppliers.includes(selectedSupplierId);
        }
        // Fallback for old data structure (single supplier)
        return product.supplier === selectedSupplierId;
      });
      setSupplierProducts(filtered);
    } else {
      setSupplierProducts([]);
    }
  }, [selectedSupplierId, branchProducts]);

  // Filter and paginate products for big data
  const filteredAndPaginatedProducts = useMemo(() => {
    if (!selectedSupplierId || supplierProducts.length === 0) return { products: [], total: 0, totalPages: 0, hasMore: false };
    
    // Filter by search term
    let filtered = supplierProducts;
    if (debouncedProductSearchTerm.trim()) {
      const searchLower = debouncedProductSearchTerm.toLowerCase();
      filtered = supplierProducts.filter(product => 
        product.name?.toLowerCase().includes(searchLower) ||
        product.brand?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower)
      );
    }
    
    // Paginate
    const startIndex = (currentProductPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return {
      products: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / productsPerPage),
      hasMore: endIndex < filtered.length
    };
  }, [supplierProducts, debouncedProductSearchTerm, currentProductPage, selectedSupplierId]);

  // Handle supplier selection
  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      setSelectedSupplierId(supplierId);
      setSelectedSupplierName(supplier.name);
      setShowProductSelection(true);
      setOrderItems([]); // Reset items when changing supplier
    }
  };

  // Get total current stock for a product (sum of all batch stocks)
  const getTotalCurrentStock = async (productId) => {
    if (!productId || !userData?.branchId) return 0;
    
    try {
      // Get all batch stocks for this product
      const stocksRef = collection(db, 'stocks');
      const stocksQuery = query(
        stocksRef,
        where('branchId', '==', userData.branchId),
        where('productId', '==', productId),
        where('status', '==', 'active')
      );
      
      const stocksSnapshot = await getDocs(stocksQuery);
      let totalStock = 0;
      
      stocksSnapshot.forEach((doc) => {
        const stockData = doc.data();
        const realTimeStock = stockData.realTimeStock || 0;
        totalStock += realTimeStock;
      });
      
      return totalStock;
    } catch (error) {
      console.error('Error getting total stock:', error);
      return 0;
    }
  };

  // Add product to order after confirmation (used when high stock warning is confirmed)
  const addProductToOrderConfirmed = (product, currentStock, defaultUsageType) => {
    // Add new item - ensure all fields have values (no undefined)
    // User can have same product with different usage types, but not same product+usageType combination
    setOrderItems(prev => [...prev, {
      productId: product.id || '',
      productName: product.name || '',
      quantity: 1,
      unitPrice: product.unitCost || 0,
      totalPrice: product.unitCost || 0,
      category: product.category || null,
      sku: product.sku || null,
      currentStock: currentStock, // Store current stock for display
      usageType: defaultUsageType, // Default to the usage type that doesn't exist yet
      itemKey: `${product.id}_${Date.now()}_${Math.random()}` // Unique key for each item entry
    }]);
  };

  // Add product to order with stock validation
  const addProductToOrder = async (product, usageType = null) => {
    // Check which usage types already exist for this product
    const existingOtc = orderItems.find(
      item => item.productId === product.id && item.usageType === 'otc'
    );
    const existingSalonUse = orderItems.find(
      item => item.productId === product.id && item.usageType === 'salon-use'
    );
    
    // If both usage types already exist, prevent adding
    if (existingOtc && existingSalonUse) {
      toast.error(
        `${product.name} is already in the order with both OTC and Salon Use usage types. ` +
        `You cannot add duplicate product+usage type combinations.`,
        { duration: 5000 }
      );
      return; // Prevent adding duplicate
    }
    
    // Determine usage type: use passed value, or fallback to logic
    let finalUsageType = usageType || defaultOrderType; // Use passed value or selected order type
    if (existingOtc && !existingSalonUse) {
      finalUsageType = 'salon-use'; // OTC exists, must use Salon Use
    } else if (!existingOtc && existingSalonUse) {
      finalUsageType = 'otc'; // Salon Use exists, must use OTC
    }
    // If neither exists, use the passed usageType or defaultOrderType
    
    // Check current stock before adding
    const currentStock = await getTotalCurrentStock(product.id);
    const REORDER_THRESHOLD = 5; // Only allow ordering if stock is 5 or less
    
    if (currentStock > REORDER_THRESHOLD) {
      toast.error(
        `${product.name} has ${currentStock} units in stock. Only order when stock is ${REORDER_THRESHOLD} or less.`,
        { duration: 4000 }
      );
      
      // Store product info and open warning modal
      setPendingProduct(product);
      setPendingCurrentStock(currentStock);
      setDefaultOrderType(finalUsageType); // Store the intended usage type
      setIsHighStockWarningModalOpen(true);
      return; // Wait for user confirmation
    } else if (currentStock > 0 && currentStock <= REORDER_THRESHOLD) {
      toast.success(`${product.name} has ${currentStock} units - Good time to reorder!`, { duration: 3000 });
    } else if (currentStock === 0) {
      toast.error(`${product.name} is out of stock - Order immediately!`, { duration: 4000 });
    }
    
    // Add new item - ensure all fields have values (no undefined)
    // User can have same product with different usage types, but not same product+usageType combination
    addProductToOrderConfirmed(product, currentStock, finalUsageType);
  };

  // Handle high stock warning modal confirmation
  const handleHighStockWarningConfirm = () => {
    if (pendingProduct) {
      const REORDER_THRESHOLD = 5;
      toast('Ordering despite high stock level', { icon: '⚠️', duration: 3000 });
      
      // Determine default usage type
      const existingOtc = orderItems.find(
        item => item.productId === pendingProduct.id && item.usageType === 'otc'
      );
      const existingSalonUse = orderItems.find(
        item => item.productId === pendingProduct.id && item.usageType === 'salon-use'
      );
      
      let defaultUsageType = 'otc';
      if (existingOtc && !existingSalonUse) {
        defaultUsageType = 'salon-use';
      } else if (!existingOtc && existingSalonUse) {
        defaultUsageType = 'otc';
      }
      
      addProductToOrderConfirmed(pendingProduct, pendingCurrentStock, defaultUsageType);
    }
    
    // Close modal and reset
    setIsHighStockWarningModalOpen(false);
    setPendingProduct(null);
    setPendingCurrentStock(0);
  };

  // Handle high stock warning modal cancellation
  const handleHighStockWarningCancel = () => {
    setIsHighStockWarningModalOpen(false);
    setPendingProduct(null);
    setPendingCurrentStock(0);
  };

  // Remove item from order (by unique itemKey)
  const removeOrderItem = (itemKey) => {
    setOrderItems(prev => prev.filter(item => item.itemKey !== itemKey));
  };

  // Update item quantity (by unique itemKey)
  const updateItemQuantity = (itemKey, quantity) => {
    // Allow empty string for user to type, but enforce minimum of 1
    const qty = quantity === '' ? '' : Math.max(1, parseInt(quantity) || 1);
    setOrderItems(prev => prev.map(item =>
      item.itemKey === itemKey
        ? {
            ...item,
            quantity: qty === '' ? '' : qty,
            totalPrice: (qty === '' ? 0 : qty) * (item.unitPrice || 0),
            // Ensure all fields are defined
            productId: item.productId || '',
            productName: item.productName || '',
            unitPrice: item.unitPrice || 0,
            category: item.category || null,
            sku: item.sku || null,
            usageType: item.usageType || 'otc'
          }
        : item
    ));
  };

  // Update item usage type (by unique itemKey)
  const updateItemUsageType = (itemKey, usageType) => {
    // Find the item being updated
    const itemToUpdate = orderItems.find(item => item.itemKey === itemKey);
    if (!itemToUpdate) return;
    
    // Check if this product+usageType combination already exists in another item
    const existingItem = orderItems.find(
      item => item.itemKey !== itemKey && 
              item.productId === itemToUpdate.productId && 
              item.usageType === usageType
    );
    
    if (existingItem) {
      toast.error(
        `${itemToUpdate.productName} with ${usageType === 'otc' ? 'OTC' : 'Salon Use'} usage type is already in the order. ` +
        `You cannot have duplicate product+usage type combinations.`,
        { duration: 5000 }
      );
      return; // Prevent the change
    }
    
    // Update the usage type if no duplicate exists
    setOrderItems(prev => prev.map(item =>
      item.itemKey === itemKey
        ? { ...item, usageType: usageType }
        : item
    ));
  };

  // Calculate total
  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [orderItems]);

  // Handle create order
  const handleCreateOrder = () => {
    setSelectedSupplierId('');
    setSelectedSupplierName('');
    setShowProductSelection(false);
    setOrderItems([]);
    setDefaultOrderType('otc'); // Reset to default OTC
    setOrderFormData({
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      notes: ''
    });
    setIsCreateModalOpen(true);
  };

  // Helper function to remove undefined values from object
  const removeUndefined = (obj) => {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
          cleaned[key] = removeUndefined(obj[key]);
        } else if (Array.isArray(obj[key])) {
          cleaned[key] = obj[key].map(item => 
            typeof item === 'object' && item !== null ? removeUndefined(item) : item
          );
        } else {
          cleaned[key] = obj[key];
        }
      }
    });
    return cleaned;
  };

  // Generate next incremental PO number based on existing purchase orders for this branch
  const generateNextPONumber = () => {
    if (!userData?.branchId) {
      throw new Error('Branch ID is required to generate PO number');
    }

    // Get first 3 characters of branch ID (uppercase)
    const branchPrefix = userData.branchId.substring(0, 3).toUpperCase();
    
    // Filter POs for this branch only (should already be filtered, but double-check)
    const branchPOs = purchaseOrders.filter(po => po.branchId === userData.branchId);
    
    if (!branchPOs || branchPOs.length === 0) {
      return `PO-${branchPrefix}-${String(1).padStart(2, '0')}`;
    }

    // Extract numeric parts from existing PO numbers with branch prefix
    // Handles formats like: PO-ABC-01, PO-ABC-1, PO-2024-0001 (legacy), etc.
    const poNumbers = branchPOs
      .map(po => {
        const orderId = po.orderId || '';
        // Match patterns: PO-XXX-NN or PO-XXX-N (branch prefix) or legacy formats
        const branchPrefixMatch = orderId.match(new RegExp(`PO-${branchPrefix}-(\\d+)`));
        if (branchPrefixMatch) {
          return parseInt(branchPrefixMatch[1], 10);
        }
        // Also handle legacy formats for migration
        const legacyMatch = orderId.match(/PO-(\d{4}-)?(\d+)/);
        if (legacyMatch) {
          return parseInt(legacyMatch[legacyMatch.length - 1], 10);
        }
        return 0;
      })
      .filter(num => !isNaN(num) && num > 0);

    // Find the maximum number for this branch
    const maxNumber = poNumbers.length > 0 ? Math.max(...poNumbers) : 0;
    
    // Increment and format with branch prefix
    const nextNumber = maxNumber + 1;
    return `PO-${branchPrefix}-${String(nextNumber).padStart(2, '0')}`;
  };

  // Handle submit order
  const handleSubmitOrder = async (e) => {
    if (e) {
      e.preventDefault();
    }

    if (!selectedSupplierId) {
      setError('Please select a supplier');
      return;
    }

    if (orderItems.length === 0) {
      setError('Please add at least one product to the order');
      return;
    }

    if (!orderFormData.orderDate) {
      setError('Please select an order date');
      return;
    }

    if (!orderFormData.expectedDelivery) {
      setError('Please select an expected delivery date');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Validate all required fields before creating/updating document
      if (!userData?.branchId) {
        throw new Error('Branch ID is missing. Please refresh the page.');
      }

      if (!userData?.uid && !userData?.id) {
        throw new Error('User ID is missing. Please refresh the page.');
      }

      // Prepare order data
      const baseOrderData = {
        supplierId: selectedSupplierId || '',
        supplierName: selectedSupplierName || '',
        branchId: userData.branchId,
        orderDate: orderFormData.orderDate ? new Date(orderFormData.orderDate) : new Date(),
        expectedDelivery: orderFormData.expectedDelivery ? new Date(orderFormData.expectedDelivery) : null,
        totalAmount: Number(orderTotal) || 0,
        items: orderItems.map(item => {
          // Validate each item - ensure all fields are defined
          const validatedItem = {
            productId: String(item.productId || ''),
            productName: String(item.productName || ''),
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0,
            usageType: String(item.usageType || 'otc') // Include usage type: 'otc' or 'salon-use'
          };

          // Optional fields - only include if they have values
          if (item.category) {
            validatedItem.category = String(item.category);
          }
          if (item.sku) {
            validatedItem.sku = String(item.sku);
          }

          return validatedItem;
        }),
        notes: orderFormData.notes ? String(orderFormData.notes) : '',
        updatedBy: userData.uid || userData.id,
        updatedByName: (userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`.trim()
          : (userData.email || 'Unknown')),
        updatedAt: serverTimestamp()
      };

      // Add manager notes if in edit mode
      if (isEditMode) {
        baseOrderData.managerNotes = orderFormData.managerNotes ? String(orderFormData.managerNotes) : '';
      }

      // Remove any undefined values before sending to Firestore
      const cleanedData = removeUndefined(baseOrderData);

      // Final validation - check for any undefined values
      const hasUndefined = JSON.stringify(cleanedData).includes('undefined');
      if (hasUndefined) {
        console.error('Purchase order data contains undefined values:', cleanedData);
        throw new Error('Invalid data: Some fields are undefined. Please check product information.');
      }

      if (isEditMode && editingOrder) {
        // Update existing order
        console.log('Updating purchase order with data:', cleanedData);
        await updateDoc(doc(db, 'purchaseOrders', editingOrder.id), cleanedData);

        // Reload purchase orders
        await loadPurchaseOrders();

        // Success - close modal
        setIsCreateModalOpen(false);
        setIsEditMode(false);
        setEditingOrder(null);
        setSelectedOrder(null);
        setOrderItems([]);
        setOrderFormData({
          orderDate: new Date().toISOString().split('T')[0],
          expectedDelivery: '',
          notes: '',
          managerNotes: ''
        });

        toast.success('Purchase order updated successfully');
      } else {
        // Create new order
        // Generate incremental order ID
        const orderId = generateNextPONumber();

        const purchaseOrderData = {
          ...cleanedData,
          orderId: orderId || '',
          status: 'Pending',
          createdBy: userData.uid || userData.id,
          createdByName: (userData.firstName && userData.lastName
            ? `${userData.firstName} ${userData.lastName}`.trim()
            : (userData.email || 'Unknown')),
          createdByRole: 'inventoryController',
          createdAt: serverTimestamp()
        };

        console.log('Creating purchase order with data:', purchaseOrderData);
        const docRef = await addDoc(collection(db, 'purchaseOrders'), purchaseOrderData);

        // Get the created order details
        const createdOrder = {
          id: docRef.id,
          orderId: purchaseOrderData.orderId,
          supplierName: purchaseOrderData.supplierName,
          totalAmount: purchaseOrderData.totalAmount,
          itemsCount: purchaseOrderData.items.length,
          expectedDelivery: purchaseOrderData.expectedDelivery,
          createdAt: purchaseOrderData.createdAt
        };

        // Reload purchase orders
        await loadPurchaseOrders();

        // Success - close confirm modal and show success modal
        setIsConfirmOrderModalOpen(false);
        setCreatedOrderDetails(createdOrder);
        setIsSuccessModalOpen(true);

        // Reset form and close create modal
        setIsCreateModalOpen(false);
        setSelectedSupplierId('');
        setSelectedSupplierName('');
        setShowProductSelection(false);
        setOrderItems([]);
        setProductSearchTerm('');
        setCurrentProductPage(1);
        setOrderFormData({
          orderDate: new Date().toISOString().split('T')[0],
          expectedDelivery: '',
          notes: '',
          managerNotes: ''
        });
        setError(null);
      }
    } catch (err) {
      console.error('Error creating purchase order:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });

      // Provide more specific error message
      let errorMessage = 'Failed to create purchase order.';
      if (err.message.includes('undefined')) {
        errorMessage = 'Error: Some required fields are missing. Please ensure all product information is complete.';
      } else if (err.message.includes('permission')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else {
        errorMessage = err.message || 'Failed to create purchase order. Please try again.';
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(order => {
      const matchesSearch = 
        order.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      const matchesReceivedStatus = selectedReceivedStatus === 'all' || 
        (selectedReceivedStatus === 'received' && order.status === 'Delivered') ||
        (selectedReceivedStatus === 'not-received' && order.status !== 'Delivered');
      const matchesSupplier = selectedSupplierFilter === 'all' || order.supplierId === selectedSupplierFilter;

      // Date filter - filter by orderDate
      let matchesDate = true;
      if (dateFilterStart || dateFilterEnd) {
        const orderDate = order.orderDate ? new Date(order.orderDate) : null;
        if (orderDate) {
          if (dateFilterStart) {
            const startDate = new Date(dateFilterStart);
            startDate.setHours(0, 0, 0, 0);
            if (orderDate < startDate) {
              matchesDate = false;
            }
          }
          if (dateFilterEnd) {
            const endDate = new Date(dateFilterEnd);
            endDate.setHours(23, 59, 59, 999);
            if (orderDate > endDate) {
              matchesDate = false;
            }
          }
        } else {
          matchesDate = false; // If no order date, exclude if date filter is active
        }
      }

      return matchesSearch && matchesStatus && matchesReceivedStatus && matchesSupplier && matchesDate;
    });
  }, [purchaseOrders, searchTerm, selectedStatus, selectedReceivedStatus, selectedSupplierFilter, dateFilterStart, dateFilterEnd]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Received': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Approved': return 'text-green-600 bg-green-100 border-green-200';
      case 'In Transit': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Rejected': return 'text-red-600 bg-red-100 border-red-200';
      case 'Shipped': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Delivered': return 'text-green-600 bg-green-100 border-green-200';
      case 'Cancelled': return 'text-red-600 bg-red-100 border-red-200';
      case 'Overdue': return 'text-orange-600 bg-orange-100 border-orange-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock className="h-4 w-4" />;
      case 'Received': return <CheckCircle className="h-4 w-4" />;
      case 'Approved': return <CheckCircle className="h-4 w-4" />;
      case 'In Transit': return <Truck className="h-4 w-4" />;
      case 'Rejected': return <XCircle className="h-4 w-4" />;
      case 'Shipped': return <Truck className="h-4 w-4" />;
      case 'Delivered': return <CheckCircle className="h-4 w-4" />;
      case 'Cancelled': return <XCircle className="h-4 w-4" />;
      case 'Overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Calculate order statistics
  const orderStats = useMemo(() => {
    return {
      totalOrders: purchaseOrders.length,
      pendingOrders: purchaseOrders.filter(o => o.status === 'Pending').length,
      approvedOrders: purchaseOrders.filter(o => o.status === 'Approved' || o.status === 'In Transit').length,
      deliveredOrders: purchaseOrders.filter(o => o.status === 'Delivered').length,
      overdueOrders: purchaseOrders.filter(o => o.status === 'Overdue').length,
      totalValue: purchaseOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    };
  }, [purchaseOrders]);

  // Export purchase orders to Excel
  const handleExportOrders = () => {
    if (!filteredOrders.length) {
      toast.error('No purchase orders to export');
      return;
    }

    try {
      const headers = [
        { key: 'orderId', label: 'Order ID' },
        { key: 'orderDate', label: 'Order Date' },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'status', label: 'Status' },
        { key: 'totalAmount', label: 'Total Amount (₱)' },
        { key: 'itemsCount', label: 'Items Count' },
        { key: 'expectedDelivery', label: 'Expected Delivery' },
        { key: 'actualDelivery', label: 'Actual Delivery' },
        { key: 'notes', label: 'Notes' },
        { key: 'createdBy', label: 'Created By' }
      ];

      // Prepare data with formatted values
      const exportData = filteredOrders.map(order => {
        const itemsCount = order.items ? order.items.length : 0;
        const orderDate = order.orderDate 
          ? (order.orderDate.toDate ? order.orderDate.toDate() : new Date(order.orderDate))
          : null;
        const expectedDelivery = order.expectedDelivery
          ? (order.expectedDelivery.toDate ? order.expectedDelivery.toDate() : new Date(order.expectedDelivery))
          : null;
        const actualDelivery = order.actualDelivery
          ? (order.actualDelivery.toDate ? order.actualDelivery.toDate() : new Date(order.actualDelivery))
          : null;

        return {
          orderId: order.orderId || order.id || 'N/A',
          orderDate: orderDate ? format(orderDate, 'MMM dd, yyyy') : 'N/A',
          supplierName: order.supplierName || 'N/A',
          status: order.status || 'Pending',
          totalAmount: order.totalAmount || 0,
          itemsCount: itemsCount,
          expectedDelivery: expectedDelivery ? format(expectedDelivery, 'MMM dd, yyyy') : 'N/A',
          actualDelivery: actualDelivery ? format(actualDelivery, 'MMM dd, yyyy') : 'N/A',
          notes: order.notes || '',
          createdBy: order.createdBy || 'N/A'
        };
      });

      exportToExcel(exportData, 'purchase_orders_export', 'Purchase Orders', headers);
      toast.success('Purchase orders exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting purchase orders:', error);
      toast.error('Failed to export purchase orders');
    }
  };

  // Handle adding product to order
  const handleAddProductToOrder = (product) => {
    const existingItem = orderItems.find(item => item.productId === product.id);

    if (existingItem) {
      // Update quantity if product already exists
      setOrderItems(prevItems =>
        prevItems.map(item =>
          item.productId === product.id
            ? { ...item, quantity: (item.quantity || 0) + 1 }
            : item
        )
      );
    } else {
      // Add new product to order
      const newItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.unitCost || 0,
        price: product.unitCost || 0, // For backward compatibility
        totalPrice: product.unitCost || 0
      };
      setOrderItems(prevItems => [...prevItems, newItem]);
    }
  };

  // Handle removing product from order
  const handleRemoveProductFromOrder = (productId) => {
    setOrderItems(prevItems => prevItems.filter(item => item.productId !== productId));
  };

  // Handle updating quantity
  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveProductFromOrder(productId);
      return;
    }

    setOrderItems(prevItems =>
      prevItems.map(item =>
        item.productId === productId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice: newQuantity * (item.unitPrice || item.price || 0)
            }
          : item
      )
    );
  };

  // Open email modal with pre-filled content and generate PDF
  const handleOpenEmailModal = async (order) => {
    // Check if order is approved before allowing email (not Pending, not Received)
    if (order.status !== 'Approved') {
      toast.error(`Cannot email supplier for ${order.status} orders. Only Approved orders can be emailed.`);
      return;
    }
    
    const supplierDetails = suppliers.find(s => s.id === order.supplierId) || {};
    
    if (!supplierDetails.email) {
      toast.error('Supplier email not found. Please update supplier information.');
      return;
    }
    
    const orderDate = order.orderDate
      ? (order.orderDate.toDate ? order.orderDate.toDate() : new Date(order.orderDate))
      : new Date();
    const expectedDelivery = order.expectedDelivery
      ? (order.expectedDelivery.toDate ? order.expectedDelivery.toDate() : new Date(order.expectedDelivery))
      : null;
    
    // Pre-fill email subject
    setEmailSubject(`Purchase Order ${order.orderId || order.id} - David's Salon`);
    
    // Pre-fill email message
    const defaultMessage = `Dear ${supplierDetails.name || 'Supplier'},

We are pleased to submit the following purchase order for your review and processing.

PO Number: ${order.orderId || order.id}
Order Date: ${format(orderDate, 'MMMM dd, yyyy')}
Expected Delivery: ${expectedDelivery ? format(expectedDelivery, 'MMMM dd, yyyy') : 'TBD'}
Branch: ${userData?.branchName || 'David\'s Salon'}

Please click the button below to download the complete Purchase Order PDF with all item details.

If you have any questions or concerns regarding this order, please don't hesitate to contact us.

Thank you for your continued partnership.

Best regards,
${userData?.firstName || ''} ${userData?.lastName || ''}
Inventory Controller
David's Salon`;
    
    setEmailMessage(defaultMessage);
    setEmailOrder(order);
    setEmailPdfUrl(''); // Reset PDF URL
    setIsEmailModalOpen(true);
    
    // Generate and upload PDF in background
    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await generatePurchaseOrderPDF(order);
      const fileName = `PO_${order.orderId || order.id}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      const pdfUrl = await uploadPDFToCloudinary(pdfBlob, fileName);
      setEmailPdfUrl(pdfUrl);
      toast.success('PDF generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. You can still send the email.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Helper function to download file from URL with custom filename
  const downloadFileWithCustomName = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename; // This sets the filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Generate PDF for purchase order
  const generatePurchaseOrderPDF = async (order) => {
    const { jsPDF } = await import('jspdf');
    
    const supplierDetails = suppliers.find(s => s.id === order.supplierId) || {};
    const orderDate = order.orderDate
      ? (order.orderDate.toDate ? order.orderDate.toDate() : new Date(order.orderDate))
      : new Date();
    const expectedDelivery = order.expectedDelivery
      ? (order.expectedDelivery.toDate ? order.expectedDelivery.toDate() : new Date(order.expectedDelivery))
      : null;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFillColor(22, 11, 83); // #160B53
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text("PURCHASE ORDER", pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text("David's Salon Management System", pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, pageWidth / 2, 36, { align: 'center' });

    yPos = 55;
    doc.setTextColor(0, 0, 0);

    // Order Info Box
    doc.setFillColor(239, 246, 255); // Light blue
    doc.roundedRect(15, yPos, pageWidth - 30, 35, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PO Number:', 20, yPos + 10);
    doc.text('Order Date:', 20, yPos + 20);
    doc.text('Expected Delivery:', 20, yPos + 30);
    
    doc.text('Supplier:', pageWidth / 2, yPos + 10);
    doc.text('Branch:', pageWidth / 2, yPos + 20);
    doc.text('Status:', pageWidth / 2, yPos + 30);
    
    doc.setFont('helvetica', 'normal');
    doc.text(order.orderId || order.id, 55, yPos + 10);
    doc.text(format(orderDate, 'MMM dd, yyyy'), 55, yPos + 20);
    doc.text(expectedDelivery ? format(expectedDelivery, 'MMM dd, yyyy') : 'TBD', 65, yPos + 30);
    
    doc.text(supplierDetails.name || 'Unknown', pageWidth / 2 + 25, yPos + 10);
    doc.text(userData?.branchName || 'David\'s Salon', pageWidth / 2 + 25, yPos + 20);
    doc.text(order.status || 'Pending', pageWidth / 2 + 25, yPos + 30);

    yPos += 45;

    // Items Table Header
    doc.setFillColor(22, 11, 83);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('#', 18, yPos + 7);
    doc.text('Product', 28, yPos + 7);
    doc.text('Type', 100, yPos + 7);
    doc.text('Qty', 125, yPos + 7);
    doc.text('Unit Price', 145, yPos + 7);
    doc.text('Total', 175, yPos + 7);

    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Items
    (order.items || []).forEach((item, index) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(15, yPos, pageWidth - 30, 12, 'F');
      }

      doc.setFontSize(9);
      doc.text(String(index + 1), 18, yPos + 8);
      
      // Truncate long product names
      const productName = (item.productName || item.name || '').substring(0, 35);
      doc.text(productName, 28, yPos + 8);
      
      doc.text(item.usageType === 'salon-use' ? 'Salon' : 'OTC', 100, yPos + 8);
      doc.text(String(item.quantity), 125, yPos + 8);
      doc.text(`${(item.unitPrice || 0).toLocaleString()}`, 145, yPos + 8);
      doc.text(`${((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}`, 175, yPos + 8);

      yPos += 12;
    });

    // Total Row
    doc.setFillColor(243, 244, 246);
    doc.rect(15, yPos, pageWidth - 30, 12, 'F');
    doc.setDrawColor(22, 11, 83);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, pageWidth - 15, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Total Amount:', 140, yPos + 8);
    doc.setTextColor(22, 11, 83);
    doc.text(`${(order.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 175, yPos + 8);

    yPos += 20;

    // Notes section
    if (order.notes) {
      doc.setTextColor(0, 0, 0);
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(15, yPos, pageWidth - 30, 25, 3, 3, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Notes:', 20, yPos + 8);
      
      doc.setFont('helvetica', 'normal');
      const notesText = doc.splitTextToSize(order.notes, pageWidth - 45);
      doc.text(notesText, 20, yPos + 16);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text("This is a computer-generated document from David's Salon Management System.", pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Contact: ${userData?.email || 'inventory@davidsalon.com'}`, pageWidth / 2, footerY + 5, { align: 'center' });

    return doc.output('blob');
  };

  // Upload PDF to Cloudinary using existing setup
  const uploadPDFToCloudinary = async (pdfBlob, fileName) => {
    const cloudName = 'dn0jgdjts'; // Your existing Cloudinary cloud name
    const uploadPreset = 'daviddevs_images'; // Your existing preset
    
    const formData = new FormData();
    formData.append('file', pdfBlob);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'purchase-orders');
    formData.append('resource_type', 'raw'); // Explicitly set resource type to raw for PDFs
    
    try {
      // Use /raw/upload endpoint for PDFs (not /image/upload)
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to upload PDF');
      }
      
      const data = await response.json();
      // The URL will be /raw/upload/ instead of /image/upload/
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  };

  // Generate HTML email content with PDF download link
  const generateEmailHTML = (order, customMessage, pdfUrl) => {
    const orderDate = order.orderDate
      ? (order.orderDate.toDate ? order.orderDate.toDate() : new Date(order.orderDate))
      : new Date();
    const expectedDelivery = order.expectedDelivery
      ? (order.expectedDelivery.toDate ? order.expectedDelivery.toDate() : new Date(order.expectedDelivery))
      : null;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #160B53, #2563eb); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
          .content { padding: 30px; }
          .message-box { background-color: #f8fafc; border-left: 4px solid #160B53; padding: 20px; margin: 20px 0; white-space: pre-line; font-size: 14px; }
          .order-summary { background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .order-summary h3 { margin: 0 0 15px 0; color: #160B53; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .summary-item { padding: 8px 0; }
          .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
          .summary-value { font-size: 14px; font-weight: 600; color: #333; margin-top: 2px; }
          .download-section { text-align: center; padding: 30px 20px; background-color: #f0fdf4; border-radius: 8px; margin: 25px 0; }
          .download-btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #160B53, #2563eb); color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
          .download-btn:hover { opacity: 0.9; }
          .download-note { margin-top: 12px; font-size: 12px; color: #666; }
          .total-box { background-color: #160B53; color: white; padding: 15px 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .total-label { font-size: 12px; opacity: 0.8; }
          .total-amount { font-size: 28px; font-weight: bold; margin-top: 5px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Purchase Order</h1>
            <p>David's Salon Management System</p>
          </div>
          <div class="content">
            <div class="message-box">${customMessage.replace(/\n/g, '<br>')}</div>
            
            <div class="order-summary">
              <h3>Order Summary</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-label">PO Number</div>
                  <div class="summary-value">${order.orderId || order.id}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Order Date</div>
                  <div class="summary-value">${format(orderDate, 'MMMM dd, yyyy')}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Expected Delivery</div>
                  <div class="summary-value">${expectedDelivery ? format(expectedDelivery, 'MMMM dd, yyyy') : 'TBD'}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Items</div>
                  <div class="summary-value">${order.items?.length || 0} products</div>
                </div>
              </div>
            </div>

            <div class="total-box">
              <div class="total-label">TOTAL ORDER AMOUNT</div>
              <div class="total-amount">${(order.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>

            <div class="download-section">
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #333;">
                <strong>📄 Complete Purchase Order Document</strong>
              </p>
              <a href="${pdfUrl}" class="download-btn" target="_blank">
                ⬇️ Download PDF
              </a>
              <p class="download-note">
                Click the button above to download the complete purchase order with all item details.
              </p>
            </div>

            ${order.notes ? `
              <div style="padding: 15px; background-color: #fef3c7; border-radius: 8px; margin-top: 20px;">
                <strong style="color: #92400e;">📝 Notes:</strong>
                <p style="margin: 10px 0 0 0; color: #78350f; font-size: 14px;">${order.notes}</p>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>This is an automated email from David's Salon Management System.</p>
            <p>For inquiries, please contact: ${userData?.email || 'inventory@davidsalon.com'}</p>
            <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Send email to supplier with PDF attachment link
  const handleSendEmail = async () => {
    if (!emailOrder) return;
    
    const supplierDetails = suppliers.find(s => s.id === emailOrder.supplierId) || {};
    
    if (!supplierDetails.email) {
      toast.error('Supplier email not found');
      return;
    }
    
    if (!emailPdfUrl) {
      toast.error('PDF is still generating. Please wait...');
      return;
    }
    
    try {
      setIsSendingEmail(true);
      toast.loading('Sending email...', { id: 'email-progress' });
      
      // Generate email with the already-uploaded PDF link
      const htmlContent = generateEmailHTML(emailOrder, emailMessage, emailPdfUrl);
      
      // Send email
      const result = await sendEmail({
        to: supplierDetails.email,
        subject: emailSubject,
        text: `${emailMessage}\n\nDownload Purchase Order PDF: ${emailPdfUrl}`,
        html: htmlContent
      });
      
      toast.dismiss('email-progress');
      
      if (result.success) {
        toast.success(`Email sent successfully to ${supplierDetails.email}`);
        setIsEmailModalOpen(false);
        setEmailOrder(null);
        setEmailMessage('');
        setEmailSubject('');
        setEmailPdfUrl('');
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Print Report
  const handlePrintReport = (includeDetails = false, singleOrder = null) => {
    const ordersToPrint = singleOrder ? [singleOrder] : filteredOrders;

    if (!ordersToPrint.length) {
      toast.error('No purchase orders to print');
      return;
    }

    // Professional Single Purchase Order Layout
    if (singleOrder && ordersToPrint.length === 1) {
      const order = singleOrder;
      const orderDate = order.orderDate
        ? (order.orderDate.toDate ? order.orderDate.toDate() : new Date(order.orderDate))
        : null;
      const expectedDelivery = order.expectedDelivery
        ? (order.expectedDelivery.toDate ? order.expectedDelivery.toDate() : new Date(order.expectedDelivery))
        : null;

      // Find supplier details if available
      const supplierDetails = suppliers.find(s => s.id === order.supplierId) || {};

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Purchase Order #${order.orderId || order.id}</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
              @media print {
                @page { margin: 0.5cm; }
                body { -webkit-print-color-adjust: exact; }
              }
              body { font-family: 'Poppins', Helvetica, Arial, sans-serif; color: #333; line-height: 1.4; padding: 20px; max-width: 1000px; margin: 0 auto; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #160B53; padding-bottom: 20px; }
              .brand-name { font-size: 28px; font-weight: bold; color: #160B53; margin: 0; }
              .brand-sub { font-size: 14px; color: #666; margin: 5px 0 0; letter-spacing: 1px; }
              .doc-title { font-size: 32px; font-weight: bold; color: #160B53; text-transform: uppercase; text-align: right; margin: 0; letter-spacing: 1px; }
              
              .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
              .info-item label { display: block; font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px; }
              .info-item span { font-size: 15px; font-weight: 600; color: #160B53; }
              
              .addresses { display: flex; gap: 60px; margin-bottom: 40px; }
              .address-box { flex: 1; }
              .address-title { font-size: 13px; font-weight: bold; color: #fff; background: #160B53; padding: 8px 12px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; }
              .address-content { padding: 0 5px; }
              .address-content p { margin: 0 0 6px; font-size: 14px; color: #444; }
              .company-name { font-weight: bold; font-size: 16px; color: #000; margin-bottom: 8px !important; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th { background-color: #160B53; color: white; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
              td { padding: 12px 15px; border-bottom: 1px solid #e9ecef; font-size: 14px; }
              tr:nth-child(even) { background-color: #f8f9fa; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              
              .totals-section { display: flex; justify-content: flex-end; margin-bottom: 40px; page-break-inside: avoid; }
              .totals-box { width: 350px; background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
              .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
              .total-row:last-child { border-bottom: none; }
              .total-row.final { border-top: 2px solid #160B53; margin-top: 10px; padding-top: 15px; }
              .total-row.final span { font-weight: bold; font-size: 18px; color: #160B53; }
              
              .notes-section { margin-bottom: 40px; border: 1px solid #e9ecef; padding: 20px; border-radius: 8px; background: #fff; page-break-inside: avoid; }
              .notes-title { font-size: 12px; font-weight: bold; color: #160B53; margin-bottom: 10px; text-transform: uppercase; }
              .notes-content { font-size: 14px; font-style: italic; color: #555; }
              
              .footer { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; page-break-inside: avoid; }
              .signature-line { border-top: 1px solid #000; margin-top: 50px; padding-top: 10px; text-align: center; font-size: 13px; font-weight: bold; color: #333; }
              
              .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; background: #e9ecef; color: #555; border: 1px solid #ddd; }
              
              .meta-info { text-align: center; margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="brand-name">David's Salon</h1>
                <p class="brand-sub">${userData?.branchName || 'Inventory Department'}</p>
              </div>
              <div>
                <h1 class="doc-title">Purchase Order</h1>
                <div style="text-align: right; margin-top: 8px; font-size: 13px; color: #666;">
                  Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}
                </div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <label>PO Number</label>
                <span>${order.orderId || order.id}</span>
              </div>
              <div class="info-item">
                <label>Date Issued</label>
                <span>${orderDate ? format(orderDate, 'MMM dd, yyyy') : 'N/A'}</span>
              </div>
              <div class="info-item">
                <label>Expected Delivery</label>
                <span>${expectedDelivery ? format(expectedDelivery, 'MMM dd, yyyy') : 'N/A'}</span>
              </div>
              <div class="info-item">
                <label>Status</label>
                <span class="status-badge">${order.status || 'Pending'}</span>
              </div>
            </div>

            <div class="addresses">
              <div class="address-box">
                <div class="address-title">Vendor / Supplier</div>
                <div class="address-content">
                  <p class="company-name">${order.supplierName || 'Unknown Supplier'}</p>
                  ${supplierDetails.contactPerson ? `<p>Attn: ${supplierDetails.contactPerson}</p>` : ''}
                  ${supplierDetails.email ? `<p>Email: ${supplierDetails.email}</p>` : ''}
                  ${supplierDetails.phone ? `<p>Phone: ${supplierDetails.phone}</p>` : ''}
                  ${supplierDetails.address ? `<p>${supplierDetails.address}</p>` : ''}
                </div>
              </div>
              <div class="address-box">
                <div class="address-title">Ship To</div>
                <div class="address-content">
                  <p class="company-name">David's Salon - ${userData?.branchName || 'Branch'}</p>
                  <p>Inventory Department</p>
                  <p>Attn: ${userData?.firstName} ${userData?.lastName}</p>
                  <p>Email: ${userData?.email}</p>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 5%">#</th>
                  <th style="width: 40%">Item Description</th>
                  <th style="width: 15%">Category</th>
                  <th style="width: 10%" class="text-center">Qty</th>
                  <th style="width: 15%" class="text-right">Unit Price</th>
                  <th style="width: 15%" class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${(order.items || []).map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>
                      <div style="font-weight: 600; color: #333;">${item.productName || item.name}</div>
                      ${item.sku ? `<div style="font-size: 12px; color: #888; margin-top: 2px;">SKU: ${item.sku}</div>` : ''}
                    </td>
                    <td>${item.category || '-'}</td>
                    <td class="text-center" style="font-weight: 600;">${item.quantity}</td>
                    <td class="text-right">₱${(item.unitPrice || item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td class="text-right" style="font-weight: 600;">₱${((item.quantity || 0) * (item.unitPrice || item.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals-section">
              <div class="totals-box">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>₱${(order.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="total-row">
                  <span>Shipping:</span>
                  <span>-</span>
                </div>
                <div class="total-row">
                  <span>Tax:</span>
                  <span>-</span>
                </div>
                <div class="total-row final">
                  <span>Total Amount:</span>
                  <span>₱${(order.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            ${order.notes ? `
              <div class="notes-section">
                <div class="notes-title">Notes & Instructions</div>
                <div class="notes-content">${order.notes}</div>
              </div>
            ` : ''}

            <div class="footer">
              <div>
                <div class="signature-line">
                  Prepared By: ${order.createdByName || 'Inventory Controller'}
                  <div style="font-weight: normal; font-size: 11px; color: #666; margin-top: 4px;">Authorized Signature</div>
                </div>
              </div>
              <div>
                <div class="signature-line">
                  Approved By: ${order.approvedByName || 'Branch Manager'}
                  <div style="font-weight: normal; font-size: 11px; color: #666; margin-top: 4px;">Authorized Signature</div>
                </div>
              </div>
            </div>
            
            <div class="meta-info">
              <p>Generated by: ${userData?.firstName} ${userData?.lastName} | Date: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
              <p>This is a computer-generated document. No signature is required.</p>
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
      return;
    }

    // Default: Summary Report for multiple orders
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Orders Report - ${userData?.branchName || 'Branch'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page { margin: 1cm; }
            }
            body { font-family: 'Poppins', Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #160B53; margin-bottom: 5px; font-size: 24px; }
            .report-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #160B53; padding-bottom: 15px; margin-bottom: 20px; }
            .header-info p { margin: 2px 0; font-size: 12px; color: #666; }
            
            .filters-section { background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #e9ecef; margin-bottom: 20px; font-size: 12px; }
            .filters-title { font-weight: bold; color: #160B53; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; }
            .filter-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
            .filter-item { display: flex; flex-direction: column; }
            .filter-label { color: #888; font-size: 10px; margin-bottom: 2px; }
            .filter-value { font-weight: 500; color: #333; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 10px 8px; text-align: left; }
            th { background-color: #160B53; color: white; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            
            .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-approved { background: #dbeafe; color: #1e40af; }
            .status-received { background: #d1fae5; color: #065f46; }
            .status-in-transit { background: #ede9fe; color: #5b21b6; }
            .status-delivered { background: #dcfce7; color: #166534; }
            .status-rejected { background: #fee2e2; color: #991b1b; }
            .status-cancelled { background: #f3f4f6; color: #374151; }
            
            .totals-row { font-weight: bold; background-color: #f3f4f6; }
            .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 15px; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <h1>Purchase Orders Report</h1>
              <div class="header-info">
                <p><strong>Branch:</strong> ${userData?.branchName || 'N/A'}</p>
                <p><strong>Total Orders:</strong> ${ordersToPrint.length}</p>
                <p><strong>Total Value:</strong> ₱${ordersToPrint.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666;">
              <p>Generated on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
              <p>Generated by: ${userData?.firstName} ${userData?.lastName}</p>
            </div>
          </div>

          <div class="filters-section">
            <div class="filters-title">Report Parameters</div>
            <div class="filter-grid">
              <div class="filter-item">
                <span class="filter-label">Status Filter</span>
                <span class="filter-value">${selectedStatus === 'all' ? 'All Statuses' : selectedStatus}</span>
              </div>
              <div class="filter-item">
                <span class="filter-label">Supplier Filter</span>
                <span class="filter-value">${selectedSupplierFilter === 'all' ? 'All Suppliers' : (suppliers.find(s => s.id === selectedSupplierFilter)?.name || 'Unknown')}</span>
              </div>
              <div class="filter-item">
                <span class="filter-label">Date Range</span>
                <span class="filter-value">${dateFilterStart || dateFilterEnd ? `${dateFilterStart || 'Start'} to ${dateFilterEnd || 'End'}` : 'All Dates'}</span>
              </div>
              <div class="filter-item">
                <span class="filter-label">Search Term</span>
                <span class="filter-value">${searchTerm || '-'}</span>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Supplier</th>
                <th>Order Date</th>
                <th>Status</th>
                <th>Total Amount</th>
                ${includeDetails ? '<th>Product Details</th>' : '<th>Items</th>'}
                <th>Expected Delivery</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${ordersToPrint.map(order => {
                const orderDate = order.orderDate
                  ? (order.orderDate.toDate ? order.orderDate.toDate() : new Date(order.orderDate))
                  : null;
                const expectedDelivery = order.expectedDelivery
                  ? (order.expectedDelivery.toDate ? order.expectedDelivery.toDate() : new Date(order.expectedDelivery))
                  : null;

                return `
                  <tr>
                    <td><strong>${order.orderId || order.id}</strong></td>
                    <td>${order.supplierName || 'N/A'}</td>
                    <td>${orderDate ? format(orderDate, 'MMM dd, yyyy') : 'N/A'}</td>
                    <td><span class="status-badge status-${(order.status || 'pending').toLowerCase().replace(' ', '-')}">${order.status || 'Pending'}</span></td>
                    <td style="font-family: monospace;">₱${(order.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>
                      ${includeDetails ? `
                        ${order.items && order.items.length > 0 ? `
                          <div style="display: flex; flex-direction: column; gap: 4px;">
                          ${order.items.map(item => `
                            <div style="padding: 4px; background-color: rgba(0,0,0,0.02); border-radius: 3px; font-size: 10px;">
                              <div style="font-weight: 600;">${item.productName || item.name || 'Unknown Product'}</div>
                              <div style="display: flex; justify-content: space-between; color: #666;">
                                <span>Qty: ${item.quantity || 0}</span>
                                <span>₱${((item.quantity || 0) * (item.unitPrice || item.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          `).join('')}
                          </div>
                        ` : 'No items'}
                      ` : `${order.items ? order.items.length : 0} items`}
                    </td>
                    <td>${expectedDelivery ? format(expectedDelivery, 'MMM dd, yyyy') : 'N/A'}</td>
                    <td style="font-style: italic; color: #666;">${order.notes || ''}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="totals-row">
                <td colspan="4" style="text-align: right;">GRAND TOTAL</td>
                <td style="font-family: monospace;">₱${ordersToPrint.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td colspan="3"></td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <span>System Report ID: ${new Date().getTime().toString().slice(-8)}</span>
            <span>Page 1 of 1</span>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle marking order as confirmed by supplier (In Transit)
  const handleSupplierConfirmed = async (order) => {
    try {
      if (!order.id) {
        toast.error('Invalid order ID');
        return;
      }

      // Show loading toast
      const loadingToast = toast.loading('Updating order status...');

      // Update order status to In Transit
      const orderRef = doc(db, 'purchaseOrders', order.id);
      await updateDoc(orderRef, {
        status: 'In Transit',
        supplierConfirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Reload orders
      await loadPurchaseOrders();
      
      toast.dismiss(loadingToast);
      toast.success(`Order ${order.orderId || order.id} marked as In Transit`);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.dismiss();
      toast.error('Failed to update order status');
    }
  };

  // Check if order can be marked as delivered (must be In Transit)
  const canMarkDelivered = (order) => {
    return order.status === 'In Transit';
  };

  // Handle mark as delivered with batch creation
  const handleMarkAsDelivered = async () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) {
      setError('Invalid order data');
      return;
    }

    try {
      setIsMarkingDelivered(true);
      setError(null);

      // Validate expiration dates for all items
      const itemsWithExpiration = selectedOrder.items.map(item => {
        const expirationDate = deliveryExpirationDates[item.productId];
        if (!expirationDate) {
          throw new Error(`Expiration date required for ${item.productName}`);
        }
        return {
          ...item,
          expirationDate: expirationDate
        };
      });

      // Create batches from delivery
      const deliveryData = {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        branchId: userData.branchId,
        items: itemsWithExpiration,
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        receivedAt: new Date()
      };

      const batchesResult = await inventoryService.createProductBatches(deliveryData);
      if (!batchesResult.success) {
        throw new Error(batchesResult.message || 'Failed to create product batches');
      }

      // Update stock for each product
      for (const item of selectedOrder.items) {
        const stockData = {
          branchId: userData.branchId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitPrice,
          reason: 'Purchase Order Delivery',
          notes: `Batch created from PO: ${selectedOrder.orderId || selectedOrder.id}`,
          createdBy: userData.uid || userData.id
        };

        const stockResult = await inventoryService.addStock(stockData);
        if (!stockResult.success) {
          console.error(`Failed to update stock for ${item.productName}:`, stockResult.message);
          // Continue with other items even if one fails
        }
      }

      // Update purchase order status to Delivered
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Delivered',
        deliveredBy: userData.uid || userData.id,
        deliveredByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Reload purchase orders
      await loadPurchaseOrders();
      
      // Close modals and reset
      setIsDeliveryModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedOrder(null);
      setDeliveryExpirationDates({});
      setError(null);
    } catch (err) {
      console.error('Error marking order as delivered:', err);
      setError(err.message || 'Failed to mark order as delivered. Please try again.');
    } finally {
      setIsMarkingDelivered(false);
    }
  };

  // Open delivery modal and initialize expiration dates
  const handleOpenDeliveryModal = (order) => {
    setSelectedOrder(order);
    // Initialize expiration dates - set to 1 year from today as default
    const defaultExpiration = new Date();
    defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
    const defaultExpirationStr = defaultExpiration.toISOString().split('T')[0];
    
    const initialDates = {};
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        initialDates[item.productId] = defaultExpirationStr;
      });
    }
    setDeliveryExpirationDates(initialDates);
    setIsDeliveryModalOpen(true);
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
          <span className="ml-2 text-gray-600">Loading purchase orders...</span>
        </div>
      </>
    );
  }

  if (error && !userData?.branchId) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Purchase Orders</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData} className="flex items-center gap-2 mx-auto">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-xs md:text-sm text-gray-600">Create and manage purchase orders from suppliers</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              onClick={handleCreateOrder}
              className="flex items-center gap-2"
              title="Create new purchase order"
            >
              <Plus className="w-5 h-5" />
              <span>Create Purchase Order</span>
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-3 md:p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 flex-shrink-0" />
              <p className="text-xs md:text-sm text-red-800 flex-1">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto p-1">
                <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 lg:gap-4">
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <ShoppingCart className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Total Orders</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{orderStats.totalOrders}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Clock className="h-6 w-6 md:h-8 md:w-8 text-yellow-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Pending</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{orderStats.pendingOrders}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-blue-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Approved</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{orderStats.approvedOrders}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Truck className="h-6 w-6 md:h-8 md:w-8 text-green-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Delivered</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{orderStats.deliveredOrders}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-red-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Overdue</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{orderStats.overdueOrders}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Banknote className="h-6 w-6 md:h-8 md:w-8 text-purple-600 flex-shrink-0" />
              <div className="ml-2 md:ml-3 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">Total Value</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">₱{orderStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Row */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                  type="text"
                placeholder="Search purchase orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                />
              </div>

            {/* Filter Button */}
            <Button
              variant="outline"
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-2"
              title="Advanced filters"
            >
              <Filter className="w-5 h-5" />
            </Button>

            {/* Export Button */}
                <Button
                  variant="outline"
                  onClick={() => {
                // Export functionality for purchase orders
                const csvContent = purchaseOrders.map(order => `${order.orderId},${order.supplierName || ''},${order.status},${order.totalValue || ''},${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}`).join('\n');
                const blob = new Blob([`Order ID,Supplier,Status,Total Value,Date\n${csvContent}`], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `purchase_orders_${Date.now()}.csv`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2"
              title="Export purchase orders data"
            >
              <Download className="w-5 h-5" />
                </Button>

            {/* Print Button */}
                  <Button
                    variant="outline"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-2"
              title="Print purchase orders report"
            >
              <Printer className="w-5 h-5" />
                  </Button>
              </div>
            </div>

        {/* Purchase Orders Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Supplier
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Order Date
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Expected
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Amount
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                      Items
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-2 md:px-4 py-6 md:py-8 text-center text-xs md:text-sm text-gray-500">
                      No purchase orders found. Create your first order to get started.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                        <div className="text-xs md:text-sm font-medium text-gray-900">{order.orderId || order.id}</div>
                        <div className="text-xs text-gray-500 hidden sm:block">by {order.createdByName || 'Unknown'}</div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-xs md:text-sm text-gray-900">{order.supplierName || 'Unknown Supplier'}</div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-xs md:text-sm text-gray-900">
                          {order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-xs md:text-sm text-gray-900">
                          {order.expectedDelivery ? format(new Date(order.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          <span className="hidden sm:inline">{order.status}</span>
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-xs md:text-sm font-medium text-gray-900">₱{(order.totalAmount || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap hidden xl:table-cell">
                        <div className="text-xs md:text-sm text-gray-900">{order.items?.length || 0} items</div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium">
                        <div className="flex items-center gap-1 md:gap-2">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailsModalOpen(true);
                            }}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              handlePrintReport(false, order);
                            }}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="Print purchase order"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEmailModal(order)}
                            disabled={order.status !== 'Approved'}
                            className={`p-1.5 rounded transition-colors ${
                              order.status !== 'Approved'
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                            }`}
                            title={order.status !== 'Approved' ? 'Only Approved orders can be emailed' : 'Email to supplier'}
                          >
                            <Mail className="h-4 w-4" />
                          </button>

                          {order.status === 'Pending' && (
                            <button
                              onClick={async () => {
                                if (order.status !== 'Pending') {
                                  return;
                                }

                                setIsEditMode(true);
                                setEditingOrder(order);
                                setSelectedOrder(order);

                                setSelectedSupplierId(order.supplierId);
                                setSelectedSupplierName(order.supplierName);

                                const itemsWithKeys = (order.items || []).map(item => ({
                                  ...item,
                                  itemKey: item.itemKey || `${item.productId}_${Date.now()}_${Math.random()}`,
                                  productId: item.productId || '',
                                  productName: item.productName || '',
                                  quantity: Number(item.quantity) || 1,
                                  unitPrice: Number(item.unitPrice) || 0,
                                  totalPrice: Number(item.totalPrice) || 0,
                                  category: item.category || null,
                                  sku: item.sku || null,
                                  usageType: item.usageType || 'otc'
                                }));
                                setOrderItems(itemsWithKeys);

                                setOrderFormData({
                                  orderDate: order.orderDate ?
                                    (order.orderDate.toDate ?
                                      order.orderDate.toDate().toISOString().split('T')[0] :
                                      new Date(order.orderDate).toISOString().split('T')[0]) :
                                    new Date().toISOString().split('T')[0],
                                  expectedDelivery: order.expectedDelivery ?
                                    (order.expectedDelivery.toDate ?
                                      order.expectedDelivery.toDate().toISOString().split('T')[0] :
                                      new Date(order.expectedDelivery).toISOString().split('T')[0]) :
                                    '',
                                  notes: order.notes || '',
                                  managerNotes: order.managerNotes || ''
                                });

                                try {
                                  await loadSupplierProducts(order.supplierId);
                                } catch (error) {
                                  console.error('Error loading supplier products for edit:', error);
                                }

                                setShowProductSelection(true);
                                setIsCreateModalOpen(true);
                              }}
                              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              title="Edit purchase order"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}

                          {order.status === 'Approved' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  handlePrintReport(true, order);
                                }}
                                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                title="Download purchase order"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleSupplierConfirmed(order)}
                                className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-100 rounded transition-colors"
                                title="Mark as confirmed"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}

                          {order.status === 'In Transit' && (
                            <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded-full border border-blue-100">
                              Awaiting Delivery
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>

        {/* Create Order Modal - Centered */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-2">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[98vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {isEditMode ? `Edit Purchase Order` : 'Create Purchase Order'}
                      </h2>
                      <p className="text-white/80 text-sm mt-1">
                        {isEditMode ? (
                          `Order ID: ${editingOrder?.orderId || editingOrder?.id || 'Unknown'}`
                        ) : (
                          !selectedSupplierId ? 'Step 1: Select Supplier' : 'Step 2: Select Products'
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setIsEditMode(false);
                      setEditingOrder(null);
                      setSelectedOrder(null);
                      setSelectedSupplierId('');
                      setSelectedSupplierName('');
                      setShowProductSelection(false);
                      setOrderItems([]);
                      setInitialOrderItems([]);
                      setProductSearchTerm('');
                      setCurrentProductPage(1);
                      setOrderFormData({
                        orderDate: new Date().toISOString().split('T')[0],
                        expectedDelivery: '',
                        notes: '',
                        managerNotes: ''
                      });
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto flex flex-col p-4">
                {/* Error Display in Modal */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 flex-1 text-sm">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-600 hover:text-red-700 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {!showProductSelection ? (
                  /* Step 1: Supplier Selection */
                  <div className="space-y-6 flex-shrink-0">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Select Supplier *</label>
                      
                      {/* Search Input */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search suppliers by name, contact person, or email..."
                          value={supplierSearchTerm}
                          onChange={(e) => setSupplierSearchTerm(e.target.value)}
                          className="pl-10 w-full"
                        />
                      </div>

                      {/* Supplier Cards Grid */}
                      <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
                        {suppliers
                          .filter(supplier => {
                            if (!supplierSearchTerm) return true;
                            const searchLower = supplierSearchTerm.toLowerCase();
                            return (
                              supplier.name?.toLowerCase().includes(searchLower) ||
                              supplier.contactPerson?.toLowerCase().includes(searchLower) ||
                              supplier.email?.toLowerCase().includes(searchLower) ||
                              supplier.phone?.toLowerCase().includes(searchLower)
                            );
                          })
                          .map(supplier => (
                            <div
                              key={supplier.id}
                              onClick={() => handleSupplierSelect(supplier.id)}
                              className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                selectedSupplierId === supplier.id
                                  ? 'border-[#160B53] bg-[#160B53]/5 shadow-md'
                                  : 'border-gray-200 hover:border-[#160B53]/50 hover:shadow-sm bg-white'
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-lg ${
                                  selectedSupplierId === supplier.id
                                    ? 'bg-[#160B53] text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  <Building className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <h3 className={`font-semibold text-lg ${
                                      selectedSupplierId === supplier.id
                                        ? 'text-[#160B53]'
                                        : 'text-gray-900'
                                    }`}>
                                      {supplier.name}
                                    </h3>
                                    {selectedSupplierId === supplier.id && (
                                      <div className="flex-shrink-0">
                                        <CheckCircle className="h-5 w-5 text-[#160B53]" />
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-1.5 text-sm text-gray-600">
                                    {supplier.contactPerson && (
                                      <div className="flex items-center gap-2">
                                        <UserCog className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <span className="truncate">{supplier.contactPerson}</span>
                                      </div>
                                    )}
                                    {supplier.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <span className="truncate">{supplier.email}</span>
                                      </div>
                                    )}
                                    {supplier.phone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <span className="truncate">{supplier.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        
                        {suppliers.filter(supplier => {
                          if (!supplierSearchTerm) return true;
                          const searchLower = supplierSearchTerm.toLowerCase();
                          return (
                            supplier.name?.toLowerCase().includes(searchLower) ||
                            supplier.contactPerson?.toLowerCase().includes(searchLower) ||
                            supplier.email?.toLowerCase().includes(searchLower) ||
                            supplier.phone?.toLowerCase().includes(searchLower)
                          );
                        }).length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <Building className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p className="font-medium">No suppliers found</p>
                            <p className="text-sm mt-1">Try adjusting your search terms</p>
                          </div>
                        )}
                      </div>

                      {/* Selected Supplier Summary */}
                      {selectedSupplierId && (
                        <div className="mt-4 p-4 bg-[#160B53]/10 border-2 border-[#160B53] rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[#160B53] text-white rounded-lg">
                                <Building className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-[#160B53]">{selectedSupplierName}</p>
                                {suppliers.find(s => s.id === selectedSupplierId)?.contactPerson && (
                                  <p className="text-sm text-gray-600">
                                    Contact: {suppliers.find(s => s.id === selectedSupplierId).contactPerson}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSupplierId('');
                                setSelectedSupplierName('');
                                setSupplierProducts([]);
                                setSupplierSearchTerm('');
                              }}
                            >
                              Change
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedSupplierId && (
                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={() => setShowProductSelection(true)}
                          className="bg-[#160B53] text-white hover:bg-[#12094A]"
                        >
                          Continue to Products <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Step 2: Product Selection with Sidebar Layout */
                  <form id="purchase-order-form" onSubmit={handleSubmitOrder} className="flex-1 flex flex-col min-h-0">
                    {/* Supplier Info */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-semibold text-blue-900">{selectedSupplierName}</p>
                            <p className="text-sm text-blue-700">Available products from this supplier in your branch</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowProductSelection(false);
                            setSelectedSupplierId('');
                            setSelectedSupplierName('');
                            setSupplierProducts([]);
                            setProductSearchTerm('');
                            setCurrentProductPage(1);
                          }}
                        >
                          Change Supplier
                        </Button>
                      </div>
                    </div>

                    {/* Two Column Layout: Products Left (35%), Order Items Right (65%) */}
                    <div className="flex-1 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 280px)' }}>
                      {/* Left Column: Product Selection (35%) */}
                      <div className="w-[35%] flex flex-col min-w-0 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                        <div className="p-3 bg-white border-b border-gray-200 flex-shrink-0">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-gray-900">
                              Select Products ({filteredAndPaginatedProducts.total || supplierProducts.length})
                            </h3>
                          </div>
                          {/* Product Search */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              type="text"
                              placeholder="Search products..."
                              value={productSearchTerm}
                              onChange={(e) => {
                                setProductSearchTerm(e.target.value);
                                setCurrentProductPage(1); // Reset to first page on search
                              }}
                              className="w-full pl-10 text-sm"
                            />
                          </div>
                        </div>
                      
                        {supplierProducts.length === 0 ? (
                          <div className="text-center py-12 flex-1 flex items-center justify-center">
                            <div>
                              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600 text-lg">No products available from this supplier in your branch.</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Products Grid with Images - Scrollable */}
                            <div className="flex-1 overflow-y-auto p-3">
                              <div className="grid grid-cols-2 gap-2">
                              {filteredAndPaginatedProducts.products?.map((product) => {
                                const isInOrder = orderItems.some(item => item.productId === product.id);
                                return (
                                  <Card
                                    key={product.id}
                                    className={`p-2 hover:border-[#160B53] hover:shadow-lg transition-all relative ${
                                      isInOrder ? 'border-2 border-green-500 bg-green-50' : 'bg-white'
                                    }`}
                                  >
                                    {/* Product Image - Taller */}
                                    <div className="relative w-full h-24 mb-2 bg-gray-100 rounded overflow-hidden">
                                      {product.imageUrl ? (
                                        <img
                                          src={product.imageUrl}
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext fill="%239ca3af" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                          <Package className="h-6 w-6 text-gray-400" />
                                        </div>
                                      )}
                                      {isInOrder && (
                                        <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                                          <CheckCircle className="h-3 w-3" />
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Product Info */}
                                    <div className="space-y-1">
                                      <h4 className="font-medium text-gray-900 text-xs line-clamp-2 leading-tight">{product.name}</h4>
                                      {product.brand && (
                                        <p className="text-[10px] text-gray-500 truncate">{product.brand}</p>
                                      )}
                                      {product.category && (
                                        <span className="inline-block text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                          {product.category}
                                        </span>
                                      )}
                                      <div className="pt-1">
                                        <span className="text-xs font-bold text-[#160B53] block mb-1">
                                          ₱{(product.unitCost || 0).toLocaleString()}
                                        </span>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              await addProductToOrder(product, 'otc');
                                            }}
                                            className={`flex-1 h-6 px-1 text-[10px] ${
                                              orderItems.some(item => item.productId === product.id && item.usageType === 'otc')
                                                ? 'bg-green-600 hover:bg-green-700'
                                                : 'bg-green-500 hover:bg-green-600'
                                            } text-white`}
                                          >
                                            {orderItems.some(item => item.productId === product.id && item.usageType === 'otc')
                                              ? <CheckCircle className="h-3 w-3" />
                                              : 'OTC'}
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              await addProductToOrder(product, 'salon-use');
                                            }}
                                            className={`flex-1 h-6 px-1 text-[10px] ${
                                              orderItems.some(item => item.productId === product.id && item.usageType === 'salon-use')
                                                ? 'bg-blue-600 hover:bg-blue-700'
                                                : 'bg-blue-500 hover:bg-blue-600'
                                            } text-white`}
                                          >
                                            {orderItems.some(item => item.productId === product.id && item.usageType === 'salon-use')
                                              ? <CheckCircle className="h-3 w-3" />
                                              : 'Salon'}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Pagination Controls */}
                          {filteredAndPaginatedProducts.totalPages > 1 && (
                            <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-white flex-shrink-0">
                              <div className="text-xs text-gray-600">
                                {((currentProductPage - 1) * productsPerPage) + 1}-{Math.min(currentProductPage * productsPerPage, filteredAndPaginatedProducts.total)} of {filteredAndPaginatedProducts.total}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentProductPage(prev => Math.max(1, prev - 1))}
                                  disabled={currentProductPage === 1}
                                  className="h-7 px-2 text-xs"
                                >
                                  Prev
                                </Button>
                                <span className="text-xs text-gray-600 px-2">
                                  {currentProductPage}/{filteredAndPaginatedProducts.totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentProductPage(prev => 
                                    Math.min(filteredAndPaginatedProducts.totalPages, prev + 1)
                                  )}
                                  disabled={currentProductPage >= filteredAndPaginatedProducts.totalPages}
                                  className="h-7 px-2 text-xs"
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Right Column: Order Items Sidebar (65%) */}
                      <div className="w-[65%] flex-shrink-0 flex flex-col border border-gray-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200 flex-shrink-0">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Order Items {orderItems.length > 0 && <span className="text-xs font-normal text-gray-500">({orderItems.length})</span>}
                          </h3>
                          {orderItems.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsClearAllModalOpen(true)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7"
                            >
                              Clear All
                            </Button>
                          )}
                        </div>

                        {orderItems.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center bg-gray-50">
                            <div className="text-center p-6">
                              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                              <p className="text-sm text-gray-600">No items in order</p>
                              <p className="text-xs text-gray-500 mt-1">Click products to add them</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {/* Scrollable Order Items List */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                              {orderItems.map((item) => {
                                const product = supplierProducts.find(p => p.id === item.productId);
                                return (
                                  <Card key={item.itemKey || item.productId} className="p-3 bg-white">
                                    {/* Row 1: Product name, badge, stock, delete button */}
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <h4 className="font-semibold text-gray-900 text-sm truncate">{item.productName}</h4>
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                                          (item.usageType || 'otc') === 'salon-use'
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-green-100 text-green-800'
                                        }`}>
                                          {(item.usageType || 'otc') === 'salon-use' ? 'Salon' : 'OTC'}
                                        </span>
                                        {item.currentStock !== undefined && (
                                          <span className={`text-[10px] flex-shrink-0 ${
                                            item.currentStock > 5 
                                              ? 'text-orange-600' 
                                              : item.currentStock === 0 
                                              ? 'text-red-600 font-medium' 
                                              : 'text-green-600'
                                          }`}>
                                            Stock: {item.currentStock}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeOrderItem(item.itemKey || item.productId)}
                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                        title="Remove item"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                    
                                    {/* Row 2: Qty, Usage, Price - all in one row */}
                                    <div className="flex items-end gap-3">
                                      <div className="w-20">
                                        <label className="text-[10px] text-gray-500 block mb-0.5">Quantity</label>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={item.quantity}
                                          onChange={(e) => updateItemQuantity(item.itemKey || item.productId, e.target.value)}
                                          className="w-full text-sm h-8"
                                        />
                                      </div>
                                      <div className="w-24">
                                        <label className="text-[10px] text-gray-500 block mb-0.5">Usage Type</label>
                                        <select
                                          value={item.usageType || 'otc'}
                                          onChange={(e) => updateItemUsageType(item.itemKey || item.productId, e.target.value)}
                                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs h-8 focus:ring-1 focus:ring-[#160B53]"
                                        >
                                          <option 
                                            value="otc"
                                            disabled={orderItems.some(
                                              otherItem => otherItem.itemKey !== item.itemKey && 
                                                           otherItem.productId === item.productId && 
                                                           otherItem.usageType === 'otc'
                                            )}
                                          >
                                            OTC
                                          </option>
                                          <option 
                                            value="salon-use"
                                            disabled={orderItems.some(
                                              otherItem => otherItem.itemKey !== item.itemKey && 
                                                           otherItem.productId === item.productId && 
                                                           otherItem.usageType === 'salon-use'
                                            )}
                                          >
                                            Salon Use
                                          </option>
                                        </select>
                                      </div>
                                      <div className="flex-1"></div>
                                      <div className="text-right">
                                        <p className="text-[10px] text-gray-400">₱{item.unitPrice.toLocaleString()} × {item.quantity || 0}</p>
                                        <p className="text-base font-bold text-[#160B53]">₱{item.totalPrice.toLocaleString()}</p>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>

                            {/* Total Amount - Sticky at bottom */}
                            <div className="p-3 bg-gradient-to-r from-[#160B53] to-[#12094A] flex-shrink-0">
                              <div className="flex justify-between items-center">
                                <span className="text-white font-semibold text-sm">Total Amount:</span>
                                <span className="text-xl font-bold text-white">₱{orderTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Details - Below both columns */}
                    <div className="flex-shrink-0 mt-3 pt-3 border-t border-gray-200 space-y-2">
                      {/* Row 1: Dates */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Order Date *</label>
                          <Input
                            type="date"
                            value={orderFormData.orderDate}
                            onChange={(e) => setOrderFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                            required
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Expected Delivery *</label>
                          <Input
                            type="date"
                            value={orderFormData.expectedDelivery}
                            onChange={(e) => setOrderFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                            required
                            min={orderFormData.orderDate}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      {/* Row 2: Notes */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                          <textarea
                            value={orderFormData.notes}
                            onChange={(e) => setOrderFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Additional notes..."
                            rows={2}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Manager Notes</label>
                          <textarea
                            value={orderFormData.managerNotes}
                            onChange={(e) => setOrderFormData(prev => ({ ...prev, managerNotes: e.target.value }))}
                            placeholder="Internal notes..."
                            rows={2}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-3 bg-gray-50 flex-shrink-0">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setIsEditMode(false);
                      setEditingOrder(null);
                      setSelectedOrder(null);
                      setSelectedSupplierId('');
                      setSelectedSupplierName('');
                      setShowProductSelection(false);
                      setOrderItems([]);
                      setInitialOrderItems([]);
                      setProductSearchTerm('');
                      setCurrentProductPage(1);
                      setOrderFormData({
                        orderDate: new Date().toISOString().split('T')[0],
                        expectedDelivery: '',
                        notes: '',
                        managerNotes: ''
                      });
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  {showProductSelection && (
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        // Validate before opening confirmation modal
                        if (!selectedSupplierId) {
                          setError('Please select a supplier');
                          return;
                        }
                        if (orderItems.length === 0) {
                          setError('Please add at least one product to the order');
                          return;
                        }
                        if (!orderFormData.orderDate) {
                          setError('Please select an order date');
                          return;
                        }
                        if (!orderFormData.expectedDelivery) {
                          setError('Please select an expected delivery date');
                          return;
                        }
                        setError(null);
                        setIsConfirmOrderModalOpen(true);
                      }}
                      disabled={isSubmitting || orderItems.length === 0 || !orderFormData.orderDate || !orderFormData.expectedDelivery}
                      className="bg-[#160B53] text-white hover:bg-[#12094A] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {isEditMode ? 'Update Order' : 'Create Order'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {isDetailsModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Purchase Order Details</h2>
                      <p className="text-white/80 text-sm mt-1">{selectedOrder.orderId || selectedOrder.id}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setSelectedOrder(null);
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Order Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedOrder.supplierName || 'Unknown Supplier'}</h3>
                      <p className="text-gray-600">Order Date: {selectedOrder.orderDate ? format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy') : 'N/A'}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusIcon(selectedOrder.status)}
                      {selectedOrder.status}
                    </span>
                  </div>

                  {/* Order Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Expected Delivery</label>
                        <p className="text-gray-900">
                          {selectedOrder.expectedDelivery ? format(new Date(selectedOrder.expectedDelivery), 'MMM dd, yyyy') : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Created By</label>
                        <p className="text-gray-900">{selectedOrder.createdByName || 'Unknown'}</p>
                      </div>
                      {selectedOrder.approvedByName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Approved By</label>
                          <p className="text-gray-900 text-green-600 font-semibold">{selectedOrder.approvedByName}</p>
                          {selectedOrder.approvedAt && (
                            <p className="text-xs text-gray-500">
                              {format(new Date(selectedOrder.approvedAt), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedOrder.rejectedByName && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Rejected By</label>
                          <p className="text-gray-900 text-red-600 font-semibold">{selectedOrder.rejectedByName}</p>
                          {selectedOrder.rejectedAt && (
                            <p className="text-xs text-gray-500">
                              {format(new Date(selectedOrder.rejectedAt), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                          {selectedOrder.rejectionNote && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm font-medium text-red-800">Rejection Note:</p>
                              <p className="text-sm text-red-700 mt-1">{selectedOrder.rejectionNote}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedOrder.updatedByName && selectedOrder.updatedAt && selectedOrder.updatedAt !== selectedOrder.createdAt && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Last Updated By</label>
                          <p className="text-gray-900 text-blue-600 font-semibold">{selectedOrder.updatedByName}</p>
                          {selectedOrder.updatedAt && (
                            <p className="text-xs text-gray-500">
                              {(() => {
                                try {
                                  const date = selectedOrder.updatedAt.toDate ? selectedOrder.updatedAt.toDate() : new Date(selectedOrder.updatedAt);
                                  return format(date, 'MMM dd, yyyy HH:mm');
                                } catch (error) {
                                  return 'Invalid date';
                                }
                              })()}
                            </p>
                          )}
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            <Edit className="h-3 w-3" />
                            Edited
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Amount</label>
                        <p className="text-2xl font-bold text-[#160B53]">₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
                      </div>
                      {selectedOrder.notes && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Notes</label>
                          <p className="text-gray-900">{selectedOrder.notes}</p>
                        </div>
                      )}
                      {selectedOrder.managerNotes && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Manager Notes</label>
                          <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800">{selectedOrder.managerNotes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedOrder.items && selectedOrder.items.length > 0 ? (
                            selectedOrder.items.map((item, index) => (
                              <tr key={index}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{item.productName}</div>
                                  {item.sku && (
                                    <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-gray-900">{item.quantity}</td>
                                <td className="px-4 py-3 text-gray-900">₱{(item.unitPrice || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">₱{(item.totalPrice || 0).toLocaleString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="px-4 py-4 text-center text-gray-500">No items</td>
                            </tr>
                          )}
                        </tbody>
                        {selectedOrder.items && selectedOrder.items.length > 0 && (
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan="3" className="px-4 py-3 text-right font-semibold text-gray-900">Total:</td>
                              <td className="px-4 py-3 text-right font-bold text-[#160B53] text-lg">
                                ₱{(selectedOrder.totalAmount || 0).toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePrintReport(false, selectedOrder)}
                      className="border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      disabled={selectedOrder?.status !== 'Approved'}
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        handleOpenEmailModal(selectedOrder);
                      }}
                      className={`flex items-center gap-2 ${
                        selectedOrder?.status !== 'Approved'
                          ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                          : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                      }`}
                      title={selectedOrder?.status !== 'Approved' ? 'Only Approved orders can be emailed' : 'Email to supplier'}
                    >
                      <Mail className="h-4 w-4" />
                      Email to Supplier
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setSelectedOrder(null);
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Modal - Batch Expiration Input */}
        {isDeliveryModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Mark Order as Delivered</h2>
                      <p className="text-white/80 text-sm mt-1">Enter expiration dates for each product batch</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsDeliveryModalOpen(false);
                      setDeliveryExpirationDates({});
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Error Display */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 flex-1 text-sm">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-600 hover:text-red-700 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Order Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-blue-900">Order: {selectedOrder.orderId || selectedOrder.id}</p>
                        <p className="text-sm text-blue-700">Supplier: {selectedOrder.supplierName || 'Unknown'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-blue-700">Total Amount</p>
                        <p className="text-lg font-bold text-blue-900">₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Product Expiration Dates */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Enter Expiration Dates for Each Product</h3>
                    <div className="space-y-4">
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map((item, index) => (
                          <Card key={item.productId || index} className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{item.productName}</h4>
                                {item.sku && (
                                  <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                                )}
                                <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                                  <span>Quantity: <strong>{item.quantity}</strong></span>
                                  <span>Unit Price: <strong>₱{(item.unitPrice || 0).toLocaleString()}</strong></span>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Expiration Date *
                                </label>
                                <Input
                                  type="date"
                                  value={deliveryExpirationDates[item.productId] || ''}
                                  onChange={(e) => {
                                    setDeliveryExpirationDates(prev => ({
                                      ...prev,
                                      [item.productId]: e.target.value
                                    }));
                                  }}
                                  required
                                  min={new Date().toISOString().split('T')[0]}
                                  className="w-48"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  {deliveryExpirationDates[item.productId] 
                                    ? format(new Date(deliveryExpirationDates[item.productId]), 'MMM dd, yyyy')
                                    : 'Select date'}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))
                      ) : (
                        <p className="text-gray-500 text-center py-8">No items in this order</p>
                      )}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-semibold mb-1">Batch Expiration Tracking</p>
                        <p>Each product will be tracked in batches with the expiration date you specify. The system will use FIFO (First In, First Out) to manage stock rotation, using the oldest batches first.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeliveryModalOpen(false);
                      setDeliveryExpirationDates({});
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMarkAsDelivered}
                    disabled={isMarkingDelivered || !selectedOrder.items || selectedOrder.items.length === 0}
                    className="bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMarkingDelivered ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing Delivery...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Confirm Delivery
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Order Modal */}
        {isConfirmOrderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[80vh] transform transition-all duration-300 scale-100 flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {isEditMode ? 'Confirm Order Update' : 'Confirm Purchase Order'}
                      </h2>
                      <p className="text-white/80 text-sm mt-1">
                        {isEditMode ? 'Please review your changes before updating' : 'Please review your order before submitting'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setIsConfirmOrderModalOpen(false)}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {/* Order Summary */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Supplier:</span>
                        <span className="font-medium text-gray-900">{selectedSupplierName || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order Date:</span>
                        <span className="font-medium text-gray-900">
                          {orderFormData.orderDate ? format(new Date(orderFormData.orderDate), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expected Delivery:</span>
                        <span className="font-medium text-gray-900">
                          {orderFormData.expectedDelivery ? format(new Date(orderFormData.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Number of Items:</span>
                        <span className="font-medium text-gray-900">{orderItems.length}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-300">
                        <span className="font-semibold text-gray-900">Total Amount:</span>
                        <span className="text-lg font-bold text-[#160B53]">₱{orderTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
                    <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                      {orderItems.map((item, index) => (
                        <div key={index} className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1 mr-2">{item.productName}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                              item.usageType === 'salon-use'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {item.usageType === 'salon-use' ? 'Salon' : 'OTC'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>Quantity:</span>
                              <span className="font-medium">{item.quantity}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>Unit Price:</span>
                              <span className="font-medium">₱{item.unitPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1 border-t border-gray-100">
                              <span>Total:</span>
                              <span>₱{item.totalPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {orderFormData.notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Notes:</p>
                      <p className="text-sm text-blue-700">{orderFormData.notes}</p>
                    </div>
                  )}

                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsConfirmOrderModalOpen(false)}
                    disabled={isSubmitting}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      setIsConfirmOrderModalOpen(false);
                      await handleSubmitOrder();
                    }}
                    disabled={isSubmitting}
                    className="bg-[#160B53] text-white hover:bg-[#12094A] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Order...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        {isEditMode ? 'Confirm & Update Order' : 'Confirm & Create Order'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* High Stock Warning Modal */}
        {isHighStockWarningModalOpen && pendingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">High Stock Warning</h2>
                      <p className="text-white/90 text-sm mt-1">Reorder policy violation</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleHighStockWarningCancel}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Warning Message */}
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-orange-900 mb-2">
                          {pendingProduct.name} currently has {pendingCurrentStock} units in stock
                        </h3>
                        <p className="text-sm text-orange-800">
                          The reorder policy states that you should only order when stock is 5 units or less.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Product Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Product Name:</span>
                        <span className="font-medium text-gray-900">{pendingProduct.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Current Stock:</span>
                        <span className="font-bold text-orange-600">{pendingCurrentStock} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reorder Threshold:</span>
                        <span className="font-medium text-gray-900">5 units or less</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-300">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-semibold text-orange-600">Stock Level Too High</span>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <strong>Recommendation:</strong> It is not recommended to order this product at this time. 
                      Consider waiting until the stock level drops to 5 units or less before placing an order.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <strong>Do you want to proceed anyway?</strong> This action will add the product to your order despite the high stock level.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleHighStockWarningCancel}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleHighStockWarningConfirm}
                    className="bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Proceed Anyway (Not Recommended)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Confirmation Modal */}
        {isClearAllModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Clear All Items</h2>
                      <p className="text-white/90 text-sm">Remove all items from order</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setIsClearAllModalOpen(false)}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-red-100 rounded-full flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium mb-2">
                      Are you sure you want to clear all {orderItems.length} item{orderItems.length !== 1 ? 's' : ''} from this order?
                    </p>
                    <p className="text-sm text-gray-600">
                      This action cannot be undone. You will need to re-add products to continue with your order.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsClearAllModalOpen(false)}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setOrderItems([]);
                    setInitialOrderItems([]);
                    setIsClearAllModalOpen(false);
                    toast.success('All items cleared from order');
                  }}
                  className="bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All Items
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {isSuccessModalOpen && createdOrderDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Order Created Successfully!</h2>
                      <p className="text-white/80 text-sm mt-1">Purchase order has been submitted</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsSuccessModalOpen(false);
                      setCreatedOrderDetails(null);
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Success Message */}
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Purchase Order Submitted</h3>
                    <p className="text-sm text-gray-600">
                      Your order has been successfully created and is now pending approval.
                    </p>
                  </div>

                  {/* Order Details */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Order Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order ID:</span>
                        <span className="font-medium text-gray-900">{createdOrderDetails.orderId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Supplier:</span>
                        <span className="font-medium text-gray-900">{createdOrderDetails.supplierName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Items:</span>
                        <span className="font-medium text-gray-900">{createdOrderDetails.itemsCount} items</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="font-medium text-[#160B53]">₱{createdOrderDetails.totalAmount?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expected Delivery:</span>
                        <span className="font-medium text-gray-900">
                          {createdOrderDetails.expectedDelivery ? format(new Date(createdOrderDetails.expectedDelivery), 'MMM dd, yyyy') : 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Next Steps */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Order will be reviewed by the Overall Inventory Controller</li>
                      <li>• You'll receive a notification once approved or rejected</li>
                      <li>• Track your order status in the Purchase Orders list</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      setIsSuccessModalOpen(false);
                      setCreatedOrderDetails(null);
                    }}
                    className="bg-[#160B53] text-white hover:bg-[#12094A] px-8"
                  >
                    Got it!
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Options Modal */}
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Printer className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Print Options</h2>
                    <p className="text-white/80 text-sm mt-1">Choose print format</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setIsPrintModalOpen(false);
                      handlePrintReport(false);
                    }}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Print Summary</h3>
                        <p className="text-sm text-gray-600">Order overview without product details</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsPrintModalOpen(false);
                      handlePrintReport(true);
                    }}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                        <Package className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Print with Details</h3>
                        <p className="text-sm text-gray-600">Include all product details and quantities</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsPrintModalOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Filter Purchase Orders</h2>
                  <Button
                    variant="ghost"
                    onClick={() => setIsFilterModalOpen(false)}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Received Status</label>
                  <select
                    value={selectedReceivedStatus}
                    onChange={(e) => setSelectedReceivedStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="received">Received</option>
                    <option value="not-received">Not Received</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                  <select
                    value={selectedSupplierFilter}
                    onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Suppliers</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Date From</label>
                  <input
                    type="date"
                    value={dateFilterStart}
                    onChange={(e) => setDateFilterStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Date To</label>
                  <input
                    type="date"
                    value={dateFilterEnd}
                    onChange={(e) => setDateFilterEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedReceivedStatus('all');
                    setSelectedSupplierFilter('all');
                    setDateFilterStart('');
                    setDateFilterEnd('');
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Reset
                </Button>
                <Button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-[#160B53] text-white hover:bg-[#12094A]"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Email to Supplier Modal */}
        {isEmailModalOpen && emailOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#2563eb] text-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Email Purchase Order to Supplier</h2>
                      <p className="text-white/90 text-sm">
                        {emailOrder.orderId || emailOrder.id} • {suppliers.find(s => s.id === emailOrder.supplierId)?.name || 'Supplier'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsEmailModalOpen(false);
                      setEmailOrder(null);
                      setEmailMessage('');
                      setEmailSubject('');
                      setEmailPdfUrl('');
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Email Form */}
                  <div className="space-y-4">
                    {/* Recipient Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Recipient</span>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          {suppliers.find(s => s.id === emailOrder.supplierId)?.name || 'Supplier'}
                        </p>
                        <p className="text-gray-600">
                          {suppliers.find(s => s.id === emailOrder.supplierId)?.email || 'No email'}
                        </p>
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <Input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full"
                        placeholder="Email subject..."
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                      <textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                        placeholder="Enter your message to the supplier..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This message will appear at the top of the email. Order details will be included automatically.
                      </p>
                    </div>

                    {/* Order Summary */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">PO Number:</span>
                          <span className="font-medium">{emailOrder.orderId || emailOrder.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Items:</span>
                          <span className="font-medium">{emailOrder.items?.length || 0} products</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Amount:</span>
                          <span className="font-medium text-[#160B53]">₱{(emailOrder.totalAmount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Email Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Email Preview</h4>
                      {isGeneratingPdf ? (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating PDF...
                        </span>
                      ) : emailPdfUrl ? (
                        <a 
                          href={emailPdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded hover:bg-green-200 flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          PDF Ready - Click to Preview
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Live Preview</span>
                      )}
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">To:</span> {suppliers.find(s => s.id === emailOrder.supplierId)?.email || 'No email'}
                        </div>
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">Subject:</span> {emailSubject || '(No subject)'}
                        </div>
                        <div className="text-xs mt-1">
                          <span className="font-medium">📎 PDF:</span>{' '}
                          {isGeneratingPdf ? (
                            <span className="text-blue-600">Generating...</span>
                          ) : emailPdfUrl ? (
                            <a href={emailPdfUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                              {emailPdfUrl.substring(0, 50)}...
                            </a>
                          ) : (
                            <span className="text-gray-400">Not ready</span>
                          )}
                        </div>
                      </div>
                      <div 
                        className="p-0 max-h-[400px] overflow-y-auto"
                        style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.33%', height: '133.33%' }}
                      >
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: generateEmailHTML(emailOrder, emailMessage || '(Your message will appear here...)', emailPdfUrl || '#') 
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Printer className="h-4 w-4" />
                  <button
                    onClick={() => handlePrintReport(false, emailOrder)}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Print PO instead
                  </button>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEmailModalOpen(false);
                      setEmailOrder(null);
                      setEmailMessage('');
                      setEmailSubject('');
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || isGeneratingPdf || !emailPdfUrl || !emailSubject.trim() || !emailMessage.trim()}
                    className="bg-[#160B53] text-white hover:bg-[#12094A] flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : isGeneratingPdf ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating PDF...
                      </>
                    ) : !emailPdfUrl ? (
                      <>
                        <AlertTriangle className="h-4 w-4" />
                        PDF Not Ready
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PurchaseOrders;
