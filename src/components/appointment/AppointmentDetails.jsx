import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { X, Calendar, Clock, User, MapPin, Scissors, FileText, History, RotateCcw, CheckCircle, XCircle, PartyPopper, Plus, Edit } from 'lucide-react';
import { APPOINTMENT_STATUS } from '../../services/appointmentService';

const AppointmentDetails = ({ appointment, onClose, onEdit }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (appointment) {
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
    }
  }, [appointment]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => onClose(), 300);
  };

  if (!appointment) return null;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    try {
      // If time is already in HH:MM format, convert to 12-hour format
      if (typeof time === 'string' && time.match(/^\d{2}:\d{2}$/)) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
      }
      // If time is a timestamp, format it
      let d;
      if (time && typeof time === 'object' && 'toDate' in time) {
        d = time.toDate();
      } else if (time instanceof Date) {
        d = time;
      } else {
        d = new Date(time);
      }
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error, time);
      return 'N/A';
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status) => {
    const colors = {
      [APPOINTMENT_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      [APPOINTMENT_STATUS.CONFIRMED]: 'bg-blue-100 text-blue-800 border-blue-200',
      [APPOINTMENT_STATUS.IN_SERVICE]: 'bg-purple-100 text-purple-800 border-purple-200',
      [APPOINTMENT_STATUS.COMPLETED]: 'bg-green-100 text-green-800 border-green-200',
      [APPOINTMENT_STATUS.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
      [APPOINTMENT_STATUS.NO_SHOW]: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    const statusLabels = {
      [APPOINTMENT_STATUS.PENDING]: 'PENDING',
      [APPOINTMENT_STATUS.CONFIRMED]: 'CONFIRMED',
      [APPOINTMENT_STATUS.IN_SERVICE]: 'IN SERVICE',
      [APPOINTMENT_STATUS.COMPLETED]: 'COMPLETED',
      [APPOINTMENT_STATUS.CANCELLED]: 'CANCELLED',
      [APPOINTMENT_STATUS.NO_SHOW]: 'NO SHOW'
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border-2 ${colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {statusLabels[status] || status?.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  // Use actual service data from appointment
  const selectedServices = appointment.services && appointment.services.length > 0
    ? appointment.services.map(svc => ({
        serviceId: svc.serviceId || svc.id,
        name: svc.serviceName || svc.name || `Service ${svc.serviceId || svc.id}`,
        price: svc.price || svc.servicePrice || 0,
        duration: svc.duration || 30,
        stylistId: svc.stylistId,
        stylistName: svc.stylistName || 'Not assigned'
      }))
    : appointment.serviceId
    ? [{
        serviceId: appointment.serviceId,
        name: appointment.serviceName || 'Unknown Service',
        price: appointment.servicePrice || 0,
        duration: 30,
        stylistId: appointment.stylistId,
        stylistName: appointment.stylistName || 'Not assigned'
      }]
    : [];

  const totalDuration = selectedServices.reduce((total, service) => total + (service.duration || 30), 0);
  const totalPrice = selectedServices.reduce((total, service) => total + (service.price || 0), 0);

  // Extract date and time from appointmentDate if it's a full timestamp
  const appointmentDate = appointment.appointmentDate;
  const appointmentDateFormatted = appointmentDate ? formatDate(appointmentDate) : 'N/A';
  
  // Try to get time from appointmentDate first, then appointmentTime, then appointmentDate as string
  let appointmentTimeFormatted = 'N/A';
  if (appointmentDate) {
    appointmentTimeFormatted = formatTime(appointmentDate);
  } else if (appointment.appointmentTime) {
    appointmentTimeFormatted = formatTime(appointment.appointmentTime);
  } else if (appointment.time) {
    appointmentTimeFormatted = formatTime(appointment.time);
  }

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 transition-opacity duration-200 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col transition-all duration-300 ease-out transform ${isAnimating ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-4 sm:px-6 py-3 sm:py-4 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold">Appointment Details</h2>
              <p className="text-blue-100 mt-1 text-sm sm:text-base">
                View appointment information
              </p>
            </div>
            <button 
              onClick={handleClose}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto" style={{ 
          maxHeight: 'calc(95vh - 200px)',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin'
        }}>
          <div className="p-4 sm:p-6 space-y-6">
            {/* Header with Client and Status - Enhanced */}
            <div className="text-center mb-8 pb-6 border-b-2 border-gray-200">
              <div className="inline-block bg-gradient-to-r from-[#160B53]/10 to-[#2D1B69]/10 rounded-full px-6 py-3 mb-4">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{appointment.clientName || 'Guest Client'}</h3>
                <p className="text-sm text-gray-600">Appointment #{appointment.id?.slice(-8) || 'N/A'}</p>
              </div>
              <div className="flex justify-center mt-4">
                {getStatusBadge(appointment.status)}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Client & Appointment Info */}
              <div className="space-y-6">
                {/* Client Information - Enhanced */}
                <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-5 pb-3 border-b-2 border-gray-200">
                    <div className="p-2 bg-[#160B53]/10 rounded-lg mr-3">
                      <User className="w-6 h-6 text-[#160B53]" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900">Client Information</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 px-3 bg-white rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-1 h-4 bg-[#160B53] rounded-full"></span>
                        Name:
                      </span>
                      <span className="text-gray-900 font-medium">{appointment.clientName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-3 bg-white rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-1 h-4 bg-[#160B53] rounded-full"></span>
                        Phone:
                      </span>
                      <span className="text-gray-900 font-medium">{appointment.clientPhone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-3 bg-white rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-1 h-4 bg-[#160B53] rounded-full"></span>
                        Email:
                      </span>
                      <span className="text-gray-900 font-medium text-sm break-all">{appointment.clientEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Appointment Details - Enhanced */}
                <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-5 pb-3 border-b-2 border-gray-200">
                    <div className="p-2 bg-[#160B53]/10 rounded-lg mr-3">
                      <Calendar className="w-6 h-6 text-[#160B53]" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900">Appointment Details</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 px-3 bg-white rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#160B53]" />
                        Date:
                      </span>
                      <span className="text-gray-900 font-medium">{appointmentDateFormatted}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-3 bg-white rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#160B53]" />
                        Time:
                      </span>
                      <span className="text-gray-900 font-medium">{appointmentTimeFormatted}</span>
                    </div>
                    {appointment.branchName && (
                      <div className="flex justify-between items-center py-3 px-3 bg-white rounded-lg border border-gray-200">
                        <span className="font-semibold text-gray-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#160B53]" />
                          Branch:
                        </span>
                        <span className="text-gray-900 font-medium">{appointment.branchName}</span>
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="pt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-[#160B53]" />
                          <span className="font-semibold text-gray-700">Notes:</span>
                        </div>
                        <div className="text-gray-900 text-sm bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 p-4 rounded-lg">{appointment.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Services & Stylists */}
              <div className="space-y-6">
                {/* Services and Stylists - Enhanced */}
                <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-5 pb-3 border-b-2 border-gray-200">
                    <div className="p-2 bg-[#160B53]/10 rounded-lg mr-3">
                      <Scissors className="w-6 h-6 text-[#160B53]" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900">Services & Stylists</h4>
                    {selectedServices.length > 0 && (
                      <span className="ml-auto px-3 py-1 bg-[#160B53]/10 text-[#160B53] rounded-full text-sm font-semibold">
                        {selectedServices.length} {selectedServices.length === 1 ? 'Service' : 'Services'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {selectedServices.length > 0 ? (
                      <>
                        {selectedServices.map((service, index) => (
                          <div key={index} className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-[#160B53]/30 transition-all shadow-sm">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 bg-gradient-to-br from-[#160B53] to-[#2D1B69] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                                    {index + 1}
                                  </div>
                                  <h5 className="font-bold text-lg text-gray-900">{service.name}</h5>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 ml-10">
                                  <User className="w-4 h-4 text-[#160B53]" />
                                  <span className="font-medium">
                                    {service.stylistName || 'Any available stylist'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4 border-l-2 border-gray-200 pl-4">
                                <p className="font-bold text-[#160B53] text-xl mb-1">₱{service.price.toLocaleString()}</p>
                                {service.duration && (
                                  <p className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {service.duration} min
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Total Summary - Enhanced */}
                        <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] rounded-xl p-5 text-white shadow-lg mt-6">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-semibold text-lg block mb-1">Total Amount</span>
                              <span className="text-sm opacity-90">
                                {totalDuration} minutes total
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold">
                                ₱{totalPrice.toLocaleString()}
                              </div>
                              <div className="text-xs opacity-75 mt-1">
                                Estimated Price
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <Scissors className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 font-medium">No services assigned</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Appointment History Timeline - Enhanced */}
              {appointment.history && appointment.history.length > 0 && (
                <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 shadow-md col-span-1 lg:col-span-2">
                  <div className="flex items-center mb-6 pb-3 border-b-2 border-gray-200">
                    <div className="p-2 bg-[#160B53]/10 rounded-lg mr-3">
                      <History className="w-6 h-6 text-[#160B53]" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900">Appointment History</h4>
                    <span className="ml-auto px-3 py-1 bg-[#160B53]/10 text-[#160B53] rounded-full text-sm font-semibold">
                      {appointment.history.length} {appointment.history.length === 1 ? 'Event' : 'Events'}
                    </span>
                  </div>
                  
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                    
                    <div className="space-y-6">
                      {appointment.history.map((entry, index) => {
                        const getActionIcon = (action) => {
                          if (action.includes('rescheduled') || action === 'updated') return <RotateCcw className="w-4 h-4" />;
                          if (action.includes('confirmed')) return <CheckCircle className="w-4 h-4" />;
                          if (action.includes('cancelled')) return <XCircle className="w-4 h-4" />;
                          if (action.includes('completed')) return <PartyPopper className="w-4 h-4" />;
                          if (action.includes('created')) return <Plus className="w-4 h-4" />;
                          if (action.includes('checked_in')) return <CheckCircle className="w-4 h-4" />;
                          if (action.includes('deleted')) return <XCircle className="w-4 h-4" />;
                          return <Edit className="w-4 h-4" />;
                        };

                        const getActionColor = (action) => {
                          if (action.includes('rescheduled') || action === 'updated') return 'bg-blue-100 text-blue-800 border-blue-200';
                          if (action.includes('confirmed')) return 'bg-green-100 text-green-800 border-green-200';
                          if (action.includes('cancelled') || action.includes('deleted')) return 'bg-red-100 text-red-800 border-red-200';
                          if (action.includes('completed')) return 'bg-purple-100 text-purple-800 border-purple-200';
                          if (action.includes('created')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
                          if (action.includes('checked_in')) return 'bg-green-100 text-green-800 border-green-200';
                          return 'bg-gray-100 text-gray-800 border-gray-200';
                        };

                        return (
                          <div key={index} className="relative flex items-start">
                            {/* Timeline dot */}
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${getActionColor(entry.action)}`}>
                              {getActionIcon(entry.action)}
                            </div>
                            
                            {/* Content */}
                            <div className="ml-4 flex-1 min-w-0">
                              <div className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-[#160B53]/30 transition-colors shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                  <h5 className="font-bold text-gray-900 capitalize text-base">
                                    {entry.action?.replace(/_/g, ' ')}
                                  </h5>
                                  <span className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
                                    {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    }) : 'N/A'}
                                  </span>
                                </div>
                                
                                {entry.details && (
                                  <div className="text-sm text-gray-600">
                                    {entry.action === 'rescheduled' && entry.details && (
                                      <div className="space-y-1">
                                        {entry.details.oldDate && (
                                          <div className="flex items-center text-xs">
                                            <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                                            <span className="line-through text-red-600">
                                              {new Date(entry.details.oldDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                              })} at {entry.details.oldTime ? (() => {
                                                const time = entry.details.oldTime;
                                                if (typeof time === 'string' && time.match(/^\d{2}:\d{2}$/)) {
                                                  const [hours, minutes] = time.split(':');
                                                  const hour = parseInt(hours, 10);
                                                  const ampm = hour >= 12 ? 'PM' : 'AM';
                                                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                                  return `${displayHour}:${minutes} ${ampm}`;
                                                }
                                                return time;
                                              })() : 'N/A'}
                                            </span>
                                          </div>
                                        )}
                                        {entry.details.newDate && (
                                          <div className="flex items-center text-xs">
                                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                            <span className="text-green-600 font-medium">
                                              {new Date(entry.details.newDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                              })} at {entry.details.newTime ? (() => {
                                                const time = entry.details.newTime;
                                                if (typeof time === 'string' && time.match(/^\d{2}:\d{2}$/)) {
                                                  const [hours, minutes] = time.split(':');
                                                  const hour = parseInt(hours, 10);
                                                  const ampm = hour >= 12 ? 'PM' : 'AM';
                                                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                                  return `${displayHour}:${minutes} ${ampm}`;
                                                }
                                                return time;
                                              })() : 'N/A'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {entry.action === 'rescheduled' && entry.reason && (
                                      <div className="mt-2 text-xs text-gray-600 italic">
                                        <p><strong>Reason:</strong> {entry.reason}</p>
                                      </div>
                                    )}
                                    {entry.action === 'status_changed_to_confirmed' && (
                                      <div className="flex items-center text-green-600 text-xs">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        <span>Appointment confirmed</span>
                                      </div>
                                    )}
                                    {entry.action === 'status_changed_to_cancelled' && (
                                      <div className="text-red-600 text-xs">
                                        <div className="flex items-center mb-1">
                                          <XCircle className="w-3 h-3 mr-1" />
                                          <span>Appointment cancelled</span>
                                        </div>
                                        {entry.reason && (
                                          <p className="text-gray-600 italic">Reason: {entry.reason}</p>
                                        )}
                                      </div>
                                    )}
                                    {entry.action === 'status_changed_to_completed' && (
                                      <div className="flex items-center text-purple-600 text-xs">
                                        <PartyPopper className="w-3 h-3 mr-1" />
                                        <span>Appointment completed</span>
                                      </div>
                                    )}
                                    {entry.action === 'checked_in' && (
                                      <div className="flex items-center text-green-600 text-xs">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        <span>Client checked in</span>
                                      </div>
                                    )}
                                    {entry.action === 'deleted' && (
                                      <div className="flex items-center text-red-600 text-xs">
                                        <XCircle className="w-3 h-3 mr-1" />
                                        <span>Appointment deleted</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions - Fixed at bottom - Enhanced */}
        <div className="bg-gradient-to-r from-gray-50 to-white px-4 sm:px-6 py-4 border-t-2 border-gray-200 flex-shrink-0 shadow-lg">
          <div className="flex justify-end gap-3">
            {onEdit && (
              <button
                onClick={() => {
                  handleClose();
                  onEdit(appointment);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Appointment
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-6 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-semibold shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetails;

