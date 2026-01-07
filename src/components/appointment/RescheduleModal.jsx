/**
 * Simple Reschedule Modal
 * Only allows changing date and time, keeps services/branch the same
 */

import { useState } from 'react';
import { X, Calendar, Clock, MapPin, Scissors, RefreshCw } from 'lucide-react';
import { formatTime12Hour } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';

const RescheduleModal = ({ isOpen, onClose, appointment, onSubmit, loading }) => {
  const [newDate, setNewDate] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState(null);

  if (!isOpen || !appointment) return null;

  const selectedBranch = appointment.branch || {};
  
  // Get operating hours for selected date
  let openTime = '09:00', closeTime = '18:00', isBranchOpen = true;
  if (selectedBranch.operatingHours && newDate) {
    const weekday = new Date(newDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hours = selectedBranch.operatingHours?.[weekday];
    if (hours) {
      openTime = hours.open || '09:00';
      closeTime = hours.close || '18:00';
      isBranchOpen = hours.isOpen !== false;
    }
  }

  // Helper to get min time (2 hours from now if today)
  let minTime = openTime;
  if (newDate) {
    const today = new Date();
    if (today.toISOString().split('T')[0] === newDate) {
      const nowPlus2 = new Date(today.getTime() + 2 * 60 * 60 * 1000);
      const min = nowPlus2.getHours().toString().padStart(2, '0') + ':' + nowPlus2.getMinutes().toString().padStart(2, '0');
      if (min > openTime) minTime = min;
    }
  }

  // Generate 30-min interval time boxes
  const getTimeBoxes = (start, end, min) => {
    const boxes = [];
    let [h, m] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const minHM = min.split(':').map(Number);
    while (h < endH || (h === endH && m < endM)) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      if (h > minHM[0] || (h === minHM[0] && m >= minHM[1])) {
        boxes.push(timeStr);
      }
      m += 30;
      if (m >= 60) { h += 1; m = 0; }
    }
    return boxes;
  };

  const timeBoxes = (newDate && isBranchOpen) ? getTimeBoxes(openTime, closeTime, minTime) : [];

  const handleSubmit = () => {
    if (newDate && newTimeSlot) {
      onSubmit(newDate, newTimeSlot);
    }
  };

  const handleClose = () => {
    setNewDate('');
    setNewTimeSlot(null);
    onClose();
  };

  // Get min date calculation
  const getMinDate = () => {
    const now = new Date();
    const todayWeekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayHours = selectedBranch.operatingHours?.[todayWeekday];
    const todayCloseTime = todayHours?.close || '18:00';
    
    const [closeH, closeM] = todayCloseTime.split(':').map(Number);
    const closingTime = new Date(now);
    closingTime.setHours(closeH, closeM, 0, 0);
    
    if (now >= closingTime) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const nowPlus2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (nowPlus2Hours >= closingTime) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Reschedule Appointment</h2>
                <p className="text-blue-100 text-sm mt-1">Choose a new date and time</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Current Appointment Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Appointment Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{appointment.branchName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Scissors className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">
                {appointment.services?.length || 1} service{(appointment.services?.length || 1) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Content - Date & Time Selection */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                New Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  setNewTimeSlot(null);
                }}
                min={getMinDate()}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base transition-colors bg-white"
                required
              />
              <p className="text-xs text-gray-500 mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                ℹ️ Bookings must be made at least 2 hours in advance
              </p>
            </div>

            {/* Time Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                New Time <span className="text-red-500">*</span>
              </label>
              {!newDate ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 text-center">
                  Please select a date first
                </div>
              ) : !isBranchOpen ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-base text-amber-900 font-semibold">Branch is closed on this day</p>
                </div>
              ) : timeBoxes.length === 0 ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 text-center shadow-sm">
                  <p className="text-base text-amber-900 font-semibold">No available times for this day</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {timeBoxes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setNewTimeSlot(time)}
                      className={`px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                        newTimeSlot === time
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-600 shadow-lg'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:shadow-md hover:bg-blue-50'
                      }`}
                    >
                      {formatTime12Hour(time)}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Open hours: {formatTime12Hour(openTime)} - {formatTime12Hour(closeTime)}
              </p>
            </div>

            {/* Reschedule Disclaimer */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4 shadow-sm">
              <h4 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                Important: Rescheduling Information
              </h4>
              <div className="space-y-2 text-xs text-amber-900">
                <p>
                  When you reschedule, your appointment will be marked as <span className="font-bold">"PENDING"</span> again and must be confirmed by the branch.
                </p>
                <p>
                  The branch will confirm your new appointment time within <span className="font-bold">24 hours</span>.
                </p>
                <p>
                  <span className="font-bold">Note:</span> Rescheduled appointments may be placed at the end of the queue. Your preferred time slot may not be guaranteed.
                </p>
                <p>
                  If not confirmed or if you have concerns, please contact the branch directly for assistance.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!newDate || !newTimeSlot || loading}
            className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <LoadingSpinner size="sm" />}
            {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
