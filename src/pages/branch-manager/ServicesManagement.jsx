/**
 * Services Management Page
 * For Branch Managers to configure which global services to offer and set prices
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBranchServices, 
  getAllServicesWithBranchConfig,
  setBranchPrice,
  disableBranchService,
  getServiceCategories
} from '../../services/branchServicesService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import BranchServicePriceModal from '../../components/branch/BranchServicePriceModal';
import toast from 'react-hot-toast';

const ServicesManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [allServices, setAllServices] = useState([]);
  const [offeredServices, setOfferedServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [serviceToDisable, setServiceToDisable] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'offered'

  useEffect(() => {
    if (userBranch) {
      fetchServices();
    }
  }, [userBranch]);

  useEffect(() => {
    applyFilters();
  }, [allServices, offeredServices, searchTerm, categoryFilter, filterMode]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Get all services with branch config
      const allData = await getAllServicesWithBranchConfig(userBranch);
      setAllServices(allData);
      
      // Get only offered services
      const offeredData = await getBranchServices(userBranch);
      setOfferedServices(offeredData);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // Start with all or offered based on filter mode
    let filtered = filterMode === 'offered' ? [...offeredServices] : [...allServices];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    setFilteredServices(filtered);
  };

  const handleSetPrice = (service) => {
    setSelectedService(service);
    setShowPriceModal(true);
  };

  const handlePriceSubmit = async (price) => {
    if (!selectedService) return;
    
    try {
      setSaving(true);
      await setBranchPrice(selectedService.id, userBranch, price, currentUser);
      setShowPriceModal(false);
      await fetchServices();
    } catch (error) {
      console.error('Error setting price:', error);
    } finally {
      setSaving(false);
    }
  };


  const handleDisableService = (service) => {
    setServiceToDisable(service);
    setShowDisableModal(true);
  };

  const confirmDisable = async () => {
    if (!serviceToDisable) return;
    
    try {
      setSaving(true);
      await disableBranchService(serviceToDisable.id, userBranch, currentUser);
      await fetchServices();
      setShowDisableModal(false);
    } catch (error) {
      console.error('Error disabling service:', error);
    } finally {
      setSaving(false);
      setServiceToDisable(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const categories = getServiceCategories();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Services</h1>
          <p className="text-gray-600">Configure which services to offer and set branch pricing</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        {/* Filter Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Available ({allServices.length})
          </button>
          <button
            onClick={() => setFilterMode('offered')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === 'offered'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            My Services ({offeredServices.length})
          </button>
        </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              categoryFilter === 'all'
                ? 'bg-primary-100 text-primary-700 border border-primary-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            All
          </button>
            {categories.map(category => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === category
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
            ))}
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
        {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
              {filterMode === 'offered' 
                      ? 'You haven\'t offered any services yet. Switch to "All Available" to add services.' 
                : 'No services found'}
                  </td>
                </tr>
        ) : (
          filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {service.imageURL && (
                          <img 
                            src={service.imageURL} 
                            alt={service.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                    {service.name}
                          </div>
                          {service.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">
                              {service.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {service.category}
                      </span>
                    {service.isChemical && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Chemical
                      </span>
                    )}
                  </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {service.duration} min
                    </td>
                    <td className="px-6 py-4">
                      {service.isOfferedByBranch ? (
                        <span className="text-sm font-semibold text-gray-900">
                          ₱{service.price?.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">
                          Not set
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {service.isOfferedByBranch ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Offered
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Available
                        </span>
                )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                {service.isOfferedByBranch ? (
                  <>
                    <button
                      onClick={() => handleSetPrice(service)}
                      disabled={saving}
                              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Edit Price"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDisableService(service)}
                      disabled={saving}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Remove Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleSetPrice(service)}
                    disabled={saving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Service
                  </button>
                )}
              </div>
                    </td>
                  </tr>
          ))
        )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Showing {filteredServices.length} {filterMode === 'offered' ? 'services offered' : 'available services'}
          </span>
          <span className="text-gray-600">
            {offeredServices.length} of {allServices.length} services configured
          </span>
        </div>
      </div>

      {/* Price Modal */}
      <BranchServicePriceModal
        isOpen={showPriceModal}
        service={selectedService}
        onClose={() => setShowPriceModal(false)}
        onSubmit={handlePriceSubmit}
        loading={saving}
      />

      {/* Disable Confirmation Modal */}
      <ConfirmModal
        isOpen={showDisableModal}
        onClose={() => {
          if (!saving) {
            setShowDisableModal(false);
            setServiceToDisable(null);
          }
        }}
        onConfirm={confirmDisable}
        title="Disable Service"
        message={`Are you sure you want to stop offering "${serviceToDisable?.name}"?`}
        confirmText="Disable"
        cancelText="Cancel"
        type="danger"
        loading={saving}
      />
    </div>
  );
};

export default ServicesManagement;
