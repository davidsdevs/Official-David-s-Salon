import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { X, Calendar, Clock, User, MapPin, Scissors, FileText, History, RotateCcw, CheckCircle, XCircle, PartyPopper, Plus, Edit, Package } from 'lucide-react';
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
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {statusLabels[status] || status?.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  // Debug: Log appointment data to see what we're working with
  console.log('🔍 AppointmentDetails - Full appointment data:', appointment);
  console.log('🔍 AppointmentDetails - Services:', appointment.services);
  console.log('🔍 AppointmentDetails - Services type:', typeof appointment.services, Array.isArray(appointment.services));
  console.log('🔍 AppointmentDetails - Products:', appointment.products);
  console.log('🔍 AppointmentDetails - Products type:', typeof appointment.products, Array.isArray(appointment.products));

  // Normalize services array - handle different data formats
  let servicesArray = [];
  if (appointment.services) {
    if (Array.isArray(appointment.services)) {
      servicesArray = appointment.services;
    } else if (typeof appointment.services === 'object') {
      // If it's a single object, wrap it in an array
      servicesArray = [appointment.services];
    }
  }

  // Use actual service data from appointment
  const selectedServices = servicesArray.length > 0
    ? servicesArray.map(svc => ({
        serviceId: svc.serviceId || svc.id || null,
        name: svc.serviceName || svc.name || `Service ${svc.serviceId || svc.id || 'Unknown'}`,
        price: svc.price || svc.servicePrice || 0,
        duration: svc.duration || 30,
        stylistId: svc.stylistId || null,
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

  // Normalize products array - handle different data formats
  let productsArray = [];
  if (appointment.products) {
    if (Array.isArray(appointment.products)) {
      productsArray = appointment.products;
    } else if (typeof appointment.products === 'object') {
      // If it's a single object, wrap it in an array
      productsArray = [appointment.products];
    }
  }

  // Extract products from appointment
  const selectedProducts = productsArray.length > 0
    ? productsArray.map(prod => ({
        productId: prod.productId || prod.id || null,
        name: prod.productName || prod.name || `Product ${prod.productId || prod.id || 'Unknown'}`,
        price: prod.price || 0,
        quantity: prod.quantity || 1
      }))
    : [];

  console.log('🔍 AppointmentDetails - Normalized services array:', servicesArray);
  console.log('🔍 AppointmentDetails - Normalized products array:', productsArray);
  console.log('🔍 AppointmentDetails - Selected Services:', selectedServices);
  console.log('🔍 AppointmentDetails - Selected Products:', selectedProducts);

  const totalProductsPrice = selectedProducts.reduce((total, product) => total + (product.price * product.quantity), 0);
  const totalItemsPrice = totalPrice + totalProductsPrice;

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
        <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-6 py-4 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Appointment Details</h2>
              <p className="text-white/70 text-sm mt-1">View appointment information</p>
            </div>
            <button 
              onClick={handleClose}
              className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto" style={{ 
          maxHeight: 'calc(95vh - 200px)',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin'
        }}>
          <div className="p-6 space-y-6">
            {/* Header with Client and Status */}
            <div className="text-center mb-4 pb-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{appointment.clientName || 'Guest Client'}</h3>
              <p className="text-xs text-gray-500 mb-2">Appointment #{appointment.id?.slice(-8) || 'N/A'}</p>
              <div className="flex justify-center">
                {getStatusBadge(appointment.status)}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column - Client & Appointment Info */}
              <div className="space-y-4">
                {/* Client Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <User className="w-4 h-4 text-gray-600 mr-2" />
                    <h4 className="text-sm font-semibold text-gray-900">Client Information</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-gray-600">Name:</span>
                      <span className="text-sm text-gray-900">{appointment.clientName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-gray-600">Phone:</span>
                      <span className="text-sm text-gray-900">{appointment.clientPhone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-gray-600">Email:</span>
                      <span className="text-sm text-gray-900 break-all">{appointment.clientEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <Calendar className="w-4 h-4 text-gray-600 mr-2" />
                    <h4 className="text-sm font-semibold text-gray-900">Appointment Details</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-gray-600">Date:</span>
                      <span className="text-sm text-gray-900">{appointmentDateFormatted}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-gray-600">Time:</span>
                      <span className="text-sm text-gray-900">{appointmentTimeFormatted}</span>
                    </div>
                    {appointment.branchName && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-gray-600">Branch:</span>
                        <span className="text-sm text-gray-900">{appointment.branchName}</span>
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="pt-2">
                        <div className="text-xs text-gray-600 mb-1">Notes:</div>
                        <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 p-2 rounded">{appointment.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Services & Products */}
              <div className="space-y-4">
                {/* Services */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <Scissors className="w-4 h-4 text-gray-600 mr-2" />
                    <h4 className="text-sm font-semibold text-gray-900">Services</h4>
                    {selectedServices.length > 0 && (
                      <span className="ml-auto text-xs text-gray-500">
                        {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedServices.length > 0 ? (
                      <>
                        {selectedServices.map((service, index) => (
                          <div key={index} className="border border-gray-200 rounded p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 mb-1">{service.name}</div>
                                <div className="text-xs text-gray-600">
                                  {service.stylistName || 'No stylist assigned'}
                                </div>
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-semibold text-gray-900">₱{service.price.toLocaleString()}</div>
                                {service.duration && (
                                  <div className="text-xs text-gray-500">{service.duration} min</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedServices.length > 0 && (
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600">Services Total:</span>
                              <span className="font-semibold text-gray-900">₱{totalPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4 text-gray-400 text-xs">
                        No services assigned
                      </div>
                    )}
                  </div>
                </div>

                {/* Products */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <Package className="w-4 h-4 text-gray-600 mr-2" />
                    <h4 className="text-sm font-semibold text-gray-900">Products</h4>
                    {selectedProducts.length > 0 && (
                      <span className="ml-auto text-xs text-gray-500">
                        {selectedProducts.length} {selectedProducts.length === 1 ? 'product' : 'products'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedProducts.length > 0 ? (
                      <>
                        {selectedProducts.map((product, index) => (
                          <div key={index} className="border border-gray-200 rounded p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 mb-1">{product.name}</div>
                                <div className="text-xs text-gray-600">
                                  Qty: {product.quantity}
                                </div>
                              </div>
                              <div className="text-right ml-3">
                                <div className="text-sm font-semibold text-gray-900">
                                  ₱{(product.price * product.quantity).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ₱{product.price.toLocaleString()} each
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedProducts.length > 0 && (
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600">Products Total:</span>
                              <span className="font-semibold text-gray-900">₱{totalProductsPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4 text-gray-400 text-xs">
                        No products added
                      </div>
                    )}
                  </div>
                </div>

                {/* Grand Total */}
                {(selectedServices.length > 0 || selectedProducts.length > 0) && (
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-600">
                        Grand Total
                      </div>
                      <div className="text-base font-semibold text-gray-900">
                        ₱{totalItemsPrice.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Appointment History */}
              {appointment.history && appointment.history.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-1 lg:col-span-2">
                  <div className="flex items-center mb-3 pb-2 border-b border-gray-200">
                    <History className="w-4 h-4 text-gray-600 mr-2" />
                    <h4 className="text-sm font-semibold text-gray-900">History</h4>
                    <span className="ml-auto text-xs text-gray-500">
                      {appointment.history.length} {appointment.history.length === 1 ? 'event' : 'events'}
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
                                  <div className="text-xs text-gray-600">
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

        {/* Footer Actions */}
        <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-t border-gray-200 flex-shrink-0">
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

