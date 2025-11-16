import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Settings, MapPin, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS, ROUTES } from '../../utils/constants';
import { getInitials, getFullName } from '../../utils/helpers';
import { getBranchById } from '../../services/branchService';
import RoleSwitcher from './RoleSwitcher';

const Header = ({ toggleSidebar, sidebarOpen }) => {
  const { currentUser, activeRole, userData, logout, userBranch } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // Fetch branch name
  useEffect(() => {
    const fetchBranchName = async () => {
      if (userBranch) {
        try {
          const branch = await getBranchById(userBranch);
          setBranchName(branch.name || branch.branchName);
        } catch (error) {
          console.error('Error fetching branch:', error);
        }
      }
    };
    fetchBranchName();
  }, [userBranch]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getRoleBasedProfileRoute = () => {
    const roleRoutes = {
      systemAdmin: '/admin/profile',
      operationalManager: '/operational-manager/profile',
      branchManager: '/manager/profile',
      receptionist: '/receptionist/profile',
      inventoryController: '/login', // Inventory module removed
      stylist: '/stylist/profile',
      client: '/client/profile',
    };
    return roleRoutes[activeRole] || '/profile';
  };

  const getRoleBasedSettingsRoute = () => {
    const roleRoutes = {
      systemAdmin: '/admin/settings',
      operationalManager: '/operational-manager/settings',
      branchManager: '/manager/settings',
      receptionist: '/receptionist/settings',
      inventoryController: '/login', // Inventory module removed
      stylist: '/stylist/settings',
      client: '/client/settings',
    };
    return roleRoutes[activeRole] || '/settings';
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white shadow-sm">
              <img
                src="/logo.jpg"
                alt="David's Salon Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="hidden md:block">
              {branchName ? (
                <>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary-600" />
                    <h1 className="text-sm font-semibold text-gray-900">{branchName}</h1>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs text-gray-500">{formatDateTime(currentTime)}</p>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-sm font-semibold text-gray-900">David's Salon Management</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs text-gray-500">{formatDateTime(currentTime)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Role Switcher */}
          <RoleSwitcher />
          
          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-gray-900">
                    {getFullName(userData)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ROLE_LABELS[activeRole] || activeRole}
                  </p>
                </div>
                {userData?.photoURL ? (
                  <img 
                    src={userData.photoURL} 
                    alt={getFullName(userData)}
                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                    {getInitials(userData)}
                  </div>
                )}
              </div>
            </button>

            {/* Dropdown menu */}
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {getFullName(userData)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {userData?.email || currentUser?.email}
                    </p>
                  </div>
                  
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      setShowDropdown(false);
                      navigate(getRoleBasedProfileRoute());
                    }}
                  >
                    <User className="w-4 h-4" />
                    My Profile
                  </button>
                  
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => {
                      setShowDropdown(false);
                      navigate(getRoleBasedSettingsRoute());
                    }}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  
                  <div className="border-t border-gray-200 my-1" />
                  
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setShowDropdown(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
