/**
 * Services Management Page - System Admin
 * Master service catalog that branches can configure pricing for
 */

import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Power, Search, Scissors, Upload } from 'lucide-react';
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
import ConfirmModal from '../../components/ui/ConfirmModal';
import ImportModal from '../../components/ImportModal';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const ServiceTemplates = () => {
  const { currentUser } = useAuth();
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showArchived, setShowArchived] = useState(false);

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'System Admin - Service Catalog | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();
    setCurrentPage(1); // Reset to first page when filters change
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

  // Pagination calculations
  const totalItems = filteredServices.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedServices = filteredServices.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, showArchived]);

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

  const handleDelete = (service) => {
    setServiceToDelete(service);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    try {
      setDeleting(true);
      await deleteService(serviceToDelete.id, currentUser);
      await fetchServices();
      setShowDeleteModal(false);
      setServiceToDelete(null);
    } catch (error) {
      console.error('Error deleting service:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Download service import template
  const downloadServiceTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      // Headers
      ['Service Name', 'Category', 'Duration (minutes)', 'Description', 'Is Chemical (Yes/No)', 'Status (Active/Inactive)', 'Image URL'],
      // Sample data rows
      ['Basic Haircut', 'Haircut and Blowdry', '30', 'Standard haircut service', 'No', 'Active', ''],
      ['Hair Color Treatment', 'Hair Coloring', '120', 'Full hair coloring service', 'Yes', 'Active', ''],
      ['Manicure', 'Nail Care / Waxing / Threading', '45', 'Nail care service', 'No', 'Active', '']
    ]);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Service Name
      { wch: 30 }, // Category
      { wch: 20 }, // Duration
      { wch: 40 }, // Description
      { wch: 20 }, // Is Chemical
      { wch: 20 }, // Status
      { wch: 50 }  // Image URL
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Services');

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Service_Import_Template_${dateStr}.xlsx`;

    // Download file
    XLSX.writeFile(workbook, filename);

    toast.success('Template downloaded successfully!');
  };

  // Handle service import
  const handleImportServices = async (importData) => {
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      const validCategories = getServiceCategories();

      for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        try {
          // Map Excel columns to service data structure (case-insensitive)
          const serviceName = (row['Service Name'] || row['service name'] || '').trim();
          const category = (row['Category'] || row['category'] || '').trim();
          const duration = parseInt(row['Duration (minutes)'] || row['Duration'] || row['duration (minutes)'] || row['duration'] || 30);
          const description = (row['Description'] || row['description'] || '').trim();
          const isChemicalInput = (row['Is Chemical (Yes/No)'] || row['Is Chemical'] || row['is chemical'] || row['IsChemical'] || 'No').trim().toLowerCase();
          const statusInput = (row['Status (Active/Inactive)'] || row['Status'] || row['status'] || 'Active').trim();
          const imageURL = (row['Image URL'] || row['Image'] || row['image url'] || row['ImageURL'] || '').trim();

          // Validate required fields
          if (!serviceName) {
            throw new Error('Service Name is required');
          }
          if (!category) {
            throw new Error('Category is required');
          }
          if (!validCategories.includes(category)) {
            throw new Error(`Invalid category. Valid categories are: ${validCategories.join(', ')}`);
          }
          if (isNaN(duration) || duration <= 0) {
            throw new Error('Duration must be a positive number');
          }

          // Parse boolean fields
          const isChemical = isChemicalInput === 'yes' || isChemicalInput === 'y' || isChemicalInput === 'true' || isChemicalInput === '1';
          const isActive = statusInput.toLowerCase() === 'active' || statusInput.toLowerCase() === 'true' || statusInput === '1';

          // Create service data
          const serviceData = {
            name: serviceName,
            category: category,
            duration: duration,
            description: description || '',
            isChemical: isChemical,
            isActive: isActive,
            imageURL: imageURL || ''
          };

          // Save service
          await saveService(serviceData, currentUser);
          successCount++;
        } catch (err) {
          errorCount++;
          errors.push(`Row ${i + 2}: ${err.message || 'Unknown error'}`);
        }
      }

      // Reload services
      await fetchServices();

      if (errorCount > 0) {
        const errorMessage = `Imported ${successCount} services successfully. ${errorCount} errors occurred:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''}`;
        toast.error(errorMessage, { duration: 8000 });
        return { success: false, error: errorMessage };
      }

      toast.success(`Successfully imported ${successCount} services!`);
      setShowImportModal(false);
      return { success: true };
    } catch (err) {
      console.error('Import error:', err);
      toast.error(`Import failed: ${err.message}`);
      return { success: false, error: err.message };
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Import Services
          </button>
          <button
            onClick={handleCreateService}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Service
          </button>
        </div>
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
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Scissors className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
                      <p className="text-gray-500 mb-4">
                        {filteredServices.length === 0 
                          ? "Try adjusting your search or filter criteria"
                          : "No services match your current filters"
                        }
                      </p>
                      <Button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('All');
                          setShowArchived(false);
                        }}
                        className="bg-[#160B53] hover:bg-[#12094A] text-white"
                      >
                        Clear All Filters
                      </Button>
                    </div>
                  </td>
                </tr>
        ) : (
                paginatedServices.map(service => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {service.imageURL ? (
                          <img 
                              className="h-10 w-10 rounded-lg object-cover"
                            src={service.imageURL} 
                            alt={service.name}
                          />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                              <Scissors className="h-5 w-5 text-gray-400" />
                            </div>
                        )}
                        </div>
                        <div className="ml-4 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 break-words">
                      {service.name}
                          </div>
                          {service.description && (
                            <div className="text-sm text-gray-500 break-words">
                              {service.description?.substring(0, 60)}...
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        <div className="break-words">{service.category}</div>
                      {service.isChemical && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            Chemical
                        </span>
                      )}
                    </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="break-words">{service.duration} min</div>
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
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEditService(service)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit"
                  >
                          <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(service)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                  >
                          <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                    </td>
                  </tr>
          ))
        )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="bg-white px-4 py-3 border-t border-gray-200">
          <div className="flex flex-col space-y-3">
            {/* Top row: Items per page and page info */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-xs text-gray-600">per page</span>
              </div>

              <div className="text-xs text-gray-600">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{' '}
                <span className="font-medium">{totalItems}</span> results
              </div>
            </div>

            {/* Bottom row: Navigation buttons */}
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs min-w-[40px]"
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs min-w-[40px]"
              >
                Prev
              </Button>
              
              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage <= 2) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 1) {
                    pageNum = totalPages - 2 + i;
                  } else {
                    pageNum = currentPage - 1 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2 py-1 text-xs min-w-[32px] ${
                        currentPage === pageNum 
                          ? 'bg-[#160B53] hover:bg-[#12094A] text-white' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
      </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs min-w-[40px]"
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs min-w-[40px]"
              >
                Last
              </Button>
          </div>
        </div>
      </div>
      </Card>


      {/* Service Modal */}
      {showModal && (
        <ServiceModal
          isOpen={showModal}
          service={selectedService}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          loading={saving}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setServiceToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Service"
        message={`Are you sure you want to delete "${serviceToDelete?.name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      >
        <p className="text-sm text-red-600 mt-2 font-medium">
          This will permanently remove the service from all branches. This action cannot be undone.
        </p>
      </ConfirmModal>

      {/* Import Services Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportServices}
        templateColumns={[
          'Service Name',
          'Category',
          'Duration (minutes)',
          'Description',
          'Is Chemical (Yes/No)',
          'Status (Active/Inactive)',
          'Image URL'
        ]}
        templateName="Service_Import"
        sampleData={[
          {
            'Service Name': 'Basic Haircut',
            'Category': 'Haircut and Blowdry',
            'Duration (minutes)': '30',
            'Description': 'Standard haircut service',
            'Is Chemical (Yes/No)': 'No',
            'Status (Active/Inactive)': 'Active',
            'Image URL': ''
          },
          {
            'Service Name': 'Hair Color Treatment',
            'Category': 'Hair Coloring',
            'Duration (minutes)': '120',
            'Description': 'Full hair coloring service',
            'Is Chemical (Yes/No)': 'Yes',
            'Status (Active/Inactive)': 'Active',
            'Image URL': ''
          },
          {
            'Service Name': 'Manicure',
            'Category': 'Nail Care / Waxing / Threading',
            'Duration (minutes)': '45',
            'Description': 'Nail care service',
            'Is Chemical (Yes/No)': 'No',
            'Status (Active/Inactive)': 'Active',
            'Image URL': ''
          }
        ]}
        validationRules={{
          'Service Name': { required: true },
          'Category': { required: true },
          'Duration (minutes)': { required: true, type: 'number' }
        }}
        title="Import Services"
        customDownloadTemplate={downloadServiceTemplate}
      />
    </div>
  );
};

export default ServiceTemplates;
