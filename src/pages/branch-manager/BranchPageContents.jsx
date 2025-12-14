/**
 * Branch Page Contents Page
 * For Branch Managers to manage their branch page content
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Image, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { branchContentService } from '../../services/branchContentService';
import { logActivity } from '../../services/activityService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const BranchPageContents = () => {
  const { currentUser, userBranch, userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState(null);
  const [localContent, setLocalContent] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (userBranch) {
      fetchContent();
    }
  }, [userBranch]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      if (!userBranch) {
        toast.error('Branch ID not found');
        return;
      }

      const result = await branchContentService.getContent(userBranch, 'branch');
      if (result.success && result.content) {
        setContent(result.content);
        setLocalContent(result.content);
      }

      // Log activity (non-blocking)
      logActivity({
        action: 'branch_page_contents_viewed',
        performedBy: currentUser?.uid || userData?.uid,
        branchId: userBranch,
        details: {}
      }).catch(err => console.error('Error logging activity:', err));
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load branch page content');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (section, field, value) => {
    if (!localContent) return;

    const newContent = { ...localContent };
    if (!newContent[section]) {
      newContent[section] = {};
    }
    newContent[section][field] = value;

    setLocalContent(newContent);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localContent || !userBranch) return;

    try {
      setSaving(true);
      const result = await branchContentService.saveContent(userBranch, 'branch', {
        ...localContent,
        updatedBy: currentUser?.uid || userData?.uid
      });

      if (result.success) {
        setContent(localContent);
        setHasChanges(false);
        toast.success('Branch page content saved successfully!');

        // Log activity (non-blocking)
        logActivity({
          action: 'branch_page_contents_updated',
          performedBy: currentUser?.uid || userData?.uid,
          branchId: userBranch,
          details: {
            sectionsUpdated: Object.keys(localContent)
          }
        }).catch(err => console.error('Error logging activity:', err));
      } else {
        toast.error(result.message || 'Failed to save content');
      }
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save branch page content');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const displayContent = localContent || content || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/manager/settings')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Branch Page Contents</h1>
            <p className="text-gray-600 mt-1">Manage your branch page content and public information</p>
          </div>
        </div>
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#160B53] hover:bg-[#160B53]/90 text-white flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {/* Hero Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="h-5 w-5 text-[#160B53]" />
          <h2 className="text-xl font-semibold text-gray-900">Hero Section</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hero Title
            </label>
            <Input
              value={displayContent.hero?.title || ''}
              onChange={(e) => handleFieldChange('hero', 'title', e.target.value)}
              placeholder="Welcome to [Branch Name]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hero Subtitle
            </label>
            <textarea
              value={displayContent.hero?.subtitle || ''}
              onChange={(e) => handleFieldChange('hero', 'subtitle', e.target.value)}
              placeholder="Brief description of your branch..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background Image URL
            </label>
            <Input
              value={displayContent.hero?.backgroundImage || ''}
              onChange={(e) => handleFieldChange('hero', 'backgroundImage', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </Card>

      {/* About Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-[#160B53]" />
          <h2 className="text-xl font-semibold text-gray-900">About Section</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              About Title
            </label>
            <Input
              value={displayContent.about?.title || ''}
              onChange={(e) => handleFieldChange('about', 'title', e.target.value)}
              placeholder="About Our Branch"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              About Description
            </label>
            <textarea
              value={displayContent.about?.description || ''}
              onChange={(e) => handleFieldChange('about', 'description', e.target.value)}
              placeholder="Tell visitors about your branch..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
            />
          </div>
        </div>
      </Card>

      {/* Services Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Edit2 className="h-5 w-5 text-[#160B53]" />
          <h2 className="text-xl font-semibold text-gray-900">Services Section</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Services Section Title
            </label>
            <Input
              value={displayContent.services?.title || ''}
              onChange={(e) => handleFieldChange('services', 'title', e.target.value)}
              placeholder="Our Services"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Services Section Subtitle
            </label>
            <textarea
              value={displayContent.services?.subtitle || ''}
              onChange={(e) => handleFieldChange('services', 'subtitle', e.target.value)}
              placeholder="Description of your services..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none"
            />
          </div>
        </div>
      </Card>

      {/* Info Box */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Changes to branch page content will be reflected on your public branch page. 
          Make sure to preview your changes before saving.
        </p>
      </Card>
    </div>
  );
};

export default BranchPageContents;

