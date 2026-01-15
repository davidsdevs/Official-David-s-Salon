# Receptionist Branch Closed Validation Update

## Summary
Enhanced the Receptionist's appointment booking form to include comprehensive branch closed validations with a blocking modal. Now checks both branch_close entries AND branch calendar (holidays, special closures) to prevent booking on closed dates.

## Changes Made

### 1. AppointmentFormModal Component (`src/components/appointment/AppointmentFormModal.jsx`)

#### New Imports
- `AlertTriangle` icon from lucide-react
- `getBranchCalendar` from branchCalendarService

#### New State Variables
- `branchCalendar` - Stores the branch calendar entries (holidays, special closures)

#### New useEffect Hook
Loads branch calendar when branch is selected:
```javascript
useEffect(() => {
  const loadBranchCalendar = async () => {
    if (formData.branchId) {
      const calendar = await getBranchCalendar(formData.branchId);
      setBranchCalendar(calendar || []);
    }
  };
  loadBranchCalendar();
}, [formData.branchId]);
```

#### New Validation Function
```javascript
isDateClosed(dateString)
```
- Checks if date has holiday or special_closure in branch calendar
- Returns `{ closed: boolean, reason: string }`
- Matches the same logic used in client reschedule modal

#### Enhanced Date Selection Logic
Now performs TWO checks when date is selected:
1. **Branch Close Check** - Checks `branch_close` collection for approved closures
2. **Calendar Check** - Checks branch calendar for holidays and special closures

If either check fails:
- Shows blocking modal with specific reason
- Date is NOT set in the form
- User must choose a different date

#### Updated Blocking Modal
Replaced the old Modal component with a new blocking modal:
- **High z-index (z-[60])** - Appears above the form modal
- **Darker backdrop** - 70% opacity black background
- **Animated entrance** - Uses bounce-in animation
- **Red gradient header** - With AlertTriangle icon
- **Clear messaging** - Shows specific closure reason
- **Single action button** - "OK, I'll Choose Another Date"

## Validation Types

### 1. Branch Close Entries
- Checks `calendar` collection for `type: 'branch_close'` with `status: 'approved'`
- Supports single date or date range (startDate/endDate)
- Example: "Branch closed for renovations"

### 2. Holidays
- Checks branch calendar for `type: 'holiday'`
- Example: "Christmas Day - Branch closed for holiday"

### 3. Special Closures
- Checks branch calendar for `type: 'special_closure'`
- Example: "Emergency closure due to weather"

## User Experience

### Before
- Only checked branch_close entries
- Used simple Modal component
- Could potentially miss holidays/special closures

### After
- **Comprehensive validation** - Checks both branch_close AND calendar
- **Immediate blocking** - Modal appears as soon as invalid date is selected
- **Date not set** - Invalid date is NOT set in the form
- **Animated modal** - Bounce-in animation draws attention
- **Clear reason** - Shows specific reason why date is closed
- **Forced acknowledgment** - User must click "OK" to dismiss

## Validation Flow

```
Receptionist selects date
    ↓
Check branch_close entries
    ↓ CLOSED → Show blocking modal → Date NOT set
    ↓ OPEN
Check branch calendar (holidays, special closures)
    ↓ CLOSED → Show blocking modal → Date NOT set
    ↓ OPEN
Date is valid → Set date → Load time slots
```

## Technical Details

### Modal Styling
- **Position**: Fixed, full screen overlay
- **Z-index**: 60 (above form modal which is z-50)
- **Backdrop**: Black with 70% opacity
- **Content**: White rounded card with red gradient header
- **Animation**: Custom bounce-in animation (defined in main.css)
- **Responsive**: Max width 28rem (448px), padding on mobile

### Button Styling
- Full width
- Red gradient (matches error theme)
- Hover effects with shadow
- Clear call-to-action text

## Consistency with Client Flow

This implementation matches the client reschedule modal:
- Same validation logic (`isDateClosed` function)
- Same modal design and styling
- Same user experience (blocking behavior)
- Same animation (bounce-in)

## Testing Checklist

- [ ] Try to select a date with branch_close entry → Modal appears
- [ ] Try to select a holiday date → Modal appears with holiday name
- [ ] Try to select a special closure date → Modal appears with closure reason
- [ ] Verify date field remains empty after blocking modal
- [ ] Verify can select valid date after dismissing modal
- [ ] Verify modal animation plays smoothly
- [ ] Verify modal appears above appointment form modal
- [ ] Verify "OK" button dismisses modal
- [ ] Test with different closure reasons
- [ ] Test on mobile devices for responsive layout
- [ ] Verify works for both new appointments and editing existing ones

## Files Modified
1. `src/components/appointment/AppointmentFormModal.jsx` - Added calendar validation and blocking modal

## Dependencies
- Uses existing `getBranchCalendar` from branchCalendarService
- Uses existing `isBranchClosedOnDate` from branchCloseUtils
- Uses existing bounce-in animation from main.css
- Uses existing Lucide React icons (AlertTriangle)

## Impact
- **Receptionists** - Cannot book appointments on closed dates
- **Branch Managers** - Calendar closures are now enforced in receptionist booking
- **Clients** - Consistent validation across client and receptionist booking flows
- **System** - Prevents invalid appointments from being created
