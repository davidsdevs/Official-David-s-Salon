    /**
 * Forgot Password Page
 * Public page for password reset using OTP
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { sendPasswordResetOTP, verifyPasswordResetOTP } from '../../services/passwordResetService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: email, 2: OTP + password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    number: false,
    special: false
  });

  const validatePassword = (pwd) => {
    const errors = {
      length: pwd.length >= 8,
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    setPasswordErrors(errors);
    return errors.length && errors.number && errors.special;
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (value) {
      validatePassword(value);
    } else {
      setPasswordErrors({ length: false, number: false, special: false });
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await sendPasswordResetOTP(email);
      
      if (result.success) {
        setStep(2);
        toast.success('OTP sent to your email! Check your inbox.');
      } else {
        toast.error(result.error || 'Failed to send OTP. Please try again.');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    // Validate password
    if (!validatePassword(password)) {
      toast.error('Please ensure your password meets all requirements');
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const result = await verifyPasswordResetOTP(email, otp, password);
      
      if (result.success) {
        toast.success('Password reset successfully!');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        toast.error(result.error || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const result = await sendPasswordResetOTP(email);
      if (result.success) {
        toast.success('New OTP sent to your email!');
      } else {
        toast.error(result.error || 'Failed to resend OTP');
      }
    } catch (error) {
      toast.error('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 px-4">
      <div className="max-w-md w-full">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Reset Password
          </h1>
          <p className="text-gray-600">
            {step === 1 
              ? "Enter your email address and we'll send you an OTP to reset your password"
              : "Enter the OTP sent to your email and your new password"
            }
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 1 ? (
            <form onSubmit={handleSendOTP} className="space-y-6">
              {/* Email field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" />}
                Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              {/* Email display */}
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">OTP sent to:</p>
                <p className="font-medium text-gray-900">{email}</p>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm text-primary-600 hover:underline mt-1"
                >
                  Change email
                </button>
              </div>

              {/* OTP field */}
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP
                </label>
                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                  placeholder="000000"
                  autoFocus
                />
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-sm text-primary-600 hover:underline disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                    className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Password Requirements */}
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className={`flex items-center gap-2 text-xs ${passwordErrors.length ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordErrors.length ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordErrors.number ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordErrors.number ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      Contains at least one number
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${passwordErrors.special ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordErrors.special ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      Contains at least one special character (!@#$%^&*...)
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !otp || otp.length !== 6 || !password || !confirmPassword || password !== confirmPassword || !passwordErrors.length || !passwordErrors.number || !passwordErrors.special}
                className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" />}
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>
        </div>

        {/* Additional help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <a href="mailto:support@davidsalon.com" className="text-primary-600 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
