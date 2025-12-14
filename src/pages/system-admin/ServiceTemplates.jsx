/**
 * Services Management Page - System Admin
 * Master service catalog that branches can configure pricing for
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Power, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAllServices,
  saveService,
  toggleServiceActive,
  deleteService,
  getServiceCategories
} from '../../services/serviceManagementService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ServiceModal from '../../components/service/ServiceModal';
import toast from 'react-hot-toast';

const ServiceTemplates = () => {
  const { currentUser } = useAuth();
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchTerm, selectedCategory, showArchived]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const data = await getAllServices();
      setServices(data);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // Filter by active status (show only active by default)
    if (!showArchived) {
      filtered = filtered.filter(service => service.isActive === true);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    setFilteredServices(filtered);
  };

  const handleCreateService = () => {
    setSelectedService(null);
    setShowModal(true);
  };

  const handleEditService = (service) => {
    setSelectedService(service);
    setShowModal(true);
  };

  const handleSubmit = async (serviceData) => {
    try {
      setSaving(true);
      await saveService(serviceData, currentUser);
      await fetchServices();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving service:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (service) => {
    try {
      await toggleServiceActive(service.id, !service.isActive, currentUser);
      await fetchServices();
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Delete service "${service.name}"?\n\nThis will remove it from all branches.`)) {
      return;
    }

    try {
      await deleteService(service.id, currentUser);
      await fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading services..." />;
  }

  const categories = ['All', ...getServiceCategories()];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-600">Master catalog of services for all branches</p>
        </div>
        <button
          onClick={handleCreateService}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Service
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
          <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          </div>

          {/* Show Archived Checkbox */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-300">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Show Archived
              </span>
            </label>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
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
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No services found
                  </td>
                </tr>
        ) : (
          filteredServices.map(service => (
                  <tr key={service.id} className={`hover:bg-gray-50 transition-colors ${!service.isActive ? 'opacity-50' : ''}`}>
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
                    <button
                      onClick={() => handleToggle(service)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        service.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                        <Power className="w-3 h-3" />
                        {service.isActive ? 'Active' : 'Archived'}
                    </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEditService(service)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
            Showing {filteredServices.length} {showArchived ? 'services' : 'active services'}
          </span>
          <div className="flex items-center gap-4 text-gray-600">
            <span>{services.filter(s => s.isActive).length} active</span>
            <span>•</span>
            <span>{services.filter(s => !s.isActive).length} archived</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ServiceModal
          isOpen={showModal}
          service={selectedService}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          loading={saving}
        />
      )}
    </div>
  );
};

export default ServiceTemplates;
