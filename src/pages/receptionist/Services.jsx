/**
 * Services Page - Receptionist
 * View-only page to see available services at the branch
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, Scissors, Clock, Banknote, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBranchServices } from '../../services/branchServicesService';
import { SERVICE_CATEGORIES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

const ReceptionistServices = () => {
  const { userBranch } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (userBranch) {
      fetchServices();
    }
  }, [userBranch]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const branchServices = await getBranchServices(userBranch);
      setServices(branchServices);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    let filtered = [...services];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    return filtered;
  }, [services, searchTerm, categoryFilter]);

  // Get unique categories from services
  const availableCategories = useMemo(() => {
    const categories = new Set(services.map(s => s.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [services]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        <p className="text-gray-600">View available services at this branch</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
              categoryFilter !== 'all'
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {categoryFilter !== 'all' && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary-600 text-white">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="pt-4 border-t border-gray-200">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {availableCategories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setSearchTerm('');
                }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <Card className="p-8 text-center">
          <Scissors className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || categoryFilter !== 'all'
              ? 'No services found matching your filters'
              : 'No services available at this branch'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <Card key={service.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="space-y-3">
                {/* Service Icon/Image */}
                {service.catalogIcon && (
                  <div className="w-full h-40 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={service.catalogIcon}
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Service Info */}
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {service.description}
                    </p>
                  )}
                </div>

                {/* Service Details */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {service.category && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {service.category}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    {service.duration && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{service.duration} min</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1 text-lg font-bold text-primary-600">
                      <Banknote className="w-4 h-4" />
                      <span>₱{service.price?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-gray-600 text-center">
        Showing {filteredServices.length} of {services.length} services
      </div>
    </div>
  );
};

export default ReceptionistServices;


