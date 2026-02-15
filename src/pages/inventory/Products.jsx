// src/pages/inventory/Products.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import ImportModal from '../../components/ImportModal';
import { productService } from '../../services/productService';
import {
  Package,
  Filter,
  Eye,
  Plus,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllServices } from '../../services/serviceManagementService';
import { Scissors } from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';

const Products = () => {
  const { userData } = useAuth();
  
  // Data states
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // For mapping supplier IDs to names
  const [services, setServices] = useState([]); // For mapping service IDs to names
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // 5 products per row × 4 rows = 20 products per page
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    supplier: 'all',
    priceRange: { min: '', max: '' },
    commissionRange: { min: '', max: '' },
    showServiceMapped: false // Default to not showing service-mapped products
  });

  // Load suppliers
  const loadSuppliers = async () => {
    try {
      const suppliersRef = collection(db, 'suppliers');
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = [];
      snapshot.forEach((doc) => {
        suppliersList.push({
          id: doc.id,
          name: doc.data().name || 'Unknown Supplier',
          ...doc.data()
        });
      });
      setSuppliers(suppliersList);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  // Load products - flexible filtering for branch products and service-mapped products
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const [productsResult, servicesResult] = await Promise.all([
        productService.getBranchProducts(userData?.branchId),
        getAllServices()
      ]);

      if (productsResult.success) {
        let allProducts = productsResult.products;

        // Get products that are used in services (service mappings)
        const serviceMappedProductIds = new Set();
        if (servicesResult && Array.isArray(servicesResult)) {
          console.log(`🔍 Processing ${servicesResult.length} services for product mappings`);
          console.log('📋 Services loaded:', servicesResult.map(s => ({ id: s.id, name: s.name, mappingsCount: s.productMappings?.length || 0 })));

          servicesResult.forEach(service => {
            console.log(`🔎 Checking service: ${service.name} (${service.id})`);
            if (service.productMappings && Array.isArray(service.productMappings)) {
              console.log(`  📦 Service ${service.name} has ${service.productMappings.length} product mappings:`);
              service.productMappings.forEach((mapping, index) => {
                console.log(`    ${index + 1}. ${mapping.productName || 'Unknown'} (${mapping.productId || 'No ID'})`);
                if (mapping.productId) {
                  serviceMappedProductIds.add(mapping.productId);
                  console.log(`       ✅ Added to service-mapped products: ${mapping.productId}`);
                } else {
                  console.log(`       ❌ Missing productId for mapping`);
                }
              });
            } else {
              console.log(`  ❌ Service ${service.name} has no productMappings array`);
            }
          });
          console.log(`✅ Total service-mapped products found: ${serviceMappedProductIds.size}`);
          console.log('🎯 Service-mapped product IDs:', Array.from(serviceMappedProductIds));
        } else {
          console.log('❌ No services loaded or servicesResult is not an array');
        }

        // Since we already filtered to only branch products, we just need to handle service mapping checkbox
        // If checkbox is checked, add any additional service-mapped products not already included
        let filteredProducts = allProducts;

        if (filters.showServiceMapped) {
          // When checkbox is checked, show ONLY products with service mappings
          filteredProducts = allProducts.filter(product => {
            const hasServiceMapping = serviceMappedProductIds.has(product.id);
            return hasServiceMapping;
          });
          console.log(`🎯 Service mapping checkbox is checked - showing ${filteredProducts.length} products with service mappings`);
        } else {
          // When checkbox is unchecked, show all branch products
          filteredProducts = allProducts;
          console.log(`📦 Service mapping checkbox is unchecked - showing ${allProducts.length} branch products`);
        }

        console.log(`📊 Branch products loaded: ${allProducts.length} (Branch: ${userData?.branchId})`);
        console.log(`🔍 Service mapping filter: ${filters.showServiceMapped ? 'ENABLED' : 'DISABLED'}`);
        console.log(`✅ Final display: ${filteredProducts.length} products`);

        // Add service mapping info to products
        const productsWithServiceInfo = filteredProducts.map(product => {
          const hasServiceMapping = serviceMappedProductIds.has(product.id);
          // All products from getBranchProducts are already branch products
          const isBranchProduct = true;

          console.log(`🏷️ Branch Product: ${product.name} (${product.id}) - Service Mapped: ${hasServiceMapping}`);

          return {
            ...product,
            hasServiceMapping,
            isBranchProduct
          };
        });

        setProducts(productsWithServiceInfo);
      } else {
        throw new Error(productsResult.message || 'Failed to load products');
      }
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load services
  const loadServices = async () => {
    try {
      const servicesList = await getAllServices();
      setServices(servicesList);
    } catch (err) {
      console.error('Error loading services:', err);
    }
  };

  // Load products and suppliers on mount
  useEffect(() => {
    loadSuppliers();
    loadServices();
    loadProducts();
  }, []);

  // Reload products when service mapping filter changes
  useEffect(() => {
    console.log(`🔄 Service mapping filter changed: ${filters.showServiceMapped}`);
    loadProducts();
  }, [filters.showServiceMapped]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortBy, sortOrder]);

  // Get unique categories
  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
  
  // Get unique supplier IDs from products (for filter dropdown)
  // Get unique supplier IDs from products (handling both array and single supplier)
  const uniqueSupplierIds = [...new Set(products.flatMap(p => {
    if (Array.isArray(p.suppliers)) {
      return p.suppliers;
    }
    return p.supplier ? [p.supplier] : [];
  }))].filter(Boolean);

  // Filter and sort products
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filters.category === 'all' || product.category === filters.category;
      const matchesStatus = filters.status === 'all' || product.status === filters.status;
      const matchesSupplier = filters.supplier === 'all' || (() => {
        // Check if suppliers is an array and contains the filter supplier ID
        if (Array.isArray(product.suppliers)) {
          return product.suppliers.includes(filters.supplier);
        }
        // Fallback for old data structure (single supplier)
        return product.supplier === filters.supplier;
      })();
      
      const matchesPriceRange = (!filters.priceRange.min || product.otcPrice >= parseFloat(filters.priceRange.min)) &&
                               (!filters.priceRange.max || product.otcPrice <= parseFloat(filters.priceRange.max));
      
      const matchesCommissionRange = (!filters.commissionRange.min || product.commissionPercentage >= parseFloat(filters.commissionRange.min)) &&
                                    (!filters.commissionRange.max || product.commissionPercentage <= parseFloat(filters.commissionRange.max));
      
      return matchesSearch && matchesCategory && matchesStatus && matchesSupplier && matchesPriceRange && matchesCommissionRange;
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

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Handle product details
  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  // Handle filter reset
  const resetFilters = () => {
    setFilters({
      category: 'all',
      status: 'all',
      supplier: 'all',
      priceRange: { min: '', max: '' },
      commissionRange: { min: '', max: '' },
      showServiceMapped: false
    });
    setSearchTerm('');
  };

  // Print/Report function for branch manager viewing
  const handlePrintReport = async () => {
    if (!filteredProducts.length) {
      toast.error('No products to print');
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
    if (filters.category !== 'all') activeFilters.push(`Category: ${filters.category}`);
    if (filters.supplier !== 'all') {
      const supplier = suppliers.find(s => s.id === filters.supplier);
      if (supplier) activeFilters.push(`Supplier: ${supplier.name}`);
    }
    if (filters.status !== 'all') activeFilters.push(`Status: ${filters.status}`);
    if (filters.showServiceMapped) activeFilters.push('Service Mapped Only');
    const filtersText = activeFilters.length > 0 ? activeFilters.join(' | ') : 'All Products';

    // Create standardized print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Products Report - ${branchName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 landscape;
              margin: 0.4in 0.4in 0.75in 0.4in;
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
              background: #fff;
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
              background-color: #fff;
            }
            tr:nth-child(odd) {
              background-color: #fff;
            }
            .text-right { text-align: right; }
            
            @media print {
              .footer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 10px 0.4in;
                border-top: 2px solid #333;
                font-size: 8px;
                background: white;
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
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAVID'S SALON</h1>
            <h2>Products Report - ${branchName}</h2>
          </div>
          
          <div class="filters">
            <div class="filters-title">FILTERS APPLIED</div>
            <div class="filters-content">${filtersText}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>UPC</th>
                <th>Description</th>
                <th class="text-right">OTC Price</th>
                <th class="text-right">Unit Cost</th>
                <th class="text-right">Commission %</th>
                <th>Status</th>
                <th>Type</th>
                <th>Service Mapped</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.map(product => `
                <tr>
                  <td style="font-weight: 600;">${product.name || 'N/A'}</td>
                  <td>${product.brand || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td style="font-family: monospace; font-size: 8px;">${product.upc || 'N/A'}</td>
                  <td style="font-size: 8px;">${product.description || 'N/A'}</td>
                  <td class="text-right">₱${(product.otcPrice || 0).toLocaleString()}</td>
                  <td class="text-right">₱${(product.unitCost || 0).toLocaleString()}</td>
                  <td class="text-right">${product.commissionPercentage || 0}%</td>
                  <td>${product.status || 'Active'}</td>
                  <td style="font-size: 8px;">${product.isBranchProduct ? 'Branch Product' : product.type || 'N/A'}</td>
                  <td>${product.hasServiceMapping ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
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
              <p style="font-weight: 600; font-size: 9px;">Products Report</p>
              <p>${filteredProducts.length} Products Total</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Open print preview window
    const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      toast.error('Please allow pop-ups to generate the PDF report');
      return;
    }

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);

    toast.success('Opening print preview...');
  };

  // Export products to Excel
  const exportProducts = () => {
    if (!filteredProducts.length) {
      toast.error('No products to export');
      return;
    }

    try {
      const headers = [
        { key: 'imageUrl', label: 'Image URL' },
        { key: 'name', label: 'Name' },
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category' },
        { key: 'description', label: 'Description' },
        { key: 'upc', label: 'UPC' },
        { key: 'otcPrice', label: 'Price (₱)' },
        { key: 'unitCost', label: 'Unit Cost (₱)' },
        { key: 'commissionPercentage', label: 'Commission Percentage (%)' },
        { key: 'status', label: 'Status' },
        { key: 'productType', label: 'Product Type' },
        { key: 'hasServiceMapping', label: 'Used in Services' },
        { key: 'variants', label: 'Variants' },
        { key: 'shelfLife', label: 'Shelf Life' }
      ];

      // Prepare data with formatted suppliers and additional fields
      const exportData = filteredProducts.map(product => {
        return {
          ...product,
          imageUrl: product.imageUrl || '',
          otcPrice: product.otcPrice || 0,
          unitCost: product.unitCost || 0,
          commissionPercentage: product.commissionPercentage || 0,
          productType: product.isBranchProduct ? 'Branch Product' : 'Service Mapped',
          hasServiceMapping: product.hasServiceMapping ? 'Yes' : 'No'
        };
      });

      exportToExcel(exportData, 'products_export', 'Products', headers);
      toast.success('Products exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting products:', error);
      toast.error('Failed to export products');
    }
  };

  // Handle import
  const handleImport = async (data) => {
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const row of data) {
        try {
          // Map CSV columns to product data structure
          const productData = {
            name: row.Name || row.name || '',
            brand: row.Brand || row.brand || '',
            category: row.Category || row.category || '',
            description: row.Description || row.description || '',
            upc: row.UPC || row.upc || '',
            otcPrice: parseFloat(row['OTC Price'] || row.otcPrice || 0),
            unitCost: parseFloat(row['Unit Cost'] || row.unitCost || 0),
            commissionPercentage: parseFloat(row['Commission Percentage'] || row.commissionPercentage || 0),
            status: row.Status || row.status || 'Active',
            variants: row.Variants || row.variants || '',
            shelfLife: row['Shelf Life'] || row.shelfLife || '',
            suppliers: row.Suppliers ? row.Suppliers.split(';').map(s => s.trim()).filter(Boolean) : []
          };

          // Validate required fields
          if (!productData.name) {
            throw new Error('Name is required');
          }

          // Create product
          const result = await productService.createProduct(productData);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Row ${data.indexOf(row) + 2}: ${result.message || 'Failed to create'}`);
          }
        } catch (err) {
          errorCount++;
          errors.push(`Row ${data.indexOf(row) + 2}: ${err.message}`);
        }
      }

      // Reload products
      await loadProducts();

      if (errorCount > 0) {
        return {
          success: false,
          error: `Imported ${successCount} products. ${errorCount} errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''}`
        };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
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
      case 'Discontinued': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading products...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Products</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadProducts} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-600">Manage your product inventory and details</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{filteredProducts.length}</p>
              <p className="text-xs text-gray-500 mt-1">of {products.length} total</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Products</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {filteredProducts.filter(p => p.status === 'Active').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive Products</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {filteredProducts.filter(p => p.status === 'Inactive' || p.status === 'Discontinued').length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Categories</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {[...new Set(filteredProducts.map(p => p.category).filter(Boolean))].length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
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
            onClick={() => setIsFilterModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors relative ${
              (filters.category !== 'all' || filters.status !== 'all' || filters.supplier !== 'all' || 
               filters.priceRange.min || filters.priceRange.max || filters.commissionRange.min || 
               filters.commissionRange.max || !filters.showServiceMapped)
                ? 'bg-[#160B53]/10 border-[#160B53]/30 text-[#160B53] hover:bg-[#160B53]/20'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            title={`Filter - ${filteredProducts.length} products`}
          >
            <Filter className="w-5 h-5" />
            <span className="bg-[#160B53] text-white text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
              {filteredProducts.length}
            </span>
          </button>

          {/* Export Button */}
          <button
            onClick={exportProducts}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Export Products Data"
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
        </div>
      </div>

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '2000px' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Product Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Brand
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  UPC
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  OTC Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Unit Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Commission %
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Variants
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Shelf Life
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Service Mapped
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  {/* Product Name */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.name || 'N/A'}</div>
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.brand || 'N/A'}</div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.category || 'N/A'}</div>
                  </td>

                  {/* UPC */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.upc || 'N/A'}</div>
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={product.description || 'N/A'}>
                      {product.description || 'N/A'}
                    </div>
                  </td>

                  {/* OTC Price */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-green-600">₱{product.otcPrice?.toLocaleString() || '0'}</div>
                  </td>

                  {/* Unit Cost */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">₱{product.unitCost?.toLocaleString() || '0'}</div>
                  </td>

                  {/* Commission Percentage */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.commissionPercentage || 0}%</div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                      {getStatusIcon(product.status)}
                      {product.status || 'Active'}
                    </span>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {product.isBranchProduct ? 'Branch Product' : product.type || 'N/A'}
                    </div>
                  </td>

                  {/* Variants */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.variants || 'N/A'}</div>
                  </td>

                  {/* Shelf Life */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.shelfLife || 'N/A'}</div>
                  </td>

                  {/* Service Mapped */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {product.hasServiceMapping ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <Scissors className="w-3 h-3" />
                        <span>Yes</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(product)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      title="View product details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 md:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 pt-3 md:pt-4 px-2 md:px-4">
            <div className="text-xs md:text-sm text-gray-600 text-center sm:text-left">
              Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(endIndex, filteredProducts.length)}</span> of{' '}
              <span className="font-medium">{filteredProducts.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 text-xs md:text-sm px-2 md:px-3"
              >
                <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <div className="text-xs md:text-sm text-gray-600">
                <span className="font-medium">{currentPage}</span>/<span className="font-medium">{totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 text-xs md:text-sm px-2 md:px-3"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || Object.values(filters).some(f => f !== 'all' && (typeof f === 'object' ? Object.values(f).some(v => v !== '') : f !== ''))
              ? 'Try adjusting your search or filters'
              : 'No products are available to this branch'
            }
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
                <p className="text-sm text-gray-500">UPC: {selectedProduct.upc || 'N/A'}</p>
              </div>
            </div>

            {/* Product Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900 mt-1">{selectedProduct.description}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-gray-900 mt-1">{selectedProduct.category}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Variants</label>
                  <p className="text-gray-900 mt-1">{selectedProduct.variants || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">OTC Price</label>
                  <p className="text-lg font-semibold text-green-600 mt-1">₱{selectedProduct.otcPrice?.toLocaleString() || '0'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Service Product Mapping</label>
                  {(() => {
                    // Find all services that have this product in their productMappings
                    const mappedServices = services.filter(service => {
                      if (!service.productMappings || !Array.isArray(service.productMappings)) {
                        return false;
                      }
                      return service.productMappings.some(mapping =>
                        mapping.productId === selectedProduct.id
                      );
                    });

                    console.log(`🔍 Service mappings for ${selectedProduct.name} (${selectedProduct.id}):`);
                    console.log(`  - Total services loaded: ${services.length}`);
                    console.log(`  - Services with product mappings: ${services.filter(s => s.productMappings?.length > 0).length}`);
                    console.log(`  - Mapped services found: ${mappedServices.length}`, mappedServices.map(s => s.name));

                    if (mappedServices.length > 0) {
                      return (
                        <div className="mt-2 space-y-1">
                          {mappedServices.map((service) => (
                            <div key={service.id} className="flex items-center gap-2">
                              <Scissors className="w-4 h-4 text-purple-500 flex-shrink-0" />
                              <span className="text-gray-900">{service.name || 'Unknown Service'}</span>
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      return (
                        <p className="text-gray-500 mt-1 text-sm">
                          {services.length === 0 ? 'Loading services...' : 'No services mapped'}
                        </p>
                      );
                    }
                  })()}
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Unit Cost</label>
                  <p className="text-lg font-semibold text-gray-900 mt-1">₱{selectedProduct.unitCost?.toLocaleString() || '0'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Commission</label>
                  <p className="text-lg font-semibold text-purple-600 mt-1">{selectedProduct.commissionPercentage || 0}%</p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Shelf Life</label>
                <p className="text-gray-900 mt-1">{selectedProduct.shelfLife || 'N/A'}</p>
              </div>
            </div>

            {/* Service Mapping Details */}
            {(() => {
              // Find all services that have this product in their productMappings
              const mappedServices = services.filter(service => {
                if (!service.productMappings || !Array.isArray(service.productMappings)) {
                  return false;
                }
                return service.productMappings.some(mapping => 
                  mapping.productId === selectedProduct.id
                );
              });

              if (mappedServices.length > 0) {
                return (
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-purple-500" />
                      Service-Product Mapping Details
                    </h3>
                    <div className="space-y-2">
                      {mappedServices.map((service) => {
                        const productMapping = service.productMappings.find(m => m.productId === selectedProduct.id);
                        return (
                          <div key={service.id} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Scissors className="w-4 h-4 text-purple-500" />
                              <span className="text-sm font-medium text-gray-900">{service.name || 'Unknown Service'}</span>
                            </div>
                            {productMapping?.instructions && Array.isArray(productMapping.instructions) && productMapping.instructions.length > 0 ? (
                              <div className="ml-6 space-y-1">
                                {productMapping.instructions.map((instruction, idx) => (
                                  <div key={idx} className="text-xs text-gray-600">
                                    {instruction.instruction}: {instruction.quantity} {instruction.unit} @ {instruction.percentage}%
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Timestamps */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Created:</span> {format(new Date(selectedProduct.createdAt), 'MMM dd, yyyy HH:mm')}
                </div>
                <div>
                  <span className="font-medium">Updated:</span> {format(new Date(selectedProduct.updatedAt), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <Modal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          title="Filter Products"
          size="md"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
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

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>

              {/* Supplier Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                <select
                  value={filters.supplier}
                  onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="all">All Suppliers</option>
                  {suppliers.filter(s => uniqueSupplierIds.includes(s.id)).map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Min Price"
                  value={filters.priceRange.min}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    priceRange: { ...prev.priceRange, min: e.target.value }
                  }))}
                />
                <Input
                  type="number"
                  placeholder="Max Price"
                  value={filters.priceRange.max}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    priceRange: { ...prev.priceRange, max: e.target.value }
                  }))}
                />
              </div>
            </div>

              {/* Commission Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commission Range</label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Min %"
                  value={filters.commissionRange.min}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    commissionRange: { ...prev.commissionRange, min: e.target.value }
                  }))}
                />
                <Input
                  type="number"
                  placeholder="Max %"
                  value={filters.commissionRange.max}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    commissionRange: { ...prev.commissionRange, max: e.target.value }
                  }))}
                />
              </div>
            </div>

              {/* Service Mapped Checkbox */}
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.showServiceMapped}
                    onChange={(e) => setFilters(prev => ({ ...prev, showServiceMapped: e.target.checked }))}
                    className="rounded border-gray-300 text-[#160B53] focus:ring-[#160B53]"
                  />
                  <span className="font-medium text-gray-700">Show products with service mapping</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Include products that are used in services even if not directly offered by this branch</p>
              </div>
            </div>

            {/* Results Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Filtered Results:</span>
                <span className="font-semibold text-[#160B53]">{filteredProducts.length} of {products.length} products</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={resetFilters}
                className="flex-1"
              >
                Clear Filters
              </Button>
              <Button
                onClick={() => setIsFilterModalOpen(false)}
                className="flex-1 bg-[#160B53] hover:bg-[#12094A] text-white"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
        templateColumns={[
          'Name', 'Brand', 'Category', 'Description', 'UPC',
          'Price', 'Unit Cost', 'Commission Percentage',
          'Status', 'Variants', 'Shelf Life', 'Suppliers'
        ]}
        templateName="products"
        sampleData={[
          {
            Name: 'Professional Shampoo',
            Brand: 'L\'Oreal',
            Category: 'Hair Care',
            Description: 'Professional salon shampoo',
            UPC: '123456789012',
            'OTC Price': '850',
            'Unit Cost': '450',
            'Commission Percentage': '15',
            Status: 'Active',
            Variants: '500ml',
            'Shelf Life': '24 months',
            Suppliers: 'Supplier1; Supplier2'
          }
        ]}
        validationRules={{
          Name: { required: true },
          Brand: { required: true },
          Category: { required: true },
          'OTC Price': { type: 'number' },
          'Unit Cost': { type: 'number' }
        }}
        title="Import Products"
      />
    </div>
  );
};

export default Products;

