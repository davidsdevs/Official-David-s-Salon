# Same-Day Cancellation & Stylist Booking Features

## Overview
Three new features to improve appointment management and stylist flexibility.

---

## Feature 1: Same-Day Cancellation Limit

### Requirements
- Clients can cancel appointments on the same day they booked them
- Maximum 3 same-day cancellations allowed
- Track cancellations per client
- Reset counter appropriately

### Implementation Plan

#### 1. Add Tracking Field to Users Collection
```javascript
// In users document (client)
{
  sameDayCancellations: {
    count: 0,
    lastResetDate: Timestamp,
    history: [
      {
        appointmentId: string,
        bookedAt: Timestamp,
        cancelledAt: Timestamp,
        date: string // YYYY-MM-DD
      }
    ]
  }
}
```

#### 2. Update cancelAppointment Function
- Check if cancellation is same-day as booking
- Check if client has reached 3 same-day cancellations
- If limit reached, show error and prevent cancellation
- If allowed, increment counter and log in history

#### 3. Reset Logic
- Option A: Reset daily at midnight
- Option B: Reset weekly/monthly
- Option C: Rolling 30-day window

**Files to Modify:**
- `src/services/appointmentService.js` - Add validation logic
- `src/services/userService.js` - Add tracking functions
- `src/pages/client/Appointments.jsx` - Show warning if approaching limit

---

## Feature 2: Stylist Pending Appointments View

### Requirements
- Stylists can view all pending appointments
- Filter by client name
- See appointment details before confirming

### Implementation Plan

#### 1. Add Pending Tab to Stylist Appointments
```javascript
// In src/pages/stylist/Appointments.jsx
const tabs = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'today', label: 'Today', icon: Calendar },
  // ... existing tabs
];
```

#### 2. Add Client Filter
- Search/filter by client name
- Group by client
- Show client booking history

**Files to Modify:**
- `src/pages/stylist/Appointments.jsx` - Add pending tab and filters
- `src/services/appointmentService.js` - Add query for stylist pending appointments

---

## Feature 3: "Can Be Bothered" Checkbox

### Requirements
- Add checkbox to stylist profile: "Available anytime (can be booked outside schedule)"
- When enabled, stylist can be booked even when not on schedule
- Apply this logic to client booking flow

### Implementation Plan

#### 1. Add Field to Users Collection
```javascript
// In users document (stylist)
{
  canBeBothered: boolean, // or availableAnytime
  // ... other fields
}
```

#### 2. Update Stylist Profile Page
- Add checkbox in profile settings
- Save to Firestore when toggled

#### 3. Update Client Booking Logic
- In `getAvailableTimeSlots()` function
- Check if stylist has `canBeBothered: true`
- If true, skip schedule validation for that stylist
- Still check for conflicting appointments

#### 4. Update Schedule Validator
- Modify `isWithinStylistSchedule()` function
- Add parameter to bypass schedule check
- Return true if stylist has `canBeBothered: true`

**Files to Modify:**
- `src/pages/stylist/Profile.jsx` - Add checkbox UI
- `src/services/userService.js` - Add update function
- `src/services/appointmentService.js` - Update availability logic
- `src/utils/scheduleValidator.js` - Add bypass logic
- `src/components/appointment/ClientBookingModal.jsx` - Apply logic

---

## Priority Order
1. **Feature 3** (Can Be Bothered) - Most impactful for booking flexibility
2. **Feature 2** (Pending View) - Improves stylist workflow
3. **Feature 1** (Same-Day Limit) - Prevents abuse but less urgent

---

## Notes
- All features require Firestore schema updates
- Consider adding admin settings to configure limits
- Add activity logging for all changes
- Test edge cases (timezone, concurrent bookings, etc.)

---

## Estimated Complexity
- Feature 1: Medium (tracking logic, reset mechanism)
- Feature 2: Low (mostly UI changes)
- Feature 3: Medium (schedule validation changes)

Total: ~4-6 hours of development + testing
