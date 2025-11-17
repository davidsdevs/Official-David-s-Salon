import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Star,
  Users,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const Suppliers = () => {
  const { userData } = useAuth();
  
  // Data states
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'view'
  
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

  // Validation states
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Validation functions
  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'name':
        if (!value.trim()) {
          error = 'Supplier name is required';
        } else if (value.trim().length < 2) {
          error = 'Supplier name must be at least 2 characters';
        }
        break;
      
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;
      
      case 'phone':
        if (value && value.trim().length > 0 && value.trim().length < 10) {
          error = 'Phone number must be at least 10 characters';
        }
        break;
      
      case 'category':
        if (!value.trim()) {
          error = 'Category is required';
        }
        break;
      
      case 'paymentTerms':
        if (!value.trim()) {
          error = 'Payment terms are required';
        }
        break;
      
      case 'rating':
        if (value < 1 || value > 5) {
          error = 'Rating must be between 1 and 5';
        }
        break;
    }
    
    return error;
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      if (key !== 'website' && key !== 'notes') {
        const error = validateField(key, formData[key]);
        if (error) {
          newErrors[key] = error;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null)
        });
      });
      
      // Sort by name
      suppliersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      setSuppliers(suppliersList);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      setError('Failed to load suppliers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load suppliers on component mount
  useEffect(() => {
    loadSuppliers();
  }, []);

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'All' || supplier.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'Active' && supplier.isActive !== false) ||
      (statusFilter === 'Inactive' && supplier.isActive === false);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Get unique categories
  const categories = ['All', ...new Set(suppliers.map(s => s.category).filter(Boolean))];

  // Modal handlers
  const openCreateModal = () => {
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
    setModalMode('create');
    setSelectedSupplier(null);
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  const openEditModal = (supplier) => {
    setFormData({
      name: supplier.name || '',
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      website: supplier.website || '',
      category: supplier.category || '',
      paymentTerms: supplier.paymentTerms || '',
      rating: supplier.rating || 5,
      notes: supplier.notes || '',
      isActive: supplier.isActive !== false
    });
    setModalMode('edit');
    setSelectedSupplier(supplier);
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  const openViewModal = (supplier) => {
    setFormData({
      name: supplier.name || '',
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      website: supplier.website || '',
      category: supplier.category || '',
      paymentTerms: supplier.paymentTerms || '',
      rating: supplier.rating || 5,
      notes: supplier.notes || '',
      isActive: supplier.isActive !== false
    });
    setModalMode('view');
    setSelectedSupplier(supplier);
    setShowModal(true);
  };

  const openDeleteModal = (supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowDeleteModal(false);
    setSelectedSupplier(null);
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
    setErrors({});
    setTouched({});
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : 
                     type === 'number' ? parseFloat(value) || 0 : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    // Validate field in real-time
    const error = validateField(name, newValue);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  };

  // CRUD operations
  const handleCreate = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const supplierData = {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'suppliers'), supplierData);
      
      await loadSuppliers();
      setSuccess('Supplier created successfully!');
      closeModal();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error creating supplier:', err);
      setError('Failed to create supplier: ' + err.message);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const supplierData = {
        ...formData,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'suppliers', selectedSupplier.id), supplierData);
      
      await loadSuppliers();
      setSuccess('Supplier updated successfully!');
      closeModal();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating supplier:', err);
      setError('Failed to update supplier: ' + err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'suppliers', selectedSupplier.id));
      
      await loadSuppliers();
      setSuccess('Supplier deleted successfully!');
      closeModal();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting supplier:', err);
      setError('Failed to delete supplier: ' + err.message);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modalMode === 'create') {
      handleCreate();
    } else if (modalMode === 'edit') {
      handleUpdate();
    }
  };

  // Get status color
  const getStatusColor = (isActive) => {
    return isActive ? 'text-green-600 bg-green-100 border-green-200' : 'text-red-600 bg-red-100 border-red-200';
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
    averageRating: suppliers.length > 0 
      ? (suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length).toFixed(1)
      : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading suppliers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers Management</h1>
          <p className="text-gray-600">Manage supplier information and details</p>
        </div>
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#160B53] text-white hover:bg-[#12094A]"
        >
          <Plus className="h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Suppliers</p>
              <p className="text-2xl font-bold text-gray-900">{supplierStats.totalSuppliers}</p>
            </div>
            <Building className="h-8 w-8 text-[#160B53]" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Suppliers</p>
              <p className="text-2xl font-bold text-green-600">{supplierStats.activeSuppliers}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive Suppliers</p>
              <p className="text-2xl font-bold text-red-600">{supplierStats.inactiveSuppliers}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Rating</p>
              <p className="text-2xl font-bold text-yellow-600">{supplierStats.averageRating}</p>
            </div>
            <Star className="h-8 w-8 text-yellow-600 fill-current" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Terms</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No suppliers found</p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                        {supplier.address && (
                          <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {supplier.address.substring(0, 50)}{supplier.address.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {supplier.contactPerson && (
                          <div className="text-sm text-gray-900 flex items-center gap-1">
                            <Users className="h-3 w-3 text-gray-400" />
                            {supplier.contactPerson}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{supplier.category || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{supplier.paymentTerms || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {getRatingStars(supplier.rating || 0)}
                        <span className="text-sm text-gray-600 ml-1">({supplier.rating || 0})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(supplier.isActive !== false)}`}>
                        {getStatusIcon(supplier.isActive !== false)}
                        {supplier.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewModal(supplier)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(supplier)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteModal(supplier)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit/View Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Building className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {modalMode === 'create' ? 'Add Supplier' : modalMode === 'edit' ? 'Edit Supplier' : 'Supplier Details'}
                    </h2>
                    <p className="text-white/80 text-sm mt-1">
                      {modalMode === 'view' ? 'View supplier information' : 'Manage supplier details'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={closeModal}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {modalMode === 'view' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <Building className="h-5 w-5 text-blue-600 mr-2" />
                        Basic Information
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-600">Name</span>
                          <span className="text-sm text-gray-900">{formData.name}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-600">Contact Person</span>
                          <span className="text-sm text-gray-900">{formData.contactPerson || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-600">Category</span>
                          <span className="text-sm text-gray-900">{formData.category || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm font-medium text-gray-600">Status</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(formData.isActive)}`}>
                            {getStatusIcon(formData.isActive)}
                            {formData.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <Phone className="h-5 w-5 text-green-600 mr-2" />
                        Contact Information
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-600">Email</span>
                          <span className="text-sm text-gray-900">{formData.email || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-600">Phone</span>
                          <span className="text-sm text-gray-900">{formData.phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                          <span className="text-sm font-medium text-gray-600">Address</span>
                          <span className="text-sm text-gray-900 text-right">{formData.address || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm font-medium text-gray-600">Website</span>
                          <span className="text-sm text-blue-600">{formData.website || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Star className="h-5 w-5 text-yellow-600 mr-2" />
                      Additional Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-600">Payment Terms</span>
                        <span className="text-sm text-gray-900">{formData.paymentTerms || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-600">Rating</span>
                        <div className="flex items-center gap-1">
                          {getRatingStars(formData.rating)}
                          <span className="text-sm text-gray-600 ml-1">({formData.rating})</span>
                        </div>
                      </div>
                      {formData.notes && (
                        <div className="py-2">
                          <span className="text-sm font-medium text-gray-600 block mb-2">Notes</span>
                          <p className="text-sm text-gray-900">{formData.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Supplier Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        required
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] ${
                          errors.name && touched.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.name && touched.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Person <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="contactPerson"
                        value={formData.contactPerson}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        required
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] ${
                          errors.contactPerson && touched.contactPerson ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.contactPerson && touched.contactPerson && (
                        <p className="mt-1 text-sm text-red-600">{errors.contactPerson}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] ${
                          errors.email && touched.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.email && touched.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] ${
                          errors.phone && touched.phone ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.phone && touched.phone && (
                        <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        required
                        placeholder="e.g., Hair Care, Hair Color"
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] ${
                          errors.category && touched.category ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.category && touched.category && (
                        <p className="mt-1 text-sm text-red-600">{errors.category}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Terms <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        required
                        placeholder="e.g., Net 30, Net 15"
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] ${
                          errors.paymentTerms && touched.paymentTerms ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.paymentTerms && touched.paymentTerms && (
                        <p className="mt-1 text-sm text-red-600">{errors.paymentTerms}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rating (1-5)
                      </label>
                      <input
                        type="number"
                        name="rating"
                        value={formData.rating}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        min="1"
                        max="5"
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] ${
                          errors.rating && touched.rating ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.rating && touched.rating && (
                        <p className="mt-1 text-sm text-red-600">{errors.rating}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Website
                      </label>
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleInputChange}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address
                      </label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                        placeholder="Additional notes about the supplier..."
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="isActive"
                          checked={formData.isActive}
                          onChange={handleInputChange}
                          className="w-4 h-4 text-[#160B53] border-gray-300 rounded focus:ring-[#160B53]"
                        />
                        <span className="text-sm font-medium text-gray-700">Active Supplier</span>
                      </label>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            {modalMode !== 'view' && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="bg-[#160B53] text-white hover:bg-[#12094A]"
                  >
                    {modalMode === 'create' ? 'Create Supplier' : 'Update Supplier'}
                  </Button>
                </div>
              </div>
            )}
            {modalMode === 'view' && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end">
                  <Button
                    onClick={closeModal}
                    className="bg-[#160B53] text-white hover:bg-[#12094A]"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all duration-300 scale-100 mx-4">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Delete Supplier</h2>
                    <p className="text-white/80 text-sm mt-1">This action cannot be undone</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={closeModal}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <strong>{selectedSupplier.name}</strong>? This will permanently remove the supplier from the system.
              </p>
            </div>
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={closeModal}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete Supplier
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;

