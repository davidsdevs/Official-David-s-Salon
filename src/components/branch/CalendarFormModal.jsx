/**
 * Calendar Form Modal Component
 * For adding and editing branch calendar entries
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getCalendarEntryTypes } from '../../services/branchCalendarService';
import LoadingSpinner from '../ui/LoadingSpinner';

const CalendarFormModal = ({ 
  isOpen, 
  entry, 
  onClose, 
  onSubmit,
  loading = false,
  defaultDate = ''
}) => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    title: '',
    description: '',
    type: 'reminder'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate dates
    if (formData.endDate < formData.startDate) {
      return;
    }
    
    onSubmit(formData);
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    
    if (entry) {
      const startDateValue = formatDateForInput(entry.startDate || entry.date);
      const endDateValue = formatDateForInput(entry.endDate || entry.date);
      setFormData({
        startDate: startDateValue,
        endDate: endDateValue,
        title: entry.title,
        description: entry.description || '',
        type: entry.type || 'reminder'
      });
    } else {
      const initialDate = defaultDate || '';
      setFormData({
        startDate: initialDate,
        endDate: initialDate,
        title: '',
        description: '',
        type: 'reminder'
      });
    }
  }, [entry, isOpen, defaultDate]);

  if (!isOpen) return null;

  const entryTypes = getCalendarEntryTypes();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {entry ? 'Edit Reminder' : 'Add Reminder'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      // If end date is before new start date, update end date too
                      const newEndDate = formData.endDate && formData.endDate < newStartDate 
                        ? newStartDate 
                        : formData.endDate;
                      setFormData({ ...formData, startDate: newStartDate, endDate: newEndDate });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Entry Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entry Type *
              </label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                {entryTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.type === 'branch_close' ? 'Closure Reason *' : 'Title *'}
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={formData.type === 'branch_close' ? 'e.g., Team Building, Flood, Power Outage' : 'e.g., Team Meeting, Equipment Maintenance'}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.type === 'branch_close' ? 'Additional Details' : 'Description'}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={formData.type === 'branch_close' ? 'Explain why the branch needs to close on this date.' : 'Additional details about this entry'}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              {loading ? 'Saving...' : (entry ? 'Update Reminder' : 'Add Reminder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarFormModal;
