/**
 * Approve Lending Request Modal
 * Allows branch manager to approve/reject lending requests
 * If stylistId is null (any available), allows choosing a stylist
 * Shows appointment conflicts when selecting a stylist
 */

import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, User, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getUsersByBranch, getUserById } from '../../services/userService';
import { getAppointmentsByStylist, getAppointmentsByDateRange } from '../../services/appointmentService';
import { approveLendingRequest, rejectLendingRequest } from '../../services/stylistLendingService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { getFullName, getInitials, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ApproveLendingModal = ({
  isOpen,
  request,
  onClose,
  onSave
}) => {
  const { currentUser, userBranch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stylists, setStylists] = useState([]);
  const [selectedStylistId, setSelectedStylistId] = useState(null);
  const [selectedStylistInfo, setSelectedStylistInfo] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (isOpen && request) {
      // If stylistId is null, we need to choose a stylist
      if (!request.stylistId) {
        fetchStylists();
        setSelectedStylistId(null);
        setSelectedStylistInfo(null);
      } else {
        // Stylist already chosen, fetch stylist info and appointments
        setSelectedStylistId(request.stylistId);
        fetchStylistInfo(request.stylistId);
        fetchAppointments(request.stylistId);
      }
      setAppointments([]);
      setConflicts([]);
      setRejectionReason('');
    }
  }, [isOpen, request]);

  const fetchStylistInfo = async (stylistId) => {
    try {
      const stylist = await getUserById(stylistId);
      setSelectedStylistInfo(stylist);
    } catch (error) {
      console.error('Error fetching stylist info:', error);
      setSelectedStylistInfo(null);
    }
  };

  const fetchStylists = async () => {
    try {
      setLoading(true);
      const branchStaff = await getUsersByBranch(userBranch);
      const stylistStaff = branchStaff.filter(user => {
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.includes(USER_ROLES.STYLIST) && user.isActive !== false;
      });
      setStylists(stylistStaff);
    } catch (error) {
      console.error('Error fetching stylists:', error);
      toast.error('Failed to load stylists');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async (stylistId) => {
    if (!stylistId || !request) return;
    
    try {
      setLoadingAppointments(true);
      const startDate = request.startDate;
      const endDate = request.endDate;
      
      // Fetch appointments for this stylist in the date range
      const stylistAppointments = await getAppointmentsByStylist(stylistId);
      
      // Filter appointments that fall within the lending date range
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const conflictingAppointments = stylistAppointments.filter(apt => {
        if (!apt.appointmentDate) return false;
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        
        // Check if appointment is within lending date range
        return aptDate >= start && aptDate <= end;
      });
      
      setAppointments(stylistAppointments);
      setConflicts(conflictingAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleStylistSelect = (stylistId) => {
    setSelectedStylistId(stylistId);
    const selectedStylist = stylists.find(s => (s.id || s.uid) === stylistId);
    setSelectedStylistInfo(selectedStylist);
    fetchAppointments(stylistId);
  };

  const handleApprove = async () => {
    if (!request) return;
    
    // If stylistId was null and we need to choose one
    if (!request.stylistId && !selectedStylistId) {
      toast.error('Please select a stylist to approve this request');
      return;
    }

    try {
      setSaving(true);
      const stylistIdToApprove = selectedStylistId || request.stylistId;
      
      // Update the request with the selected stylist if it was "any available"
      if (!request.stylistId && selectedStylistId) {
        // We need to update the request first, then approve
        const requestRef = doc(db, 'stylist_lending', request.id);
        await updateDoc(requestRef, {
          stylistId: selectedStylistId,
          updatedAt: Timestamp.now()
        });
      }
      
      await approveLendingRequest(request.id, currentUser, selectedStylistId || request.stylistId);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    
    try {
      setSaving(true);
      await rejectLendingRequest(request.id, rejectionReason, currentUser);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !request) return null;

  const selectedStylist = selectedStylistInfo || stylists.find(s => (s.id || s.uid) === selectedStylistId);
  const needsStylistSelection = !request.stylistId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {needsStylistSelection ? 'Choose Stylist & Approve Request' : 'Approve/Reject Lending Request'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Review the request and {needsStylistSelection ? 'select a stylist' : 'approve or reject'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Request Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Request Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Start Date</p>
                <p className="font-medium text-gray-900">
                  {request.startDate ? formatDate(request.startDate, 'MMM dd, yyyy') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">End Date</p>
                <p className="font-medium text-gray-900">
                  {request.endDate ? formatDate(request.endDate, 'MMM dd, yyyy') : 'N/A'}
                </p>
              </div>
              {request.reason && (
                <div className="col-span-2">
                  <p className="text-gray-500">Reason</p>
                  <p className="text-gray-700">{request.reason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Stylist Selection (if needed) */}
          {needsStylistSelection && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Select Stylist</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : stylists.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">No available stylists found in your branch</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {stylists.map((stylist) => {
                    const stylistId = stylist.id || stylist.uid;
                    const isSelected = selectedStylistId === stylistId;
                    
                    return (
                      <button
                        key={stylistId}
                        onClick={() => handleStylistSelect(stylistId)}
                        className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {getInitials(stylist)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{getFullName(stylist)}</p>
                            <p className="text-sm text-gray-500">{stylist.email}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-primary-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selected Stylist Info */}
          {selectedStylistId && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5" />
                Selected Stylist
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedStylist ? getInitials(selectedStylist) : '?'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {selectedStylist ? getFullName(selectedStylist) : 'Loading...'}
                    </p>
                    {selectedStylist?.email && (
                      <p className="text-sm text-gray-500">{selectedStylist.email}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appointment Conflicts */}
          {selectedStylistId && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Appointment Conflicts
                {loadingAppointments && (
                  <LoadingSpinner size="sm" />
                )}
              </h3>
              
              {loadingAppointments ? (
                <div className="text-center py-4 text-gray-500">Loading appointments...</div>
              ) : conflicts.length > 0 ? (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">
                        {conflicts.length} appointment{conflicts.length !== 1 ? 's' : ''} found during lending period
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        The selected stylist has existing appointments that conflict with the lending dates.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {conflicts.map((apt) => (
                      <div key={apt.id} className="bg-white rounded p-3 border border-red-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {apt.appointmentDate ? formatDate(apt.appointmentDate, 'MMM dd, yyyy') : 'N/A'}
                            </p>
                            {apt.appointmentTime && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {apt.appointmentTime}
                              </p>
                            )}
                            {apt.clientName && (
                              <p className="text-xs text-gray-500 mt-1">Client: {apt.clientName}</p>
                            )}
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                            Conflict
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-green-800 font-medium">No appointment conflicts found</p>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    The stylist has no appointments during the requested lending period.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rejection Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason (Optional)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Provide a reason for rejection..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={saving || (needsStylistSelection && !selectedStylistId)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            {saving ? 'Processing...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApproveLendingModal;

