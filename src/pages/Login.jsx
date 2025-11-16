import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROUTES, USER_ROLES } from '../utils/constants';
import { getUserRoles } from '../utils/helpers';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import Button from '../components/ui/Button';
import Navigation from '../components/landing/Navigation';
import Footer from '../components/landing/Footer';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const { login, activeRole, userData } = useAuth();
  const navigate = useNavigate();

  // Handle navigation after successful login
  useEffect(() => {
    if (shouldNavigate && activeRole) {
      const dashboardMap = {
        [USER_ROLES.SYSTEM_ADMIN]: ROUTES.ADMIN_DASHBOARD,
        [USER_ROLES.OPERATIONAL_MANAGER]: ROUTES.OPERATIONAL_MANAGER_DASHBOARD,
        [USER_ROLES.BRANCH_MANAGER]: ROUTES.MANAGER_DASHBOARD,
        [USER_ROLES.RECEPTIONIST]: ROUTES.RECEPTIONIST_DASHBOARD,
        [USER_ROLES.INVENTORY_CONTROLLER]: ROUTES.INVENTORY_DASHBOARD,
        [USER_ROLES.STYLIST]: ROUTES.STYLIST_DASHBOARD,
        [USER_ROLES.CLIENT]: ROUTES.CLIENT_DASHBOARD,
      };

      navigate(dashboardMap[activeRole] || ROUTES.HOME);
      setShouldNavigate(false);
    }
  }, [shouldNavigate, activeRole, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password);
      
      // Get role from returned userData or wait for state update
      if (result?.userData) {
        const roles = getUserRoles(result.userData);
        // Get activeRole from localStorage or use first role
        const savedActiveRole = localStorage.getItem(`activeRole_${result.user.uid}`);
        const roleToUse = (savedActiveRole && roles.includes(savedActiveRole)) 
          ? savedActiveRole 
          : roles[0];
        
        const dashboardMap = {
          [USER_ROLES.SYSTEM_ADMIN]: ROUTES.ADMIN_DASHBOARD,
          [USER_ROLES.OPERATIONAL_MANAGER]: ROUTES.OPERATIONAL_MANAGER_DASHBOARD,
          [USER_ROLES.BRANCH_MANAGER]: ROUTES.MANAGER_DASHBOARD,
          [USER_ROLES.RECEPTIONIST]: ROUTES.RECEPTIONIST_DASHBOARD,
          [USER_ROLES.INVENTORY_CONTROLLER]: ROUTES.INVENTORY_DASHBOARD,
          [USER_ROLES.STYLIST]: ROUTES.STYLIST_DASHBOARD,
          [USER_ROLES.CLIENT]: ROUTES.CLIENT_DASHBOARD,
        };

        navigate(dashboardMap[roleToUse] || ROUTES.HOME);
      } else {
        // If userData not in result, wait for state update
        setShouldNavigate(true);
      }
    } catch (error) {
      // Error already handled by AuthContext, no need to log again
      // Just silently fail and let loading state reset
      setShouldNavigate(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-[122px]">
      {/* Header */}
      <Navigation />

      {/* Main Content */}
      <div className="flex items-center justify-center pt-8 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[#160B53]">
            Welcome Back
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to David's Salon Management System
          </p>
        </div>

          <Card className="p-8 border-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
            <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                  <Input
                  id="password"
                    name="password"
                  type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                    className="pr-12"
                />
                <button
                  type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center">
                <input
                    id="remember-me"
                    name="remember-me"
                  type="checkbox"
                    className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
                />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
              </label>
                </div>

                <div className="text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-medium text-[#160B53] hover:text-[#160B53]/80"
                >
                    Forgot your password?
                  </Link>
              </div>
            </div>

              <div>
                <Button
              type="submit"
                  className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white"
              disabled={loading}
            >
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
          </div>

              <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="font-medium text-[#160B53] hover:text-[#160B53]/80"
              >
                Register as Client
                  </Link>
            </p>
          </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Login;
