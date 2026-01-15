# Branch Close Date Range Validation Update

## Summary
Updated the branch close validation to properly handle date ranges (startDate/endDate) so that clients and receptionists cannot book or reschedule appointments during multi-day branch closures.

## Problem
Previously, the `isBranchClosedOnDate` function had logic to handle date ranges, but it was not working correctly. When a branch close entry had a date range (e.g., Feb 5-8, 2026), the validation would not properly block all dates in that range.

## Solution
Completely rewrote the `isBranchClosedOnDate` function to properly handle three scenarios:
1. **Date ranges** (startDate/endDate) - Most common for multi-day closures
2. **Single dates** (date field) - Legacy support
3. **Start date only** (startDate without endDate) - Fallback

## Changes Made

### 1. branchCloseUtils.js (`src/services/branchCloseUtils.js`)

#### Updated Logic
```javascript
// Handle date ranges (startDate/endDate)
if (entry.startDate && entry.endDate) {
  let start = entry.startDate?.toDate ? entry.startDate.toDate() : new Date(entry.startDate);
  let end = entry.endDate?.toDate ? entry.endDate.toDate() : new Date(entry.endDate);
  
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  if (dateObj >= start && dateObj <= end) {
    return { closed: true, entry };
  }
}
```

#### Key Improvements
- Properly converts Firestore timestamps to Date objects
- Sets hours to 0 for accurate date comparison
- Checks if selected date falls within the range (inclusive)
- Returns the entry object for displaying closure reason

### 2. RescheduleModal (`src/components/appointment/RescheduleModal.jsx`)

#### Added Import
```javascript
import { isBranchClosedOnDate } from '../../services/branchCloseUtils';
```

#### Enhanced Date Selection
Now performs THREE checks when date is selected:
1. **Branch close check** - Checks `isBranchClosedOnDate` for date ranges
2. **Calendar check** - Checks branch calendar for holidays/special closures
3. **Existing appointment check** - Checks if client has another appointment

#### Updated onChange Handler
Changed from synchronous to async to support the `isBranchClosedOnDate` promise:
```javascript
onChange={async (e) => {
  const selectedDate = e.target.value;
  
  // Check branch_close entries (date ranges)
  const branchCloseCheck = await isBranchClosedOnDate(appointment.branchId, selectedDate);
  if (branchCloseCheck.closed) {
    // Show blocking modal
    return;
  }
  
  // ... other checks
}}
```

## Validation Flow

### Client Booking (ClientBookingModal)
```
User selects date
    ↓
Check branch_close (date ranges) ✓
    ↓ CLOSED → Show alert → Date NOT set
    ↓ OPEN
Check existing appointment
    ↓ EXISTS → Show alert → Date NOT set
    ↓ NONE
Date is valid → Set date → Load time slots
```

### Client Reschedule (RescheduleModal)
```
User selects date
    ↓
Check branch_close (date ranges) ✓ NEW
    ↓ CLOSED → Show blocking modal → Date NOT set
    ↓ OPEN
Check branch calendar (holidays, special closures)
    ↓ CLOSED → Show blocking modal → Date NOT set
    ↓ OPEN
Check existing appointment
    ↓ EXISTS → Show blocking modal → Date NOT set
    ↓ NONE
Date is valid → Set date → Show time slots
```

### Receptionist Booking (AppointmentFormModal)
```
User selects date
    ↓
Check existing appointment (if editing)
    ↓ EXISTS → Alert → Date NOT set
    ↓ NONE
Check branch_close (date ranges) ✓
    ↓ CLOSED → Show blocking modal → Date NOT set
    ↓ OPEN
Check branch calendar (holidays, special closures)
    ↓ CLOSED → Show blocking modal → Date NOT set
    ↓ OPEN
Date is valid → Set date → Load time slots
```

## Example Scenario

### Branch Close Entry
```javascript
{
  branchId: "2jcrfvY7pxnMdsc1qbC4",
  type: "branch_close",
  status: "approved",
  title: "Closed Due to Infestations",
  description: "hehe",
  startDate: February 5, 2026,
  endDate: February 8, 2026,
  allDay: true
}
```

### Validation Results
- **Feb 4, 2026** → ✅ Allowed (before closure)
- **Feb 5, 2026** → ❌ Blocked (first day of closure)
- **Feb 6, 2026** → ❌ Blocked (within closure)
- **Feb 7, 2026** → ❌ Blocked (within closure)
- **Feb 8, 2026** → ❌ Blocked (last day of closure)
- **Feb 9, 2026** → ✅ Allowed (after closure)

## User Experience

### Before
- Could book/reschedule on dates within a closure range
- Only the exact start date might be blocked
- Inconsistent validation across different booking flows

### After
- **Cannot book** on any date within a closure range
- **Cannot reschedule** to any date within a closure range
- **Blocking modal** appears immediately when invalid date is selected
- **Clear message** shows the closure title/reason
- **Consistent validation** across all booking flows

## Testing Checklist

- [ ] Client booking: Try to book on Feb 5-8, 2026 → Should be blocked
- [ ] Client booking: Try to book on Feb 4 or Feb 9 → Should be allowed
- [ ] Client reschedule: Try to reschedule to Feb 5-8 → Should show blocking modal
- [ ] Client reschedule: Try to reschedule to Feb 4 or Feb 9 → Should be allowed
- [ ] Receptionist booking: Try to book on Feb 5-8 → Should show blocking modal
- [ ] Receptionist booking: Try to book on Feb 4 or Feb 9 → Should be allowed
- [ ] Verify closure message shows the title ("Closed Due to Infestations")
- [ ] Verify date field remains empty after blocking modal
- [ ] Test with single-day closures (date field only)
- [ ] Test with different branches

## Files Modified
1. `src/services/branchCloseUtils.js` - Rewrote date range validation logic
2. `src/components/appointment/RescheduleModal.jsx` - Added branch_close check

## Files Already Using This
1. `src/components/appointment/ClientBookingModal.jsx` - Already had the check
2. `src/components/appointment/AppointmentFormModal.jsx` - Already had the check

## Dependencies
- No new dependencies added
- Uses existing Firestore queries
- Uses existing blocking modal UI
