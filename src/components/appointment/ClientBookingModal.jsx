/**
 * Client Booking Modal Component
 * Specialized modal for client-side appointment booking with time slot selection
 */

import { X } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { formatTime } from '../../utils/helpers';

const ClientBookingModal = ({
  isOpen,
  onClose,
  bookingData,
  setBookingData,
  branches,
  services,
  stylists,
  availableSlots,
  loadingSlots,
  unavailableMessage,
  booking,
  onSubmit
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Book Appointment</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={booking}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Branch Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Branch *
              </label>
              <select
                value={bookingData.branchId}
                onChange={(e) => setBookingData({ ...bookingData, branchId: e.target.value, serviceId: '', stylistId: '', date: '', timeSlot: null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Choose a branch</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name || branch.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Selection */}
            {bookingData.branchId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Service *
                </label>
                <select
                  value={bookingData.serviceId}
                  onChange={(e) => setBookingData({ ...bookingData, serviceId: e.target.value, timeSlot: null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a service</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.serviceName}{service.isChemical ? ' [CHEMICAL]' : ''} - ₱{service.price} ({service.duration}min)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Stylist Selection (Optional) */}
            {bookingData.serviceId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Stylist (Optional)
                </label>
                <select
                  value={bookingData.stylistId}
                  onChange={(e) => setBookingData({ ...bookingData, stylistId: e.target.value, timeSlot: null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Any available stylist</option>
                  {stylists.map(stylist => (
                    <option key={stylist.id} value={stylist.id}>
                      {stylist.firstName} {stylist.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Selection */}
            {bookingData.serviceId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Date *
                </label>
                <input
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => setBookingData({ ...bookingData, date: e.target.value, timeSlot: null })}
                  min={(() => {
                    const minDate = new Date();
                    minDate.setHours(minDate.getHours() + 2);
                    return minDate.toISOString().split('T')[0];
                  })()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            {/* Time Slot Selection */}
            {bookingData.date && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Time Slot *
                </label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-amber-800 font-medium">
                      {unavailableMessage || 'No available slots for this date'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {availableSlots.map((slot, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => slot.available && setBookingData({ ...bookingData, timeSlot: slot })}
                        disabled={!slot.available}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          bookingData.timeSlot?.time === slot.time
                            ? 'bg-primary-600 text-white border-primary-600'
                            : slot.available
                            ? 'bg-white text-gray-700 border-gray-300 hover:border-primary-500'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {formatTime(slot.time)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {bookingData.timeSlot && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any special requests or notes..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={booking}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={booking || !bookingData.timeSlot}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {booking && <LoadingSpinner size="sm" />}
              {booking ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientBookingModal;
