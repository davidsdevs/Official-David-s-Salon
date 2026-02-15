/**
 * Promotional Banners Configuration - System Admin
 * Manage promotional banners for mobile app with date ranges
 */

import { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar,
  Eye,
  EyeOff,
  Upload,
  X,
  AlertCircle
} from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { uploadToCloudinary, validateImageFile } from '../../services/imageService';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const PromotionalBanners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewBanner, setPreviewBanner] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageFile: null,
    imagePreview: null,
    imageUrl: '',
    startDate: '',
    endDate: '',
    isActive: true,
    priority: 1
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const bannersRef = collection(db, 'promotionalBanners');
      const snapshot = await getDocs(bannersRef);
      
      const bannersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate?.() || new Date(doc.data().startDate),
        endDate: doc.data().endDate?.toDate?.() || new Date(doc.data().endDate),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
      }));
      
      // Sort by priority (higher first) then by start date
      bannersData.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.startDate - a.startDate;
      });
      
      setBanners(bannersData);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file)) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        imageFile: file,
        imagePreview: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error('End date must be after start date');
      return;
    }
    
    if (!editingBanner && !formData.imageFile) {
      toast.error('Please select an image');
      return;
    }

    try {
      setUploading(true);
      
      let imageUrl = formData.imageUrl;
      
      // Upload new image if selected
      if (formData.imageFile) {
        imageUrl = await uploadToCloudinary(formData.imageFile, 'promotional-banners');
      }
      
      const bannerData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        imageUrl,
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(formData.endDate)),
        isActive: formData.isActive,
        priority: parseInt(formData.priority) || 1,
        updatedAt: Timestamp.now()
      };
      
      if (editingBanner) {
        // Update existing banner
        await updateDoc(doc(db, 'promotionalBanners', editingBanner.id), bannerData);
        toast.success('Banner updated successfully');
      } else {
        // Create new banner
        bannerData.createdAt = Timestamp.now();
        await addDoc(collection(db, 'promotionalBanners'), bannerData);
        toast.success('Banner created successfully');
      }
      
      handleCloseModal();
      fetchBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error('Failed to save banner');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || '',
      imageFile: null,
      imagePreview: null,
      imageUrl: banner.imageUrl,
      startDate: banner.startDate.toISOString().split('T')[0],
      endDate: banner.endDate.toISOString().split('T')[0],
      isActive: banner.isActive,
      priority: banner.priority || 1
    });
    setShowModal(true);
  };

  const handleDelete = async (bannerId) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    
    try {
      await deleteDoc(doc(db, 'promotionalBanners', bannerId));
      toast.success('Banner deleted successfully');
      fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error('Failed to delete banner');
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      await updateDoc(doc(db, 'promotionalBanners', banner.id), {
        isActive: !banner.isActive,
        updatedAt: Timestamp.now()
      });
      toast.success(`Banner ${!banner.isActive ? 'activated' : 'deactivated'}`);
      fetchBanners();
    } catch (error) {
      console.error('Error toggling banner:', error);
      toast.error('Failed to update banner');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBanner(null);
    setFormData({
      title: '',
      description: '',
      imageFile: null,
      imagePreview: null,
      imageUrl: '',
      startDate: '',
      endDate: '',
      isActive: true,
      priority: 1
    });
  };

  const getBannerStatus = (banner) => {
    const now = new Date();
    const start = new Date(banner.startDate);
    const end = new Date(banner.endDate);
    
    if (!banner.isActive) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
    
    if (now < start) {
      return { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 border-blue-300' };
    }
    
    if (now > end) {
      return { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-300' };
    }
    
    return { label: 'Active', color: 'bg-green-100 text-green-700 border-green-300' };
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Promotional Banners</h1>
          <p className="text-gray-600 mt-1">Manage promotional banners for mobile app</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Banner
        </button>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Banner Display Rules:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Only active banners within their date range will be displayed</li>
            <li>Higher priority banners are shown first</li>
            <li>Recommended image size: 1200x400 pixels (3:1 ratio)</li>
            <li>Banners automatically activate/deactivate based on date range</li>
          </ul>
        </div>
      </div>

      {/* Banners Grid */}
      {banners.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No banners yet</h3>
          <p className="text-gray-600 mb-4">Create your first promotional banner for holidays and special events</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {banners.map((banner) => {
            const status = getBannerStatus(banner);
            
            return (
              <div
                key={banner.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Banner Image */}
                <div className="relative aspect-[3/1] bg-gray-100">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setPreviewBanner(banner)}
                  />
                  <button
                    onClick={() => setPreviewBanner(banner)}
                    className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-colors"
                  >
                    <Eye className="w-4 h-4 text-gray-700" />
                  </button>
                  
                  {/* Status Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  
                  {/* Priority Badge */}
                  {banner.priority > 1 && (
                    <div className="absolute bottom-2 left-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-300">
                        Priority: {banner.priority}
                      </span>
                    </div>
                  )}
                </div>

                {/* Banner Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">{banner.title}</h3>
                  
                  {banner.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{banner.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDate(banner.startDate)} - {formatDate(banner.endDate)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(banner)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        banner.isActive
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {banner.isActive ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Activate
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(banner)}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingBanner ? 'Edit Banner' : 'Add New Banner'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banner Image * <span className="text-xs text-gray-500">(Recommended: 1200x400px)</span>
                  </label>
                  {formData.imagePreview || formData.imageUrl ? (
                    <div className="relative">
                      <img
                        src={formData.imagePreview || formData.imageUrl}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, imageFile: null, imagePreview: null, imageUrl: '' }))}
                        className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 text-gray-400 mb-3" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageSelect}
                      />
                    </label>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Valentine's Day Special"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the promotion..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      min={formData.startDate}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority (Higher = Shows First)
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    min="1"
                    max="10"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">1 = Normal, 10 = Highest priority</p>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Active (banner will be displayed within date range)
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewBanner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl w-full">
            <button
              onClick={() => setPreviewBanner(null)}
              className="absolute -top-12 right-0 bg-white p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
            
            <img
              src={previewBanner.imageUrl}
              alt={previewBanner.title}
              className="w-full rounded-lg"
            />
            
            <div className="bg-white rounded-lg p-4 mt-4">
              <h3 className="text-lg font-bold text-gray-900">{previewBanner.title}</h3>
              {previewBanner.description && (
                <p className="text-sm text-gray-600 mt-2">{previewBanner.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(previewBanner.startDate)} - {formatDate(previewBanner.endDate)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getBannerStatus(previewBanner).color}`}>
                  {getBannerStatus(previewBanner).label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionalBanners;
