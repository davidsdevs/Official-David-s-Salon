import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
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

const branchId = '2jcrfvY7pxnMdsc1qbC4';
const branchName = 'Ayala Malls Harbor Point';
const createdBy = '5KtFGs6HVb5rqdnaXWJx';
const createdByName = 'John Francis Canapati';
const birBatchId = 'yDXNRUhdTUFajBCOB3w4';

// Product data for walk-in sales
const products = [
  { id: 'KFjdZ2Rj2G6wscUW8wNt', name: 'Goldwell Kerasilk Control Conditioner', price: 1020, commission: 12 },
  { id: 'qV0VdYBU5TAWvOMl5KRf', name: 'Aveda Damage Remedy Shampoo', price: 1320, commission: 15 },
  { id: 'tqJXhsOTiN2hNRY9sXxD', name: 'Pureology Hydrate Shampoo', price: 1400, commission: 12 },
  { id: 'tN4igsqZ9EZJgCEna1ie', name: 'Moroccanoil Treatment Original', price: 2400, commission: 15 },
  { id: 'nF6nvtwBGRi1b8FNTS4g', name: 'Beauty Essentials Trading', price: 200, commission: 15 }
];

const stylists = [
  { uid: 'JxSopoVUYNmqcY0CSDvW', name: 'Alex Santos' },
  { uid: 'puDf1BIMWgJoXXZ3EYW2', name: 'Claire Jessicas Cruz' },
  { uid: 'zqKbkmlkeG0VopOif0Oy', name: 'Bianca Ramirez' }
];

const clients = [
  { uid: '3XUO7ydcY2UX0JtBxUy3', name: 'Client 1', phone: '+63 912345678' },
  { uid: 'oMuF6zmVmAGwc0ooowGF', name: 'Hannah Miranda', phone: '+63 923456789' },
  { uid: 'sXvE1Rl6hmsgHHA1b8GH', name: 'Gwy Cruz', phone: '+63 934567890' },
  { uid: 'yiXwU6OBpOOROZ9SL224', name: 'Client 4', phone: '+63 945678901' }
];

const paymentMethods = ['cash', 'card', 'gcash'];

let receiptCounter = 3; // Start from 3 since you have 0001 and 0002

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateReceiptNumber() {
  receiptCounter++;
  return receiptCounter.toString().padStart(2, '0');
}

function createServiceTransaction(appointment) {
  const client = clients.find(c => c.uid === appointment.clientId) || clients[0];
  
  // Convert appointment services to transaction items
  const items = appointment.services.map(service => ({
    id: service.serviceId,
    name: service.serviceName,
    type: 'service',
    price: service.price,
    basePrice: service.price,
    quantity: service.quantity || 1,
    stylistId: service.stylistId,
    stylistName: service.stylistName,
    originalStylistId: service.stylistId,
    originalStylistName: service.stylistName,
    adjustment: 0,
    adjustmentReason: '',
    clientType: 'R',
    productMappings: [],
    serviceProductUsages: []
  }));

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal;

  // Use appointment date for transaction date
  const transactionDate = appointment.appointmentDate.toDate();
  
  return {
    appointmentId: appointment.id,
    approvedBy: null,
    birBatchId,
    branchId,
    branchName,
    clientId: client.uid,
    clientName: client.name,
    clientPhone: client.phone,
    createdAt: Timestamp.fromDate(transactionDate),
    createdBy,
    createdByName,
    discount: 0,
    discountCode: null,
    discountType: 'fixed',
    items,
    loyaltyPointsUsed: 0,
    notes: '',
    paymentMethod: getRandomElement(paymentMethods),
    paymentReference: null,
    promotionCode: null,
    promotionDiscount: 0,
    promotionId: null,
    receiptNumber: generateReceiptNumber(),
    salesType: 'service',
    status: 'paid',
    stylistId: items[0].stylistId,
    stylistName: items[0].stylistName,
    subtotal,
    tax: 0,
    taxRate: 0,
    total,
    updatedAt: Timestamp.fromDate(transactionDate)
  };
}

function createProductTransaction(type) {
  const now = new Date();
  let transactionDate;

  if (type === 'past') {
    // 6 months ago to 1 day ago
    const daysAgo = Math.floor(Math.random() * 180) + 1;
    transactionDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  } else {
    // Today to 7 days ago
    const daysAgo = Math.floor(Math.random() * 7);
    transactionDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  }

  // Set random hour
  transactionDate.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);

  const client = getRandomElement(clients);
  const stylist = Math.random() > 0.3 ? getRandomElement(stylists) : null; // 70% have stylist commission
  
  // Select 1-3 products
  const numProducts = Math.floor(Math.random() * 3) + 1;
  const selectedProducts = [];
  for (let i = 0; i < numProducts; i++) {
    selectedProducts.push(getRandomElement(products));
  }

  const items = selectedProducts.map(product => ({
    id: product.id,
    name: product.name,
    type: 'product',
    price: product.price,
    basePrice: product.price,
    quantity: Math.floor(Math.random() * 3) + 1,
    commissionPercentage: product.commission,
    commissionPoints: stylist ? (product.price * product.commission / 100) : 0,
    commissionerId: stylist ? stylist.uid : '',
    commissionerName: stylist ? stylist.name : '',
    stock: 20,
    stockId: 'mock_stock_id',
    unitCost: Math.floor(product.price * 0.6),
    allBatches: [],
    batches: []
  }));

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal;

  return {
    appointmentId: null,
    approvedBy: null,
    birBatchId,
    branchId,
    branchName,
    clientId: client.uid,
    clientName: client.name,
    clientPhone: client.phone,
    createdAt: Timestamp.fromDate(transactionDate),
    createdBy,
    createdByName,
    discount: 0,
    discountCode: null,
    discountType: 'fixed',
    items,
    loyaltyPointsUsed: 0,
    notes: 'Walk-in customer',
    paymentMethod: getRandomElement(paymentMethods),
    paymentReference: null,
    promotionCode: null,
    promotionDiscount: 0,
    promotionId: null,
    receiptNumber: generateReceiptNumber(),
    salesType: 'product',
    status: 'paid',
    stylistId: null,
    stylistName: '',
    subtotal,
    tax: 0,
    taxRate: 0,
    total,
    updatedAt: Timestamp.fromDate(transactionDate)
  };
}

async function seedTransactions() {
  try {
    console.log('💰 Starting transaction seeding...\n');

    // Get all appointments and filter client-side
    console.log('📅 Fetching appointments...');
    const appointmentsSnapshot = await getDocs(collection(db, 'appointments'));
    const allAppointments = [];
    appointmentsSnapshot.forEach(doc => {
      allAppointments.push({ id: doc.id, ...doc.data() });
    });

    // Filter for past confirmed appointments
    const now = new Date();
    const appointments = allAppointments
      .filter(a => {
        if (a.status !== 'confirmed') return false;
        const appointmentDate = a.appointmentDate?.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate);
        return appointmentDate < now;
      })
      .sort((a, b) => {
        const dateA = a.appointmentDate?.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate);
        const dateB = b.appointmentDate?.toDate ? b.appointmentDate.toDate() : new Date(b.appointmentDate);
        return dateB - dateA;
      })
      .slice(0, 25);

    console.log(`✅ Found ${appointments.length} confirmed appointments (from ${allAppointments.length} total)\n`);

    const transactions = [];

    // Create service transactions from appointments
    console.log('🔨 Creating service transactions from appointments...');
    for (const appointment of appointments) {
      transactions.push(createServiceTransaction(appointment));
    }
    console.log(`✅ Created ${appointments.length} service transactions\n`);

    // Create additional product transactions to reach 25 total
    const remainingPast = 25 - appointments.length;
    if (remainingPast > 0) {
      console.log(`🛍️  Creating ${remainingPast} past product transactions...`);
      for (let i = 0; i < remainingPast; i++) {
        transactions.push(createProductTransaction('past'));
      }
    }

    // Create 25 present transactions (mix of service and product)
    console.log('🛍️  Creating 25 present transactions...');
    for (let i = 0; i < 25; i++) {
      transactions.push(createProductTransaction('present'));
    }

    console.log(`\n✅ Generated ${transactions.length} transactions`);
    console.log('💾 Saving to Firestore...\n');

    // Save to Firestore
    let savedCount = 0;
    for (const transaction of transactions) {
      await addDoc(collection(db, 'transactions'), transaction);
      savedCount++;
      if (savedCount % 10 === 0) {
        console.log(`   Saved ${savedCount}/${transactions.length} transactions...`);
      }
    }

    console.log(`\n✅ Successfully seeded ${savedCount} transactions!`);
    
    // Calculate summary
    const serviceTransactions = transactions.filter(t => t.salesType === 'service').length;
    const productTransactions = transactions.filter(t => t.salesType === 'product').length;
    const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);

    console.log('\n📊 Summary:');
    console.log(`   - Service transactions: ${serviceTransactions}`);
    console.log(`   - Product transactions: ${productTransactions}`);
    console.log(`   - Total transactions: ${savedCount}`);
    console.log(`   - Total revenue: ₱${totalRevenue.toLocaleString()}`);
    console.log(`   - Receipt numbers: 03 to ${receiptCounter.toString().padStart(2, '0')}`);

  } catch (error) {
    console.error('❌ Error seeding transactions:', error);
    throw error;
  }
}

// Run the seeder
seedTransactions()
  .then(() => {
    console.log('\n🎉 Transaction seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Transaction seeding failed:', error);
    process.exit(1);
  });
