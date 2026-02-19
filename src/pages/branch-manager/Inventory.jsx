// src/pages/04_BranchManager/Inventory.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatCurrency } from '../../utils/helpers';
import { inventoryService } from '../../services/inventoryService';
import { transactionApiService } from '../../services/transactionApiService';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  Package,
  Search,
  Eye,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Banknote,
  BarChart3,
  CheckCircle,
  RefreshCw,
  Download,
  X,
  ShoppingCart,
  Plus,
  Clock,
  Building,
  FileText,
  ArrowRight,
  ArrowUpDown,
  Minus,
  Trash2,
  Loader2,
  XCircle,
  Truck,
  Activity,
  Zap,
  Target,
  PieChart,
  LineChart,
  TrendingUp as TrendingUpIcon,
  AlertCircle,
  Info,
  Filter,
  Calendar,
  Printer,
  ChevronUp,
  ChevronDown,
  Upload,
  DollarSign,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { openaiService } from '../../services/openaiService';
import { getAllServices } from '../../services/serviceManagementService';
import { Sparkles, Loader2 as Loader2Icon, Scissors } from 'lucide-react';

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

const Inventory = () => {
  // State declarations
  const [activeTab, setActiveTab] = useState('products');
  const [selectedStatusPO, setSelectedStatusPO] = useState('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [products, setProducts] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [productStatus, setProductStatus] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [stockAlerts, setStockAlerts] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [minUnitCost, setMinUnitCost] = useState('');
  const [maxUnitCost, setMaxUnitCost] = useState('');
  const [minOtcPrice, setMinOtcPrice] = useState('');
  const [maxOtcPrice, setMaxOtcPrice] = useState('');
  const [minTotalValue, setMinTotalValue] = useState('');
  const [maxTotalValue, setMaxTotalValue] = useState('');
  const [hasServiceMapping, setHasServiceMapping] = useState('all');
  const [stocks, setStocks] = useState([]);

  const [services, setServices] = useState([]);
  
  // Missing state declarations
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTermPO, setSearchTermPO] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Reports states
  const [productTransactions, setProductTransactions] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [errorReports, setErrorReports] = useState(null);
  
  // Purchase Orders states
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [errorPO, setErrorPO] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConfirmApproveModalOpen, setIsConfirmApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isConfirmRejectModalOpen, setIsConfirmRejectModalOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Purchase Orders enhanced filters and sorting
  const [sortColumnPO, setSortColumnPO] = useState('createdAt');
  const [sortDirectionPO, setSortDirectionPO] = useState('desc');
  const [poDateFrom, setPoDateFrom] = useState('');
  const [poDateTo, setPoDateTo] = useState('');
  const [poMinAmount, setPoMinAmount] = useState('');
  const [poMaxAmount, setPoMaxAmount] = useState('');
  const [poCreatedBy, setPoCreatedBy] = useState('all');
  
  // Purchase Order form states
  const [orderItems, setOrderItems] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [showProductSelection, setShowProductSelection] = useState(false);
  const [branchProductsForPO, setBranchProductsForPO] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [productsPerPage, setProductsPerPage] = useState(10);
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [orderFormData, setOrderFormData] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: ''
  });
  
  // Analytics states
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [lowSellingProducts, setLowSellingProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [highStockProducts, setHighStockProducts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [selectedAnalyticsTab, setSelectedAnalyticsTab] = useState('topSelling'); // 'topSelling' | 'lowSelling' | 'lowStock' | 'highStock' | 'anomalies'
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30');

  // Stock Transfer states
  const [stockTransfers, setStockTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [errorTransfers, setErrorTransfers] = useState(null);
  const [searchTermTransfer, setSearchTermTransfer] = useState('');
  const [showCreateTransferModal, setShowCreateTransferModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [showTransferDetailsModal, setShowTransferDetailsModal] = useState(false);
  
  // Debounced search
  const debouncedProductSearch = useDebounce(productSearchTerm, 300);

  const { userData } = useAuth();

  // Load services for service-product mapping
  const loadServices = async () => {
    try {
      const servicesList = await getAllServices();
      setServices(servicesList);
    } catch (err) {
      console.error('Error loading services:', err);
    }
  };

  // Handle filter modal
  const handleFilter = () => {
    setShowFilterModal(true);
  };

  // Handle import
  const handleImportData = () => {
    setShowImportModal(true);
  };

  // Load products and stocks
  const loadProducts = async () => {
    if (!userData?.branchId) {
      setError('Branch ID not found');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Loading stocks for branchId:', userData.branchId);

      // Load stocks directly from 'stocks' collection (FIFO batch tracking)
      // Query without status filter first to see all stocks
      const stocksRef = collection(db, 'stocks');
      const stocksQuery = query(
        stocksRef,
        where('branchId', '==', userData.branchId)
      );
      const stocksSnapshot = await getDocs(stocksQuery);

      console.log('📦 Stocks found:', stocksSnapshot.size);

      // Debug: Log all stock entries for Olaplex
      const olaplexStocks = [];
      stocksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.productId === '4hg4CuvLSoLq0FlkMsHC') {
          olaplexStocks.push({
            docId: doc.id,
            productId: data.productId,
            usageType: data.usageType,
            remainingQuantity: data.remainingQuantity,
            realTimeStock: data.realTimeStock,
            currentStock: data.currentStock,
            status: data.status
          });
        }
      });
      console.log('🔍 ALL Olaplex stock entries:', olaplexStocks);

      // Process stocks to aggregate by product (separate OTC and Salon Use)
      const stockMap = new Map();

      // Process each stock entry (batch)
      stocksSnapshot.forEach((doc) => {
        const stockData = doc.data();
        
        // Only count active stocks (or stocks without status field)
        if (stockData.status && stockData.status !== 'active') {
          return;
        }
        
        // Use remainingQuantity or realTimeStock (not currentStock)
        const currentStock = stockData.remainingQuantity || stockData.realTimeStock || stockData.currentStock || 0;
          
        // Sum currentStock from all batches for this product
        const productId = stockData.productId;
        if (!productId) return;
        
        // Check both usageType and usage_type (database might use either)
        const usageType = stockData.usageType || stockData.usage_type || 'otc'; // default to otc if not specified
        
        // Debug logging for usageType
        if (productId === '4hg4CuvLSoLq0FlkMsHC') { // Olaplex product ID from your example
          console.log('📊 Stock entry for Olaplex:', {
            productId,
            usageType,
            usage_type: stockData.usage_type,
            usageTypeField: stockData.usageType,
            currentStock,
            remainingQuantity: stockData.remainingQuantity,
            realTimeStock: stockData.realTimeStock
          });
        }
        
        const current = stockMap.get(productId) || { 
          otcStock: 0, 
          salonStock: 0,
          totalStock: 0 
        };
        
        // Track stocks separately by usage type
        if (usageType === 'otc') {
          current.otcStock = (current.otcStock || 0) + currentStock;
        } else if (usageType === 'salon-use' || usageType === 'salon_use' || usageType === 'salonUse' || usageType === 'salon') {
          current.salonStock = (current.salonStock || 0) + currentStock;
        } else {
          // Log unknown usageType
          console.warn('⚠️ Unknown usageType:', usageType, 'for product:', productId);
        }
        current.totalStock = (current.otcStock || 0) + (current.salonStock || 0);
          
        // Use the most recent minStock, maxStock, unitCost if available
        if (stockData.minStock) current.minStock = stockData.minStock;
        if (stockData.maxStock) current.maxStock = stockData.maxStock;
        if (stockData.unitCost) current.unitCost = stockData.unitCost;
        if (stockData.lastUpdated) current.lastUpdated = stockData.lastUpdated;
        if (stockData.location) current.location = stockData.location;
        if (stockData.expiryDate) current.expiryDate = stockData.expiryDate;
        
        stockMap.set(productId, current);
      });
      
      // Convert to array for backward compatibility
      const aggregatedStocks = Array.from(stockMap.entries()).map(([productId, data]) => ({
        productId,
        ...data
      }));
      setStocks(aggregatedStocks);

      // Load products from database
      const productsRef = collection(db, 'products');
      const productsSnapshot = await getDocs(productsRef);

      const productsList = [];
      productsSnapshot.forEach((doc) => {
        const productData = doc.data();
        // Check if product is available to this branch
        const isAvailableToBranch = productData.branches && 
          productData.branches.includes(userData.branchId);
        if (isAvailableToBranch) {
          productsList.push({
            id: doc.id,
            ...productData
          });
        }
      });

      // Merge products with aggregated stock data
      const mergedProducts = productsList.map(product => {
        const stock = stockMap.get(product.id);
        const otcStock = Number(stock?.otcStock) || 0;
        const salonStock = Number(stock?.salonStock) || 0;
        const totalStock = otcStock + salonStock;
        const minStockVal = Number(stock?.minStock) || 0;
      
      // Calculate status based on stock levels
      let status = 'No Stock Data';
      if (stock && (otcStock > 0 || salonStock > 0)) {
          if (totalStock > minStockVal) {
          status = 'In Stock';
        } else if (totalStock > 0) {
          status = 'Low Stock';
        } else {
          status = 'Out of Stock';
        }
      }
      
        return {
        ...product,
        currentStock: totalStock,
        otcStock: otcStock,
        salonStock: salonStock,
          minStock: minStockVal,
        maxStock: stock?.maxStock || 0,
        unitCost: stock?.unitCost || product.unitCost || 0,
          status: String(status),
        lastUpdated: stock?.lastUpdated || null,
        location: stock?.location || null,
        expiryDate: stock?.expiryDate || null
      };
    });

    setProducts(mergedProducts);
    } catch (err) {
    console.error('Error loading products:', err);
    setError(err.message || 'Failed to load products');
    } finally {
    setLoading(false);
    }
  };

  // Handle export to CSV
  const handleExportCSV = () => {
    if (!products.length) {
      toast.error('No products to export');
      return;
    }

    const csvHeaders = ['Product Name', 'Category', 'Brand', 'UPC', 'Stock', 'Unit Cost (₱)', 'OTC Price (₱)', 'Salon Price (₱)', 'Status'];
    const csvRows = products.map(product => [
      product.name,
      product.category,
      product.brand,
      product.sku,
      product.currentStock,
      product.unitCost.toFixed(2),
      product.otcPrice.toFixed(2),
      product.salonUsePrice.toFixed(2),
      product.status
    ]);

    const csvContent = [csvHeaders, ...csvRows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Inventory exported to CSV');
  };

  // Handle print
  const handlePrint = () => {
    // Determine what to print based on active tab
    if (activeTab === 'reports') {
      // Print Product Sales Report
      handlePrintProductSales();
    } else {
      // Print Inventory Report
      handlePrintInventory();
    }
  };

  // Handle print for Product Sales Report
  const handlePrintProductSales = () => {
    if (!productTransactions || productTransactions.length === 0) {
      toast.error('No product sales data to print');
      return;
    }

    // Build filters display
    const activeFilters = [];
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Transactions';

    // Calculate totals
    let totalAmount = 0;

    // Generate table rows
    const tableRows = productTransactions.map((transaction, index) => {
      const transactionDate = transaction.createdAt?.toDate 
        ? formatDate(transaction.createdAt.toDate(), 'MMM dd, yyyy HH:mm')
        : formatDate(transaction.createdAt, 'MMM dd, yyyy HH:mm');
      
      const products = transaction.items
        ?.filter(item => item.type === 'product')
        .map(item => `${item.name} (${item.quantity})`)
        .join(', ') || 'N/A';
      
      const amount = transaction.total || 0;
      totalAmount += amount;
      
      return `
        <tr>
          <td style="text-align: center; font-weight: 600;">${index + 1}</td>
          <td>${transaction.receiptNumber || 'N/A'}</td>
          <td>${transactionDate}</td>
          <td>${transaction.clientName || 'Walk-in'}</td>
          <td>${products}</td>
          <td>${transaction.paymentMethod || 'N/A'}</td>
          <td style="text-align: right;">₱${formatCurrency(amount).replace('₱', '')}</td>
          <td style="text-align: center;">${transaction.status || 'N/A'}</td>
        </tr>
      `;
    }).join('');

    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product Sales Report - ${new Date().toLocaleDateString()}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 0.4in 0.4in 0.75in 0.4in;
              }
              body {
                margin: 0;
                padding: 0;
              }
              header, footer {
                display: none;
              }
            }
            * {
              font-family: 'Poppins', sans-serif;
              box-sizing: border-box;
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 0;
              color: #000;
              background: #fff;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 700;
              margin: 0 0 6px 0;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 6px 0;
            }
            .header p {
              font-size: 11px;
              margin: 0;
            }
            .filters {
              background: #f8f9fa;
              padding: 8px;
              border: 2px solid #333;
              margin: 8px 0 12px 0;
              text-align: center;
            }
            .filters-title {
              font-size: 9px;
              font-weight: 700;
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            .filters-content {
              font-size: 8px;
              font-weight: 600;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 9px;
              border: 1px solid #333;
            }
            th, td {
              padding: 6px 4px;
              text-align: left;
              border: 1px solid #333;
              vertical-align: middle;
            }
            th {
              background: #fff;
              font-weight: 700;
              font-size: 10px;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
            }
            tr {
              page-break-inside: avoid;
            }
            .grand-total {
              background: #f0f0f0;
              font-weight: 700;
              border-top: 2px solid #000;
            }
            .footer {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 2px solid #333;
              font-size: 10px;
            }
            .footer-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 12px;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
            .footer-center {
              text-align: center;
              color: #666;
              margin-top: 8px;
              font-size: 10px;
            }
            .footer-center p {
              margin: 2px 0;
            }
            .page-number {
              position: absolute;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 10px;
              font-weight: 600;
              height: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Product Sales Report</h2>
            <p><strong>Generated:</strong> ${formatDate(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>RECEIPT #</th>
                <th>DATE</th>
                <th>CLIENT</th>
                <th>PRODUCTS</th>
                <th>PAYMENT METHOD</th>
                <th style="text-align: right;">TOTAL AMOUNT</th>
                <th style="text-align: center;">STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr class="grand-total">
                <td colspan="6" style="text-align: left; padding: 8px 6px; font-size: 11px;">GRAND TOTAL:</td>
                <td style="text-align: right; padding: 8px 6px; font-size: 11px;">₱${formatCurrency(totalAmount).replace('₱', '')}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : currentUser?.displayName || 'Branch Manager'}<br/>
                <strong>Position:</strong> Branch Manager
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${formatDate(new Date(), 'MMMM dd, yyyy')}<br/>
                <strong>Time:</strong> ${formatDate(new Date(), 'HH:mm:ss')}
              </div>
            </div>
            <div class="footer-center">
              <p>Product Sales Report</p>
              <p>Total Transactions: ${productTransactions.length}</p>
            </div>
          </div>
          
          <div id="pageNumbers"></div>
          
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                // Calculate pages for A4 landscape
                const pageHeight = 794;
                const topMargin = 38;
                const bottomMargin = 72;
                const usableHeight = pageHeight - topMargin - bottomMargin;
                const contentHeight = document.body.scrollHeight;
                const totalPages = Math.max(1, Math.ceil(contentHeight / usableHeight));
                
                // Create page numbers for each page
                const pageNumbersContainer = document.getElementById('pageNumbers');
                for (let i = 1; i <= totalPages; i++) {
                  const pageNum = document.createElement('div');
                  pageNum.className = 'page-number';
                  pageNum.textContent = 'Page ' + i + ' of ' + totalPages;
                  pageNum.style.top = ((pageHeight * i) - bottomMargin - 70) + 'px';
                  pageNumbersContainer.appendChild(pageNum);
                }
                
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                }, 100);
              }, 250);
            });
          </script>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the report');
      return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Handle print for Inventory Report
  const handlePrintInventory = () => {
    if (!filteredProducts || filteredProducts.length === 0) {
      toast.error('No products to print');
      return;
    }

    // Build filters display
    const activeFilters = [];
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Products';

    // Calculate totals
    let totalOtcStock = 0;
    let totalSalonStock = 0;
    let totalUnitCost = 0;
    let totalOtcPrice = 0;

    // Generate table rows
    const tableRows = filteredProducts.map((product, index) => {
      const otcStock = product.otcStock ?? 0;
      const salonStock = product.salonStock ?? 0;
      const totalStock = otcStock + salonStock;
      const unitCost = product.unitCost || 0;
      const otcPrice = product.otcPrice || 0;
      
      // Add to totals
      totalOtcStock += otcStock;
      totalSalonStock += salonStock;
      totalUnitCost += unitCost;
      totalOtcPrice += otcPrice;
      
      let statusText = 'Unknown';
      if (totalStock === 0) statusText = 'Out of Stock';
      else if (totalStock <= (product.lowStockThreshold || 10)) statusText = 'Low Stock';
      else statusText = 'In Stock';
      
      const serviceMappings = product.serviceMappings || [];
      const mappedServices = serviceMappings
        .map(mapping => {
          const service = services.find(s => s.id === mapping.serviceId);
          return service ? service.name : null;
        })
        .filter(Boolean)
        .join(', ') || 'None';
      
      return `
        <tr>
          <td style="text-align: center; font-weight: 600;">${index + 1}</td>
          <td>${product.name || 'N/A'}</td>
          <td>${product.category || 'N/A'}</td>
          <td>${product.brand || 'N/A'}</td>
          <td style="text-align: center;">${otcStock}</td>
          <td style="text-align: center;">${salonStock}</td>
          <td style="text-align: center;">${statusText}</td>
          <td style="text-align: right;">₱${formatCurrency(unitCost).replace('₱', '')}</td>
          <td style="text-align: right;">₱${formatCurrency(otcPrice).replace('₱', '')}</td>
          <td>${mappedServices}</td>
        </tr>
      `;
    }).join('');

    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Inventory Report - ${new Date().toLocaleDateString()}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 0.4in 0.4in 0.75in 0.4in;
              }
              body {
                margin: 0;
                padding: 0;
              }
              header, footer {
                display: none;
              }
            }
            * {
              font-family: 'Poppins', sans-serif;
              box-sizing: border-box;
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 0;
              color: #000;
              background: #fff;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 700;
              margin: 0 0 6px 0;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 6px 0;
            }
            .header p {
              font-size: 11px;
              margin: 0;
            }
            .filters {
              background: #f8f9fa;
              padding: 8px;
              border: 2px solid #333;
              margin: 8px 0 12px 0;
              text-align: center;
            }
            .filters-title {
              font-size: 9px;
              font-weight: 700;
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            .filters-content {
              font-size: 8px;
              font-weight: 600;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 9px;
              border: 1px solid #333;
            }
            th, td {
              padding: 6px 4px;
              text-align: left;
              border: 1px solid #333;
              vertical-align: middle;
            }
            th {
              background: #fff;
              font-weight: 700;
              font-size: 10px;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
            }
            tr {
              page-break-inside: avoid;
            }
            .grand-total {
              background: #f0f0f0;
              font-weight: 700;
              border-top: 2px solid #000;
            }
            .footer {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 2px solid #333;
              font-size: 10px;
            }
            .footer-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 12px;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
            .footer-center {
              text-align: center;
              color: #666;
              margin-top: 8px;
              font-size: 10px;
            }
            .footer-center p {
              margin: 2px 0;
            }
            .page-number {
              position: absolute;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 10px;
              font-weight: 600;
              height: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Inventory Report</h2>
            <p><strong>Generated:</strong> ${formatDate(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>BRAND</th>
                <th style="text-align: center;">OTC STOCK</th>
                <th style="text-align: center;">SALON STOCK</th>
                <th style="text-align: center;">STATUS</th>
                <th style="text-align: right;">UNIT COST</th>
                <th style="text-align: right;">OTC PRICE</th>
                <th>SERVICE MAPPING</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr class="grand-total">
                <td colspan="4" style="text-align: left; padding: 8px 6px; font-size: 11px;">GRAND TOTAL:</td>
                <td style="text-align: center; padding: 8px 6px; font-size: 11px;">${totalOtcStock}</td>
                <td style="text-align: center; padding: 8px 6px; font-size: 11px;">${totalSalonStock}</td>
                <td></td>
                <td style="text-align: right; padding: 8px 6px; font-size: 11px;">₱${formatCurrency(totalUnitCost).replace('₱', '')}</td>
                <td style="text-align: right; padding: 8px 6px; font-size: 11px;">₱${formatCurrency(totalOtcPrice).replace('₱', '')}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : currentUser?.displayName || 'Branch Manager'}<br/>
                <strong>Position:</strong> Branch Manager
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${formatDate(new Date(), 'MMMM dd, yyyy')}<br/>
                <strong>Time:</strong> ${formatDate(new Date(), 'HH:mm:ss')}
              </div>
            </div>
            <div class="footer-center">
              <p>Inventory Report</p>
              <p>Total Products: ${filteredProducts.length}</p>
            </div>
          </div>
          
          <div id="pageNumbers"></div>
          
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                // Calculate pages for A4 landscape
                // A4 landscape: 297mm x 210mm = 1122px x 794px at 96 DPI
                // With margins: 0.4in top, 0.75in bottom = 38px top, 72px bottom
                // Usable height per page: 794 - 38 - 72 = 684px
                const pageHeight = 794;
                const topMargin = 38;
                const bottomMargin = 72;
                const usableHeight = pageHeight - topMargin - bottomMargin;
                const contentHeight = document.body.scrollHeight;
                const totalPages = Math.max(1, Math.ceil(contentHeight / usableHeight));
                
                // Create page numbers for each page
                const pageNumbersContainer = document.getElementById('pageNumbers');
                for (let i = 1; i <= totalPages; i++) {
                  const pageNum = document.createElement('div');
                  pageNum.className = 'page-number';
                  pageNum.textContent = 'Page ' + i + ' of ' + totalPages;
                  // Position - 70px above bottom margin
                  pageNum.style.top = ((pageHeight * i) - bottomMargin - 70) + 'px';
                  pageNumbersContainer.appendChild(pageNum);
                }
                
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                }, 100);
              }, 250);
            });
          </script>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the report');
      return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle sorting for Purchase Orders
  const handleSortPO = (column) => {
    if (sortColumnPO === column) {
      setSortDirectionPO(sortDirectionPO === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumnPO(column);
      setSortDirectionPO('desc'); // Default to desc for new column (most recent first)
    }
  };

  // SortIcon component
  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400 ml-1" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary-600 ml-1" />
      : <ChevronDown className="w-4 h-4 text-primary-600 ml-1" />;
  };

  // SortIcon component for Purchase Orders
  const SortIconPO = ({ column }) => {
    if (sortColumnPO !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400 ml-1" />;
    }
    return sortDirectionPO === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-[#160B53] ml-1" />
      : <ChevronDown className="w-4 h-4 text-[#160B53] ml-1" />;
  };

  // Handle filter modal for purchase orders
  const handleFilterPurchaseOrders = () => {
    setShowFilterModal(true);
  };

  useEffect(() => {
    loadServices();
  }, []);

  // Load purchase orders on mount for badge count
  useEffect(() => {
    if (userData?.branchId) {
      loadPurchaseOrders();
    }
  }, [userData?.branchId]);

  useEffect(() => {
    if (activeTab === 'products') {
    loadProducts();
    } else if (activeTab === 'purchaseOrders') {
    loadPurchaseOrdersData();
    } else if (activeTab === 'analytics' && products.length === 0) {
      // Load products first if analytics tab is opened and products aren't loaded
      loadProducts();
    }
  }, [userData?.branchId, activeTab]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = 
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesBrand = selectedBrand === 'all' || product.brand === selectedBrand;
      const matchesSupplier = selectedSupplier === 'all' || 
        (product.suppliers && product.suppliers.some(supplier => supplier.name === selectedSupplier));
        
      const matchesStatus = selectedStatus === 'all' || 
        (selectedStatus === 'In Stock' && product.currentStock > (product.minStock || 0)) ||
        (selectedStatus === 'Low Stock' && product.currentStock > 0 && product.currentStock <= (product.minStock || 0)) ||
        (selectedStatus === 'Out of Stock' && product.currentStock === 0) ||
        (selectedStatus === 'No Stock Data' && !product.currentStock && product.currentStock !== 0);
        
      // Stock level filters
      const stockLevel = product.currentStock || 0;
      const matchesMinStock = minStock === '' || stockLevel >= parseFloat(minStock);
      const matchesMaxStock = maxStock === '' || stockLevel <= parseFloat(maxStock);
      
      // Price filters
      const unitCost = product.unitCost || 0;
      const otcPrice = product.otcPrice || 0;
      const totalValue = stockLevel * unitCost;
      
      const matchesMinUnitCost = minUnitCost === '' || unitCost >= parseFloat(minUnitCost);
      const matchesMaxUnitCost = maxUnitCost === '' || unitCost <= parseFloat(maxUnitCost);
      const matchesMinOtcPrice = minOtcPrice === '' || otcPrice >= parseFloat(minOtcPrice);
      const matchesMaxOtcPrice = maxOtcPrice === '' || otcPrice <= parseFloat(maxOtcPrice);
      const matchesMinTotalValue = minTotalValue === '' || totalValue >= parseFloat(minTotalValue);
      const matchesMaxTotalValue = maxTotalValue === '' || totalValue <= parseFloat(maxTotalValue);
      
      // Service mapping filter
      const hasMapping = services.some(service => 
        service.productMappings && service.productMappings.some(mapping => mapping.productId === product.id)
      );
      const matchesServiceMapping = hasServiceMapping === 'all' || 
        (hasServiceMapping === 'yes' && hasMapping) || 
        (hasServiceMapping === 'no' && !hasMapping);
      
      // Stock alerts filter
      let matchesStockAlerts = true;
      if (stockAlerts !== 'all') {
        const minStock = product.minStock || 0;
        const maxStock = product.maxStock || 0;
        
        switch (stockAlerts) {
          case 'low_stock':
            matchesStockAlerts = stockLevel > 0 && stockLevel <= minStock;
            break;
          case 'overstock':
            matchesStockAlerts = maxStock > 0 && stockLevel > maxStock;
            break;
          case 'no_max_stock':
            matchesStockAlerts = !maxStock || maxStock === 0;
            break;
          default:
            matchesStockAlerts = true;
        }
      }
      
      // Expiry filter
      let matchesExpiry = true;
      if (expiryFilter !== 'all') {
        const expiryDate = product.expiryDate?.toDate ? product.expiryDate.toDate() : 
                          product.expiryDate ? new Date(product.expiryDate) : null;
        
        if (!expiryDate) {
          matchesExpiry = expiryFilter === 'no_expiry';
        } else {
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          
          switch (expiryFilter) {
            case 'has_expiry':
              matchesExpiry = true;
              break;
            case 'expiring_soon':
              matchesExpiry = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
              break;
            case 'expired':
              matchesExpiry = daysUntilExpiry <= 0;
              break;
            default:
              matchesExpiry = true;
          }
        }
      }
      
      // Product status filter
      const matchesProductStatus = productStatus === 'all' || 
        (productStatus === 'active' && (!product.status || product.status === 'Active')) ||
        (productStatus === 'inactive' && product.status === 'Inactive') ||
        (productStatus === 'discontinued' && product.status === 'Discontinued');
      
      return matchesSearch && matchesCategory && matchesBrand && matchesSupplier && 
             matchesStatus && matchesMinStock && matchesMaxStock && 
             matchesMinUnitCost && matchesMaxUnitCost && matchesMinOtcPrice && matchesMaxOtcPrice &&
             matchesMinTotalValue && matchesMaxTotalValue && matchesServiceMapping && 
             matchesStockAlerts && matchesExpiry && matchesProductStatus;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumn) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'category':
          aValue = a.category?.toLowerCase() || '';
          bValue = b.category?.toLowerCase() || '';
          break;
        case 'brand':
          aValue = a.brand?.toLowerCase() || '';
          bValue = b.brand?.toLowerCase() || '';
          break;
        case 'currentStock':
          aValue = a.currentStock || 0;
          bValue = b.currentStock || 0;
          break;
        case 'otcStock':
          aValue = a.otcStock || 0;
          bValue = b.otcStock || 0;
          break;
        case 'salonStock':
          aValue = a.salonStock || 0;
          bValue = b.salonStock || 0;
          break;
        case 'status':
          aValue = a.status?.toLowerCase() || '';
          bValue = b.status?.toLowerCase() || '';
          break;
        case 'unitCost':
          aValue = a.unitCost || 0;
          bValue = b.unitCost || 0;
          break;
        case 'otcPrice':
          aValue = a.otcPrice || 0;
          bValue = b.otcPrice || 0;
          break;
        case 'totalValue':
          aValue = (a.currentStock || 0) * (a.unitCost || 0);
          bValue = (b.currentStock || 0) * (b.unitCost || 0);
          break;
        default:
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [products, services, searchTerm, selectedCategory, selectedBrand, selectedSupplier, selectedStatus, 
      minStock, maxStock, minUnitCost, maxUnitCost, minOtcPrice, maxOtcPrice, 
      minTotalValue, maxTotalValue, hasServiceMapping, stockAlerts, expiryFilter, 
      productStatus, sortColumn, sortDirection]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, product) => 
    sum + ((product.currentStock || 0) * (product.unitCost || 0)), 0
    );
    const inStockCount = products.filter(p => (p.currentStock || 0) > (p.minStock || 0)).length;
    const lowStockCount = products.filter(p => {
    const stock = p.currentStock || 0;
    const minStock = p.minStock || 0;
    return stock > 0 && stock <= minStock;
    }).length;
    const outOfStockCount = products.filter(p => (p.currentStock || 0) === 0).length;
    
    return { totalProducts, totalValue, inStockCount, lowStockCount, outOfStockCount };
  }, [products]);

  // Get unique categories
  const categories = useMemo(() => {
    return ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  }, [products]);

  const getStatusColor = (status) => {
    switch (status) {
    case 'In Stock': return 'text-green-600 bg-green-100';
    case 'Low Stock': return 'text-yellow-600 bg-yellow-100';
    case 'Out of Stock': return 'text-red-600 bg-red-100';
    case 'No Stock Data': return 'text-gray-600 bg-gray-100';
    default: return 'text-gray-600 bg-gray-100';
    }
  };

  // ========== REPORTS FUNCTIONS ==========
  const loadReports = async () => {
    if (!userData?.branchId) {
    setErrorReports('Branch ID not found');
    setLoadingReports(false);
    return;
    }

    try {
    setLoadingReports(true);
    setErrorReports(null);

      console.log('🔍 Loading product transactions for branch:', userData.branchId);

      // Query Firestore directly for transactions with salesType: "product" and matching branchId
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('branchId', '==', userData.branchId),
        where('salesType', '==', 'product'),
        where('status', '==', 'paid')
      );
      
      const snapshot = await getDocs(q);
      console.log('📊 Transactions found in Firestore:', snapshot.size);

      const transactionsList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        transactionsList.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null),
          stockDeductedAt: data.stockDeductedAt?.toDate ? data.stockDeductedAt.toDate() : (data.stockDeductedAt ? new Date(data.stockDeductedAt) : null)
        });
      });

      console.log('🛍️ Product transactions loaded:', transactionsList.length);
      if (transactionsList.length > 0) {
        console.log('📋 Sample transaction:', transactionsList[0]);
        console.log('📋 Transaction details:', {
          receiptNumber: transactionsList[0].receiptNumber,
          clientName: transactionsList[0].clientName,
          total: transactionsList[0].total,
          items: transactionsList[0].items,
          salesType: transactionsList[0].salesType
        });
      }

      // Sort by date (newest first)
      transactionsList.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Store the filtered product transactions
      setProductTransactions(transactionsList);

    } catch (err) {
      console.error('❌ Error loading reports:', err);
    setErrorReports(err.message);
      setProductTransactions([]);
    } finally {
    setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
    loadReports();
    }
  }, [userData?.branchId, activeTab]);


  // ========== PURCHASE ORDERS FUNCTIONS ==========
  const loadPurchaseOrdersData = async () => {
    if (!userData?.branchId) {
    setErrorPO('Branch ID not found');
    setLoadingPO(false);
    return;
    }

    try {
    setLoadingPO(true);
    setErrorPO(null);
    await loadSuppliers();
    await loadBranchProductsForPO();
    await loadPurchaseOrders();
    } catch (err) {
    console.error('Error loading purchase orders data:', err);
    setErrorPO(err.message);
    } finally {
    setLoadingPO(false);
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

  const loadBranchProductsForPO = async () => {
    try {
    if (!userData?.branchId) return;

      // Get all products from products collection
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);

    const branchProductsList = [];
    productsSnapshot.forEach((doc) => {
      const productData = doc.data();
      const isAvailableToBranch = productData.branches && 
        productData.branches.includes(userData.branchId);
      if (isAvailableToBranch) {
        branchProductsList.push({
          id: doc.id,
          name: productData.name,
          category: productData.category,
          brand: productData.brand,
          unitCost: productData.unitCost || 0,
          supplier: productData.supplier, // Supplier ID
          imageUrl: productData.imageUrl,
          description: productData.description,
          sku: productData.sku,
          ...productData
        });
      }
    });

    setBranchProductsForPO(branchProductsList);
    } catch (err) {
    console.error('Error loading branch products:', err);
    throw err;
    }
  };

  const loadPurchaseOrders = async () => {
    try {
    if (!userData?.branchId) return;

    const purchaseOrdersRef = collection(db, 'purchaseOrders');
    const q = query(
      purchaseOrdersRef,
      where('branchId', '==', userData.branchId)
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

      // Sort by createdAt descending
    ordersList.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    setPurchaseOrders(ordersList);
    } catch (err) {
    console.error('Error loading purchase orders:', err);
    throw err;
    }
  };

  // When supplier is selected, filter products (suppliers is now an array)
  useEffect(() => {
    if (selectedSupplierId && branchProductsForPO.length > 0) {
    const filtered = branchProductsForPO.filter(product => {
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
  }, [selectedSupplierId, branchProductsForPO]);

  // Filter and paginate products for big data
  const filteredAndPaginatedProducts = useMemo(() => {
    if (!selectedSupplierId || supplierProducts.length === 0) return { products: [], total: 0, totalPages: 0, hasMore: false };
    
    let filtered = supplierProducts;
    if (debouncedProductSearch.trim()) {
    const searchLower = debouncedProductSearch.toLowerCase();
    filtered = supplierProducts.filter(product => 
      product.name?.toLowerCase().includes(searchLower) ||
      product.brand?.toLowerCase().includes(searchLower) ||
      product.category?.toLowerCase().includes(searchLower) ||
      product.sku?.toLowerCase().includes(searchLower)
    );
    }
    
    const startIndex = (currentProductPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return {
    products: filtered.slice(startIndex, endIndex),
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / productsPerPage),
    hasMore: endIndex < filtered.length
    };
  }, [supplierProducts, debouncedProductSearch, currentProductPage, selectedSupplierId]);

  // Handle supplier selection
  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
    setSelectedSupplierId(supplierId);
    setSelectedSupplierName(supplier.name);
    setShowProductSelection(true);
    setOrderItems([]);
    }
  };

  // Add product to order
  const addProductToOrder = (product) => {
    const existingItem = orderItems.find(item => item.productId === product.id);
    if (existingItem) {
    setOrderItems(prev => prev.map(item =>
      item.productId === product.id
        ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
        : item
    ));
    } else {
    setOrderItems(prev => [...prev, {
      productId: product.id || '',
      productName: product.name || '',
      quantity: 1,
      unitPrice: product.unitCost || 0,
      totalPrice: product.unitCost || 0,
      category: product.category || null,
      sku: product.sku || null
    }]);
    }
  };

  // Remove item from order
  const removeOrderItem = (productId) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Update item quantity
  const updateItemQuantity = (productId, quantity) => {
    const qty = parseInt(quantity) || 0;
    if (qty < 1) {
    removeOrderItem(productId);
    return;
    }
    setOrderItems(prev => prev.map(item =>
    item.productId === productId
      ? { 
          ...item, 
          quantity: qty, 
          totalPrice: qty * (item.unitPrice || 0),
          productId: item.productId || '',
          productName: item.productName || '',
          unitPrice: item.unitPrice || 0,
          category: item.category || null,
          sku: item.sku || null
        }
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
    setProductSearchTerm('');
    setCurrentProductPage(1);
    setOrderFormData({
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: ''
    });
    setIsCreateModalOpen(true);
  };

  // Helper function to remove undefined values
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
    if (e) e.preventDefault();
    
    if (!selectedSupplierId) {
    setErrorPO('Please select a supplier');
    return;
    }

    if (orderItems.length === 0) {
    setErrorPO('Please add at least one product to the order');
    return;
    }

    if (!orderFormData.orderDate) {
    setErrorPO('Please select an order date');
    return;
    }

    if (!orderFormData.expectedDelivery) {
    setErrorPO('Please select an expected delivery date');
    return;
    }

    try {
    setIsSubmitting(true);
    setErrorPO(null);

    if (!userData?.branchId) {
      throw new Error('Branch ID is missing. Please refresh the page.');
    }

    // Generate incremental order ID
    const orderId = generateNextPONumber();

    if (!userData?.uid && !userData?.id) {
      throw new Error('User ID is missing. Please refresh the page.');
    }

    const purchaseOrderData = {
      orderId: orderId || '',
      supplierId: selectedSupplierId || '',
      supplierName: selectedSupplierName || '',
      branchId: userData.branchId,
      orderDate: orderFormData.orderDate ? new Date(orderFormData.orderDate) : new Date(),
      expectedDelivery: orderFormData.expectedDelivery ? new Date(orderFormData.expectedDelivery) : null,
      status: 'Pending',
      totalAmount: Number(orderTotal) || 0,
      items: orderItems.map(item => {
        const validatedItem = {
          productId: String(item.productId || ''),
          productName: String(item.productName || ''),
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.totalPrice) || 0
        };
        if (item.category) validatedItem.category = String(item.category);
        if (item.sku) validatedItem.sku = String(item.sku);
        return validatedItem;
      }),
      notes: orderFormData.notes ? String(orderFormData.notes) : '',
      createdBy: userData.uid || userData.id,
      createdByName: (userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`.trim() 
        : (userData.email || 'Unknown')),
      createdByRole: userData.role || 'branchManager',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const cleanedData = removeUndefined(purchaseOrderData);
    const hasUndefined = JSON.stringify(cleanedData).includes('undefined');
    if (hasUndefined) {
      throw new Error('Invalid data: Some fields are undefined. Please check product information.');
    }

    await addDoc(collection(db, 'purchaseOrders'), cleanedData);
    await loadPurchaseOrders();
      
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
      notes: ''
    });
    setErrorPO(null);
    } catch (err) {
    console.error('Error creating purchase order:', err);
    let errorMessage = 'Failed to create purchase order.';
    if (err.message.includes('undefined')) {
      errorMessage = 'Error: Some required fields are missing. Please ensure all product information is complete.';
    } else if (err.message.includes('permission')) {
      errorMessage = 'Permission denied. Please check your access rights.';
    } else {
      errorMessage = err.message || 'Failed to create purchase order. Please try again.';
    }
    setErrorPO(errorMessage);
    } finally {
    setIsSubmitting(false);
    }
  };

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    let filtered = purchaseOrders.filter(order => {
      const matchesSearch = 
        order.orderId?.toLowerCase().includes(searchTermPO.toLowerCase()) ||
        order.supplierName?.toLowerCase().includes(searchTermPO.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTermPO.toLowerCase());

      const matchesStatus = selectedStatusPO === 'all' || order.status === selectedStatusPO;
      const matchesSupplier = selectedSupplierFilter === 'all' || order.supplierId === selectedSupplierFilter;
      
      // Date range filter
      let matchesDateRange = true;
      if (poDateFrom) {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        matchesDateRange = matchesDateRange && orderDate >= new Date(poDateFrom);
      }
      if (poDateTo) {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        const endDate = new Date(poDateTo);
        endDate.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && orderDate <= endDate;
      }
      
      // Amount range filter
      let matchesAmountRange = true;
      const orderAmount = order.totalAmount || 0;
      if (poMinAmount !== '' && poMinAmount !== null) {
        matchesAmountRange = matchesAmountRange && orderAmount >= parseFloat(poMinAmount);
      }
      if (poMaxAmount !== '' && poMaxAmount !== null) {
        matchesAmountRange = matchesAmountRange && orderAmount <= parseFloat(poMaxAmount);
      }
      
      // Created by filter
      const matchesCreatedBy = poCreatedBy === 'all' || order.createdBy === poCreatedBy;

      return matchesSearch && matchesStatus && matchesSupplier && matchesDateRange && matchesAmountRange && matchesCreatedBy;
    });
    
    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumnPO) {
        case 'orderId':
          aValue = a.orderId || a.id || '';
          bValue = b.orderId || b.id || '';
          break;
        case 'supplierName':
          aValue = a.supplierName || '';
          bValue = b.supplierName || '';
          break;
        case 'orderDate':
          aValue = a.orderDate ? new Date(a.orderDate) : new Date(0);
          bValue = b.orderDate ? new Date(b.orderDate) : new Date(0);
          break;
        case 'expectedDelivery':
          aValue = a.expectedDelivery ? new Date(a.expectedDelivery) : new Date(0);
          bValue = b.expectedDelivery ? new Date(b.expectedDelivery) : new Date(0);
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'totalAmount':
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        case 'createdAt':
        default:
          aValue = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          bValue = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          break;
      }
      
      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirectionPO === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Handle date/number comparison
      if (sortDirectionPO === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return filtered;
  }, [purchaseOrders, searchTermPO, selectedStatusPO, selectedSupplierFilter, poDateFrom, poDateTo, poMinAmount, poMaxAmount, poCreatedBy, sortColumnPO, sortDirectionPO]);

  // Purchase order statistics
  const orderStats = useMemo(() => {
    return {
      totalOrders: purchaseOrders.length,
      pendingOrders: purchaseOrders.filter(o => o.status === 'Pending').length,
      deliveredOrders: purchaseOrders.filter(o => o.status === 'Delivered').length,
      overdueOrders: purchaseOrders.filter(o => o.status === 'Overdue').length,
      totalValue: purchaseOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    };
  }, [purchaseOrders]);

  // Purchase order export functions
  const handleExportPurchaseOrdersCSV = () => {
    if (!filteredOrders.length) {
      toast.error('No purchase orders to export');
      return;
    }

    const csvHeaders = ['Order ID', 'Supplier', 'Order Date', 'Expected Delivery', 'Status', 'Total Amount', 'Created By'];
    const csvRows = filteredOrders.map(order => [
      order.orderId || order.id,
      order.supplierName || 'Unknown',
      order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A',
      order.expectedDelivery ? format(new Date(order.expectedDelivery), 'MMM dd, yyyy') : 'N/A',
      order.status,
      (order.totalAmount || 0).toFixed(2),
      order.createdByName || 'Unknown'
    ]);

    const csvContent = [csvHeaders, ...csvRows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Purchase orders exported to CSV');
  };

  const handlePrintPurchaseOrders = () => {
    if (!filteredOrders.length) {
      toast.error('No purchase orders to print');
      return;
    }

    // Build filters display
    const activeFilters = [];
    if (searchTermPO) activeFilters.push(`Search: "${searchTermPO}"`);
    if (selectedStatusPO !== 'all') activeFilters.push(`Status: ${selectedStatusPO}`);
    if (selectedSupplierFilter !== 'all') {
      const supplier = suppliers.find(s => s.id === selectedSupplierFilter);
      if (supplier) activeFilters.push(`Supplier: ${supplier.name}`);
    }
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Purchase Orders';

    // Calculate totals
    let totalAmount = 0;
    
    // Generate table rows
    const tableRows = filteredOrders.map((order, index) => {
      const amount = order.totalAmount || 0;
      totalAmount += amount;
      const orderDate = order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A';
      const expectedDelivery = order.expectedDelivery ? format(new Date(order.expectedDelivery), 'MMM dd, yyyy') : 'N/A';
      const itemCount = order.items?.length || 0;
      
      return `
        <tr>
          <td style="text-align: center; font-weight: 600;">${index + 1}</td>
          <td>${order.orderId || order.id}</td>
          <td>${orderDate}</td>
          <td>${order.supplierName || 'Unknown'}</td>
          <td style="text-align: center;">${itemCount}</td>
          <td>${expectedDelivery}</td>
          <td style="text-align: right;">₱${formatCurrency(amount).replace('₱', '')}</td>
          <td style="text-align: center;">${order.status || 'N/A'}</td>
          <td>${order.createdByName || 'Unknown'}</td>
        </tr>
      `;
    }).join('');

    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Orders Report - ${new Date().toLocaleDateString()}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 0.4in 0.4in 0.75in 0.4in;
              }
              body {
                margin: 0;
                padding: 0;
              }
              header, footer {
                display: none;
              }
            }
            * {
              font-family: 'Poppins', sans-serif;
              box-sizing: border-box;
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 0;
              color: #000;
              background: #fff;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            .header h1 {
              font-size: 24px;
              font-weight: 700;
              margin: 0 0 6px 0;
            }
            .header h2 {
              font-size: 18px;
              font-weight: 700;
              margin: 0 0 6px 0;
            }
            .header p {
              font-size: 11px;
              margin: 0;
            }
            .filters {
              background: #f8f9fa;
              padding: 8px;
              border: 2px solid #333;
              margin: 8px 0 12px 0;
              text-align: center;
            }
            .filters-title {
              font-size: 9px;
              font-weight: 700;
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            .filters-content {
              font-size: 8px;
              font-weight: 600;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 9px;
              border: 1px solid #333;
            }
            th, td {
              padding: 6px 4px;
              text-align: left;
              border: 1px solid #333;
              vertical-align: middle;
            }
            th {
              background: #fff;
              font-weight: 700;
              font-size: 10px;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
            }
            tr {
              page-break-inside: avoid;
            }
            .grand-total {
              background: #f0f0f0;
              font-weight: 700;
              border-top: 2px solid #000;
            }
            .footer {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 2px solid #333;
              font-size: 10px;
            }
            .footer-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 12px;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
            .footer-center {
              text-align: center;
              color: #666;
              margin-top: 8px;
              font-size: 10px;
            }
            .footer-center p {
              margin: 2px 0;
            }
            .page-number {
              position: absolute;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 10px;
              font-weight: 600;
              height: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Purchase Orders Report</h2>
            <p><strong>Generated:</strong> ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ORDER ID</th>
                <th>ORDER DATE</th>
                <th>SUPPLIER</th>
                <th style="text-align: center;">ITEMS</th>
                <th>EXPECTED DELIVERY</th>
                <th style="text-align: right;">TOTAL AMOUNT</th>
                <th style="text-align: center;">STATUS</th>
                <th>CREATED BY</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr class="grand-total">
                <td colspan="6" style="text-align: left; padding: 8px 6px; font-size: 11px;">GRAND TOTAL:</td>
                <td style="text-align: right; padding: 8px 6px; font-size: 11px;">₱${formatCurrency(totalAmount).replace('₱', '')}</td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Branch Manager'}<br/>
                <strong>Position:</strong> Branch Manager
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${format(new Date(), 'MMMM dd, yyyy')}<br/>
                <strong>Time:</strong> ${format(new Date(), 'HH:mm:ss')}
              </div>
            </div>
            <div class="footer-center">
              <p>Purchase Orders Report</p>
              <p>Total Orders: ${filteredOrders.length}</p>
            </div>
          </div>
          
          <div id="pageNumbers"></div>
          
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                // Calculate pages for A4 landscape
                const pageHeight = 794;
                const topMargin = 38;
                const bottomMargin = 72;
                const usableHeight = pageHeight - topMargin - bottomMargin;
                const contentHeight = document.body.scrollHeight;
                const totalPages = Math.max(1, Math.ceil(contentHeight / usableHeight));
                
                // Create page numbers for each page
                const pageNumbersContainer = document.getElementById('pageNumbers');
                for (let i = 1; i <= totalPages; i++) {
                  const pageNum = document.createElement('div');
                  pageNum.className = 'page-number';
                  pageNum.textContent = 'Page ' + i + ' of ' + totalPages;
                  pageNum.style.top = ((pageHeight * i) - bottomMargin - 70) + 'px';
                  pageNumbersContainer.appendChild(pageNum);
                }
                
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                }, 100);
              }, 250);
            });
          </script>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the report');
      return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
  };
  const handlePrintAnalytics = () => {
    // Determine which data to print based on selected tab
    let dataToShow = [];
    let reportTitle = '';
    let columns = [];
    
    switch (selectedAnalyticsTab) {
      case 'topSelling':
        dataToShow = topSellingProducts;
        reportTitle = 'Top Selling Products';
        columns = ['Rank', 'Product', 'Quantity Sold', 'Revenue', 'Profit', 'Margin'];
        break;
      case 'lowSelling':
        dataToShow = lowSellingProducts;
        reportTitle = 'Low Selling Products';
        columns = ['Rank', 'Product', 'Quantity Sold', 'Revenue', 'Days Since Last Sale'];
        break;
      case 'lowStock':
        dataToShow = lowStockProducts;
        reportTitle = 'Low Stock Products';
        columns = ['Product', 'Current Stock', 'Min Stock', 'Status', 'Last Restocked'];
        break;
      case 'highStock':
        dataToShow = highStockProducts;
        reportTitle = 'High Stock Products';
        columns = ['Product', 'Current Stock', 'Max Stock', 'Excess', 'Days in Stock'];
        break;
      case 'anomalies':
        dataToShow = anomalies;
        reportTitle = 'Product Anomalies';
        columns = ['Product', 'Type', 'Description', 'Severity'];
        break;
      default:
        toast.error('No data to print');
        return;
    }

    if (dataToShow.length === 0) {
      toast.error('No data to print');
      return;
    }

    // Build filters display
    const filtersText = `Date Range: Last ${analyticsDateRange} days`;

    // Generate table rows based on selected tab
    let tableRows = '';
    let grandTotalRow = '';
    
    if (selectedAnalyticsTab === 'topSelling') {
      let totalQuantity = 0;
      let totalRevenue = 0;
      let totalProfit = 0;
      
      tableRows = dataToShow.map((item, index) => {
        totalQuantity += item.quantitySold;
        totalRevenue += item.revenue;
        totalProfit += item.profit;
        
        return `
        <tr>
          <td>${index + 1}</td>
          <td>${item.productName || 'Unknown'}</td>
          <td class="text-right">${item.quantitySold}</td>
          <td class="text-right">${formatCurrency(item.revenue)}</td>
          <td class="text-right">${formatCurrency(item.profit)}</td>
          <td class="text-right">${item.margin.toFixed(1)}%</td>
        </tr>
      `}).join('');
      
      grandTotalRow = `
        <tr class="grand-total">
          <td colspan="2" style="text-align: left; padding: 8px 6px; font-size: 11px; font-weight: 700;">GRAND TOTAL:</td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${totalQuantity}</td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${formatCurrency(totalRevenue)}</td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${formatCurrency(totalProfit)}</td>
          <td></td>
        </tr>
      `;
    } else if (selectedAnalyticsTab === 'lowSelling') {
      let totalQuantity = 0;
      let totalRevenue = 0;
      
      tableRows = dataToShow.map((item, index) => {
        totalQuantity += item.quantitySold;
        totalRevenue += item.revenue;
        
        return `
        <tr>
          <td>${index + 1}</td>
          <td>${item.productName || 'Unknown'}</td>
          <td class="text-right">${item.quantitySold}</td>
          <td class="text-right">${formatCurrency(item.revenue)}</td>
          <td class="text-right">${item.daysSinceLastSale || 'N/A'}</td>
        </tr>
      `}).join('');
      
      grandTotalRow = `
        <tr class="grand-total">
          <td colspan="2" style="text-align: left; padding: 8px 6px; font-size: 11px; font-weight: 700;">GRAND TOTAL:</td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${totalQuantity}</td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${formatCurrency(totalRevenue)}</td>
          <td></td>
        </tr>
      `;
    } else if (selectedAnalyticsTab === 'lowStock') {
      let totalCurrentStock = 0;
      
      tableRows = dataToShow.map((item) => {
        totalCurrentStock += item.currentStock || 0;
        
        return `
        <tr>
          <td>${item.productName || item.name || 'Unknown'}</td>
          <td class="text-right">${item.currentStock}</td>
          <td class="text-right">${item.minStock}</td>
          <td>${item.status}</td>
          <td>${item.lastRestocked ? format(new Date(item.lastRestocked), 'MMM dd, yyyy') : 'N/A'}</td>
        </tr>
      `}).join('');
      
      grandTotalRow = `
        <tr class="grand-total">
          <td style="text-align: left; padding: 8px 6px; font-size: 11px; font-weight: 700;">GRAND TOTAL:</td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${totalCurrentStock}</td>
          <td colspan="3"></td>
        </tr>
      `;
    } else if (selectedAnalyticsTab === 'highStock') {
      let totalCurrentStock = 0;
      let totalExcess = 0;
      
      tableRows = dataToShow.map((item) => {
        totalCurrentStock += item.currentStock || 0;
        totalExcess += item.excess || 0;
        
        return `
        <tr>
          <td>${item.productName || item.name || 'Unknown'}</td>
          <td class="text-right">${item.currentStock}</td>
          <td class="text-right">${item.maxStock}</td>
          <td class="text-right">${item.excess}</td>
          <td class="text-right">${item.daysInStock || 'N/A'}</td>
        </tr>
      `}).join('');
      
      grandTotalRow = `
        <tr class="grand-total">
          <td style="text-align: left; padding: 8px 6px; font-size: 11px; font-weight: 700;">GRAND TOTAL:</td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${totalCurrentStock}</td>
          <td></td>
          <td class="text-right" style="padding: 8px 6px; font-size: 11px; font-weight: 700;">${totalExcess}</td>
          <td></td>
        </tr>
      `;
    } else if (selectedAnalyticsTab === 'anomalies') {
      tableRows = dataToShow.map((item) => `
        <tr>
          <td>${item.productName || 'Unknown'}</td>
          <td>${item.type}</td>
          <td>${item.description}</td>
          <td>${item.severity}</td>
        </tr>
      `).join('');
      // No grand total for anomalies
    }

    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle} - ${new Date().toLocaleDateString()}</title>
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
            }
            .header h1 {
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 4px 0;
            }
            .header h2 {
              font-size: 16px;
              font-weight: 600;
              margin: 0;
            }
            .filters {
              background: #f8f9fa;
              padding: 10px;
              border: 2px solid #333;
              margin: 10px 0;
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
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 9px;
              border: 1px solid #333;
            }
            th, td {
              border: 1px solid #333;
              padding: 6px 4px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #fff;
              font-weight: 700;
              text-transform: uppercase;
              border-bottom: 2px solid #000;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .grand-total {
              background: #f0f0f0;
              font-weight: 700;
              border-top: 2px solid #000;
            }
            .text-right { text-align: right; }
            .footer {
              margin-top: 12px;
              padding-top: 10px;
              border-top: 2px solid #333;
              font-size: 8px;
            }
            .footer-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 10px;
            }
            .footer-left {
              text-align: left;
            }
            .footer-right {
              text-align: right;
            }
            .footer-center {
              text-align: center;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #ccc;
              color: #666;
            }
            .footer-center p {
              margin: 3px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>${reportTitle}</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th${col.includes('Revenue') || col.includes('Profit') || col.includes('Stock') || col.includes('Quantity') || col.includes('Excess') || col.includes('Days') || col.includes('Margin') ? ' class="text-right"' : ''}>${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              ${grandTotalRow}
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <div class="footer-left">
                <strong>Generated By:</strong> ${userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : 'Branch Manager'}<br>
                <strong>Position:</strong> Branch Manager
              </div>
              <div class="footer-right">
                <strong>Generated On:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br>
                <strong>Time:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div class="footer-center">
              <p style="font-weight: 600; font-size: 9px;">Page 1 of 1</p>
              <p>${reportTitle} - ${dataToShow.length} Items</p>
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
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  const getProductStockInfo = (productId) => {
    const stock = stocks.find(s => s.productId === productId);
    if (!stock) {
      return {
        currentStock: 0,
        minStock: 0,
        maxStock: 0,
        status: 'No Stock Data',
        statusColor: 'text-gray-600 bg-gray-100 border-gray-200',
        usageType: 'otc' // Default to OTC if no stock data
      };
    }

    const currentStock = stock.totalStock || 0;
    const minStock = stock.minStock || 0;
    const maxStock = stock.maxStock || 0;

    let status = 'In Stock';
    let statusColor = 'text-green-600 bg-green-100 border-green-200';

    if (currentStock === 0) {
      status = 'Out of Stock';
      statusColor = 'text-red-600 bg-red-100 border-red-200';
    } else if (currentStock <= minStock && minStock > 0) {
      status = 'Low Stock';
      statusColor = 'text-yellow-600 bg-yellow-100 border-yellow-200';
    } else if (maxStock > 0 && currentStock > maxStock) {
      status = 'Overstock';
      statusColor = 'text-orange-600 bg-orange-100 border-orange-200';
    }

    return {
      currentStock,
      minStock,
      maxStock,
      status,
      statusColor,
      usageType: stock.usageType || 'otc' // Default to 'otc' if not specified
    };
  };

  // Get status color and icon
  const getStatusColorPO = (status) => {
    switch (status) {
    case 'Pending Branch Approval': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    case 'Pending Overall Approval': return 'text-blue-600 bg-blue-100 border-blue-200';
    case 'Pending': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    case 'Received': return 'text-blue-600 bg-blue-100 border-blue-200';
    case 'Approved': return 'text-green-600 bg-green-100 border-green-200';
    case 'Rejected by Branch': return 'text-red-600 bg-red-100 border-red-200';
    case 'Rejected by Overall': return 'text-rose-700 bg-rose-100 border-rose-200';
    case 'Rejected': return 'text-red-600 bg-red-100 border-red-200';
    case 'In Transit': return 'text-purple-600 bg-purple-100 border-purple-200';
    case 'Shipped': return 'text-purple-600 bg-purple-100 border-purple-200';
    case 'Delivered': return 'text-green-600 bg-green-100 border-green-200';
    case 'Cancelled': return 'text-red-600 bg-red-100 border-red-200';
    case 'Overdue': return 'text-orange-600 bg-orange-100 border-orange-200';
    default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
    case 'Pending Branch Approval': return <Clock className="h-3 w-3" />;
    case 'Pending Overall Approval': return <Clock className="h-3 w-3" />;
    case 'Pending': return <Clock className="h-3 w-3" />;
    case 'Received': return <CheckCircle className="h-3 w-3" />;
    case 'Approved': return <CheckCircle className="h-3 w-3" />;
    case 'Rejected by Branch': return <XCircle className="h-3 w-3" />;
    case 'Rejected by Overall': return <XCircle className="h-3 w-3" />;
    case 'Rejected': return <XCircle className="h-3 w-3" />;
    case 'In Transit': return <Truck className="h-3 w-3" />;
    case 'Shipped': return <Truck className="h-3 w-3" />;
    case 'Delivered': return <CheckCircle className="h-3 w-3" />;
    case 'Cancelled': return <XCircle className="h-3 w-3" />;
    case 'Overdue': return <AlertTriangle className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
    }
  };

  // Handle receive order (from Inventory Controller)
  const handleReceiveOrder = async (orderId) => {
    try {
    const orderRef = doc(db, 'purchaseOrders', orderId);
    await updateDoc(orderRef, {
      status: 'Received',
      receivedBy: userData.uid || userData.id,
      receivedByName: (userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`.trim() 
        : (userData.email || 'Unknown')),
      receivedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await loadPurchaseOrders();
    } catch (err) {
    console.error('Error receiving order:', err);
    setErrorPO('Failed to receive order. Please try again.');
    }
  };

  // Check if order can be received (by Branch Manager)
  const canReceive = (order) => {
    return order.createdByRole === 'inventoryController' && order.status === 'Pending';
  };

  // Approval functions
  const handleOpenApproveModal = (orderId) => {
    setPendingOrderId(orderId);
    setIsConfirmApproveModalOpen(true);
  };

  const handleApproveOrder = async () => {
    if (!pendingOrderId) return;
    
    try {
      setIsProcessingApproval(true);
      setErrorPO(null);
      const orderRef = doc(db, 'purchaseOrders', pendingOrderId);
      await updateDoc(orderRef, {
        status: 'Pending Overall Approval',
        branchApprovedBy: userData.uid || userData.id,
        branchApprovedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        branchApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await loadPurchaseOrders();
      setIsConfirmApproveModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedOrder(null);
      setPendingOrderId(null);
    } catch (err) {
      console.error('Error approving order:', err);
      setErrorPO('Failed to approve order. Please try again.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleOpenRejectModal = (order) => {
    setSelectedOrder(order);
    setRejectionNote('');
    setIsRejectModalOpen(true);
  };

  const handleRejectOrderConfirm = () => {
    if (!selectedOrder || !rejectionNote.trim()) {
      setErrorPO('Rejection note is required');
      return;
    }
    setIsConfirmRejectModalOpen(true);
  };

  const handleRejectOrder = async () => {
    if (!selectedOrder || !rejectionNote.trim()) return;

    try {
      setIsProcessingApproval(true);
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Rejected by Branch',
        branchRejectedBy: userData.uid || userData.id,
        branchRejectedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        branchRejectedAt: serverTimestamp(),
        branchRejectionNote: rejectionNote.trim(),
        updatedAt: serverTimestamp()
      });
      await loadPurchaseOrders();
      setIsRejectModalOpen(false);
      setIsConfirmRejectModalOpen(false);
      setSelectedOrder(null);
      setRejectionNote('');
    } catch (err) {
      console.error('Error rejecting order:', err);
      setErrorPO('Failed to reject order. Please try again.');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Check if order can be approved/rejected
  const canApproveOrReject = (order) => {
    return order.status === 'Pending Branch Approval';
  };

  // ========== ANALYTICS FUNCTIONS ==========
  const loadAnalytics = async () => {
    if (!userData?.branchId) return;

    try {
    setLoadingAnalytics(true);
      const days = parseInt(analyticsDateRange) || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      console.log('📊 Loading Product Analytics...');

      // 1. Load product transactions for sales analysis
      const transactionsRef = collection(db, 'transactions');
      const transactionsQuery = query(
        transactionsRef,
        where('branchId', '==', userData.branchId),
        where('salesType', '==', 'product'),
        where('status', '==', 'paid')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);

      const allTransactions = [];
      transactionsSnapshot.forEach((doc) => {
      const data = doc.data();
        const transactionDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
        if (transactionDate >= cutoffDate) {
          allTransactions.push({
        id: doc.id,
        ...data,
            createdAt: transactionDate
          });
        }
      });

      console.log('📈 Transactions loaded:', allTransactions.length);

      // 2. Calculate Top Selling Products
      const productSalesMap = {};
      allTransactions.forEach(transaction => {
        if (transaction.items && Array.isArray(transaction.items)) {
          transaction.items.forEach(item => {
            if (item.type === 'product') {
              const productId = item.id || item.stockId;
              if (!productSalesMap[productId]) {
                productSalesMap[productId] = {
                  productId,
                  productName: item.name,
                  quantitySold: 0,
                  revenue: 0,
                  cost: 0,
                  transactionCount: 0,
                  lastSoldDate: transaction.createdAt
                };
              }
              productSalesMap[productId].quantitySold += item.quantity || 0;
              productSalesMap[productId].revenue += (item.price || 0) * (item.quantity || 0);
              productSalesMap[productId].cost += (item.unitCost || 0) * (item.quantity || 0);
              productSalesMap[productId].transactionCount += 1;
              if (transaction.createdAt > productSalesMap[productId].lastSoldDate) {
                productSalesMap[productId].lastSoldDate = transaction.createdAt;
              }
            }
          });
        }
      });

      const topSelling = Object.values(productSalesMap)
        .map(p => ({
          ...p,
          profit: p.revenue - p.cost,
          margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);
      setTopSellingProducts(topSelling);

      // 3. Calculate Low Selling Products
      const lowSelling = Object.values(productSalesMap)
        .map(p => ({
          ...p,
          profit: p.revenue - p.cost,
          margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
          daysSinceLastSale: Math.floor((new Date() - p.lastSoldDate) / (1000 * 60 * 60 * 24))
        }))
        .filter(p => p.quantitySold === 0 || p.quantitySold < 5 || p.daysSinceLastSale > 14)
        .sort((a, b) => {
          if (a.quantitySold === 0 && b.quantitySold > 0) return -1;
          if (a.quantitySold > 0 && b.quantitySold === 0) return 1;
          return b.daysSinceLastSale - a.daysSinceLastSale;
        });
      setLowSellingProducts(lowSelling);

      // 4. Calculate Low Stock Products
      const lowStock = products
        .filter(product => {
          const stock = product.currentStock || 0;
          const minStock = product.minStock || 0;
          return stock > 0 && stock <= minStock;
        })
        .map(product => ({
          ...product,
          stockLevel: product.currentStock || 0,
          minStock: product.minStock || 0,
          maxStock: product.maxStock || 0,
          stockPercentage: product.maxStock > 0 ? ((product.currentStock || 0) / product.maxStock) * 100 : 0
        }))
        .sort((a, b) => (a.currentStock || 0) - (b.currentStock || 0));
      setLowStockProducts(lowStock);

      // 5. Calculate High Stock Products with batch info
      const stocksRef = collection(db, 'stocks');
      const stocksQuery = query(
        stocksRef,
        where('branchId', '==', userData.branchId)
      );
      const stocksSnapshot = await getDocs(stocksQuery);

      const stockBatches = [];
      stocksSnapshot.forEach((doc) => {
        const data = doc.data();
        stockBatches.push({
          id: doc.id,
          productId: data.productId,
          batchNumber: data.batchNumber,
          currentStock: data.currentStock || 0,
          receivedDate: data.receivedDate?.toDate ? data.receivedDate.toDate() : (data.receivedDate ? new Date(data.receivedDate) : null),
          expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : (data.expirationDate ? new Date(data.expirationDate) : null),
          ...data
        });
      });

      // Group stocks by product and calculate totals
      const productStockMap = new Map();
      stockBatches.forEach(stock => {
        const productId = stock.productId;
        if (!productStockMap.has(productId)) {
          const product = products.find(p => p.id === productId);
          if (product) {
            productStockMap.set(productId, {
              ...product,
              totalStock: 0,
              batches: []
            });
          }
        }
        const productData = productStockMap.get(productId);
        if (productData) {
          productData.totalStock += stock.currentStock || 0;
          productData.batches.push(stock);
        }
      });

      const highStock = Array.from(productStockMap.values())
        .filter(product => {
          const stock = product.totalStock || 0;
          const maxStock = product.maxStock || 0;
          return maxStock > 0 && stock > maxStock * 1.2; // 20% over max stock
        })
        .map(product => ({
          ...product,
          stockLevel: product.totalStock,
          maxStock: product.maxStock || 0,
          overstockAmount: product.totalStock - (product.maxStock || 0),
          overstockPercentage: product.maxStock > 0 ? ((product.totalStock - product.maxStock) / product.maxStock) * 100 : 0,
          batches: product.batches
            .filter(b => (b.currentStock || 0) > 0)
            .sort((a, b) => {
              const dateA = a.receivedDate || new Date(0);
              const dateB = b.receivedDate || new Date(0);
              return dateB.getTime() - dateA.getTime();
            })
        }))
        .sort((a, b) => b.overstockAmount - a.overstockAmount);
      setHighStockProducts(highStock);

      // 6. Detect Anomalies
      const detectedAnomalies = detectAnomalies(products, allTransactions, stockBatches);
      setAnomalies(detectedAnomalies);

      console.log('✅ Analytics loaded:', {
        topSelling: topSelling.length,
        lowSelling: lowSelling.length,
        lowStock: lowStock.length,
        highStock: highStock.length,
        anomalies: detectedAnomalies.length
      });

    } catch (err) {
      console.error('❌ Error loading analytics:', err);
    } finally {
    setLoadingAnalytics(false);
    }
  };

  // Detect inventory anomalies
  const detectAnomalies = (products, transactions, stockBatches) => {
    const anomalies = [];
    const days = parseInt(analyticsDateRange) || 30;

    // 1. Products with no sales but stock exists (dead stock)
    const productSalesMap = {};
    transactions.forEach(transaction => {
      if (transaction.items && Array.isArray(transaction.items)) {
        transaction.items.forEach(item => {
          if (item.type === 'product') {
            const productId = item.id || item.stockId;
            if (!productSalesMap[productId]) {
              productSalesMap[productId] = { quantitySold: 0, lastSaleDate: null };
            }
            productSalesMap[productId].quantitySold += item.quantity || 0;
            const saleDate = transaction.createdAt instanceof Date ? transaction.createdAt : new Date(transaction.createdAt);
            if (!productSalesMap[productId].lastSaleDate || saleDate > productSalesMap[productId].lastSaleDate) {
              productSalesMap[productId].lastSaleDate = saleDate;
            }
          }
        });
      }
    });

    products.forEach(product => {
      const sales = productSalesMap[product.id];
      const stock = product.currentStock || 0;
      
      if (stock > 0) {
        if (!sales || sales.quantitySold === 0) {
        anomalies.push({
            type: 'no_sales',
            severity: 'high',
          productId: product.id,
          productName: product.name,
            description: `No sales in the last ${days} days despite having ${stock} units in stock`,
            currentStock: stock,
            stockValue: stock * (product.unitCost || 0),
            daysWithoutSale: days
          });
        } else {
          const daysSinceLastSale = Math.floor((new Date() - sales.lastSaleDate) / (1000 * 60 * 60 * 24));
          if (daysSinceLastSale > 30 && stock > 10) {
      anomalies.push({
              type: 'slow_moving',
        severity: 'medium',
        productId: product.id,
        productName: product.name,
              description: `No sales for ${daysSinceLastSale} days with ${stock} units in stock`,
              currentStock: stock,
              daysSinceLastSale: daysSinceLastSale
            });
          }
        }
      }
    });

    // 2. Price discrepancies (unit cost vs OTC price - very low margin)
    products.forEach(product => {
    if (product.unitCost > 0 && product.otcPrice > 0) {
      const margin = ((product.otcPrice - product.unitCost) / product.unitCost) * 100;
        if (margin < 5) {
          anomalies.push({
            type: 'very_low_margin',
            severity: 'high',
            productId: product.id,
            productName: product.name,
            description: `Very low profit margin: ${margin.toFixed(1)}% (Cost: ${formatCurrency(product.unitCost)}, Price: ${formatCurrency(product.otcPrice)})`,
            margin: margin,
            unitCost: product.unitCost,
            otcPrice: product.otcPrice
          });
        } else if (margin < 10) {
        anomalies.push({
          type: 'low_margin',
          severity: 'medium',
          productId: product.id,
          productName: product.name,
            description: `Low profit margin: ${margin.toFixed(1)}% (Cost: ${formatCurrency(product.unitCost)}, Price: ${formatCurrency(product.otcPrice)})`,
          margin: margin,
          unitCost: product.unitCost,
          otcPrice: product.otcPrice
        });
      }
    }
    });

    // 3. Critically low stock (below 50% of min stock)
    products.forEach(product => {
      const stock = product.currentStock || 0;
      const minStock = product.minStock || 0;
      if (minStock > 0 && stock > 0 && stock < minStock * 0.5) {
      anomalies.push({
          type: 'critically_low_stock',
          severity: 'critical',
        productId: product.id,
        productName: product.name,
          description: `Critically low stock: ${stock} units (Min: ${minStock})`,
          currentStock: stock,
          minStock: minStock,
          stockPercentage: (stock / minStock) * 100
        });
      }
    });

    // 4. Expiring soon batches
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    stockBatches.forEach(batch => {
      if (batch.expirationDate && batch.currentStock > 0) {
        const expDate = batch.expirationDate instanceof Date ? batch.expirationDate : new Date(batch.expirationDate);
        if (expDate <= thirtyDaysFromNow && expDate > now) {
          const daysUntilExpiry = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
          const product = products.find(p => p.id === batch.productId);
          if (product) {
      anomalies.push({
              type: 'expiring_soon',
              severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
        productId: product.id,
        productName: product.name,
              description: `Batch ${batch.batchNumber} expiring in ${daysUntilExpiry} days (${batch.currentStock} units)`,
              batchNumber: batch.batchNumber,
              expirationDate: expDate,
              daysUntilExpiry: daysUntilExpiry,
              quantity: batch.currentStock
            });
          }
        }
      }
    });

    // 5. Sudden sales spike (potential data error or bulk sale)
    const salesByDate = {};
    transactions.forEach(transaction => {
      const dateKey = format(transaction.createdAt, 'yyyy-MM-dd');
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { count: 0, total: 0 };
      }
      salesByDate[dateKey].count += 1;
      salesByDate[dateKey].total += transaction.total || 0;
    });

    const avgDailySales = Object.values(salesByDate).reduce((sum, day) => sum + day.total, 0) / Object.keys(salesByDate).length;
    Object.keys(salesByDate).forEach(date => {
      if (salesByDate[date].total > avgDailySales * 3 && avgDailySales > 0) {
        anomalies.push({
          type: 'sales_spike',
          severity: 'low',
          description: `Unusual sales spike on ${date}: ${formatCurrency(salesByDate[date].total)} (Average: ${formatCurrency(avgDailySales)})`,
          date: date,
          amount: salesByDate[date].total,
          averageAmount: avgDailySales
        });
      }
    });

    return anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };


  // Load analytics when tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && products.length > 0 && userData?.branchId) {
    loadAnalytics();
    }
  }, [userData?.branchId, activeTab, analyticsDateRange, products.length]);

  return (
    
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === 'reports' 
              ? 'Product Sales' 
              : activeTab === 'purchaseOrders'
              ? 'Purchase Orders'
              : activeTab === 'analytics'
              ? 'Product Analytics'
              : 'Inventory'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'reports' 
              ? 'Track product sales performance and revenue' 
              : activeTab === 'purchaseOrders'
              ? 'View purchase orders from suppliers'
              : activeTab === 'analytics'
              ? 'Inventory insights, anomalies, and performance metrics'
              : 'Manage products, stock levels, and purchase orders'
            }
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Card className="p-0">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('products')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'products'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span>Products</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'reports'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <span>Product Sales</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('purchaseOrders')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'purchaseOrders'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span>Purchase Orders</span>
                {purchaseOrders.filter(o => o.status === 'Pending Branch Approval').length > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {purchaseOrders.filter(o => o.status === 'Pending Branch Approval').length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <span>Product Analytics</span>
              </div>
            </button>
          </div>
        </div>
      </Card>

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-6">
          <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inStockCount}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.lowStockCount}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-6">
              <div className="flex items-center">
                <TrendingDown className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.outOfStockCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Banknote className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
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
          <button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              (selectedCategory !== 'all' || selectedBrand !== 'all' || selectedSupplier !== 'all' || selectedStatus !== 'all' || minStock || maxStock || minUnitCost || maxUnitCost || minOtcPrice || maxOtcPrice || minTotalValue || maxTotalValue || hasServiceMapping !== 'all' || stockAlerts !== 'all' || expiryFilter !== 'all' || productStatus !== 'all')
                ? 'bg-[#160B53]/10 border-[#160B53]/30 text-[#160B53] hover:bg-[#160B53]/20'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            title={`Filter - ${filteredProducts.length} products`}
          >
            <Filter className="w-5 h-5" />
            {filteredProducts.length > 0 && (
              <span className="bg-[#160B53] text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
                {filteredProducts.length}
              </span>
            )}
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Export Products Data"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Print Report"
          >
            <Printer className="w-5 h-5 text-gray-600" />
          </button>
            </div>
          </div>

      {/* Products Table */}
      <Card className="p-6">
            {loading && products.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading products...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Product
                    <span className="no-print"><SortIcon column="name" /></span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">
                    Category
                    <span className="no-print"><SortIcon column="category" /></span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('brand')}
                >
                  <div className="flex items-center">
                    Brand
                    <span className="no-print"><SortIcon column="brand" /></span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('otcStock')}
                >
                  <div className="flex items-center">
                    OTC Stock
                    <span className="no-print"><SortIcon column="otcStock" /></span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('salonStock')}
                >
                  <div className="flex items-center">
                    Salon Stock
                    <span className="no-print"><SortIcon column="salonStock" /></span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <span className="no-print"><SortIcon column="status" /></span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('unitCost')}
                >
                  <div className="flex items-center">
                    Unit Cost
                    <span className="no-print"><SortIcon column="unitCost" /></span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('otcPrice')}
                >
                  <div className="flex items-center">
                    OTC Price
                    <span className="no-print"><SortIcon column="otcPrice" /></span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Service Mapping
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalValue')}
                >
                  <div className="flex items-center">
                    Total Value
                    <span className="no-print"><SortIcon column="totalValue" /></span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider no-print">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-6 py-12 text-center">
                          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500">No products found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => {
                        // Debug: Log what we're about to display for ARGAN
                        if (product.id === 'mZorRF53mbG553ZUHDuU') {
                          console.log('🎨 Rendering ARGAN in table:', {
                            productId: product.id,
                            name: product.name,
                            currentStock: product.currentStock,
                            currentStockType: typeof product.currentStock,
                            allProductKeys: Object.keys(product).filter(k => k.includes('stock') || k.includes('Stock'))
                          });
                        }
                        return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                              <p className="font-medium text-gray-900">{product.name || 'Unknown'}</p>
                              {product.sku && (
                                <p className="text-sm text-gray-500">UPC: {product.sku}</p>
                              )}
                    </div>
                  </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.category || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.brand || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">{Number(product.otcStock) || 0}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">{Number(product.salonStock) || 0}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                              {(() => {
                                const statusValue = product.status || 'Unknown';
                                // Debug for ARGAN
                                if (product.id === 'mZorRF53mbG553ZUHDuU') {
                                  console.log('🔴 STATUS VALUE BEING RENDERED:', {
                                    productId: product.id,
                                    status: product.status,
                                    statusType: typeof product.status,
                                    statusValue: statusValue,
                                    currentStock: product.currentStock,
                                    minStock: product.minStock
                                  });
                                }
                                return String(statusValue);
                              })()}
                    </span>
                  </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency((product.unitCost || 0))}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency((product.otcPrice || 0))}</td>
                          <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                            {(() => {
                              const productServices = services.filter(service => 
                                service.productMappings && service.productMappings.some(mapping => mapping.productId === product.id)
                              );
                              return productServices.length > 0 ? (
                                <div className="space-y-1">
                                  {productServices.slice(0, 2).map(service => {
                                    const mapping = service.productMappings.find(m => m.productId === product.id);
                                    return (
                                      <div key={service.id} className="flex items-center gap-1 text-xs">
                                        <Scissors className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                        <span className="text-gray-700 truncate">{service.name}</span>
                                        <span className="text-purple-600 font-medium">
                                          {mapping.quantity}{mapping.unit} ({mapping.percentage}%)
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {productServices.length > 2 && (
                                    <span className="text-xs text-gray-400">+{productServices.length - 2} more</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">None</span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(((product.currentStock || 0) * (product.unitCost || 0)))}
                          </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium no-print">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('View details clicked for product:', product);
                          setSelectedProduct(product);
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                  </td>
                </tr>
                        );
                      })
                    )}
            </tbody>
          </table>
        </div>
            )}
      </Card>

          {/* Alerts */}
          {stats.lowStockCount > 0 && (
        <Card className="p-6 border-l-4 border-yellow-400 bg-yellow-50">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">Low Stock Alert</h3>
              <p className="text-yellow-700">
                    {stats.lowStockCount} product{stats.lowStockCount > 1 ? 's' : ''} need{stats.lowStockCount === 1 ? 's' : ''} restocking
              </p>
            </div>
          </div>
        </Card>
      )}

          {stats.outOfStockCount > 0 && (
        <Card className="p-6 border-l-4 border-red-400 bg-red-50">
          <div className="flex items-center">
            <TrendingDown className="h-6 w-6 text-red-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Out of Stock Alert</h3>
              <p className="text-red-700">
                    {stats.outOfStockCount} product{stats.outOfStockCount > 1 ? 's' : ''} out of stock
              </p>
            </div>
          </div>
        </Card>
      )}
        </>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <>
          {/* Controls */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                  
                <div className="flex gap-1">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={handleFilter}>
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Transactions Table */}
          {loadingReports && productTransactions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading transactions...</span>
            </div>
          ) : (
                <Card className="p-6">
              <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Receipt #
                        </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                        </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                        </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Products
                        </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {productTransactions.length === 0 ? (
                        <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                          {loadingReports ? 'Loading...' : 'No product transactions found'}
                          </td>
                        </tr>
                      ) : (
                      productTransactions
                        .filter(transaction => {
                          if (!searchTerm) return true;
                          const searchLower = searchTerm.toLowerCase();
                          return (
                            transaction.receiptNumber?.toLowerCase().includes(searchLower) ||
                            transaction.clientName?.toLowerCase().includes(searchLower) ||
                            transaction.items?.some(item => item.name?.toLowerCase().includes(searchLower))
                          );
                        })
                        .map((transaction) => {
                          // Handle date conversion properly
                          let transactionDate;
                          if (transaction.createdAt instanceof Date) {
                            transactionDate = transaction.createdAt;
                          } else if (transaction.createdAt?.toDate) {
                            transactionDate = transaction.createdAt.toDate();
                          } else if (transaction.createdAt) {
                            transactionDate = new Date(transaction.createdAt);
                          } else {
                            transactionDate = new Date();
                          }
                          
                          const productItems = transaction.items?.filter(item => item.type === 'product') || [];
                          
                          return (
                            <tr key={transaction.id || transaction.receiptNumber} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {transaction.receiptNumber || transaction.id || 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {format(transactionDate, 'MMM dd, yyyy HH:mm')}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">{transaction.clientName || 'Guest'}</div>
                                {transaction.clientPhone && (
                                  <div className="text-xs text-gray-500">{transaction.clientPhone}</div>
                                )}
                                {transaction.createdByName && (
                                  <div className="text-xs text-gray-400">By: {transaction.createdByName}</div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-900 space-y-1">
                                  {productItems.length > 0 ? (
                                    productItems.map((item, idx) => (
                                      <div key={idx} className="mb-1">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-gray-600"> × {item.quantity}</span>
                                        {item.price && (
                                          <span className="text-gray-500 text-xs ml-1">
                                            ({formatCurrency((item.price * item.quantity))})
                                          </span>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-gray-400">No products</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                                  {transaction.paymentMethod || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="text-sm font-medium text-gray-900">
                                  {formatCurrency((transaction.total || 0))}
                                </div>
                                {transaction.discount > 0 && (
                                  <div className="text-xs text-gray-500">
                                    Discount: {formatCurrency(transaction.discount)}
                                  </div>
                                )}
                                {transaction.subtotal && transaction.subtotal !== transaction.total && (
                                  <div className="text-xs text-gray-500">
                                    Subtotal: {formatCurrency(transaction.subtotal)}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  transaction.status === 'paid' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {transaction.status || 'Unknown'}
                                </span>
                                {transaction.notes && (
                                  <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={transaction.notes}>
                                    {transaction.notes}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
          )}
        </>
      )}

      {/* PURCHASE ORDERS TAB */}
      {activeTab === 'purchaseOrders' && (
        <>
          {/* Error Display */}
          {errorPO && (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">{errorPO}</p>
                <Button variant="ghost" size="sm" onClick={() => setErrorPO(null)} className="ml-auto">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.totalOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.pendingOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Delivered</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.deliveredOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.overdueOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <Banknote className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(orderStats.totalValue)}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by order ID, supplier, or notes..."
                    value={searchTermPO}
                    onChange={(e) => setSearchTermPO(e.target.value)}
                    className="w-full pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-1 items-center">
                {/* Sort indicator */}
                <div className="hidden sm:flex items-center text-xs text-gray-500 mr-2">
                  <span>Sorted by: </span>
                  <span className="font-medium text-[#160B53] ml-1">
                    {sortColumnPO === 'createdAt' ? 'Date Created' : 
                     sortColumnPO === 'orderId' ? 'Order ID' :
                     sortColumnPO === 'supplierName' ? 'Supplier' :
                     sortColumnPO === 'orderDate' ? 'Order Date' :
                     sortColumnPO === 'expectedDelivery' ? 'Expected Delivery' :
                     sortColumnPO === 'status' ? 'Status' :
                     sortColumnPO === 'totalAmount' ? 'Amount' : sortColumnPO}
                  </span>
                  <span className="ml-1">({sortDirectionPO === 'desc' ? '↓' : '↑'})</span>
                </div>
                <Button variant="outline" onClick={handleExportPurchaseOrdersCSV} title="Export to CSV">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handlePrintPurchaseOrders} title="Print">
                  <Printer className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleFilterPurchaseOrders}
                  className={`relative ${(selectedStatusPO !== 'all' || selectedSupplierFilter !== 'all' || poDateFrom || poDateTo || poMinAmount || poMaxAmount || poCreatedBy !== 'all') ? 'border-[#160B53] text-[#160B53]' : ''}`}
                  title="Filter & Sort"
                >
                  <Filter className="h-4 w-4" />
                  {(() => {
                    const activeFilters = [
                      selectedStatusPO !== 'all',
                      selectedSupplierFilter !== 'all',
                      poDateFrom,
                      poDateTo,
                      poMinAmount,
                      poMaxAmount,
                      poCreatedBy !== 'all'
                    ].filter(Boolean).length;
                    return activeFilters > 0 ? (
                      <span className="absolute -top-1 -right-1 bg-[#160B53] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                        {activeFilters}
                      </span>
                    ) : null;
                  })()}
                </Button>
              </div>
            </div>
          </Card>

          {/* Purchase Orders Table */}
          {loadingPO && purchaseOrders.length === 0 ? (
            <Card className="p-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
                <span className="ml-2 text-gray-600">Loading purchase orders...</span>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSortPO('orderId')}
                      >
                        <div className="flex items-center">
                          Order ID
                          <SortIconPO column="orderId" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSortPO('supplierName')}
                      >
                        <div className="flex items-center">
                          Supplier
                          <SortIconPO column="supplierName" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSortPO('orderDate')}
                      >
                        <div className="flex items-center">
                          Order Date
                          <SortIconPO column="orderDate" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSortPO('expectedDelivery')}
                      >
                        <div className="flex items-center">
                          Expected Delivery
                          <SortIconPO column="expectedDelivery" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSortPO('status')}
                      >
                        <div className="flex items-center">
                          Status
                          <SortIconPO column="status" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSortPO('totalAmount')}
                      >
                        <div className="flex items-center">
                          Total Amount
                          <SortIconPO column="totalAmount" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                          No purchase orders found
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{order.orderId || order.id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{order.supplierName || 'Unknown'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.expectedDelivery ? format(new Date(order.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColorPO(order.status)}`}>
                              {getStatusIcon(order.status)}
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{formatCurrency((order.totalAmount || 0))}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{order.createdByName || 'Unknown'}</div>
                            {order.createdByRole === 'inventoryController' && (
                              <div className="text-xs text-gray-500">Inventory Controller</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setIsDetailsModalOpen(true);
                                }}
                                className="flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </Button>
                              {canApproveOrReject(order) && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenApproveModal(order.id)}
                                    className="flex items-center gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenRejectModal(order)}
                                    className="flex items-center gap-1 text-red-600 border-red-300 hover:bg-red-50"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <>
          {/* Header with Date Range */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3">
              <select
                value={analyticsDateRange}
                onChange={(e) => setAnalyticsDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <Button variant="outline" onClick={handlePrintAnalytics}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={loadAnalytics} disabled={loadingAnalytics}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* View Selection Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => setSelectedAnalyticsTab('topSelling')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 border-2 ${
                selectedAnalyticsTab === 'topSelling'
                  ? 'bg-green-100 text-green-700 border-green-300 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Top Selling</span>
            </button>
            <button
              onClick={() => setSelectedAnalyticsTab('lowSelling')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 border-2 ${
                selectedAnalyticsTab === 'lowSelling'
                  ? 'bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              <span>Low Selling</span>
            </button>
            <button
              onClick={() => setSelectedAnalyticsTab('lowStock')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 border-2 ${
                selectedAnalyticsTab === 'lowStock'
                  ? 'bg-orange-100 text-orange-700 border-orange-300 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Low Stock</span>
            </button>
            <button
              onClick={() => setSelectedAnalyticsTab('highStock')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 border-2 ${
                selectedAnalyticsTab === 'highStock'
                  ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>High Stock</span>
            </button>
            <button
              onClick={() => setSelectedAnalyticsTab('anomalies')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 border-2 ${
                selectedAnalyticsTab === 'anomalies'
                  ? 'bg-red-100 text-red-700 border-red-300 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Anomalies</span>
            </button>
                </div>

          {/* Analytics Content */}
          {loadingAnalytics ? (
            <Card className="p-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
                <span className="ml-2 text-gray-600">Loading analytics...</span>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards - 3 cards per tab */}
              {selectedAnalyticsTab === 'topSelling' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                          <p className="text-sm font-medium text-gray-600">Total Products</p>
                          <p className="text-2xl font-bold text-gray-900">{topSellingProducts.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Top performers</p>
                </div>
                        <div className="p-3 bg-green-100 rounded-full">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>
                    <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                          <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(topSellingProducts.reduce((sum, p) => sum + p.revenue, 0))}
                  </p>
                          <p className="text-xs text-gray-500 mt-1">From top sellers</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                          <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>
                    <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                          <p className="text-sm font-medium text-gray-600">Total Profit</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(topSellingProducts.reduce((sum, p) => sum + p.profit, 0))}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Net profit</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>
          </div>
                  <Card className="overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Top Selling Products</h3>
              </div>
                    <div className="p-6">
                      {topSellingProducts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">No top selling products found</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {topSellingProducts.map((product, index) => (
                                <tr key={product.productId} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <span className="text-lg font-bold text-gray-900">#{index + 1}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{product.productName}</div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-900">{product.quantitySold}</td>
                                  <td className="px-6 py-4 text-gray-900">{formatCurrency(product.revenue)}</td>
                                  <td className="px-6 py-4 text-green-600 font-medium">{formatCurrency(product.profit)}</td>
                                  <td className="px-6 py-4 text-gray-900">{product.margin.toFixed(1)}%</td>
                                  <td className="px-6 py-4 text-gray-900">{product.transactionCount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}

              {selectedAnalyticsTab === 'lowSelling' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Products</p>
                          <p className="text-2xl font-bold text-gray-900">{lowSellingProducts.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Need attention</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-full">
                          <TrendingDown className="h-6 w-6 text-yellow-600" />
                        </div>
                      </div>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">No Sales</p>
                          <p className="text-2xl font-bold text-red-600">
                            {lowSellingProducts.filter(p => p.quantitySold === 0).length}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Zero sales</p>
                        </div>
                        <div className="p-3 bg-red-100 rounded-full">
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                      </div>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Low Sales</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {lowSellingProducts.filter(p => p.quantitySold > 0).length}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Below threshold</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-full">
                          <TrendingDown className="h-6 w-6 text-yellow-600" />
                        </div>
                      </div>
                    </Card>
                  </div>
                  <Card className="overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Low Selling Products</h3>
                    </div>
                    <div className="p-6">
                      {lowSellingProducts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">All products are selling well!</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Sold</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {lowSellingProducts.map((product) => (
                                <tr key={product.productId} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{product.productName}</div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-900">{product.quantitySold || 0}</td>
                                  <td className="px-6 py-4 text-gray-900">{formatCurrency(product.revenue)}</td>
                                  <td className="px-6 py-4 text-gray-900">
                                    {product.lastSoldDate ? format(product.lastSoldDate, 'MMM dd, yyyy') : 'Never'}
                                    {product.daysSinceLastSale !== undefined && product.daysSinceLastSale > 0 && (
                                      <div className="text-xs text-gray-500">{product.daysSinceLastSale} days ago</div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    {product.quantitySold === 0 ? (
                                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">No Sales</span>
                                    ) : (
                                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Low Sales</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}

              {selectedAnalyticsTab === 'lowStock' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Products</p>
                          <p className="text-2xl font-bold text-gray-900">{lowStockProducts.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Low stock items</p>
                        </div>
                        <div className="p-3 bg-orange-100 rounded-full">
                          <AlertTriangle className="h-6 w-6 text-orange-600" />
                      </div>
                  </div>
                    </Card>
                  <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Critical Stock</p>
                          <p className="text-2xl font-bold text-red-600">
                            {lowStockProducts.filter(p => p.currentStock < (p.minStock * 0.5)).length}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Below 50% of min</p>
                      </div>
                        <div className="p-3 bg-red-100 rounded-full">
                          <AlertCircle className="h-6 w-6 text-red-600" />
                      </div>
                      </div>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Warning Stock</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {lowStockProducts.filter(p => p.currentStock >= (p.minStock * 0.5) && p.currentStock <= p.minStock).length}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">At min level</p>
                        </div>
                        <div className="p-3 bg-orange-100 rounded-full">
                          <AlertTriangle className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </Card>
                  </div>
                  <Card className="overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Low Stock Products</h3>
                    </div>
                    <div className="p-6">
                      {lowStockProducts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">All products have adequate stock!</div>
                      ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Level</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                            <tbody className="divide-y divide-gray-200">
                              {lowStockProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{product.name}</div>
                                    <div className="text-sm text-gray-500">{product.category} • {product.brand}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="font-medium text-orange-600">{product.currentStock || 0}</span>
                                  </td>
                                  <td className="px-6 py-4 text-gray-900">{product.minStock || 0}</td>
                                  <td className="px-6 py-4 text-gray-900">{product.maxStock || 0}</td>
                                  <td className="px-6 py-4">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-orange-600 h-2 rounded-full" 
                                        style={{ width: `${Math.min((product.currentStock / (product.maxStock || 1)) * 100, 100)}%` }}
                                      ></div>
                                  </div>
                                    <div className="text-xs text-gray-500 mt-1">{product.stockPercentage.toFixed(1)}% of max</div>
                                </td>
                                  <td className="px-6 py-4">
                                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">Low Stock</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  )}
                </div>
                  </Card>
                </>
              )}

              {selectedAnalyticsTab === 'highStock' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Products</p>
                          <p className="text-2xl font-bold text-gray-900">{highStockProducts.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Overstocked</p>
                  </div>
                        <div className="p-3 bg-blue-100 rounded-full">
                          <Package className="h-6 w-6 text-blue-600" />
                    </div>
                              </div>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Overstocked Count</p>
                          <p className="text-2xl font-bold text-blue-600">{highStockProducts.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Above max stock</p>
                            </div>
                        <div className="p-3 bg-blue-100 rounded-full">
                          <Package className="h-6 w-6 text-blue-600" />
                          </div>
                        </div>
                </Card>
                <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Overstock</p>
                          <p className="text-2xl font-bold text-red-600">
                            +{highStockProducts.reduce((sum, p) => sum + p.overstockAmount, 0)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Units over max</p>
                  </div>
                        <div className="p-3 bg-red-100 rounded-full">
                          <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                      </div>
                    </Card>
                  </div>
                  <Card className="overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">High Stock Products</h3>
                    </div>
                    <div className="p-6">
                      {highStockProducts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">No overstocked products</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overstock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overstock %</th>
                          </tr>
                        </thead>
                            <tbody className="divide-y divide-gray-200">
                              {highStockProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{product.name}</div>
                              </td>
                                  <td className="px-6 py-4">
                                    <span className="font-medium text-blue-600">{product.stockLevel}</span>
                              </td>
                                  <td className="px-6 py-4 text-gray-900">{product.maxStock}</td>
                                  <td className="px-6 py-4">
                                    <span className="font-medium text-red-600">+{product.overstockAmount}</span>
                              </td>
                                  <td className="px-6 py-4 text-gray-900">{product.overstockPercentage.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                      {highStockProducts.length > 0 && (
                        <div className="mt-6 space-y-6">
                          <h4 className="text-md font-semibold text-gray-900">Batch Details</h4>
                          {highStockProducts.map((product) => (
                            <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-semibold text-gray-900 mb-3">{product.name}</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch Number</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Received Date</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiration Date</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {product.batches && product.batches.length > 0 ? (
                                      product.batches.map((batch, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-4 py-2 font-medium text-gray-900">{batch.batchNumber || 'N/A'}</td>
                                          <td className="px-4 py-2 text-gray-900">{batch.currentStock || 0}</td>
                                          <td className="px-4 py-2 text-gray-900">
                                            {batch.receivedDate ? format(batch.receivedDate, 'MMM dd, yyyy') : 'N/A'}
                                          </td>
                                          <td className="px-4 py-2 text-gray-900">
                                            {batch.expirationDate ? format(batch.expirationDate, 'MMM dd, yyyy') : 'N/A'}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan="4" className="px-4 py-4 text-center text-gray-500">No batch information available</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                </Card>
                </>
              )}

              {selectedAnalyticsTab === 'anomalies' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Anomalies</p>
                          <p className="text-2xl font-bold text-gray-900">{anomalies.length}</p>
                          <p className="text-xs text-gray-500 mt-1">Detected issues</p>
                      </div>
                        <div className="p-3 bg-red-100 rounded-full">
                          <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                      </div>
                    </Card>
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Critical</p>
                          <p className="text-2xl font-bold text-red-600">
                            {anomalies.filter(a => a.severity === 'critical').length}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Urgent action</p>
                        </div>
                        <div className="p-3 bg-red-100 rounded-full">
                          <AlertCircle className="h-6 w-6 text-red-600" />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">High Priority</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {anomalies.filter(a => a.severity === 'high').length}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Needs attention</p>
                      </div>
                        <div className="p-3 bg-orange-100 rounded-full">
                          <AlertTriangle className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </Card>
                  </div>
                  <Card className="overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Inventory Anomalies</h3>
                    </div>
                    <div className="p-6">
                      {anomalies.length === 0 ? (
                        <div className="text-center py-12">
                          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                          <p className="text-gray-600">No anomalies detected - everything looks good!</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {anomalies.map((anomaly, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                      anomaly.severity === 'critical'
                                        ? 'bg-red-100 text-red-800'
                                        : anomaly.severity === 'high'
                                        ? 'bg-orange-100 text-orange-800'
                                        : anomaly.severity === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {anomaly.severity.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm text-gray-900">
                                      {anomaly.type.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm font-medium text-gray-900">
                                      {anomaly.productName || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm text-gray-700">{anomaly.description}</span>
                                    {anomaly.daysUntilExpiry !== undefined && (
                                      <div className="text-xs text-orange-600 mt-1">
                                        Expires in {anomaly.daysUntilExpiry} days
                </div>
              )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm text-gray-500">{anomaly.date || 'N/A'}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Eye className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Product Details</h2>
                    <p className="text-white/80 text-sm mt-1">{selectedProduct.name}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
              
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Product Name</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Brand</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.brand || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Category</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.category || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">UPC</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.sku || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Current Stock</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.currentStock || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Min Stock</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.minStock || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Max Stock</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.maxStock || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedProduct.status)}`}>
                    {selectedProduct.status || 'Unknown'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Usage Type</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedProduct.usageType === 'otc' 
                      ? 'bg-blue-100 text-blue-800' 
                      : selectedProduct.usageType === 'salon' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedProduct.usageType === 'otc' ? 'OTC' : selectedProduct.usageType === 'salon' ? 'Salon Use' : 'Unknown'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Unit Cost</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency((selectedProduct.unitCost || 0))}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">OTC Price</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency((selectedProduct.otcPrice || 0))}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Value</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(((selectedProduct.currentStock || 0) * (selectedProduct.unitCost || 0)))}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Supplier</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.supplier || '-'}</p>
                </div>
                {selectedProduct.description && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">Description</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedProduct.description}</p>
                  </div>
                )}
                {selectedProduct.location && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Location</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedProduct.location}</p>
                  </div>
                )}
                {selectedProduct.lastUpdated && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Last Updated</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(selectedProduct.lastUpdated, 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                )}
                {/* Service Mapping */}
                <div className="col-span-2 border-t pt-4 mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-purple-500" />
                    Service-Product Mapping
                  </p>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {services
                      .filter(service => service.productMappings && service.productMappings.some(mapping => mapping.productId === selectedProduct.id))
                      .map(service => {
                        const mapping = service.productMappings.find(m => m.productId === selectedProduct.id);
                        return (
                          <div key={service.id} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Scissors className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-medium text-gray-900">{service.name}</span>
                              </div>
                              <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                                {mapping.percentage}% usage
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>Quantity: {mapping.quantity} {mapping.unit}</div>
                              <div>Category: {service.category}</div>
                              {service.duration && <div>Duration: {service.duration} mins</div>}
                            </div>
                          </div>
                        );
                      })}
                    {services.filter(service => service.productMappings && service.productMappings.some(mapping => mapping.productId === selectedProduct.id)).length === 0 && (
                      <p className="text-sm text-gray-500 italic">No service mappings found for this product</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
              
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex justify-end">
              <Button
                onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="bg-[#160B53] text-white hover:bg-[#12094A]"
                >
                  Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* PURCHASE ORDERS MODALS */}
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
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColorPO(selectedOrder.status)}`}>
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
                    {selectedOrder.updatedByName && selectedOrder.updatedAt && selectedOrder.createdAt && (() => {
                      // Only show "Edited" if updatedAt is significantly different from createdAt (more than 1 minute)
                      try {
                        const updatedAt = selectedOrder.updatedAt.toDate ? selectedOrder.updatedAt.toDate() : new Date(selectedOrder.updatedAt);
                        const createdAt = selectedOrder.createdAt.toDate ? selectedOrder.createdAt.toDate() : new Date(selectedOrder.createdAt);
                        return Math.abs(updatedAt - createdAt) > 60000; // More than 1 minute difference
                      } catch {
                        return false;
                      }
                    })() && (
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
                      <p className="text-2xl font-bold text-[#160B53]">{formatCurrency((selectedOrder.totalAmount || 0))}</p>
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
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ordered Qty</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usage Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item, index) => {
                            return (
                              <tr key={index}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{item.productName}</div>
                                  {item.sku && (
                                    <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-gray-900 font-medium">{item.quantity || 0}</td>
                                <td className="px-4 py-3 text-gray-900">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    item.usageType === 'salon-use' 
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                    {item.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-900">{formatCurrency((item.unitPrice || 0))}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency((item.totalPrice || 0))}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-4 py-4 text-center text-gray-500">No items</td>
                          </tr>
                        )}
                      </tbody>
                      {selectedOrder.items && selectedOrder.items.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan="6" className="px-4 py-3 text-right font-semibold text-gray-900">Total:</td>
                            <td className="px-4 py-3 text-right font-bold text-[#160B53] text-lg">
                              {formatCurrency((selectedOrder.totalAmount || 0))}
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
              <div className="flex justify-end">
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
      
      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {activeTab === 'purchaseOrders' ? 'Purchase Order Filters' : 'Product Filters'}
                </h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {(() => {
                if (activeTab === 'purchaseOrders') {
                  return (
                    <div className="space-y-6">
                      {/* Sort Options */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4" />
                          Sort Options
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                            <select
                              value={sortColumnPO}
                              onChange={(e) => setSortColumnPO(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            >
                              <option value="createdAt">Date Created</option>
                              <option value="orderId">Order ID</option>
                              <option value="supplierName">Supplier</option>
                              <option value="orderDate">Order Date</option>
                              <option value="expectedDelivery">Expected Delivery</option>
                              <option value="status">Status</option>
                              <option value="totalAmount">Total Amount</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                            <select
                              value={sortDirectionPO}
                              onChange={(e) => setSortDirectionPO(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            >
                              <option value="desc">Newest First</option>
                              <option value="asc">Oldest First</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Basic Filters */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 border-b pb-2">Basic Filters</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                            <select
                              value={selectedStatusPO}
                              onChange={(e) => setSelectedStatusPO(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            >
                              <option value="all">All Status</option>
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="in_transit">In Transit</option>
                              <option value="delivered">Delivered</option>
                              <option value="rejected">Rejected</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                            <select
                              value={selectedSupplierFilter}
                              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            >
                              <option value="all">All Suppliers</option>
                              {suppliers.map(supplier => (
                                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                            <select
                              value={poCreatedBy}
                              onChange={(e) => setPoCreatedBy(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            >
                              <option value="all">All Users</option>
                              {[...new Set(purchaseOrders.map(po => po.createdBy).filter(Boolean))].map(userId => {
                                const order = purchaseOrders.find(po => po.createdBy === userId);
                                return (
                                  <option key={userId} value={userId}>
                                    {order?.createdByName || userId}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Date Range Filters */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 border-b pb-2">Date Range</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                            <input
                              type="date"
                              value={poDateFrom}
                              onChange={(e) => setPoDateFrom(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                            <input
                              type="date"
                              value={poDateTo}
                              onChange={(e) => setPoDateTo(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Amount Range Filters */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 border-b pb-2">Amount Range</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (₱)</label>
                            <input
                              type="number"
                              value={poMinAmount}
                              onChange={(e) => setPoMinAmount(e.target.value)}
                              placeholder="0"
                              min="0"
                              step="0.01"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (₱)</label>
                            <input
                              type="number"
                              value={poMaxAmount}
                              onChange={(e) => setPoMaxAmount(e.target.value)}
                              placeholder="∞"
                              min="0"
                              step="0.01"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#160B53] text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Active Filters Summary */}
                      {(selectedStatusPO !== 'all' || selectedSupplierFilter !== 'all' || poDateFrom || poDateTo || poMinAmount || poMaxAmount || poCreatedBy !== 'all') && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm text-blue-800 font-medium mb-2">Active Filters:</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedStatusPO !== 'all' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                Status: {selectedStatusPO}
                                <button onClick={() => setSelectedStatusPO('all')} className="ml-1 hover:text-blue-600">×</button>
                              </span>
                            )}
                            {selectedSupplierFilter !== 'all' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                Supplier: {suppliers.find(s => s.id === selectedSupplierFilter)?.name || selectedSupplierFilter}
                                <button onClick={() => setSelectedSupplierFilter('all')} className="ml-1 hover:text-blue-600">×</button>
                              </span>
                            )}
                            {poCreatedBy !== 'all' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                Created By: {purchaseOrders.find(po => po.createdBy === poCreatedBy)?.createdByName || poCreatedBy}
                                <button onClick={() => setPoCreatedBy('all')} className="ml-1 hover:text-blue-600">×</button>
                              </span>
                            )}
                            {poDateFrom && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                From: {poDateFrom}
                                <button onClick={() => setPoDateFrom('')} className="ml-1 hover:text-blue-600">×</button>
                              </span>
                            )}
                            {poDateTo && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                To: {poDateTo}
                                <button onClick={() => setPoDateTo('')} className="ml-1 hover:text-blue-600">×</button>
                              </span>
                            )}
                            {poMinAmount && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                Min: {formatCurrency(parseFloat(poMinAmount))}
                                <button onClick={() => setPoMinAmount('')} className="ml-1 hover:text-blue-600">×</button>
                              </span>
                            )}
                            {poMaxAmount && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                Max: {formatCurrency(parseFloat(poMaxAmount))}
                                <button onClick={() => setPoMaxAmount('')} className="ml-1 hover:text-blue-600">×</button>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Filters */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">Basic Information</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Categories</option>
                      {categories.filter(c => c !== 'all').map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Brands</option>
                      {[...new Set(products.map(p => p.brand).filter(Boolean))].sort().map(brand => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Suppliers</option>
                      {[...new Set(products.flatMap(p => p.suppliers?.map(s => s.name) || []).filter(Boolean))].sort().map(supplier => (
                        <option key={supplier} value={supplier}>{supplier}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Status</label>
                    <select
                      value={productStatus}
                      onChange={(e) => setProductStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </div>
                </div>
                
                {/* Stock Filters */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">Stock & Inventory</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Status</option>
                      <option value="In Stock">In Stock</option>
                      <option value="Low Stock">Low Stock</option>
                      <option value="Out of Stock">Out of Stock</option>
                      <option value="No Stock Data">No Stock Data</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
                      <input
                        type="number"
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock</label>
                      <input
                        type="number"
                        value={maxStock}
                        onChange={(e) => setMaxStock(e.target.value)}
                        placeholder="∞"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Alerts</label>
                    <select
                      value={stockAlerts}
                      onChange={(e) => setStockAlerts(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Products</option>
                      <option value="low_stock">Low Stock Alert</option>
                      <option value="overstock">Overstock Alert</option>
                      <option value="no_max_stock">No Max Stock Set</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Status</label>
                    <select
                      value={expiryFilter}
                      onChange={(e) => setExpiryFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Products</option>
                      <option value="has_expiry">Has Expiry Date</option>
                      <option value="expiring_soon">Expiring Soon (30 days)</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                </div>
                
                {/* Price Filters */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">Pricing & Value</h4>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Unit Cost</label>
                      <input
                        type="number"
                        value={minUnitCost}
                        onChange={(e) => setMinUnitCost(e.target.value)}
                        placeholder="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Unit Cost</label>
                      <input
                        type="number"
                        value={maxUnitCost}
                        onChange={(e) => setMaxUnitCost(e.target.value)}
                        placeholder="∞"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min OTC Price</label>
                      <input
                        type="number"
                        value={minOtcPrice}
                        onChange={(e) => setMinOtcPrice(e.target.value)}
                        placeholder="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max OTC Price</label>
                      <input
                        type="number"
                        value={maxOtcPrice}
                        onChange={(e) => setMaxOtcPrice(e.target.value)}
                        placeholder="∞"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Total Value</label>
                      <input
                        type="number"
                        value={minTotalValue}
                        onChange={(e) => setMinTotalValue(e.target.value)}
                        placeholder="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Total Value</label>
                      <input
                        type="number"
                        value={maxTotalValue}
                        onChange={(e) => setMaxTotalValue(e.target.value)}
                        placeholder="∞"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Mapping</label>
                    <select
                      value={hasServiceMapping}
                      onChange={(e) => setHasServiceMapping(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="all">All Products</option>
                      <option value="yes">Has Service Mapping</option>
                      <option value="no">No Service Mapping</option>
                    </select>
                  </div>
                </div>
                  </div>
                  </div>
                );
              }
            })()}
              
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeTab === 'purchaseOrders') {
                      // Clear purchase order filters
                      setSelectedStatusPO('all');
                      setSelectedSupplierFilter('all');
                      setPoDateFrom('');
                      setPoDateTo('');
                      setPoMinAmount('');
                      setPoMaxAmount('');
                      setPoCreatedBy('all');
                      // Reset sort to default (recent first)
                      setSortColumnPO('createdAt');
                      setSortDirectionPO('desc');
                    } else {
                      // Clear product filters
                      setSelectedCategory('all');
                      setSelectedBrand('all');
                      setSelectedSupplier('all');
                      setSelectedStatus('all');
                      setMinStock('');
                      setMaxStock('');
                      setMinUnitCost('');
                      setMaxUnitCost('');
                      setMinOtcPrice('');
                      setMaxOtcPrice('');
                      setMinTotalValue('');
                      setMaxTotalValue('');
                      setHasServiceMapping('all');
                      setStockAlerts('all');
                      setExpiryFilter('all');
                      setProductStatus('all');
                    }
                  }}
                  className="px-6"
                >
                  Clear All Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFilterModal(false)}
                  className="px-6"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {isConfirmApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Approve Purchase Order</h3>
                <p className="text-sm text-gray-600">Confirm approval of this purchase order</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to approve this purchase order? This will change its status to "Approved".
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsConfirmApproveModalOpen(false)}
                disabled={isProcessingApproval}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveOrder}
                disabled={isProcessingApproval}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isProcessingApproval ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reject Purchase Order</h3>
                <p className="text-sm text-gray-600">Provide a reason for rejection</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Please provide a reason for rejecting this purchase order..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={4}
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setSelectedOrder(null);
                  setRejectionNote('');
                }}
                disabled={isProcessingApproval}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectOrderConfirm}
                disabled={isProcessingApproval || !rejectionNote.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isProcessingApproval ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reject Modal */}
      {isConfirmRejectModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Rejection</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">Are you sure you want to reject this purchase order?</p>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Order:</strong> {selectedOrder.orderId || selectedOrder.id}<br />
                  <strong>Supplier:</strong> {selectedOrder.supplierName}<br />
                  <strong>Reason:</strong> {rejectionNote}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsConfirmRejectModalOpen(false)}
                disabled={isProcessingApproval}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectOrder}
                disabled={isProcessingApproval}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isProcessingApproval ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Confirm Rejection
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Import Products</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
    </div>
    
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Instructions:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Download the CSV template first</li>
                    <li>• Fill in your product data following the exact format</li>
                    <li>• Required fields: name, category, brand, unitCost, otcPrice</li>
                    <li>• Save as CSV and upload below</li>
                  </ul>
                </div>

                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => {
                      // TODO: Implement template download
                      toast.info('Template download will be implemented next');
                    }}
                    className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </button>

                  <button
                    onClick={() => {
                      // TODO: Implement file picker for import
                      setShowImportModal(false);
                      toast.info('File picker will be implemented next');
                    }}
                    className="w-full flex items-center justify-center px-4 py-2 bg-[#160B53] text-white rounded-lg hover:bg-[#12094A] transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Select CSV File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
);
};

export default Inventory;
