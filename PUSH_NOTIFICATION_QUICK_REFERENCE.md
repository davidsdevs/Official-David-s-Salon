# Push Notification Quick Reference

## For Developers

### Sending Notifications

#### To Client
```javascript
import { getUserPushTokens, sendExpoPushNotification } from './services/expoPushService';

// Get client's push tokens
const tokens = await getUserPushTokens(clientId, 'client');

// Send notification
await sendExpoPushNotification(
  tokens,
  'Appointment Confirmed',
  'Your appointment has been confirmed',
  { type: 'appointment_confirmed', appointmentId: 'appt123' }
);
```

#### To Stylist
```javascript
import { getUserPushTokens, sendExpoPushNotification } from './services/expoPushService';

// Get stylist's push tokens
const tokens = await getUserPushTokens(stylistId, 'stylist');

// Send notification
await sendExpoPushNotification(
  tokens,
  'New Appointment',
  'You have a new appointment',
  { type: 'new_appointment', appointmentId: 'appt123' }
);
```

#### To Multiple Users
```javascript
import { getMultipleUserPushTokens, sendExpoPushNotification } from './services/expoPushService';

// Define users with roles
const userRoles = [
  { userId: 'client123', role: 'client' },
  { userId: 'stylist456', role: 'stylist' }
];

// Get all tokens
const tokens = await getMultipleUserPushTokens(userRoles);

// Send notification to all
await sendExpoPushNotification(
  tokens,
  'Appointment Update',
  'Your appointment has been updated',
  { type: 'appointment_updated', appointmentId: 'appt123' }
);
```

### Testing

#### Check User Tokens (Browser Console)
```javascript
// Check client tokens
window.checkPushToken('userId', 'client')

// Check stylist tokens
window.checkPushToken('userId', 'stylist')
```

#### Send Test Notification (Browser Console)
```javascript
// Test to specific user
window.testPushToUser('userId', 'client')
window.testPushToUser('userId', 'stylist')

// Test to specific token
window.testPushNotification('ExponentPushToken[xxx]')
```

### Database Structure

#### User Document
```javascript
{
  // Client tokens (for client role)
  clientPushTokens: [
    "ExponentPushToken[xxx]",
    "ExponentPushToken[yyy]"
  ],
  
  // Stylist tokens (for stylist role)
  stylistPushTokens: [
    "ExponentPushToken[zzz]"
  ]
}
```

### Notification Types

#### Client Notifications
- `appointment_created` - New appointment booked
- `appointment_confirmed` - Appointment confirmed
- `appointment_reminder` - Reminder before appointment
- `appointment_rescheduled` - Appointment date/time changed
- `appointment_cancelled` - Appointment cancelled
- `appointment_completed` - Service completed

#### Stylist Notifications
- `new_appointment` - New appointment assigned
- `client_arrived` - Client checked in
- `in_service` - Service started
- `appointment_cancelled` - Appointment cancelled
- `portfolio_approved` - Portfolio approved
- `portfolio_rejected` - Portfolio rejected

### Priority Levels
- `high` - Urgent (appointments, check-ins)
- `default` - Normal (confirmations, updates)
- `low` - Informational (promotions)

### Common Patterns

#### Appointment Created
```javascript
// Notify client
const clientTokens = await getUserPushTokens(appointment.clientId, 'client');
await sendExpoPushNotification(clientTokens, 'Appointment Booked', message, data);

// Notify stylist
const stylistTokens = await getUserPushTokens(appointment.stylistId, 'stylist');
await sendExpoPushNotification(stylistTokens, 'New Appointment', message, data);
```

#### Appointment Cancelled
```javascript
// Notify both client and stylist
const userRoles = [
  { userId: appointment.clientId, role: 'client' },
  { userId: appointment.stylistId, role: 'stylist' }
];
const tokens = await getMultipleUserPushTokens(userRoles);
await sendExpoPushNotification(tokens, 'Appointment Cancelled', message, data);
```

### Error Handling

```javascript
try {
  const tokens = await getUserPushTokens(userId, role);
  
  if (tokens.length === 0) {
    console.log('No push tokens found');
    return { success: false, message: 'No push tokens' };
  }
  
  const result = await sendExpoPushNotification(tokens, title, body, data);
  return result;
} catch (error) {
  console.error('Error sending notification:', error);
  return { success: false, error: error.message };
}
```

### Best Practices

1. **Always specify role** when getting tokens
2. **Handle empty token arrays** gracefully
3. **Log notification attempts** for debugging
4. **Don't fail operations** if notifications fail
5. **Use appropriate priority** for notification type
6. **Include relevant data** in notification payload

### Debugging

#### Check Console Logs
```
📱 Fetching push tokens for user: userId role: client
📱 Found 2 push token(s) for user userId role: client
📱 Sending push notifications to 2 device(s)
📱 Push success for token 0: ok
📱 Push success for token 1: ok
```

#### Common Issues
- **No tokens found**: User hasn't logged into mobile app
- **Invalid token format**: Token doesn't start with `ExponentPushToken[`
- **Wrong role**: Using 'client' instead of 'stylist' or vice versa
- **Expired token**: Token needs to be refreshed

---

**Quick Links**:
- Full Guide: `PUSH_NOTIFICATION_WEB_GUIDE.md`
- Update Details: `PUSH_NOTIFICATION_UPDATE_COMPLETE.md`
- Service File: `src/services/expoPushService.js`
