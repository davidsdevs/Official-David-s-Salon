import { Users, Building2, Activity, TrendingUp } from 'lucide-react';

const OperationalManagerDashboard = () => {
  const stats = [
    { label: 'Total Users', value: '234', icon: Users, color: 'bg-blue-500' },
    { label: 'Active Branches', value: '12', icon: Building2, color: 'bg-green-500' },
    { label: 'System Activities', value: '1.2K', icon: Activity, color: 'bg-purple-500' },
    { label: 'Growth Rate', value: '+18%', icon: TrendingUp, color: 'bg-orange-500' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Operational Manager Dashboard</h1>
        <p className="text-gray-600">Monitor and oversee system-wide operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
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

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left">
            <Users className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">View Users</h3>
            <p className="text-sm text-gray-600">Manage system users</p>
          </button>
          <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left">
            <Building2 className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">View Branches</h3>
            <p className="text-sm text-gray-600">Monitor all branches</p>
          </button>
          <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left">
            <Activity className="w-6 h-6 text-primary-600 mb-2" />
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
