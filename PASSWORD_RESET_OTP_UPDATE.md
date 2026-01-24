# Password Reset OTP Update

## Overview
Updated the password reset system to use **Brevo-based OTP** instead of Firebase token-based reset. The entire flow is now handled in a single page with a two-step process.

## Changes Made

### 1. Updated ForgotPassword Page (`src/pages/public/ForgotPassword.jsx`)

#### Previous Flow (Token-based)
1. User enters email
2. System sends reset link via email
3. User clicks link → redirects to separate ResetPassword page
4. User enters new password

#### New Flow (OTP-based)
1. **Step 1**: User enters email → System sends 6-digit OTP via Brevo
2. **Step 2**: User enters OTP + new password on same page → Password reset complete

#### Key Features
- **Two-step form** on single page (no separate reset page needed)
- **6-digit OTP** sent via Brevo email
- **OTP expiry**: 10 minutes
- **Resend OTP** functionality
- **Real-time password validation**:
  - Minimum 8 characters
  - At least one number
  - At least one special character
- **Password confirmation** with match validation
- **Attempt limiting**: Max 5 OTP verification attempts
- **Auto-redirect** to login after successful reset

### 2. Password Reset Service (`src/services/passwordResetService.js`)

The service was already using Brevo OTP! No changes needed. It includes:

#### Functions
- `sendPasswordResetOTP(email)` - Sends OTP via Brevo
- `verifyPasswordResetOTP(email, otp, newPassword)` - Verifies OTP and resets password
- `cleanupExpiredOTPs()` - Removes expired OTPs from database

#### Security Features
- OTP stored in Firestore collection: `password_reset_otps`
- OTP expires in 10 minutes
- Maximum 5 verification attempts
- OTP marked as used after successful reset
- OTP automatically deleted after use or expiry
- Password validation (length, number, special character)
- Activity logging for audit trail

### 3. Removed Files
- **Deleted**: `src/pages/public/ResetPassword.jsx` (no longer needed)
- The old token-based reset page is obsolete with the new OTP flow

## Technical Details

### OTP Email Template
The Brevo email includes:
- Professional HTML design with David's Salon branding
- Large, centered OTP display (6 digits with letter spacing)
- Clear expiry information (10 minutes)
- Security warnings (don't share OTP)
- Plain text fallback for email clients without HTML support

### Firestore Structure

#### Collection: `password_reset_otps`
```javascript
{
  userId: "user_uid",
  email: "user@example.com",
  otp: "123456",
  createdAt: Timestamp,
  expiresAt: Timestamp,
  used: false,
  attempts: 0
}
```

### Password Requirements
- **Minimum length**: 8 characters
- **Must contain**: At least one number (0-9)
- **Must contain**: At least one special character (!@#$%^&*(),.?":{}|<>)
- **Visual feedback**: Real-time validation with checkmarks/x-marks

### Error Handling
- Invalid email → "No account found with this email address"
- Deactivated account → "Account is deactivated. Please contact administrator."
- Invalid OTP → "Invalid OTP. X attempts remaining."
- Too many attempts → "Too many failed attempts. Please request a new OTP."
- Expired OTP → "OTP has expired. Please request a new one."
- Weak password → Specific validation error messages

## User Experience Flow

### Step 1: Request OTP
1. User navigates to `/forgot-password`
2. Enters email address
3. Clicks "Send OTP"
4. Receives email with 6-digit OTP (within seconds)

### Step 2: Reset Password
1. User enters 6-digit OTP from email
2. Enters new password (with real-time validation)
3. Confirms new password
4. Clicks "Reset Password"
5. Success! Auto-redirects to login page

### Additional Features
- **Change email**: User can go back to step 1 if wrong email
- **Resend OTP**: User can request new OTP if not received
- **Back to login**: Link available at all times
- **Help link**: Contact support email provided

## Environment Variables Required

```env
VITE_BREVO_API_KEY=your_brevo_api_key
VITE_SENDER_EMAIL=chicorlcruz@gmail.com
VITE_SENDER_NAME=David's Salon
```

## Testing Checklist

### Functional Testing
- [ ] Send OTP to valid email
- [ ] Verify OTP email received in inbox
- [ ] Enter correct OTP and reset password
- [ ] Enter incorrect OTP (check attempt counter)
- [ ] Exceed 5 attempts (OTP should be deleted)
- [ ] Wait for OTP to expire (10 minutes)
- [ ] Resend OTP functionality
- [ ] Password validation (length, number, special char)
- [ ] Password confirmation matching
- [ ] Successful password reset and login

### Edge Cases
- [ ] Invalid email address
- [ ] Deactivated user account
- [ ] OTP already used
- [ ] Expired OTP
- [ ] Network errors during OTP send
- [ ] Network errors during verification
- [ ] Multiple OTP requests for same email
- [ ] Special characters in password

### Security Testing
- [ ] OTP cannot be reused
- [ ] OTP expires after 10 minutes
- [ ] OTP deleted after 5 failed attempts
- [ ] Password meets all requirements
- [ ] Activity logging works correctly
- [ ] Email sent only to registered users

## Benefits of OTP Approach

### Security
- **Time-limited**: OTP expires in 10 minutes
- **Single-use**: OTP marked as used after successful reset
- **Attempt limiting**: Max 5 attempts prevents brute force
- **No persistent tokens**: OTP deleted after use

### User Experience
- **Faster**: No need to click email link and wait for page load
- **Single page**: Everything happens on one page
- **Clear feedback**: Real-time validation and error messages
- **Mobile-friendly**: Easy to copy OTP from email to form

### Maintenance
- **Simpler**: No token generation/verification logic
- **Cleaner**: No separate reset page needed
- **Reliable**: Brevo email delivery is more reliable than Firebase
- **Auditable**: Activity logging for all password resets

## Migration Notes

### For Existing Users
- No migration needed - this is a new flow
- Old password reset links (if any) will no longer work
- Users should use the new "Forgot Password" link

### For Developers
- Remove any references to old `ResetPassword` component
- Update documentation to reflect OTP flow
- Test Brevo API key configuration
- Monitor OTP email delivery rates

## Related Files
- `src/pages/public/ForgotPassword.jsx` - Main password reset page (OTP flow)
- `src/services/passwordResetService.js` - Backend service for OTP
- `src/routes/AppRoutes.jsx` - Routing configuration
- `OTP_TESTING_GUIDE.md` - Testing guide for OTP functionality

## Support

If users have issues with password reset:
1. Check spam/junk folder for OTP email
2. Verify email address is correct
3. Try resending OTP
4. Contact support: support@davidsalon.com

## Future Enhancements

Potential improvements:
- [ ] SMS OTP as alternative to email
- [ ] Configurable OTP expiry time
- [ ] Rate limiting for OTP requests
- [ ] OTP delivery status tracking
- [ ] Multi-language support for OTP emails
- [ ] Remember device to skip OTP (trusted devices)
