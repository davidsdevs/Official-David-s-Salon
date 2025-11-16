  /**
 * Post-Service Notes Modal
 * For stylists to add notes after completing an appointment
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';

const PostServiceNotesModal = ({ isOpen, appointment, onClose, onSubmit, loading = false }) => {
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(notes);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Complete Appointment
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
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Client: <span className="font-semibold text-gray-900">{appointment?.clientName}</span>
              </p>
              <p className="text-sm text-gray-600">
                Service: <span className="font-semibold text-gray-900">{appointment?.serviceName}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Post-Service Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Add any notes about the service, client preferences, or recommendations..."
              />
              <p className="text-xs text-gray-500 mt-1">
                These notes will be saved to the client's appointment history
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              {loading ? 'Completing...' : 'Complete Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostServiceNotesModal;
