# Push Notification System - Web Integration Guide

This document explains how the David Salon app implements push notifications and how to trigger them from a web application or external service.

## Table of Contents
- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Database Structure](#database-structure)
- [Sending Push Notifications](#sending-push-notifications)
- [Notification Types](#notification-types)
- [Code Examples](#code-examples)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## System Overview

The app uses **Expo Push Notifications** with a role-based token management system. Push notifications are sent directly via the Expo Push API without requiring Firebase Cloud Messaging (FCM) or Apple Push Notification service (APNs) configuration.

### Key Features
- Role-based notifications (client vs stylist)
- Multi-device support (users can receive notifications on multiple devices)
- Automatic token management
- Firestore notification history
- Direct Expo Push API integration

---

## Architecture

### Components

1. **Mobile App (React Native + Expo)**
   - Registers for push notifications on app launch
   - Stores Expo push tokens in Firestore
   - Listens for incoming notifications

2. **Firestore Database**
   - Stores user push tokens in `users` collection
   - Stores notification history in `notifications` collection

3. **Notification Service**
   - Creates notification documents in Firestore
   - Sends push notifications via Expo Push API
   - Handles role-based token routing

4. **Web/External Service (Your Integration)**
   - Reads user push tokens from Firestore
   - Sends HTTP requests to Expo Push API
   - Creates notification documents for history

---

## Database Structure

### Users Collection (`users/{userId}`)

Each user document contains role-specific push token arrays:

```javascript
{
  id: "user123",
  email: "user@example.com",
  role: "client", // or "stylist"
  
  // Role-specific token arrays (CRITICAL - use these!)
  clientPushTokens: [
    "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]"  // Multiple devices
  ],
  stylistPushTokens: [
    "ExponentPushToken[zzzzzzzzzzzzzzzzzzzzzz]"
  ],
  
  // Legacy fields (DO NOT USE - kept for backward compatibility)
  expoPushToken: null,
  pushToken: null,
  clientPushToken: null,
  stylistPushToken: null,
  
  pushTokenUpdatedAt: Timestamp
}
```

### Notifications Collection (`notifications/{notificationId}`)

```javascript
{
  recipientId: "user123",
  recipientRole: "client", // or "stylist"
  type: "appointment_created",
  title: "Appointment Booked",
  message: "Your appointment with John on Jan 15 at 10:00 AM has been booked",
  priority: "medium", // "high", "medium", or "low"
  data: {
    appointmentId: "appt123",
    appointmentDate: "2026-01-15",
    appointmentTime: "10:00 AM",
    branchName: "Main Branch",
    stylistName: "John Doe",
    services: ["Haircut", "Hair Color"]
  },
  isRead: false,
  sent: true,
  sentAt: Timestamp,
  createdAt: Timestamp,
  error: null,
  errorAt: null
}
```

---

## Sending Push Notifications

### Step 1: Retrieve User Push Tokens

Query Firestore to get the user's push tokens based on their role:

```javascript
// For Firebase Admin SDK (Node.js)
const admin = require('firebase-admin');
const db = admin.firestore();

async function getUserPushTokens(userId, role) {
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) {
    throw new Error('User not found');
  }
  
  const userData = userDoc.data();
  
  // Get role-specific tokens
  if (role === 'client') {
    return userData.clientPushTokens || [];
  } else if (role === 'stylist') {
    return userData.stylistPushTokens || [];
  }
  
  return [];
}
```

### Step 2: Send Push Notification via Expo API

```javascript
async function sendPushNotification(expoPushToken, title, message, data = {}, priority = 'default') {
  const pushMessage = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: message,
    data: data,
    priority: priority, // 'default' or 'high'
    channelId: 'default'
  };

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(pushMessage)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result;
}
```

### Step 3: Create Notification Document

```javascript
async function createNotificationDocument(notificationData) {
  const notificationDoc = {
    recipientId: notificationData.recipientId,
    recipientRole: notificationData.recipientRole,
    type: notificationData.type,
    title: notificationData.title,
    message: notificationData.message,
    priority: notificationData.priority || 'medium',
    data: notificationData.data || {},
    isRead: false,
    sent: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await db.collection('notifications').add(notificationDoc);
  return docRef.id;
}
```

### Step 4: Complete Flow

```javascript
async function sendNotificationToUser(userId, role, title, message, data = {}) {
  try {
    // 1. Create notification document
    const notificationId = await createNotificationDocument({
      recipientId: userId,
      recipientRole: role,
      type: data.type || 'general',
      title: title,
      message: message,
      priority: data.priority || 'medium',
      data: data
    });

    // 2. Get user's push tokens
    const pushTokens = await getUserPushTokens(userId, role);

    if (pushTokens.length === 0) {
      console.log('No push tokens found for user');
      return { success: false, error: 'No push tokens' };
    }

    // 3. Send push notification to all devices
    const results = [];
    for (const token of pushTokens) {
      try {
        const result = await sendPushNotification(
          token,
          title,
          message,
          { notificationId, ...data },
          data.priority === 'high' ? 'high' : 'default'
        );
        results.push({ token, success: true, result });
      } catch (error) {
        results.push({ token, success: false, error: error.message });
      }
    }

    // 4. Update notification document with send status
    const allSuccess = results.every(r => r.success);
    await db.collection('notifications').doc(notificationId).update({
      sent: allSuccess,
      sentAt: allSuccess ? admin.firestore.FieldValue.serverTimestamp() : null,
      error: allSuccess ? null : 'Some devices failed',
      errorAt: allSuccess ? null : admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, notificationId, results };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
}
```

---

## Notification Types

### Client Notifications

| Type | Priority | Use Case |
|------|----------|----------|
| `appointment_created` | medium | New appointment booked |
| `appointment_confirmed` | medium | Appointment confirmed by stylist |
| `appointment_reminder` | high | 24-hour reminder before appointment |
| `appointment_rescheduled` | medium | Appointment date/time changed |
| `appointment_cancelled` | high | Appointment cancelled |
| `appointment_completed` | medium | Service completed |
| `reward` | low | Loyalty points earned |
| `promotion` | low | New promotion available |
| `welcome` | low | Welcome message for new users |
| `info` | low | General information |
| `warning` | medium | Warning message |
| `error` | high | Error notification |
| `general` | low | General notification |

### Stylist Notifications

| Type | Priority | Use Case |
|------|----------|----------|
| `appointment_booking` | high | New appointment booked |
| `check_in_arrived` | high | Client checked in |
| `schedule_change` | medium | Schedule updated |
| `schedule` | medium | Schedule reminder |
| `portfolio_approved` | medium | Portfolio photo approved |
| `portfolio_rejected` | medium | Portfolio photo rejected |
| `commission_update` | medium | Commission earned |
| `success` | low | Success message |

---

## Code Examples

### Example 1: Send Appointment Reminder (Client)

```javascript
await sendNotificationToUser(
  'client123',
  'client',
  'Appointment Reminder',
  'Reminder: You have an appointment tomorrow at 10:00 AM with John Doe',
  {
    type: 'appointment_reminder',
    priority: 'high',
    appointmentId: 'appt123',
    appointmentDate: '2026-01-15',
    appointmentTime: '10:00 AM',
    stylistName: 'John Doe',
    branchName: 'Main Branch'
  }
);
```

### Example 2: Notify Stylist of New Booking

```javascript
await sendNotificationToUser(
  'stylist456',
  'stylist',
  'New Appointment',
  'New appointment with Jane Smith on Jan 15 at 10:00 AM',
  {
    type: 'appointment_booking',
    priority: 'high',
    appointmentId: 'appt123',
    clientName: 'Jane Smith',
    appointmentDate: '2026-01-15',
    appointmentTime: '10:00 AM',
    services: ['Haircut', 'Hair Color']
  }
);
```

### Example 3: Send Promotion (Client)

```javascript
await sendNotificationToUser(
  'client123',
  'client',
  '50% Off Hair Color!',
  'Get 50% off all hair color services this weekend only!',
  {
    type: 'promotion',
    priority: 'low',
    promotionId: 'promo123',
    discountPercent: 50,
    validUntil: '2026-01-20'
  }
);
```

---

## Testing

### Test with Expo Push Notification Tool

1. Get a test push token from the app (check Firestore or app logs)
2. Visit: https://expo.dev/notifications
3. Enter the token and test message
4. Click "Send a Notification"

### Test with cURL

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "sound": "default",
    "title": "Test Notification",
    "body": "This is a test message",
    "data": {
      "type": "test",
      "timestamp": "2026-02-22T10:00:00Z"
    },
    "priority": "high",
    "channelId": "default"
  }'
```

### Test with Node.js

```javascript
const fetch = require('node-fetch');

async function testPushNotification() {
  const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
  
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title: 'Test from Node.js',
      body: 'This is a test notification',
      data: { test: true },
      priority: 'high',
      channelId: 'default'
    })
  });

  const result = await response.json();
  console.log('Result:', result);
}

testPushNotification();
```

---

## Troubleshooting

### Common Issues

#### 1. Token Not Found
**Problem:** User has no push tokens in Firestore
**Solution:** 
- Ensure user has logged into the mobile app
- Check that the app has notification permissions
- Verify the app is running on a physical device (not simulator)

#### 2. Invalid Token Format
**Problem:** Token doesn't start with `ExponentPushToken[` or `ExpoPushToken[`
**Solution:**
- Verify you're using the correct token field (`clientPushTokens` or `stylistPushTokens`)
- Don't use legacy fields (`expoPushToken`, `pushToken`, etc.)

#### 3. Notification Not Received
**Problem:** Push notification sent but not received on device
**Solution:**
- Check device notification settings
- Verify app has notification permissions
- Check if device is connected to internet
- Verify token is still valid (tokens can expire)

#### 4. Wrong Role Notifications
**Problem:** Client receiving stylist notifications or vice versa
**Solution:**
- Always specify the correct `recipientRole` when creating notifications
- Use `clientPushTokens` for clients, `stylistPushTokens` for stylists
- Never use generic token fields

#### 5. HTTP 400 Error from Expo API
**Problem:** Expo API returns 400 Bad Request
**Solution:**
- Verify token format is correct
- Check that all required fields are present
- Ensure `data` object doesn't contain undefined values

### Debug Checklist

- [ ] User document exists in Firestore
- [ ] User has tokens in correct role-specific array
- [ ] Token format is valid (starts with `ExponentPushToken[`)
- [ ] Notification document created successfully
- [ ] Expo API returns 200 status
- [ ] Device has internet connection
- [ ] App has notification permissions
- [ ] Device is not in Do Not Disturb mode

---

## Firebase Configuration

### Project Details
- **Project ID:** `official-david-salon-a6450`
- **EAS Project ID:** `f76b8a7a-7537-4dc7-8f49-b0fe6fea5017`
- **Collections:**
  - Users: `users`
  - Notifications: `notifications`

### Required Permissions
Your web service needs:
- Read access to `users` collection (to get push tokens)
- Write access to `notifications` collection (to create notification documents)

---

## Best Practices

1. **Always Use Role-Specific Tokens**
   - Use `clientPushTokens` for client notifications
   - Use `stylistPushTokens` for stylist notifications
   - Never use legacy single-token fields

2. **Handle Multiple Devices**
   - Users can have multiple devices
   - Send notifications to all tokens in the array
   - Handle failures gracefully (some devices may be offline)

3. **Set Appropriate Priority**
   - `high`: Urgent notifications (appointments, check-ins)
   - `medium`: Important but not urgent (confirmations, updates)
   - `low`: Informational (promotions, tips)

4. **Include Relevant Data**
   - Always include `notificationId` in push data
   - Include IDs for related entities (appointmentId, etc.)
   - Keep data payload small (< 4KB)

5. **Error Handling**
   - Log all errors for debugging
   - Update notification documents with error status
   - Retry failed notifications if appropriate

6. **Rate Limiting**
   - Don't spam users with too many notifications
   - Batch notifications when possible
   - Respect user notification preferences

---

## Additional Resources

- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [Expo Push API Reference](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Expo Push Notification Tool](https://expo.dev/notifications)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review app logs in the mobile app
3. Test with the Expo Push Notification Tool
4. Verify Firestore data structure matches this guide

---

**Last Updated:** February 22, 2026
**App Version:** Compatible with David Salon App v1.0+
