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
    // If time is already in HH:MM format, convert to 12-hour format
    if (typeof time === 'string' && time.match(/^\d{2}:\d{2}$/)) {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    }
    // If time is a timestamp, format it
    const d = time.toDate ? time.toDate() : new Date(time);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
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
  const appointmentTimeFormatted = appointmentDate ? formatTime(appointmentDate) : (appointment.appointmentTime ? formatTime(appointment.appointmentTime) : 'N/A');

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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-6">
            {/* Header with Client and Status */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{appointment.clientName || 'Guest Client'}</h3>
              <p className="text-gray-600 mb-4">Appointment #{appointment.id?.slice(-8) || 'N/A'}</p>
              <div className="flex justify-center">
                {getStatusBadge(appointment.status)}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Client & Appointment Info */}
              <div className="space-y-6">
                {/* Client Information */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <User className="w-5 h-5 text-[#160B53] mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Client Information</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Name:</span>
                      <span className="text-gray-900">{appointment.clientName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Phone:</span>
                      <span className="text-gray-900">{appointment.clientPhone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="font-medium text-gray-700">Email:</span>
                      <span className="text-gray-900">{appointment.clientEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <Calendar className="w-5 h-5 text-[#160B53] mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Appointment Details</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Date:</span>
                      <span className="text-gray-900">{appointmentDateFormatted}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Time:</span>
                      <span className="text-gray-900">{appointmentTimeFormatted}</span>
                    </div>
                    {appointment.branchName && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="font-medium text-gray-700">Branch:</span>
                        <span className="text-gray-900">{appointment.branchName}</span>
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="pt-2">
                        <span className="font-medium text-gray-700 block mb-1">Notes:</span>
                        <span className="text-gray-900 text-sm bg-gray-50 p-2 rounded block">{appointment.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Services & Stylists */}
              <div className="space-y-6">
                {/* Services and Stylists */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <Scissors className="w-5 h-5 text-[#160B53] mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Services & Stylists</h4>
                  </div>
                  <div className="space-y-4">
                    {selectedServices.length > 0 ? (
                      <>
                        {selectedServices.map((service, index) => (
                          <div key={index} className="bg-gradient-to-r from-[#160B53]/5 to-[#2D1B69]/5 border border-[#160B53]/20 rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 mb-1">{service.name}</h5>
                                <div className="flex items-center text-sm text-gray-600">
                                  <Scissors className="w-4 h-4 mr-1" />
                                  <span>Stylist: {service.stylistName || 'Not assigned'}</span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-bold text-[#160B53] text-lg">₱{service.price.toLocaleString()}</p>
                                <p className="text-sm text-gray-600">{service.duration || 30} min</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Total Summary */}
                        <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] rounded-lg p-4 text-white">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-lg">Total:</span>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                ₱{totalPrice.toLocaleString()}
                              </div>
                              <div className="text-sm opacity-90">
                                {totalDuration} minutes total
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No services assigned</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Appointment History Timeline */}
              {appointment.history && appointment.history.length > 0 && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm col-span-1 lg:col-span-2">
                  <div className="flex items-center mb-6">
                    <History className="w-5 h-5 text-[#160B53] mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Appointment History</h4>
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
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="font-semibold text-gray-900 capitalize text-sm">
                                    {entry.action?.replace(/_/g, ' ')}
                                  </h5>
                                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
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

        {/* Footer Actions - Fixed at bottom */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t flex-shrink-0">
          <div className="flex justify-end gap-3">
            {onEdit && (
              <Button 
                variant="primary"
                onClick={() => {
                  handleClose();
                  onEdit(appointment);
                }}
              >
                Edit
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetails;

