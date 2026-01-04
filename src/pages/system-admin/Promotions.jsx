/**
 * System Admin Promotions Management Page
 * Module: M06 - CRM
 * Allows system admins to create and manage promotional campaigns
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Calendar, Tag, Building2, TrendingUp, Clock, CheckCircle, XCircle, Globe, MapPin, Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, Eye, X, Users, Target } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllPromotions, createPromotion, updatePromotion, deletePromotion } from '../../services/promotionService';
import { getAllBranches } from '../../services/branchService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const Promotions = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  
  // Filtering and pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive', 'upcoming', 'expired'
  const [branchFilter, setBranchFilter] = useState('all');
  const [discountTypeFilter, setDiscountTypeFilter] = useState('all'); // 'all', 'percentage', 'fixed'
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('startDate'); // 'startDate', 'endDate', 'title', 'discountValue'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    promotionCode: '',
    autoGenerateCode: true,
    discountType: 'percentage',
    discountValue: '',
    branchId: '',
    targetSegment: 'all',
    applicableTo: 'all', // 'all', 'services', 'products', 'specific'
    specificServices: [],
    specificProducts: [],
    usageType: 'repeating', // 'one-time' or 'repeating'
    maxUses: '',
    startDate: '',
    endDate: '',
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [promosData, branchesData] = await Promise.all([
        getAllPromotions(),
        getAllBranches()
      ]);
      setPromotions(promosData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPromotion(null);
    setFormData({
      title: '',
      description: '',
      promotionCode: '',
      autoGenerateCode: true,
      discountType: 'percentage',
      discountValue: '',
      branchId: '',
      targetSegment: 'all',
      applicableTo: 'all',
      specificServices: [],
      specificProducts: [],
      usageType: 'repeating',
      maxUses: '',
      startDate: '',
      endDate: '',
      isActive: true
    });
    setShowModal(true);
  };

  const handleEdit = (promotion) => {
    setSelectedPromotion(promotion);
    
    // Handle date conversion - support both Date objects and Timestamps
    const formatDate = (date) => {
      if (!date) return '';
      if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }
      if (date?.toDate) {
        return date.toDate().toISOString().split('T')[0];
      }
      if (typeof date === 'string') {
        return date.split('T')[0];
      }
      return '';
    };
    
    setFormData({
      title: promotion.title || promotion.name || '',
      description: promotion.description || '',
      promotionCode: promotion.promotionCode || '',
      autoGenerateCode: false,
      discountType: promotion.discountType || 'percentage',
      discountValue: promotion.discountValue || '',
      branchId: promotion.branchId || '', // null becomes empty string for form
      targetSegment: promotion.targetSegment || 'all',
      applicableTo: promotion.applicableTo || 'all',
      specificServices: promotion.specificServices || [],
      specificProducts: promotion.specificProducts || [],
      usageType: promotion.usageType || 'repeating',
      maxUses: promotion.maxUses || '',
      startDate: formatDate(promotion.startDate),
      endDate: formatDate(promotion.endDate),
      isActive: promotion.isActive !== undefined ? promotion.isActive : true
    });
    setShowModal(true);
  };

  const handleDelete = (promotion) => {
    setSelectedPromotion(promotion);
    setShowDeleteModal(true);
  };

  const handleView = (promotion) => {
    setSelectedPromotion(promotion);
    setShowViewModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.promotionCode || formData.promotionCode.trim() === '') {
      toast.error('Promotion code is required');
      return;
    }

    // Validate maxUses for repeating promotions
    if (formData.usageType === 'repeating' && formData.maxUses) {
      const maxUses = parseInt(formData.maxUses);
      if (isNaN(maxUses) || maxUses <= 0) {
        toast.error('Max uses must be a positive number');
        return;
      }
    }

    try {
      // Convert empty string to null for system-wide promotions
      const promotionData = {
        ...formData,
        branchId: formData.branchId === '' ? null : formData.branchId,
        promotionCode: formData.promotionCode.trim().toUpperCase(),
        maxUses: formData.usageType === 'repeating' && formData.maxUses ? parseInt(formData.maxUses) : null
      };
      
      if (selectedPromotion) {
        await updatePromotion(selectedPromotion.id, promotionData, currentUser);
        toast.success('Promotion updated successfully');
      } else {
        await createPromotion(promotionData, currentUser);
        toast.success('Promotion created successfully');
      }
      
      setShowModal(false);
      await fetchData();
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error(error.message || 'Failed to save promotion');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePromotion(selectedPromotion.id, currentUser);
      setShowDeleteModal(false);
      setSelectedPromotion(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting promotion:', error);
    }
  };

  const isActive = (promotion) => {
    if (!promotion.isActive) return false;
    const now = new Date();
    
    // Handle date conversion - support both Date objects and Timestamps
    const getDate = (date) => {
      if (date instanceof Date) return date;
      if (date?.toDate) return date.toDate();
      if (typeof date === 'string') return new Date(date);
      return new Date();
    };
    
    const start = getDate(promotion.startDate);
    const end = getDate(promotion.endDate);
    return now >= start && now <= end;
  };
  
  const getBranchName = (branchId) => {
    if (!branchId) return 'System-Wide (All Branches)';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branch?.branchName || 'Unknown Branch';
  };

  // Generate a random promotion code
  const generatePromotionCode = () => {
    // Use format: DS-XXXX-XXXX (8 characters total after DS-)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters (0, O, I, 1)
    let random = '';
    for (let i = 0; i < 8; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Format as DS-XXXX-XXXX
    return `DS-${random.substring(0, 4)}-${random.substring(4, 8)}`;
  };

  // Handle generate code button click
  const handleGenerateCode = () => {
    const newCode = generatePromotionCode();
    setFormData(prev => ({ ...prev, promotionCode: newCode, autoGenerateCode: false }));
  };

  // Get promotion status helper
  const getPromotionStatus = useCallback((promotion) => {
    if (!promotion.isActive) return 'inactive';
    const now = new Date();
    const start = promotion.startDate?.toDate ? promotion.startDate.toDate() : new Date(promotion.startDate);
    const end = promotion.endDate?.toDate ? promotion.endDate.toDate() : new Date(promotion.endDate);
    
    if (now < start) return 'upcoming';
    if (now > end) return 'expired';
    return 'active';
  }, []);

  // Filter and sort promotions
  const filteredAndSortedPromotions = useMemo(() => {
    let filtered = [...promotions];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        (p.title || p.name || '').toLowerCase().includes(searchLower) ||
        (p.promotionCode || '').toLowerCase().includes(searchLower) ||
        (p.description || '').toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => getPromotionStatus(p) === statusFilter);
    }

    // Branch filter
    if (branchFilter !== 'all') {
      if (branchFilter === 'system-wide') {
        filtered = filtered.filter(p => !p.branchId);
      } else {
        filtered = filtered.filter(p => p.branchId === branchFilter);
      }
    }

    // Discount type filter
    if (discountTypeFilter !== 'all') {
      filtered = filtered.filter(p => (p.discountType || 'percentage') === discountTypeFilter);
    }

    // Date filters
    const toDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (value?.toDate) return value.toDate();
      return new Date(value);
    };

    if (startDateFilter) {
      const startFilterDate = new Date(startDateFilter);
      filtered = filtered.filter(p => {
        const promoStart = toDate(p.startDate);
        return promoStart ? promoStart >= startFilterDate : false;
      });
    }

    if (endDateFilter) {
      const endFilterDate = new Date(endDateFilter);
      filtered = filtered.filter(p => {
        const promoEnd = toDate(p.endDate);
        return promoEnd ? promoEnd <= endFilterDate : false;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'startDate':
          aValue = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate || 0);
          bValue = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate || 0);
          break;
        case 'endDate':
          aValue = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate || 0);
          bValue = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate || 0);
          break;
        case 'title':
          aValue = (a.title || a.name || '').toLowerCase();
          bValue = (b.title || b.name || '').toLowerCase();
          break;
        case 'discountValue':
          aValue = parseFloat(a.discountValue || 0);
          bValue = parseFloat(b.discountValue || 0);
          break;
        default:
          aValue = a[sortBy] || '';
          bValue = b[sortBy] || '';
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [promotions, searchTerm, statusFilter, branchFilter, sortBy, sortOrder, getPromotionStatus]);

  // Pagination
  const paginationData = useMemo(() => {
    const totalItems = filteredAndSortedPromotions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedPromotions = filteredAndSortedPromotions.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      paginatedPromotions
    };
  }, [filteredAndSortedPromotions, currentPage, itemsPerPage]);

  const { totalItems, totalPages, startIndex, endIndex, paginatedPromotions } = paginationData;

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Calculate branch statistics
  const branchStats = useMemo(() => {
    const stats = {
      systemWide: {
        name: 'System-Wide',
        total: 0,
        active: 0,
        upcoming: 0,
        expired: 0,
        branchId: null
      },
      branches: []
    };

    branches.forEach(branch => {
      const branchPromotions = promotions.filter(p => p.branchId === branch.id);
      const now = new Date();
      
      const activePromos = branchPromotions.filter(p => {
        if (!p.isActive) return false;
        const start = p.startDate?.toDate ? p.startDate.toDate() : new Date(p.startDate);
        const end = p.endDate?.toDate ? p.endDate.toDate() : new Date(p.endDate);
        return now >= start && now <= end;
      });

      const upcomingPromos = branchPromotions.filter(p => {
        if (!p.isActive) return false;
        const start = p.startDate?.toDate ? p.startDate.toDate() : new Date(p.startDate);
        return now < start;
      });

      const expiredPromos = branchPromotions.filter(p => {
        const end = p.endDate?.toDate ? p.endDate.toDate() : new Date(p.endDate);
        return now > end || !p.isActive;
      });

      stats.branches.push({
        id: branch.id,
        name: branch.branchName || branch.name || 'Unknown Branch',
        total: branchPromotions.length,
        active: activePromos.length,
        upcoming: upcomingPromos.length,
        expired: expiredPromos.length
      });
    });

    // System-wide promotions
    const systemWidePromos = promotions.filter(p => !p.branchId);
    const now = new Date();
    
    stats.systemWide.total = systemWidePromos.length;
    stats.systemWide.active = systemWidePromos.filter(p => {
      if (!p.isActive) return false;
      const start = p.startDate?.toDate ? p.startDate.toDate() : new Date(p.startDate);
      const end = p.endDate?.toDate ? p.endDate.toDate() : new Date(p.endDate);
      return now >= start && now <= end;
    }).length;
    
    stats.systemWide.upcoming = systemWidePromos.filter(p => {
      if (!p.isActive) return false;
      const start = p.startDate?.toDate ? p.startDate.toDate() : new Date(p.startDate);
      return now < start;
    }).length;
    
    stats.systemWide.expired = systemWidePromos.filter(p => {
      const end = p.endDate?.toDate ? p.endDate.toDate() : new Date(p.endDate);
      return now > end || !p.isActive;
    }).length;

    return stats;
  }, [promotions, branches]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions & Campaigns</h1>
          <p className="text-gray-600">Create and manage promotional campaigns across all branches</p>
        </div>
        <Button onClick={handleCreate} className="bg-[#160B53] hover:bg-[#12094A] text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create Promotion
        </Button>
      </div>

      {/* Branch Summary Cards with Large Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* System-Wide Card */}
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">System-Wide</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 mb-1">{branchStats.systemWide.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">{branchStats.systemWide.active}</div>
              <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Active
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 mb-1">{branchStats.systemWide.upcoming}</div>
              <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Upcoming
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">{branchStats.systemWide.expired}</div>
              <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <XCircle className="h-3 w-3" />
                Expired
              </div>
            </div>
          </div>
        </Card>

        {/* Branch Cards */}
        {branchStats.branches.map((branch) => (
          <Card key={branch.id} className="p-4 bg-white border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-4 w-4 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm truncate flex-1" title={branch.name}>{branch.name}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 mb-1">{branch.total}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">{branch.active}</div>
                <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 mb-1">{branch.upcoming}</div>
                <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Upcoming
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-1">{branch.expired}</div>
                <div className="text-xs text-gray-600 flex items-center justify-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Expired
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search promotions..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
          >
            <option value="all">All Branches</option>
            <option value="system-wide">System-Wide</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.branchName || branch.name || branch.id}
              </option>
            ))}
          </select>
          <select
            value={discountTypeFilter}
            onChange={(e) => {
              setDiscountTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
          >
            <option value="all">All Discount Types</option>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>
          <Input
            type="date"
            value={startDateFilter}
            onChange={(e) => {
              setStartDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
          />
          <Input
            type="date"
            value={endDateFilter}
            onChange={(e) => {
              setEndDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
          />
        </div>
      </Card>

      {/* Promotions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('title')}>
                  <div className="flex items-center gap-1">
                    Title
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('discountValue')}>
                  <div className="flex items-center gap-1">
                    Discount
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('startDate')}>
                  <div className="flex items-center gap-1">
                    Start Date
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('endDate')}>
                  <div className="flex items-center gap-1">
                    End Date
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPromotions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center">
                    <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">
                      {promotions.length === 0 ? 'No promotions created yet' : 'No promotions match your filters'}
                    </p>
                    {promotions.length > 0 && (
                      <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedPromotions.map((promotion) => {
                  const status = getPromotionStatus(promotion);
                  const formatDate = (date) => {
                    if (!date) return 'N/A';
                    if (date instanceof Date) return date.toLocaleDateString();
                    if (date?.toDate) return date.toDate().toLocaleDateString();
                    if (typeof date === 'string') return new Date(date).toLocaleDateString();
                    return 'N/A';
                  };
                  
                  return (
                    <tr key={promotion.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-purple-600" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{promotion.title || promotion.name}</div>
                            {promotion.description && (
                              <div className="text-xs text-gray-500 truncate max-w-xs">{promotion.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-[#160B53]">{promotion.promotionCode || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : `₱${promotion.discountValue}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(promotion.startDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(promotion.endDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm">
                          {!promotion.branchId ? (
                            <>
                              <Globe className="h-3 w-3 text-blue-600" />
                              <span className="text-blue-600">System-Wide</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-700">{getBranchName(promotion.branchId)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'active' 
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : status === 'upcoming'
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                            : status === 'expired'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                          {status === 'active' && <CheckCircle className="h-3 w-3" />}
                          {status === 'upcoming' && <Clock className="h-3 w-3" />}
                          {status === 'expired' && <XCircle className="h-3 w-3" />}
                          {status === 'inactive' && <XCircle className="h-3 w-3" />}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(promotion)}
                            className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(promotion)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(promotion)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-gray-900">{Math.min(endIndex, totalItems)}</span> of{' '}
                  <span className="font-semibold text-gray-900">{totalItems.toLocaleString()}</span> promotions
                  {totalItems > 1000 && (
                    <span className="ml-2 text-blue-600 font-medium">
                      (Large dataset - use filters to narrow results)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Rows per page:</span>
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-1">
                    {[10, 25, 50, 100, 200].map(size => (
                      <button
                        key={size}
                        onClick={() => {
                          setItemsPerPage(size);
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1 text-sm rounded ${itemsPerPage === size ? 'bg-[#160B53] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedPromotion(null);
        }}
        title={selectedPromotion ? 'Edit Promotion' : 'Create Promotion'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              placeholder="Enter promotion title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Code <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={formData.promotionCode}
                onChange={(e) => setFormData(prev => ({ ...prev, promotionCode: e.target.value.toUpperCase() }))}
                required
                placeholder="Enter or generate code"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateCode}
              >
                Generate
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type
              </label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Value <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Segment
            </label>
            <select
              value={formData.targetSegment}
              onChange={(e) => setFormData(prev => ({ ...prev, targetSegment: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
            >
              <option value="all">All Clients</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch (Leave empty for all branches)
            </label>
            <select
              value={formData.branchId}
              onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
            >
              <option value="">🌐 System-Wide (All Branches)</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  📍 {branch.branchName || branch.name || branch.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setSelectedPromotion(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {selectedPromotion ? 'Update' : 'Create'} Promotion
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPromotion(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Promotion"
        message={`Are you sure you want to delete "${selectedPromotion?.title || selectedPromotion?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />

      {/* View Detail Modal */}
      {showViewModal && selectedPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Tag className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Promotion Details</h2>
                    <p className="text-white/80 text-sm mt-1">View complete promotion information</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPromotion(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const promotion = selectedPromotion;
                const status = getPromotionStatus(promotion);
                const formatDate = (date) => {
                  if (!date) return 'N/A';
                  if (date instanceof Date) return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                  if (date?.toDate) return date.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                  if (typeof date === 'string') return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                  return 'N/A';
                };
                const formatDateTime = (date) => {
                  if (!date) return 'N/A';
                  if (date instanceof Date) return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  if (date?.toDate) return date.toDate().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  if (typeof date === 'string') return new Date(date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return 'N/A';
                };

                return (
                  <div className="space-y-6">
                    {/* Title and Status */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{promotion.title || promotion.name}</h3>
                        {promotion.promotionCode && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm text-gray-600">Code:</span>
                            <span className="font-mono text-lg font-bold text-[#160B53] bg-purple-50 px-3 py-1 rounded">{promotion.promotionCode}</span>
                          </div>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                        status === 'active' 
                          ? 'bg-green-100 text-green-700 border-2 border-green-200'
                          : status === 'upcoming'
                          ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-200'
                          : status === 'expired'
                          ? 'bg-red-100 text-red-700 border-2 border-red-200'
                          : 'bg-gray-100 text-gray-700 border-2 border-gray-200'
                      }`}>
                        {status === 'active' && <CheckCircle className="h-5 w-5" />}
                        {status === 'upcoming' && <Clock className="h-5 w-5" />}
                        {status === 'expired' && <XCircle className="h-5 w-5" />}
                        {status === 'inactive' && <XCircle className="h-5 w-5" />}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>

                    {/* Description */}
                    {promotion.description && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-600 mb-2">Description</h4>
                        <p className="text-gray-900">{promotion.description}</p>
                      </div>
                    )}

                    {/* Main Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Discount Information */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                          Discount Information
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">Discount Type</span>
                            <span className="text-sm text-gray-900 capitalize">{promotion.discountType || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">Discount Value</span>
                            <span className="text-lg font-bold text-[#160B53]">
                              {promotion.discountType === 'percentage' 
                                ? `${promotion.discountValue}%` 
                                : `₱${parseFloat(promotion.discountValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Date Information */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Calendar className="h-5 w-5 text-blue-600 mr-2" />
                          Date Information
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">Start Date</span>
                            <span className="text-sm text-gray-900">{formatDate(promotion.startDate)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">End Date</span>
                            <span className="text-sm text-gray-900">{formatDate(promotion.endDate)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm font-medium text-gray-600">Duration</span>
                            <span className="text-sm text-gray-900">
                              {(() => {
                                const start = promotion.startDate?.toDate ? promotion.startDate.toDate() : new Date(promotion.startDate);
                                const end = promotion.endDate?.toDate ? promotion.endDate.toDate() : new Date(promotion.endDate);
                                const diffTime = Math.abs(end - start);
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Targeting Information */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Target className="h-5 w-5 text-purple-600 mr-2" />
                          Targeting
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">Target Segment</span>
                            <span className="text-sm text-gray-900 capitalize">{promotion.targetSegment || 'All'} clients</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">Applicable To</span>
                            <span className="text-sm text-gray-900 capitalize">
                              {promotion.applicableTo === 'all' ? 'All Services & Products' : 
                               promotion.applicableTo === 'services' ? 'Services Only' :
                               promotion.applicableTo === 'products' ? 'Products Only' : 'Specific Items'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm font-medium text-gray-600">Branch</span>
                            <div className="flex items-center gap-1 text-sm">
                              {!promotion.branchId ? (
                                <>
                                  <Globe className="h-4 w-4 text-blue-600" />
                                  <span className="text-blue-600 font-medium">System-Wide (All Branches)</span>
                                </>
                              ) : (
                                <>
                                  <MapPin className="h-4 w-4 text-gray-400" />
                                  <span className="text-gray-900">{getBranchName(promotion.branchId)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Usage Information */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Users className="h-5 w-5 text-orange-600 mr-2" />
                          Usage Information
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">Usage Type</span>
                            <span className="text-sm text-gray-900 capitalize">
                              {promotion.usageType === 'one-time' ? 'One-Time Use' : 'Repeating'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-600">Max Uses</span>
                            <span className="text-sm text-gray-900">
                              {promotion.maxUses ? `${promotion.maxUses} uses` : 'Unlimited'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm font-medium text-gray-600">Current Usage</span>
                            <span className="text-sm text-gray-900">
                              {promotion.usageCount || 0} {promotion.usageCount === 1 ? 'use' : 'uses'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Specific Services/Products */}
                    {(promotion.specificServices?.length > 0 || promotion.specificProducts?.length > 0) && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Specific Items</h4>
                        {promotion.specificServices?.length > 0 && (
                          <div className="mb-3">
                            <span className="text-sm font-medium text-gray-600 block mb-2">Services:</span>
                            <div className="flex flex-wrap gap-2">
                              {promotion.specificServices.map((service, idx) => (
                                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                                  {service}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {promotion.specificProducts?.length > 0 && (
                          <div>
                            <span className="text-sm font-medium text-gray-600 block mb-2">Products:</span>
                            <div className="flex flex-wrap gap-2">
                              {promotion.specificProducts.map((product, idx) => (
                                <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                                  {product}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h4 className="text-sm font-medium text-gray-600 mb-3">Metadata</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {promotion.createdAt && (
                          <div>
                            <span className="text-gray-500">Created:</span>
                            <span className="ml-2 text-gray-900">{formatDateTime(promotion.createdAt)}</span>
                          </div>
                        )}
                        {promotion.updatedAt && (
                          <div>
                            <span className="text-gray-500">Last Updated:</span>
                            <span className="ml-2 text-gray-900">{formatDateTime(promotion.updatedAt)}</span>
                          </div>
                        )}
                        {promotion.createdByName && (
                          <div>
                            <span className="text-gray-500">Created By:</span>
                            <span className="ml-2 text-gray-900">{promotion.createdByName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedPromotion(null);
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(selectedPromotion);
                  }}
                  className="bg-[#160B53] text-white hover:bg-[#12094A]"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Promotion
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Promotions;



