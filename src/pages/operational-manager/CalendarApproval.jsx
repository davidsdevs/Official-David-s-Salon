/**
 * Calendar Approval Page
 * For Operational Managers to approve/reject calendar entries with holiday verification
 */

import { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  Search, 
  Check, 
  X, 
  RefreshCw,
  Filter,
  Clock,
  Building,
  User,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  approveRejectCalendarEntry,
  getCalendarEntryTypes 
} from '../../services/branchCalendarService';
import { getBranches } from '../../services/branchService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Card } from '../../components/ui/Card';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

const CalendarApproval = () => {
  const { currentUser } = useAuth();
  const [pendingEntries, setPendingEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [branchCache, setBranchCache] = useState({});
  const branchCacheRef = useRef({});
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState({});

  useEffect(() => {
    branchCacheRef.current = branchCache;
  }, [branchCache]);

  // Load all branches on mount
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const allBranches = await getBranches();
        const branchMap = {};
        allBranches.forEach(branch => {
          branchMap[branch.id] = branch.name || `Branch ${branch.id.substring(0, 8)}`;
        });
        setBranchCache(branchMap);
        branchCacheRef.current = branchMap;
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    };
    loadBranches();
  }, []);

  useEffect(() => {
    setLoading(true);
    const calendarRef = collection(db, 'calendar');
    // Fetch all pending entries and sort in memory to avoid index requirement
    const pendingQuery = query(
      calendarRef,
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      pendingQuery,
      async (snapshot) => {
        const docs = snapshot.docs
          .map(doc => {
            const data = doc.data();
            // Handle both single date and date range entries
            let entryDate = null;
            if (data.date) {
              entryDate = data.date.toDate();
            } else if (data.startDate) {
              entryDate = data.startDate.toDate();
            }
            
            return {
              id: doc.id,
              ...data,
              date: entryDate,
              startDate: data.startDate?.toDate(),
              endDate: data.endDate?.toDate(),
              // Use requestedByName if available, otherwise use createdBy as fallback
              requestedByName: data.requestedByName || data.createdByName || 'Branch Manager'
            };
          })
          .sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return a.date.getTime() - b.date.getTime();
          });

        console.log('📅 Calendar entries received:', docs);

        // Map branch names from cache
        const entriesWithBranch = docs.map(entry => {
          console.log(`Entry ${entry.id}:`, {
            branchId: entry.branchId,
            branchName: branchCacheRef.current[entry.branchId],
            requestedByName: entry.requestedByName,
            date: entry.date,
            startDate: entry.startDate,
            endDate: entry.endDate
          });
          return {
            ...entry,
            branchName: branchCacheRef.current[entry.branchId] || 'Unknown Branch'
          };
        });

        setPendingEntries(entriesWithBranch);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening for pending entries:', error);
        toast.error('Failed to load pending calendar entries');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter entries
  const filteredEntries = pendingEntries.filter(entry => {
    const matchesSearch = !searchTerm || 
      entry.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.branchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.requestedByName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || entry.type === typeFilter;
    const matchesBranch = branchFilter === 'all' || entry.branchId === branchFilter;
    
    return matchesSearch && matchesType && matchesBranch;
  });

  // Get unique branches from entries
  const uniqueBranches = [...new Set(pendingEntries.map(e => e.branchId))];

  // Count active filters
  const activeFilterCount = [
    typeFilter !== 'all',
    branchFilter !== 'all'
  ].filter(Boolean).length;

  // Clear filters
  const clearFilters = () => {
    setTypeFilter('all');
    setBranchFilter('all');
    setSearchTerm('');
  };

  // Toggle entry expansion
  const toggleExpand = (entryId) => {
    setExpandedEntries(prev => ({
      ...prev,
      [entryId]: !prev[entryId]
    }));
  };

  const handleApprove = async (entry) => {
    try {
      setProcessing(true);
      await approveRejectCalendarEntry(entry.id, 'approve', null, currentUser);
      toast.success('Calendar entry approved!');
      // The onSnapshot listener will automatically update the list
    } catch (error) {
      console.error('Error approving entry:', error);
      toast.error('Failed to approve entry');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (entry) => {
    setSelectedEntry(entry);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedEntry) return;
    
    try {
      setProcessing(true);
      await approveRejectCalendarEntry(selectedEntry.id, 'reject', rejectionReason, currentUser);
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedEntry(null);
      toast.success('Calendar entry rejected!');
      // The onSnapshot listener will automatically update the list
    } catch (error) {
      console.error('Error rejecting entry:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const entryTypes = getCalendarEntryTypes();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendar Approval</h1>
        <p className="text-gray-600">Review and approve calendar entries from branches</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingEntries.length}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Branches</p>
              <p className="text-2xl font-bold text-blue-600">{uniqueBranches.length}</p>
            </div>
            <Building className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Filtered</p>
              <p className="text-2xl font-bold text-purple-600">{filteredEntries.length}</p>
            </div>
            <Filter className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Search Bar Row - Visual Hierarchy */}
      <Card className="p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          {/* Search Bar - ~70% width */}
          <div className="flex-1 max-w-[70%]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, branch, or requester..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
              />
            </div>
          </div>

          {/* Icon-only Buttons - No borders */}
          <button
            onClick={() => setShowFilterModal(true)}
            className="p-2 relative text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded-lg transition-colors"
            title="Filter"
          >
            <Filter className="h-5 w-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#160B53] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {filteredEntries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="p-2 text-gray-600 hover:text-[#160B53] hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </Card>

      {/* Pending Entries */}
      {filteredEntries.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {pendingEntries.length === 0 ? 'No Pending Entries' : 'No Matching Entries'}
          </h3>
          <p className="text-gray-500">
            {pendingEntries.length === 0 
              ? 'All calendar entries have been reviewed.' 
              : 'Try adjusting your search or filters.'}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 text-[#160B53] hover:underline text-sm"
            >
              Clear all filters
            </button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const typeInfo = entryTypes.find(t => t.value === entry.type);
            const isExpanded = expandedEntries[entry.id];
            
            return (
              <Card key={entry.id} className="overflow-hidden border border-gray-200">
                {/* Entry Header - Always visible */}
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">{entry.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo?.color || 'bg-gray-100 text-gray-700'}`}>
                            {typeInfo?.label || entry.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-4 h-4" />
                            {entry.startDate && entry.endDate 
                              ? `${formatDate(entry.startDate, 'MMM dd')} - ${formatDate(entry.endDate, 'MMM dd, yyyy')}`
                              : entry.date 
                                ? formatDate(entry.date, 'MMM dd, yyyy')
                                : 'No date'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building className="w-4 h-4" />
                            {entry.branchName || branchCache[entry.branchId] || 'Loading...'}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {entry.requestedByName || entry.requestedBy || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleApprove(entry)}
                        disabled={processing}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleReject(entry)}
                        disabled={processing}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Full Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {entry.startDate && entry.endDate 
                            ? `${formatDate(entry.startDate, 'EEEE, MMMM dd, yyyy')} - ${formatDate(entry.endDate, 'EEEE, MMMM dd, yyyy')}`
                            : entry.date 
                              ? formatDate(entry.date, 'EEEE, MMMM dd, yyyy')
                              : 'No date specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Entry Type</p>
                        <p className="text-sm font-medium text-gray-900">{typeInfo?.label || entry.type}</p>
                      </div>
                      {entry.description && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-500 mb-1">Description</p>
                          <p className="text-sm text-gray-700">{entry.description}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Schedule</p>
                        <p className="text-sm font-medium text-gray-900">
                          {entry.allDay 
                            ? 'All Day (Branch Closed)' 
                            : entry.specialHours 
                              ? `${entry.specialHours.open} - ${entry.specialHours.close}`
                              : 'Regular Hours'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Filter Entries</h2>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Entry Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                >
                  <option value="all">All Types</option>
                  {entryTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                >
                  <option value="all">All Branches</option>
                  {uniqueBranches.map(branchId => (
                    <option key={branchId} value={branchId}>
                      {branchCache[branchId] || 'Unknown Branch'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Results Count */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-[#160B53]">{filteredEntries.length}</span> of {pendingEntries.length} entries
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="px-4 py-2 text-sm bg-[#160B53] text-white rounded-lg hover:bg-[#12094A] transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => {
          if (!processing) {
            setShowRejectModal(false);
            setRejectionReason('');
            setSelectedEntry(null);
          }
        }}
        onConfirm={confirmReject}
        title="Reject Calendar Entry"
        message={
          <div className="space-y-4">
            <p>Are you sure you want to reject "{selectedEntry?.title}"?</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Provide a reason for rejection..."
              />
            </div>
          </div>
        }
        confirmText="Reject"
        cancelText="Cancel"
        type="danger"
        loading={processing}
      />
    </div>
  );
};

export default CalendarApproval;


