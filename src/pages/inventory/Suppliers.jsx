// src/pages/06_InventoryController/Suppliers.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import {
  Building,
  Filter,
  Eye,
  Plus,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Package,
  Star,
  Users,
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { productService } from '../../services/productService';
import { toast } from 'react-hot-toast';

const Suppliers = () => {
  const { userData } = useAuth();

  
  
  // Data states
  const [suppliers, setSuppliers] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState({}); // { supplierId: [products] }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    rating: 'all',
    paymentTerms: 'all'
  });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    category: '',
    paymentTerms: '',
    rating: 5,
    notes: '',
    isActive: true
  });

  // Load suppliers from Firestore
  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const suppliersRef = collection(db, 'suppliers');
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        suppliersList.push({
          id: doc.id,
          name: data.name || 'Unknown Supplier',
          contactPerson: data.contactPerson || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          website: data.website || '',
          category: data.category || '',
          paymentTerms: data.paymentTerms || '',
          rating: data.rating || 0,
          notes: data.notes || '',
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        });
      });
      
      // Sort by name
      suppliersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      setSuppliers(suppliersList);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load products for a specific supplier
  const loadSupplierProducts = async (supplierId, showLoading = false) => {
    if (!supplierId) return;
    
    // Check if already loaded
    if (supplierProducts[supplierId]) {
      return;
    }

    try {
      if (showLoading) {
        setLoadingProducts(true);
      }
      const result = await productService.getProductsBySupplier(supplierId);
      
      if (result.success) {
        setSupplierProducts(prev => ({
          ...prev,
          [supplierId]: result.products
        }));
      } else {
        // If no products found or error, set empty array
        setSupplierProducts(prev => ({
          ...prev,
          [supplierId]: []
        }));
      }
    } catch (err) {
      console.error('Error loading supplier products:', err);
      setSupplierProducts(prev => ({
        ...prev,
        [supplierId]: []
      }));
    } finally {
      if (showLoading) {
        setLoadingProducts(false);
      }
    }
  };

  // Load suppliers and their products on mount
  useEffect(() => {
    const loadData = async () => {
      await loadSuppliers();
    };
    loadData();
  }, []);

  // Load products for all suppliers after suppliers are loaded
  useEffect(() => {
    if (suppliers.length > 0) {
      const loadAllProducts = async () => {
        for (const supplier of suppliers) {
          if (supplier.id && !supplierProducts[supplier.id]) {
            await loadSupplierProducts(supplier.id);
          }
        }
      };
      loadAllProducts();
    }
  }, [suppliers]);

  // Get unique categories
  const categories = [...new Set(suppliers.map(s => s.category))].filter(Boolean);
  
  // Get unique payment terms
  const paymentTerms = [...new Set(suppliers.map(s => s.paymentTerms))].filter(Boolean);

  // Filter and sort suppliers
  const filteredSuppliers = suppliers
    .filter(supplier => {
      const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           supplier.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           supplier.phone.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filters.status === 'all' || 
                           (filters.status === 'active' && supplier.isActive) ||
                           (filters.status === 'inactive' && !supplier.isActive);
      const matchesCategory = filters.category === 'all' || supplier.category === filters.category;
      const matchesRating = filters.rating === 'all' || supplier.rating >= parseInt(filters.rating);
      const matchesPaymentTerms = filters.paymentTerms === 'all' || supplier.paymentTerms === filters.paymentTerms;
      
      return matchesSearch && matchesStatus && matchesCategory && matchesRating && matchesPaymentTerms;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'lastOrder') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Handle supplier details
  const handleViewDetails = (supplier) => {
    setSelectedSupplier(supplier);
    setIsDetailsModalOpen(true);
    // Load products for this supplier if not already loaded
    if (supplier.id && !supplierProducts[supplier.id]) {
      loadSupplierProducts(supplier.id, true);
    }
  };

  // Handle edit supplier
  const handleEditSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      website: supplier.website,
      category: supplier.category,
      paymentTerms: supplier.paymentTerms,
      rating: supplier.rating,
      notes: supplier.notes,
      isActive: supplier.isActive
    });
    setIsEditModalOpen(true);
  };

  // Handle add supplier
  const handleAddSupplier = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      website: '',
      category: '',
      paymentTerms: '',
      rating: 5,
      notes: '',
      isActive: true
    });
    setIsAddModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log('Form submitted:', formData);
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
  };

  // Get status color
  const getStatusColor = (isActive) => {
    return isActive ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  };

  // Get status icon
  const getStatusIcon = (isActive) => {
    return isActive ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;
  };

  // Get rating stars
  const getRatingStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  // Calculate supplier statistics
  const supplierStats = {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter(s => s.isActive !== false).length,
    inactiveSuppliers: suppliers.filter(s => s.isActive === false).length,
    averageRating: suppliers.length > 0 ? suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length : 0
  };

  // Export suppliers to CSV
  const handleExport = () => {
    try {
      const headers = ['Supplier Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Website', 'Category', 'Payment Terms', 'Rating', 'Status', 'Products Count'];
      
      const rows = filteredSuppliers.map(supplier => [
        supplier.name,
        supplier.contactPerson,
        supplier.email,
        supplier.phone,
        supplier.address,
        supplier.website,
        supplier.category,
        supplier.paymentTerms,
        supplier.rating,
        supplier.isActive ? 'Active' : 'Inactive',
        supplierProducts[supplier.id]?.length || 0
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `suppliers_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Exported ${filteredSuppliers.length} suppliers`);
    } catch (err) {
      console.error('Error exporting suppliers:', err);
      toast.error('Failed to export suppliers');
    }
  };

  // Print all suppliers
  const handlePrintAll = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    
    let htmlContent = `
      <html>
        <head>
          <title>Suppliers Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; }
            .supplier-section { page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
            .supplier-header { background-color: #f5f5f5; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
            .supplier-name { font-size: 18px; font-weight: bold; color: #333; }
            .supplier-status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px; }
            .status-active { background-color: #d4edda; color: #155724; }
            .status-inactive { background-color: #f8d7da; color: #721c24; }
            .info-row { margin: 8px 0; }
            .info-label { font-weight: bold; color: #555; display: inline-block; width: 120px; }
            .products-section { margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px; }
            .products-title { font-weight: bold; color: #333; margin-bottom: 10px; }
            .product-item { margin-left: 20px; padding: 5px 0; border-bottom: 1px solid #eee; }
            .rating { color: #ffc107; }
          </style>
        </head>
        <body>
          <h1>Suppliers Report</h1>
          <p style="text-align: center; color: #666;">Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}</p>
    `;

    filteredSuppliers.forEach(supplier => {
      const products = supplierProducts[supplier.id] || [];
      htmlContent += `
        <div class="supplier-section">
          <div class="supplier-header">
            <div class="supplier-name">
              ${supplier.name}
              <span class="supplier-status status-${supplier.isActive ? 'active' : 'inactive'}">
                ${supplier.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Contact:</span> ${supplier.contactPerson}
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span> ${supplier.email}
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span> ${supplier.phone}
          </div>
          <div class="info-row">
            <span class="info-label">Address:</span> ${supplier.address}
          </div>
          <div class="info-row">
            <span class="info-label">Website:</span> ${supplier.website}
          </div>
          <div class="info-row">
            <span class="info-label">Category:</span> ${supplier.category}
          </div>
          <div class="info-row">
            <span class="info-label">Payment Terms:</span> ${supplier.paymentTerms}
          </div>
          <div class="info-row">
            <span class="info-label">Rating:</span> <span class="rating">${'★'.repeat(supplier.rating)}${'☆'.repeat(5 - supplier.rating)}</span> (${supplier.rating}/5)
          </div>
          ${supplier.notes ? `<div class="info-row"><span class="info-label">Notes:</span> ${supplier.notes}</div>` : ''}
          
          <div class="products-section">
            <div class="products-title">Products Supplied (${products.length})</div>
            ${products.length > 0 
              ? products.map(p => `<div class="product-item">• ${p.name}${p.sku ? ` (SKU: ${p.sku})` : ''}</div>`).join('')
              : '<div class="product-item" style="color: #999;">No products</div>'
            }
          </div>
        </div>
      `;
    });

    htmlContent += `
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Print individual supplier
  const handlePrintSupplier = (supplier) => {
    const products = supplierProducts[supplier.id] || [];
    const printWindow = window.open('', '', 'height=600,width=800');
    
    const htmlContent = `
      <html>
        <head>
          <title>${supplier.name} - Supplier Details</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            .status { display: inline-block; padding: 6px 12px; border-radius: 4px; font-weight: bold; margin-left: 10px; }
            .status-active { background-color: #d4edda; color: #155724; }
            .status-inactive { background-color: #f8d7da; color: #721c24; }
            .section { margin: 20px 0; }
            .section-title { font-weight: bold; font-size: 14px; color: #333; background-color: #f5f5f5; padding: 8px; margin-bottom: 10px; }
            .info-row { margin: 8px 0; }
            .info-label { font-weight: bold; color: #555; display: inline-block; width: 140px; }
            .products-list { margin-left: 20px; }
            .product-item { padding: 8px 0; border-bottom: 1px solid #eee; }
            .rating { color: #ffc107; font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>
            ${supplier.name}
            <span class="status status-${supplier.isActive ? 'active' : 'inactive'}">
              ${supplier.isActive ? 'Active' : 'Inactive'}
            </span>
          </h1>
          
          <div class="section">
            <div class="section-title">Contact Information</div>
            <div class="info-row"><span class="info-label">Contact Person:</span> ${supplier.contactPerson}</div>
            <div class="info-row"><span class="info-label">Email:</span> ${supplier.email}</div>
            <div class="info-row"><span class="info-label">Phone:</span> ${supplier.phone}</div>
            <div class="info-row"><span class="info-label">Address:</span> ${supplier.address}</div>
            <div class="info-row"><span class="info-label">Website:</span> ${supplier.website}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Business Information</div>
            <div class="info-row"><span class="info-label">Category:</span> ${supplier.category}</div>
            <div class="info-row"><span class="info-label">Payment Terms:</span> ${supplier.paymentTerms}</div>
            <div class="info-row"><span class="info-label">Rating:</span> <span class="rating">${'★'.repeat(supplier.rating)}${'☆'.repeat(5 - supplier.rating)}</span> (${supplier.rating}/5)</div>
            ${supplier.notes ? `<div class="info-row"><span class="info-label">Notes:</span> ${supplier.notes}</div>` : ''}
          </div>
          
          <div class="section">
            <div class="section-title">Products Supplied (${products.length})</div>
            <div class="products-list">
              ${products.length > 0 
                ? products.map(p => `
                  <div class="product-item">
                    <strong>${p.name}</strong>
                    ${p.sku ? `<br/><small>SKU: ${p.sku}</small>` : ''}
                    ${p.category ? `<br/><small>Category: ${p.category}</small>` : ''}
                  </div>
                `).join('')
                : '<div class="product-item" style="color: #999;">No products supplied</div>'
              }
            </div>
          </div>
          
          <p style="margin-top: 30px; color: #999; font-size: 12px;">
            Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}
          </p>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading suppliers...</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Suppliers</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadSuppliers} className="flex items-center gap-2">
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600">Manage your supplier network and details</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Building className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Suppliers</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{supplierStats.totalSuppliers}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Active</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{supplierStats.activeSuppliers}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Star className="h-6 w-6 md:h-8 md:w-8 text-yellow-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Avg Rating</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{supplierStats.averageRating.toFixed(1)}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-3 lg:p-4">
            <div className="flex items-center">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
              <div className="ml-2 md:ml-3">
                <p className="text-xs md:text-sm font-medium text-gray-600">Categories</p>
                <p className="text-lg md:text-xl font-bold text-gray-900">{categories.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filter Row */}
        <Card className="p-3 md:p-4 lg:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Search Bar - 70% width */}
            <div className="flex-1">
              <SearchInput
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={setSearchTerm}
                className="w-full text-sm"
              />
            </div>
            
            {/* Icon Buttons Only */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="outline"
                onClick={() => setIsFilterModalOpen(true)}
                className="p-2 md:p-2.5"
                title="Filter"
              >
                <Filter className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExport}
                className="p-2 md:p-2.5"
                title="Export"
              >
                <Download className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <Button 
                variant="outline" 
                onClick={handlePrintAll}
                className="p-2 md:p-2.5"
                title="Print All"
              >
                <Printer className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Suppliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Supplier Header */}
              <div className="p-3 md:p-4 lg:p-6 border-b">
                <div className="flex items-start justify-between mb-2 md:mb-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm md:text-base text-gray-900">{supplier.name}</h3>
                      <p className="text-xs md:text-sm text-gray-500">{supplier.category}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs font-medium ${getStatusColor(supplier.isActive)}`}>
                    {getStatusIcon(supplier.isActive)}
                    <span className="hidden sm:inline">{supplier.isActive ? 'Active' : 'Inactive'}</span>
                  </span>
                </div>
                
                <div className="flex items-center gap-2 md:gap-4 mb-2 md:mb-3">
                  <div className="flex items-center gap-0.5 md:gap-1">
                    {getRatingStars(supplier.rating)}
                  </div>
                  <span className="text-xs md:text-sm text-gray-500">({supplier.rating}/5)</span>
                </div>
                
                <p className="text-xs md:text-sm text-gray-600 line-clamp-2">{supplier.notes}</p>
              </div>

              {/* Supplier Info */}
              <div className="p-3 md:p-4 lg:p-6">
                <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-400" />
                    <span className="text-xs md:text-sm text-gray-600 truncate">{supplier.contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <Mail className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-400" />
                    <span className="text-xs md:text-sm text-gray-600 truncate">{supplier.email}</span>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <Phone className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-400" />
                    <span className="text-xs md:text-sm text-gray-600">{supplier.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 hidden md:flex">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-400" />
                    <span className="text-xs md:text-sm text-gray-600 line-clamp-1">{supplier.address}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-4 text-xs md:text-sm">
                  <div>
                    <span className="text-gray-500">Payment:</span>
                    <span className="ml-1 font-medium">{supplier.paymentTerms || 'N/A'}</span>
                  </div>
                  <div className="hidden md:block">
                    <span className="text-gray-500">Category:</span>
                    <span className="ml-1 font-medium">{supplier.category || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1 md:gap-2">
                      <Package className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-600" />
                      <span className="text-gray-500">Products:</span>
                      <span className="ml-1 font-semibold text-blue-600">
                        {supplierProducts[supplier.id]?.length || 0} available
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(supplier)}
                    className="flex-1 flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3"
                  >
                    <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">View Details</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintSupplier(supplier)}
                    className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3"
                    title="Print Supplier Details"
                  >
                    <Printer className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredSuppliers.length === 0 && (
          <Card className="p-6 md:p-8 lg:p-12 text-center">
            <Building className="h-12 w-12 md:h-16 md:w-16 text-gray-400 mx-auto mb-3 md:mb-4" />
            <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2">No Suppliers Found</h3>
            <p className="text-sm md:text-base text-gray-600 mb-3 md:mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all')
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first supplier'
              }
            </p>
            <Button onClick={handleAddSupplier} className="flex items-center gap-1 md:gap-2 mx-auto text-xs md:text-sm px-2 md:px-3">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Add Supplier
            </Button>
          </Card>
        )}

        {/* Filter Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Filter Suppliers"
            size="md"
          >
            <div className="space-y-6">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Category Filter */}
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

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
                <select
                  value={filters.rating}
                  onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Ratings</option>
                  <option value="1">1+ Stars</option>
                  <option value="2">2+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="5">5 Stars</option>
                </select>
              </div>

              {/* Payment Terms Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                <select
                  value={filters.paymentTerms}
                  onChange={(e) => setFilters(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Payment Terms</option>
                  {paymentTerms.map(term => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      status: 'all',
                      category: 'all',
                      rating: 'all',
                      paymentTerms: 'all'
                    });
                  }}
                  className="flex-1"
                >
                  Reset Filters
                </Button>
                <Button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Supplier Details Modal */}
        {isDetailsModalOpen && selectedSupplier && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedSupplier(null);
            }}
            title="Supplier Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Supplier Header */}
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building className="h-16 w-16 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedSupplier.name}</h2>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedSupplier.isActive)}`}>
                      {getStatusIcon(selectedSupplier.isActive)}
                      {selectedSupplier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-lg text-gray-600 mb-2">{selectedSupplier.category}</p>
                  <div className="flex items-center gap-1">
                    {getRatingStars(selectedSupplier.rating)}
                    <span className="ml-2 text-sm text-gray-500">({selectedSupplier.rating}/5)</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Contact Information</h3>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Contact Person</label>
                    <p className="text-gray-900">{selectedSupplier.contactPerson}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{selectedSupplier.email}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-gray-900">{selectedSupplier.phone}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p className="text-gray-900">{selectedSupplier.address}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Website</label>
                    <p className="text-blue-600">
                      <a href={selectedSupplier.website} target="_blank" rel="noopener noreferrer">
                        {selectedSupplier.website}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Business Information</h3>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Terms</label>
                    <p className="text-gray-900">{selectedSupplier.paymentTerms}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Rating</label>
                    <div className="flex items-center gap-1">
                      {getRatingStars(selectedSupplier.rating || 0)}
                      <span className="ml-2 text-sm text-gray-500">({selectedSupplier.rating || 0}/5)</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Products</label>
                    <p className="text-lg font-semibold text-gray-900">
                      {supplierProducts[selectedSupplier.id]?.length || 0} products
                    </p>
                  </div>
                </div>
              </div>

              {/* Products Section */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Products Supplied ({supplierProducts[selectedSupplier.id]?.length || 0})
                  </h3>
                  {loadingProducts && (
                    <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
                
                {loadingProducts ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading products...</p>
                  </div>
                ) : supplierProducts[selectedSupplier.id] && supplierProducts[selectedSupplier.id].length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {supplierProducts[selectedSupplier.id].map((product) => (
                      <Card key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-16 h-16 object-cover rounded-lg"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <Package className="h-8 w-8 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                {product.brand && (
                                  <p className="text-sm text-gray-600">Brand: {product.brand}</p>
                                )}
                                {product.sku && (
                                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                                )}
                                {product.category && (
                                  <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                    {product.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-semibold text-gray-900">
                              ₱{(product.unitCost || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">Unit Cost</p>
                          </div>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{product.description}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No products found for this supplier</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedSupplier.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="text-gray-900 mt-1 bg-gray-50 p-3 rounded-lg">{selectedSupplier.notes}</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                  <div>
                    <span className="font-medium">Created:</span> {selectedSupplier.createdAt ? format(new Date(selectedSupplier.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Updated:</span> {selectedSupplier.updatedAt ? format(new Date(selectedSupplier.updatedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Add/Edit Supplier Modal */}
        {(isAddModalOpen || isEditModalOpen) && (
          <Modal
            isOpen={isAddModalOpen || isEditModalOpen}
            onClose={() => {
              setIsAddModalOpen(false);
              setIsEditModalOpen(false);
              setSelectedSupplier(null);
            }}
            title={isAddModalOpen ? 'Add Supplier' : 'Edit Supplier'}
            size="lg"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Name *</label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person *</label>
                  <Input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Category</option>
                    <option value="Hair Care">Hair Care</option>
                    <option value="Hair Color">Hair Color</option>
                    <option value="Styling">Styling</option>
                    <option value="Tools">Tools</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms *</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Payment Terms</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                <Input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData(prev => ({ ...prev, rating: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={1}>1 Star</option>
                    <option value={2}>2 Stars</option>
                    <option value={3}>3 Stars</option>
                    <option value={4}>4 Stars</option>
                    <option value={5}>5 Stars</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Active Supplier
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Additional notes about this supplier..."
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setSelectedSupplier(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isAddModalOpen ? 'Add Supplier' : 'Update Supplier'}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
};

export default Suppliers;
