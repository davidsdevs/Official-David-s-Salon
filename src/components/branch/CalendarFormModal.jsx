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
  loading = false
}) => {
  const [formData, setFormData] = useState({
    date: '',
    title: '',
    description: '',
    type: 'holiday',
    allDay: true,
    specialHours: { open: '09:00', close: '18:00' }
  });

  useEffect(() => {
    if (entry) {
      setFormData({
        date: entry.date,
        title: entry.title,
        description: entry.description || '',
        type: entry.type,
        allDay: entry.allDay,
        specialHours: entry.specialHours || { open: '09:00', close: '18:00' }
      });
    } else {
      setFormData({
        date: '',
        title: '',
        description: '',
        type: 'holiday',
        allDay: true,
        specialHours: { open: '09:00', close: '18:00' }
      });
    }
  }, [entry, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const entryTypes = getCalendarEntryTypes();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {entry ? 'Edit Calendar Entry' : 'Add Calendar Entry'}
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
            {/* Date and Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {entryTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Christmas Day, Maintenance Closure"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Additional details about this entry"
              />
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="allDay"
                checked={formData.allDay}
                onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="allDay" className="text-sm font-medium text-gray-700">
                All day (Branch closed for the entire day)
              </label>
            </div>

            {/* Special Hours */}
            {!formData.allDay && formData.type === 'special_hours' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Operating Hours
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={formData.specialHours.open}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      specialHours: { ...formData.specialHours, open: e.target.value }
                    })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={formData.specialHours.close}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      specialHours: { ...formData.specialHours, close: e.target.value }
                    })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
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
              {loading ? 'Saving...' : (entry ? 'Update Entry' : 'Add Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarFormModal;
