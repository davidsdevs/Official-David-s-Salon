/**
 * Branch Service Price Modal Component
 * For setting/updating service price for a branch
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const BranchServicePriceModal = ({
  isOpen,
  service,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (service) {
      // If service already has a price, use it; otherwise empty
      setPrice(service.price ? service.price.toString() : '');
    } else {
      setPrice('');
    }
  }, [service, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    
    if (isNaN(numPrice) || numPrice < 0) {
      alert('Please enter a valid price');
      return;
    }
    
    onSubmit(numPrice);
  };

  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {service.price ? 'Update Price' : 'Set Price'}
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
            {/* Service Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Service</p>
              <p className="text-lg font-semibold text-gray-900">{service.name}</p>
              {service.description && (
                <p className="text-sm text-gray-600 mt-2">{service.description}</p>
              )}
            </div>

            {/* Price Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (₱) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the price this branch will charge for this service
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
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                service.price ? 'Update Price' : 'Set Price'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchServicePriceModal;
