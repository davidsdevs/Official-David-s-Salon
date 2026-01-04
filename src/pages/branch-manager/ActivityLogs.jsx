/**
 * Branch Activity Logs Page
 * Dedicated page for branch managers to view branch-scoped activity logs.
 * Uses client-side sorting fallback to avoid Firestore composite index requirements.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, Filter, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getActivityLogs } from '../../services/activityService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ActivityLogs = () => {
  const { userBranch } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all'); // staff filter
  const [limitCount, setLimitCount] = useState(100);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const getActionLabel = (action) => {
    const actionLabels = {
      user_created: 'Created User',
      user_updated: 'Updated User',
      user_activated: 'Activated User',
      user_deactivated: 'Deactivated User',
      user_login: 'Logged In',
      user_logout: 'Logged Out',
      password_reset: 'Password Reset',
      profile_updated: 'Updated Profile',
      role_changed: 'Changed Role',
      branch_assigned: 'Assigned to Branch',
      service_created: 'Created Service',
      service_updated: 'Updated Service',
      service_toggled: 'Toggled Service',
      product_created: 'Created Product',
      product_updated: 'Updated Product',
      stock_adjusted: 'Adjusted Stock',
      stock_transferred: 'Transferred Stock',
      bill_created: 'Created Bill',
      appointment_created: 'Created Appointment',
      appointment_updated: 'Updated Appointment',
      appointment_cancelled: 'Cancelled Appointment'
    };
    return actionLabels[action] || action?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown Action';
  };

  useEffect(() => {
    const fetchLogs = async () => {
      if (!userBranch) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getActivityLogs(
          { branchId: userBranch, limit: limitCount },
          { allowClientSortFallback: true }
        );
        setLogs(data);
      } catch (error) {
        const isIndexError = error?.code === 'failed-precondition' || error?.message?.toLowerCase().includes('index');
        if (isIndexError) {
          toast.error('Firestore index required. We applied a fallback, but please consider adding the suggested index for faster queries.');
        } else {
          toast.error('Failed to load activity logs');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [userBranch, limitCount]);

  useEffect(() => {
    let next = [...logs];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      next = next.filter((log) =>
        log.performedByName?.toLowerCase().includes(term) ||
        log.details?.entityName?.toLowerCase().includes(term) ||
        log.action?.toLowerCase().includes(term)
      );
    }
    if (actionFilter !== 'all') {
      next = next.filter((log) => log.action === actionFilter);
    }
    if (userFilter !== 'all') {
      next = next.filter((log) => log.performedBy === userFilter);
    }
    setFilteredLogs(next);
  }, [logs, searchTerm, actionFilter, userFilter]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, userFilter, logs]);

  const uniqueActions = useMemo(() => {
    return ['all', ...new Set(logs.map((log) => log.action).filter(Boolean))];
  }, [logs]);

  const uniqueUsers = useMemo(() => {
    const entries = logs
      .filter((log) => log.performedBy)
      .map((log) => ({
        id: log.performedBy,
        name: log.performedByName || log.performedBy
      }));
    const deduped = new Map();
    entries.forEach((u) => {
      if (!deduped.has(u.id)) {
        deduped.set(u.id, u);
      }
    });
    return ['all', ...Array.from(deduped.values())];
  }, [logs]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-gray-600 mt-1">Branch audit trail</p>
          </div>
        </div>
        {userBranch && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Branch: {userBranch}</span>
          </div>
        )}
      </div>

      {!userBranch && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            No branch is assigned to your account. Activity logs require a branch assignment.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user, action, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="sm:w-64">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action === 'all' ? 'All Actions' : getActionLabel(action)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="sm:w-64">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {uniqueUsers.map((user) =>
                user === 'all' ? (
                  <option key="all" value="all">All Staff</option>
                ) : (
                  <option key={user.id} value={user.id}>{user.name}</option>
                )
              )}
            </select>
          </div>
        </div>
        <div className="sm:w-44">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={limitCount}
              onChange={(e) => setLimitCount(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {[50, 100].map((lim) => (
                <option key={lim} value={lim}>{lim} newest</option>
              ))}
            </select>
          </div>
        </div>
        <div className="sm:w-44">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {[20, 25, 50, 100].map((lim) => (
                <option key={lim} value={lim}>{lim} per page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-2">No activity logs found</p>
            <p className="text-sm text-gray-400">
              {searchTerm || actionFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Activity logs will appear here as actions are performed in your branch'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {log.performedByName || 'Unknown User'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.details?.entityName && (
                        <div>
                          <span className="font-medium">{log.details.entityName}</span>
                          {log.details.module && (
                            <span className="text-gray-500 ml-2">({log.details.module})</span>
                          )}
                        </div>
                      )}
                      {log.targetUserName && (
                        <div className="text-xs text-gray-500 mt-1">
                          Target: {log.targetUserName}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredLogs.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 pb-4 text-sm text-gray-600">
            <span>
              Showing {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Prev
              </button>
              <span className="px-2">
                Page {currentPage} / {Math.max(1, Math.ceil(filteredLogs.length / pageSize))}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredLogs.length / pageSize), p + 1))}
                disabled={currentPage >= Math.ceil(filteredLogs.length / pageSize)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;

