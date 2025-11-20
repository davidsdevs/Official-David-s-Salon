import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROUTES, USER_ROLES } from '../utils/constants';
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
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Login with CLIENT role restriction
      await login(email, password, USER_ROLES.CLIENT);
      
      // Navigate to client dashboard
      navigate(ROUTES.CLIENT_DASHBOARD);
    } catch (error) {
      // Error is already handled by AuthContext, but we can set a local error state
      if (error.message === 'INVALID_ROLE') {
        setError('This login page is for clients only. Staff members should use their role-specific login page.');
      } else {
        setError(error.message || 'Invalid email or password');
      }
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
              Client Login
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Sign in to access your account
            </p>
          </div>

          <Card className="p-8 border-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

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

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-[#160B53] hover:text-[#160B53]/80"
                >
                  Register here
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
