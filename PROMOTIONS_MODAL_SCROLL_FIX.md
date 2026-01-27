# Promotions Modal Scroll Fix

## Issue
The promotions modal content was not fully visible. Content below "Target Offerings" section was cut off and inaccessible, even when zooming out. Users couldn't scroll to see or access the rest of the form.

## Root Cause
The Modal component (`src/components/ui/Modal.jsx`) didn't have:
1. Maximum height constraint
2. Scrollable content area
3. Proper flex layout to handle overflow

The modal would grow indefinitely, pushing content off-screen with no way to scroll.

## Solution

### Updated Modal Component (`src/components/ui/Modal.jsx`)

**Changes Made:**
1. Added `max-h-[90vh]` to limit modal height to 90% of viewport
2. Added `flex flex-col` to enable flexbox layout
3. Added `flex-shrink-0` to header to prevent it from shrinking
4. Added `overflow-y-auto flex-1` to content area to make it scrollable
5. Removed `overflow-hidden` from modal container

**Before:**
```jsx
<div className={`relative w-full ${sizeClasses[size]} transform overflow-hidden rounded-lg bg-white shadow-xl transition-all`}>
  {/* Header */}
  <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
    {/* ... */}
  </div>
  
  {/* Content */}
  <div className="px-6 py-4">
    {children}
  </div>
</div>
```

**After:**
```jsx
<div className={`relative w-full ${sizeClasses[size]} transform rounded-lg bg-white shadow-xl transition-all max-h-[90vh] flex flex-col`}>
  {/* Header */}
  <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
    {/* ... */}
  </div>
  
  {/* Content - Scrollable */}
  <div className="px-6 py-4 overflow-y-auto flex-1">
    {children}
  </div>
</div>
```

## Benefits

1. **Scrollable Content**: Long forms now scroll within the modal
2. **Fixed Header**: Modal title and close button stay visible while scrolling
3. **Responsive**: Works on all screen sizes
4. **Consistent**: All modals using this component now have proper scrolling
5. **Accessible**: Users can now access all form fields regardless of content length

## Impact

This fix affects ALL modals in the application that use the `Modal` component, including:
- Promotions (System Admin, Operational Manager, Branch Manager)
- User management modals
- Service modals
- Product modals
- Any other modal using the shared Modal component

## Testing Checklist

- [x] Open promotions modal
- [x] Verify all content is accessible
- [x] Test scrolling works smoothly
- [x] Verify header stays fixed while scrolling
- [x] Test on different screen sizes
- [x] Test with long forms
- [x] Verify close button always accessible
- [x] Test other modals still work correctly

## Files Modified

1. `src/components/ui/Modal.jsx` - Added scrolling and height constraints

## Date
January 27, 2026
