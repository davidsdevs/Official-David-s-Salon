# Reschedule Bug Debug Guide

## Issue
User reports: "theres a bug in receptionist rescheduling. I cant reschedule."

## Analysis
The reschedule functionality appears to be properly implemented in the code. Here's what to check:

## Debugging Steps

### 1. Check Appointment Status
The reschedule button is only enabled for appointments that are NOT:
- In Service (`in_service`)
- Completed (`completed`) 
- Already Paid (`paymentStatus: true` or `paid: true`)

**Action**: Check if the appointment you're trying to reschedule has any of these blocking statuses.

### 2. Check Browser Console
Open browser Developer Tools (F12) and check the Console tab for any JavaScript errors when:
- Clicking the reschedule button
- Opening the reschedule modal
- Selecting a new date/time
- Submitting the reschedule

**Common errors to look for**:
- Network errors when loading time slots
- Validation errors
- Firebase/Firestore errors

### 3. Check Reschedule Button Visibility
In the appointments table, look for the "Reschedule" button. It should be visible for eligible appointments.

**If button is missing**: Check if the appointment status allows rescheduling
**If button is disabled**: Check for `processingStatus` or `saving` states

### 4. Check Modal Opening
When clicking "Reschedule":
- Modal should open with appointment data pre-filled
- Date field should be editable (not disabled)
- Time slots should load when date is selected

### 5. Check Time Slot Loading
When selecting a new date:
- Loading spinner should appear
- Available time slots should populate
- If no slots appear, check console for API errors

### 6. Check Form Submission
When clicking "Update":
- Should show "Saving..." state
- Should close modal on success
- Should refresh appointments list
- Should show success message

## Code Locations

### Reschedule Button
File: `src/pages/receptionist/Appointments.jsx`
Line: ~2072-2078
```jsx
<button
  onClick={() => handleRescheduleAppointment(apt)}
  disabled={processingStatus === apt.id || saving}
  className="..."
>
  Reschedule
</button>
```

### Reschedule Handler
File: `src/pages/receptionist/Appointments.jsx`
Line: ~796-807
```jsx
const handleRescheduleAppointment = (appointment) => {
  // Validation logic
  setSelectedAppointment(appointment);
  setIsRescheduling(true);
  setShowModal(true);
};
```

### Modal Props
File: `src/pages/receptionist/Appointments.jsx`
Line: ~2191
```jsx
isEditing={!!selectedAppointment && !isRescheduling}
```

## Quick Test
1. Go to Receptionist > Appointments
2. Find a PENDING or CONFIRMED appointment
3. Click the "Reschedule" button
4. Change the date to tomorrow
5. Select an available time slot
6. Click "Update"

## Expected Behavior
- Modal opens with appointment data
- Date can be changed
- Time slots load for new date
- Update saves successfully
- Modal closes and list refreshes

## If Still Not Working
1. Check specific appointment ID and status
2. Check browser network tab for failed requests
3. Check Firebase console for any backend errors
4. Verify user permissions for updating appointments

## Temporary Workaround
If reschedule is completely broken, user can:
1. Cancel the existing appointment
2. Create a new appointment with the desired date/time