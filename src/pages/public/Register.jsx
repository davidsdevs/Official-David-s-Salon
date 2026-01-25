/**
 * Client Registration Page
 * Public page for client self-registration
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { logActivity } from '../../services/activityService';
import { sendWelcomeEmail, sendOTPEmail } from '../../services/emailService';
import { processReferral, validateReferralCode } from '../../services/referralService';
import { USER_ROLES } from '../../utils/constants';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Navigation from '../../components/landing/Navigation';
import Footer from '../../components/landing/Footer';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get referral code from URL params (if shared via referral link)
  const urlReferralCode = searchParams.get('ref');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
    otpCode: ''
  });

  const [currentStep, setCurrentStep] = useState(1); // 1: Info, 2: OTP
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    number: false,
    special: false,
    uppercase: false,
    lowercase: false
  });

  const checkPasswordStrength = (password) => {
    setPasswordStrength({
      length: password.length >= 8,
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password)
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'password') {
      checkPasswordStrength(value);
    }

    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const missingRequirements = [];
    if (!passwordStrength.length) missingRequirements.push('8+ characters');
    if (!passwordStrength.lowercase) missingRequirements.push('a lowercase letter');
    if (!passwordStrength.uppercase) missingRequirements.push('an uppercase letter');
    if (!passwordStrength.number) missingRequirements.push('a number');
    if (!passwordStrength.special) missingRequirements.push('a special character');

    if (missingRequirements.length > 0) {
      setError(`Password must have: ${missingRequirements.join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');


    try {
      // Validate referral code BEFORE sending OTP
      const referralCodeToProcess = formData.referralCode || urlReferralCode;
      if (referralCodeToProcess) {
        const validationResult = await validateReferralCode(referralCodeToProcess);
        if (!validationResult.valid) {
          setError(validationResult.message || 'Invalid referral code');
          setLoading(false);
          return;
        }
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const result = await sendOTPEmail({
        email: formData.email,
        otpCode: code
      });

      if (result.success) {
        setGeneratedOtp(code);
        setOtpSent(true);
        setCurrentStep(2);
        setSuccess('A verification code has been sent to your email.');
      } else {
        setError(result.error || 'Failed to send verification email');
      }
    } catch (err) {
      setError('Error processing registration');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (formData.otpCode !== generatedOtp) {
      setError('Invalid verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      // Build full name for Firebase Auth
      const fullName = `${formData.firstName}${formData.middleName ? ' ' + formData.middleName.charAt(0) + '.' : ''} ${formData.lastName}`.trim();

      // Update display name in Firebase Auth
      await updateProfile(user, {
        displayName: fullName
      });

      // Send email verification
      await sendEmailVerification(user);

      // Create Firestore user document
      await setDoc(doc(db, 'users', user.uid), {
        email: formData.email,
        firstName: formData.firstName,
        middleName: formData.middleName || '',
        lastName: formData.lastName,
        phone: formData.phone,
        roles: [USER_ROLES.CLIENT], // Use roles array instead of single role
        branchId: null,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Set up role password for CLIENT role (required for login)
      try {
        const { initializeRolePasswords } = await import('../../services/rolePasswordService');
        await initializeRolePasswords(user.uid, [USER_ROLES.CLIENT], formData.password);
      } catch (passwordError) {
        console.error('Error setting up role password:', passwordError);
        // Don't fail registration if password setup fails, but log it
        // The login flow will handle setting it up automatically if needed
      }

      // Process referral code if provided (branch ID is automatically determined from referral code)
      const referralCodeToProcess = formData.referralCode || urlReferralCode;

      if (referralCodeToProcess) {
        try {
          // processReferral will automatically find the branch ID from the referral code
          const referralResult = await processReferral(
            user.uid,
            referralCodeToProcess,
            null, // branchId will be determined from referral code
            { uid: user.uid, displayName: fullName }
          );

          if (referralResult.success) {
            console.log('✅ Referral processed successfully:', referralResult);
          } else {
            console.warn('⚠️ Referral processing failed:', referralResult.message);
            // Don't fail registration if referral fails
          }
        } catch (referralError) {
          console.error('Error processing referral:', referralError);
          // Don't fail registration if referral fails
        }
      }

      // Send custom welcome email (async, don't wait)
      sendWelcomeEmail({
        email: formData.email,
        displayName: fullName,
        role: 'Client'
      }).catch(err => console.error('Welcome email error:', err));

      setSuccess('Account created successfully! Please check your email to verify your account.');

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (error) {
      console.error('Registration error:', error);

      if (error.code === 'auth/email-already-in-use') {
        setError('Email address is already registered');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Header */}
      <Navigation />

      {/* Main Content */}
      <div className="flex items-center justify-center pt-8 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center">
            <h2 className="mt-10 text-center text-4xl font-extrabold text-[#160B53]">
              Create Your Account
            </h2>
            <p className="mt-1 text-center text-sm text-gray-600">
              Join David's Salon Management System
            </p>
          </div>

          <Card className="p-6 border-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-center gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">{success}</p>
              </div>
            )}

            {currentStep === 1 ? (
              <form className="space-y-4" onSubmit={handleSendOtp}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <Input id="firstName" name="firstName" type="text" required placeholder="First name" value={formData.firstName} onChange={handleChange} />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <Input id="lastName" name="lastName" type="text" required placeholder="Last name" value={formData.lastName} onChange={handleChange} />
                  </div>
                </div>

                <div>
                  <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">Middle Name <span className="text-gray-400 text-xs">(Optional)</span></label>
                  <Input id="middleName" name="middleName" type="text" placeholder="Middle name" value={formData.middleName} onChange={handleChange} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                    <Input id="email" name="email" type="email" required placeholder="Enter your email" value={formData.email} onChange={handleChange} />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <Input id="phone" name="phone" type="tel" placeholder="Enter your phone number" value={formData.phone} onChange={handleChange} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <div className="relative">
                      <Input id="password" name="password" type={showPassword ? 'text' : 'password'} required placeholder="Enter password" value={formData.password} onChange={handleChange} className="pr-12" />
                      <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                      </button>
                    </div>
                    {/* Password Strength Indicators */}
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Password Requirements:</p>
                      <div className="grid grid-cols-5 gap-2 text-[9px] whitespace-nowrap">
                        <div className={`flex items-center gap-1 ${passwordStrength.length ? 'text-green-600' : 'text-gray-400'}`}>
                          <CheckCircle className={`w-3 h-3 ${passwordStrength.length ? 'fill-green-50' : ''}`} /> 8+ chars
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                          <CheckCircle className={`w-3 h-3 ${passwordStrength.lowercase ? 'fill-green-50' : ''}`} /> Lowercase
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                          <CheckCircle className={`w-3 h-3 ${passwordStrength.uppercase ? 'fill-green-50' : ''}`} /> Uppercase
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.number ? 'text-green-600' : 'text-gray-400'}`}>
                          <CheckCircle className={`w-3 h-3 ${passwordStrength.number ? 'fill-green-50' : ''}`} /> Number
                        </div>
                        <div className={`flex items-center gap-1 ${passwordStrength.special ? 'text-green-600' : 'text-gray-400'}`}>
                          <CheckCircle className={`w-3 h-3 ${passwordStrength.special ? 'fill-green-50' : ''}`} /> Special
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                    <div className="relative">
                      <Input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} required placeholder="Confirm password" value={formData.confirmPassword} onChange={handleChange} className="pr-12" />
                      <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-1">Referral Code <span className="text-gray-400 text-xs">(Optional)</span></label>
                  <Input id="referralCode" name="referralCode" type="text" placeholder="Enter referral code" value={formData.referralCode || urlReferralCode || ''} onChange={handleChange} className="uppercase" />
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white h-10 text-base font-semibold" disabled={loading}>
                    {loading ? 'Sending verification...' : 'Create Account'}
                  </Button>
                </div>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handleVerifyOtp}>
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Verify Your Email</h3>
                  <p className="text-gray-600">We've sent a 6-digit code to <span className="font-semibold text-gray-900">{formData.email}</span></p>
                </div>

                <div>
                  <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700 mb-2 text-center">Enter Verification Code</label>
                  <Input id="otpCode" name="otpCode" type="text" required placeholder="000000" maxLength={6} className="text-center text-2xl tracking-[1em] font-bold h-16" value={formData.otpCode} onChange={handleChange} />
                </div>

                <div className="space-y-3">
                  <Button type="submit" className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white h-12 text-base font-semibold" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify & Create Account'}
                  </Button>
                  <button type="button" className="w-full text-sm text-[#160B53] font-medium hover:underline" onClick={() => setCurrentStep(1)}>
                    Back to edit details
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-[#160B53] hover:text-[#160B53]/80">Sign in</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div >
  );
};

export default Register;
