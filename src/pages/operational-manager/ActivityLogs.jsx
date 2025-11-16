/**
 * Activity Logs Page - Operational Manager
 * View system-wide activity logs (read-only)
 */

import { useState, useEffect } from 'react';
import { Activity, Search, Filter, Calendar, User, FileText } from 'lucide-react';
import { getAllActivities, getActionLabel } from '../../services/activityService';
import { formatDateTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const ActivityLogs = () => {
  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [userCache, setUserCache] = useState({});

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [activities, searchTerm, actionFilter, dateFilter]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const logs = await getAllActivities(100); // Get last 100 activities
      
      // Fetch user names for logs that don't have them
      const cache = {};
      const logsWithNames = await Promise.all(
        logs.map(async (log) => {
          let performedByName = log.performedByName;
          let targetUserName = log.targetUserName;

          // Fetch performer name if not present
          if (!performedByName && log.performedBy) {
            if (!cache[log.performedBy]) {
              try {
                const userDoc = await getDoc(doc(db, 'users', log.performedBy));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  if (data.firstName && data.lastName) {
                    cache[log.performedBy] = `${data.firstName}${data.middleName ? ' ' + data.middleName.charAt(0) + '.' : ''} ${data.lastName}`.trim();
                  } else if (data.displayName) {
                    cache[log.performedBy] = data.displayName;
                  } else {
                    cache[log.performedBy] = data.email || 'Unknown User';
                  }
                } else {
                  cache[log.performedBy] = 'Unknown User';
                }
              } catch (err) {
                cache[log.performedBy] = 'Unknown User';
              }
            }
            performedByName = cache[log.performedBy];
          }

          // Fetch target user name if not present
          if (!targetUserName && log.targetUser) {
            if (!cache[log.targetUser]) {
              try {
                const userDoc = await getDoc(doc(db, 'users', log.targetUser));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  if (data.firstName && data.lastName) {
                    cache[log.targetUser] = `${data.firstName}${data.middleName ? ' ' + data.middleName.charAt(0) + '.' : ''} ${data.lastName}`.trim();
                  } else if (data.displayName) {
                    cache[log.targetUser] = data.displayName;
                  } else {
                    cache[log.targetUser] = data.email || 'Unknown User';
                  }
                } else {
                  cache[log.targetUser] = 'Unknown User';
                }
              } catch (err) {
                cache[log.targetUser] = 'Unknown User';
              }
            }
            targetUserName = cache[log.targetUser];
          }

          return {
            ...log,
            performedByName: performedByName || 'Unknown User',
            targetUserName: targetUserName
          };
        })
      );

      setUserCache(cache);
      setActivities(logsWithNames);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(activity =>
        activity.performedByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.targetUserName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getActionLabel(activity.action).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(activity => activity.action === actionFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter(activity => {
        const activityDate = activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
        return activityDate >= filterDate;
      });
    }

    setFilteredActivities(filtered);
  };

  const getActionColor = (action) => {
    const colors = {
      user_login: 'bg-green-100 text-green-800',
      user_logout: 'bg-gray-100 text-gray-800',
      user_created: 'bg-blue-100 text-blue-800',
      user_updated: 'bg-yellow-100 text-yellow-800',
      user_activated: 'bg-green-100 text-green-800',
      user_deactivated: 'bg-red-100 text-red-800',
      password_reset: 'bg-purple-100 text-purple-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action) => {
    if (action.includes('login') || action.includes('logout')) return User;
    if (action.includes('created') || action.includes('updated')) return FileText;
    return Activity;
  };

  const uniqueActions = [...new Set(activities.map(a => a.action))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600 mt-1">Monitor system-wide user activities</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {filteredActivities.length} Activities
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>
                  {getActionLabel(action)}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredActivities.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No activities found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredActivities.map((activity) => {
              const ActionIcon = getActionIcon(activity.action);
              return (
                <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <ActionIcon className="w-5 h-5 text-primary-600" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">
                              {activity.performedByName || 'Unknown User'}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(activity.action)}`}>
                              {getActionLabel(activity.action)}
                            </span>
                          </div>
                          
                          {activity.targetUserName && (
                            <p className="text-sm text-gray-600 mt-1">
                              Target: <span className="font-medium">{activity.targetUserName}</span>
                            </p>
                          )}

                          {activity.details && typeof activity.details === 'string' && (
                            <p className="text-sm text-gray-500 mt-1">
                              {activity.details}
                            </p>
                          )}
                        </div>

                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm text-gray-500">
                            {activity.timestamp ? formatDateTime(activity.timestamp) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Activity logs are automatically recorded for audit and compliance purposes. 
          These logs are read-only and cannot be modified or deleted.
        </p>
      </div>
    </div>
  );
};

export default ActivityLogs;
