import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Edit2, Building2, Maximize2, Minimize2, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import BranchPage from '../public/BranchPage';
import { getAllBranches } from '../../services/branchService';

const slugify = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const BranchContentManagement = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const results = await getAllBranches();
        if (!isMounted) return;
        setBranches(results || []);
        if (!selectedBranchId && results?.length) {
          setSelectedBranchId(results[0].id);
        }
      } catch (e) {
        if (!isMounted) return;
        setBranches([]);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  const branchName = selectedBranch?.branchName || selectedBranch?.name || '';
  const branchSlug = selectedBranch?.slug || slugify(branchName);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-600">Loading branches...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Content</h1>
          <p className="text-gray-600">Edit public branch pages (per location)</p>
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
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              {branches.map((b) => {
                const name = b.branchName || b.name || b.id;
                return (
                  <option key={b.id} value={b.id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Slug (preview)</label>
            <div className="flex gap-2">
              <Input value={branchSlug || ''} readOnly />
              <div className="h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-2 text-xs text-gray-600">
                <Building2 className="h-4 w-4" />
                /branch/{branchSlug || '...'}
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
            <BranchPage
              key={selectedBranchId || 'branch'}
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
              <div className="font-semibold text-gray-900">Branch Page</div>
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
                <BranchPage
                  key={`${selectedBranchId || 'branch'}_fullscreen`}
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

export default BranchContentManagement;
