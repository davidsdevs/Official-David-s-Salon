import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Client UIDs
const clients = [
  { uid: '3XUO7ydcY2UX0JtBxUy3', name: 'Client 1', email: 'client1@example.com', phone: '+63 912345678' },
  { uid: 'oMuF6zmVmAGwc0ooowGF', name: 'Hannah Miranda', email: 'col.2022010181@lsb.edu.ph', phone: '+63 923456789' },
  { uid: 'sXvE1Rl6hmsgHHA1b8GH', name: 'Gwy Cruz', email: 'gwy@example.com', phone: '+63 934567890' },
  { uid: 'yiXwU6OBpOOROZ9SL224', name: 'Client 4', email: 'client4@example.com', phone: '+63 945678901' }
];

// Stylist data
const stylists = [
  { uid: 'JxSopoVUYNmqcY0CSDvW', name: 'Alex Santos', services: ['eCdYFGykVPsppb7MFezc', 'BVpBNR0VxiwZPunnGtk2', 'QLAAPIfarRH0anOF3sFY', 'TdEYSNKfaa8y5jOYsAxT'] },
  { uid: 'puDf1BIMWgJoXXZ3EYW2', name: 'Claire Jessicas Cruz', services: ['LBgoKMXEgx6m0KjLCEWG', 'eCdYFGykVPsppb7MFezc', 'V7cTdEUwhF7L5sVh6Nu7', 'TdEYSNKfaa8y5jOYsAxT'] },
  { uid: 'zqKbkmlkeG0VopOif0Oy', name: 'Bianca Ramirez', services: ['oi8CykvdKTtLmoiZPJpU', 'LPHWEWJG144WZiqTUvgq', '2U9S2PhpNbOnqPxfzmFN'] }
];

const branchId = '2jcrfvY7pxnMdsc1qbC4';
const branchName = 'Ayala Malls Harbor Point';
const createdBy = '5KtFGs6HVb5rqdnaXWJx'; // Receptionist/Admin

// Service templates with prices
const serviceTemplates = [
  { id: 'V7cTdEUwhF7L5sVh6Nu7', name: 'D2 Treatment', price: 1900, duration: 90 },
  { id: 'TdEYSNKfaa8y5jOYsAxT', name: 'Highlights Foil', price: 1800, duration: 120 },
  { id: 'eCdYFGykVPsppb7MFezc', name: 'Hair Color', price: 2500, duration: 150 },
  { id: 'BVpBNR0VxiwZPunnGtk2', name: 'Keratin Treatment', price: 3500, duration: 180 },
  { id: 'QLAAPIfarRH0anOF3sFY', name: 'Hair Spa', price: 1200, duration: 60 },
  { id: 'LBgoKMXEgx6m0KjLCEWG', name: 'Rebonding', price: 4000, duration: 240 },
  { id: 'oi8CykvdKTtLmoiZPJpU', name: 'Hair Cut', price: 500, duration: 30 },
  { id: 'LPHWEWJG144WZiqTUvgq', name: 'Hair Styling', price: 800, duration: 45 },
  { id: '2U9S2PhpNbOnqPxfzmFN', name: 'Scalp Treatment', price: 1500, duration: 75 }
];

const appointmentTimes = [
  '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
];

const notes = [
  'First time client',
  'Regular customer',
  'Special occasion - wedding',
  'Birthday celebration',
  'Requested specific stylist',
  'Walk-in appointment',
  'Referred by friend',
  'VIP client',
  'Needs consultation first',
  'Allergic to certain products'
];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateAppointmentDate(type) {
  const now = new Date();
  let date;

  if (type === 'past') {
    // 6 months ago to 1 day ago
    const daysAgo = Math.floor(Math.random() * 180) + 1;
    date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  } else if (type === 'present') {
    // Today to 7 days from now
    const daysFromNow = Math.floor(Math.random() * 7);
    date = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
  } else {
    // 8 days to 60 days from now
    const daysFromNow = Math.floor(Math.random() * 53) + 8;
    date = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
  }

  // Set to a random hour between 9 AM and 5 PM
  date.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);
  return date;
}

function createAppointment(type, index) {
  const client = getRandomElement(clients);
  const appointmentDate = generateAppointmentDate(type);
  const appointmentTime = getRandomElement(appointmentTimes);
  
  // Determine status based on type
  let status;
  if (type === 'past') {
    status = Math.random() > 0.3 ? 'confirmed' : 'pending'; // 70% confirmed, 30% pending
  } else if (type === 'present') {
    status = Math.random() > 0.4 ? 'confirmed' : 'pending'; // 60% confirmed, 40% pending
  } else {
    status = 'pending'; // All future appointments are pending
  }

  // Select 1-3 services
  const numServices = Math.floor(Math.random() * 3) + 1;
  const selectedServices = getRandomElements(serviceTemplates, numServices);
  
  const services = selectedServices.map(service => {
    // Find a stylist who can do this service
    const availableStylists = stylists.filter(s => s.services.includes(service.id));
    const stylist = availableStylists.length > 0 
      ? getRandomElement(availableStylists)
      : getRandomElement(stylists);

    return {
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      quantity: 1,
      stylistId: stylist.uid,
      stylistName: stylist.name
    };
  });

  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const createdAt = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000); // Created 1 day before appointment

  const history = [
    {
      action: 'created',
      by: createdBy,
      notes: 'Appointment created',
      timestamp: createdAt.toISOString()
    }
  ];

  if (status === 'confirmed') {
    history.push({
      action: 'status_changed_to_confirmed',
      by: createdBy,
      timestamp: createdAt.toISOString()
    });
  }

  return {
    appointmentDate: Timestamp.fromDate(appointmentDate),
    appointmentTime,
    branchId,
    branchName,
    clientId: client.uid,
    clientName: client.name,
    clientEmail: client.email,
    clientPhone: client.phone,
    isGuest: false,
    services,
    products: [],
    totalPrice,
    status,
    notes: getRandomElement(notes),
    history,
    createdAt: Timestamp.fromDate(createdAt),
    createdBy,
    updatedAt: Timestamp.fromDate(createdAt)
  };
}

async function seedAppointments() {
  try {
    console.log('🌱 Starting appointment seeding...\n');

    const appointments = [];

    // Generate 30 past appointments
    console.log('📅 Generating 30 past appointments (6 months ago)...');
    for (let i = 0; i < 30; i++) {
      appointments.push(createAppointment('past', i));
    }

    // Generate 30 present appointments
    console.log('📅 Generating 30 present appointments (today to next 7 days)...');
    for (let i = 0; i < 30; i++) {
      appointments.push(createAppointment('present', i));
    }

    // Generate 30 future appointments
    console.log('📅 Generating 30 future appointments (8-60 days from now)...');
    for (let i = 0; i < 30; i++) {
      appointments.push(createAppointment('future', i));
    }

    console.log(`\n✅ Generated ${appointments.length} appointments`);
    console.log('💾 Saving to Firestore...\n');

    // Save to Firestore
    let savedCount = 0;
    for (const appointment of appointments) {
      await addDoc(collection(db, 'appointments'), appointment);
      savedCount++;
      if (savedCount % 10 === 0) {
        console.log(`   Saved ${savedCount}/${appointments.length} appointments...`);
      }
    }

    console.log(`\n✅ Successfully seeded ${savedCount} appointments!`);
    console.log('\n📊 Summary:');
    console.log(`   - Past appointments: 30 (mixed confirmed/pending)`);
    console.log(`   - Present appointments: 30 (mixed confirmed/pending)`);
    console.log(`   - Future appointments: 30 (all pending)`);
    console.log(`   - Total: ${savedCount} appointments`);

  } catch (error) {
    console.error('❌ Error seeding appointments:', error);
    throw error;
  }
}

// Run the seeder
seedAppointments()
  .then(() => {
    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });
