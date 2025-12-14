/**
 * Promotions Page - Receptionist
 * View active promotions for the branch (read-only)
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  Tag, 
  Calendar, 
  Percent, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  Eye,
  Megaphone
} from 'lucide-react';
import { format } from 'date-fns';
import { getBranchServices } from '../../services/branchServicesService';
import { productService } from '../../services/productService';

const ReceptionistPromotions = () => {
  const { userBranch, userBranchData } = useAuth();
  
  const [promotions, setPromotions] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'upcoming', 'expired'
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Load promotions
  const loadPromotions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!userBranch) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }

      const promotionsRef = collection(db, 'promotions');
      const q = query(promotionsRef, where('branchId', '==', userBranch));
      const snapshot = await getDocs(q);
      const promotionsList = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        promotionsList.push({
          id: doc.id,
          title: data.title || data.name || '',
          description: data.description || '',
          discountType: data.discountType || 'percentage',
          discountValue: data.discountValue || 0,
          applicableTo: data.applicableTo || 'all',
          specificServices: data.specificServices || [],
          specificProducts: data.specificProducts || [],
          startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : new Date()),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : new Date()),
          isActive: data.isActive !== false,
          promotionCode: data.promotionCode || '',
          usageType: data.usageType || 'repeating',
          maxUses: data.maxUses || null,
          usageCount: data.usageCount || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        });
      });
      
      // Sort by createdAt descending
      promotionsList.sort((a, b) => b.createdAt - a.createdAt);
      
      setPromotions(promotionsList);
    } catch (err) {
      console.error('Error loading promotions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load services and products for display
  const loadServicesAndProducts = async () => {
    try {
      if (userBranch) {
        const services = await getBranchServices(userBranch);
        setAvailableServices(services || []);
        
        const productsResult = await productService.getProductsByBranch(userBranch);
        setAvailableProducts(productsResult?.products || []);
      }
    } catch (err) {
      console.error('Error loading services/products:', err);
    }
  };

  useEffect(() => {
    if (userBranch) {
      loadPromotions();
      loadServicesAndProducts();
    }
  }, [userBranch]);

  // Get promotion status
  const getPromotionStatus = (promotion) => {
    const now = new Date();
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);
    
    if (!promotion.isActive) {
      return { status: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
    
    if (now < startDate) {
      return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-700 border-blue-300' };
    }
    
    if (now > endDate) {
      return { status: 'expired', label: 'Expired', color: 'bg-red-100 text-red-700 border-red-300' };
    }
    
    return { status: 'active', label: 'Active', color: 'bg-green-100 text-green-700 border-green-300' };
  };

  // Filter promotions
  const filteredPromotions = useMemo(() => {
    let filtered = [...promotions];
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.promotionCode?.toLowerCase().includes(searchLower)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        const status = getPromotionStatus(p);
        return status.status === statusFilter;
      });
    }
    
    return filtered;
  }, [promotions, searchTerm, statusFilter]);

  // Get service/product names
  const getServiceName = (serviceId) => {
    const service = availableServices.find(s => s.id === serviceId);
    return service?.name || service?.serviceName || 'Unknown Service';
  };

  const getProductName = (productId) => {
    const product = availableProducts.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error loading promotions: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-gray-600">View active promotions and offers for {userBranchData?.branchName || 'your branch'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Megaphone className="w-8 h-8 text-primary-600" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search promotions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPromotions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No promotions found</p>
            <p className="text-sm mt-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'No promotions have been created for this branch yet'}
            </p>
          </div>
        ) : (
          filteredPromotions.map((promotion) => {
            const status = getPromotionStatus(promotion);
            return (
              <Card key={promotion.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-5 w-5 text-primary-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{promotion.title}</h3>
                      </div>
                      {promotion.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{promotion.description}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                      {status.status === 'active' && <CheckCircle className="h-3 w-3" />}
                      {status.status === 'upcoming' && <Clock className="h-3 w-3" />}
                      {status.status === 'expired' && <XCircle className="h-3 w-3" />}
                      {status.status === 'inactive' && <XCircle className="h-3 w-3" />}
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {/* Discount */}
                    <div className="flex items-center gap-2 text-sm">
                      <Percent className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">
                        <span className="font-semibold text-primary-600">
                          {promotion.discountType === 'percentage' 
                            ? `${promotion.discountValue}% OFF` 
                            : `₱${promotion.discountValue} OFF`}
                        </span>
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        {format(new Date(promotion.startDate), 'MMM dd, yyyy')} - {format(new Date(promotion.endDate), 'MMM dd, yyyy')}
                      </span>
                    </div>

                    {/* Promotion Code */}
                    {promotion.promotionCode && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                          {promotion.promotionCode}
                        </span>
                      </div>
                    )}

                    {/* Applicable To */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>
                        {promotion.applicableTo === 'all' 
                          ? 'All Services & Products'
                          : promotion.applicableTo === 'services'
                          ? 'Services Only'
                          : promotion.applicableTo === 'products'
                          ? 'Products Only'
                          : 'Specific Items'}
                      </span>
                    </div>

                    {/* Usage Info */}
                    {promotion.usageType === 'repeating' && promotion.maxUses && (
                      <div className="text-xs text-gray-500">
                        Used {promotion.usageCount || 0} / {promotion.maxUses} times
                      </div>
                    )}
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={() => {
                      setSelectedPromotion(promotion);
                      setShowDetailsModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedPromotion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-6 w-6 text-primary-600" />
                  <h2 className="text-xl font-bold text-gray-900">{selectedPromotion.title}</h2>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPromotion(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Status Badge */}
              <div className="mb-4">
                {(() => {
                  const status = getPromotionStatus(selectedPromotion);
                  return (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${status.color}`}>
                      {status.status === 'active' && <CheckCircle className="h-4 w-4" />}
                      {status.status === 'upcoming' && <Clock className="h-4 w-4" />}
                      {status.status === 'expired' && <XCircle className="h-4 w-4" />}
                      {status.status === 'inactive' && <XCircle className="h-4 w-4" />}
                      {status.label}
                    </span>
                  );
                })()}
              </div>

              {/* Description */}
              {selectedPromotion.description && (
                <div className="mb-4">
                  <p className="text-gray-700">{selectedPromotion.description}</p>
                </div>
              )}

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Discount</p>
                  <p className="font-semibold text-primary-600">
                    {selectedPromotion.discountType === 'percentage' 
                      ? `${selectedPromotion.discountValue}% OFF` 
                      : `₱${selectedPromotion.discountValue} OFF`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Promotion Code</p>
                  <p className="font-mono font-semibold text-gray-900">
                    {selectedPromotion.promotionCode || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Start Date</p>
                  <p className="text-gray-900">
                    {format(new Date(selectedPromotion.startDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">End Date</p>
                  <p className="text-gray-900">
                    {format(new Date(selectedPromotion.endDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Usage Type</p>
                  <p className="text-gray-900 capitalize">
                    {selectedPromotion.usageType === 'repeating' ? 'Repeating' : 'One-time'}
                  </p>
                </div>
                {selectedPromotion.usageType === 'repeating' && selectedPromotion.maxUses && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Usage Limit</p>
                    <p className="text-gray-900">
                      {selectedPromotion.usageCount || 0} / {selectedPromotion.maxUses} times
                    </p>
                  </div>
                )}
              </div>

              {/* Applicable To */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Applicable To</p>
                <p className="text-gray-900">
                  {selectedPromotion.applicableTo === 'all' 
                    ? 'All Services & Products'
                    : selectedPromotion.applicableTo === 'services'
                    ? 'Services Only'
                    : selectedPromotion.applicableTo === 'products'
                    ? 'Products Only'
                    : 'Specific Items'}
                </p>
              </div>

              {/* Specific Services */}
              {selectedPromotion.specificServices && selectedPromotion.specificServices.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Specific Services</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPromotion.specificServices.map((serviceId, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {getServiceName(serviceId)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Specific Products */}
              {selectedPromotion.specificProducts && selectedPromotion.specificProducts.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Specific Products</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPromotion.specificProducts.map((productId, idx) => (
                      <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                        {getProductName(productId)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPromotion(null);
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionistPromotions;

