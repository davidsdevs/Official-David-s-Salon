// src/pages/06_InventoryController/UpcGenerator.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import { productService } from '../../services/productService';
import { inventoryService } from '../../services/inventoryService';
import {
  QrCode,
  Search,
  Filter,
  Eye,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Calendar,
  Building,
  Copy,
  Printer,
  Download,
  Home,
  TrendingUp,
  ArrowRightLeft,
  ShoppingCart,
  Truck,
  BarChart3,
  Banknote,
  ClipboardList,
  UserCog,
  PackageCheck,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

const UpcGenerator = () => {
  const { userData, userBranch } = useAuth();
  const printRef = useRef();

  
  
  // Data states
  const [products, setProducts] = useState([]);
  const [productsAll, setProductsAll] = useState([]);
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [generatedQRCodes, setGeneratedQRCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [qrCodesToPrint, setQrCodesToPrint] = useState([]);
  const [currentBatches, setCurrentBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isMassPrintModalOpen, setIsMassPrintModalOpen] = useState(false);
  const [selectedBatchesForPrint, setSelectedBatchesForPrint] = useState([]);
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    hasQRCode: 'all',
    brand: 'all',
    hasBatches: 'all'
  });

  // Generate form states
  const [generateForm, setGenerateForm] = useState({
    productId: '',
    branchId: '',
    batchId: '',
    quantity: 1,
    size: 'medium'
  });

  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'QR Code Stickers'
  });

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load products
      let productsResult;
      if (userBranch) {
        productsResult = await productService.getBranchProducts(userBranch);
      } else {
        productsResult = await productService.getAllProducts();
      }
      if (productsResult.success) {
        setProductsAll(productsResult.products || []);
      } else {
        throw new Error(productsResult.message || 'Failed to load products');
      }

      // Auto-set branch to user's branch (no need to load branches for selection)
      if (userBranch) {
        setGenerateForm(prev => ({ ...prev, branchId: userBranch }));
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'An error occurred while loading data');
    } finally {
      setLoading(false);
    }
  };

  // Load batches for a product in a branch
  // Get batches from 'stocks' collection where stockType === 'batch' OR has batchId/batchNumber
  // Show ALL batches so user can choose which one to print stickers for
  const loadBatches = async (productId, branchId) => {
    try {
      // Query stocks collection for batch-type stocks
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../config/firebase');
      
      const stocksRef = collection(db, 'stocks');
      
      // Query for stocks with this productId and branchId
      // Filter client-side for batch-related documents (stockType === 'batch' OR has batchId/batchNumber)
      const q = query(
        stocksRef,
        where('branchId', '==', branchId),
        where('productId', '==', productId)
      );
      
      const snapshot = await getDocs(q);
      const batches = [];
      
      console.log(`🔍 Loading batches for product ${productId} in branch ${branchId}`);
      console.log(`📦 Found ${snapshot.size} stock documents`);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check if this is a batch-type stock
        // A batch has: stockType === 'batch' OR has batchId OR has batchNumber
        const isBatch = data.stockType === 'batch' || 
                       data.batchId || 
                       (data.batchNumber && data.batchNumber.trim() !== '');
        
        if (isBatch) {
          console.log(`✅ Found batch: ${data.batchNumber || data.batchId}`, {
            id: doc.id,
            batchId: data.batchId,
            batchNumber: data.batchNumber,
            stockType: data.stockType,
            realTimeStock: data.realTimeStock,
            status: data.status
          });
          
          // Map stocks collection structure to batch format
          batches.push({
            id: doc.id,
            batchId: data.batchId || doc.id,
            batchNumber: data.batchNumber || `BATCH-${doc.id.slice(0, 8)}`,
            productId: data.productId,
            productName: data.productName || '',
            branchId: data.branchId,
            expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                           data.expirationDate instanceof Date ? data.expirationDate :
                           data.expirationDate ? new Date(data.expirationDate) : null,
            remainingQuantity: data.realTimeStock || data.endStock || 0,
            quantity: data.beginningStock || data.realTimeStock || 0,
            unitCost: data.unitCost || 0,
            status: data.status || 'active',
            purchaseOrderId: data.purchaseOrderId || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                      data.createdAt instanceof Date ? data.createdAt :
                      data.createdAt ? new Date(data.createdAt) : new Date(),
          });
        } else {
          console.log(`⏭️ Skipping non-batch stock:`, {
            id: doc.id,
            stockType: data.stockType,
            hasBatchId: !!data.batchId,
            hasBatchNumber: !!data.batchNumber
          });
        }
      });
      
      console.log(`📋 Total batches found: ${batches.length}`);
      
      // Sort by expiration date (oldest first) and then by batch number
      return batches.sort((a, b) => {
        // First sort by expiration date
        const dateA = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
        const dateB = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
        if (dateA !== dateB) return dateA - dateB;
        // Then by batch number
        return (a.batchNumber || '').localeCompare(b.batchNumber || '');
      });
    } catch (error) {
      console.error('Error loading batches from stocks collection:', error);
      // Fallback to product_batches if stocks query fails
      try {
        console.log('🔄 Falling back to product_batches collection...');
        const batchesResult = await inventoryService.getProductBatches(branchId, productId);
        if (batchesResult.success) {
          console.log(`✅ Found ${batchesResult.batches.length} batches from product_batches`);
          return batchesResult.batches.sort((a, b) => {
            const dateA = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
            const dateB = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;
            return (a.batchNumber || '').localeCompare(b.batchNumber || '');
          });
        }
      } catch (fallbackError) {
        console.error('Fallback to product_batches also failed:', fallbackError);
      }
      return [];
    }
  };

  // Load current batches/products
  const loadCurrentBatches = async () => {
    if (!userBranch) return;
    
    try {
      setLoadingBatches(true);
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../config/firebase');
      
      const stocksRef = collection(db, 'stocks');
      const q = query(
        stocksRef,
        where('branchId', '==', userBranch),
        where('stockType', '==', 'batch')
      );
      
      const snapshot = await getDocs(q);
      const batches = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.batchNumber && (data.realTimeStock || 0) > 0) {
          batches.push({
            id: doc.id,
            batchNumber: data.batchNumber,
            productId: data.productId,
            productName: data.productName || 'Unknown',
            expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                           data.expirationDate instanceof Date ? data.expirationDate :
                           data.expirationDate ? new Date(data.expirationDate) : null,
            remainingQuantity: data.realTimeStock || 0,
            status: data.status || 'active'
          });
        }
      });
      
      // Sort by expiration date
      batches.sort((a, b) => {
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return new Date(a.expirationDate) - new Date(b.expirationDate);
      });
      
      setCurrentBatches(batches);
    } catch (error) {
      console.error('Error loading current batches:', error);
      setCurrentBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
    loadCurrentBatches();
  }, [userBranch]);

  // Reload products when pagination changes
  useEffect(() => {
    loadData();
  }, [currentPage]);

  // Auto-set branch to user's branch
  useEffect(() => {
    if (userBranch && !generateForm.branchId) {
      setGenerateForm(prev => ({ ...prev, branchId: userBranch }));
    }
  }, [userBranch]);

  // Load batches when branch or product changes in generate form
  useEffect(() => {
    if (generateForm.productId && generateForm.branchId) {
      loadBatches(generateForm.productId, generateForm.branchId).then(batches => {
        setSelectedBatches(batches);
        if (batches.length > 0 && !generateForm.batchId) {
          setGenerateForm(prev => ({ ...prev, batchId: batches[0].id }));
        } else if (batches.length === 0) {
          setGenerateForm(prev => ({ ...prev, batchId: '' }));
        }
      }).catch(error => {
        console.error('Error loading batches:', error);
        setSelectedBatches([]);
      });
    } else {
      setSelectedBatches([]);
    }
  }, [generateForm.productId, generateForm.branchId]);

  // Ensure batches reload when opening the generate modal
  useEffect(() => {
    if (isGenerateModalOpen && generateForm.productId && generateForm.branchId) {
      loadBatches(generateForm.productId, generateForm.branchId).then(batches => {
        setSelectedBatches(batches);
      }).catch(() => setSelectedBatches([]));
    }
  }, [isGenerateModalOpen]);

  // Get unique categories and brands (from full product list)
  const categories = [...new Set(productsAll.map(p => p.category))].filter(Boolean);
  const brands = [...new Set(productsAll.map(p => p.brand))].filter(Boolean);

  // Filter and sort products (operate on full list)
  const filteredProducts = productsAll
    .filter(product => {
      // Safe search - handle undefined/null values
      const searchLower = (searchTerm || '').toLowerCase();
      const productName = (product.name || '').toLowerCase();
      const productBrand = (product.brand || '').toLowerCase();
      const productUPC = (product.upc || '').toLowerCase();
      
      const matchesSearch = !searchTerm || 
                           productName.includes(searchLower) ||
                           productBrand.includes(searchLower) ||
                           productUPC.includes(searchLower);
      
      const matchesCategory = filters.category === 'all' || (product.category || '') === filters.category;
      const matchesStatus = filters.status === 'all' || (product.status || '') === filters.status;
      const matchesBrand = filters.brand === 'all' || (product.brand || '') === filters.brand;
      
      // Check if product has batches (for hasBatches filter)
      let matchesHasBatches = true;
      if (filters.hasBatches === 'yes') {
        const hasBatches = currentBatches.some(b => b.productId === product.id);
        matchesHasBatches = hasBatches;
      } else if (filters.hasBatches === 'no') {
        const hasBatches = currentBatches.some(b => b.productId === product.id);
        matchesHasBatches = !hasBatches;
      }
      
      return matchesSearch && matchesCategory && matchesStatus && matchesBrand && matchesHasBatches;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Pagination for filtered products
    const totalProducts = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(totalProducts / itemsPerPage));
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handle product details
  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  // Handle generate QR code - open batch selection modal
  const handleGenerateQRCode = async (product) => {
    setSelectedProduct(product);
    setSelectedBatches([]);
    setGenerateForm({
      productId: product.id,
      branchId: userBranch || '',
      batchId: '',
      quantity: 1,
      size: 'medium'
    });
    setIsGenerateModalOpen(true);
  };

  // Handle batch selection and QR code generation
  const handleGenerateFromBatch = async (batch) => {
    try {
      setLoading(true);
      setError(null);

      if (!batch || !batch.batchNumber) {
        setError('Invalid batch selected');
        return;
      }

      // Use batch data from stocks collection
      const qrCodeString = JSON.stringify({
        productId: batch.productId,
        productName: batch.productName || selectedProduct?.name,
        price: selectedProduct?.otcPrice || 0,
        batchNumber: batch.batchNumber,
        batchId: batch.batchId || batch.id,
        expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
        branchId: batch.branchId,
        timestamp: Date.now()
      });

      // Create QR code data (in-memory only, no database)
      const qrCode = {
        id: `qr-${Date.now()}`,
        qrCodeString: qrCodeString,
        batchNumber: batch.batchNumber,
        productName: batch.productName,
        productId: batch.productId,
        price: selectedProduct?.otcPrice || 0,
        expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
        branchId: batch.branchId,
        createdAt: new Date()
      };

      setGeneratedQRCodes(prev => [...prev, qrCode]);
      setQrCodesToPrint([qrCode]);
      setIsGenerateModalOpen(false);
      setIsPrintModalOpen(true);
      setError(null);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError(err.message || 'An error occurred while generating QR code');
    } finally {
      setLoading(false);
    }
  };

  // Save QR code sticker as PNG
  const handleSaveAsPNG = async (qrCode, index) => {
    try {
      const stickerElement = document.getElementById(`sticker-${index}`);
      if (!stickerElement) {
        setError('Sticker element not found');
        return;
      }

      // Create a larger version of the sticker for PNG download (4x the size for better readability)
      const scaleFactor = 4;
      const originalWidth = 192; // 2in at 96 DPI
      const originalHeight = 192; // 2in at 96 DPI
      const targetWidth = originalWidth * scaleFactor;
      const targetHeight = originalHeight * scaleFactor;

      // Create a temporary container with scaled dimensions and new layout (3in x 3in)
      const tempContainer = document.createElement('div');
      tempContainer.style.width = `${targetWidth}px`;
      tempContainer.style.height = `${targetHeight}px`;
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.background = '#ffffff';
      tempContainer.style.border = `${4 * scaleFactor}px solid #ef4444`;
      tempContainer.style.borderRadius = `${12 * scaleFactor}px`;
      tempContainer.style.display = 'flex';
      tempContainer.style.flexDirection = 'column';
      tempContainer.style.alignItems = 'center';
      tempContainer.style.padding = `${0.3 * scaleFactor * 16}px`; // Larger padding
      tempContainer.style.boxSizing = 'border-box';
      tempContainer.style.gap = `${0.15 * scaleFactor * 16}px`; // Larger gap between elements
      tempContainer.style.boxShadow = `0 ${10 * scaleFactor}px ${15 * scaleFactor}px -3px rgba(0, 0, 0, 0.1)`;

      // Logo - Top
      const logoDiv = document.createElement('div');
      logoDiv.style.flexShrink = '0';
      logoDiv.style.display = 'flex';
      logoDiv.style.alignItems = 'center';
      logoDiv.style.justifyContent = 'center';
      logoDiv.style.width = '100%';

      const logoImg = document.createElement('img');
      logoImg.src = '/logo.jpg';
      logoImg.alt = 'David\'s Salon Logo';
      logoImg.style.height = `${24 * scaleFactor}px`; // Scaled logo height
      logoImg.style.width = 'auto';
      logoImg.style.objectFit = 'contain';
      logoImg.style.maxHeight = `${24 * scaleFactor}px`;
      logoImg.onload = () => {}; // Handle load
      logoImg.onerror = () => {
        // Fallback to text if image fails
        logoDiv.innerHTML = '';
        const fallback = document.createElement('div');
        fallback.style.fontSize = `${40 * scaleFactor}px`;
        fallback.style.fontWeight = 'bold';
        fallback.style.color = '#374151';
        fallback.textContent = "David's Salon";
        logoDiv.appendChild(fallback);
      };
      logoDiv.appendChild(logoImg);
      tempContainer.appendChild(logoDiv);

      // QR Code - Bigger
      const qrContainer = document.createElement('div');
      qrContainer.style.flexShrink = '0';
      qrContainer.style.display = 'flex';
      qrContainer.style.alignItems = 'center';
      qrContainer.style.justifyContent = 'center';
      qrContainer.style.width = '100%';
      qrContainer.style.padding = `${8 * scaleFactor}px`;
      qrContainer.style.backgroundColor = '#f9fafb';
      qrContainer.style.borderRadius = `${4 * scaleFactor}px`;
      qrContainer.style.border = '1px solid #d1d5db';

      const qrSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      qrSvg.setAttribute('width', `${120 * scaleFactor}`);
      qrSvg.setAttribute('height', `${120 * scaleFactor}`);
      qrSvg.setAttribute('viewBox', '0 0 120 120');
      qrSvg.style.border = '1px solid #d1d5db';
      qrSvg.style.borderRadius = `${4 * scaleFactor}px`;
      qrContainer.appendChild(qrSvg);

      // Generate QR code
      const QRCode = (await import('qrcode')).default;
      await QRCode.toCanvas(qrSvg, qrCode.qrCodeString, {
        width: 120 * scaleFactor,
        margin: 0,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      tempContainer.appendChild(qrContainer);

      // Batch Number
      if (qrCode.batchNumber && qrCode.batchNumber !== 'N/A') {
        const batchDiv = document.createElement('div');
        batchDiv.style.display = 'flex';
        batchDiv.style.alignItems = 'center';
        batchDiv.style.justifyContent = 'center';
        batchDiv.style.width = '100%';
        batchDiv.style.gap = `${0.06 * scaleFactor * 16}px`;

        const packageIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        packageIcon.setAttribute('viewBox', '0 0 24 24');
        packageIcon.setAttribute('fill', 'none');
        packageIcon.setAttribute('stroke', 'currentColor');
        packageIcon.setAttribute('strokeWidth', '2');
        packageIcon.setAttribute('strokeLinecap', 'round');
        packageIcon.setAttribute('strokeLinejoin', 'round');
        packageIcon.classList.add('lucide', 'lucide-package');
        packageIcon.style.height = `${14 * scaleFactor}px`;
        packageIcon.style.width = `${14 * scaleFactor}px`;
        packageIcon.style.color = '#4b5563';
        packageIcon.style.flexShrink = '0';
        packageIcon.innerHTML = '<path d="m7.5 4.274 5.73 3.438c.14.084.27.17.4.252.34.204.67.41.99.612l3.73 2.238"/><path d="M17.5 10.274 12 13.5l-5.5-3.226"/><path d="m7.5 19.726 5.73-3.438c.14-.084.27-.17.4-.252.34-.204.67-.41.99-.612l3.73-2.238"/><path d="M17.5 13.726 12 10.5l-5.5 3.226"/><path d="M12 22v-8.5"/><path d="M12 2v8.5"/><path d="M2 13.5h20"/>';
        batchDiv.appendChild(packageIcon);

        const batchP = document.createElement('p');
        batchP.style.fontSize = `${44 * scaleFactor}px`;
        batchP.style.color = '#374151';
        batchP.style.fontWeight = '500';
        batchP.style.margin = '0';
        batchP.textContent = `Batch: ${qrCode.batchNumber}`;
        batchDiv.appendChild(batchP);

        tempContainer.appendChild(batchDiv);
      }

      // Expiration Date
      if (qrCode.expirationDate) {
        const expDiv = document.createElement('div');
        expDiv.style.display = 'flex';
        expDiv.style.alignItems = 'center';
        expDiv.style.justifyContent = 'center';
        expDiv.style.width = '100%';
        expDiv.style.gap = `${0.06 * scaleFactor * 16}px`;
        expDiv.style.backgroundColor = '#fef2f2';
        expDiv.style.padding = `${4 * scaleFactor}px ${8 * scaleFactor}px`;
        expDiv.style.borderRadius = `${4 * scaleFactor}px`;

        const calendarIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        calendarIcon.setAttribute('viewBox', '0 0 24 24');
        calendarIcon.setAttribute('fill', 'none');
        calendarIcon.setAttribute('stroke', 'currentColor');
        calendarIcon.setAttribute('strokeWidth', '2');
        calendarIcon.setAttribute('strokeLinecap', 'round');
        calendarIcon.setAttribute('strokeLinejoin', 'round');
        calendarIcon.classList.add('lucide', 'lucide-calendar');
        calendarIcon.style.height = `${14 * scaleFactor}px`;
        calendarIcon.style.width = `${14 * scaleFactor}px`;
        calendarIcon.style.color = '#dc2626';
        calendarIcon.style.flexShrink = '0';
        calendarIcon.innerHTML = '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>';
        expDiv.appendChild(calendarIcon);

        const expP = document.createElement('p');
        expP.style.fontSize = `${44 * scaleFactor}px`;
        expP.style.color = '#b91c1c';
        expP.style.fontWeight = 'semibold';
        expP.style.margin = '0';
        expP.textContent = `Exp: ${format(new Date(qrCode.expirationDate), 'MMM dd, yyyy')}`;
        expDiv.appendChild(expP);

        tempContainer.appendChild(expDiv);
      } else {
        const noExpP = document.createElement('p');
        noExpP.style.fontSize = `${44 * scaleFactor}px`;
        noExpP.style.color = '#9ca3af';
        noExpP.style.fontStyle = 'italic';
        noExpP.style.margin = '0';
        noExpP.textContent = 'No expiration date';
        tempContainer.appendChild(noExpP);
      }

      // OTC Price
      const priceDiv = document.createElement('div');
      priceDiv.style.display = 'flex';
      priceDiv.style.alignItems = 'center';
      priceDiv.style.justifyContent = 'center';
      priceDiv.style.width = '100%';

      const priceP = document.createElement('p');
      priceP.style.fontSize = `${48 * scaleFactor}px`;
      priceP.style.fontWeight = 'bold';
      priceP.style.color = '#2563eb';
      priceP.style.margin = '0';
      priceP.textContent = `₱${qrCode.price?.toFixed(2) || '0.00'}`;
      priceDiv.appendChild(priceP);

      tempContainer.appendChild(priceDiv);

      // Add to body temporarily
      document.body.appendChild(tempContainer);

      // Use html2canvas on the scaled container
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: '#ffffff',
        scale: 1, // Don't double-scale since we're already creating at target size
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: targetWidth,
        height: targetHeight
      });

      // Remove temporary container
      document.body.removeChild(tempContainer);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Failed to create PNG');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${qrCode.productName.replace(/[^a-z0-9]/gi, '_')}_QR_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png', 1.0);
    } catch (err) {
      console.error('Error saving as PNG:', err);
      setError('Failed to save as PNG: ' + err.message);
    }
  };

  // Batch Print - Print all batches for a product with quantities equal to remainingQuantity
  const handleBatchPrint = async (product) => {
    try {
      setLoading(true);
      setError(null);

      if (!product || !product.id) {
        setError('Invalid product selected');
        setLoading(false);
        return;
      }

      if (!userBranch) {
        setError('No branch selected');
        setLoading(false);
        return;
      }

      // Load all batches for this product
      const batches = await loadBatches(product.id, userBranch);
      
      if (batches.length === 0) {
        setError('No batches found for this product');
        setLoading(false);
        return;
      }

      // Create QR codes for all batches based on remainingQuantity
      const allQRCodes = [];
      
      for (const batch of batches) {
        const quantity = batch.remainingQuantity || 0;
        if (quantity <= 0) continue;

        for (let i = 0; i < quantity; i++) {
          const qrCodeString = JSON.stringify({
            productId: batch.productId,
            productName: batch.productName || product.name,
            price: product.otcPrice || 0,
            batchNumber: batch.batchNumber,
            batchId: batch.batchId || batch.id,
            expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
            branchId: batch.branchId || userBranch,
            timestamp: Date.now()
          });

          const qrCode = {
            id: `qr-${batch.id}-${i}-${Date.now()}`,
            qrCodeString: qrCodeString,
            batchNumber: batch.batchNumber,
            productName: batch.productName || product.name,
            productId: batch.productId,
            price: product.otcPrice || 0,
            expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
            branchId: batch.branchId || userBranch,
            createdAt: new Date()
          };

          allQRCodes.push(qrCode);
        }
      }

      if (allQRCodes.length === 0) {
        setError('No QR codes to print (all batches have zero quantity)');
        setLoading(false);
        return;
      }

      // Set QR codes to print and open print modal for preview
      setQrCodesToPrint(allQRCodes);
      setIsPrintModalOpen(true);
      setLoading(false);

    } catch (err) {
      console.error('Error in batch print:', err);
      setError(err.message || 'An error occurred while preparing batch print');
      setLoading(false);
    }
  };

  // Generate PDF for batch print
  const handleBatchPrintPDF = async (qrCodes) => {
    try {
      const jsPDF = (await import('jspdf')).default;
      // Use A4 format for better international compatibility
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      });

      // A4 dimensions in mm: 210mm x 297mm
      const pageWidth = 210;
      const pageHeight = 297;

      // Calculate optimal sticker layout for A4 (3in x 3in stickers)
      // 2 columns x 2 rows = 4 stickers per page (since stickers are now 3in x 3in)
      const stickersPerRow = 2;
      const stickersPerColumn = 2;
      const totalStickersPerPage = stickersPerRow * stickersPerColumn;

      // Add margins (15mm on each side for better print margins)
      const marginLeft = 15;
      const marginRight = 15;
      const marginTop = 15;
      const marginBottom = 15;

      // Available space after margins
      const availableWidth = pageWidth - marginLeft - marginRight;
      const availableHeight = pageHeight - marginTop - marginBottom;

      // Space per sticker (distribute evenly)
      const stickerWidth = availableWidth / stickersPerRow;
      const stickerHeight = availableHeight / stickersPerColumn;

      // Gap between stickers (5mm for better separation with larger stickers)
      const gap = 5;
      const actualStickerWidth = stickerWidth - gap;
      const actualStickerHeight = stickerHeight - gap;
      
      for (let i = 0; i < qrCodes.length; i++) {
        // Wait a bit for elements to render
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const stickerElement = document.getElementById(`sticker-${i}`);
        if (!stickerElement) {
          console.warn(`Sticker element ${i} not found, skipping`);
          continue;
        }

        const canvas = await html2canvas(stickerElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        });
        const imgData = canvas.toDataURL('image/png');

        // Calculate position on page
        const pageIndex = Math.floor(i / totalStickersPerPage);
        const stickerIndexOnPage = i % totalStickersPerPage;

        const row = Math.floor(stickerIndexOnPage / stickersPerRow);
        const col = stickerIndexOnPage % stickersPerRow;

        // Add new page if needed
        if (pageIndex > 0 && stickerIndexOnPage === 0) {
          doc.addPage();
        }

        // Calculate exact position with margins
        const x = marginLeft + (col * stickerWidth) + (gap / 2);
        const y = marginTop + (row * stickerHeight) + (gap / 2);

        // Add the sticker image
        doc.addImage(imgData, 'PNG', x, y, actualStickerWidth, actualStickerHeight);
        
      }
      
      const productName = qrCodes[0]?.productName || 'product';
      const safeProductName = productName.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
      doc.save(`batch_print_${safeProductName}_${Date.now()}.pdf`);
    } catch (err) {
      console.error('Error generating batch print PDF:', err);
      throw err;
    }
  };

  // Save printable PDF of current batch
  const handleSaveAsPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      // Use A4 format for better international compatibility
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      });

      // A4 dimensions in mm: 210mm x 297mm
      const pageWidth = 210;
      const pageHeight = 297;

      // Calculate optimal sticker layout for A4 (3in x 3in stickers)
      // 2 columns x 2 rows = 4 stickers per page (since stickers are now 3in x 3in)
      const stickersPerRow = 2;
      const stickersPerColumn = 2;
      const totalStickersPerPage = stickersPerRow * stickersPerColumn;

      // Add margins (15mm on each side for better print margins)
      const marginLeft = 15;
      const marginRight = 15;
      const marginTop = 15;
      const marginBottom = 15;

      // Available space after margins
      const availableWidth = pageWidth - marginLeft - marginRight;
      const availableHeight = pageHeight - marginTop - marginBottom;

      // Space per sticker (distribute evenly)
      const stickerWidth = availableWidth / stickersPerRow;
      const stickerHeight = availableHeight / stickersPerColumn;

      // Gap between stickers (5mm for better separation with larger stickers)
      const gap = 5;
      const actualStickerWidth = stickerWidth - gap;
      const actualStickerHeight = stickerHeight - gap;

      for (let i = 0; i < qrCodesToPrint.length; i++) {
        const qrCode = qrCodesToPrint[i];
        const stickerElement = document.getElementById(`sticker-${i}`);
        if (!stickerElement) continue;

        const canvas = await html2canvas(stickerElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true
        });
        const imgData = canvas.toDataURL('image/png');

        // Calculate position on page
        const pageIndex = Math.floor(i / totalStickersPerPage);
        const stickerIndexOnPage = i % totalStickersPerPage;

        const row = Math.floor(stickerIndexOnPage / stickersPerRow);
        const col = stickerIndexOnPage % stickersPerRow;

        // Add new page if needed
        if (pageIndex > 0 && stickerIndexOnPage === 0) {
          doc.addPage();
        }

        // Calculate exact position with margins
        const x = marginLeft + (col * stickerWidth) + (gap / 2);
        const y = marginTop + (row * stickerHeight) + (gap / 2);

        // Add the sticker image
        doc.addImage(imgData, 'PNG', x, y, actualStickerWidth, actualStickerHeight);
      }

      doc.save(`upc_stickers_batch_${Date.now()}.pdf`);
    } catch (err) {
      console.error('Error saving PDF:', err);
      setError('Failed to save PDF: ' + err.message);
    }
  };

  // Handle form submission - generate QR codes from selected batch
  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      if (!generateForm.productId || !generateForm.branchId || !generateForm.batchId) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const batch = selectedBatches.find(b => b.id === generateForm.batchId);
      if (!batch) {
        setError('Please select a valid batch');
        setLoading(false);
        return;
      }

      if (!batch.batchNumber) {
        setError('Selected batch does not have a batch number');
        setLoading(false);
        return;
      }

      // Generate QR codes directly from batch data (no database storage - cache-based)
      const qrCodes = [];
      for (let i = 0; i < generateForm.quantity; i++) {
        // Use batch data from stocks collection
        const qrCodeString = JSON.stringify({
          productId: batch.productId,
          productName: batch.productName || selectedProduct?.name,
          price: selectedProduct?.otcPrice || 0,
          batchNumber: batch.batchNumber,
          batchId: batch.batchId || batch.id,
          expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
          branchId: batch.branchId,
          timestamp: Date.now()
        });

        // Create QR code data (in-memory only, no database)
        const qrCode = {
          id: `qr-${Date.now()}-${i}`,
          qrCodeString: qrCodeString,
          batchNumber: batch.batchNumber, // From product_batches
          productName: batch.productName || selectedProduct?.name,
          productId: batch.productId,
          price: selectedProduct?.otcPrice || 0,
          expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
          branchId: batch.branchId,
          createdAt: new Date()
        };

        qrCodes.push(qrCode);
      }

      if (qrCodes.length > 0) {
        setGeneratedQRCodes(prev => [...prev, ...qrCodes]);
        setQrCodesToPrint(qrCodes);
        setIsGenerateModalOpen(false);
        setIsPrintModalOpen(true);
        setError(null);
      } else {
        setError('No QR codes were generated. Please try again.');
      }
      
    } catch (err) {
      console.error('Error generating QR codes:', err);
      setError(err.message || 'An error occurred while generating QR codes');
    } finally {
      setLoading(false);
    }
  };

  // Copy QR code string to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-green-600 bg-green-100';
      case 'Inactive': return 'text-red-600 bg-red-100';
      case 'Discontinued': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active': return <CheckCircle className="h-4 w-4" />;
      case 'Inactive': return <XCircle className="h-4 w-4" />;
      case 'Discontinued': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Calculate statistics
  const stats = {
    totalProducts: products.length,
    productsWithQRCode: generatedQRCodes.length > 0 ? new Set(generatedQRCodes.map(q => q.productId)).size : 0,
    totalGenerated: generatedQRCodes.length,
    recentGenerated: generatedQRCodes.filter(g => 
      new Date(g.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length
  };

  if (loading && products.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading products...</span>
        </div>
      </>
    );
  }

  if (error && products.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Products</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData} className="flex items-center gap-2">
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
      <div className="space-y-6 max-w-full overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">QR Code Generator</h1>
            <p className="text-xs md:text-sm text-gray-600">Generate QR code stickers for product batches with expiration dates</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-3 md:p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 md:gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <p className="text-xs md:text-sm font-medium">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setError(null)} className="text-xs md:text-sm px-2 md:px-3 flex-shrink-0">
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {/* Filter Row */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
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
              title="Filter products"
            >
              <Filter className="w-5 h-5" />
            </Button>

            {/* Export Button */}
            <Button
              variant="outline"
              onClick={() => {
                // Export functionality - could export product list or QR codes
                const csvContent = products.map(p => `${p.name},${p.brand || ''},${p.category || ''},${p.otcPrice || ''}`).join('\n');
                const blob = new Blob([`Product Name,Brand,Category,Price\n${csvContent}`], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `products_${Date.now()}.csv`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2"
              title="Export products data"
            >
              <Download className="w-5 h-5" />
            </Button>
            {/* Print Button */}
            <Button
              variant="outline"
              onClick={async () => {
              // Mass print all products with batches
              try {
                setLoading(true);
                const allQRCodes = [];

                for (const product of productsAll) {
                  if (!product.id || !userBranch) continue;

                  try {
                    const batches = await loadBatches(product.id, userBranch);
                    if (batches.length === 0) continue;

                    for (const batch of batches) {
                      const quantity = batch.remainingQuantity || 0;
                      if (quantity <= 0) continue;

                      for (let i = 0; i < quantity; i++) {
                        const qrCodeString = JSON.stringify({
                          productId: batch.productId,
                          productName: batch.productName || product.name,
                          price: product.otcPrice || 0,
                          batchNumber: batch.batchNumber,
                          batchId: batch.batchId || batch.id,
                          expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
                          branchId: batch.branchId || userBranch,
                          timestamp: Date.now()
                        });

                        const qrCode = {
                          id: `qr-${batch.id}-${i}-${Date.now()}-${Math.random()}`,
                          qrCodeString: qrCodeString,
                          batchNumber: batch.batchNumber,
                          productName: batch.productName || product.name,
                          productId: batch.productId,
                          price: product.otcPrice || 0,
                          expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
                          branchId: batch.branchId || userBranch,
                          createdAt: new Date()
                        };

                        allQRCodes.push(qrCode);
                      }
                    }
                  } catch (error) {
                    console.warn(`Error loading batches for product ${product.name}:`, error);
                  }
                }

                if (allQRCodes.length === 0) {
                  setError('No QR codes to print - no products with active batches found');
                  setLoading(false);
                  return;
                }

                // Generate PDF with all stickers
                const jsPDF = (await import('jspdf')).default;
                const doc = new jsPDF({ unit: 'in', format: 'letter' });

                // Create temporary elements for rendering
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'absolute';
                tempContainer.style.left = '-9999px';
                tempContainer.style.top = '-9999px';
                document.body.appendChild(tempContainer);

                // A4 dimensions in mm: 210mm x 297mm for the PDF
                const pageWidth = 210;
                const pageHeight = 297;

                // Calculate optimal sticker layout for A4 (3in x 3in stickers)
                // 2 columns x 2 rows = 4 stickers per page (since stickers are now 3in x 3in)
                const stickersPerRow = 2;
                const stickersPerColumn = 2;
                const totalStickersPerPage = stickersPerRow * stickersPerColumn;

                // Add margins (15mm on each side for better print margins)
                const marginLeft = 15;
                const marginRight = 15;
                const marginTop = 15;
                const marginBottom = 15;

                // Available space after margins
                const availableWidth = pageWidth - marginLeft - marginRight;
                const availableHeight = pageHeight - marginTop - marginBottom;

                // Space per sticker (distribute evenly)
                const stickerWidth = availableWidth / stickersPerRow;
                const stickerHeight = availableHeight / stickersPerColumn;

                // Gap between stickers (5mm for better separation with larger stickers)
                const gap = 5;
                const actualStickerWidth = stickerWidth - gap;
                const actualStickerHeight = stickerHeight - gap;

                for (let i = 0; i < allQRCodes.length; i++) {
                  const qrCode = allQRCodes[i];

                  // Create temporary sticker element with new layout (3in x 3in)
                  const stickerDiv = document.createElement('div');
                  stickerDiv.style.width = '3in';
                  stickerDiv.style.height = '3in';
                  stickerDiv.style.boxSizing = 'border-box';
                  stickerDiv.style.padding = '0.3in';
                  stickerDiv.style.background = '#ffffff';
                  stickerDiv.style.border = '4px solid #ef4444';
                  stickerDiv.style.borderRadius = '12px';
                  stickerDiv.style.display = 'flex';
                  stickerDiv.style.flexDirection = 'column';
                  stickerDiv.style.alignItems = 'center';
                  stickerDiv.style.gap = '0.15in';
                  stickerDiv.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';

                  // Logo - Top
                  const logoDiv = document.createElement('div');
                  logoDiv.style.flexShrink = '0';
                  logoDiv.style.display = 'flex';
                  logoDiv.style.alignItems = 'center';
                  logoDiv.style.justifyContent = 'center';
                  logoDiv.style.width = '100%';

                  const logoImg = document.createElement('img');
                  logoImg.src = '/logo.jpg';
                  logoImg.alt = 'David\'s Salon Logo';
                  logoImg.style.height = '24px';
                  logoImg.style.width = 'auto';
                  logoImg.style.objectFit = 'contain';
                  logoImg.style.maxHeight = '24px';
                  logoImg.onload = () => {};
                  logoImg.onerror = () => {
                    // Fallback to text if image fails
                    logoDiv.innerHTML = '';
                    const fallback = document.createElement('div');
                    fallback.style.fontSize = '10px';
                    fallback.style.fontWeight = 'bold';
                    fallback.style.color = '#374151';
                    fallback.textContent = "David's Salon";
                    logoDiv.appendChild(fallback);
                  };
                  logoDiv.appendChild(logoImg);
                  stickerDiv.appendChild(logoDiv);

                  // QR Code - Bigger
                  const qrContainer = document.createElement('div');
                  qrContainer.style.flexShrink = '0';
                  qrContainer.style.display = 'flex';
                  qrContainer.style.alignItems = 'center';
                  qrContainer.style.justifyContent = 'center';
                  qrContainer.style.width = '100%';
                  qrContainer.style.padding = '8px';
                  qrContainer.style.backgroundColor = '#f9fafb';
                  qrContainer.style.borderRadius = '4px';
                  qrContainer.style.border = '1px solid #d1d5db';

                  const qrSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                  qrSvg.setAttribute('width', '120');
                  qrSvg.setAttribute('height', '120');
                  qrSvg.setAttribute('viewBox', '0 0 120 120');
                  qrSvg.style.border = '1px solid #d1d5db';
                  qrSvg.style.borderRadius = '4px';
                  qrContainer.appendChild(qrSvg);

                  // Generate QR code
                  const QRCode = (await import('qrcode')).default;
                  await QRCode.toCanvas(qrSvg, qrCode.qrCodeString, {
                    width: 120,
                    margin: 0,
                    color: { dark: '#000000', light: '#FFFFFF' }
                  });
                  stickerDiv.appendChild(qrContainer);

                  // Batch Number
                  if (qrCode.batchNumber && qrCode.batchNumber !== 'N/A') {
                    const batchDiv = document.createElement('div');
                    batchDiv.style.display = 'flex';
                    batchDiv.style.alignItems = 'center';
                    batchDiv.style.justifyContent = 'center';
                    batchDiv.style.width = '100%';
                    batchDiv.style.gap = '0.06in';

                    const packageIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    packageIcon.setAttribute('viewBox', '0 0 24 24');
                    packageIcon.setAttribute('fill', 'none');
                    packageIcon.setAttribute('stroke', 'currentColor');
                    packageIcon.setAttribute('strokeWidth', '2');
                    packageIcon.setAttribute('strokeLinecap', 'round');
                    packageIcon.setAttribute('strokeLinejoin', 'round');
                    packageIcon.classList.add('lucide', 'lucide-package');
                    packageIcon.style.height = '14px';
                    packageIcon.style.width = '14px';
                    packageIcon.style.color = '#4b5563';
                    packageIcon.style.flexShrink = '0';
                    packageIcon.innerHTML = '<path d="m7.5 4.274 5.73 3.438c.14.084.27.17.4.252.34.204.67.41.99.612l3.73 2.238"/><path d="M17.5 10.274 12 13.5l-5.5-3.226"/><path d="m7.5 19.726 5.73-3.438c.14-.084.27-.17.4-.252.34-.204.67-.41.99-.612l3.73-2.238"/><path d="M17.5 13.726 12 10.5l-5.5 3.226"/><path d="M12 22v-8.5"/><path d="M12 2v8.5"/><path d="M2 13.5h20"/>';
                    batchDiv.appendChild(packageIcon);

                    const batchP = document.createElement('p');
                    batchP.style.fontSize = '11px';
                    batchP.style.color = '#374151';
                    batchP.style.fontWeight = '500';
                    batchP.style.margin = '0';
                    batchP.textContent = `Batch: ${qrCode.batchNumber}`;
                    batchDiv.appendChild(batchP);

                    stickerDiv.appendChild(batchDiv);
                  }

                  // Expiration Date
                  if (qrCode.expirationDate) {
                    const expDiv = document.createElement('div');
                    expDiv.style.display = 'flex';
                    expDiv.style.alignItems = 'center';
                    expDiv.style.justifyContent = 'center';
                    expDiv.style.width = '100%';
                    expDiv.style.gap = '0.06in';
                    expDiv.style.backgroundColor = '#fef2f2';
                    expDiv.style.padding = '4px 8px';
                    expDiv.style.borderRadius = '4px';

                    const calendarIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    calendarIcon.setAttribute('viewBox', '0 0 24 24');
                    calendarIcon.setAttribute('fill', 'none');
                    calendarIcon.setAttribute('stroke', 'currentColor');
                    calendarIcon.setAttribute('strokeWidth', '2');
                    calendarIcon.setAttribute('strokeLinecap', 'round');
                    calendarIcon.setAttribute('strokeLinejoin', 'round');
                    calendarIcon.classList.add('lucide', 'lucide-calendar');
                    calendarIcon.style.height = '14px';
                    calendarIcon.style.width = '14px';
                    calendarIcon.style.color = '#dc2626';
                    calendarIcon.style.flexShrink = '0';
                    calendarIcon.innerHTML = '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>';
                    expDiv.appendChild(calendarIcon);

                    const expP = document.createElement('p');
                    expP.style.fontSize = '11px';
                    expP.style.color = '#b91c1c';
                    expP.style.fontWeight = 'semibold';
                    expP.style.margin = '0';
                    expP.textContent = `Exp: ${format(new Date(qrCode.expirationDate), 'MMM dd, yyyy')}`;
                    expDiv.appendChild(expP);

                    stickerDiv.appendChild(expDiv);
                  } else {
                    const noExpP = document.createElement('p');
                    noExpP.style.fontSize = '11px';
                    noExpP.style.color = '#9ca3af';
                    noExpP.style.fontStyle = 'italic';
                    noExpP.style.margin = '0';
                    noExpP.textContent = 'No expiration date';
                    stickerDiv.appendChild(noExpP);
                  }

                  // OTC Price
                  const priceDiv = document.createElement('div');
                  priceDiv.style.display = 'flex';
                  priceDiv.style.alignItems = 'center';
                  priceDiv.style.justifyContent = 'center';
                  priceDiv.style.width = '100%';

                  const priceP = document.createElement('p');
                  priceP.style.fontSize = '14px';
                  priceP.style.fontWeight = 'bold';
                  priceP.style.color = '#2563eb';
                  priceP.style.margin = '0';
                  priceP.textContent = `₱${qrCode.price?.toFixed(2) || '0.00'}`;
                  priceDiv.appendChild(priceP);

                  stickerDiv.appendChild(priceDiv);

                  // Add to temp container and capture
                  tempContainer.appendChild(stickerDiv);

                  const canvas = await html2canvas(stickerDiv, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    allowTaint: true
                  });

                  const imgData = canvas.toDataURL('image/png');

                  const positionOnPage = i % perPage;
                  const col = positionOnPage % 2;
                  const row = Math.floor(positionOnPage / 2);
                  const x = col * stickerWidth;
                  const y = row * stickerHeight;

                  doc.addImage(imgData, 'PNG', x, y, stickerWidth, stickerHeight);

                  if ((i + 1) % perPage === 0 && i + 1 < allQRCodes.length) {
                    doc.addPage();
                  }

                  // Clean up
                  tempContainer.removeChild(stickerDiv);
                }

                document.body.removeChild(tempContainer);

                const productCount = new Set(allQRCodes.map(q => q.productId)).size;
                const batchCount = new Set(allQRCodes.map(q => q.batchId)).size;
                doc.save(`mass_print_all_products_${productCount}_products_${batchCount}_batches_${Date.now()}.pdf`);

                setLoading(false);
              } catch (error) {
                console.error('Error in mass print:', error);
                setError('Failed to generate mass print PDF: ' + error.message);
                setLoading(false);
              }
              }}
              className="flex items-center gap-2"
              title="Print all QR codes"
              disabled={loading}
            >
              <Printer className="w-5 h-5" />
            </Button>
        </div>

        {/* Products Table */}
        {filteredProducts.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[35%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="w-[15%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Brand
                    </th>
                    <th className="w-[15%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Category
                    </th>
                    <th className="w-[12%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="w-[10%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Status
                    </th>
                    <th className="w-[13%] px-2 md:px-3 py-2 md:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 md:px-3 py-2 md:py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-shrink-0 h-8 w-8 md:h-10 md:w-10">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-8 w-8 md:h-10 md:w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 md:h-10 md:w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs md:text-sm font-medium text-gray-900 truncate">{product.name}</div>
                            {product.upc && (
                              <div className="text-xs text-gray-500 font-mono truncate">{product.upc}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 md:px-3 py-2 md:py-3 hidden md:table-cell">
                        <div className="text-xs md:text-sm text-gray-900 truncate">{product.brand || '-'}</div>
                      </td>
                      <td className="px-2 md:px-3 py-2 md:py-3 hidden lg:table-cell">
                        <div className="text-xs md:text-sm text-gray-900 truncate">{product.category || '-'}</div>
                      </td>
                      <td className="px-2 md:px-3 py-2 md:py-3">
                        <div className="text-xs md:text-sm font-medium text-gray-900">
                          ₱{product.otcPrice?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-2 md:px-3 py-2 md:py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                          {getStatusIcon(product.status)}
                          <span className="hidden lg:inline">{product.status}</span>
                        </span>
                      </td>
                      <td className="px-2 md:px-3 py-2 md:py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetails(product)}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleGenerateQRCode(product)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                            title="Generate QR code"
                            disabled={loading}
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleBatchPrint(product)}
                            className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-100 rounded transition-colors disabled:opacity-50"
                            title="Batch print all batches"
                            disabled={loading}
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 md:p-4 border-t bg-gray-50">
                <div className="text-xs md:text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts}
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="text-xs md:text-sm px-2 md:px-3">
                    Prev
                  </Button>
                  <div className="text-xs md:text-sm text-gray-700">Page {currentPage} / {totalPages}</div>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="text-xs md:text-sm px-2 md:px-3">
                    Next
                  </Button>
                </div>
              </div>
            </div>
        ) : (
          <div className="p-6 md:p-8 lg:p-12 text-center">
            <QrCode className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mx-auto mb-3 md:mb-4" />
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
            <p className="text-xs md:text-sm text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all')
                ? 'Try adjusting your search or filters'
                : 'No products available for QR code generation'
              }
            </p>
          </div>
        )}

        {/* Current Batches/Products Display */}
        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">Current Batches/Products</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCurrentBatches}
              disabled={loadingBatches}
              className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3"
            >
              <RefreshCw className={`h-3.5 w-3.5 md:h-4 md:w-4 ${loadingBatches ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          
          {loadingBatches ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading batches...</span>
            </div>
          ) : currentBatches.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No active batches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-w-full">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[30%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="w-[20%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Batch Number</th>
                    <th className="w-[15%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Quantity</th>
                    <th className="w-[20%] px-2 md:px-3 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                    <th className="w-[15%] px-2 md:px-3 py-2 md:py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentBatches.map((batch) => {
                    const product = products.find(p => p.id === batch.productId);
                    const isExpired = batch.expirationDate && new Date(batch.expirationDate) < new Date();
                    const isExpiringSoon = batch.expirationDate && 
                      new Date(batch.expirationDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                      new Date(batch.expirationDate) > new Date();
                    
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-2 md:px-3 py-2 md:py-3">
                          <div className="text-xs md:text-sm font-medium text-gray-900 truncate">{batch.productName}</div>
                          {product && (
                            <div className="text-xs text-gray-500 truncate">{product.brand || ''}</div>
                          )}
                        </td>
                        <td className="px-2 md:px-3 py-2 md:py-3 hidden md:table-cell">
                          <span className="text-xs md:text-sm text-gray-900 font-mono truncate block">{batch.batchNumber}</span>
                        </td>
                        <td className="px-2 md:px-3 py-2 md:py-3 hidden lg:table-cell">
                          <span className="text-xs md:text-sm text-gray-900">{batch.remainingQuantity}</span>
                        </td>
                        <td className="px-2 md:px-3 py-2 md:py-3">
                          {batch.expirationDate ? (
                            <span className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : isExpiringSoon ? 'text-orange-600 font-semibold' : 'text-gray-900'}`}>
                              {format(new Date(batch.expirationDate), 'MMM dd, yy')}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </td>
                        <td className="px-2 md:px-3 py-2 md:py-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (product) {
                                handleGenerateQRCode(product);
                                // Auto-select this batch
                                setTimeout(() => {
                                  setGenerateForm(prev => ({ ...prev, batchId: batch.id }));
                                }, 100);
                              }
                            }}
                            className="p-1.5 md:p-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <QrCode className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Product Details Modal */}
        {isDetailsModalOpen && selectedProduct && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedProduct(null);
            }}
            title="Product Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Product Header */}
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="h-16 w-16 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedProduct.name}</h2>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedProduct.status)}`}>
                      {getStatusIcon(selectedProduct.status)}
                      {selectedProduct.status}
                    </span>
                  </div>
                  <p className="text-lg text-gray-600 mb-2">{selectedProduct.brand}</p>
                  <p className="text-sm text-gray-500">{selectedProduct.category}</p>
                </div>
              </div>

              {/* Product Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Product ID</label>
                  <p className="text-gray-900">{selectedProduct.id}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Brand</label>
                  <p className="text-gray-900">{selectedProduct.brand}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-gray-900">{selectedProduct.category}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-gray-900">{selectedProduct.status}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Price</label>
                  <p className="text-gray-900">₱{selectedProduct.otcPrice?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Generate QR Code Modal */}
        {isGenerateModalOpen && selectedProduct && (
          <Modal
            isOpen={isGenerateModalOpen}
            onClose={() => {
              setIsGenerateModalOpen(false);
              setSelectedProduct(null);
              setSelectedBatches([]);
            }}
            title="Generate QR Code Sticker"
            size="md"
          >
            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedProduct.name}</p>
              </div>
              

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch * 
                  {selectedBatches.length > 1 && (
                    <span className="ml-2 text-xs text-blue-600 font-normal">
                      ({selectedBatches.length} batches available - select one)
                    </span>
                  )}
                </label>
                {selectedBatches.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    No batches available for this product in the selected branch
                  </div>
                ) : selectedBatches.length === 1 ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900">
                        {selectedBatches[0].batchNumber}
                        {selectedBatches[0].expirationDate && (
                          <span className="text-gray-600 ml-2">
                            - Exp: {format(new Date(selectedBatches[0].expirationDate), 'MMM dd, yyyy')}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-gray-600">
                        Qty: {selectedBatches[0].remainingQuantity || 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <select
                    value={generateForm.batchId}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, batchId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a batch to print sticker for...</option>
                    {selectedBatches.map(batch => {
                      const isActive = batch.status === 'active' && (batch.remainingQuantity || 0) > 0;
                      const expirationDate = batch.expirationDate ? new Date(batch.expirationDate) : null;
                      const isExpired = expirationDate && expirationDate < new Date();
                      
                      return (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchNumber} 
                          {expirationDate && ` - Exp: ${format(expirationDate, 'MMM dd, yyyy')}`}
                          {` - Qty: ${batch.remainingQuantity || 0}`}
                          {!isActive && ' (Inactive)'}
                          {isExpired && ' (Expired)'}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedBatches.length > 1 && generateForm.batchId && (
                  <p className="mt-1 text-xs text-gray-500">
                    Selected batch: {selectedBatches.find(b => b.id === generateForm.batchId)?.batchNumber}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={generateForm.quantity}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
                  <select
                    value={generateForm.size}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, size: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    setSelectedProduct(null);
                    setSelectedBatches([]);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Generating...' : 'Generate QR Code'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Print QR Code Stickers Modal */}
        {isPrintModalOpen && qrCodesToPrint.length > 0 && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
                onClick={() => {
                  setIsPrintModalOpen(false);
                  setQrCodesToPrint([]);
                }}
              />
              
              {/* Modal */}
              <div className="relative w-full max-w-2xl max-h-[90vh] transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all flex flex-col">
                {/* Enhanced Header */}
                <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-4 py-3 text-white flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white/20 rounded-lg">
                        <QrCode className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">QR Code Stickers</h3>
                        <p className="text-xs text-blue-100 mt-0.5">
                          {qrCodesToPrint.length} sticker{qrCodesToPrint.length > 1 ? 's' : ''} ready to print
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsPrintModalOpen(false);
                        setQrCodesToPrint([]);
                      }}
                      className="p-1 text-white border border-white/30 hover:bg-white/20 rounded transition-colors"
                      title="Close"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col overflow-hidden min-h-0">
                  {/* Action Bar */}
                  <div className="mb-6 bg-gray-50 rounded-lg p-3 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-gray-600" />
                        <span className="text-xs text-gray-700">
                          <span className="font-semibold">{qrCodesToPrint.length}</span> sticker{qrCodesToPrint.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {qrCodesToPrint[0]?.productName && (
                        <>
                          <div className="h-3 w-px bg-gray-300" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-600">Product:</span>
                            <span className="text-xs font-semibold text-gray-900">{qrCodesToPrint[0].productName}</span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Buttons in 1 row, 5 columns */}
                    <div className="grid grid-cols-5 gap-2">
                      <button
                        onClick={handlePrint}
                        className="flex flex-col items-center justify-center gap-1 p-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Print Stickers"
                        disabled={qrCodesToPrint.length === 0}
                      >
                        <Printer className="h-3 w-3" />
                        <span>Print</span>
                      </button>
                      
                      <button
                        onClick={() => qrCodesToPrint.length > 0 && handleSaveAsPNG(qrCodesToPrint[0], 0)}
                        className="flex flex-col items-center justify-center gap-1 p-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-[10px] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save as PNG"
                        disabled={qrCodesToPrint.length === 0}
                      >
                        <Download className="h-3 w-3" />
                        <span>PNG</span>
                      </button>
                      
                      {qrCodesToPrint.length > 1 && (
                        <button
                          onClick={async () => {
                            for (let i = 0; i < qrCodesToPrint.length; i++) {
                              await handleSaveAsPNG(qrCodesToPrint[i], i);
                              await new Promise(resolve => setTimeout(resolve, 500));
                            }
                          }}
                          className="flex flex-col items-center justify-center gap-1 p-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-[10px] rounded transition-colors"
                          title="Save All as PNG"
                        >
                          <Download className="h-3 w-3" />
                          <span>All PNG</span>
                        </button>
                      )}

                      <button
                        onClick={() => qrCodesToPrint.length > 0 && handleSaveAsPDF && handleSaveAsPDF()}
                        className="flex flex-col items-center justify-center gap-1 p-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-[10px] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save as PDF"
                        disabled={qrCodesToPrint.length === 0 || !handleSaveAsPDF}
                      >
                        <FileText className="h-3 w-3" />
                        <span>PDF</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setIsPrintModalOpen(false);
                          setQrCodesToPrint([]);
                        }}
                        className="flex flex-col items-center justify-center gap-1 p-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-[10px] rounded transition-colors"
                        title="Close"
                      >
                        <XCircle className="h-3 w-3" />
                        <span>Close</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview Info */}
                  <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0">
                    <p className="text-xs text-blue-800 flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3" />
                      Preview your stickers below. Click print when ready.
                    </p>
                  </div>

                  {/* Printable QR Code Stickers - Centered */}
                  <div ref={printRef} className="print-content flex-1 overflow-y-auto min-h-0">
                    {/* Grid layout optimized for cutting - centered */}
                    <div className="flex justify-center h-full items-start">
                      <div className={`grid gap-4 p-4 bg-gray-50 rounded-lg`}
                      style={{
                        gridTemplateColumns: 'repeat(auto-fill, minmax(3.2in, 1fr))',
                        justifyItems: 'center',
                        maxWidth: 'fit-content'
                      }}>
                      {qrCodesToPrint.map((qrCode, index) => (
                        <div
                          key={index}
                          id={`sticker-${index}`}
                          className="bg-white border-4 border-red-500 rounded-xl flex flex-col items-center justify-start shadow-xl"
                          style={{
                            width: '3in',
                            height: '3in',
                            minWidth: '3in',
                            minHeight: '3in',
                            maxWidth: '3in',
                            maxHeight: '3in',
                            boxSizing: 'border-box',
                            pageBreakInside: 'avoid',
                            position: 'relative',
                            padding: '0.3in',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: '0.15in',
                            background: '#ffffff',
                            border: '4px solid #ef4444',
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Cutting guide lines */}
                          <div className="absolute inset-0 pointer-events-none" style={{
                            border: '1px dashed #ccc',
                            borderRadius: '4px'
                          }}></div>

                          {/* Logo - Top */}
                          <div className="flex-shrink-0 flex items-center justify-center w-full mb-1">
                            <span className="text-xs font-bold text-gray-800">David's Salon Logo</span>
                          </div>

                          {/* QR Code - Bigger */}
                          <div className="flex-shrink-0 flex items-center justify-center w-full mb-2">
                            <div className="w-24 h-24 bg-gray-100 border-2 border-gray-300 rounded flex items-center justify-center">
                              <span className="text-xs text-gray-600">[QR CODE]</span>
                            </div>
                          </div>

                          {/* Batch Number */}
                          <div className="flex items-center justify-center w-full mb-1" style={{ gap: '4px' }}>
                            <Package className="h-3 w-3 text-gray-600 flex-shrink-0" />
                            <span className="text-xs text-gray-700 font-medium">Batch: {qrCode.batchNumber || 'PO-KYI-01-SUP-001'}</span>
                          </div>

                          {/* Expiration Date */}
                          <div className="flex items-center justify-center w-full mb-1" style={{ gap: '4px' }}>
                            <Calendar className="h-3 w-3 text-red-600 flex-shrink-0" />
                            <span className="text-xs text-red-700 font-semibold">
                              Exp: {qrCode.expirationDate ? format(new Date(qrCode.expirationDate), 'MMM dd, yyyy') : 'Jan 11, 2029'}
                            </span>
                          </div>

                          {/* OTC Price */}
                          <div className="flex items-center justify-center w-full">
                            <span className="text-sm font-bold text-blue-600">
                              ₱{qrCode.price?.toFixed(2) || '120.00'}
                            </span>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="mt-6 pt-4 border-t border-gray-200 flex-shrink-0">
                    <p className="text-xs text-gray-500 text-center">
                      Stickers are optimized for standard label printers (2x2 inches)
                    </p>
                  </div>
                </div>

                {/* Print Styles */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    .print-content, .print-content * {
                      visibility: visible;
                    }
                    .print-content {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      background: white;
                    }
                    .print-content .bg-gray-50 {
                      background: white !important;
                    }
                    @page {
                      margin: 0.5cm;
                      size: A4;
                    }
                    .print-content .grid {
                      gap: 0.3cm !important;
                    }
                    .print-content [id^="sticker-"] {
                      border: 2px dashed #999 !important;
                      margin: 0.1cm;
                    }
                  }
                `}</style>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Filters Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Advanced Filters"
            size="md"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                <select
                  value={filters.brand}
                  onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Brands</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Has Batches</label>
                <select
                  value={filters.hasBatches}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasBatches: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Products</option>
                  <option value="yes">Has Batches</option>
                  <option value="no">No Batches</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      category: 'all',
                      status: 'all',
                      hasQRCode: 'all',
                      brand: 'all',
                      hasBatches: 'all'
                    });
                  }}
                >
                  Reset
                </Button>
                <Button onClick={() => setIsFilterModalOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Report Modal */}
        {isReportModalOpen && (
          <Modal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            title="QR Code Generator Report"
            size="lg"
          >
            <div className="space-y-4">
              <div className="flex justify-end gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    const reportContent = `
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>QR Code Generator Report</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            h1 { color: #160B53; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
                            .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; }
                          </style>
                        </head>
                        <body>
                          <h1>QR Code Generator Report</h1>
                          <p>Generated: ${new Date().toLocaleString()}</p>
                          <div class="stats">
                            <div class="stat-card">
                              <h3>Total Products</h3>
                              <p>${stats.totalProducts}</p>
                            </div>
                            <div class="stat-card">
                              <h3>With QR Code</h3>
                              <p>${stats.productsWithQRCode}</p>
                            </div>
                            <div class="stat-card">
                              <h3>Total Generated</h3>
                              <p>${stats.totalGenerated}</p>
                            </div>
                            <div class="stat-card">
                              <h3>This Week</h3>
                              <p>${stats.recentGenerated}</p>
                            </div>
                          </div>
                          <h2>Current Batches (${currentBatches.length})</h2>
                          <table>
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Batch Number</th>
                                <th>Quantity</th>
                                <th>Expiration Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${currentBatches.map(batch => `
                                <tr>
                                  <td>${batch.productName}</td>
                                  <td>${batch.batchNumber}</td>
                                  <td>${batch.remainingQuantity}</td>
                                  <td>${batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'N/A'}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </body>
                      </html>
                    `;
                    printWindow.document.write(reportContent);
                    printWindow.document.close();
                    printWindow.print();
                  }}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Report
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Total Products</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">With QR Code</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.productsWithQRCode}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Total Generated</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalGenerated}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">This Week</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.recentGenerated}</div>
                </Card>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Batches ({currentBatches.length})</h3>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Product</th>
                        <th className="px-4 py-2 text-left">Batch</th>
                        <th className="px-4 py-2 text-left">Quantity</th>
                        <th className="px-4 py-2 text-left">Expiration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {currentBatches.map(batch => (
                        <tr key={batch.id}>
                          <td className="px-4 py-2">{batch.productName}</td>
                          <td className="px-4 py-2 font-mono">{batch.batchNumber}</td>
                          <td className="px-4 py-2">{batch.remainingQuantity}</td>
                          <td className="px-4 py-2">
                            {batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Mass Print Modal with Cutting Layout */}
        {isMassPrintModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setIsMassPrintModalOpen(false)} />
              
              <div className="relative w-full max-w-6xl transform overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-6 py-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">Mass Print - Cutting Layout</h3>
                      <p className="text-sm text-blue-100 mt-0.5">Select batches to print in grid layout</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setIsMassPrintModalOpen(false)}
                      className="text-white border-white/30 hover:bg-white/20"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Select Batches to Print</h4>
                    <div className="max-h-64 overflow-y-auto border rounded-lg p-2">
                      {currentBatches.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No batches available</p>
                      ) : (
                        <div className="space-y-2">
                          {currentBatches.map(batch => {
                            const product = products.find(p => p.id === batch.productId);
                            const isSelected = selectedBatchesForPrint.some(b => 
                              b.productId === batch.productId && b.batchNumber === batch.batchNumber
                            );
                            
                            return (
                              <label key={batch.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const qrCode = {
                                        id: `qr-${batch.id}-${Date.now()}`,
                                        qrCodeString: JSON.stringify({
                                          productId: batch.productId,
                                          productName: batch.productName,
                                          price: product?.otcPrice || 0,
                                          batchNumber: batch.batchNumber,
                                          batchId: batch.id,
                                          expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
                                          branchId: userBranch,
                                          timestamp: Date.now()
                                        }),
                                        batchNumber: batch.batchNumber,
                                        productName: batch.productName,
                                        productId: batch.productId,
                                        price: product?.otcPrice || 0,
                                        expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
                                        branchId: userBranch,
                                        createdAt: new Date()
                                      };
                                      setSelectedBatchesForPrint(prev => [...prev, qrCode]);
                                    } else {
                                      setSelectedBatchesForPrint(prev => prev.filter(b => 
                                        !(b.productId === batch.productId && b.batchNumber === batch.batchNumber)
                                      ));
                                    }
                                  }}
                                  className="rounded"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">{batch.productName}</div>
                                  <div className="text-xs text-gray-500">Batch: {batch.batchNumber} | Qty: {batch.remainingQuantity}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedBatchesForPrint.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-700">
                          {selectedBatchesForPrint.length} batch(es) selected
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setSelectedBatchesForPrint([])}
                          >
                            Clear All
                          </Button>
                          <Button
                            onClick={() => {
                              setQrCodesToPrint(selectedBatchesForPrint);
                              setIsMassPrintModalOpen(false);
                              setIsPrintModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                          >
                            <Printer className="h-4 w-4" />
                            Print Selected ({selectedBatchesForPrint.length})
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default UpcGenerator;
