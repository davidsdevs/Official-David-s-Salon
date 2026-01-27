import { useState, useEffect } from 'react';
import { Users, Building2, Activity, TrendingUp, Calendar, DollarSign, Package, UserCheck } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';

const OperationalManagerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeBranches: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    todayAppointments: 0,
    activeStaff: 0,
    totalProducts: 0,
    recentActivities: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [topBranches, setTopBranches] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching dashboard data...');

      // Fetch all data in parallel
      const [
        usersSnapshot,
        branchesSnapshot,
        appointmentsSnapshot,
        transactionsSnapshot,
        productsSnapshot,
        activitiesSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'branches')),
        getDocs(collection(db, 'appointments')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(10)))
      ]);

      console.log('📊 Data fetched:', {
        users: usersSnapshot.size,
        branches: branchesSnapshot.size,
        appointments: appointmentsSnapshot.size,
        transactions: transactionsSnapshot.size,
        products: productsSnapshot.size,
        activities: activitiesSnapshot.size
      });

      // Calculate total users
      const totalUsers = usersSnapshot.size;

      // Calculate active branches (check for status === 'active' OR no status field)
      const activeBranches = branchesSnapshot.docs.filter(doc => {
        const status = doc.data().status;
        // Consider active if status is 'active' or if status field doesn't exist
        return !status || status === 'active';
      }).length;

      console.log('🏢 Active branches:', activeBranches, 'out of', branchesSnapshot.size);

      // Calculate total appointments
      const totalAppointments = appointmentsSnapshot.size;

      // Calculate today's appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAppointments = appointmentsSnapshot.docs.filter(doc => {
        const data = doc.data();
        let appointmentDate = data.appointmentDate;
        
        // Handle different date formats
        if (!appointmentDate) return false;
        
        // If it's a Firestore Timestamp
        if (appointmentDate.toDate && typeof appointmentDate.toDate === 'function') {
          appointmentDate = appointmentDate.toDate();
        } 
        // If it's a string, parse it
        else if (typeof appointmentDate === 'string') {
          appointmentDate = new Date(appointmentDate);
        }
        // If it's already a Date object
        else if (appointmentDate instanceof Date) {
          // Use as is
        } else {
          return false;
        }
        
        return appointmentDate >= today;
      }).length;

      console.log('📅 Today\'s appointments:', todayAppointments);

      // Calculate total revenue from transactions
      const totalRevenue = transactionsSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.total || 0);
      }, 0);

      console.log('💰 Total revenue:', totalRevenue);

      // Calculate active staff (users with role stylist, receptionist, branch_manager)
      const activeStaff = usersSnapshot.docs.filter(doc => {
        const roles = doc.data().roles || [];
        return roles.some(role => 
          ['stylist', 'receptionist', 'branch_manager'].includes(role)
        );
      }).length;

      console.log('👥 Active staff:', activeStaff);

      // Total products
      const totalProducts = productsSnapshot.size;

      // Recent activities
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));

      // Calculate branch performance (top 5 by revenue)
      const branchRevenue = {};
      transactionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const branchId = data.branchId;
        const branchName = data.branchName || 'Unknown';
        if (branchId) {
          if (!branchRevenue[branchId]) {
            branchRevenue[branchId] = {
              branchId,
              branchName,
              revenue: 0,
              transactions: 0
            };
          }
          branchRevenue[branchId].revenue += data.total || 0;
          branchRevenue[branchId].transactions += 1;
        }
      });

      const topBranchesData = Object.values(branchRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      console.log('🏆 Top branches:', topBranchesData);

      setStats({
        totalUsers,
        activeBranches,
        totalAppointments,
        totalRevenue,
        todayAppointments,
        activeStaff,
        totalProducts,
        recentActivities: activities.length
      });

      setRecentActivities(activities);
      setTopBranches(topBranchesData);

      console.log('✅ Dashboard data loaded successfully');

    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      console.error('Error details:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: 'Total Users', 
      value: stats.totalUsers.toLocaleString(), 
      icon: Users, 
      color: 'bg-blue-500',
      onClick: () => navigate('/operational-manager/users')
    },
    { 
      label: 'Active Branches', 
      value: stats.activeBranches.toLocaleString(), 
      icon: Building2, 
      color: 'bg-green-500',
      onClick: () => navigate('/operational-manager/branches')
    },
    { 
      label: 'Today\'s Appointments', 
      value: stats.todayAppointments.toLocaleString(), 
      icon: Calendar, 
      color: 'bg-purple-500',
      onClick: () => navigate('/operational-manager/calendar')
    },
    { 
      label: 'Total Revenue', 
      value: `₱${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: DollarSign, 
      color: 'bg-orange-500',
      onClick: () => navigate('/operational-manager/branches')
    },
    { 
      label: 'Active Staff', 
      value: stats.activeStaff.toLocaleString(), 
      icon: UserCheck, 
      color: 'bg-indigo-500',
      onClick: () => navigate('/operational-manager/users')
    },
    { 
      label: 'Total Products', 
      value: stats.totalProducts.toLocaleString(), 
      icon: Package, 
      color: 'bg-pink-500',
      onClick: () => navigate('/operational-manager/inventory')
    },
    { 
      label: 'Total Appointments', 
      value: stats.totalAppointments.toLocaleString(), 
      icon: TrendingUp, 
      color: 'bg-teal-500',
      onClick: () => navigate('/operational-manager/calendar')
    },
    { 
      label: 'Recent Activities', 
      value: stats.recentActivities.toLocaleString(), 
      icon: Activity, 
      color: 'bg-cyan-500',
      onClick: () => navigate('/operational-manager/activity-logs')
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const hasNoData = stats.totalUsers === 0 && stats.activeBranches === 0 && stats.totalAppointments === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Operational Manager Dashboard</h1>
        <p className="text-gray-600">Monitor and oversee system-wide operations.</p>
      </div>

      {/* No Data Warning */}
      {hasNoData && (
        <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Data Available</h3>
              <p className="text-yellow-800 mb-3">
                The dashboard is showing zeros because there's no data in the database yet. This is normal for a new system.
              </p>
              <div className="bg-white rounded-lg p-4 border border-yellow-200">
                <p className="font-medium text-gray-900 mb-2">To populate the dashboard, you need to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  <li>Add branches through the Branches page</li>
                  <li>Create user accounts (stylists, receptionists, etc.)</li>
                  <li>Add products to inventory</li>
                  <li>Create appointments</li>
                  <li>Process transactions</li>
                </ul>
                <p className="mt-3 text-sm text-gray-600">
                  💡 <strong>Tip:</strong> Check the browser console (F12) for detailed data fetching logs.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {statCards.map((stat, index) => (
          <div 
            key={index} 
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={stat.onClick}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Performing Branches */}
      {topBranches.length > 0 && (
        <Card className="mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Branches</h2>
            <div className="space-y-3">
              {topBranches.map((branch, index) => (
                <div key={branch.branchId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{branch.branchName}</p>
                      <p className="text-sm text-gray-500">{branch.transactions} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      ₱{branch.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Recent Activities */}
      {recentActivities.length > 0 && (
        <Card className="mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h2>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.action || 'Activity'}</p>
                    <p className="text-xs text-gray-500">
                      {activity.performedByName || 'Unknown'} • {activity.timestamp?.toLocaleString() || 'Unknown time'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/operational-manager/users')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
          >
            <Users className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900">View Users</h3>
            <p className="text-sm text-gray-600">Manage system users</p>
          </button>
          <button 
            onClick={() => navigate('/operational-manager/branches')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
          >
            <Building2 className="w-6 h-6 text-green-600 mb-2" />
            <h3 className="font-medium text-gray-900">View Branches</h3>
            <p className="text-sm text-gray-600">Monitor all branches</p>
          </button>
          <button 
            onClick={() => navigate('/operational-manager/activity-logs')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
          >
            <Activity className="w-6 h-6 text-purple-600 mb-2" />
            <h3 className="font-medium text-gray-900">Activity Logs</h3>
            <p className="text-sm text-gray-600">System audit trail</p>
          </button>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> As an Operational Manager, you have read-only access to monitor 
          system-wide operations, users, and branches for oversight purposes.
        </p>
      </div>
    </div>
  );
};

export default OperationalManagerDashboard;
