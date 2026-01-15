/**
 * POS-Style Billing Modal Component
 * Design matches modern POS interface
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Banknote, Tag, Search, CreditCard, Wallet, Gift, Scissors, Package, Smartphone, Star, CheckCircle, AlertCircle, QrCode, Camera, Printer, Bluetooth } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import LoadingSpinner from '../ui/LoadingSpinner';
import { PAYMENT_METHODS, calculateBillTotals, checkReceiptNumberExists } from '../../services/billingService';
import { getActiveBIRReceiptBatch, getNextReceiptNumber } from '../../services/birReceiptService';
import { getBranchById } from '../../services/branchService';
import { getLoyaltyPoints } from '../../services/loyaltyService';
import { validatePromotionCode, calculatePromotionDiscount, trackPromotionUsage } from '../../services/promotionService';
import { thermalPrinter } from '../../services/thermalPrinterService';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';
import { inventoryService } from '../../services/inventoryService';
import { formatDate } from '../../utils/helpers';
import Receipt from './Receipt';

const BillingModalPOS = ({
  isOpen,
  appointment,
  onClose,
  onSubmit,
  loading,
  services = [],
  stylists = [],
  clients = [],
  mode = 'billing' // 'billing', 'start-service', or 'checkin'
}) => {
  const { userBranch, userData } = useAuth();
  const [branchData, setBranchData] = useState(null);
  const [formData, setFormData] = useState({
    items: [], // Each item will have: { id, name, price, basePrice, stylistId, stylistName, clientType, adjustment, adjustmentReason }
    discountType: 'fixed',
    discount: '',
    loyaltyPointsUsed: '',
    paymentMethod: PAYMENT_METHODS.CASH,
    paymentReference: '',
    receiptNumber: '',
    amountReceived: '',
    notes: '',
  });

  const [serviceSearch, setServiceSearch] = useState('');
  const [matchedClient, setMatchedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [isGuestCustomer, setIsGuestCustomer] = useState(false);
  const [activeTab, setActiveTab] = useState(mode === 'products-only' ? 'product' : 'service'); // 'service' or 'product'
  const [clientLoyaltyPoints, setClientLoyaltyPoints] = useState(0);
  
  // Promotion code states
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionDiscount, setPromotionDiscount] = useState(0);
  const [validatingPromotion, setValidatingPromotion] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  
  // Products and stocks
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [stocksData, setStocksData] = useState([]);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // QR Code Scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const isProcessingQRCodeRef = useRef(false); // Use ref instead of state for immediate effect
  const qrCodeScannerRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoPreviewRef = useRef(null);
  
  // Receipt number validation states
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  const [existingReceipt, setExistingReceipt] = useState(null);
  const [showReceiptDetails, setShowReceiptDetails] = useState(false);
  
  // BIR Receipt Batch states
  const [activeBatch, setActiveBatch] = useState(null);
  const [nextReceiptNumber, setNextReceiptNumber] = useState('');
  const [loadingReceiptNumber, setLoadingReceiptNumber] = useState(false);
  const [receiptNumberError, setReceiptNumberError] = useState('');
  
  // Thermal Printer states
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState('');
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  
  // Transaction ID preview
  const [previewTransactionId, setPreviewTransactionId] = useState(null);
  const [loadingTransactionId, setLoadingTransactionId] = useState(false);
  const [serviceProductCharges, setServiceProductCharges] = useState([]);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingBillData, setPendingBillData] = useState(null);
  
  // Receipt modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedBill, setCompletedBill] = useState(null);
  const receiptRef = useRef(null);
  
  // Service Product Usage Modal state
  const [showServiceProductModal, setShowServiceProductModal] = useState(false);
  const [serviceProductModalData, setServiceProductModalData] = useState({ itemIndex: null, productMappings: [] });
  
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    discountAmount: 0,
    promotionDiscount: 0,
    loyaltyDiscount: 0,
    serviceProductCharge: 0,
    total: 0,
    grandTotal: 0,
    vat: 0,
    cashChange: 0,
  });

  // Branch-filtered products (must exist in this branch's stocks)
  const branchProducts = useMemo(() => {
    const branchId = userBranch?.id || userBranch;
    const branchStocks = (stocksData || []).filter(s => !s.branchId || (branchId && s.branchId === branchId));
    const branchProductIds = new Set(branchStocks.map(s => s.productId));
    // If we have no branch stocks yet, allow all products so UI is usable; otherwise enforce branch products
    if (branchProductIds.size === 0) return availableProducts || [];
    return (availableProducts || []).filter(p => branchProductIds.has(p.id));
  }, [availableProducts, stocksData, userBranch]);

  // Get eligible stylists for a service (based on stylist.serviceId or service_id array)
  const getEligibleStylistsForService = useCallback((serviceId) => {
    if (!stylists || stylists.length === 0) return [];
    if (!serviceId) return stylists; // If no serviceId, return all stylists
    
    // Filter stylists who can perform this service
    const eligible = stylists.filter(stylist => {
      const stylistServiceIds = stylist.serviceId || stylist.service_id || [];
      // If stylist has no service restrictions, they can do any service
      if (!Array.isArray(stylistServiceIds) || stylistServiceIds.length === 0) return true;
      return stylistServiceIds.includes(serviceId);
    });
    
    // If no eligible stylists found, return all stylists as fallback
    return eligible.length > 0 ? eligible : stylists;
  }, [stylists]);

  // Debug: log mapped products per service (e.g., Balayage) and branch-filtered availability
  useEffect(() => {
    if (!services || services.length === 0) return;
    const balayage = services.find(s => (s.serviceName || s.name || '').toLowerCase().includes('balayage'));
    if (balayage) {
      console.log('🧾 Balayage product mappings:', balayage.productMappings || []);
      console.log('🏪 Branch products (id only):', branchProducts.map(p => p.id));
      console.log('🏪 Branch products (detailed):', branchProducts);
      console.log('📦 Available products (detailed):', availableProducts);
    }
  }, [services, branchProducts, availableProducts]);

  // Map productId -> price for quick lookup
  const productPriceMap = useMemo(() => {
    return (availableProducts || []).reduce((acc, p) => {
      acc[p.id] = p.price || p.otcPrice || 0;
      return acc;
    }, {});
  }, [availableProducts]);

  const getServiceProductCharge = useCallback((serviceItem) => {
    if (!serviceItem || serviceItem.type !== 'service') return 0;
    if (!Array.isArray(serviceItem.productMappings) || serviceItem.productMappings.length === 0) return 0;
    let total = 0;
    const qty = serviceItem.quantity || 1;
    serviceItem.productMappings.forEach(mapping => {
      if (!mapping?.productId || !mapping?.percentage) return;
      const pct = parseFloat(mapping.percentage) || 0;
      const productPrice = productPriceMap[mapping.productId] || 0;
      total += (productPrice * (pct / 100)) * qty;
    });
    return total;
  }, [productPriceMap]);

  // Clear loyalty state outside of checkout contexts
  useEffect(() => {
    if (mode !== 'billing' && mode !== 'products-only') {
      setClientLoyaltyPoints(0);
      setFormData(prev => ({ ...prev, loyaltyPointsUsed: '' }));
    }
  }, [mode]);

  // Fetch client loyalty points when appointment/client changes
  useEffect(() => {
    const fetchLoyaltyPoints = async () => {
      const clientId = appointment?.clientId || formData.clientId;
      const branchId = appointment?.branchId || userBranch?.id || userBranch;
      if (!clientId || !branchId || !isOpen) return;

      try {
        const points = await getLoyaltyPoints(clientId, branchId);
        setClientLoyaltyPoints(points);
      } catch (error) {
        console.error('Error fetching loyalty points:', error);
        setClientLoyaltyPoints(0);
      }
    };

    fetchLoyaltyPoints();
  }, [isOpen, appointment?.clientId, appointment?.branchId, formData.clientId, userBranch]);

  // Calculate preview transaction ID
  useEffect(() => {
    const calculatePreviewTransactionId = async () => {
      if (!isOpen || !userBranch || mode !== 'billing') {
        setPreviewTransactionId(null);
        return;
      }

      try {
        setLoadingTransactionId(true);
        
        // Get branch document to get its ID
        const branch = await getBranchById(userBranch);
        const branchDocId = branch.id;
        
        // Extract first 3 characters of branch document ID (uppercase)
        const branchCode = branchDocId.substring(0, 3).toUpperCase().padEnd(3, 'X');
        
        // Count existing transactions for this branch
        const transactionsRef = collection(db, 'transactions');
        const branchTransactionsQuery = query(
          transactionsRef,
          where('branchId', '==', userBranch)
        );
        const existingTransactions = await getDocs(branchTransactionsQuery);
        const transactionCount = existingTransactions.size + 1; // +1 for this new transaction
        
        // Format: BRANCHCODE-XXXX (4 digits, zero-padded)
        const previewId = `${branchCode}-${String(transactionCount).padStart(4, '0')}`;
        setPreviewTransactionId(previewId);
      } catch (error) {
        console.error('Error calculating preview transaction ID:', error);
        // Fallback: use branch ID first 3 chars if branch fetch fails
        try {
          const branchCode = userBranch.substring(0, 3).toUpperCase().padEnd(3, 'X');
          const transactionsRef = collection(db, 'transactions');
          const fallbackQuery = query(
            transactionsRef,
            where('branchId', '==', userBranch)
          );
          const fallbackTransactions = await getDocs(fallbackQuery);
          const transactionCount = fallbackTransactions.size + 1;
          const previewId = `${branchCode}-${String(transactionCount).padStart(4, '0')}`;
          setPreviewTransactionId(previewId);
        } catch (fallbackError) {
          console.error('Error in fallback transaction ID calculation:', fallbackError);
          setPreviewTransactionId(null);
        }
      } finally {
        setLoadingTransactionId(false);
      }
    };

    calculatePreviewTransactionId();
  }, [isOpen, userBranch, mode]);

  // Fetch active BIR receipt batch and preview next receipt number
  useEffect(() => {
    const fetchBIRBatchInfo = async () => {
      if (!isOpen || !userBranch || (mode !== 'billing' && mode !== 'products-only')) {
        setActiveBatch(null);
        setNextReceiptNumber('');
        setReceiptNumberError('');
        return;
      }

      try {
        setLoadingReceiptNumber(true);
        setReceiptNumberError('');
        
        const branchId = userBranch?.id || userBranch;
        const batch = await getActiveBIRReceiptBatch(branchId);
        
        if (batch) {
          setActiveBatch(batch);
          // Preview the next receipt number (currentNumber + 1) - just the number, no prefix
          const nextNum = batch.currentNumber + 1;
          const paddedNumber = String(nextNum).padStart(String(batch.endNumber).length, '0');
          setNextReceiptNumber(paddedNumber);
          
          // Auto-fill the receipt number in form
          setFormData(prev => ({ ...prev, receiptNumber: paddedNumber }));
          
          // Warn if batch is running low
          if (batch.remainingReceipts <= 10) {
            toast(`⚠️ Receipt batch running low: ${batch.remainingReceipts} remaining`, {
              icon: '📋',
              duration: 4000
            });
          }
        } else {
          setActiveBatch(null);
          setNextReceiptNumber('');
          setReceiptNumberError('No active receipt batch. Please ask your Branch Manager to add a new batch.');
        }
      } catch (error) {
        console.error('Error fetching BIR batch info:', error);
        setReceiptNumberError(error.message || 'Failed to load receipt batch');
      } finally {
        setLoadingReceiptNumber(false);
      }
    };

    fetchBIRBatchInfo();
  }, [isOpen, userBranch, mode]);

  // Reset form data when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(prev => ({
        ...prev,
        receiptNumber: '', // Reset receipt number when modal closes
        items: [],
        discount: '',
        loyaltyPointsUsed: '',
        paymentMethod: PAYMENT_METHODS.CASH,
        paymentReference: '',
        amountReceived: '',
        tax: ''
      }));
      setAppliedPromotion(null);
      setPromotionCode('');
      setPromotionDiscount(0);
      setPreviewTransactionId(null);
      setActiveBatch(null);
      setNextReceiptNumber('');
      setReceiptNumberError('');
    }
  }, [isOpen]);

  // Fetch products and stocks when modal opens
  useEffect(() => {
    const fetchProductsAndStocks = async () => {
      if (!isOpen || !userBranch) return;


      try {
        setLoadingProducts(true);

        // Fetch products available to this branch
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        
        const branchProducts = [];
        productsSnapshot.forEach((doc) => {
          const productData = doc.data();
          
          // Check if product is available to this branch
          const isAvailableToBranch = productData.branches && 
            Array.isArray(productData.branches) &&
            productData.branches.includes(userBranch);
          
          if (isAvailableToBranch) {
            branchProducts.push({
              id: doc.id,
              name: productData.name || 'Unknown Product',
              price: productData.otcPrice || productData.salonUsePrice || productData.unitCost || 0,
              basePrice: productData.otcPrice || productData.salonUsePrice || productData.unitCost || 0,
              category: productData.category || '',
              brand: productData.brand || '',
              imageUrl: productData.imageUrl || '',
              description: productData.description || '',
              status: productData.status || 'Active',
              stock: 0, // Will be updated with stock data
              ...productData
            });
          }
        });

        // Fetch stock information for this branch from stocks collection
        const stocksRef = collection(db, 'stocks');
        const stocksQuery = query(
          stocksRef,
          where('branchId', '==', userBranch),
          where('status', '==', 'active')
        );
        const stocksSnapshot = await getDocs(stocksQuery);

        const stocks = [];
        stocksSnapshot.forEach((doc) => {
          const stockData = doc.data();
          stocks.push({
            id: doc.id,
            productId: stockData.productId,
            productName: stockData.productName,
            realTimeStock: stockData.realTimeStock || 0,
            status: stockData.status || 'active',
            ...stockData
          });
        });

        // THIRD: Merge products with stock data (using the local stocks variable)
        const productsWithStock = branchProducts.map((product) => {
          console.log('🔍 Processing product:', product.name, product.id);
          console.log('📊 stocks:', stocks);

          // Get ALL non-salon-use batches for this product from stocks collection
          const productAllBatches = stocks.filter(stock => {
            const matches = stock.productId === product.id &&
                           stock.status === 'active' &&
                           stock.usageType !== 'salon-use' && // Exclude salon-use batches
                           (stock.realTimeStock || 0) > 0;
            console.log('🔎 Stock check:', stock.productId, stock.realTimeStock, stock.status, stock.usageType, '→ matches:', matches);
            return matches;
          });

          console.log('✅ Filtered batches:', productAllBatches);

          // Calculate total stock (sum of all batches for this product)
          const totalStock = productAllBatches.reduce((total, batch) => total + (batch.realTimeStock || 0), 0);

          console.log('💰 Total stock for', product.name, ':', totalStock);

          // Get stock record for additional info
          const stock = stocks.find(s => s.productId === product.id);

          return {
            ...product,
            stock: totalStock,
            stockId: stock?.id || null,
            stockStatus: totalStock > 10 ? 'High Stock' :
                        totalStock > 0 ? 'Low Stock' : 'Out of Stock',
            allBatches: productAllBatches // Store all non-salon-use batches for display
          };
        });

        // Set stocks data for use in other functions
        console.log('=== STOCKS FETCH DEBUG ===');
        console.log('Raw stocks from Firestore:', stocks);
        setStocksData(stocks);
        console.log('Stocks data set to state, will be available on next render');

        // Only show active products
        setAvailableProducts(productsWithStock.filter(p => p.status === 'Active'));
      } catch (error) {
        console.error('Error fetching products and stocks:', error);
        toast.error('Failed to load products');
        setAvailableProducts([]);
        setStocksData([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    if (isOpen) {
      fetchProductsAndStocks();
    } else {
      // Reset when modal closes
      setAvailableProducts([]);
    }
  }, [isOpen, userBranch]);

  useEffect(() => {
    console.log('🔄 initializeForm useEffect triggered, isOpen:', isOpen, 'appointment:', appointment?.id, 'mode:', mode);
    const initializeForm = async () => {
      if (isOpen) {
        console.log('🚀 Starting initializeForm for appointment:', appointment?.id, 'mode:', mode);

        // For Quick POS (products-only mode), initialize immediately with empty form
        if (mode === 'products-only') {
          console.log('🎯 Quick POS mode detected - initializing with empty form');
          setFormData({
            items: [],
            discountType: 'fixed',
            discount: '',
            loyaltyPointsUsed: '',
            paymentMethod: PAYMENT_METHODS.CASH,
            paymentReference: '',
            amountReceived: '',
            clientName: '',
            clientPhone: '',
            clientEmail: '',
            notes: ''
          });
          console.log('✅ Quick POS initialized, setting initialDataLoaded to true');
          setInitialDataLoaded(true);
          return;
        }

        // Initialize client info (for walk-in or from appointment)
        const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
        // Check if this is a checkout with existing services (from arrivals - walk-in or appointment)
        const hasExistingServices = appointment?.services?.length > 0 || appointment?.serviceName;
        // For walk-in checkout, we should pre-fill with arrival data
        const isWalkInCheckout = isWalkIn && hasExistingServices && mode === 'billing';
        // For check-in mode, always use appointment data regardless of client type
        const isCheckInMode = mode === 'checkin';

      if (isCheckInMode) {
        // For check-in mode (new appointments or walk-ins), use appointment data
        setClientSearch(appointment?.clientName || '');
        setFormData(prev => ({
          ...prev,
          clientName: appointment?.clientName || '',
          clientPhone: appointment?.clientPhone || '',
          clientEmail: appointment?.clientEmail || '',
          clientId: appointment?.clientId || '',
          items: []
        }));
        setMatchedClient(null);
        setShowClientList(false);
      } else if (isWalkIn && !isWalkInCheckout) {
        // For new walk-in (no existing services), start with empty fields
        setFormData(prev => ({
          ...prev,
          clientName: '',
          clientPhone: '',
          clientEmail: '',
          clientId: '',
          items: []
        }));
        setMatchedClient(null);
        setClientSearch('');
        setShowClientList(false);
      } else if (isWalkInCheckout) {
        // For walk-in checkout with existing services, pre-fill client info from arrival
        setClientSearch(appointment?.clientName || '');
        setFormData(prev => ({
          ...prev,
          clientName: appointment?.clientName || '',
          clientPhone: appointment?.clientPhone || '',
          clientEmail: appointment?.clientEmail || '',
          clientId: appointment?.clientId || '',
          items: [] // Will be filled below
        }));
        setMatchedClient(null);
        setShowClientList(false);
      } else {
        // Sync clientSearch with formData.clientName for appointment-based billing
        setClientSearch(appointment?.clientName || '');
        // For appointment, use appointment client data
        setFormData(prev => ({
          ...prev,
          clientName: appointment?.clientName || '',
          clientPhone: appointment?.clientPhone || '',
          clientEmail: appointment?.clientEmail || '',
          clientId: appointment?.clientId || '',
          items: []
        }));
        setMatchedClient(null);
      }

      // If appointment/arrival exists and has services/products, load them
      // This includes walk-in checkouts and regular billing with existing data
      if (appointment) {
        console.log('📋 BillingModalPOS - Loading appointment services:', appointment.services);
        
        // Load services
        const serviceItems = appointment.services && appointment.services.length > 0
          ? appointment.services.map(svc => {
              console.log('📋 Processing service:', svc.serviceName, 'quantity:', svc.quantity);
              // Read client type and adjustments from appointment if they exist
              // These should be set when confirming/starting the appointment
              const basePrice = svc.price || svc.basePrice || 0;
              const adjustment = svc.adjustment || 0;
              const adjustedPrice = svc.adjustedPrice || (basePrice + adjustment);
              
              // Look up the full service from the services prop to get productMappings
              const fullService = services.find(s => s.id === svc.serviceId);
              const serviceMappings = Array.isArray(fullService?.productMappings) ? fullService.productMappings : [];
              
              return {
                type: 'service',
                id: svc.serviceId,
                name: svc.serviceName,
                basePrice: basePrice,
                price: adjustedPrice, // Use adjusted price if available
                quantity: svc.quantity || 1, // Read quantity from appointment service
                stylistId: svc.stylistId,
                stylistName: svc.stylistName,
                originalStylistId: svc.stylistId, // Store original stylist for restoration
                originalStylistName: svc.stylistName, // Store original stylist name for restoration
                clientType: svc.clientType || 'R', // Read from appointment
                adjustment: adjustment, // Read from appointment
                adjustmentReason: svc.adjustmentReason || '', // Read from appointment
                productMappings: serviceMappings,
                // Start with empty usages - user will click "Add Product" to add them
                serviceProductUsages: []
              };
            })
          : appointment.serviceName
          ? (() => {
              // Look up the full service from the services prop to get productMappings
              const fullService = services.find(s => s.id === appointment.serviceId);
              const serviceMappings = Array.isArray(fullService?.productMappings) ? fullService.productMappings : [];
              
              return [{
                type: 'service',
                id: appointment.serviceId || '',
                name: appointment.serviceName,
                basePrice: appointment.servicePrice || appointment.basePrice || 0,
                price: appointment.adjustedPrice || appointment.servicePrice || 0,
                quantity: 1,
                stylistId: appointment.stylistId,
                stylistName: appointment.stylistName,
                originalStylistId: appointment.stylistId, // Store original stylist for restoration
                originalStylistName: appointment.stylistName, // Store original stylist name for restoration
                clientType: appointment.clientType || 'R',
                adjustment: appointment.adjustment || 0,
                adjustmentReason: appointment.adjustmentReason || '',
                productMappings: serviceMappings,
                // Start with empty usages - user will click "Add Product" to add them
                serviceProductUsages: []
              }];
            })()
          : [];

        // Load products from appointment (pre-selected products should load immediately)
        console.log('🔍 Loading products from appointment:', appointment?.products);
        console.log('📊 stocksData available:', stocksData?.length || 0, 'items');
        let productItems = [];

        // Load pre-selected products from appointment immediately
        if (appointment?.products && appointment.products.length > 0) {
          if (stocksData && stocksData.length > 0) {
            // Stocks data is available - load with proper stock info
            const productPromises = appointment.products.map(async (prod) => {
              try {
                console.log('📦 Processing product with stock data:', prod);

                // Calculate stock information from loaded stocksData
                let stock = 0;
                let allBatches = [];

                // Get all OTC batches for this product from stocksData
                const productOtcBatches = stocksData.filter(stockItem =>
                  stockItem.productId === prod.productId &&
                  stockItem.status === 'active' &&
                  stockItem.usageType !== 'salon-use' &&
                  (stockItem.realTimeStock || stockItem.remainingQuantity || 0) > 0
                );

                // Calculate total available stock from all OTC batches
                stock = productOtcBatches.reduce((total, batch) => total + (batch.realTimeStock || batch.remainingQuantity || 0), 0);

                // Store all batch information for display
                allBatches = productOtcBatches.map(batch => ({
                  id: batch.id,
                  batchNumber: batch.batchNumber,
                  remainingQuantity: batch.realTimeStock || batch.remainingQuantity || 0,
                  expirationDate: batch.expirationDate?.toDate ? batch.expirationDate.toDate() : batch.expirationDate,
                  receivedDate: batch.receivedDate?.toDate ? batch.receivedDate.toDate() : batch.receivedDate
                }));

                // For billing mode, we don't need to pre-allocate batches since user can modify quantities
                let allocatedBatches = [];

                return {
                  type: 'product',
                  id: prod.productId,
                  name: prod.productName,
                  basePrice: prod.price,
                  price: prod.total || (prod.price * (prod.quantity || 1)),
                  quantity: prod.quantity || 1,
                  stock: stock,
                  batches: allocatedBatches,
                  allBatches: allBatches,
                  unitCost: 0,
                  commissionPercentage: 0,
                  commissionerId: '',
                  commissionerName: '',
                  commissionPoints: 0
                };
              } catch (error) {
                console.error('Error processing product:', prod.productId, error);
                return null;
              }
            });

            // Use Promise.allSettled to handle individual failures
            const results = await Promise.allSettled(productPromises);
            for (const result of results) {
              if (result.status === 'fulfilled' && result.value) {
                productItems.push(result.value);
              } else if (result.status === 'rejected') {
                console.error('Product loading failed:', result.reason);
              }
            }
          } else {
            // Stocks data not available yet - load products with placeholder stock info
            console.log('⏳ stocksData not loaded yet, loading products without stock info');
            productItems = appointment.products.map(prod => ({
              type: 'product',
              id: prod.productId,
              name: prod.productName,
              basePrice: prod.price,
              price: prod.total || (prod.price * (prod.quantity || 1)),
              quantity: prod.quantity || 1,
              stock: 0, // Placeholder - will be updated when stocksData loads
              batches: [],
              allBatches: [],
              unitCost: 0,
              commissionPercentage: 0,
              commissionerId: '',
              commissionerName: '',
              commissionPoints: 0
            }));
          }
        }

        // Combine services and products
        const items = [...serviceItems, ...productItems];

        // Load billing fields (discount, tax rate, etc.) if they exist
        setFormData(prev => ({
          ...prev,
          items,
          discount: appointment?.discount !== undefined ? String(appointment.discount) : prev.discount,
          discountType: appointment?.discountType || prev.discountType,
          tax: appointment?.taxRate !== undefined ? String(appointment.taxRate) : (appointment?.tax !== undefined ? String(appointment.tax) : prev.tax) // Support both taxRate and tax for backward compatibility
        }));

        // Mark initial data loading as complete
        console.log('✅ Setting initialDataLoaded to true, items count:', items.length);
        setInitialDataLoaded(true);
      }
    } else {
      // Reset form when modal closes
      setFormData({
        items: [],
        discountType: 'fixed',
        discount: '',
        loyaltyPointsUsed: '',
        paymentMethod: PAYMENT_METHODS.CASH,
        paymentReference: '',
        notes: '',
        amountReceived: '',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        clientId: ''
      });

      // Reset guest customer state
      setIsGuestCustomer(false);
    }
    };

    initializeForm();
  }, [appointment, isOpen]);

  // Update product stock information when stocksData becomes available
  useEffect(() => {
    console.log('🔍 Stock update useEffect triggered:', {
      stocksDataLength: stocksData?.length,
      formDataItemsLength: formData.items.length,
      initialDataLoaded
    });

    if (stocksData && stocksData.length > 0 && formData.items.length > 0) {
      const productsToUpdate = formData.items.filter(item => item.type === 'product');

      if (productsToUpdate.length > 0) {
        console.log('🔄 Updating product stock info with loaded stocksData');

        setFormData(prev => ({
          ...prev,
          items: prev.items.map(item => {
            if (item.type === 'product') {
              // Get all OTC batches for this product from stocksData
              const productOtcBatches = stocksData.filter(stockItem =>
                stockItem.productId === item.id &&
                stockItem.status === 'active' &&
                stockItem.usageType !== 'salon-use' &&
                (stockItem.realTimeStock || stockItem.remainingQuantity || 0) > 0
              );

              // Calculate total available stock from all OTC batches
              const stock = productOtcBatches.reduce((total, batch) => total + (batch.realTimeStock || batch.remainingQuantity || 0), 0);

              // Store all batch information for display
              const allBatches = productOtcBatches.map(batch => ({
                id: batch.id,
                batchNumber: batch.batchNumber,
                remainingQuantity: batch.realTimeStock || batch.remainingQuantity || 0,
                expirationDate: batch.expirationDate?.toDate ? batch.expirationDate.toDate() : batch.expirationDate,
                receivedDate: batch.receivedDate?.toDate ? batch.receivedDate.toDate() : batch.receivedDate
              }));

              return {
                ...item,
                stock: stock,
                allBatches: allBatches
              };
            }
            return item;
          })
        }));
      }
    }
  }, [stocksData, formData.items.length]);

  useEffect(() => {
    // Calculate promotion discount if promotion is applied
    let promoDiscount = 0;
    if (appliedPromotion) {
      const services = formData.items.filter(item => item.type === 'service');
      const products = formData.items.filter(item => item.type === 'product');
      const subtotal = formData.items.reduce((sum, item) => sum + (item.price || 0), 0);
      const promoResult = calculatePromotionDiscount(appliedPromotion, subtotal, services, products);
      promoDiscount = promoResult.discountAmount;
      setPromotionDiscount(promoDiscount);
    } else {
      setPromotionDiscount(0);
    }

    // Compute service product charges (salon-use upsell) based on service productMappings
    const mappedCharges = [];
    (formData.items || [])
      .filter(it => it.type === 'service')
      .forEach(it => {
        const mappings = Array.isArray(it.productMappings) ? it.productMappings : [];
        const adHoc = Array.isArray(it.serviceProductUsages) ? it.serviceProductUsages : [];
        const combined = [...mappings, ...adHoc];
        combined.forEach(mapping => {
          if (!mapping?.productId || !mapping?.percentage) return;
          const productPrice = productPriceMap[mapping.productId] || 0;
          const pct = parseFloat(mapping.percentage) || 0;
          // Charge is % of product price; apply per service quantity. Quantity captured for reference.
          const amount = ((productPrice * (pct / 100)) || 0) * (it.quantity || 1);
          if (amount > 0) {
            mappedCharges.push({
              serviceId: it.id,
              serviceName: it.name,
              productId: mapping.productId,
              productName: mapping.productName || 'Mapped Product',
              percentage: pct,
              quantityUsed: mapping.quantity || '',
              unit: mapping.unit || '',
              charge: amount
            });
          }
        });
      });
    const serviceProductChargeTotal = mappedCharges.reduce((sum, c) => sum + (c.charge || 0), 0);
    setServiceProductCharges(mappedCharges);

    // If a promotion is applied, manual discount is disabled/ignored
    const effectiveDiscount = appliedPromotion ? 0 : (parseFloat(formData.discount) || 0);
    const effectiveDiscountType = appliedPromotion ? 'fixed' : formData.discountType;

    const calculated = calculateBillTotals({
      items: formData.items,
      discount: effectiveDiscount,
      discountType: effectiveDiscountType,
      serviceChargeRate: 0,
      loyaltyPointsUsed: parseInt(formData.loyaltyPointsUsed) || 0,
      promotionDiscount: promoDiscount
    });
    calculated.serviceProductCharge = serviceProductChargeTotal;
    calculated.total = (calculated.total || 0) + serviceProductChargeTotal;
    setTotals(calculated);
  }, [formData.items, formData.discount, formData.discountType, formData.loyaltyPointsUsed, appliedPromotion, availableProducts]);

  const handleToggleService = (service) => {
    console.log('🎯 handleToggleService - service:', service);
    console.log('🎯 handleToggleService - productMappings:', service.productMappings);
    const existing = formData.items.find(item => item.id === service.id && item.type === 'service');
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item => !(item.id === service.id && item.type === 'service'))
      }));
    } else {
      const serviceMappings = Array.isArray(service.productMappings) ? service.productMappings : [];
      console.log('🎯 handleToggleService - serviceMappings:', serviceMappings);
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          type: 'service',
          id: service.id,
          name: service.serviceName || service.name || 'Unknown Service',
          basePrice: service.price || 0,
          price: service.price || 0,
          quantity: 1,
          stylistId: '',
          stylistName: '',
          originalStylistId: '', // No original stylist for manually added items
          originalStylistName: '', // No original stylist for manually added items
          clientType: 'R',
          adjustment: 0,
          adjustmentReason: '',
          productMappings: serviceMappings,
          // Start with empty usages - user will click "Add Product" to add them
          serviceProductUsages: []
        }]
      }));
    }
  };

  const handleUpdateServiceQuantity = (serviceId, newQuantity) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === serviceId && item.type === 'service'
          ? { ...item, quantity: newQuantity }
          : item
      )
    }));
  };

  const handleRemoveService = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => !(item.id === serviceId && item.type === 'service'))
    }));
  };

  // Play checkout beep sound
  const playCheckoutSound = () => {
    try {
      // Create a simple beep using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1200; // Higher pitch beep
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      
      // Play a second beep for "checkout" feel
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1500;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.1);
      }, 100);
    } catch (e) {
      console.log('Could not play sound:', e);
    }
  };

  // Handle QR code scan result
  const handleQRCodeScanned = async (decodedText) => {
    // Prevent duplicate processing using ref for immediate check
    if (isProcessingQRCodeRef.current) {
      console.log('⏸️ QR code already being processed, ignoring duplicate scan');
      return;
    }
    
    isProcessingQRCodeRef.current = true;
    
    console.log('📱 QR Code scanned raw:', decodedText);
    console.log('📱 QR Code raw length:', decodedText?.length);
    
    // Play checkout sound immediately on scan
    playCheckoutSound();
    
    // Check if stocks data is loaded
    if (!stocksData || stocksData.length === 0) {
      toast.error('Product data not loaded yet. Please wait.');
      isProcessingQRCodeRef.current = false;
      return;
    }

    try {
      // Parse QR code data (should be JSON from UPC generator)
      let qrData;
      try {
        qrData = JSON.parse(decodedText);
        console.log('📦 Parsed QR data:', qrData);
        console.log('📦 QR data keys:', Object.keys(qrData));
      } catch (e) {
        // If not JSON, try to find product by UPC or other identifier
        console.error('Failed to parse QR code as JSON:', e);
        console.log('📱 Raw text that failed to parse:', decodedText);
        toast.error('Invalid QR code format - not valid JSON');
        return;
      }

      // Support both old format (productId, batchNumber) and compact format (p, b)
      const productId = qrData.productId || qrData.p;
      const batchNumber = qrData.batchNumber || qrData.b;
      const price = qrData.price || qrData.pr;
      const branchId = qrData.branchId || qrData.br;

      console.log('🔍 Extracted - productId:', productId, 'batch:', batchNumber, 'price:', price, 'branch:', branchId);

      if (!productId) {
        console.error('❌ No productId found in QR data');
        toast.error('QR code does not contain product information');
        return;
      }

      // Initialize productOtcBatches
      let productOtcBatches = [];

      // Find the product in available products
      let product = availableProducts.find(p => p.id === productId);
      console.log('📦 Found product in availableProducts:', product?.name || 'NOT FOUND');
      console.log('📦 Available products count:', availableProducts?.length);

      // If product found in available products, get its ALL non-salon-use batches
      if (product) {
        productOtcBatches = stocksData.filter(stockItem =>
          stockItem.productId === productId &&
          stockItem.status === 'active' &&
          stockItem.usageType !== 'salon-use' && // Exclude salon-use batches
          (stockItem.realTimeStock || 0) > 0
        );
        console.log('📦 Found OTC batches:', productOtcBatches.length);
      }

      // If product not found in current branch, try to load it
      if (!product && userBranch) {
        console.log('🔄 Product not in availableProducts, trying to load from Firestore...');
        try {
          // Try to get product from stocks collection first
          const stocksRef = collection(db, 'stocks');
          const stockQuery = query(
            stocksRef,
            where('branchId', '==', userBranch),
            where('productId', '==', productId)
          );
          const stockSnapshot = await getDocs(stockQuery);
          console.log('📦 Stocks query result:', stockSnapshot.size, 'docs found');
          
          if (!stockSnapshot.empty) {
            const stockDoc = stockSnapshot.docs[0].data();
            console.log('📦 Stock doc found:', stockDoc);
            
            // Get product details
            const productDocRef = doc(db, 'products', productId);
            const productDoc = await getDoc(productDocRef);
            
            if (productDoc.exists()) {
              const productData = productDoc.data();
              console.log('📦 Product data found:', productData.name);
              
              product = {
                id: productId,
                name: productData.name || qrData.productName,
                price: productData.otcPrice || productData.price || price || 0,
                stock: stockDoc.realTimeStock || stockDoc.remainingQuantity || 0,
                stockId: stockSnapshot.docs[0].id,
                unitCost: stockDoc.unitCost || 0,
                commissionPercentage: productData.commissionPercentage || 0
              };
              console.log('📦 Created product object:', product);

              // Try to get ALL non-salon-use batches for this manually loaded product
              productOtcBatches = stocksData.filter(stockItem =>
                stockItem.productId === productId &&
                stockItem.status === 'active' &&
                stockItem.usageType !== 'salon-use' &&
                (stockItem.realTimeStock || 0) > 0
              );
              console.log('📦 Found OTC batches for loaded product:', productOtcBatches.length);
            } else {
              console.log('❌ Product document not found in products collection');
            }
          } else {
            // Try branch_stocks as fallback
            console.log('🔄 No stocks found, trying branch_stocks...');
            const branchStocksRef = collection(db, 'branch_stocks');
            const branchStockQuery = query(
              branchStocksRef,
              where('branchId', '==', userBranch),
              where('productId', '==', productId)
            );
            const branchStockSnapshot = await getDocs(branchStockQuery);
            
            if (!branchStockSnapshot.empty) {
              const stockDoc = branchStockSnapshot.docs[0].data();
              const productDocRef = doc(db, 'products', productId);
              const productDoc = await getDoc(productDocRef);
              
              if (productDoc.exists()) {
                const productData = productDoc.data();
                product = {
                  id: productId,
                  name: productData.name || qrData.productName,
                  price: productData.otcPrice || productData.price || price || 0,
                  stock: stockDoc.realTimeStock || 0,
                  stockId: branchStockSnapshot.docs[0].id,
                  unitCost: stockDoc.unitCost || 0,
                  commissionPercentage: productData.commissionPercentage || 0
                };
              }
            }
          }
        } catch (error) {
          console.error('Error loading product from QR code:', error);
        }
      }

      if (!product) {
        toast.error(`Product not found in this branch. Product ID: ${productId}`);
        return;
      }

      // Check stock
      if (product.stock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }

      // Check if product is already in cart (same product ID)
      const existingIndex = formData.items.findIndex(item => 
        String(item.id).trim() === String(product.id).trim() && item.type === 'product'
      );
      const existing = existingIndex >= 0 ? formData.items[existingIndex] : null;
      
      console.log('🔍 Checking for existing product:', {
        productId: product.id,
        existingIndex,
        found: !!existing,
        currentItems: formData.items.map(i => ({ id: i.id, type: i.type, qty: i.quantity }))
      });
      
      if (existing) {
        // Product already in cart - increase quantity
        const newQuantity = (existing.quantity || 1) + 1;
        
        // Check if we have enough stock
        if (newQuantity > product.stock) {
          toast.error(`Cannot add more. Only ${product.stock} units available.`);
          return;
        }
        
        handleUpdateItem(existingIndex, 'quantity', newQuantity);
        toast.success(`${product.name} x${newQuantity} (added 1 more)`);
        console.log(`✅ Increased quantity of ${product.name} to ${newQuantity}`);
      } else {
        // Add product to cart (similar to handleToggleProduct)
        let batches = [];
        let totalStock = product.stock || 0;
        try {
          if (userBranch) {
            // Get all available OTC batches for this product
            const batchesResult = await inventoryService.getBatchesForSale({
              branchId: userBranch,
              productId: product.id,
              quantity: 9999, // Very large number to get all available batches
              saleType: 'otc'
            });

            if (batchesResult.success && batchesResult.batches.length > 0) {
              // getBatchesForSale already filters for OTC batches
              const otcBatches = batchesResult.batches;

              // Calculate total available stock from all OTC batches
              totalStock = otcBatches.reduce((total, batch) => total + (batch.remainingQuantity || batch.available || 0), 0);

              // Store otcBatches for later use
              var availableOtcBatches = otcBatches;

              // Now fetch batches for quantity 1 (for initial display)
              const batchesResult = await inventoryService.getBatchesForSale({
                branchId: userBranch,
                productId: product.id,
                quantity: 1
              });

              if (batchesResult.success && batchesResult.batches.length > 0) {
                // If QR code has batchNumber, try to match it
                if (batchNumber) {
                  const matchedBatch = batchesResult.batches.find(b => b.batchNumber === batchNumber);
                  if (matchedBatch) {
                    batches = [matchedBatch];
                  } else {
                    batches = batchesResult.batches;
                  }
                } else {
                  batches = batchesResult.batches;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching batches:', error);
        }

        setFormData(prev => ({
          ...prev,
          items: [...prev.items, {
            type: 'product',
            id: product.id,
            name: product.name || 'Unknown Product',
            basePrice: product.price || 0,
            price: product.price || 0,
            quantity: 1,
            stock: totalStock,
            stockId: product.stockId || null,
            batches: batches,
            allBatches: productOtcBatches.map(batch => ({
              id: batch.id,
              batchNumber: batch.batchNumber,
              remainingQuantity: batch.realTimeStock || 0,
              expirationDate: batch.expirationDate?.toDate ? batch.expirationDate.toDate() : batch.expirationDate,
              receivedDate: batch.receivedDate?.toDate ? batch.receivedDate.toDate() : batch.receivedDate
            })),
            unitCost: product.unitCost || 0,
            commissionPercentage: product.commissionPercentage || 0,
            commissionerId: '',
            commissionerName: '',
            commissionPoints: 0
          }]
        }));
        
        console.log('✅ Product added to cart:', product.name);
        toast.success(`Added ${product.name} to cart`);
      }

      // Stop scanning after successful scan
      await stopQRScanner();
      isProcessingQRCodeRef.current = false;
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast.error('Failed to process QR code: ' + error.message);
      isProcessingQRCodeRef.current = false;
    }
  };

  // Start QR code scanner
  const startQRScanner = async () => {
    try {
      setScannerError('');
      
      // First check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setScannerError('Camera not supported in this browser. Use Chrome or Edge.');
        toast.error('Camera not supported. Please use Chrome or Edge browser.');
        return;
      }

      // Check camera permission first (without keeping the stream)
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        // Stop immediately - just checking permission
        testStream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.error('Camera permission error:', permError);
        if (permError.name === 'NotAllowedError') {
          setScannerError('Camera access denied. Please allow camera in browser settings.');
          toast.error('Camera access denied. Click the camera icon in the address bar to allow access.');
        } else if (permError.name === 'NotFoundError') {
          setScannerError('No camera found on this device.');
          toast.error('No camera found. Please connect a camera.');
        } else {
          setScannerError(`Camera error: ${permError.message}`);
          toast.error(`Camera error: ${permError.message}`);
        }
        return;
      }

      setIsScanning(true);

      // Wait for DOM to update with qr-reader element
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use the floating scanner element
      const scannerId = document.getElementById('qr-reader-float') ? 'qr-reader-float' : 'qr-reader';
      const scanner = new Html5Qrcode(scannerId);
      qrCodeScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 15, // Higher FPS for faster scanning
          qrbox: { width: 250, height: 250 }, // Larger scan area
          aspectRatio: 1.0,
          formatsToSupport: [ 0 ] // 0 = QR_CODE only for faster detection
        },
        (decodedText) => {
          // Successfully scanned
          console.log('✅ QR Code scanned:', decodedText);
          handleQRCodeScanned(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors (they're frequent during scanning)
        }
      );
      
      console.log('📷 QR Scanner started successfully');
    } catch (error) {
      console.error('Error starting QR scanner:', error);
      setScannerError(`Scanner error: ${error.message}`);
      setIsScanning(false);
      toast.error('Failed to start QR scanner: ' + error.message);
    }
  };

  // Stop QR code scanner
  const stopQRScanner = async () => {
    try {
      if (qrCodeScannerRef.current) {
        await qrCodeScannerRef.current.stop();
        await qrCodeScannerRef.current.clear();
        qrCodeScannerRef.current = null;
      }
      setIsScanning(false);
      setScannerError('');
    } catch (error) {
      console.error('Error stopping QR scanner:', error);
    }
  };

  // Cleanup scanner on unmount or modal close
  useEffect(() => {
    if (!isOpen && isScanning) {
      stopQRScanner();
    }
    return () => {
      if (isScanning) {
        stopQRScanner();
      }
    };
  }, [isOpen]);

  const handleToggleProduct = async (product) => {
    // Check if stocks data is loaded
    if (!stocksData || stocksData.length === 0) {
      toast.error('Loading product data, please wait...');
      return;
    }

    // Check if product is in stock
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }

    const existing = formData.items.find(item => item.id === product.id && item.type === 'product');
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item => !(item.id === product.id && item.type === 'product'))
      }));
    } else {
      // Get ALL non-salon-use batches for this product from stocks collection
      const productAllBatches = stocksData.filter(stockItem =>
        stockItem.productId === product.id &&
        stockItem.status === 'active' &&
        stockItem.usageType !== 'salon-use' && // Exclude salon-use batches
        (stockItem.realTimeStock || 0) > 0
      );

      // Get allocated batches for quantity 1
      let batches = [];
      try {
        if (userBranch) {
          const batchesResult = await inventoryService.getBatchesForSale({
            branchId: userBranch,
            productId: product.id,
            quantity: 1
          });

          if (batchesResult.success && batchesResult.batches.length > 0) {
            batches = batchesResult.batches;
          }
        }
      } catch (error) {
        console.error('Error fetching batches:', error);
        // Continue without batch info if there's an error
      }

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          type: 'product',
          id: product.id,
          name: product.name || 'Unknown Product',
          basePrice: product.price || 0,
          price: product.price || 0,
          quantity: 1,
          stock: product.stock || 0,
          stockId: product.stockId || null,
          batches: batches, // Store batch information for FIFO tracking
          allBatches: productAllBatches.map(batch => ({
            id: batch.id,
            batchNumber: batch.batchNumber,
            remainingQuantity: batch.realTimeStock || 0,
            expirationDate: batch.expirationDate?.toDate ? batch.expirationDate.toDate() : batch.expirationDate,
            receivedDate: batch.receivedDate?.toDate ? batch.receivedDate.toDate() : batch.receivedDate
          })), // Store all available batches for display
          unitCost: product.unitCost || 0, // Store unit cost for commission calculation
          commissionPercentage: product.commissionPercentage || 0, // Store commission percentage
          commissionerId: '', // Will be set when commissioner is selected
          commissionerName: '', // Will be set when commissioner is selected
          commissionPoints: 0 // Will be calculated when commissioner is selected
        }]
      }));
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const updatedItems = [...formData.items];
    const currentItem = updatedItems[index];
    
    if (field === 'stylistId') {
      const stylist = stylists.find(s => s.id === value);
      updatedItems[index].stylistId = value;
      updatedItems[index].stylistName = stylist ? `${stylist.firstName} ${stylist.lastName}` : '';
    } else if (field === 'clientType') {
      // When changing clientType from TR to X or R, restore original stylist if available
      const wasTR = currentItem.clientType === 'TR' || currentItem.clientType === 'TR-Transfer';
      const isNowXorR = value === 'X' || value === 'R';
      
      updatedItems[index][field] = value;
      
      // If changing from TR to X/R, restore original stylist if it exists
      if (wasTR && isNowXorR && currentItem.type === 'service') {
        // Restore original stylist from appointment if available
        if (currentItem.originalStylistId && currentItem.originalStylistName) {
          updatedItems[index].stylistId = currentItem.originalStylistId;
          updatedItems[index].stylistName = currentItem.originalStylistName;
        } else {
          // Only clear if there was no original stylist
          updatedItems[index].stylistId = '';
          updatedItems[index].stylistName = '';
        }
      }
    } else if (field === 'adjustment') {
      updatedItems[index].adjustment = parseFloat(value) || 0;
      // Recalculate final price: basePrice + adjustment
      updatedItems[index].price = updatedItems[index].basePrice + (parseFloat(value) || 0);
    } else if (field === 'quantity') {
      // For products, update quantity (price remains as basePrice, calculation will multiply)
      const quantity = parseInt(value) || 1;
      updatedItems[index].quantity = quantity;
      if (updatedItems[index].type === 'product') {
        // Keep price as basePrice, let calculateBillTotals multiply by quantity
        updatedItems[index].price = updatedItems[index].basePrice;
        
        // Recalculate commission points if commissioner is selected
        if (updatedItems[index].commissionerId && updatedItems[index].unitCost && updatedItems[index].commissionPercentage) {
          const unitCost = Number(updatedItems[index].unitCost) || 0;
          const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
          updatedItems[index].commissionPoints = (unitCost * quantity) * (commissionPercentage / 100);
        }
        
        // Update batch information for the new quantity
        if (userBranch && updatedItems[index].id) {
          // Get ALL non-salon-use batches from stocks collection
          const productOtcBatches = stocksData.filter(stockItem =>
            stockItem.productId === updatedItems[index].id &&
            stockItem.status === 'active' &&
            stockItem.usageType !== 'salon-use' && // Exclude salon-use batches
            (stockItem.realTimeStock || 0) > 0
          );

          // Calculate total stock
          const totalStock = productOtcBatches.reduce((total, batch) => total + (batch.realTimeStock || 0), 0);

          // Check if manual batch selection is active
          if (updatedItems[index].manualBatchSelection && updatedItems[index].selectedBatchId) {
            // Keep manual selection, just update the quantity in the batch allocation
            const selectedBatch = productOtcBatches.find(b => b.id === updatedItems[index].selectedBatchId);
            if (selectedBatch) {
              const availableStock = selectedBatch.realTimeStock || 0;
              if (quantity > availableStock) {
                // Not enough stock in selected batch, clear manual selection and use FIFO
                toast.error(`Selected batch only has ${availableStock} units. Switching to automatic allocation.`);
                updatedItems[index].manualBatchSelection = false;
                updatedItems[index].selectedBatchId = null;
              } else {
                // Update the batch allocation with new quantity
                updatedItems[index].batches = [{
                  batchId: selectedBatch.id,
                  batchNumber: selectedBatch.batchNumber,
                  quantity: quantity,
                  expirationDate: selectedBatch.expirationDate?.toDate ? selectedBatch.expirationDate.toDate() : selectedBatch.expirationDate
                }];
                updatedItems[index].stock = totalStock;
                updatedItems[index].allBatches = productOtcBatches.map(batch => ({
                  id: batch.id,
                  batchNumber: batch.batchNumber,
                  remainingQuantity: batch.realTimeStock || 0,
                  realTimeStock: batch.realTimeStock || 0,
                  expirationDate: batch.expirationDate?.toDate ? batch.expirationDate.toDate() : batch.expirationDate,
                  receivedDate: batch.receivedDate?.toDate ? batch.receivedDate.toDate() : batch.receivedDate
                }));
                
                setFormData(prev => {
                  const newItems = [...prev.items];
                  newItems[index] = { ...updatedItems[index] };
                  return { ...prev, items: newItems };
                });
                return; // Exit early, don't fetch FIFO allocation
              }
            }
          }

          // Get allocated batches for current quantity (FIFO)
          inventoryService.getBatchesForSale({
            branchId: userBranch,
            productId: updatedItems[index].id,
            quantity: quantity,
            saleType: 'otc'
          }).then(allocatedResult => {
            updatedItems[index].batches = allocatedResult.success ? allocatedResult.batches : [];
            updatedItems[index].stock = totalStock;
            updatedItems[index].allBatches = productOtcBatches.map(batch => ({
              id: batch.id,
              batchNumber: batch.batchNumber,
              remainingQuantity: batch.realTimeStock || 0,
              realTimeStock: batch.realTimeStock || 0,
              expirationDate: batch.expirationDate?.toDate ? batch.expirationDate.toDate() : batch.expirationDate,
              receivedDate: batch.receivedDate?.toDate ? batch.receivedDate.toDate() : batch.receivedDate
            }));

            setFormData(prev => {
              const newItems = [...prev.items];
              newItems[index] = { ...updatedItems[index] };
              return { ...prev, items: newItems };
            });
          }).catch(error => {
            console.error('Error fetching allocated batches:', error);
          });
        }
      }
    } else if (field === 'commissionerId') {
      // Handle commissioner selection for products
      const commissioner = stylists.find(s => s.id === value);
      updatedItems[index].commissionerId = value;
      updatedItems[index].commissionerName = commissioner ? `${commissioner.firstName} ${commissioner.lastName}` : '';
      
      // Calculate commission points: (unitCost * quantity) * (commissionPercentage / 100)
      if (updatedItems[index].type === 'product' && value) {
        const unitCost = Number(updatedItems[index].unitCost) || 0;
        const quantity = Number(updatedItems[index].quantity) || 1;
        const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
        updatedItems[index].commissionPoints = (unitCost * quantity) * (commissionPercentage / 100);
      } else {
        updatedItems[index].commissionPoints = 0;
      }
    } else {
      updatedItems[index][field] = value;
    }
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Handle manual batch selection for products
  const handleSelectBatch = (itemIndex, batchId, batchNumber) => {
    const updatedItems = [...formData.items];
    const item = updatedItems[itemIndex];
    
    if (!item || item.type !== 'product') return;
    
    // Find the selected batch from allBatches
    const selectedBatch = item.allBatches?.find(b => b.id === batchId);
    if (!selectedBatch) {
      toast.error('Batch not found');
      return;
    }
    
    const availableStock = selectedBatch.realTimeStock || selectedBatch.remainingQuantity || 0;
    const requestedQuantity = item.quantity || 1;
    
    if (availableStock < requestedQuantity) {
      toast.error(`Batch ${batchNumber} only has ${availableStock} units available. Need ${requestedQuantity}.`);
      return;
    }
    
    // Manually set the batch allocation
    updatedItems[itemIndex].batches = [{
      batchId: batchId,
      batchNumber: batchNumber,
      quantity: requestedQuantity,
      expirationDate: selectedBatch.expirationDate
    }];
    updatedItems[itemIndex].manualBatchSelection = true;
    updatedItems[itemIndex].selectedBatchId = batchId;
    
    setFormData(prev => ({ ...prev, items: updatedItems }));
    toast.success(`Selected batch ${batchNumber} for ${item.name}`);
  };

  // Clear manual batch selection and revert to FIFO
  const handleClearBatchSelection = (itemIndex) => {
    const updatedItems = [...formData.items];
    const item = updatedItems[itemIndex];
    
    if (!item || item.type !== 'product') return;
    
    // Clear manual selection flags
    updatedItems[itemIndex].manualBatchSelection = false;
    updatedItems[itemIndex].selectedBatchId = null;
    
    // Re-fetch FIFO allocation
    if (userBranch && item.id) {
      inventoryService.getBatchesForSale({
        branchId: userBranch,
        productId: item.id,
        quantity: item.quantity || 1,
        saleType: 'otc'
      }).then(allocatedResult => {
        updatedItems[itemIndex].batches = allocatedResult.success ? allocatedResult.batches : [];
        setFormData(prev => {
          const newItems = [...prev.items];
          newItems[itemIndex] = { ...updatedItems[itemIndex] };
          return { ...prev, items: newItems };
        });
        toast.success('Reverted to automatic FIFO batch selection');
      }).catch(error => {
        console.error('Error fetching allocated batches:', error);
      });
    }
  };

  // Open Service Product Modal
  const handleOpenServiceProductModal = (itemIndex) => {
    const item = formData.items[itemIndex];
    if (!item || item.type !== 'service') return;
    
    setServiceProductModalData({
      itemIndex,
      productMappings: item.productMappings || [],
      serviceName: item.name
    });
    setShowServiceProductModal(true);
  };

  // Add service product usage from modal
  const handleAddServiceProductUsage = (productId, productName, quantity, unit, percentage, instruction) => {
    const { itemIndex } = serviceProductModalData;
    if (itemIndex === null) return;
    
    setFormData(prev => {
      const items = [...prev.items];
      const current = items[itemIndex];
      const usages = current.serviceProductUsages || [];
      items[itemIndex] = {
        ...current,
        serviceProductUsages: [...usages, {
          productId,
          productName,
          quantity,
          unit,
          percentage,
          instruction
        }]
      };
      return { ...prev, items };
    });
    
    setShowServiceProductModal(false);
    toast.success(`Added ${productName} usage`);
  };

  // Filter clients based on search (use formData.clientName as primary source)
  const searchTerm = (clientSearch || formData.clientName || '').trim().toLowerCase();
  const filteredClients = (clients || []).filter(client => {
    if (!client || !client.firstName || !client.lastName) return false;
    if (!searchTerm || searchTerm.length === 0) return false;
    
    const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim().toLowerCase();
    const clientPhone = (client.phoneNumber || client.phone || '').toString().trim();
    
    return clientName.includes(searchTerm) || clientPhone.includes(searchTerm);
  });

  // Handle client selection from search list
  const handleSelectClient = async (client) => {
    setMatchedClient(client);
    setClientSearch(`${client.firstName} ${client.lastName}`);
    setShowClientList(false);
    setFormData(prev => ({
      ...prev,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phoneNumber || client.phone || '',
      clientEmail: client.email || ''
    }));
    
    // Fetch loyalty points for selected client (branch-specific)
    if (client.id) {
      try {
        const branchId = appointment?.branchId || userBranch;
        if (branchId) {
          const points = await getLoyaltyPoints(client.id, branchId);
          setClientLoyaltyPoints(points);
        } else {
          setClientLoyaltyPoints(0);
        }
      } catch (error) {
        console.error('Error fetching loyalty points:', error);
        setClientLoyaltyPoints(0);
      }
    }
  };

  // Handle client name input change
  const handleClientNameChange = (e) => {
    const value = e.target.value;
    setClientSearch(value);
    setFormData(prev => ({ ...prev, clientName: value }));
    
    // Show client list if there's input and it's walk-in
    const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
    if (isWalkIn && value.trim().length >= 1 && clients && Array.isArray(clients) && clients.length > 0) {
      setShowClientList(true);
      // Clear matched client if user is typing a different name
      if (matchedClient && `${matchedClient.firstName} ${matchedClient.lastName}` !== value) {
        setMatchedClient(null);
        setFormData(prev => ({ ...prev, clientId: '' }));
      }
    } else {
      setShowClientList(false);
      if (value.trim().length === 0) {
        setMatchedClient(null);
        setFormData(prev => ({ ...prev, clientId: '' }));
      }
    }
  };

  // Handle client phone change
  const handleClientPhoneChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, clientPhone: value }));
    
    // Update search and show list if typing in name field is empty
    if (!clientSearch) {
      setClientSearch(value);
      const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
      if (isWalkIn && value.trim().length >= 1 && clients.length > 0) {
        setShowClientList(true);
      }
    }
  };

  // Close client list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClientList && !event.target.closest('.client-search-container')) {
        setShowClientList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showClientList]);

  // Handle promotion code validation
  const handleValidatePromotionCode = async () => {
    if (!promotionCode.trim()) {
      setPromotionError('Please enter a promotion code');
      return;
    }

    if (!userBranch) {
      setPromotionError('Branch ID not found');
      return;
    }

    setValidatingPromotion(true);
    setPromotionError('');

    try {
      const clientId = appointment?.clientId || formData.clientId || null;
      const result = await validatePromotionCode(promotionCode.trim(), userBranch, clientId);

      if (result.success) {
        setAppliedPromotion(result.promotion);
        toast.success(`Promotion "${result.promotion.title}" applied!`);
        setPromotionError('');
      } else {
        setAppliedPromotion(null);
        setPromotionError(result.error || 'Invalid promotion code');
        toast.error(result.error || 'Invalid promotion code');
      }
    } catch (error) {
      console.error('Error validating promotion code:', error);
      setAppliedPromotion(null);
      setPromotionError('Failed to validate promotion code');
      toast.error('Failed to validate promotion code');
    } finally {
      setValidatingPromotion(false);
    }
  };

  // Remove promotion code
  const handleRemovePromotion = () => {
    setPromotionCode('');
    setAppliedPromotion(null);
    setPromotionDiscount(0);
    setPromotionError('');
  };

  // Check receipt number for duplicates
  const checkReceiptNumber = useCallback(async (receiptNumber) => {
    if (!receiptNumber || !receiptNumber.trim() || (mode !== 'billing' && mode !== 'products-only')) {
      setExistingReceipt(null);
      return;
    }

    try {
      setCheckingReceipt(true);
      const existing = await checkReceiptNumberExists(receiptNumber.trim(), userBranch);
      setExistingReceipt(existing);
      
      if (existing) {
        toast.error(`Receipt number "${receiptNumber.trim()}" already exists!`, {
          duration: 4000,
          icon: '⚠️'
        });
      }
    } catch (error) {
      console.error('Error checking receipt number:', error);
      setExistingReceipt(null);
    } finally {
      setCheckingReceipt(false);
    }
  }, [mode, userBranch]);

  // Debounce receipt number check
  useEffect(() => {
    if (!formData.receiptNumber || (mode !== 'billing' && mode !== 'products-only')) {
      setExistingReceipt(null);
      return;
    }

    const timer = setTimeout(() => {
      checkReceiptNumber(formData.receiptNumber);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [formData.receiptNumber, checkReceiptNumber]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate client name for service transactions
    // For product-only transactions, allow empty client name (will default to Guest)
    const hasServices = formData.items.some(item => item.type === 'service');
    const hasProductsOnly = formData.items.length > 0 && !hasServices;

    if (hasServices && !formData.clientName.trim()) {
      toast.error('Client name is required for service transactions');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Please add at least one service or product');
      return;
    }

    // Validate product stock availability
    for (const item of formData.items) {
      if (item.type === 'product') {
        const product = availableProducts.find(p => p.id === item.id);
        if (!product) {
          toast.error(`Product "${item.name}" is no longer available`);
          return;
        }
        
        if (product.stock <= 0) {
          toast.error(`Product "${item.name}" is out of stock`);
          return;
        }
        
        if (item.quantity > product.stock) {
          toast.error(`Insufficient stock for "${item.name}". Only ${product.stock} units available.`);
          return;
        }
      }
    }

    // Validate stylist selection for TR (Transfer) client type in billing mode
    if (mode === 'billing') {
    const transferServices = formData.items.filter(item => item.type === 'service' && item.clientType === 'TR');
    for (const service of transferServices) {
      if (!service.stylistId || service.stylistId.trim() === '') {
        toast.error(`Stylist is required for Transfer (TR) client type. Please select a stylist for "${service.name}".`);
          return;
        }
      }
    }

    // Validate stylist selection for ALL services in checkin mode
    if (mode === 'checkin') {
      const servicesWithoutStylist = formData.items.filter(item => 
        item.type === 'service' && (!item.stylistId || item.stylistId.trim() === '')
      );
      if (servicesWithoutStylist.length > 0) {
        const serviceNames = servicesWithoutStylist.map(s => s.name).join(', ');
        toast.error(`Please assign a stylist to: ${serviceNames}`);
        return;
      }
    }

    // Validate amount received for cash payments (in billing and products-only modes)
    if ((mode === 'billing' || mode === 'products-only') && formData.paymentMethod === PAYMENT_METHODS.CASH) {
      const amountReceived = parseFloat(formData.amountReceived) || 0;
      if (!formData.amountReceived || amountReceived < totals.total) {
        toast.error(`Insufficient amount received! Required: ₱${totals.total.toFixed(2)}`);
        return;
      }
    }

    const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;

    // Validate receipt number for billing and products-only modes
    if ((mode === 'billing' || mode === 'products-only')) {
      if (!activeBatch) {
        toast.error('No active receipt batch. Please ask your Branch Manager to add a new batch.');
        return;
      }
      if (!formData.receiptNumber.trim()) {
        toast.error('Receipt number is required');
        return;
      }
    }

    // Note: Receipt number will be auto-generated from BIR batch in billingService
    // The formData.receiptNumber is just a preview - actual number is assigned atomically

    // For product-only transactions, use Guest client if no client selected

    let clientName = formData.clientName;
    let clientPhone = formData.clientPhone || '';
    let clientEmail = formData.clientEmail || '';
    let clientId = formData.clientId || null;

    // Default to Guest client for product-only walk-in transactions
    if (hasProductsOnly && !clientName.trim()) {
      clientName = 'Guest';
      clientPhone = '';
      clientEmail = '';
      clientId = null;
    }

    const billData = {
      appointmentId: isWalkIn ? null : appointment?.id,
      clientId: clientId,
      clientName: clientName,
      clientPhone: clientPhone,
      clientEmail: clientEmail,
      branchId: userBranch,
      branchName: appointment?.branchName || branchData?.name || branchData?.branchName || userData?.branchName || 'Unknown Branch',
      stylistId: appointment?.stylistId || formData.items[0]?.stylistId,
      stylistName: appointment?.stylistName || formData.items[0]?.stylistName,
      items: formData.items,
      subtotal: totals.subtotal,
      discount: totals.discount || 0, // Store calculated discount amount
      discountType: formData.discountType,
      promotionCode: appliedPromotion ? promotionCode.trim().toUpperCase() : null,
      promotionId: appliedPromotion?.id || null,
      promotionDiscount: promotionDiscount || 0,
      serviceProductCharges: serviceProductCharges || [],
      serviceProductChargeTotal: totals.serviceProductCharge || 0,
      loyaltyPointsUsed: parseInt(formData.loyaltyPointsUsed) || 0,
      tax: 0, // Tax removed - always 0
      taxRate: 0, // Tax rate removed - always 0
      total: totals.total,
      paymentMethod: formData.paymentMethod,
      paymentReference: formData.paymentReference,
      // Don't pass receiptNumber - let billingService auto-generate from BIR batch atomically
      amountReceived: formData.paymentMethod === PAYMENT_METHODS.CASH ? (parseFloat(formData.amountReceived) || 0) : totals.total,
      change: formData.paymentMethod === PAYMENT_METHODS.CASH ? Math.max(0, (parseFloat(formData.amountReceived) || 0) - totals.total) : 0,
      notes: formData.notes || (isWalkIn ? 'Walk-in customer' : '')
    };

    console.log('🏪 BillingModalPOS - billData branchName:', billData.branchName, 'sources:', {
      appointmentBranchName: appointment?.branchName,
      branchDataName: branchData?.name,
      userDataBranchName: userData?.branchName
    });

    // Show confirmation modal instead of submitting directly (only for billing mode)
    if (mode === 'billing' || mode === 'products-only') {
      setPendingBillData(billData);
      setShowConfirmModal(true);
    } else {
      // For checkin mode, submit directly without confirmation
      onSubmit(billData);
    }
  };

  // Connect to Bluetooth thermal printer (one-time pairing)
  const handleConnectPrinter = async () => {
    if (!thermalPrinter.isSupported()) {
      toast.error('Web Bluetooth not supported. Use Chrome or Edge.');
      return;
    }

    try {
      setConnectingPrinter(true);
      const result = await thermalPrinter.connect();
      setPrinterConnected(true);
      setPrinterName(result.printerName);
      toast.success(`Printer connected: ${result.printerName}`, { icon: '🖨️' });
    } catch (error) {
      console.error('Printer connection error:', error);
      if (!error.message?.includes('cancelled')) {
        toast.error(`Connection failed: ${error.message}`);
      }
    } finally {
      setConnectingPrinter(false);
    }
  };

  // Check printer status on modal open
  useEffect(() => {
    if (isOpen) {
      const status = thermalPrinter.getStatus();
      setPrinterConnected(status.isConnected);
      setPrinterName(status.printerName || '');
    }
  }, [isOpen]);

  // Confirm payment and auto-print receipt
  const confirmPayment = async () => {
    if (!pendingBillData) return;
    
    // Track promotion usage if promotion was applied
    if (appliedPromotion) {
      try {
        const clientId = formData.clientId || appointment?.clientId || null;
        await trackPromotionUsage(appliedPromotion.id, clientId);
      } catch (error) {
        console.error('Error tracking promotion usage:', error);
      }
    }

    setShowConfirmModal(false);
    
    // Call onSubmit and wait for result
    try {
      const result = await onSubmit(pendingBillData);
      
      if (result && result.id) {
        const billWithDetails = { ...pendingBillData, ...result, createdAt: new Date() };
        
        // Auto-print to thermal printer if connected
        if (printerConnected) {
          try {
            await thermalPrinter.printReceipt(billWithDetails, branchData);
            toast.success('Receipt printed!', { icon: '🖨️', duration: 1500 });
          } catch (printError) {
            console.error('Print error:', printError);
            toast.error('Print failed - check printer connection');
          }
        }
        
        setPendingBillData(null);
        onClose(billWithDetails);
        return;
      }
      
      setPendingBillData(null);
      onClose();
    } catch (error) {
      console.error('Error processing payment:', error);
      setPendingBillData(null);
    }
  };

  // Print receipt (manual)
  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printContents = receiptRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${completedBill?.receiptNumber || 'Transaction'}</title>
            <style>
              body { 
                font-family: 'Courier New', monospace; 
                padding: 20px;
                max-width: 400px;
                margin: 0 auto;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .font-semibold { font-weight: 600; }
              .text-xs { font-size: 10px; }
              .text-sm { font-size: 12px; }
              .text-lg { font-size: 16px; }
              .text-2xl { font-size: 20px; }
              .text-green-600 { color: #059669; }
              .text-gray-500, .text-gray-600 { color: #6b7280; }
              .border-dashed { border-style: dashed; }
              .border-dotted { border-style: dotted; }
              .border-gray-300 { border-color: #d1d5db; }
              .border-t { border-top-width: 1px; }
              .border-b { border-bottom-width: 1px; }
              .border-t-2 { border-top-width: 2px; }
              .border-b-2 { border-bottom-width: 2px; }
              .py-3 { padding-top: 12px; padding-bottom: 12px; }
              .pt-2, .pt-3, .pt-4 { padding-top: 8px; }
              .pb-1, .pb-2, .pb-4 { padding-bottom: 4px; }
              .mb-1 { margin-bottom: 4px; }
              .mb-2 { margin-bottom: 8px; }
              .mb-4 { margin-bottom: 16px; }
              .mt-1 { margin-top: 4px; }
              .mt-2 { margin-top: 8px; }
              .mt-3 { margin-top: 12px; }
              .ml-1 { margin-left: 4px; }
              .ml-2 { margin-left: 8px; }
              .space-y-1 > * + * { margin-top: 4px; }
              .space-y-2 > * + * { margin-top: 8px; }
              .space-y-3 > * + * { margin-top: 12px; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .items-center { align-items: center; }
              .flex-1 { flex: 1; }
              .gap-1 { gap: 4px; }
              .gap-2 { gap: 8px; }
              .italic { font-style: italic; }
              svg { display: none; }
              @media print {
                body { padding: 0; margin: 0; }
                @page { margin: 10mm; }
              }
            </style>
          </head>
          <body>${printContents}</body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  // Close receipt modal and billing modal
  const handleCloseReceipt = () => {
    setShowReceiptModal(false);
    setCompletedBill(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {/* Floating Camera Preview - Upper Right */}
      {isScanning && (
        <div className="fixed top-4 right-4 z-[60] bg-black rounded-lg shadow-2xl overflow-hidden border-2 border-green-500">
          <div className="relative">
            <div className="w-64 h-64 bg-gray-900 flex items-center justify-center">
              <div id="qr-reader-float" className="w-full h-full"></div>
            </div>
            <div className="absolute top-1 left-1 px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              SCANNING
            </div>
            <button
              type="button"
              onClick={stopQRScanner}
              className="absolute top-1 right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-3 py-2 bg-gray-900 text-center border-t border-gray-700">
            <p className="text-xs text-gray-300">Point camera at product QR code</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-xl w-full max-w-[1600px] h-[95vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header - Dark Purple like Appointment Form */}
          <div className="bg-[#2D1B4E] px-8 py-5 relative">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1 text-white/80 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Printer Status Indicator */}
            <div className="absolute top-4 right-14">
              {printerConnected ? (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 rounded-full">
                  <Printer className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs text-green-300">{printerName || 'Connected'}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectPrinter}
                  disabled={connectingPrinter}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  {connectingPrinter ? (
                    <LoadingSpinner size="xs" />
                  ) : (
                    <Bluetooth className="w-3.5 h-3.5 text-white/70" />
                  )}
                  <span className="text-xs text-white/70">
                    {connectingPrinter ? 'Pairing...' : 'Pair Printer'}
                  </span>
                </button>
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">
              {mode === 'checkin'
                ? (appointment?.isWalkIn ? 'Add Walk-in Client' : 'Check-in Client')
                : mode === 'start-service'
                ? 'Start Service'
                : mode === 'products-only'
                ? 'Quick POS - Products Only'
                : appointment?.isWalkIn || !appointment?.clientId
                  ? (formData.clientName || 'Walk-in Customer')
                  : 'Process Payment'}
            </h2>
            <p className="text-white/70 text-sm">
              {mode === 'checkin'
                ? 'Add services, products, and adjust details before confirming arrival'
                : mode === 'start-service'
                ? 'Add services/products and adjust prices before starting service'
                : mode === 'products-only'
                ? 'Quick product sales with instant checkout'
                : `Process Payment • Transaction #${appointment?.id?.slice(-8).toUpperCase() || 'Pending'}`
              }
            </p>
          </div>

          {/* Main Content - Two Columns */}
          <div className="flex-1 flex flex-col xl:flex-row overflow-hidden billing-modal-content">
            {/* LEFT SIDE - Services Selection (~40%) */}
            <div className="basis-full xl:basis-[40%] min-w-[360px] max-w-[640px] flex flex-col overflow-hidden bg-gray-50 border-b xl:border-b-0 xl:border-r border-gray-200">
              {/* Client Info */}
              <div className="bg-white p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <h3 className="text-base font-bold text-gray-900">Client Information</h3>
                </div>
                {(appointment?.isWalkIn || !appointment?.clientId) ? (
                  // Walk-in: Editable fields with searchable client list
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative client-search-container">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Client Name *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.clientName}
                            onChange={isGuestCustomer ? undefined : handleClientNameChange}
                            onFocus={() => {
                              if (isGuestCustomer) return;
                              const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
                              if (isWalkIn && clients && Array.isArray(clients) && clients.length > 0) {
                                const currentSearch = (clientSearch || formData.clientName || '').trim();
                                if (currentSearch.length >= 1) {
                                  setShowClientList(true);
                                }
                              }
                            }}
                            disabled={isGuestCustomer}
                            className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                              matchedClient ? 'bg-green-50 border-green-300' : isGuestCustomer ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                            placeholder={isGuestCustomer ? "Guest Customer" : "Search or enter client name"}
                            required={!isGuestCustomer}
                          />
                          {/* Profile Picture next to input */}
                          {matchedClient && (
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 border border-green-300">
                              {matchedClient.photoURL ? (
                                <img 
                                  src={matchedClient.photoURL} 
                                  alt={`${matchedClient.firstName} ${matchedClient.lastName}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {matchedClient.firstName?.[0]?.toUpperCase() || ''}
                                  {matchedClient.lastName?.[0]?.toUpperCase() || ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Searchable Client List */}
                        {showClientList && searchTerm.length >= 1 && (
                          <>
                            {filteredClients.length > 0 ? (
                              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {filteredClients.map(client => (
                                  <button
                                    key={client.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleSelectClient(client);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Profile Picture */}
                                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                                        {client.photoURL ? (
                                          <img 
                                            src={client.photoURL} 
                                            alt={`${client.firstName} ${client.lastName}`}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                                            {client.firstName?.[0]?.toUpperCase() || ''}
                                            {client.lastName?.[0]?.toUpperCase() || ''}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">
                                          {client.firstName} {client.lastName}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">
                                          {(client.phoneNumber || client.phone) && `${client.phoneNumber || client.phone}`}
                                          {client.email && ` • ${client.email}`}
                                        </p>
                                      </div>
                                      {matchedClient?.id === client.id && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                                <p className="text-xs text-gray-500">No matching clients found</p>
                              </div>
                            )}
                          </>
                        )}

                        {/* Guest Customer Checkbox */}
                        <div className="mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isGuestCustomer}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setIsGuestCustomer(checked);
                                if (checked) {
                                  // Set to guest customer
                                  setFormData(prev => ({
                                    ...prev,
                                    clientName: 'Guest',
                                    clientPhone: '',
                                    clientEmail: '',
                                    clientId: null
                                  }));
                                  setMatchedClient(null);
                                  setClientSearch('');
                                  setShowClientList(false);
                                } else {
                                  // Clear guest status, reset to empty
                                  setFormData(prev => ({
                                    ...prev,
                                    clientName: '',
                                    clientPhone: '',
                                    clientEmail: '',
                                    clientId: null
                                  }));
                                  setMatchedClient(null);
                                }
                              }}
                              className="w-4 h-4 text-[#2D1B4E] border-gray-300 rounded focus:ring-[#2D1B4E]"
                            />
                            <span className="text-xs font-medium text-gray-700">Guest Customer</span>
                          </label>
                        </div>

                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.clientPhone}
                          onChange={isGuestCustomer ? undefined : handleClientPhoneChange}
                          disabled={isGuestCustomer}
                          className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                            matchedClient ? 'bg-green-50 border-green-300' : isGuestCustomer ? 'bg-gray-100 text-gray-500' : ''
                          }`}
                          placeholder={isGuestCustomer ? "Not required for guests" : "Enter phone number"}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={formData.clientEmail}
                          onChange={isGuestCustomer ? undefined : (e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                          disabled={isGuestCustomer}
                          className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                            matchedClient ? 'bg-green-50 border-green-300' : isGuestCustomer ? 'bg-gray-100 text-gray-500' : ''
                          }`}
                          placeholder={isGuestCustomer ? "Not required for guests" : "Enter email address"}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Appointment: Read-only fields
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-medium">
                      {appointment?.clientName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm">
                      {appointment?.clientPhone || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm">
                      {appointment?.clientEmail || '-'}
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Services & Products Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <h3 className="text-base font-bold text-gray-900">
                      {mode === 'products-only' ? 'Products' : 'Services & Products'}
                    </h3>
                  </div>
                  
                  {/* Tab Buttons */}
                  <div className="flex space-x-2">
                    {mode !== 'products-only' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('service')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                          activeTab === 'service'
                            ? 'bg-[#2D1B4E] text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Scissors className="w-4 h-4" />
                        <span className="text-sm font-medium">Services</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('product')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        activeTab === 'product'
                          ? 'bg-[#2D1B4E] text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      <span className="text-sm font-medium">Products</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar with QR Scanner Button (Products Tab Only) */}
                <div className="relative mb-4 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder={activeTab === 'service' ? 'Search services...' : 'Search products or scan QR code...'}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm"
                    />
                  </div>
                  {activeTab === 'product' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isScanning) {
                          stopQRScanner();
                        } else {
                          startQRScanner();
                        }
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                        isScanning
                          ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                          : 'bg-[#2D1B4E] border-[#2D1B4E] text-white hover:bg-[#3D2B5E]'
                      }`}
                    >
                      {isScanning ? (
                        <>
                          <X className="w-4 h-4" />
                          <span className="text-sm font-medium">Stop Scan</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span className="text-sm font-medium">Scan QR</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {/* QR Code Scanner - Hidden container for Html5Qrcode (actual view is in floating preview) */}
                {isScanning && activeTab === 'product' && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-green-800 text-sm font-medium">Camera active - see preview in top right corner</p>
                      <button
                        type="button"
                        onClick={stopQRScanner}
                        className="ml-auto px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                      >
                        Stop Scanning
                      </button>
                    </div>
                    {scannerError && (
                      <p className="text-red-600 text-xs mt-2">{scannerError}</p>
                    )}
                    {/* Hidden scanner element - actual video shows in floating preview */}
                    <div id="qr-reader" className="hidden"></div>
                  </div>
                )}

                <div className="grid grid-cols-5 gap-3">
                  {/* Services Tab */}
                  {activeTab === 'service' && services
                    .filter(service =>
                      service?.serviceName?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                      service?.name?.toLowerCase().includes(serviceSearch.toLowerCase())
                    )
                    .map((service) => {
                    const existingItem = formData.items.find(item => item.id === service.id && item.type === 'service');
                    const isSelected = !!existingItem;
                    const quantity = existingItem?.quantity || 1;

                    return (
                      <div
                        key={service.id}
                        className={`relative px-2.5 py-1.5 rounded-lg border-2 text-left transition-all overflow-hidden ${
                          isSelected
                            ? 'border-[#2D1B4E] bg-purple-50 shadow-md'
                            : 'border-gray-300 bg-white hover:border-gray-400 cursor-pointer'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!isSelected) {
                              handleToggleService(service);
                            }
                          }}
                          className={`w-full text-left ${isSelected ? 'cursor-default' : ''}`}
                          disabled={isSelected}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <Scissors className="w-3 h-3 text-blue-600" />
                            <p className={`font-semibold text-[12px] leading-tight break-words ${isSelected ? 'text-[#2D1B4E]' : 'text-gray-900'}`}>
                              {service.serviceName || service.name || 'Unknown Service'}
                            </p>
                          </div>
                          <p className={`text-[11px] font-semibold leading-tight mb-0.5 ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                            ₱{service.price}
                          </p>
                          <p className="text-[10px] leading-tight text-gray-500">{service.duration || '30'} m</p>
                        </button>

                        {isSelected && (mode === 'checkin' || mode === 'billing') && (
                          <div className="absolute top-1 right-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateServiceQuantity(service.id, Math.max(1, quantity - 1))}
                              className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs font-medium"
                            >
                              −
                            </button>
                            <span className="text-xs font-medium bg-[#2D1B4E] text-white px-2 py-0.5 rounded min-w-[20px] text-center">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateServiceQuantity(service.id, quantity + 1)}
                              className="w-5 h-5 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-xs font-medium"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveService(service.id)}
                              className="w-5 h-5 bg-red-200 hover:bg-red-300 text-red-700 rounded flex items-center justify-center text-xs"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Products Tab */}
                  {activeTab === 'product' && (
                    loadingProducts ? (
                      <div className="col-span-5 flex items-center justify-center py-8">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-gray-500">Loading products...</span>
                      </div>
                    ) : availableProducts.length === 0 ? (
                      <div className="col-span-5 text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No products available</p>
                      </div>
                    ) : (
                      availableProducts
                        .filter(product =>
                          product?.name?.toLowerCase().includes(serviceSearch.toLowerCase())
                        )
                        .map((product) => {
                          const isSelected = formData.items.some(item => item.id === product.id && item.type === 'product');
                          const isOutOfStock = product.stock <= 0;
                          const isLowStock = product.stock > 0 && product.stock <= 10;
                          
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => handleToggleProduct(product)}
                              disabled={isOutOfStock || loadingProducts}
                              className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all min-w-0 overflow-hidden ${
                                isOutOfStock
                                  ? 'border-red-300 bg-red-50 opacity-60 cursor-not-allowed'
                                  : loadingProducts
                                  ? 'border-gray-300 bg-gray-50 opacity-60 cursor-wait'
                                  : isSelected
                                  ? 'border-[#2D1B4E] bg-purple-50 shadow-md'
                                  : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              <div className="flex items-start gap-1 mb-0.5">
                                <Package className={`w-3 h-3 flex-shrink-0 mt-0.5 ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`} />
                                <p className={`font-semibold text-sm break-words line-clamp-2 ${isSelected ? 'text-[#2D1B4E]' : isOutOfStock ? 'text-red-700' : 'text-gray-900'}`}>
                                  {product.name || 'Unknown Product'}
                                </p>
                              </div>
                              <p className={`text-base font-bold mb-0.5 ${isSelected ? 'text-purple-700' : isOutOfStock ? 'text-red-700' : 'text-gray-900'}`}>
                                ₱{product.price}
                              </p>
                              <p className={`text-xs ${
                                isOutOfStock 
                                  ? 'text-red-600 font-semibold' 
                                  : isLowStock 
                                  ? 'text-yellow-600 font-semibold' 
                                  : 'text-gray-500'
                              }`}>
                                {isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
                                {isLowStock && !isOutOfStock && ' (Low)'}
                              </p>
                            </button>
                          );
                        })
                    )
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE - Current Sale (~60%) */}
            <div 
              className="flex-1 xl:basis-[60%] min-w-0 flex flex-col bg-gray-50 relative"
            >

              {/* Sale Header */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <h3 className="text-base font-bold text-gray-900">Current Sale</h3>
                  </div>
                  {mode === 'billing' && (
                    <div className="flex items-center gap-1.5">
                      {loadingTransactionId ? (
                        <span className="text-xs text-gray-400">Calculating...</span>
                      ) : previewTransactionId ? (
                        <>
                          <span className="text-xs text-gray-500">ID:</span>
                          <span className="text-xs font-medium text-gray-600">{previewTransactionId}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
                {!appointment?.isWalkIn && appointment?.clientId && (
                  <div className="text-xs text-gray-500 mb-4">
                    Transaction #: {appointment?.id?.slice(-8).toUpperCase() || 'Pending'}
              </div>
                )}

              {/* Scrollable Content */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                    {!initialDataLoaded ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-gray-500">Loading product data...</span>
                      </div>
                    ) : formData.items.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No items selected</p>
                        <p className="text-xs text-gray-400 mt-1">Add services or products to start a sale</p>
                      </div>
                    ) : (
                      formData.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {item.type === 'product' ? (
                              <Package className="h-3 w-3 text-green-600" />
                            ) : (
                              <Scissors className="h-3 w-3 text-blue-600" />
                            )}
                            <h5 className="font-medium text-gray-900 text-sm">{item.name || 'Unknown Item'}</h5>
                            {item.type === 'product' && (
                              <span className="text-xs text-gray-500">(Product)</span>
                            )}
                          </div>
                           <div className="text-sm text-gray-600">
                             {item.type === 'product' ? (
                               <>
                                 <span>₱{item.basePrice} x {item.quantity}</span>
                                 <span className="ml-2 font-semibold text-green-600">
                                   = ₱{(item.price * (item.quantity || 1)).toFixed(2)}
                                 </span>
                                 {/* Display all available OTC batches for inventory visibility */}
                                 {item.allBatches && Array.isArray(item.allBatches) && item.allBatches.length > 0 && (
                                   <div className="mt-2">
                                     <div className="flex items-center justify-between mb-2">
                                       <div className="text-xs font-medium text-gray-600">
                                         {item.manualBatchSelection ? '📦 Manual Batch Selection' : '📦 Available Stock Batches (FIFO):'}
                                       </div>
                                       {item.manualBatchSelection && (
                                         <button
                                           type="button"
                                           onClick={() => handleClearBatchSelection(index)}
                                           className="text-xs text-blue-600 hover:text-blue-800 underline"
                                         >
                                           Reset to FIFO
                                         </button>
                                       )}
                                     </div>
                                     <div className="grid grid-cols-2 gap-2">
                                     {/* Sort batches by batch number (FIFO - incremental order) */}
                                     {[...(item.allBatches || [])].sort((a, b) => {
                                       // Sort by batch number for FIFO (lower numbers first)
                                       return a.batchNumber.localeCompare(b.batchNumber);
                                     }).map((batch, idx) => {
                                       // Check if this batch is allocated for current sale
                                       const allocatedBatch = item.batches?.find(b => b.batchId === batch.id);
                                       const allocatedQuantity = allocatedBatch?.quantity || 0;
                                       const isManuallySelected = item.manualBatchSelection && item.selectedBatchId === batch.id;
                                       const availableStock = batch.realTimeStock || batch.remainingQuantity || 0;
                                       const canSelect = availableStock >= (item.quantity || 1);

                                       // Calculate how many units will be taken from this batch for current quantity (FIFO)
                                       let willBeAllocated = 0;
                                       if (!item.manualBatchSelection && item.quantity > 0) {
                                         let remainingToAllocate = item.quantity;
                                         // Go through batches in FIFO order (by batch number)
                                         const sortedBatches = [...(item.allBatches || [])].sort((a, b) => {
                                           return a.batchNumber.localeCompare(b.batchNumber);
                                         });

                                         for (const sortedBatch of sortedBatches) {
                                           if (remainingToAllocate <= 0) break;
                                           if (sortedBatch.id === batch.id) {
                                             willBeAllocated = Math.min(remainingToAllocate, batch.realTimeStock || batch.remainingQuantity);
                                             break;
                                           }
                                           remainingToAllocate -= Math.min(remainingToAllocate, sortedBatch.realTimeStock || sortedBatch.remainingQuantity);
                                         }
                                       }

                                       return (
                                         <div 
                                           key={idx} 
                                           className={`text-xs p-2 rounded border cursor-pointer transition-all ${
                                             isManuallySelected
                                               ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-300'
                                               : allocatedQuantity > 0
                                               ? 'bg-blue-50 border-blue-200'
                                               : willBeAllocated > 0
                                               ? 'bg-green-50 border-green-200'
                                               : canSelect
                                               ? 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                               : 'bg-gray-100 border-gray-200 opacity-60'
                                           }`}
                                           onClick={() => {
                                             if (canSelect && !isManuallySelected) {
                                               handleSelectBatch(index, batch.id, batch.batchNumber);
                                             }
                                           }}
                                         >
                                           <div className="space-y-1">
                                             <div className="flex justify-between items-center">
                                               <div className="flex items-center gap-1">
                                                 {isManuallySelected && (
                                                   <span className="text-purple-600">✓</span>
                                                 )}
                                                 <span className="font-medium text-sm">{batch.batchNumber}</span>
                                               </div>
                                               <span className={`text-xs font-medium ${availableStock < (item.quantity || 1) ? 'text-red-500' : 'text-gray-600'}`}>
                                                 {availableStock} avail
                                               </span>
                                             </div>

                                             {isManuallySelected && (
                                               <div className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                                                 ✓ Selected ({item.quantity} unit{item.quantity !== 1 ? 's' : ''})
                                               </div>
                                             )}

                                             {!item.manualBatchSelection && willBeAllocated > 0 && (
                                               <div className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                                                 → {willBeAllocated} unit{willBeAllocated !== 1 ? 's' : ''} (FIFO)
                                               </div>
                                             )}

                                             {!isManuallySelected && canSelect && !willBeAllocated && (
                                               <div className="text-xs text-gray-500 italic">
                                                 Click to select
                                               </div>
                                             )}

                                             {!canSelect && !isManuallySelected && (
                                               <div className="text-xs text-red-500">
                                                 Not enough stock
                                               </div>
                                             )}

                                             {batch.expirationDate && (
                                               <div className="text-xs text-orange-600">
                                                 Exp: {(() => {
                                                   try {
                                                     // Handle Firestore timestamp
                                                     const expDate = batch.expirationDate?.toDate
                                                       ? batch.expirationDate.toDate()
                                                       : new Date(batch.expirationDate);
                                                     return expDate.toLocaleDateString('en-US', {
                                                       month: 'short',
                                                       day: '2-digit',
                                                       year: 'numeric'
                                                     });
                                                   } catch (error) {
                                                     return 'Invalid Date';
                                                   }
                                                 })()}
                                               </div>
                                             )}
                                           </div>
                                         </div>
                                       );
                                     })}
                                     </div>
                                   </div>
                                 )}
                               </>
                             ) : (
                              <>
                                <span className={item.adjustment !== 0 ? 'line-through text-gray-400' : ''}>
                                  ₱{item.basePrice} x {item.quantity}
                                </span>
                                <span className={`ml-2 font-semibold ${item.adjustment !== 0 ? 'text-green-600' : 'text-green-600'}`}>
                                  = ₱{item.price * item.quantity}
                                </span>
                                {item.adjustment !== 0 && (
                                  <span className="ml-2 text-sm text-blue-600">
                                    (adjusted)
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm ml-2"
                          >
                          <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Quantity Controls (for services and products in billing mode) */}
                        {mode === 'billing' && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-gray-500">Quantity:</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const newQuantity = Math.max(1, (item.quantity || 1) - 1);
                                  handleUpdateItem(index, 'quantity', newQuantity);
                                }}
                                className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-sm font-medium"
                              >
                                −
                              </button>
                              <span className="text-sm font-medium bg-[#2D1B4E] text-white px-3 py-1 rounded min-w-[40px] text-center">
                                {item.quantity || 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newQuantity = (item.quantity || 1) + 1;
                                  handleUpdateItem(index, 'quantity', newQuantity);
                                }}
                                className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center text-sm font-medium"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Stock Info (for products) */}
                        {item.type === 'product' && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-gray-500">Quantity:</label>
                              {item.stock !== undefined && (
                                <span className="text-xs text-gray-500">
                                  Total Stock: {item.stock}
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              min="1"
                              max={item.stock || 0}
                              value={item.quantity || 1}
                              onChange={(e) => {
                                const quantity = parseInt(e.target.value) || 1;
                                const maxQuantity = item.stock || 0;
                                if (quantity > maxQuantity) {
                                  toast.error(`Only ${maxQuantity} units available`);
                                  handleUpdateItem(index, 'quantity', maxQuantity);
                                } else {
                                  handleUpdateItem(index, 'quantity', quantity);
                                }
                              }}
                              className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent ${
                                item.quantity > (item.stock || 0) 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-gray-300'
                              }`}
                            />
                            {item.stock !== undefined && (
                              <p className={`text-xs mt-1 ${
                                item.quantity > (item.stock || 0) 
                                  ? 'text-red-600 font-semibold' 
                                  : (item.stock || 0) <= 10 
                                  ? 'text-yellow-600' 
                                  : 'text-gray-400'
                              }`}>
                                Available: {item.stock}
                                {item.quantity > (item.stock || 0) && ' (Exceeds stock!)'}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Commissioner Selection (for products) */}
                        {item.type === 'product' && (
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Commissioner (Stylist)
                            </label>
                            <select
                              value={item.commissionerId || ''}
                              onChange={(e) => {
                                handleUpdateItem(index, 'commissionerId', e.target.value);
                              }}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                            >
                              <option value="">No Commissioner</option>
                              {stylists.map(stylist => (
                                <option key={stylist.id} value={stylist.id}>
                                  {stylist.firstName} {stylist.lastName}
                                </option>
                              ))}
                            </select>
                            {item.commissionerId && item.commissionPoints > 0 && (
                              <p className="text-xs mt-1 text-purple-600">
                                Commission: ₱{item.commissionPoints.toFixed(2)} 
                                {item.commissionPercentage > 0 && ` (${item.commissionPercentage}% of ₱${((item.unitCost || 0) * (item.quantity || 1)).toFixed(2)})`}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Stylist Selection (only for services, and only changeable for TR) */}
                        {item.type === 'service' && (
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Stylist {mode === 'checkin' && <span className="text-red-500">*</span>}
                              {mode !== 'checkin' && item.clientType === 'TR' && <span className="text-red-500">*</span>}
                            </label>
                            {(mode === 'checkin' || item.clientType === 'TR') ? (
                              // Checkin mode or TR: Allow stylist change
                              <>
                                <select
                                  value={item.stylistId || ''}
                                  onChange={(e) => {
                                    const stylist = stylists.find(s => s.id === e.target.value);
                                    handleUpdateItem(index, 'stylistId', e.target.value);
                                    if (stylist) {
                                      handleUpdateItem(index, 'stylistName', `${stylist.firstName} ${stylist.lastName}`);
                                    } else {
                                      handleUpdateItem(index, 'stylistName', '');
                                    }
                                  }}
                                  required={mode === 'checkin' || item.clientType === 'TR'}
                                  className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent ${
                                    (mode === 'checkin' || item.clientType === 'TR') && !item.stylistId 
                                      ? 'border-red-300 bg-red-50' 
                                      : 'border-gray-300'
                                  }`}
                                >
                                  <option value="">Select Stylist *</option>
                                  {(() => {
                                    const serviceId = item.serviceId || item.id;
                                    const eligible = getEligibleStylistsForService(serviceId);
                                    return eligible.map(stylist => (
                                      <option key={stylist.id} value={stylist.id}>
                                        {stylist.firstName} {stylist.lastName}
                                      </option>
                                    ));
                                  })()}
                                </select>
                                {(mode === 'checkin' || item.clientType === 'TR') && !item.stylistId && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {mode === 'checkin' ? 'Please select a stylist' : 'Stylist is required for Transfer'}
                                  </p>
                                )}
                              </>
                            ) : (
                              // Billing mode with X or R: Show stylist as read-only (from appointment/service)
                              <input
                                type="text"
                                value={item.stylistName || 'Not assigned'}
                                readOnly
                                disabled
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                              />
                            )}
                          </div>
                        )}

                        {/* Client Type (only for services) */}
                        {item.type === 'service' && (
                          <div className="space-y-1">
                            <label className="text-xs text-gray-500">Client Type:</label>
                            <div className="flex space-x-2">
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="X"
                                  checked={item.clientType === 'X' || item.clientType === 'X-New'}
                                  onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                                  className="text-green-600 focus:ring-green-500"
                                />
                                <span className="text-xs text-gray-700">X-New</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="R"
                                  checked={item.clientType === 'R' || item.clientType === 'R-Regular'}
                                  onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">R-Regular</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="TR"
                                  checked={item.clientType === 'TR' || item.clientType === 'TR-Transfer'}
                              onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                              className="text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-700">TR-Transfer</span>
                          </label>
                        </div>
                      </div>
                      )}

                      {/* Price Adjustment (for every service) - only in billing mode, not checkin */}
                        {mode !== 'checkin' && item.type === 'service' && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-gray-200">
                          <label className="text-xs text-gray-500">Price Adjustment:</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="number"
                              placeholder="Adjustment (₱)"
                              value={item.adjustment || ''}
                              onChange={(e) => {
                                const adjustment = parseFloat(e.target.value) || 0;
                                const newPrice = item.basePrice + adjustment;
                                handleUpdateItem(index, 'adjustment', adjustment);
                                handleUpdateItem(index, 'price', newPrice);
                              }}
                              className="w-full sm:w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                            />
                          <input
                            type="text"
                            placeholder="Reason (e.g., Long hair)"
                            value={item.adjustmentReason || ''}
                            onChange={(e) => handleUpdateItem(index, 'adjustmentReason', e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                          />
                        </div>
                        {item.adjustment !== 0 && (
                          <div className="text-xs text-gray-600 mt-2">
                            <span className="text-gray-400">Base: ₱{item.basePrice}</span>
                            <span className="mx-2">+</span>
                            <span className={item.adjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                              ₱{item.adjustment}
                            </span>
                            <span className="mx-2">=</span>
                            <span className="font-semibold text-green-600">₱{item.price}</span>
                          </div>
                        )}
                            {getServiceProductCharge(item) > 0 && (
                              <div className="text-xs text-blue-700 mt-2">
                                Service Product Charge: ₱{getServiceProductCharge(item).toFixed(2)}
                              </div>
                            )}

                            {/* Ad-hoc Service Product Usage */}
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-700">Service Product Usage</label>
                                <button
                                  type="button"
                                  onClick={() => handleOpenServiceProductModal(index)}
                                  className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                >
                                  + Add Product
                                </button>
                              </div>

                              {(item.serviceProductUsages || []).length === 0 && (
                                <p className="text-[11px] text-gray-500">No usage added for this service.</p>
                              )}

                              {/* Display added service product usages */}
                              {(item.serviceProductUsages || []).map((usage, uIdx) => (
                                <div key={uIdx} className="bg-blue-50 border border-blue-200 rounded p-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-gray-800">{usage.productName}</p>
                                      <p className="text-[11px] text-gray-600">
                                        {usage.quantity} {usage.unit} • {usage.percentage}% charge
                                        {usage.instruction && ` • ${usage.instruction}`}
                                      </p>
                                      <p className="text-[11px] font-medium text-blue-700">
                                        ₱{(((productPriceMap[usage.productId] || 0) * ((usage.percentage ?? 0) / 100)) * (item.quantity || 1)).toFixed(2)}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData(prev => {
                                          const items = [...prev.items];
                                          const current = items[index];
                                          const usages = [...(current.serviceProductUsages || [])];
                                          usages.splice(uIdx, 1);
                                          items[index] = { ...current, serviceProductUsages: usages };
                                          return { ...prev, items };
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-700 ml-2"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                        </div>
                      )}
                    </div>
                  )))
                  }
                      </div>
                    </div>

              {/* Fixed Bottom Section */}
              <div className="border-t bg-white p-3 flex-shrink-0">
                <div className="space-y-2 mb-3">
                  {/* 3-Column Layout: Promotion | Discount | Loyalty */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {/* Column 1: Promotion Code */}
                    {(mode === 'billing' || mode === 'products-only') && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 flex flex-col gap-2 h-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-purple-700" />
                            <label className="block text-xs font-medium text-gray-700">
                              Promotion Code
                            </label>
                          </div>
                          {appliedPromotion && (
                            <span className="text-[11px] text-green-600 font-medium">
                              ✓ Active
                            </span>
                          )}
                        </div>
                        {!appliedPromotion ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={promotionCode}
                              onChange={(e) => setPromotionCode(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-purple-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                              placeholder="Enter code"
                            />
                            <button
                              type="button"
                              onClick={handleValidatePromotionCode}
                              disabled={validatingPromotion || !promotionCode.trim()}
                              className="w-full px-3 py-1.5 text-xs bg-[#2D1B4E] text-white rounded hover:bg-[#3d2a5f] disabled:opacity-50"
                            >
                              {validatingPromotion ? 'Validating…' : 'Apply Promo'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium text-purple-700">{appliedPromotion.title || appliedPromotion.code}</p>
                            <p className="text-xs text-green-600">-₱{promotionDiscount.toFixed(2)} off</p>
                            <button
                              type="button"
                              onClick={handleRemovePromotion}
                              className="mt-1 text-xs text-red-600 hover:text-red-800 underline text-left"
                            >
                              Remove Promotion
                            </button>
                          </div>
                        )}
                        {promotionError && (
                          <p className="text-xs text-red-600">{promotionError}</p>
                        )}
                      </div>
                    )}

                    {/* Column 2: Manual Discount (disabled when promotion is active) */}
                    {(mode === 'billing' || mode === 'products-only') && (
                      <div className={`border rounded-lg p-2 flex flex-col gap-2 h-full ${appliedPromotion ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-blue-700" />
                            <label className="block text-xs font-medium text-gray-700">Discount</label>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <label className={`flex items-center gap-1 ${appliedPromotion ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="radio"
                                name="discountType"
                                value="percent"
                                checked={formData.discountType === 'percent'}
                                onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                                disabled={!!appliedPromotion}
                                className="text-blue-600"
                              />
                              <span>%</span>
                            </label>
                            <label className={`flex items-center gap-1 ${appliedPromotion ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="radio"
                                name="discountType"
                                value="fixed"
                                checked={formData.discountType === 'fixed'}
                                onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                                disabled={!!appliedPromotion}
                                className="text-blue-600"
                              />
                              <span>₱</span>
                            </label>
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.discount}
                          onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                          disabled={!!appliedPromotion}
                          className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent ${appliedPromotion ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-blue-300'}`}
                          placeholder={appliedPromotion ? 'Promo active' : (formData.discountType === 'percent' ? 'Enter %' : 'Enter ₱')}
                        />
                        {appliedPromotion && (
                          <p className="text-[11px] text-gray-500">Disabled while promo is active</p>
                        )}
                        {!appliedPromotion && formData.discount && parseFloat(formData.discount) > 0 && (
                          <p className="text-xs text-blue-600">
                            Discount: -{formData.discountType === 'percent' ? `${formData.discount}%` : `₱${parseFloat(formData.discount).toFixed(2)}`}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Column 3: Loyalty Points */}
                    {(mode === 'billing' || mode === 'products-only') && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex flex-col gap-2 h-full">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                            <label className="block text-xs font-medium text-gray-700">
                              Loyalty
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">1pt = ₱1</span>
                        </div>
                        
                        {(appointment?.clientId || formData.clientId) && !isGuestCustomer ? (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Avail: <span className="font-bold text-yellow-700">{clientLoyaltyPoints}</span></span>
                              <span className="text-gray-600">Earn: <span className="font-bold text-green-600">+{Math.floor((totals.total || 0) * 0.01)}</span></span>
                            </div>
                            
                            {clientLoyaltyPoints > 0 ? (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  max={clientLoyaltyPoints}
                                  step="1"
                                  value={formData.loyaltyPointsUsed || ''}
                                  onChange={(e) => {
                                    const points = parseInt(e.target.value) || 0;
                                    if (points <= clientLoyaltyPoints) {
                                      setFormData(prev => ({ ...prev, loyaltyPointsUsed: points.toString() }));
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-yellow-500 focus:border-transparent border-yellow-300"
                                  placeholder="Points to use"
                                />
                                {formData.loyaltyPointsUsed && parseInt(formData.loyaltyPointsUsed) > 0 && (
                                  <p className="text-xs text-green-600">-₱{parseInt(formData.loyaltyPointsUsed) || 0}</p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-500">No points yet</p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">{isGuestCustomer ? 'Guest checkout' : 'Select client'}</p>
                        )}
                      </div>
                    )}
                  </div>

                {/* Payment Method - Show in billing mode and products-only mode */}
                {(mode === 'billing' || mode === 'products-only') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.CASH}
                          checked={formData.paymentMethod === PAYMENT_METHODS.CASH}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="text-blue-600"
                        />
                        <Banknote className="h-4 w-4 text-green-600" />
                        <span className="text-xs">Cash</span>
                      </label>
                      
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.CARD}
                          checked={formData.paymentMethod === PAYMENT_METHODS.CARD}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="text-blue-600"
                        />
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <span className="text-xs">Card</span>
                      </label>
                      
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.VOUCHER}
                          checked={formData.paymentMethod === PAYMENT_METHODS.VOUCHER || formData.paymentMethod === PAYMENT_METHODS.GIFT_CARD}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: PAYMENT_METHODS.VOUCHER }))}
                          className="text-blue-600"
                        />
                        <Smartphone className="h-4 w-4 text-purple-600" />
                        <span className="text-xs">E-Wallet</span>
                      </label>
                    </div>

                    {formData.paymentMethod === PAYMENT_METHODS.CASH && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (₱) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.amountReceived}
                          onChange={(e) => setFormData(prev => ({ ...prev, amountReceived: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent ${
                            formData.amountReceived && parseFloat(formData.amountReceived) < totals.total
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="Enter amount received"
                          required
                        />
                        {formData.amountReceived && parseFloat(formData.amountReceived) >= totals.total && (
                          <p className="mt-2 text-sm text-green-600 font-medium">
                            Change: ₱{Math.max(0, parseFloat(formData.amountReceived) - totals.total).toFixed(2)}
                          </p>
                        )}
                        {formData.amountReceived && parseFloat(formData.amountReceived) < totals.total && (
                          <p className="mt-2 text-sm text-red-600 font-medium">
                            Insufficient amount! Required: ₱{totals.total.toFixed(2)} | Short: ₱{(totals.total - parseFloat(formData.amountReceived)).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Payment Reference for non-cash */}
                    {formData.paymentMethod !== PAYMENT_METHODS.CASH && (
                      <input
                        type="text"
                        value={formData.paymentReference}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value }))}
                        className="w-full mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E]"
                        placeholder="Reference number (optional)"
                      />
                    )}

                    {/* Receipt Number - Auto-generated from BIR Batch */}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Receipt Number *
                        {loadingReceiptNumber && (
                          <span className="ml-2 text-xs text-gray-500">Loading...</span>
                        )}
                      </label>
                      
                      {receiptNumberError ? (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {receiptNumberError}
                          </p>
                        </div>
                      ) : activeBatch ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 bg-green-50 border border-green-300 rounded-lg">
                              <span className="text-lg font-bold text-green-700">{nextReceiptNumber}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Remaining</p>
                              <p className={`text-sm font-semibold ${activeBatch.remainingReceipts <= 10 ? 'text-orange-600' : 'text-green-600'}`}>
                                {activeBatch.remainingReceipts}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Batch: {String(activeBatch.startNumber).padStart(4, '0')} to {String(activeBatch.endNumber).padStart(4, '0')}
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-700 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            No active receipt batch found
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bill Summary */}
                <div className="space-y-1 text-xs mb-3">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₱{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {promotionDiscount > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>Promotion Discount:</span>
                      <span>-₱{promotionDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.serviceProductCharge > 0 && (
                    <div className="flex justify-between text-blue-700">
                      <span>Service Product Charges:</span>
                      <span>₱{totals.serviceProductCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.discount > 0 && !appliedPromotion && (
                    <div className="flex justify-between">
                      <span>
                        Discount (
                        {formData.discountType === 'percent'
                          ? `${formData.discount || 0}%`
                          : `₱${(parseFloat(formData.discount) || 0).toFixed(2)}`}
                        ):
                      </span>
                      <span>-₱{totals.discount.toFixed(2)}</span>
                      </div>
                    )}
                  <hr />
                  <div className="flex justify-between font-bold text-base">
                    <span>TOTAL:</span>
                    <span className="text-[#2D1B4E]">₱{totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    formData.items.length === 0 ||
                    ((mode === 'billing' || mode === 'products-only') && formData.paymentMethod === PAYMENT_METHODS.CASH &&
                     (!formData.amountReceived || parseFloat(formData.amountReceived) < totals.total))
                  }
                    className="flex-1 bg-[#2D1B4E] hover:bg-[#3d2a5f] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4 py-2 text-sm"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Processing...</span>
                    </>
                  ) : (
                      <span>
                        {mode === 'start-service' ? 'Start Service' :
                         mode === 'checkin' ? (appointment?.isWalkIn ? 'Add to Queue' : 'Confirm Check-in') :
                         mode === 'products-only' ? 'Complete Transaction' :
                         'Process Payment'}
                      </span>
                  )}
                </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </form>
      </div>

      {/* Existing Receipt Details Modal */}
      {showReceiptDetails && existingReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Existing Receipt</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Receipt Number: <span className="font-medium text-red-600">{existingReceipt.receiptNumber}</span>
                </p>
              </div>
              <button
                onClick={() => setShowReceiptDetails(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Alert */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Duplicate Receipt Number Detected</p>
                    <p className="text-sm text-red-700 mt-1">
                      This receipt number is already associated with another transaction. Please verify the receipt number or use a different one.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actual Receipt */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <Receipt 
                  bill={{
                    ...existingReceipt,
                    // Ensure receiptNumber is displayed in the receipt
                    receiptNumber: existingReceipt.receiptNumber
                  }} 
                  branch={branchData}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowReceiptDetails(false);
                    setFormData(prev => ({ ...prev, receiptNumber: '' }));
                    setExistingReceipt(null);
                  }}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Clear Receipt Number
                </button>
                <button
                  onClick={() => setShowReceiptDetails(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showConfirmModal && pendingBillData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Payment</h3>
              <p className="text-gray-600">Please verify the payment details below</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Customer:</span>
                <span className="font-semibold">{pendingBillData.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-semibold capitalize">{pendingBillData.paymentMethod}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Receipt No:</span>
                <span className="font-semibold text-green-600">#{nextReceiptNumber || 'Auto-generated'}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>₱{pendingBillData.subtotal?.toFixed(2)}</span>
                </div>
                {pendingBillData.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span>-₱{pendingBillData.discount?.toFixed(2)}</span>
                  </div>
                )}
                {(pendingBillData.serviceProductChargeTotal || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Product Charges:</span>
                    <span>₱{pendingBillData.serviceProductChargeTotal?.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                <span>Total:</span>
                <span className="text-purple-600">₱{pendingBillData.total?.toFixed(2)}</span>
              </div>
              {pendingBillData.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount Received:</span>
                    <span className="font-semibold">₱{pendingBillData.amountReceived?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-green-600">
                    <span>Change:</span>
                    <span>₱{pendingBillData.change?.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingBillData(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPayment}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Product Usage Modal */}
      {showServiceProductModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#2D1B4E] to-[#4A3B6B] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Add Product Usage</h3>
                  <p className="text-white/70 text-sm">{serviceProductModalData.serviceName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowServiceProductModal(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1">
              {(serviceProductModalData.productMappings || []).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No products mapped to this service</p>
                  <p className="text-xs text-gray-400 mt-1">Configure product mappings in service settings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-3">Select a product and usage amount:</p>
                  {(serviceProductModalData.productMappings || []).map((mapping, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{mapping.productName}</h4>
                        <span className="text-xs text-gray-500">
                          ₱{productPriceMap[mapping.productId]?.toFixed(2) || '0.00'}/unit
                        </span>
                      </div>
                      
                      {/* Instructions/Quantities */}
                      {mapping.instructions && mapping.instructions.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {mapping.instructions.map((instr, instrIdx) => {
                            const charge = ((productPriceMap[mapping.productId] || 0) * (instr.percentage / 100)).toFixed(2);
                            return (
                              <button
                                key={instrIdx}
                                type="button"
                                onClick={() => handleAddServiceProductUsage(
                                  mapping.productId,
                                  mapping.productName,
                                  instr.quantity,
                                  instr.unit || mapping.unit || 'ml',
                                  instr.percentage,
                                  instr.instruction
                                )}
                                className="text-left p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                              >
                                <p className="text-sm font-medium text-gray-800">
                                  {instr.instruction || `${instr.quantity} ${instr.unit || mapping.unit || 'ml'}`}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {instr.quantity} {instr.unit || mapping.unit || 'ml'} • {instr.percentage}%
                                </p>
                                <p className="text-xs font-medium text-blue-700">+₱{charge}</p>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddServiceProductUsage(
                            mapping.productId,
                            mapping.productName,
                            mapping.quantity || 1,
                            mapping.unit || 'ml',
                            mapping.percentage || 0,
                            ''
                          )}
                          className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-800">
                            {mapping.quantity || 1} {mapping.unit || 'ml'}
                          </p>
                          <p className="text-xs text-gray-600">{mapping.percentage || 0}% charge</p>
                          <p className="text-xs font-medium text-blue-700">
                            +₱{((productPriceMap[mapping.productId] || 0) * ((mapping.percentage || 0) / 100)).toFixed(2)}
                          </p>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t p-4 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowServiceProductModal(false)}
                className="w-full px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingModalPOS;
