import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { branchContentService } from '../../services/branchContentService';
import { cloudinaryService } from '../../services/cloudinaryService';
import {
  Edit,
  Save,
  X,
  Eye,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  ExternalLink,
} from 'lucide-react';
import { SearchInput } from '../../components/ui/SearchInput';

const HomepageContentManagement = () => {
  const { userData } = useAuth();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [previewMode, setPreviewMode] = useState(true);
  const fileInputRef = useRef(null);

  // Load content on mount
  useEffect(() => {
    loadContent();
    
    // Subscribe to real-time updates
    const unsubscribe = branchContentService.subscribeToContent('main', 'homepage', (result) => {
      if (result.success && result.content) {
        setContent(result.content);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadContent = async () => {
    try {
      setLoading(true);
      const result = await branchContentService.getHomepageContent();
      if (result.success) {
        setContent(result.content);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Error loading content:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const result = await branchContentService.saveContent(
        'main',
        'homepage',
        {
          ...content,
          updatedBy: userData.uid
        }
      );

      if (result.success) {
        setSuccess('Content saved successfully!');
        setEditingSection(null);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Error saving content:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSectionUpdate = (section, field, value) => {
    setContent(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleTestimonialUpdate = (index, field, value) => {
    setContent(prev => ({
      ...prev,
      testimonials: {
        ...prev.testimonials,
        items: prev.testimonials.items.map((item, i) => 
          i === index ? { ...item, [field]: value } : item
        )
      }
    }));
  };

  const handleAddTestimonial = () => {
    setContent(prev => ({
      ...prev,
      testimonials: {
        ...prev.testimonials,
        items: [
          ...prev.testimonials.items,
          {
            name: '',
            branch: '',
            rating: 5,
            text: ''
          }
        ]
      }
    }));
  };

  const handleRemoveTestimonial = (index) => {
    setContent(prev => ({
      ...prev,
      testimonials: {
        ...prev.testimonials,
        items: prev.testimonials.items.filter((_, i) => i !== index)
      }
    }));
  };

  const handleImageUpload = async (section, field, file) => {
    try {
      setSaving(true);
      setError(null);
      const result = await cloudinaryService.uploadImage(file, 'salon-content');
      if (result.success && result.url) {
        handleSectionUpdate(section, field, result.url);
        setSuccess('Image uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to upload image');
      }
      setSaving(false);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image: ' + err.message);
      setSaving(false);
    }
  };

  if (loading && !content) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading content...</span>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Failed to load content</p>
        <Button onClick={loadContent} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homepage Content Management</h1>
          <p className="text-gray-600">Manage the main landing page content in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Edit Mode' : 'Preview Mode'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#160B53] hover:bg-[#12094A] text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Card className="p-4 border-l-4 border-green-400 bg-green-50">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-green-800">{success}</p>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 border-l-4 border-red-400 bg-red-50">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* View Homepage Link */}
      <Card className="p-4 bg-blue-50 border-l-4 border-blue-400">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">View the homepage</p>
            <p className="text-xs text-blue-700 mt-1">See how your changes appear to visitors</p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.open('/', '_blank')}
            className="border-blue-400 text-blue-700 hover:bg-blue-100"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Homepage
          </Button>
        </div>
      </Card>

      {/* Two Column Layout: Editor and Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-6">
          {/* Hero Section Editor */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Hero Section</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingSection(editingSection === 'hero' ? null : 'hero')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            {editingSection === 'hero' && (
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <Input
                    value={content.hero?.title || ''}
                    onChange={(e) => handleSectionUpdate('hero', 'title', e.target.value)}
                    placeholder="Welcome to David's Salon"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                    rows="3"
                    value={content.hero?.subtitle || ''}
                    onChange={(e) => handleSectionUpdate('hero', 'subtitle', e.target.value)}
                    placeholder="Experience premium hair and beauty services..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Button Text</label>
                  <Input
                    value={content.hero?.buttonText || ''}
                    onChange={(e) => handleSectionUpdate('hero', 'buttonText', e.target.value)}
                    placeholder="View Our Services"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Background Image URL</label>
                  <div className="flex gap-2">
                    <Input
                      value={content.hero?.backgroundImage || ''}
                      onChange={(e) => handleSectionUpdate('hero', 'backgroundImage', e.target.value)}
                      placeholder="https://..."
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          handleImageUpload('hero', 'backgroundImage', file);
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overlay Opacity (0-1)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={content.hero?.overlayOpacity || 0.6}
                    onChange={(e) => handleSectionUpdate('hero', 'overlayOpacity', parseFloat(e.target.value))}
                    placeholder="0.6"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Branches Section Editor */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Branches Section</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingSection(editingSection === 'branches' ? null : 'branches')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            {editingSection === 'branches' && (
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <Input
                    value={content.branches?.title || ''}
                    onChange={(e) => handleSectionUpdate('branches', 'title', e.target.value)}
                    placeholder="Choose Your Branch"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                  <Input
                    value={content.branches?.subtitle || ''}
                    onChange={(e) => handleSectionUpdate('branches', 'subtitle', e.target.value)}
                    placeholder=""
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Placeholder</label>
                  <Input
                    value={content.branches?.searchPlaceholder || ''}
                    onChange={(e) => handleSectionUpdate('branches', 'searchPlaceholder', e.target.value)}
                    placeholder="Search branches..."
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Testimonials Section Editor */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Testimonials Section</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddTestimonial}
                >
                  <Users className="h-4 w-4 mr-1" />
                  Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSection(editingSection === 'testimonials' ? null : 'testimonials')}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {editingSection === 'testimonials' && (
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Section Title</label>
                  <Input
                    value={content.testimonials?.title || ''}
                    onChange={(e) => handleSectionUpdate('testimonials', 'title', e.target.value)}
                    placeholder="What Our Clients Say"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Section Subtitle</label>
                  <Input
                    value={content.testimonials?.subtitle || ''}
                    onChange={(e) => handleSectionUpdate('testimonials', 'subtitle', e.target.value)}
                    placeholder="Real stories from our satisfied customers"
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">Testimonials</label>
                  {content.testimonials?.items?.map((testimonial, index) => (
                    <Card key={index} className="p-4 border border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900">Testimonial {index + 1}</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveTestimonial(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <Input
                          placeholder="Name"
                          value={testimonial.name}
                          onChange={(e) => handleTestimonialUpdate(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Branch"
                          value={testimonial.branch}
                          onChange={(e) => handleTestimonialUpdate(index, 'branch', e.target.value)}
                        />
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                          rows="3"
                          placeholder="Testimonial text"
                          value={testimonial.text}
                          onChange={(e) => handleTestimonialUpdate(index, 'text', e.target.value)}
                        />
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                          <Input
                            type="number"
                            min="1"
                            max="5"
                            value={testimonial.rating}
                            onChange={(e) => handleTestimonialUpdate(index, 'rating', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* CTA Section Editor */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Call to Action Section</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingSection(editingSection === 'cta' ? null : 'cta')}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            {editingSection === 'cta' && (
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <Input
                    value={content.cta?.title || ''}
                    onChange={(e) => handleSectionUpdate('cta', 'title', e.target.value)}
                    placeholder="Ready to Transform Your Look?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                    rows="3"
                    value={content.cta?.subtitle || ''}
                    onChange={(e) => handleSectionUpdate('cta', 'subtitle', e.target.value)}
                    placeholder="Visit our location to discover..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Button Text</label>
                  <Input
                    value={content.cta?.buttonText || ''}
                    onChange={(e) => handleSectionUpdate('cta', 'buttonText', e.target.value)}
                    placeholder="View Our Services"
                  />
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Live Preview</h2>
              <span className="text-xs text-gray-500">Updates in real-time</span>
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              {/* Hero Section Preview */}
              <section
                className="relative h-[400px] flex items-center justify-center text-center text-white"
                style={{
                  backgroundImage: `linear-gradient(rgba(0, 0, 0, ${content.hero?.overlayOpacity || 0.6}), rgba(22, 11, 83, 0.7)), url('${content.hero?.backgroundImage || ''}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="max-w-4xl px-4">
                  <h1 className="font-bold mb-6 text-balance" style={{ fontSize: '40px' }}>
                    {content.hero?.title || "Welcome to David's Salon"}
                  </h1>
                  <p className="text-lg mb-8 text-pretty leading-relaxed">
                    {content.hero?.subtitle || "Experience premium hair and beauty services..."}
                  </p>
                  <Button 
                    size="lg" 
                    className="bg-white text-[#160B53] hover:bg-gray-100 font-semibold px-8 py-3"
                  >
                    {content.hero?.buttonText || "View Our Services"}
                  </Button>
                </div>
              </section>

              {/* Branches Section Preview */}
              <section className="py-8 px-4 bg-white">
                <div className="max-w-7xl mx-auto">
                  <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '40px' }}>
                    {content.branches?.title || "Choose Your Branch"}
                  </h2>
                  {content.branches?.subtitle && (
                    <p className="text-center text-gray-600 mb-8">{content.branches.subtitle}</p>
                  )}
                  <div className="flex justify-center mb-8">
                    <div className="max-w-md w-full">
                      <SearchInput
                        placeholder={content.branches?.searchPlaceholder || "Search branches..."}
                        value=""
                        onChange={() => {}}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Testimonials Section Preview */}
              <section className="py-8 px-4 bg-gray-50">
                <div className="max-w-6xl mx-auto">
                  <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '40px' }}>
                    {content.testimonials?.title || "What Our Clients Say"}
                  </h2>
                  {content.testimonials?.subtitle && (
                    <p className="text-center text-gray-600 mb-8">{content.testimonials.subtitle}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {content.testimonials?.items?.slice(0, 3).map((testimonial, index) => (
                      <Card key={index} className="p-4 border-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
                        <CardContent className="p-0">
                          <div className="text-4xl text-[#160B53] mb-3">"</div>
                          <p className="text-gray-700 mb-4 leading-relaxed text-sm">
                            {testimonial.text || "Testimonial text..."}
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-[#160B53] text-sm">
                                {testimonial.name || "Client Name"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {testimonial.branch || "Branch Name"}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </section>

              {/* CTA Section Preview */}
              <section className="py-8 px-4 bg-[#160B53] text-white text-center">
                <div className="max-w-4xl mx-auto">
                  <h2 className="font-bold mb-6" style={{ fontSize: '40px' }}>
                    {content.cta?.title || "Ready to Transform Your Look?"}
                  </h2>
                  <p className="text-lg mb-8 text-pretty leading-relaxed">
                    {content.cta?.subtitle || "Visit our location to discover..."}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white text-white hover:bg-white hover:text-[#160B53] bg-transparent"
                    >
                      {content.cta?.buttonText || "View Our Services"}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HomepageContentManagement;

