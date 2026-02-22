# Push Notification System Update - Complete

## Overview
Updated the push notification system to use role-based token management as specified in `PUSH_NOTIFICATION_WEB_GUIDE.md`. The system now properly sends notifications to both clients and stylists using their respective token arrays.

## Changes Made

### 1. Updated `src/services/expoPushService.js`

#### New Functions
- **`getUserPushTokens(userId, role)`**: Replaces the old `getUserPushToken()` function
  - Accepts `role` parameter ('client' or 'stylist')
  - Returns an array of push tokens from `clientPushTokens` or `stylistPushTokens`
  - Supports multiple devices per user
  - Filters and validates token format

- **`getMultipleUserPushTokens(userRoles)`**: Updated to accept role information
  - Now accepts array of `{userId, role}` objects
  - Fetches tokens for multiple users with their respective roles

#### Updated Notification Functions
All notification functions now use role-based tokens:

1. **`sendAppointmentConfirmedNotification()`**
   - Sends to client using `clientPushTokens`
   - Sends to stylist(s) using `stylistPushTokens`

2. **`sendAppointmentCancelledNotification()`**
   - Sends to client using `clientPushTokens`
   - Sends to stylist(s) using `stylistPushTokens`

3. **`sendAppointmentRescheduledNotification()`**
   - Sends to client using `clientPushTokens`
   - Sends to stylist(s) using `stylistPushTokens`

4. **`sendAppointmentReminderNotification()`**
   - Sends to client using `clientPushTokens`

5. **`sendNewAppointmentToStylistNotification()`**
   - Sends to stylist(s) using `stylistPushTokens`

6. **`sendClientArrivedNotification()`**
   - Sends to stylist(s) using `stylistPushTokens`

7. **`sendInServiceNotification()`**
   - Sends to stylist(s) using `stylistPushTokens`

8. **`sendCancellationNotification()`**
   - Sends to client using `clientPushTokens`
   - Conditionally sends to stylist(s) using `stylistPushTokens` (only if not pending)

9. **`sendPortfolioApprovedNotification()`**
   - Sends to stylist using `stylistPushTokens`

10. **`sendPortfolioRejectedNotification()`**
    - Sends to stylist using `stylistPushTokens`

#### Updated Test Functions
- **`testPushToUser(userId, role)`**: Now requires role parameter
- **`debugCheckPushToken(userId, role)`**: Now requires role parameter

## Database Structure

### User Document Structure
```javascript
{
  id: "user123",
  email: "user@example.com",
  role: "client", // or "stylist"
  
  // NEW: Role-specific token arrays (USE THESE!)
  clientPushTokens: [
    "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]"  // Multiple devices
  ],
  stylistPushTokens: [
    "ExponentPushToken[zzzzzzzzzzzzzzzzzzzzzz]"
  ],
  
  // DEPRECATED: Legacy fields (kept for backward compatibility)
  expoPushToken: null,
  pushToken: null,
  
  pushTokenUpdatedAt: Timestamp
}
```

## How It Works

### For Receptionist Creating Appointments

When a receptionist creates an appointment:

1. **Appointment Created** → `createAppointment()` in `appointmentService.js`
2. **Notification Stored** → `storeAppointmentCreated()` in `notificationService.js`
3. **Push Notifications Sent**:
   - **To Client**: Uses `clientPushTokens` array
   - **To Stylist(s)**: Uses `stylistPushTokens` array
4. **Multiple Devices**: All tokens in the array receive the notification

### Notification Flow

```
Receptionist Creates Appointment
         ↓
appointmentService.createAppointment()
         ↓
notificationService.storeAppointmentCreated()
         ↓
expoPushService.sendNewAppointmentToStylistNotification()
         ↓
getUserPushTokens(stylistId, 'stylist')
         ↓
Fetch stylistPushTokens from Firestore
         ↓
sendExpoPushNotification(tokens, title, body, data)
         ↓
Expo Push API sends to all devices
```

## Testing

### Test from Browser Console

```javascript
// Check if user has push tokens
window.checkPushToken('userId', 'client')
window.checkPushToken('userId', 'stylist')

// Send test notification to user
window.testPushToUser('userId', 'client')
window.testPushToUser('userId', 'stylist')

// Send test notification to specific token
window.testPushNotification('ExponentPushToken[xxx]')
```

### Test Appointment Creation

1. Log in as receptionist
2. Create a new appointment
3. Check console logs for push notification status
4. Verify client and stylist receive notifications on their mobile devices

## Benefits

1. **Multi-Device Support**: Users can receive notifications on multiple devices
2. **Role-Based Routing**: Correct notifications go to correct user roles
3. **Better Organization**: Clear separation between client and stylist tokens
4. **Scalability**: Easy to add more devices without changing code
5. **Backward Compatible**: Legacy `getUserPushToken()` still works

## Migration Notes

### For Mobile App
The mobile app should:
1. Register push tokens on app launch
2. Store tokens in the appropriate array:
   - Clients → `clientPushTokens`
   - Stylists → `stylistPushTokens`
3. Support multiple tokens per user (array format)

### For Web App
No changes needed for existing functionality. The system automatically:
- Fetches tokens from the correct array based on user role
- Sends notifications to all devices
- Handles missing or invalid tokens gracefully

## Troubleshooting

### No Notifications Received

1. **Check Token Storage**:
   ```javascript
   window.checkPushToken('userId', 'client')
   ```

2. **Verify Token Format**:
   - Must start with `ExponentPushToken[` or `ExpoPushToken[`
   - Must be in the correct role array

3. **Check Console Logs**:
   - Look for "📱 Push tokens retrieved: X"
   - Look for "📱 No push tokens found"

4. **Verify User Role**:
   - Client notifications use `clientPushTokens`
   - Stylist notifications use `stylistPushTokens`

### Common Issues

1. **Empty Token Array**: User hasn't logged into mobile app
2. **Wrong Role**: Token stored in wrong array (client vs stylist)
3. **Invalid Format**: Token doesn't start with correct prefix
4. **Expired Token**: Token may need to be refreshed

## Related Files

- `src/services/expoPushService.js` - Push notification service (UPDATED)
- `src/services/notificationService.js` - Notification storage service
- `src/services/appointmentService.js` - Appointment management
- `PUSH_NOTIFICATION_WEB_GUIDE.md` - Complete implementation guide

## Next Steps

1. ✅ Update push notification service to use role-based tokens
2. ✅ Update all notification functions
3. ✅ Add multi-device support
4. ✅ Update test functions
5. 🔄 Test with real appointments
6. 🔄 Verify mobile app receives notifications
7. 🔄 Monitor console logs for any issues

---

**Status**: ✅ Complete
**Date**: February 22, 2026
**Updated By**: Kiro AI Assistant
