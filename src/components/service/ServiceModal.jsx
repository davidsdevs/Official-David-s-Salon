/**
 * Service Modal Component
 * For creating/editing global services (System Admin)
 */

import { useState, useEffect } from 'react';
import { Edit, Plus, X, Upload, XCircle } from 'lucide-react';
import { getServiceCategories } from '../../services/serviceManagementService';
import { uploadToCloudinary, validateImageFile } from '../../services/imageService';
import toast from 'react-hot-toast';
import Button from '../ui/Button';

const ServiceModal = ({
  isOpen,
  service,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Haircut and Blowdry',
    duration: 30,
    commissionPercentage: 5,
    imageURL: '',
    isChemical: false,
    isActive: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        category: service.category || 'Haircut and Blowdry',
        duration: service.duration || 30,
        commissionPercentage: typeof service.commissionPercentage === 'number' ? service.commissionPercentage : 5,
        imageURL: service.imageURL || '',
        isChemical: service.isChemical || false,
        isActive: service.isActive !== undefined ? service.isActive : true
      });
      setImagePreview(service.imageURL || null);
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'Haircut and Blowdry',
        duration: 30,
        commissionPercentage: 5,
        imageURL: '',
        isChemical: false,
        isActive: true
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [service, isOpen]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && validateImageFile(file)) {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, imageURL: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let imageURL = formData.imageURL;
      
      // Upload image if new file selected
      if (imageFile) {
        setUploading(true);
        imageURL = await uploadToCloudinary(imageFile, 'services');
        setUploading(false);
      }
      
      const commissionValue = Number(formData.commissionPercentage);

      onSubmit({
        ...formData,
        commissionPercentage: Number.isFinite(commissionValue) ? commissionValue : 5,
        imageURL,
        id: service?.id
      });
    } catch (error) {
      setUploading(false);
      toast.error('Failed to upload image');
    }
  };

  if (!isOpen) return null;

  const categories = getServiceCategories();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden max-w-2xl min-h-0">
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="bg-[#160B53] text-white p-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {service ? (
                  <Edit className="h-5 w-5 text-white" />
                ) : (
                  <Plus className="h-5 w-5 text-white" />
                )}
                <h2 className="text-xl font-semibold text-white">
                  {service ? 'Edit Service' : 'Create Service'}
                </h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading}
                className="text-white border-white hover:bg-white hover:text-[#160B53]"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto flex-1 min-h-0 space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Services are global and shared across all branches. Each branch will configure their own pricing.
              </p>
            </div>

            {/* Service Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Basic Haircut, Manicure, Facial Treatment"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Describe what this service includes..."
              />
            </div>

            {/* Category and Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  required
                  min="5"
                  step="5"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="30"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission (%) *</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="1"
                  value={formData.commissionPercentage}
                  onChange={(e) => setFormData({ ...formData, commissionPercentage: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
            </div>

            {/* Chemical Service Flag */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isChemical}
                  onChange={(e) => setFormData({ ...formData, isChemical: e.target.checked })}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Chemical Service</span>
                  <p className="text-xs text-gray-600">Check if this service uses chemicals (e.g., hair color, perm, relaxer)</p>
                </div>
              </label>
            </div>

            {/* Service Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Image
              </label>
              
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Service preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="service-image"
                  />
                  <label htmlFor="service-image" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload service image
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 5MB
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Active Service</span>
                  <p className="text-xs text-gray-500">Inactive services won't be available to branches</p>
                </div>
              </label>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-4 pt-8 border-t-2 border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(loading || uploading) ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {uploading ? 'Uploading...' : 'Saving...'}
                  </>
                ) : (
                  service ? 'Update Service' : 'Create Service'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceModal;

