/**
 * Calendar Management Page
 * For Branch Managers to manage holidays and special dates
 */

import { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, Trash2, Edit, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBranchCalendar, 
  saveBranchCalendarEntry, 
  deleteBranchCalendarEntry,
  getCalendarEntryTypes 
} from '../../services/branchCalendarService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CalendarFormModal from '../../components/branch/CalendarFormModal';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const CalendarManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  useEffect(() => {
    if (userBranch) {
      fetchCalendar();
    }
  }, [userBranch]);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const data = await getBranchCalendar(userBranch);
      setEntries(data);
    } catch (error) {
      console.error('Error fetching calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = () => {
    setSelectedEntry(null);
    setShowModal(true);
  };

  const handleEditEntry = (entry) => {
    setSelectedEntry(entry);
    setShowModal(true);
  };

  const handleDeleteEntry = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    
    try {
      setDeleting(true);
      await deleteBranchCalendarEntry(userBranch, entryToDelete.id, currentUser);
      await fetchCalendar();
      setShowDeleteModal(false);
    } catch (error) {
      // Error handled in service
    } finally {
      setDeleting(false);
      setEntryToDelete(null);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      setSaving(true);
      const entryData = {
        ...formData,
        id: selectedEntry?.id
      };
      
      await saveBranchCalendarEntry(userBranch, entryData, currentUser);
      setShowModal(false);
      await fetchCalendar();
    } catch (error) {
      // Error handled in service
    } finally {
      setSaving(false);
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
  const today = new Date();
  const upcomingEntries = entries.filter(e => e.date >= today);
  const pastEntries = entries.filter(e => e.date < today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar & Holidays</h1>
          <p className="text-gray-600">Manage branch closures and special dates</p>
        </div>
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Entry
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Calendar Management</p>
          <p>Add holidays, temporary closures, or special operating hours. These dates will affect appointment availability.</p>
        </div>
      </div>

      {/* Upcoming Entries */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Dates</h2>
        </div>
        <div className="p-6">
          {upcomingEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No upcoming dates scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingEntries.map((entry) => {
                const typeInfo = entryTypes.find(t => t.value === entry.type);
                return (
                  <div key={entry.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex-shrink-0">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                            {typeInfo?.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{formatDate(entry.date, 'EEEE, MMMM dd, yyyy')}</p>
                        {entry.description && (
                          <p className="text-sm text-gray-500">{entry.description}</p>
                        )}
                        {entry.type === 'special_hours' && entry.specialHours && (
                          <p className="text-sm text-gray-600 mt-1">
                            Special Hours: {entry.specialHours.open} - {entry.specialHours.close}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="p-2 text-red-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Past Entries */}
      {pastEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Past Dates</h2>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {pastEntries.slice(0, 5).map((entry) => {
                const typeInfo = entryTypes.find(t => t.value === entry.type);
                return (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                        <p className="text-xs text-gray-500">{formatDate(entry.date, 'MMM dd, yyyy')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                        {typeInfo?.label}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry)}
                      className="p-2 text-red-600 hover:bg-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {pastEntries.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  +{pastEntries.length - 5} more past entries
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entry Form Modal */}
      <CalendarFormModal
        isOpen={showModal}
        entry={selectedEntry}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        loading={saving}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!deleting) {
            setShowDeleteModal(false);
            setEntryToDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Delete Calendar Entry"
        message={`Are you sure you want to delete "${entryToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />
    </div>
  );
};

export default CalendarManagement;
