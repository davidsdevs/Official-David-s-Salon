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
  ChevronRight
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
    showServiceMapped: true // Default to showing service-mapped products
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
      showServiceMapped: true
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

    // Create a beautiful PDF-friendly HTML content with Poppins font
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Products Report - ${branchName}</title>
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
              font-size: 32px;
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
            .stats {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
              margin-bottom: 30px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 8px;
              border: 1px solid #ccc;
            }
            .stat-box {
              text-align: center;
              padding: 15px;
              background: white;
              border-radius: 6px;
              border: 1px solid #999;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .stat-value {
              font-size: 24px;
              font-weight: 700;
              color: #000;
              font-family: 'Poppins', sans-serif;
              margin-bottom: 5px;
            }
            .stat-label {
              font-size: 11px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 600;
              font-family: 'Poppins', sans-serif;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
              font-size: 10px;
              font-family: 'Poppins', sans-serif;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            th, td {
              border: 1px solid #e9ecef;
              padding: 10px 8px;
              text-align: left;
              vertical-align: middle;
            }
            th {
              background: #000;
              color: white;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-size: 9px;
              font-family: 'Poppins', sans-serif;
              position: sticky;
              top: 0;
              z-index: 10;
              border: 1px solid #666;
            }
            tbody tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            tbody tr:nth-child(odd) {
              background-color: #ffffff;
            }
            tbody tr:hover {
              background-color: #e3f2fd;
            }
            .status-active {
              color: #000;
              font-weight: 700;
              font-family: 'Poppins', sans-serif;
            }
            .status-inactive {
              color: #666;
              font-weight: 700;
              font-family: 'Poppins', sans-serif;
            }
            .status-discontinued {
              color: #999;
              font-weight: 700;
              font-family: 'Poppins', sans-serif;
            }
            .product-type {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 12px;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-family: 'Poppins', sans-serif;
              background: #e0e0e0;
              color: #000;
              border: 1px solid #999;
            }
            .price-otc {
              color: #000;
              font-weight: 700;
              font-family: 'Poppins', sans-serif;
            }
            .image-cell {
              width: 35px;
              text-align: center;
            }
            .image-cell img {
              width: 28px;
              height: 28px;
              object-fit: cover;
              border-radius: 4px;
              border: 1px solid #e9ecef;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #000;
              font-size: 9px;
              color: #333;
              text-align: center;
              font-family: 'Poppins', sans-serif;
              background: #f0f0f0;
              padding: 15px;
              border-radius: 4px;
            }
            .image-cell {
              width: 40px;
              text-align: center;
            }
            .image-cell img {
              width: 32px;
              height: 32px;
              object-fit: cover;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="font-family: 'Poppins', sans-serif; font-size: 36px; font-weight: 700; margin-bottom: 5px; color: #000;">Products Catalog Report</h1>
            <div style="font-size: 14px; color: #333; font-weight: 500;">Professional Inventory Report</div>
            <div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border: 1px solid #ccc; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #000;">
                <div><strong>Branch:</strong> ${branchName}</div>
                <div><strong>Generated by:</strong> ${userData?.name || 'System User'}</div>
                <div><strong>Date:</strong> ${format(new Date(), 'MMM dd, yyyy HH:mm')}</div>
              </div>
            </div>
          </div>

          <div class="stats">
            <div class="stat-box">
              <div class="stat-value">${filteredProducts.length}</div>
              <div class="stat-label">Total Products</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${filteredProducts.filter(p => p.status === 'Active').length}</div>
              <div class="stat-label">Active Products</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${filteredProducts.filter(p => p.hasServiceMapping).length}</div>
              <div class="stat-label">Service Mapped</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${[...new Set(filteredProducts.map(p => p.category).filter(Boolean))].length}</div>
              <div class="stat-label">Categories</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">Image</th>
                <th>Product Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Type</th>
                <th>UPC</th>
                <th>Price</th>
                <th>Unit Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.map(product => `
                <tr>
                  <td class="image-cell">
                    ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}" />` : '📦'}
                  </td>
                  <td style="font-weight: 600; color: #160B53;">${product.name || 'N/A'}</td>
                  <td>${product.brand || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td>
                    <span class="product-type ${product.isBranchProduct ? 'branch-product' : 'service-mapped'}">
                      ${product.isBranchProduct ? 'Branch' : 'Service'}
                    </span>
                  </td>
                  <td style="font-family: monospace;">${product.upc || 'N/A'}</td>
                  <td class="price-otc">₱${(product.otcPrice || 0).toLocaleString()}</td>
                  <td>₱${(product.unitCost || 0).toLocaleString()}</td>
                  <td class="status-${product.status?.toLowerCase() || 'active'}">${product.status || 'Active'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p><strong>Generated by:</strong> ${userData?.name || 'Inventory Controller'} | <strong>Date:</strong> ${format(new Date(), 'MMMM dd, yyyy')}</p>
            <p>This professional report is for branch management and inventory control purposes.</p>
          </div>
        </body>
      </html>
    `;

    // Open PDF-friendly print preview window and automatically trigger print dialog
    const printWindow = window.open('', '_blank', 'width=1200,height=900,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      toast.error('Please allow pop-ups to generate the PDF report');
      return;
    }

    printWindow.document.write(printContent);
    printWindow.document.close();

    // Automatically trigger print dialog after content loads
    printWindow.onload = function() {
      // Add a subtle loading message that disappears when print dialog opens
      const loadingMsg = printWindow.document.createElement('div');
      loadingMsg.innerHTML = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.95);
          color: #000;
          padding: 20px 30px;
          border-radius: 10px;
          font-family: 'Poppins', sans-serif;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          border: 2px solid #000;
        ">
          <div style="margin-bottom: 10px;">📄 Preparing PDF Report...</div>
          <div style="font-size: 12px; color: #666; font-weight: 400;">Print dialog will open automatically</div>
        </div>
      `;
      printWindow.document.body.appendChild(loadingMsg);

      // Small delay to ensure content is fully rendered, then trigger print
      setTimeout(() => {
        // Hide loading message
        loadingMsg.style.display = 'none';

        // Trigger the browser's print dialog
        printWindow.print();
      }, 800);
    };

    // Auto-close after printing
    printWindow.onafterprint = function() {
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.close();
        }
      }, 1000);
    };

    // Fallback: close after 30 seconds if user doesn't print
    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.close();
      }
    }, 30000);

    toast.success('PDF report generated - print dialog will open automatically');
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
        { key: 'shelfLife', label: 'Shelf Life' },
        { key: 'suppliers', label: 'Suppliers' }
      ];

      // Prepare data with formatted suppliers and additional fields
      const exportData = filteredProducts.map(product => {
        const suppliers = Array.isArray(product.suppliers)
          ? product.suppliers.join('; ')
          : (product.supplier || '');

        return {
          ...product,
          imageUrl: product.imageUrl || '',
          suppliers: suppliers,
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm md:text-base text-gray-600">Manage your product inventory and details</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <Button
            variant="outline"
            className="flex items-center gap-2 text-xs md:text-sm"
            onClick={handlePrintReport}
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">PDF Report</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-xs md:text-sm"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-xs md:text-sm"
            onClick={exportProducts}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search products by name, brand, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2 md:gap-3 flex-wrap">
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Discontinued">Discontinued</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.showServiceMapped}
                onChange={(e) => setFilters(prev => ({ ...prev, showServiceMapped: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show products with service mapping
            </label>
            <Button
              variant="outline"
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              More Filters
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand & Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price & Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status & Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  {/* Product Info */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-12 w-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div className="h-full w-full flex items-center justify-center" style={{ display: product.imageUrl ? 'none' : 'flex' }}>
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 line-clamp-1 max-w-xs">
                          {product.name}
                        </div>
                        <div className="text-sm text-gray-500">{product.upc || 'No UPC'}</div>
                        {product.hasServiceMapping && (
                          <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            <Scissors className="w-3 h-3 mr-1" />
                            Used in Services
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Brand & Category */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.brand || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{product.category || 'N/A'}</div>
                  </td>

                  {/* Pricing */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Price:</span>
                        <span className="font-medium text-green-600">₱{product.otcPrice?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Cost:</span>
                        <span className="text-gray-700">₱{product.unitCost?.toLocaleString() || '0'}</span>
                      </div>
                    </div>
                  </td>

                  {/* Status & Type */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="space-y-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                        {getStatusIcon(product.status)}
                        {product.status || 'Active'}
                      </span>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3 text-green-600" />
                          <span>Branch Product</span>
                        </div>
                        {product.hasServiceMapping && (
                          <div className="flex items-center gap-1 text-purple-600">
                            <Scissors className="w-3 h-3" />
                            <span>Service Mapped</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(product)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(endIndex, filteredProducts.length)}</span> of{' '}
              <span className="font-medium">{filteredProducts.length}</span> products
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm text-gray-600">
                Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
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
                  <label className="text-sm font-medium text-gray-500">Supplier</label>
                  <p className="text-gray-900 mt-1">
                    {Array.isArray(selectedProduct.suppliers) 
                      ? selectedProduct.suppliers.join(', ')
                      : (selectedProduct.supplier || 'N/A')}
                  </p>
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
              
              <div>
                <label className="text-sm font-medium text-gray-500">Branches</label>
                <p className="text-gray-900 mt-1">{selectedProduct.branches?.length || 0} branch(es)</p>
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

      {/* Advanced Filters Modal */}
      {isFilterModalOpen && (
        <Modal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          title="Advanced Filters"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
              <select
                value={filters.supplier}
                onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Suppliers</option>
                {suppliers.filter(s => uniqueSupplierIds.includes(s.id)).map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>

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

            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showServiceMapped}
                  onChange={(e) => setFilters(prev => ({ ...prev, showServiceMapped: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">Show products with service mapping</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">Include products that are used in services even if not directly offered by this branch</p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setIsFilterModalOpen(false)} className="bg-[#160B53] hover:bg-[#12094A] text-white">
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

