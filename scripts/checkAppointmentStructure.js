/**
 * Check Appointment Document Structure
 * Helps diagnose why appointments aren't loading
 */

import admin from 'firebase-admin';
import serviceAccount from '../firebase-key.json' assert { type: 'json' };

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project.firebaseio.com'
});

const db = admin.firestore();

async function checkAppointmentStructure() {
  try {
    console.log('\n📋 Checking Appointment Collection Structure...\n');
    
    const appointmentsRef = db.collection('appointments');
    const snapshot = await appointmentsRef.limit(10).get();
    
    console.log(`Total appointments found: ${snapshot.size}\n`);
    
    if (snapshot.empty) {
      console.log('❌ No appointments found in the collection!');
      return;
    }
    
    console.log('Sample appointments:\n');
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n--- Appointment ${index + 1} ---`);
      console.log(`ID: ${doc.id}`);
      console.log(`Fields present:`, Object.keys(data));
      console.log('Key fields:');
      console.log(`  - branchId: ${data.branchId || '❌ MISSING'}`);
      console.log(`  - clientId: ${data.clientId || '(none)'}`);
      console.log(`  - stylistId: ${data.stylistId || '(none)'}`);
      console.log(`  - serviceId: ${data.serviceId || '(none)'}`);
      console.log(`  - appointmentDate: ${data.appointmentDate ? data.appointmentDate.toDate() : '(none)'}`);
      console.log(`  - status: ${data.status || '(none)'}`);
      console.log(`  - clientName: ${data.clientName || '(none)'}`);
    });
    
    // Check for appointments missing branchId
    console.log('\n\n🔍 Checking for appointments without branchId...\n');
    const allAppointments = await appointmentsRef.get();
    const missingBranchId = allAppointments.docs.filter(doc => !doc.data().branchId);
    console.log(`Appointments without branchId: ${missingBranchId.length} out of ${allAppointments.size}`);
    
    if (missingBranchId.length > 0) {
      console.log('\n⚠️ ISSUE FOUND: Some appointments are missing the branchId field!');
      console.log('These appointments will not appear in branch-specific queries.\n');
      
      // Show affected appointment IDs
      console.log('Affected appointment IDs:');
      missingBranchId.forEach((doc, index) => {
        if (index < 5) {
          console.log(`  - ${doc.id}`);
        }
      });
      if (missingBranchId.length > 5) {
        console.log(`  ... and ${missingBranchId.length - 5} more`);
      }
    } else {
      console.log('✅ All appointments have branchId field');
    }
    
    // Check unique branches
    console.log('\n\n📍 Unique branches in appointments:\n');
    const branches = new Set();
    allAppointments.docs.forEach(doc => {
      const branchId = doc.data().branchId;
      if (branchId) {
        branches.add(branchId);
      }
    });
    
    branches.forEach(branch => console.log(`  - ${branch}`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAppointmentStructure();
