# OTP Password Reset Testing Guide

## What Was Fixed

### Issue
The OTP email was being sent successfully (status 201) but users weren't receiving the OTP code because:
1. The sender email was set to `noreply@davidsalon.com` (unverified in Brevo)
2. Brevo only allows sending from verified sender addresses
3. Insufficient logging made it hard to debug

### Solution
1. **Changed sender email** to use the verified email from `.env` (`chicorlcruz@gmail.com`)
2. **Added comprehensive logging** throughout the OTP email sending process
3. **Added text content** to the email (both HTML and plain text versions)
4. **Enhanced error handling** with detailed error messages

## How to Test

### Step 1: Start the Development Server
```bash
npm run dev
```

### Step 2: Open Browser Console
- Open Developer Tools (F12)
- Go to the Console tab
- Keep it open to see all the logs

### Step 3: Test the OTP Flow

1. **Navigate to Forgot Password**
   - Go to `http://localhost:3000/forgot-password`
   - Or click "Forgot Password?" from the login page

2. **Enter Email**
   - Enter a valid client email (e.g., `overhealing123@gmail.com`)
   - Click "Send OTP"

3. **Check Console Logs**
   You should see detailed logs like:
   ```
   🔐 [Password Reset] Starting OTP send process...
   🔐 [Password Reset] Email: overhealing123@gmail.com
   🔐 [Password Reset] Normalized email: overhealing123@gmail.com
   🔐 [Password Reset] Searching for user in Firestore...
   🔐 [Password Reset] User search result: 1 users found
   ✅ [Password Reset] User found: {...}
   🔑 [Password Reset] Generated OTP: 123456
   ⏰ [Password Reset] OTP expires at: ...
   💾 [Password Reset] Storing OTP in Firestore...
   ✅ [Password Reset] OTP stored in Firestore
   📧 [Password Reset] Sending OTP email via Brevo...
   📧 [OTP Email] Starting to send OTP email...
   📧 [OTP Email] Recipient: overhealing123@gmail.com
   📧 [OTP Email] Display Name: ...
   📧 [OTP Email] OTP Code: 123456
   📧 [OTP Email] Sender Email: chicorlcruz@gmail.com
   📧 [OTP Email] Sender Name: David's Salon
   📧 [OTP Email] API Key configured: xkeysib-a60305...
   📧 [OTP Email] Request body prepared: {...}
   📧 [OTP Email] Sending request to Brevo API...
   📧 [OTP Email] Response status: 201
   📧 [OTP Email] Response status text: Created
   ✅ [OTP Email] SUCCESS! Response data: {...}
   ✅ [OTP Email] Message ID: <...>
   📧 [Password Reset] Email send result: {success: true, messageId: "..."}
   ✅ [Password Reset] OTP email sent successfully!
   ✅ [Password Reset] Activity logged
   🎉 [Password Reset] OTP send process completed successfully!
   ```

4. **Check Email Inbox**
   - Check the email inbox for `overhealing123@gmail.com`
   - Look for an email from "David's Salon <chicorlcruz@gmail.com>"
   - Subject: "Your Password Reset OTP - David's Salon"
   - The email should contain a 6-digit OTP code in a large box

5. **Enter OTP and New Password**
   - Copy the 6-digit OTP from the email
   - Paste it into the OTP field
   - Enter a new password (must meet requirements):
     - At least 8 characters
     - Contains at least one number
     - Contains at least one special character
   - Confirm the password
   - Click "Reset Password"

6. **Verify Success**
   - You should see "Password reset successfully!"
   - You'll be redirected to the login page after 2 seconds
   - Try logging in with the new password

## Console Logs to Look For

### Success Indicators
- ✅ `[Password Reset] User found`
- 🔑 `[Password Reset] Generated OTP: XXXXXX` (note this number!)
- ✅ `[OTP Email] SUCCESS!`
- ✅ `[Password Reset] OTP email sent successfully!`

### Error Indicators
- ❌ `[Password Reset] No user found with email`
- ❌ `[Password Reset] User account is deactivated`
- ❌ `[OTP Email] Brevo API key not configured`
- ❌ `[OTP Email] Brevo API error`
- ❌ `[Password Reset] Failed to send email`

## Troubleshooting

### If OTP Email is Not Received

1. **Check Spam/Junk Folder**
   - Brevo emails might be filtered as spam initially

2. **Verify Sender Email in Brevo**
   - Login to [app.brevo.com](https://app.brevo.com)
   - Go to Senders & IP
   - Ensure `chicorlcruz@gmail.com` is verified

3. **Check Console Logs**
   - Look for the OTP code in the console logs
   - You can manually use this OTP for testing

4. **Check Brevo Dashboard**
   - Login to [app.brevo.com](https://app.brevo.com)
   - Go to Statistics → Email
   - Check if the email was sent and delivered

5. **Verify API Key**
   - Check `.env` file has `VITE_BREVO_API_KEY`
   - Verify the API key is active in Brevo dashboard

### If OTP Verification Fails

1. **Check OTP Expiry**
   - OTP expires in 10 minutes
   - Request a new OTP if expired

2. **Check Failed Attempts**
   - After 5 failed attempts, OTP is deleted
   - Request a new OTP

3. **Check Password Requirements**
   - At least 8 characters
   - Contains at least one number
   - Contains at least one special character

## Key Changes Made

### `src/services/passwordResetService.js`
- Changed sender email from `noreply@davidsalon.com` to verified email from `.env`
- Added comprehensive console logging throughout the process
- Added text content to email (both HTML and plain text)
- Enhanced error handling with detailed error messages
- Added request body logging for debugging

### Email Template
- Professional HTML design with David's Salon branding
- Large, centered OTP code box for easy reading
- Clear instructions and security warnings
- Responsive design for mobile devices
- Plain text fallback for email clients that don't support HTML

## Next Steps

1. Test the complete flow with a real email address
2. Check the email inbox and spam folder
3. Verify the OTP code matches what's in the console logs
4. Test password reset with the OTP
5. Verify you can login with the new password

## Notes

- OTP is stored in Firestore collection `password_reset_otps`
- OTP expires in 10 minutes
- Maximum 5 failed verification attempts
- OTP is deleted after successful use
- All actions are logged in the activity log
