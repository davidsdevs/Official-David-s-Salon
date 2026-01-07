// Cloud Functions for David's Salon Management System
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Example: sendWelcomeEmail function
exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
  console.log('User created:', user.email);
  // Add email sending logic here if needed
  return null;
});

// Example: processStockMovement function
exports.processStockMovement = functions.firestore
  .document('inventory_movements/{docId}')
  .onCreate((snap) => {
    const movementData = snap.data();
    console.log('Stock movement recorded:', movementData);
    // Add custom processing logic here
    return null;
  });

// Example: calculateBranchMetrics function
exports.calculateBranchMetrics = functions.pubsub
  .schedule('every day 00:00')
  .timeZone('Asia/Manila')
  .onRun(async () => {
    console.log('Running daily branch metrics calculation...');
    // Add metrics calculation logic here
    return null;
  });

// Add your custom functions here
module.exports = { ...exports };
