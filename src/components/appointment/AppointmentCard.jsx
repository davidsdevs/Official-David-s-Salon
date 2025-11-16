/**
 * Appointment Card Component
 * Displays appointment information in a card format
 */

import { Calendar, Clock, User, MapPin, Tag, Phone, Mail } from 'lucide-react';
import { APPOINTMENT_STATUS } from '../../services/appointmentService';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';

const AppointmentCard = ({ appointment, onView, onEdit, onCancel, onUpdateStatus, showActions = true, processingStatus = null }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case APPOINTMENT_STATUS.PENDING:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case APPOINTMENT_STATUS.CONFIRMED:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case APPOINTMENT_STATUS.IN_SERVICE:
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case APPOINTMENT_STATUS.COMPLETED:
        return 'bg-green-100 text-green-700 border-green-200';
      case APPOINTMENT_STATUS.CANCELLED:
        return 'bg-red-100 text-red-700 border-red-200';
      case APPOINTMENT_STATUS.NO_SHOW:
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {appointment.clientName || 'Guest Client'}
          </h3>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
            {getStatusLabel(appointment.status)}
          </span>
        </div>
      </div>

      {/* Appointment Details */}
      <div className="space-y-2 mb-4">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span>{formatDate(appointment.appointmentDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>{formatTime(appointment.appointmentDate)} ({appointment.duration || 60} mins)</span>
        </div>

        {/* Service(s) */}
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Tag className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            {appointment.services && appointment.services.length > 0 ? (
              <div className="space-y-1">
                {appointment.services.map((service, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <span>{service.serviceName || 'Unknown Service'}</span>
                    {service.isChemical && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                        CHEMICAL
                      </span>
                    )}
                    {service.stylistName && (
                      <span className="text-xs text-gray-500">• {service.stylistName}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span>{appointment.serviceName || 'Unknown Service'}</span>
                {appointment.isChemical && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                    CHEMICAL
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stylist (only for single service) */}
        {!appointment.services && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4 flex-shrink-0" />
            <span>{appointment.stylistName || 'Unassigned'}</span>
          </div>
        )}

        {/* Branch */}
        {appointment.branchName && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{appointment.branchName}</span>
          </div>
        )}

        {/* Contact Info */}
        {appointment.clientPhone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4 flex-shrink-0" />
            <span>{appointment.clientPhone}</span>
          </div>
        )}

        {appointment.clientEmail && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{appointment.clientEmail}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {appointment.notes && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Notes:</p>
          <p className="text-sm text-gray-700">{appointment.notes}</p>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
          {onView && (
            <button
              onClick={() => onView(appointment)}
              className="flex-1 px-3 py-2 text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
            >
              View
            </button>
          )}
          
          {onEdit && appointment.status !== APPOINTMENT_STATUS.COMPLETED && appointment.status !== APPOINTMENT_STATUS.CANCELLED && (
            <button
              onClick={() => onEdit(appointment)}
              className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
          )}

          {onUpdateStatus && appointment.status === APPOINTMENT_STATUS.PENDING && (
            <button
              onClick={() => onUpdateStatus(appointment, APPOINTMENT_STATUS.CONFIRMED)}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingStatus === appointment.id && <LoadingSpinner size="sm" />}
              {processingStatus === appointment.id ? 'Confirming...' : 'Confirm'}
            </button>
          )}

          {onUpdateStatus && appointment.status === APPOINTMENT_STATUS.CONFIRMED && (
            <button
              onClick={() => onUpdateStatus(appointment, APPOINTMENT_STATUS.IN_SERVICE)}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-3 py-2 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingStatus === appointment.id && <LoadingSpinner size="sm" />}
              {processingStatus === appointment.id ? 'Starting...' : 'Start Service'}
            </button>
          )}

          {onUpdateStatus && appointment.status === APPOINTMENT_STATUS.IN_SERVICE && (
            <button
              onClick={() => onUpdateStatus(appointment, APPOINTMENT_STATUS.COMPLETED)}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-3 py-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processingStatus === appointment.id && <LoadingSpinner size="sm" />}
              {processingStatus === appointment.id ? 'Completing...' : 'Complete'}
            </button>
          )}

          {onCancel && appointment.status !== APPOINTMENT_STATUS.COMPLETED && appointment.status !== APPOINTMENT_STATUS.CANCELLED && (
            <button
              onClick={() => onCancel(appointment)}
              disabled={processingStatus === appointment.id}
              className="flex-1 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
