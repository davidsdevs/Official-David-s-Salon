# 📧 M03: Appointment Notifications Setup

**Module:** M03 - Appointment Management  
**Component:** Notifications & Reminders  
**Status:** Placeholder for Cloud Functions Implementation  
**Date:** November 2024

---

## 📋 Overview

This document outlines the notification system for appointment management. The actual implementation will be done using **Firebase Cloud Functions** in a future phase.

---

## 🎯 Notification Types

### 1. **Appointment Confirmation**
- **Trigger:** When appointment is created
- **Recipients:** Client
- **Channels:** Email + SMS
- **Content:**
  - Appointment date & time
  - Service details
  - Branch location
  - Stylist name (if assigned)
  - Cancellation policy

### 2. **Appointment Reminder (24 Hours)**
- **Trigger:** 24 hours before appointment
- **Recipients:** Client
- **Channels:** Email + SMS
- **Content:**
  - Reminder of upcoming appointment
  - Date, time, location
  - Service details
  - Rescheduling link

### 3. **Appointment Reminder (1 Hour)**
- **Trigger:** 1 hour before appointment
- **Recipients:** Client
- **Channels:** SMS only
- **Content:**
  - Quick reminder
  - Branch address
  - Contact number

### 4. **Appointment Rescheduled**
- **Trigger:** When appointment is rescheduled
- **Recipients:** Client + Stylist
- **Channels:** Email + SMS
- **Content:**
  - New date & time
  - Reason (if provided)
  - Confirmation details

### 5. **Appointment Cancelled**
- **Trigger:** When appointment is cancelled
- **Recipients:** Client + Stylist
- **Channels:** Email + SMS
- **Content:**
  - Cancellation confirmation
  - Reason (if provided)
  - Rebooking link

### 6. **Appointment Status Update**
- **Trigger:** Status changes (Confirmed, In Progress, Completed)
- **Recipients:** Client
- **Channels:** Push notification (mobile app)
- **Content:**
  - Status update
  - Next steps (if any)

---

## 🔧 Implementation Plan

### **Phase 1: Firebase Cloud Functions Setup**

```javascript
// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

admin.initializeApp();

// Email transporter setup (using SendGrid)
const transporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: functions.config().sendgrid.key
  }
});

// Twilio setup
const twilioClient = twilio(
  functions.config().twilio.sid,
  functions.config().twilio.token
);

// 1. Appointment Confirmation
exports.sendAppointmentConfirmation = functions.firestore
  .document('appointments/{appointmentId}')
  .onCreate(async (snap, context) => {
    const appointment = snap.data();
    
    // Send email
    await sendConfirmationEmail(appointment);
    
    // Send SMS
    await sendConfirmationSMS(appointment);
  });

// 2. Appointment Reminders (Scheduled)
exports.sendAppointmentReminders = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursLater = new Date(now.toDate().getTime() + 24 * 60 * 60 * 1000);
    const oneHourLater = new Date(now.toDate().getTime() + 60 * 60 * 1000);
    
    // Query appointments needing reminders
    const appointmentsRef = admin.firestore().collection('appointments');
    
    // 24-hour reminders
    const twentyFourHourReminders = await appointmentsRef
      .where('appointmentDate', '>=', now)
      .where('appointmentDate', '<=', admin.firestore.Timestamp.fromDate(twentyFourHoursLater))
      .where('reminderSent24h', '==', false)
      .get();
    
    // Send 24-hour reminders
    for (const doc of twentyFourHourReminders.docs) {
      await send24HourReminder(doc.data());
      await doc.ref.update({ reminderSent24h: true });
    }
    
    // 1-hour reminders
    const oneHourReminders = await appointmentsRef
      .where('appointmentDate', '>=', now)
      .where('appointmentDate', '<=', admin.firestore.Timestamp.fromDate(oneHourLater))
      .where('reminderSent1h', '==', false)
      .get();
    
    // Send 1-hour reminders
    for (const doc of oneHourReminders.docs) {
      await send1HourReminder(doc.data());
      await doc.ref.update({ reminderSent1h: true });
    }
  });

// 3. Appointment Status Updates
exports.sendStatusUpdate = functions.firestore
  .document('appointments/{appointmentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (before.status !== after.status) {
      await sendStatusUpdateNotification(after);
    }
  });

// Helper functions
async function sendConfirmationEmail(appointment) {
  const mailOptions = {
    from: 'David\'s Salon <noreply@davidssalon.com>',
    to: appointment.clientEmail,
    subject: 'Appointment Confirmation',
    html: `
      <h2>Your appointment is confirmed!</h2>
      <p><strong>Date:</strong> ${formatDate(appointment.appointmentDate)}</p>
      <p><strong>Time:</strong> ${formatTime(appointment.appointmentDate)}</p>
      <p><strong>Service:</strong> ${appointment.serviceName}</p>
      <p><strong>Branch:</strong> ${appointment.branchName}</p>
      <p><strong>Stylist:</strong> ${appointment.stylistName || 'To be assigned'}</p>
      <br>
      <p>See you soon!</p>
    `
  };
  
  return transporter.sendMail(mailOptions);
}

async function sendConfirmationSMS(appointment) {
  return twilioClient.messages.create({
    body: `David's Salon: Your appointment is confirmed for ${formatDate(appointment.appointmentDate)} at ${formatTime(appointment.appointmentDate)}. Branch: ${appointment.branchName}`,
    from: functions.config().twilio.phone,
    to: appointment.clientPhone
  });
}

// Additional helper functions...
```

---

## 📧 Email Templates

### **Confirmation Email**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Appointment Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hi {{clientName}},</p>
      <p>Your appointment has been confirmed:</p>
      <ul>
        <li><strong>Date:</strong> {{date}}</li>
        <li><strong>Time:</strong> {{time}}</li>
        <li><strong>Service:</strong> {{service}}</li>
        <li><strong>Branch:</strong> {{branch}}</li>
        <li><strong>Stylist:</strong> {{stylist}}</li>
      </ul>
      <p>Need to reschedule? <a href="{{rescheduleLink}}" class="button">Reschedule</a></p>
    </div>
  </div>
</body>
</html>
```

---

## 📱 SMS Templates

### **Confirmation SMS**
```
David's Salon: Appointment confirmed for {{date}} at {{time}}. Service: {{service}}. Branch: {{branch}}. See you soon!
```

### **24-Hour Reminder**
```
Reminder: You have an appointment tomorrow at {{time}} for {{service}} at {{branch}}. Reply CANCEL to cancel.
```

### **1-Hour Reminder**
```
Your appointment starts in 1 hour at {{branch}}. Address: {{address}}. Contact: {{phone}}
```

---

## 🔐 Environment Variables

Add these to Firebase Functions config:

```bash
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"
firebase functions:config:set twilio.sid="YOUR_TWILIO_SID"
firebase functions:config:set twilio.token="YOUR_TWILIO_TOKEN"
firebase functions:config:set twilio.phone="+1234567890"
```

---

## 📊 Notification Tracking

Add these fields to appointment documents:

```javascript
{
  // Existing fields...
  
  // Notification tracking
  reminderSent24h: false,
  reminderSent1h: false,
  confirmationSent: false,
  notificationHistory: [
    {
      type: 'confirmation',
      channel: 'email',
      sentAt: Timestamp,
      status: 'delivered'
    }
  ]
}
```

---

## 🧪 Testing

### **Local Testing**
```bash
# Install Firebase Functions emulator
firebase emulators:start --only functions

# Test notification trigger
curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/sendAppointmentConfirmation \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "test123"}'
```

### **Production Deployment**
```bash
firebase deploy --only functions
```

---

## 📈 Future Enhancements

1. **Push Notifications** - Mobile app integration
2. **WhatsApp Notifications** - Using Twilio WhatsApp API
3. **Customizable Templates** - Admin can edit templates
4. **Notification Preferences** - Clients choose channels
5. **Delivery Reports** - Track notification success rates
6. **A/B Testing** - Test different message formats

---

## 📝 Notes

- This is a **placeholder document** for future implementation
- Actual Cloud Functions will be developed in Phase 2
- Current system logs notification triggers but doesn't send actual messages
- Email/SMS integration requires third-party service setup (SendGrid, Twilio)

---

**Status:** 📋 Documentation Complete - Implementation Pending
