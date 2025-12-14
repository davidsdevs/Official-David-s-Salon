/**
 * Calendar Approval Page
 * For Operational Managers to approve/reject calendar entries with holiday verification
 */

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Calendar as CalendarIcon, AlertCircle, Search, Check, X, Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  approveRejectCalendarEntry,
  getCalendarEntryTypes 
} from '../../services/branchCalendarService';
import { getPublicHolidays } from '../../services/holidaysApiService';
import { getBranchById } from '../../services/branchService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

const CalendarApproval = () => {
  const { currentUser } = useAuth();
  const [pendingEntries, setPendingEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [holidayData, setHolidayData] = useState({}); // { entryId: { isHoliday: boolean, holidayInfo: object } }
  const [checkingHolidays, setCheckingHolidays] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [countryCode, setCountryCode] = useState('PH'); // Default to Philippines
  const [branchCache, setBranchCache] = useState({});
  const branchCacheRef = useRef({});

  useEffect(() => {
    branchCacheRef.current = branchCache;
  }, [branchCache]);

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
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate()
          }))
          .sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return a.date.getTime() - b.date.getTime();
          });

        try {
          const branchNameUpdates = {};
          const entriesWithBranch = await Promise.all(
            docs.map(async (entry) => {
              const cachedName = branchCacheRef.current[entry.branchId];
              if (cachedName) {
                return { ...entry, branchName: cachedName };
              }
              try {
                const branch = await getBranchById(entry.branchId);
                const branchName = branch?.name || branch?.branchName || 'Unknown Branch';
                branchNameUpdates[entry.branchId] = branchName;
                return { ...entry, branchName };
              } catch (error) {
                return { ...entry, branchName: 'Unknown Branch' };
              }
            })
          );

          if (Object.keys(branchNameUpdates).length > 0) {
            setBranchCache(prev => {
              const merged = { ...prev, ...branchNameUpdates };
              branchCacheRef.current = merged;
              return merged;
            });
          }

          setPendingEntries(entriesWithBranch);
        } catch (error) {
          console.error('Error processing pending entries:', error);
          toast.error('Failed to load pending calendar entries');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error listening for pending entries:', error);
        toast.error('Failed to load pending calendar entries');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (pendingEntries.length > 0) {
      checkAllHolidays();
    }
  }, [pendingEntries, countryCode]);

  const checkAllHolidays = async () => {
    if (pendingEntries.length === 0) {
      setHolidayData({});
      return;
    }

    setCheckingHolidays(true);
    const holidayChecks = {};
    
    try {
      // Get all unique dates and years from pending entries
      const uniqueDates = [...new Set(pendingEntries.map(e => {
        const d = new Date(e.date);
        return d.toISOString().split('T')[0];
      }))];
      
      const uniqueYears = [...new Set(pendingEntries.map(e => {
        return new Date(e.date).getFullYear();
      }))];
      
      // Fetch holidays for all years
      const holidayMap = {};
      for (const year of uniqueYears) {
        const holidays = await getPublicHolidays(year, countryCode);
        holidays.forEach(h => {
          holidayMap[h.date] = h;
        });
      }
      
      // Check each entry
      for (const entry of pendingEntries) {
        const dateStr = new Date(entry.date).toISOString().split('T')[0];
        const holidayInfo = holidayMap[dateStr];
        
        holidayChecks[entry.id] = {
          isHoliday: !!holidayInfo,
          holidayInfo: holidayInfo || null,
          dateStr
        };
      }
      
      setHolidayData(holidayChecks);
    } catch (error) {
      console.error('Error checking holidays:', error);
      toast.error('Failed to verify holidays');
    } finally {
      setCheckingHolidays(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar Approval</h1>
          <p className="text-gray-600">Review and approve calendar entries from branches</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="PH">Philippines</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="CA">Canada</option>
            <option value="SG">Singapore</option>
          </select>
          <button
            onClick={checkAllHolidays}
            disabled={checkingHolidays || pendingEntries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingHolidays ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Verify Holidays
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Holiday Verification</p>
          <p>Use the "Verify Holidays" button to check if the requested dates are actual public holidays. This helps ensure calendar entries are accurate.</p>
        </div>
      </div>

      {/* Pending Entries */}
      {pendingEntries.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Entries</h3>
          <p className="text-gray-500">All calendar entries have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingEntries.map((entry) => {
            const typeInfo = entryTypes.find(t => t.value === entry.type);
            const holidayCheck = holidayData[entry.id];
            const isVerifiedHoliday = holidayCheck?.isHoliday;
            const holidayInfo = holidayCheck?.holidayInfo;
            
            return (
              <div key={entry.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{entry.title}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                        {typeInfo?.label}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        Pending
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(entry.date, 'EEEE, MMMM dd, yyyy')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Branch</p>
                        <p className="text-sm font-medium text-gray-900">{entry.branchName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Requested By</p>
                        <p className="text-sm font-medium text-gray-900">
                          {entry.requestedByName || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Type</p>
                        <p className="text-sm font-medium text-gray-900">{typeInfo?.label}</p>
                      </div>
                    </div>
                    
                    {entry.description && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-1">Description</p>
                        <p className="text-sm text-gray-700">{entry.description}</p>
                      </div>
                    )}
                    
                    {/* Special Hours / All Day Info */}
                    <div className="mb-4">
                      {entry.allDay ? (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500">All Day:</p>
                          <p className="text-sm font-medium text-gray-900">Branch closed for the entire day</p>
                        </div>
                      ) : entry.specialHours ? (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Special Hours</p>
                          <p className="text-sm font-medium text-gray-900">
                            {entry.specialHours.open} - {entry.specialHours.close}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    
                    {/* Holiday Verification */}
                    {holidayCheck && (
                      <div className={`mt-4 p-3 rounded-lg border ${
                        isVerifiedHoliday 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {isVerifiedHoliday ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-green-900">
                                  Verified Public Holiday
                                </p>
                                <p className="text-xs text-green-700">
                                  {holidayInfo.name} ({holidayInfo.localName || holidayInfo.name})
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-5 h-5 text-gray-400" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">
                                  Not a Public Holiday
                                </p>
                                <p className="text-xs text-gray-500">
                                  This date is not listed as a public holiday in {countryCode}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(entry)}
                      disabled={processing}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(entry)}
                      disabled={processing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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


