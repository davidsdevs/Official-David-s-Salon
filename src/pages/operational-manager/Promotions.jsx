/**
 * Operational Manager System-Wide Promotions Management Page
 * Creates promotions that can be used in ANY branch across the system
 */

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Tag, Globe, Building2, Mail, Eye, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllPromotions, createPromotion, updatePromotion, deletePromotion } from '../../services/promotionService';
import { getClients } from '../../services/clientService';
import { sendPromotionEmail } from '../../services/emailService';
import { cloudinaryService } from '../../services/cloudinaryService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const OperationalManagerPromotions = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState([]);
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);

  // Image upload states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Email states
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [isSending, setIsSending] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promotionCode: '',
    discountType: 'percentage',
    discountValue: '',
    targetSegment: 'all',
    applicableTo: 'all',
    specificServices: [],
    specificProducts: [],
    usageType: 'repeating',
    maxUses: '',
    startDate: '',
    endDate: '',
    isActive: true,
    imageUrl: ''
  });

  useEffect(() => {
    fetchPromotions();
    loadClients();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      // Get all promotions, but filter for system-wide (branchId === null)
      const allPromos = await getAllPromotions();
      // Filter for active and system-wide promotions only (branchId is null)
      const systemWidePromos = allPromos.filter(promo =>
        (promo.branchId === null || promo.branchId === undefined) &&
        (promo.isActive !== false)
      );
      setPromotions(systemWidePromos);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  // Load all clients for email sending
  const loadClients = async () => {
    try {
      const clientsList = await getClients();
      setClients(clientsList);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const generatePromotionCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Handle image file selection
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload image to Cloudinary
  const uploadPromotionImage = async (file) => {
    if (!file) return null;

    try {
      setUploadingImage(true);

      const result = await cloudinaryService.uploadImage(file, 'promotions');

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload image');
      }

      return result.url;
    } catch (err) {
      console.error('Error uploading image:', err);
      throw new Error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Generate email preview HTML
  const generateEmailPreview = (promotion) => {
    const discountText = promotion.discountType === 'percentage'
      ? `${promotion.discountValue}% OFF`
      : `₱${promotion.discountValue} OFF`;

    const startDate = promotion.startDate instanceof Date
      ? promotion.startDate
      : new Date(promotion.startDate);
    const endDate = promotion.endDate instanceof Date
      ? promotion.endDate
      : new Date(promotion.endDate);

    const startDateFormatted = format(startDate, 'MMMM d, yyyy');
    const endDateFormatted = format(endDate, 'MMMM d, yyyy');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #160B53, #12094A); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: white; }
          .promotion-image { width: 100%; max-height: 300px; object-fit: cover; }
          .promotion-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .discount { font-size: 32px; font-weight: bold; color: #28a745; margin: 15px 0; }
          .code-box { background: #160B53; color: white; padding: 15px 25px; border-radius: 8px; display: inline-block; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 15px 0; }
          .validity { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; background: #f8f9fa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🎉 Special Promotion</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">David's Salon</p>
          </div>
          ${promotion.imageUrl || imagePreview ? `<img src="${promotion.imageUrl || imagePreview}" alt="Promotion" class="promotion-image" />` : ''}
          <div class="content">
            <h2 style="color: #160B53; margin-top: 0; text-align: center;">Hello [Client Name],</h2>
            <p style="text-align: center;">We have an exciting promotion just for you!</p>
            
            <div class="promotion-box">
              <h3 style="color: #160B53; margin-top: 0; font-size: 24px;">${promotion.name || 'Promotion Title'}</h3>
              <p style="font-size: 16px;">${promotion.description || 'Promotion description goes here.'}</p>
              <div class="discount">${discountText}</div>
              ${promotion.promotionCode ? `<div class="code-box">${promotion.promotionCode}</div>` : ''}
            </div>
            
            <div class="validity">
              <h4 style="margin-top: 0; color: #856404;">📅 Validity Period</h4>
              <p style="margin: 0; color: #856404;">
                <strong>From:</strong> ${startDateFormatted}<br>
                <strong>Until:</strong> ${endDateFormatted}
              </p>
            </div>
            
            <p style="text-align: center;"><strong>Available at:</strong> All Branches</p>
            <p style="text-align: center; font-size: 16px;">Don't miss out on this amazing offer!<br>Visit us soon to take advantage of this promotion.</p>
            
            <p style="text-align: center;">We look forward to seeing you! 💜</p>
          </div>
          <div class="footer">
            <p>This is an automated email from David's Salon.<br>Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Show email preview
  const handleShowEmailPreview = (promotion) => {
    const previewHtml = generateEmailPreview(promotion || formData);
    setEmailPreviewHtml(previewHtml);
    setIsEmailPreviewOpen(true);
  };

  // Open send email modal
  const handleOpenSendModal = (promotion) => {
    setSelectedPromotion(promotion);
    setSelectedClients(new Set());
    setIsSendModalOpen(true);
  };

  // Send promotion emails to selected clients
  const handleSendPromotion = async () => {
    if (!selectedPromotion || selectedClients.size === 0) {
      toast.error('Please select at least one client');
      return;
    }

    try {
      setIsSending(true);
      const clientsToSend = clients.filter(c => selectedClients.has(c.id) && c.email);

      let successCount = 0;
      let failCount = 0;

      // Convert promotion for email (use 'title' field expected by sendPromotionEmail)
      const promotionForEmail = {
        ...selectedPromotion,
        title: selectedPromotion.name, // Map name to title for email service
        branchId: null // System-wide
      };

      for (const client of clientsToSend) {
        try {
          const result = await sendPromotionEmail(promotionForEmail, client);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`Failed to send to ${client.email}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Promotion sent to ${successCount} client(s)${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      } else {
        toast.error('Failed to send promotion emails');
      }

      setIsSendModalOpen(false);
      setSelectedPromotion(null);
      setSelectedClients(new Set());
    } catch (error) {
      console.error('Error sending promotion:', error);
      toast.error('Failed to send promotion');
    } finally {
      setIsSending(false);
    }
  };

  const handleCreate = () => {
    setSelectedPromotion(null);
    const code = generatePromotionCode();
    setFormData({
      name: '',
      description: '',
      promotionCode: code,
      discountType: 'percentage',
      discountValue: '',
      targetSegment: 'all',
      applicableTo: 'all',
      specificServices: [],
      specificProducts: [],
      usageType: 'repeating',
      maxUses: '',
      startDate: '',
      endDate: '',
      isActive: true,
      imageUrl: ''
    });
    setImageFile(null);
    setImagePreview('');
    setShowModal(true);
  };

  const handleEdit = (promotion) => {
    setSelectedPromotion(promotion);
    setFormData({
      name: promotion.name || '',
      description: promotion.description || '',
      promotionCode: promotion.promotionCode || generatePromotionCode(),
      discountType: promotion.discountType || 'percentage',
      discountValue: promotion.discountValue || '',
      targetSegment: promotion.targetSegment || 'all',
      applicableTo: promotion.applicableTo || 'all',
      specificServices: promotion.specificServices || [],
      specificProducts: promotion.specificProducts || [],
      usageType: promotion.usageType || 'repeating',
      maxUses: promotion.maxUses || '',
      startDate: promotion.startDate ? new Date(promotion.startDate).toISOString().split('T')[0] : '',
      endDate: promotion.endDate ? new Date(promotion.endDate).toISOString().split('T')[0] : '',
      isActive: promotion.isActive !== false,
      imageUrl: promotion.imageUrl || ''
    });
    setImageFile(null);
    setImagePreview(promotion.imageUrl || '');
    setShowModal(true);
  };

  const handleDelete = (promotion) => {
    setSelectedPromotion(promotion);
    setShowDeleteModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.promotionCode || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      // Upload image if selected
      let imageUrl = formData.imageUrl || '';
      if (imageFile) {
        try {
          imageUrl = await uploadPromotionImage(imageFile);
        } catch (uploadErr) {
          toast.error('Failed to upload image. Please try again.');
          return;
        }
      }

      const promotionData = {
        ...formData,
        branchId: null, // Always null for system-wide promotions
        discountValue: parseFloat(formData.discountValue),
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
        imageUrl: imageUrl
      };

      if (selectedPromotion) {
        await updatePromotion(selectedPromotion.id, promotionData, currentUser);
        toast.success('Promotion updated successfully');
      } else {
        await createPromotion(promotionData, currentUser);
        toast.success('Promotion created successfully');
      }

      setShowModal(false);
      setImageFile(null);
      setImagePreview('');
      await fetchPromotions();
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error('Failed to save promotion');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePromotion(selectedPromotion.id, currentUser);
      setShowDeleteModal(false);
      setSelectedPromotion(null);
      await fetchPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast.error('Failed to delete promotion');
    }
  };

  const isActive = (promotion) => {
    if (!promotion.isActive) return false;
    const now = new Date();
    const start = promotion.startDate?.toDate ? promotion.startDate.toDate() : new Date(promotion.startDate);
    const end = promotion.endDate?.toDate ? promotion.endDate.toDate() : new Date(promotion.endDate);
    return now >= start && now <= end;
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
          <h1 className="text-2xl font-bold text-gray-900">System-Wide Promotions</h1>
          <p className="text-gray-600">Create promotions that can be used across all branches</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create System-Wide Promotion
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">System-Wide Promotions</p>
          <p>These promotions are available in ALL branches. When you create a promotion here, it can be used by any branch in the system. Perfect for company-wide campaigns and special events.</p>
        </div>
      </div>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Globe className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No system-wide promotions created yet</p>
            <p className="text-sm mt-2">Create your first system-wide promotion to get started</p>
          </div>
        ) : (
          promotions.map((promotion) => (
            <Card
              key={promotion.id}
              className="overflow-hidden hover:shadow-xl transition-all duration-300 group relative min-h-[320px] flex flex-col border-0"
              style={promotion.imageUrl ? {
                backgroundImage: `url(${promotion.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}
            >
              {/* Overlay for readability */}
              <div className={`absolute inset-0 z-0 transition-opacity duration-300 ${promotion.imageUrl ? 'bg-black/60 group-hover:bg-black/50' : 'bg-gradient-to-br from-[#160B53] to-[#2D1B4E]'}`}></div>

              <div className="p-6 flex flex-col h-full relative z-10 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-5 w-5 text-blue-400" />
                      <h3 className="text-xl font-bold drop-shadow-md">{promotion.name}</h3>
                    </div>
                    {promotion.description && (
                      <p className={`text-sm line-clamp-2 ${promotion.imageUrl ? 'text-gray-100' : 'text-blue-100'}`}>{promotion.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full backdrop-blur-md border ${isActive(promotion)
                      ? 'bg-green-500/20 border-green-500/50 text-green-300'
                      : 'bg-red-500/20 border-red-500/50 text-red-300'
                    }`}>
                    {isActive(promotion) ? 'Active' : 'Expired'}
                  </span>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                      <Tag className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-black tracking-tight drop-shadow-lg">
                        {promotion.discountType === 'percentage' ? `${promotion.discountValue}% OFF` : `₱${promotion.discountValue} OFF`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-l border-white/20 pl-4 mt-2">
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <Tag className="h-4 w-4 text-purple-400" />
                      <span className="font-mono bg-white/10 px-2 rounded">{promotion.promotionCode || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <Calendar className="h-4 w-4 text-blue-400" />
                      <span>
                        {promotion.startDate?.toDate ? promotion.startDate.toDate().toLocaleDateString() : new Date(promotion.startDate).toLocaleDateString()} - {promotion.endDate?.toDate ? promotion.endDate.toDate().toLocaleDateString() : new Date(promotion.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <Building2 className="h-4 w-4 text-orange-400" />
                      <span>All Branches</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 mt-6 border-t border-white/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(promotion)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenSendModal(promotion)}
                    className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border-0"
                    title="Send to Clients"
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShowEmailPreview(promotion)}
                    className="bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-0"
                    title="Preview Email"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(promotion)}
                    className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedPromotion(null);
        }}
        title={selectedPromotion ? 'Edit System-Wide Promotion' : 'Create System-Wide Promotion'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Globe className="h-4 w-4" />
              <span className="font-medium">This promotion will be available in ALL branches</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="e.g., Summer Sale 2024"
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
                className="font-mono"
                placeholder="e.g., SUMMER24"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData(prev => ({ ...prev, promotionCode: generatePromotionCode() }))}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              placeholder="Describe the promotion..."
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₱)</option>
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
                placeholder={formData.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
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
              Usage Type
            </label>
            <select
              value={formData.usageType}
              onChange={(e) => setFormData(prev => ({ ...prev, usageType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="repeating">Repeating (Can be used multiple times)</option>
              <option value="one-time">One-time (Each client can use once)</option>
            </select>
          </div>

          {formData.usageType === 'repeating' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Uses (Leave empty for unlimited)
              </label>
              <Input
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                min="1"
                placeholder="Leave empty for unlimited"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Segment
            </label>
            <select
              value={formData.targetSegment}
              onChange={(e) => setFormData(prev => ({ ...prev, targetSegment: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="all">All Clients</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Banner Image
            </label>
            <div className="space-y-2">
              {(imagePreview || formData.imageUrl) && (
                <div className="relative inline-block">
                  <img
                    src={imagePreview || formData.imageUrl}
                    alt="Promotion preview"
                    className="w-full max-w-md h-40 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                      setFormData(prev => ({ ...prev, imageUrl: '' }));
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                  <ImageIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {uploadingImage ? 'Uploading...' : 'Choose Image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
                {formData.startDate && formData.endDate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleShowEmailPreview(formData)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview Email
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">Max 5MB. Recommended: 600x300px</p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
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
        title="Delete System-Wide Promotion"
        message={`Are you sure you want to delete "${selectedPromotion?.name}"? This promotion will be removed from all branches. This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />

      {/* Email Preview Modal */}
      <Modal
        isOpen={isEmailPreviewOpen}
        onClose={() => setIsEmailPreviewOpen(false)}
        title="Email Preview"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This is how the promotion email will appear to clients:
          </p>
          <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '500px' }}>
            <iframe
              srcDoc={emailPreviewHtml}
              title="Email Preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsEmailPreviewOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Email Modal */}
      <Modal
        isOpen={isSendModalOpen}
        onClose={() => {
          setIsSendModalOpen(false);
          setSelectedPromotion(null);
          setSelectedClients(new Set());
        }}
        title="Send Promotion to Clients"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Promotion:</strong> {selectedPromotion?.name}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Clients ({selectedClients.size} selected)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const clientsWithEmail = clients.filter(c => c.email);
                    setSelectedClients(new Set(clientsWithEmail.map(c => c.id)));
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClients(new Set())}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {clients.filter(c => c.email).length === 0 ? (
                <p className="p-4 text-center text-gray-500">No clients with email addresses found</p>
              ) : (
                clients.filter(c => c.email).map(client => (
                  <label
                    key={client.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClients.has(client.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedClients);
                        if (e.target.checked) {
                          newSelected.add(client.id);
                        } else {
                          newSelected.delete(client.id);
                        }
                        setSelectedClients(newSelected);
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{client.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleShowEmailPreview(selectedPromotion)}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview Email
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSendModalOpen(false);
                  setSelectedPromotion(null);
                  setSelectedClients(new Set());
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendPromotion}
                disabled={selectedClients.size === 0 || isSending}
              >
                {isSending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send to {selectedClients.size} Client{selectedClients.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OperationalManagerPromotions;



















