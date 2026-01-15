import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getAllBranches } from '../../services/branchService';
import { db } from '../../config/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  CheckCircle,
  Clock,
  Filter,
  Image as ImageIcon,
  Search,
  XCircle
} from 'lucide-react';

const slugify = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const ITEMS_PER_PAGE = 12;

const StylistPortfolioContentManagement = () => {
  const { userData } = useAuth();

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(true);

  const [stylists, setStylists] = useState([]);
  const [stylistsMap, setStylistsMap] = useState({});
  const [selectedStylistId, setSelectedStylistId] = useState('all');

  const [allPortfolios, setAllPortfolios] = useState([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState('');

  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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

  const loadStylists = async (branchId) => {
    if (!branchId) {
      setStylists([]);
      setStylistsMap({});
      return [];
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('branchId', '==', branchId), where('roles', 'array-contains', 'stylist'));
    const snapshot = await getDocs(q);

    const items = snapshot.docs.map((d) => {
      const data = d.data() || {};
      const firstName = data.firstName || '';
      const lastName = data.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim() || data.displayName || data.name || 'Stylist';
      const specialty = data.specialty || data.primarySpecialty || '';
      return { id: d.id, fullName, specialty };
    });

    items.sort((a, b) => a.fullName.localeCompare(b.fullName));

    const map = {};
    items.forEach((s) => {
      map[s.id] = s;
    });

    setStylists(items);
    setStylistsMap(map);
    return items;
  };

  const fetchPortfolios = async () => {
    if (!selectedBranchId) return;

    setError(null);
    setSuccessMessage(null);
    setLoadingPortfolios(true);

    try {
      const stylistItems = await loadStylists(selectedBranchId);
      const stylistIds = stylistItems.map((s) => s.id);

      if (!stylistIds.length) {
        setAllPortfolios([]);
        setCurrentPage(1);
        return;
      }

      const targetStylistIds = selectedStylistId === 'all' ? stylistIds : [selectedStylistId];

      const batchSize = 10;
      let results = [];
      for (let i = 0; i < targetStylistIds.length; i += batchSize) {
        const batch = targetStylistIds.slice(i, i + batchSize);
        const q = query(collection(db, 'portfolio'), where('stylistId', 'in', batch));
        const snapshot = await getDocs(q);
        results = results.concat(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }

      // safety: only keep portfolios from this branch stylists
      results = results.filter((p) => stylistIds.includes(p.stylistId));

      // default sort (pending first)
      const statusOrder = { pending: 1, active: 2, approved: 2, rejected: 3 };
      results.sort((a, b) => {
        const aStatus = statusOrder[a.status] || 99;
        const bStatus = statusOrder[b.status] || 99;
        if (aStatus !== bStatus) return aStatus - bStatus;
        const aSeconds = a.createdAt?.seconds || 0;
        const bSeconds = b.createdAt?.seconds || 0;
        return bSeconds - aSeconds;
      });

      setAllPortfolios(results);
      setCurrentPage(1);
    } catch (e) {
      setAllPortfolios([]);
      setCurrentPage(1);
      setError(e?.message ? `Failed to load portfolios: ${e.message}` : 'Failed to load portfolios');
    } finally {
      setLoadingPortfolios(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    fetchPortfolios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, selectedStylistId]);

  const availableCategories = useMemo(() => {
    const set = new Set();
    allPortfolios.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [allPortfolios]);

  const filteredPortfolios = useMemo(() => {
    let list = allPortfolios;

    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter);
    }

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((p) => {
        const title = (p.title || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const stylistName = (stylistsMap[p.stylistId]?.fullName || '').toLowerCase();
        return title.includes(term) || category.includes(term) || stylistName.includes(term);
      });
    }

    return list;
  }, [allPortfolios, statusFilter, categoryFilter, searchTerm, stylistsMap]);

  const totalPages = Math.max(1, Math.ceil(filteredPortfolios.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const pageItems = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredPortfolios.slice(start, end);
  }, [filteredPortfolios, page]);

  const summaryStats = useMemo(() => {
    return {
      total: filteredPortfolios.length,
      pending: filteredPortfolios.filter((p) => p.status === 'pending').length,
      approved: filteredPortfolios.filter((p) => p.status === 'active' || p.status === 'approved').length,
      rejected: filteredPortfolios.filter((p) => p.status === 'rejected').length
    };
  }, [filteredPortfolios]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApprove = async (portfolioId) => {
    if (!portfolioId) return;
    try {
      setProcessingId(portfolioId);
      setError(null);
      setSuccessMessage(null);

      const portfolioRef = doc(db, 'portfolio', portfolioId);
      const portfolioSnap = await getDoc(portfolioRef);
      const portfolioData = portfolioSnap.data() || {};

      await updateDoc(portfolioRef, {
        status: 'active',
        approvedAt: Timestamp.now(),
        approvedBy: userData?.uid || ''
      });

      // notify stylist
      try {
        await addDoc(collection(db, 'notifications'), {
          type: 'portfolio_approved',
          title: 'Portfolio Approved',
          message: `Your portfolio entry "${portfolioData.title || 'Untitled'}" has been approved.`,
          recipientId: portfolioData.stylistId,
          recipientRole: 'stylist',
          portfolioId,
          portfolioTitle: portfolioData.title || 'Untitled',
          category: portfolioData.category || '',
          branchId: selectedBranchId,
          branchName: selectedBranch?.__name || 'Branch',
          createdAt: serverTimestamp(),
          isRead: false
        });
      } catch (notifError) {
        void notifError;
      }

      setAllPortfolios((prev) => prev.map((p) => (p.id === portfolioId ? { ...p, status: 'active' } : p)));
      setSuccessMessage('Portfolio approved');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      setError(e?.message ? `Failed to approve: ${e.message}` : 'Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (portfolioId) => {
    if (!portfolioId) return;
    const remark = window.prompt('Rejection remark:');
    if (remark == null) return;
    if (!remark.trim()) {
      setError('Please provide a rejection remark');
      return;
    }

    try {
      setProcessingId(portfolioId);
      setError(null);
      setSuccessMessage(null);

      const portfolioRef = doc(db, 'portfolio', portfolioId);
      const portfolioSnap = await getDoc(portfolioRef);
      const portfolioData = portfolioSnap.data() || {};

      await updateDoc(portfolioRef, {
        status: 'rejected',
        rejectedAt: Timestamp.now(),
        rejectedBy: userData?.uid || '',
        rejectionRemark: remark.trim()
      });

      try {
        await addDoc(collection(db, 'notifications'), {
          type: 'portfolio_rejected',
          title: 'Portfolio Rejected',
          message: `Your portfolio entry "${portfolioData.title || 'Untitled'}" has been rejected. Reason: ${remark.trim()}`,
          recipientId: portfolioData.stylistId,
          recipientRole: 'stylist',
          portfolioId,
          portfolioTitle: portfolioData.title || 'Untitled',
          category: portfolioData.category || '',
          rejectionRemark: remark.trim(),
          branchId: selectedBranchId,
          branchName: selectedBranch?.__name || 'Branch',
          createdAt: serverTimestamp(),
          isRead: false
        });
      } catch (notifError) {
        void notifError;
      }

      setAllPortfolios((prev) => prev.map((p) => (p.id === portfolioId ? { ...p, status: 'rejected', rejectionRemark: remark.trim() } : p)));
      setSuccessMessage('Portfolio rejected');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      setError(e?.message ? `Failed to reject: ${e.message}` : 'Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  if (loadingBranches) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-600">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stylist Portfolio Page</h1>
        <p className="text-gray-600 mt-1">Filter/search portfolios for stylists available to a branch</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedStylistId('all');
                setSearchTerm('');
                setStatusFilter('all');
                setCategoryFilter('all');
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Stylist</label>
            <select
              value={selectedStylistId}
              onChange={(e) => {
                setSelectedStylistId(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="all">All stylists</option>
              {stylists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="active">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="all">All</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
                placeholder="Search by title, category, or stylist name"
              />
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-4 flex gap-2">
            <Button variant="outline" onClick={fetchPortfolios} className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Refresh
            </Button>
            <div className="text-sm text-gray-600 self-center">
              {selectedBranch?.__name ? `Branch: ${selectedBranch.__name}` : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-full">
            <ImageIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.total}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-50 rounded-full">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.pending}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-full">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.approved}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-full">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Rejected</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.rejected}</p>
          </div>
        </Card>
      </div>

      {error && (
        <Card className="p-4 border border-red-200 bg-red-50 text-red-800">{error}</Card>
      )}

      {successMessage && (
        <Card className="p-4 border border-green-200 bg-green-50 text-green-800">{successMessage}</Card>
      )}

      <Card className="p-4">
        {loadingPortfolios ? (
          <div className="py-16 text-center text-gray-500">Loading portfolios…</div>
        ) : pageItems.length === 0 ? (
          <div className="py-16 text-center text-gray-500">No portfolios found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map((p) => {
              const stylistName = stylistsMap[p.stylistId]?.fullName || 'Stylist';
              const status = p.status || 'pending';
              const imageUrl = p.imageUrl || p.thumbnailUrl || p.imageURL || p.image || '';

              const badgeClasses =
                status === 'active' || status === 'approved'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : status === 'rejected'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-200';

              return (
                <Card key={p.id} className="p-0 overflow-hidden border border-gray-200">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (imageUrl) setPreviewUrl(imageUrl);
                    }}
                  >
                    <div className="relative h-48 bg-gray-100">
                      {imageUrl ? (
                        <img src={imageUrl} alt={p.title || 'Portfolio'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ImageIcon className="h-10 w-10" />
                        </div>
                      )}
                      <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs border ${badgeClasses}`}>
                        {status}
                      </div>
                    </div>
                  </button>

                  <div className="p-4 space-y-2">
                    <div className="font-semibold text-gray-900 line-clamp-1">{p.title || 'Untitled'}</div>
                    <div className="text-sm text-gray-600 line-clamp-1">{stylistName}</div>
                    <div className="text-xs text-gray-500">{p.category || 'Uncategorized'}</div>
                    <div className="text-xs text-gray-500">{formatDate(p.createdAt)}</div>

                    {status === 'rejected' && p.rejectionRemark ? (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                        {p.rejectionRemark}
                      </div>
                    ) : null}

                    {status === 'pending' ? (
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleApprove(p.id)}
                          disabled={processingId === p.id}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReject(p.id)}
                          disabled={processingId === p.id}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-600">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {previewUrl ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewUrl('')} />
          <div className="absolute inset-4 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="font-semibold text-gray-900">Preview</div>
              <Button variant="outline" onClick={() => setPreviewUrl('')}>Close</Button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center">
              <img src={previewUrl} alt="Portfolio" className="max-h-full max-w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default StylistPortfolioContentManagement;
