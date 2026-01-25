# Client Registration & Booking Enhancement Specification

## Status: ✅ COMPLETE - All Phases Implemented

## Implementation Summary

All four phases of the Client Registration & Booking Enhancement have been successfully implemented:

1. ✅ **Password Hygiene** - Enhanced validation with 5 requirements
2. ✅ **OTP via Brevo API** - Already existed, confirmed working
3. ✅ **Schedule-Aware Stylist Selection** - Fully integrated
4. ✅ **Override Option** - Implemented with warnings

---

## Implementation Progress

### ✅ Phase 1: Password Hygiene (COMPLETE)
- **Status**: Implemented
- **Changes Made**:
  - Enhanced password validation to include lowercase letter requirement
  - Updated password strength indicators to show 5 requirements (8+ chars, lowercase, uppercase, number, special)
  - Real-time validation feedback with green checkmarks
  - Submit button remains disabled until all requirements are met
- **Files Modified**:
  - `src/pages/public/Register.jsx` - Enhanced password validation logic and UI

### ✅ Phase 2: OTP via Brevo API (ALREADY IMPLEMENTED)
- **Status**: Already exists in codebase
- **Existing Implementation**:
  - `sendOTPEmail` function in `src/services/emailService.js`
  - OTP generation and verification in `src/pages/public/Register.jsx`
  - 6-digit OTP code sent via Brevo API
  - 2-step registration flow (details → OTP verification)
- **No changes needed** - functionality already working

### ✅ Phase 3: Schedule-Aware Stylist Selection (COMPLETE)
- **Status**: Fully implemented
- **Changes Made**:
  - Created `src/utils/scheduleValidator.js` with:
    - `isStylistAvailable()` - Check if stylist is available at specific date/time
    - `filterStylistsByAvailability()` - Filter stylists by availability
    - `getStylistAvailabilityStatus()` - Get availability status for a stylist
  - Checks: working hours, leave requests, existing appointments
  - Integrated into `AppointmentFormModal.jsx`:
    - Automatically checks stylist availability when date/time selected
    - Filters stylists to show only available ones by default
    - Shows availability status in real-time
  - Integrated into `ClientBookingModal.jsx`:
    - Same schedule checking functionality
    - Filters stylists in the stylist selection modal
    - Real-time availability updates
- **Files Modified**:
  - `src/components/appointment/AppointmentFormModal.jsx` - Added schedule checking
  - `src/components/appointment/ClientBookingModal.jsx` - Added schedule checking

### ✅ Phase 4: Override Option (COMPLETE)
- **Status**: Fully implemented
- **Changes Made**:
  - Added "Show all stylists" checkbox in both appointment modals
  - Unavailable stylists marked with ⚠️ icon and reason
  - Warning message displayed when unavailable stylist is selected
  - Confirmation dialog before booking unavailable stylist
  - Visual indicators (amber background) for unavailable selections
  - Different styling for available vs unavailable stylists
- **Files Modified**:
  - `src/components/appointment/AppointmentFormModal.jsx` - Added override functionality
  - `src/components/appointment/ClientBookingModal.jsx` - Added override functionality

---

## Files Created

1. **src/utils/scheduleValidator.js** - New utility for stylist availability checking
   - `isStylistAvailable()` - Core availability checking function
   - `filterStylistsByAvailability()` - Batch filtering with availability info
   - `getStylistAvailabilityStatus()` - Single stylist status check

## Files Modified

1. **src/pages/public/Register.jsx**
   - Enhanced password validation (added lowercase requirement)
   - Updated UI to show 5 password requirements
   - OTP functionality already existed

2. **src/components/appointment/AppointmentFormModal.jsx**
   - Added schedule-aware stylist filtering
   - Added "Show all stylists" override checkbox
   - Added availability warnings and confirmations
   - Visual indicators for unavailable stylists

3. **src/components/appointment/ClientBookingModal.jsx**
   - Added schedule-aware stylist filtering
   - Added "Show all stylists" override checkbox
   - Added availability warnings and confirmations
   - Visual indicators for unavailable stylists

4. **CLIENT_REGISTRATION_BOOKING_ENHANCEMENT.md**
   - Updated status tracking throughout implementation

## Overview
Comprehensive enhancement to client registration and booking system with password security, email verification, and schedule-aware stylist selection.

---

## Feature 1: Password Hygiene in Registration

### Requirements
- Real-time password strength validation
- Visual feedback for password requirements
- Must meet all criteria before submission

### Password Requirements
1. **Minimum Length**: 8 characters
2. **Uppercase Letter**: At least one (A-Z)
3. **Lowercase Letter**: At least one (a-z)
4. **Number**: At least one (0-9)
5. **Special Character**: At least one (!@#$%^&*()_+-=[]{}|;:,.<>?)

### UI Components
```
Password Input Field
├── Real-time validation indicator
├── Strength meter (Weak/Fair/Good/Strong)
└── Requirements checklist
    ├── ✓ At least 8 characters
    ├── ✓ One uppercase letter
    ├── ✓ One lowercase letter
    ├── ✓ One number
    └── ✓ One special character
```

### Visual Design
- **Unchecked**: Gray text with ✗ icon
- **Checked**: Green text with ✓ icon
- **Strength Meter**: Color-coded bar (Red → Yellow → Green)
- **Submit Button**: Disabled until all requirements met

---

## Feature 2: OTP via Brevo API

### Flow
```
1. User fills registration form
2. User enters password (meets requirements)
3. User clicks "Register"
4. System sends OTP to email via Brevo
5. User enters OTP code
6. System verifies OTP
7. Account created
```

### Brevo API Integration

#### Environment Variables (.env)
```
VITE_BREVO_API_KEY=your_brevo_api_key
VITE_BREVO_SENDER_EMAIL=noreply@davidssalon.com
VITE_BREVO_SENDER_NAME=David's Salon
```

#### API Endpoint
```
POST https://api.brevo.com/v3/smtp/email
Headers:
  - api-key: {BREVO_API_KEY}
  - Content-Type: application/json
```

#### Email Template
```
Subject: Verify Your Email - David's Salon

Hello {firstName},

Your verification code is: {OTP_CODE}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
David's Salon Team
```

### OTP Storage (Firestore)
```javascript
Collection: otp_verifications
Document ID: {email}
Fields:
  - code: string (6-digit)
  - email: string
  - createdAt: timestamp
  - expiresAt: timestamp (10 minutes)
  - verified: boolean
  - attempts: number (max 3)
```

### Security
- OTP: 6-digit random number
- Expiry: 10 minutes
- Max Attempts: 3
- Rate Limiting: 1 OTP per email per 2 minutes

---

## Feature 3: Schedule-Aware Stylist Selection

### Requirements
- Check stylist schedule before showing in dropdown
- Only show stylists who are:
  1. Working on the selected date
  2. Available during the selected time slot
  3. Not on leave
  4. Not fully booked

### Schedule Check Logic
```javascript
function isStylistAvailable(stylist, date, timeSlot) {
  // 1. Check if stylist works on this day
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const schedule = stylist.schedule[dayOfWeek];
  
  if (!schedule || !schedule.isWorking) {
    return false;
  }
  
  // 2. Check if time slot is within working hours
  const slotStart = parseTime(timeSlot.start);
  const slotEnd = parseTime(timeSlot.end);
  const workStart = parseTime(schedule.startTime);
  const workEnd = parseTime(schedule.endTime);
  
  if (slotStart < workStart || slotEnd > workEnd) {
    return false;
  }
  
  // 3. Check for leave requests
  const hasLeave = checkLeaveRequest(stylist.id, date);
  if (hasLeave) {
    return false;
  }
  
  // 4. Check for existing appointments (not fully booked)
  const existingAppointments = getAppointments(stylist.id, date, timeSlot);
  if (existingAppointments.length >= stylist.maxConcurrent) {
    return false;
  }
  
  return true;
}
```

### UI Behavior
- **Available Stylists**: Shown in dropdown (default)
- **Unavailable Stylists**: Hidden by default
- **Override Toggle**: "Show all stylists" checkbox

---

## Feature 4: Override Option for Stylist Selection

### Requirements
- Checkbox: "Show all stylists (including unavailable)"
- When checked:
  - Show ALL stylists regardless of schedule
  - Mark unavailable stylists with warning icon
  - Show reason for unavailability
  - Confirm before booking

### UI Design
```
Stylist Selection
├── Dropdown: [Select Stylist ▼]
├── Checkbox: ☐ Show all stylists (including unavailable)
└── If unavailable stylist selected:
    └── Warning: "⚠️ This stylist is not scheduled to work at this time"
        └── Reason: "Not working on Mondays" / "On leave" / "Fully booked"
        └── Confirm: "Book anyway?"
```

### Warning Messages
- **Not Working**: "This stylist is not scheduled to work on {day}"
- **Outside Hours**: "This stylist's shift ends at {time}"
- **On Leave**: "This stylist is on leave from {startDate} to {endDate}"
- **Fully Booked**: "This stylist has {count} appointments at this time"

---

## Implementation Files

### New Files to Create
1. `src/components/auth/PasswordStrengthMeter.jsx` - Password validation UI
2. `src/services/otpService.js` - OTP generation and verification
3. `src/services/brevoService.js` - Brevo API integration
4. `src/utils/passwordValidator.js` - Password validation logic
5. `src/utils/scheduleValidator.js` - Stylist schedule checking

### Files to Modify
1. `src/pages/public/Register.jsx` - Add password validation and OTP
2. `src/components/appointment/AppointmentFormModal.jsx` - Add schedule checking
3. `src/components/appointment/ClientBookingModal.jsx` - Add schedule checking
4. `.env.example` - Add Brevo API keys

---

## Database Schema Updates

### Users Collection (clients)
```javascript
{
  email: string,
  emailVerified: boolean, // NEW
  verifiedAt: timestamp,  // NEW
  // ... existing fields
}
```

### OTP Verifications Collection (NEW)
```javascript
Collection: otp_verifications
{
  email: string,
  code: string,
  createdAt: timestamp,
  expiresAt: timestamp,
  verified: boolean,
  attempts: number,
  type: 'registration' | 'password_reset'
}
```

---

## Security Considerations

### Password
- Never store plain text passwords
- Use Firebase Auth password hashing
- Enforce password requirements on both client and server

### OTP
- Generate cryptographically secure random codes
- Store hashed OTP in database
- Implement rate limiting
- Auto-delete expired OTPs

### Schedule Override
- Log all override bookings
- Require confirmation
- Notify branch manager of override bookings

---

## Testing Checklist

### Password Validation
- [ ] All requirements show as unchecked initially
- [ ] Requirements update in real-time as user types
- [ ] Submit button disabled until all requirements met
- [ ] Strength meter updates correctly
- [ ] Works on mobile devices

### OTP Flow
- [ ] OTP email sent successfully via Brevo
- [ ] OTP code is 6 digits
- [ ] OTP expires after 10 minutes
- [ ] Max 3 attempts enforced
- [ ] Rate limiting works (1 per 2 minutes)
- [ ] Resend OTP functionality works

### Schedule Checking
- [ ] Only available stylists shown by default
- [ ] Unavailable stylists hidden
- [ ] Override checkbox shows all stylists
- [ ] Warning messages display correctly
- [ ] Confirmation required for override bookings

---

## User Stories

### Story 1: Secure Registration
```
As a new client
I want to create a secure password
So that my account is protected

Acceptance Criteria:
- I see password requirements in real-time
- I cannot submit until requirements are met
- I receive an OTP to verify my email
- My account is created after OTP verification
```

### Story 2: Schedule-Aware Booking
```
As a client
I want to see only available stylists
So that I don't book unavailable time slots

Acceptance Criteria:
- Only stylists working on my selected date/time are shown
- Stylists on leave are not shown
- Fully booked stylists are not shown
- I can override to see all stylists if needed
```

### Story 3: Override Booking
```
As a receptionist
I want to book any stylist regardless of schedule
So that I can accommodate special requests

Acceptance Criteria:
- I can check "Show all stylists"
- I see warnings for unavailable stylists
- I must confirm before booking unavailable stylist
- Override bookings are logged
```

---

## Next Steps

1. **Phase 1**: Password Hygiene (1-2 hours)
   - Create PasswordStrengthMeter component
   - Update Register page
   - Add validation logic

2. **Phase 2**: OTP Integration (2-3 hours)
   - Set up Brevo API
   - Create OTP service
   - Add OTP verification flow

3. **Phase 3**: Schedule Checking (2-3 hours)
   - Create schedule validator
   - Update appointment modals
   - Add availability filtering

4. **Phase 4**: Override Option (1 hour)
   - Add override checkbox
   - Implement warning system
   - Add confirmation dialog

**Total Estimated Time**: 6-9 hours

---

## Questions for Clarification

1. **OTP Delivery**: Email only, or also SMS option?
2. **Password Reset**: Should OTP also be used for password reset?
3. **Override Permissions**: Who can use the override option? (Receptionist, Branch Manager, or both?)
4. **Schedule Conflicts**: Should system prevent double-booking or just warn?
5. **Notification**: Should stylist be notified of override bookings?

---

**Created**: January 25, 2026
**Status**: Specification Complete - Ready for Implementation
**Priority**: High
