/**
 * Appointment Card Component
 * Displays appointment information in a card format
 * Redesigned layout: Service, Stylist, Date, Time, Location
 */

import { Calendar, Clock, CheckCircle2, MapPin, User, RefreshCw } from 'lucide-react';
import { APPOINTMENT_STATUS } from '../../services/appointmentService';
import { formatDate, formatTime, getTimeAgo } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';

const AppointmentCard = ({ appointment, onView, onEdit, onCancel, onReschedule, onUpdateStatus, showActions = true, processingStatus = null }) => {
  const getStatusLabel = (status) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Get primary service and stylist info
  const primaryService = appointment.services && appointment.services.length > 0 
    ? appointment.services[0] 
    : { serviceName: appointment.serviceName || 'Service', stylistName: appointment.stylistName || null };
  
  const appointmentDate = appointment.appointmentDate ? new Date(appointment.appointmentDate) : null;
  const dayName = appointmentDate ? appointmentDate.toLocaleDateString('en-US', { weekday: 'long' }) : '';
  const formattedDate = formatDate(appointment.appointmentDate);
  const formattedTime = formatTime(appointment.appointmentDate);
  const timeAgo = appointment.createdAt ? getTimeAgo(appointment.createdAt) : '';

  const handleKeyDown = (e) => {
    if (!onView) return
    if (e.key === 'Enter' || e.key === ' ') {
      onView(appointment)
    }
  }

  return (
    <div
      role={onView ? 'button' : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onClick={() => onView ? onView(appointment) : undefined}
      className={`bg-white rounded-xl shadow-md border-2 border-gray-200 p-3 hover:shadow-xl hover:border-[#160B53] hover:scale-[1.02] transition-all overflow-hidden ${onView ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#160B53]' : ''}`}
    >
      {/* Content Container - Prevent Overflow */}
      <div className="space-y-2 mb-3">
        {/* Service Name */}
        <div className="pb-2 border-b-2 border-gray-100">
          <h3 className="text-base font-bold text-gray-900 line-clamp-2">
            {primaryService.serviceName || 'Service'}
            {appointment.services && appointment.services.length > 1 && (
              <span className="ml-2 text-sm font-normal text-[#160B53] bg-[#160B53]/10 px-2 py-0.5 rounded-full">
                +{appointment.services.length - 1} more
              </span>
            )}
          </h3>
        </div>

        {/* Stylist Name */}
        {primaryService.stylistName && (
          <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-2 py-1.5 rounded-lg">
            <User className="w-4 h-4 flex-shrink-0 text-[#160B53]" />
            <span className="line-clamp-1 font-medium">with {primaryService.stylistName}</span>
          </div>
        )}

        {/* Date and Time Combined */}
        {appointmentDate && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2">
            <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
              <Calendar className="w-4 h-4 flex-shrink-0 text-[#160B53]" />
              <span className="font-semibold line-clamp-1">
                {dayName}, {formattedDate}
              </span>
            </div>
            {formattedTime && (
              <div className="flex items-center gap-2 text-sm text-gray-600 ml-6">
                <Clock className="w-3.5 h-3.5 flex-shrink-0 text-[#160B53]" />
                <span className="line-clamp-1">{formattedTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Location with MapPin Icon */}
        {appointment.branchName && (
          <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-2 py-1.5 rounded-lg">
            <MapPin className="w-4 h-4 flex-shrink-0 text-[#160B53]" />
            <span className="line-clamp-1 font-medium">{appointment.branchName}</span>
          </div>
        )}

        {/* Time Indicator */}
        {timeAgo && (
          <div className="text-xs text-gray-400 pt-1">
            {timeAgo}
          </div>
        )}
      </div>

      {/* Status Indicator - Bottom, Enhanced */}
      <div className="pt-2 border-t-2 border-gray-200">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border-2 ${
            appointment.status === APPOINTMENT_STATUS.PENDING ? 'bg-yellow-50 text-yellow-800 border-yellow-300' :
            appointment.status === APPOINTMENT_STATUS.CONFIRMED ? 'bg-blue-50 text-blue-800 border-blue-300' :
            appointment.status === APPOINTMENT_STATUS.IN_SERVICE ? 'bg-purple-50 text-purple-800 border-purple-300' :
            appointment.status === APPOINTMENT_STATUS.COMPLETED ? 'bg-green-50 text-green-800 border-green-300' :
            appointment.status === APPOINTMENT_STATUS.CANCELLED ? 'bg-red-50 text-red-800 border-red-300' :
            'bg-gray-100 text-gray-600 border-gray-300'
          }`}>
            {getStatusLabel(appointment.status)}
          </span>
          {appointment.totalPrice && (
            <span className="text-sm font-bold text-[#160B53]">
              ₱{appointment.totalPrice.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
          {onView && (
            <button
              onClick={(e) => { e.stopPropagation(); onView(appointment) }}
              className="flex-1 px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#160B53] to-[#2D1B69] border-2 border-[#160B53] rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all shadow-sm hover:shadow-md"
            >
              View Details
            </button>
          )}
          
          {onReschedule && appointment.status === APPOINTMENT_STATUS.PENDING && (
            <button
              onClick={(e) => { e.stopPropagation(); onReschedule(appointment) }}
              className="flex-1 px-2 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reschedule
            </button>
          )}

          {onUpdateStatus && appointment.status === APPOINTMENT_STATUS.PENDING && (
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(appointment, APPOINTMENT_STATUS.CONFIRMED) }}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-2 py-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingStatus === appointment.id && <LoadingSpinner size="sm" />}
              {processingStatus === appointment.id ? 'Confirming...' : 'Confirm'}
            </button>
          )}

          {onUpdateStatus && appointment.status === APPOINTMENT_STATUS.CONFIRMED && (
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(appointment, APPOINTMENT_STATUS.IN_SERVICE) }}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-2 py-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingStatus === appointment.id && <LoadingSpinner size="sm" />}
              {processingStatus === appointment.id ? 'Starting...' : 'Start Service'}
            </button>
          )}

          {onUpdateStatus && appointment.status === APPOINTMENT_STATUS.IN_SERVICE && (
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateStatus(appointment, APPOINTMENT_STATUS.COMPLETED) }}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-2 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingStatus === appointment.id && <LoadingSpinner size="sm" />}
              {processingStatus === appointment.id ? 'Completing...' : 'Complete'}
            </button>
          )}

          {onCancel && appointment.status !== APPOINTMENT_STATUS.COMPLETED && appointment.status !== APPOINTMENT_STATUS.CANCELLED && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(appointment) }}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-2 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentCard;
