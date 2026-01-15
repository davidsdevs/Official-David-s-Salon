import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Edit2, Eye, Image as ImageIcon, Maximize2, Minimize2, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getAllBranches } from '../../services/branchService';
import BranchGalleryPage from '../public/branch/BranchGalleryPage';

const slugify = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const StylistPortfolioContentManagement = () => {
  const [editMode, setEditMode] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(true);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFullScreen(false);
      }
    };

    if (fullScreen) {
      window.addEventListener('keydown', onKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fullScreen]);

  useEffect(() => {
    let mounted = true;

    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        const results = await getAllBranches();
        if (!mounted) return;
        const normalized = (results || []).map((b) => {
          const name = b.branchName || b.name || '';
          return { ...b, __name: name, __slug: b.slug || slugify(name) };
        });
        setBranches(normalized);
        if (!selectedBranchId && normalized.length) {
          setSelectedBranchId(normalized[0].id);
        }
      } catch (e) {
        if (!mounted) return;
        setBranches([]);
      } finally {
        if (!mounted) return;
        setLoadingBranches(false);
      }
    };

    loadBranches();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  const branchName = selectedBranch?.__name || selectedBranch?.branchName || selectedBranch?.name || '';
  const branchSlug = selectedBranch?.__slug || selectedBranch?.slug || slugify(branchName);

  if (loadingBranches) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-600">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stylist Portfolio Page</h1>
          <p className="text-gray-600 mt-1">Edit the public stylist portfolio page (per branch)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-2"
          >
            {editMode ? <Eye className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            {editMode ? 'Preview Mode' : 'Edit Mode'}
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setFullScreen(!fullScreen)}
          >
            {fullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {fullScreen ? 'Exit Full Screen' : 'Full Screen'}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Branch</label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.__name || b.branchName || b.name || b.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Slug (preview)</label>
            <div className="flex gap-2">
              <Input value={branchSlug || ''} readOnly />
              <div className="h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-2 text-xs text-gray-600">
                <Building2 className="h-4 w-4" />
                /branch/{branchSlug || '...'}/gallery
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div
        className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-lg"
        style={{ minHeight: 'calc(100vh - 300px)' }}
      >
        <div className="w-full h-full overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <div className="relative">
            <BranchGalleryPage
              key={selectedBranchId || 'gallery'}
              embedded={true}
              cmsEditMode={editMode}
              cmsBranchId={selectedBranchId || null}
              cmsBranchName={branchName}
              cmsBranchSlug={branchSlug}
            />
          </div>
        </div>
      </div>

      {fullScreen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFullScreen(false)} />
          <div className="absolute inset-4 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="font-semibold text-gray-900">Stylist Portfolio Page</div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setEditMode(!editMode)}
                  className="flex items-center gap-2"
                  variant={editMode ? 'default' : 'outline'}
                >
                  {editMode ? <Eye className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                  {editMode ? 'Preview Mode' : 'Edit Mode'}
                </Button>
                <Button
                  onClick={() => setFullScreen(false)}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                <BranchGalleryPage
                  key={`${selectedBranchId || 'gallery'}_fullscreen`}
                  embedded={true}
                  cmsEditMode={editMode}
                  cmsBranchId={selectedBranchId || null}
                  cmsBranchName={branchName}
                  cmsBranchSlug={branchSlug}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StylistPortfolioContentManagement;
