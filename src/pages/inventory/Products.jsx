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
  Edit,
  Plus,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllServices } from '../../services/serviceManagementService';
import { Scissors } from 'lucide-react';

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
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    supplier: 'all',
    priceRange: { min: '', max: '' },
    commissionRange: { min: '', max: '' }
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

  // Load products
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await productService.getAllProducts();
      if (result.success) {
        setProducts(result.products);
      } else {
        throw new Error(result.message || 'Failed to load products');
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
      commissionRange: { min: '', max: '' }
    });
    setSearchTerm('');
  };

  // Export products to CSV
  const exportProducts = () => {
    if (!filteredProducts.length) {
      alert('No products to export');
      return;
    }

    const headers = [
      'Name', 'Brand', 'Category', 'Description', 'UPC', 'SKU',
      'OTC Price', 'Salon Use Price', 'Unit Cost', 'Commission Percentage',
      'Status', 'Variants', 'Shelf Life', 'Suppliers'
    ];

    const csvRows = [
      headers.join(','),
      ...filteredProducts.map(product => {
        const suppliers = Array.isArray(product.suppliers) 
          ? product.suppliers.join('; ')
          : (product.supplier || '');
        
        return [
          `"${(product.name || '').replace(/"/g, '""')}"`,
          `"${(product.brand || '').replace(/"/g, '""')}"`,
          `"${(product.category || '').replace(/"/g, '""')}"`,
          `"${(product.description || '').replace(/"/g, '""')}"`,
          `"${(product.upc || '').replace(/"/g, '""')}"`,
          `"${(product.sku || '').replace(/"/g, '""')}"`,
          product.otcPrice || 0,
          product.salonUsePrice || 0,
          product.unitCost || 0,
          product.commissionPercentage || 0,
          `"${(product.status || '').replace(/"/g, '""')}"`,
          `"${(product.variants || '').replace(/"/g, '""')}"`,
          `"${(product.shelfLife || '').replace(/"/g, '""')}"`,
          `"${suppliers.replace(/"/g, '""')}"`
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
            sku: row.SKU || row.sku || '',
            otcPrice: parseFloat(row['OTC Price'] || row.otcPrice || 0),
            salonUsePrice: parseFloat(row['Salon Use Price'] || row.salonUsePrice || 0),
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
          <Button className="flex items-center gap-2 bg-[#160B53] hover:bg-[#12094A] text-white text-xs md:text-sm">
            <Plus className="h-4 w-4" />
            Add Product
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
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle md:px-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Brand
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Category
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                    UPC
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OTC Price
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Salon Use
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                    Unit Cost
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                    Commission
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Service Mapping
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div className="w-full h-full flex items-center justify-center" style={{ display: product.imageUrl ? 'none' : 'flex' }}>
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <div className="text-sm text-gray-900">{product.brand || 'N/A'}</div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    <div className="text-sm text-gray-900">{product.category || 'N/A'}</div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-sm text-gray-500">{product.upc || 'N/A'}</div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-green-600">₱{product.otcPrice?.toLocaleString() || '0'}</div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                    <div className="text-sm font-medium text-blue-600">₱{product.salonUsePrice?.toLocaleString() || '0'}</div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-sm text-gray-900">₱{product.unitCost?.toLocaleString() || '0'}</div>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                    <div className="text-sm text-gray-900">{product.commissionPercentage || 0}%</div>
                  </td>
                  <td className="px-3 md:px-6 py-4 hidden lg:table-cell">
                    {product.serviceProductMapping && Object.keys(product.serviceProductMapping).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(product.serviceProductMapping).map(([serviceId, minimumCost]) => {
                          const service = services.find(s => s.id === serviceId);
                          return (
                            <div key={serviceId} className="flex items-center gap-2 text-xs">
                              <Scissors className="w-3 h-3 text-purple-500 flex-shrink-0" />
                              <span className="text-gray-700 truncate">{service?.name || 'Unknown Service'}</span>
                              <span className="text-purple-600 font-medium">₱{parseFloat(minimumCost || 0).toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                      {getStatusIcon(product.status)}
                      {product.status}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(product)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </Card>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || Object.values(filters).some(f => f !== 'all' && (typeof f === 'object' ? Object.values(f).some(v => v !== '') : f !== ''))
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first product'
            }
          </p>
          <Button className="flex items-center gap-2 mx-auto bg-[#160B53] hover:bg-[#12094A] text-white">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
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
                <p className="text-sm text-gray-500">UPC: {selectedProduct.upc}</p>
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
                  <label className="text-sm font-medium text-gray-500">Salon Use Price</label>
                  <p className="text-lg font-semibold text-blue-600 mt-1">₱{selectedProduct.salonUsePrice?.toLocaleString() || '0'}</p>
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

            {/* Service Mapping */}
            {selectedProduct.serviceProductMapping && Object.keys(selectedProduct.serviceProductMapping).length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-purple-500" />
                  Service-Product Mapping (Minimum Cost)
                </h3>
                <div className="space-y-2">
                  {Object.entries(selectedProduct.serviceProductMapping).map(([serviceId, minimumCost]) => {
                    const service = services.find(s => s.id === serviceId);
                    return (
                      <div key={serviceId} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Scissors className="w-4 h-4 text-purple-500" />
                          <span className="text-sm font-medium text-gray-900">{service?.name || 'Unknown Service'}</span>
                        </div>
                        <span className="text-sm font-semibold text-purple-600">₱{parseFloat(minimumCost || 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
          'Name', 'Brand', 'Category', 'Description', 'UPC', 'SKU',
          'OTC Price', 'Salon Use Price', 'Unit Cost', 'Commission Percentage',
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
            SKU: 'PRD-LOR-SHA-1234',
            'OTC Price': '850',
            'Salon Use Price': '650',
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
          'Salon Use Price': { type: 'number' },
          'Unit Cost': { type: 'number' }
        }}
        title="Import Products"
      />
    </div>
  );
};

export default Products;

