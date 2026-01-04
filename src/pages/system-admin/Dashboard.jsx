import { Users, Building2, Activity, Database, AlertTriangle, Server, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllUsers } from '../../services/userService';
import { getAllBranches } from '../../services/branchService';
import { getAllActivities, getActionLabel } from '../../services/activityService';
import { formatDateTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import toast from 'react-hot-toast';

const SystemAdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalBranches: 0,
    activeBranches: 0,
    totalActivityLogs: 0,
    databaseStats: {}
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [databaseCollections, setDatabaseCollections] = useState({});

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'System Admin - Dashboard | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load users
      const users = await getAllUsers();
      const activeUsers = users.filter(u => u.isActive !== false);

      // Load branches
      const branches = await getAllBranches();
      const activeBranches = branches.filter(b => b.isActive !== false);

      // Load recent activities (last 24 hours critical activities)
      const activities = await getAllActivities(50);
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      const recentCriticalActivities = activities.filter(activity => {
        const activityDate = activity.timestamp?.toDate?.() || new Date(activity.timestamp);
        return activityDate >= oneDayAgo;
      }).slice(0, 10);

      // Load database collection counts (actual collections in Firestore)
      const collections = [
        'appointments',
        'branch_products',
        'branches',
        'categories',
        'invoices',
        'loyalty',
        'master_products',
        'purchase_orders',
        'purchase_orders_details',
        'referrals',
        'salon_use_inventory',
        'salon_use_products',
        'schedules',
        'services',
        'staff_services',
        'stock_transfer',
        'stock_transfer_audit',
        'stocks',
        'suppliers',
        'activity_logs',
        'users'
      ];

      const collectionCounts = {};
      for (const collectionName of collections) {
        try {
          // Use count aggregation query - only gets count, doesn't download documents
          const countQuery = collection(db, collectionName);
          const countSnapshot = await getCountFromServer(countQuery);
          collectionCounts[collectionName] = countSnapshot.data().count;
        } catch (error) {
          console.error(`Error counting ${collectionName}:`, error);
          collectionCounts[collectionName] = 0;
        }
      }

      setStats({
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        totalBranches: branches.length,
        activeBranches: activeBranches.length,
        totalActivityLogs: collectionCounts.activity_logs || 0,
        databaseStats: collectionCounts
      });

      setRecentActivities(recentCriticalActivities);
      setDatabaseCollections(collectionCounts);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getCriticalActionTypes = (action) => {
    const criticalActions = [
      'user_created',
      'user_deactivated',
      'user_activated',
      'role_changed',
      'password_reset',
      'branch_created',
      'branch_deactivated'
    ];
    return criticalActions.includes(action);
  };

  const formatCollectionName = (name) => {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const mainStats = [
    { 
      label: 'Total Users', 
      value: stats.totalUsers, 
      icon: Users, 
      color: 'bg-blue-500',
      subtitle: `${stats.activeUsers} active`
    },
    { 
      label: 'Active Branches', 
      value: stats.activeBranches, 
      icon: Building2, 
      color: 'bg-green-500',
      subtitle: `${stats.totalBranches} total`
    },
    { 
      label: 'Activity Logs', 
      value: stats.totalActivityLogs.toLocaleString(), 
      icon: Activity, 
      color: 'bg-purple-500',
      subtitle: 'Total tracked'
    },
    { 
      label: 'Database Collections', 
      value: Object.keys(databaseCollections).length, 
      icon: Database, 
      color: 'bg-orange-500',
      subtitle: 'Collections monitored'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Admin Dashboard</h1>
        <p className="text-gray-600">System overview and monitoring</p>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainStats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                )}
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Critical Activities */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Critical Activities</h2>
            </div>
            <Link
              to="/admin/activity-logs"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View All
            </Link>
          </div>
          
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No recent critical activities</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentActivities.map((activity) => {
                const activityDate = activity.timestamp?.toDate?.() || new Date(activity.timestamp);
                const isRecent = (Date.now() - activityDate.getTime()) < 3600000; // Less than 1 hour ago
                
                return (
                  <div
                    key={activity.id}
                    className={`p-3 rounded-lg border ${
                      isRecent ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {getActionLabel(activity.action)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {activity.performedByName || 'System'}
                          {activity.targetUserName && ` → ${activity.targetUserName}`}
                        </p>
                        {activity.details && Object.keys(activity.details).length > 0 && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {JSON.stringify(activity.details).substring(0, 60)}...
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDateTime(activityDate)}
                        </p>
                        {isRecent && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                            Recent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Database Statistics */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Database Statistics</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Real-time</span>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(databaseCollections)
              .sort((a, b) => b[1] - a[1]) // Sort by count descending
              .map(([collectionName, count]) => (
                <div
                  key={collectionName}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">
                      {formatCollectionName(collectionName)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total Documents</span>
              <span className="text-lg font-bold text-gray-900">
                {Object.values(databaseCollections).reduce((sum, count) => sum + count, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to={ROUTES.ADMIN_USERS}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left"
          >
            <Users className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Manage Users</h3>
            <p className="text-sm text-gray-600">View and manage system users</p>
          </Link>
          <Link
            to={ROUTES.ADMIN_BRANCHES}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left"
          >
            <Building2 className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Manage Branches</h3>
            <p className="text-sm text-gray-600">View and manage branches</p>
          </Link>
          <Link
            to="/admin/activity-logs"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left"
          >
            <Activity className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">View Activity Logs</h3>
            <p className="text-sm text-gray-600">System audit trail</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SystemAdminDashboard;
