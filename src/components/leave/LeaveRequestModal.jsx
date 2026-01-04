/**
 * Leave Request Modal
 * For creating or editing leave requests
 */

import { useState, useEffect } from 'react';
import { X, Calendar, FileText, User, AlertTriangle, Loader2 } from 'lucide-react';
import { LEAVE_TYPES } from '../../services/leaveManagementService';
import { getFullName } from '../../utils/helpers';
import { formatDate } from '../../utils/helpers';
import { getAppointmentsByStylist, APPOINTMENT_STATUS } from '../../services/appointmentService';

const LeaveRequestModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  staffMembers = [], 
  isForStaff = false,
  currentUserId,
  editRequest = null // Pass existing request to edit
}) => {
  const [formData, setFormData] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    type: 'vacation',
    reason: '',
  });
  const [errors, setErrors] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictError, setConflictError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        employeeId: '',
        startDate: '',
        endDate: '',
        type: 'vacation',
        reason: '',
      });
      setErrors({});
      setConflicts([]);
      setConflictError('');
    } else if (editRequest) {
      // Populate form with existing request data
      const startDate = editRequest.startDate instanceof Date 
        ? editRequest.startDate 
        : new Date(editRequest.startDate);
      const endDate = editRequest.endDate instanceof Date 
        ? editRequest.endDate 
        : new Date(editRequest.endDate);
      
      setFormData({
        id: editRequest.id,
        employeeId: editRequest.employeeId || currentUserId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        type: editRequest.type || 'vacation',
        reason: editRequest.reason || '',
        status: editRequest.status || 'pending',
      });
    } else if (!isForStaff && currentUserId) {
      setFormData(prev => ({ ...prev, employeeId: currentUserId }));
    }
  }, [isOpen, isForStaff, currentUserId, editRequest]);

  useEffect(() => {
    const fetchConflicts = async () => {
      if (!formData.employeeId || !formData.startDate || !formData.endDate) {
        setConflicts([]);
        setConflictError('');
        return;
      }

      try {
        setConflictLoading(true);
        setConflictError('');
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const appointments = await getAppointmentsByStylist(formData.employeeId);
        const activeConflicts = appointments.filter((apt) => {
          if (!apt.appointmentDate) return false;
          const aptDate = apt.appointmentDate instanceof Date ? apt.appointmentDate : new Date(apt.appointmentDate);
          const status = apt.status;
          const isActiveStatus = status !== APPOINTMENT_STATUS.CANCELLED && status !== APPOINTMENT_STATUS.COMPLETED && status !== APPOINTMENT_STATUS.NO_SHOW;
          return isActiveStatus && aptDate >= start && aptDate <= end;
        });

        setConflicts(activeConflicts.slice(0, 10)); // show up to 10 inline
      } catch (err) {
        console.error('Error checking appointment conflicts:', err);
        setConflictError('Could not check appointments for this staff. Please try again.');
        setConflicts([]);
      } finally {
        setConflictLoading(false);
      }
    };

    fetchConflicts();
  }, [formData.employeeId, formData.startDate, formData.endDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (isForStaff && !formData.employeeId) {
      newErrors.employeeId = 'Please select an employee';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {editRequest ? 'Edit Leave Request' : (isForStaff ? 'Add Leave for Staff' : 'Request Leave')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isForStaff && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Employee *
              </label>
              <select
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                  errors.employeeId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select an employee...</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {getFullName(staff)}
                  </option>
                ))}
              </select>
              {errors.employeeId && (
                <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Leave Type *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {LEAVE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date *
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                errors.startDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date *
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              min={formData.startDate || new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                errors.endDate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
            )}
          </div>

          {/* Inline appointment conflicts */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              {conflictLoading ? (
                <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
              ) : (
                <AlertTriangle className={`w-4 h-4 ${conflicts.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
              )}
              <p className="text-sm font-semibold text-gray-900">
                Appointment Conflicts
              </p>
            </div>
            {!formData.employeeId || !formData.startDate || !formData.endDate ? (
              <p className="text-sm text-gray-600">Select staff and date range to check for conflicts.</p>
            ) : conflictLoading ? (
              <p className="text-sm text-gray-600">Checking appointments...</p>
            ) : conflictError ? (
              <p className="text-sm text-red-600">{conflictError}</p>
            ) : conflicts.length === 0 ? (
              <p className="text-sm text-green-700">No active appointments in this date range.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-700 font-medium">
                  {conflicts.length} active appointment{conflicts.length > 1 ? 's' : ''} in this date range:
                </p>
                <ul className="text-sm text-gray-800 list-disc list-inside space-y-1">
                  {conflicts.map((apt) => {
                    const d = apt.appointmentDate instanceof Date ? apt.appointmentDate : new Date(apt.appointmentDate);
                    return (
                      <li key={apt.id}>
                        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {apt.clientName || 'Client'} ({apt.status})
                      </li>
                    );
                  })}
                </ul>
                {conflicts.length >= 10 && (
                  <p className="text-xs text-gray-600">Showing first 10 conflicts.</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Reason (Optional)
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Enter reason for leave..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {editRequest ? 'Update Request' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveRequestModal;

