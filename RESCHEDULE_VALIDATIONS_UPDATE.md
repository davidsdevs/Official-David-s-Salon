# Reschedule Validations Update

## Summary
Added comprehensive booking validations to the Client Reschedule Modal to prevent double-booking and ensure appointments can only be rescheduled to valid dates.

## Changes Made

### 1. RescheduleModal Component (`src/components/appointment/RescheduleModal.jsx`)

#### New Props
- `existingAppointments` - Array of client's existing appointments to check for conflicts

#### New State Variables
- `existingAppointmentError` - Stores error message when client tries to reschedule to a date with existing appointment

#### New Validation Function
```javascript
checkExistingAppointment(dateString)
```
- Checks if client already has an appointment on the selected date
- Excludes the current appointment being rescheduled
- Filters out cancelled and completed appointments
- Returns true if conflict exists

#### Enhanced Submit Validation
The `handleSubmit` function now performs two checks:
1. **Closed Date Check** - Validates branch is not closed (holidays, special closures)
2. **Existing Appointment Check** - Validates client doesn't have another appointment on the same date

#### UI Enhancements
- Added error message display for existing appointment conflicts
- Shows AlertTriangle icon with clear error message
- Explains "one appointment per day" rule
- Error clears when user selects a different date

### 2. Client Appointments Page (`src/pages/client/Appointments.jsx`)

#### Updated RescheduleModal Usage
Added `existingAppointments` prop to pass all client appointments to the modal:
```jsx
<RescheduleModal
  isOpen={showRescheduleModal}
  onClose={...}
  appointment={appointmentToReschedule}
  onSubmit={handleSubmitReschedule}
  loading={rescheduling}
  existingAppointments={appointments}  // NEW
/>
```

## Validation Rules

### Existing Validations (Already Present)
1. ✅ Branch operating hours validation
2. ✅ Closed days validation (branch not operating on that weekday)
3. ✅ Holiday validation (branch calendar holidays)
4. ✅ Special closure validation (branch calendar special closures)
5. ✅ 2-hour advance booking requirement
6. ✅ Minimum date validation (today or tomorrow based on closing time)

### New Validations (Added)
7. ✅ **Existing appointment validation** - Prevents rescheduling to a date where client already has an appointment
   - Checks all pending, confirmed, and in-progress appointments
   - Excludes the current appointment being rescheduled
   - Excludes cancelled and completed appointments
   - Shows clear error message with icon

## User Experience

### Before
- Client could reschedule to a date where they already have an appointment
- Would create double-booking situation
- No warning or prevention

### After
- Client sees immediate error when selecting a date with existing appointment
- Clear message: "You already have an appointment on this date. Please choose a different date."
- Explanation: "You can only have one appointment per day."
- Submit button remains disabled until valid date is selected
- Error clears automatically when different date is selected

## Testing Checklist

- [ ] Try to reschedule to a date with existing pending appointment
- [ ] Try to reschedule to a date with existing confirmed appointment
- [ ] Verify can reschedule to a date with cancelled appointment (should allow)
- [ ] Verify can reschedule to a date with completed appointment (should allow)
- [ ] Verify can reschedule to same date as current appointment (should allow - same appointment)
- [ ] Verify closed date validation still works
- [ ] Verify holiday validation still works
- [ ] Verify special closure validation still works
- [ ] Verify operating hours validation still works
- [ ] Verify 2-hour advance booking still works

## Files Modified
1. `src/components/appointment/RescheduleModal.jsx`
2. `src/pages/client/Appointments.jsx`

## Dependencies
- Uses existing `APPOINTMENT_STATUS` constants from `src/utils/constants.js`
- Uses existing appointment data structure
- No new dependencies added
