import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
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
const createdBy = 'sso_admin_001';
const createdByName = 'David Admin';

// Promotion templates with variety
const promotionTemplates = [
  {
    title: 'New Year Special',
    description: 'Start the year with beautiful hair! Get 10% off all services.',
    discountType: 'percentage',
    discountValue: 10,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Valentine\'s Day Promo',
    description: 'Look stunning for your special someone! 15% off on all hair treatments.',
    discountType: 'percentage',
    discountValue: 15,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Summer Glow Package',
    description: 'Get ready for summer! ₱200 off on hair coloring services.',
    discountType: 'fixed',
    discountValue: 200,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Midweek Madness',
    description: 'Beat the midweek blues! 20% off every Wednesday.',
    discountType: 'percentage',
    discountValue: 20,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Student Discount',
    description: 'Students get 12% off with valid ID!',
    discountType: 'percentage',
    discountValue: 12,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Senior Citizen Special',
    description: 'Exclusive discount for our senior citizens - 15% off all services.',
    discountType: 'percentage',
    discountValue: 15,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Birthday Month Treat',
    description: 'Celebrate your birthday with us! Get ₱300 off any service.',
    discountType: 'fixed',
    discountValue: 300,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Weekend Warrior',
    description: 'Weekend special! 10% off on Saturdays and Sundays.',
    discountType: 'percentage',
    discountValue: 10,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'First Time Client',
    description: 'Welcome to David\'s Salon! Enjoy 20% off your first visit.',
    discountType: 'percentage',
    discountValue: 20,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Loyalty Rewards',
    description: 'Thank you for your loyalty! Get ₱150 off your next service.',
    discountType: 'fixed',
    discountValue: 150,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Flash Sale Friday',
    description: 'Limited time only! 25% off all services this Friday.',
    discountType: 'percentage',
    discountValue: 25,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Mother\'s Day Special',
    description: 'Treat mom to something special! 18% off all services.',
    discountType: 'percentage',
    discountValue: 18,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Back to School Promo',
    description: 'Fresh look for the new school year! ₱250 off.',
    discountType: 'fixed',
    discountValue: 250,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Holiday Season Sale',
    description: 'Celebrate the holidays with gorgeous hair! 15% off.',
    discountType: 'percentage',
    discountValue: 15,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Anniversary Celebration',
    description: 'Celebrating our anniversary with you! 30% off all services.',
    discountType: 'percentage',
    discountValue: 30,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Rainy Day Discount',
    description: 'Don\'t let the rain stop you! ₱100 off on rainy days.',
    discountType: 'fixed',
    discountValue: 100,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Early Bird Special',
    description: 'Book before 10 AM and get 12% off!',
    discountType: 'percentage',
    discountValue: 12,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  },
  {
    title: 'Referral Bonus',
    description: 'Refer a friend and both get ₱200 off!',
    discountType: 'fixed',
    discountValue: 200,
    applicableTo: 'all',
    imageUrl: 'https://res.cloudinary.com/dn0jgdjts/image/upload/v1768485388/aucavfwmymijrbos9v7a.png'
  }
];

function generatePromoCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'DS-2JC-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRandomDateRange(index, total) {
  const now = new Date();
  
  // Create different date ranges for variety
  // Some past (expired), some current (active), some future
  
  if (index < 5) {
    // Past promotions (expired)
    const daysAgo = 30 + Math.floor(Math.random() * 60); // 30-90 days ago
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const duration = 7 + Math.floor(Math.random() * 14); // 7-21 days duration
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    return { startDate, endDate, isActive: false };
  } else if (index < 10) {
    // Current promotions (active)
    const daysAgo = Math.floor(Math.random() * 7); // Started 0-7 days ago
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const daysAhead = 7 + Math.floor(Math.random() * 21); // Ends in 7-28 days
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return { startDate, endDate, isActive: true };
  } else {
    // Future promotions (not yet active)
    const daysAhead = 5 + Math.floor(Math.random() * 20); // Starts in 5-25 days
    const startDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const duration = 7 + Math.floor(Math.random() * 14); // 7-21 days duration
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
    return { startDate, endDate, isActive: false };
  }
}

function createPromotion(template, index, total) {
  const { startDate, endDate, isActive } = getRandomDateRange(index, total);
  const createdDate = new Date(startDate.getTime() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000);
  
  // Set times
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  createdDate.setHours(9 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
  
  return {
    applicableTo: template.applicableTo,
    branchId,
    createdAt: Timestamp.fromDate(createdDate),
    createdBy,
    createdByName,
    description: template.description,
    discountType: template.discountType,
    discountValue: template.discountValue,
    endDate: Timestamp.fromDate(endDate),
    imageUrl: template.imageUrl,
    isActive,
    maxUses: null,
    promotionCode: generatePromoCode(),
    sentTo: [],
    specificProducts: [],
    specificServices: [],
    startDate: Timestamp.fromDate(startDate),
    title: template.title,
    updatedAt: Timestamp.fromDate(createdDate),
    usageCount: 0,
    usageType: 'one-time',
    usedBy: []
  };
}

async function seedPromotions() {
  try {
    console.log('🎉 Starting promotion seeding...\n');

    const promotions = [];
    
    // Create 18 promotions (using all templates)
    for (let i = 0; i < promotionTemplates.length; i++) {
      const promotion = createPromotion(promotionTemplates[i], i, promotionTemplates.length);
      promotions.push(promotion);
    }

    console.log(`✅ Generated ${promotions.length} promotions\n`);
    console.log('💾 Saving to Firestore...\n');

    // Save to Firestore
    let savedCount = 0;
    for (const promotion of promotions) {
      await addDoc(collection(db, 'promotions'), promotion);
      savedCount++;
      
      const status = promotion.isActive ? '🟢 Active' : '⚪ Inactive';
      const startDateStr = promotion.startDate.toDate().toLocaleDateString();
      const endDateStr = promotion.endDate.toDate().toLocaleDateString();
      
      console.log(`   ${savedCount}. ${status} ${promotion.title}`);
      console.log(`      Code: ${promotion.promotionCode}`);
      console.log(`      ${promotion.discountType === 'percentage' ? promotion.discountValue + '%' : '₱' + promotion.discountValue} off`);
      console.log(`      ${startDateStr} → ${endDateStr}\n`);
    }

    console.log(`✅ Successfully seeded ${savedCount} promotions!`);
    
    // Calculate summary
    const activePromotions = promotions.filter(p => p.isActive).length;
    const inactivePromotions = promotions.filter(p => !p.isActive).length;
    const percentageDiscounts = promotions.filter(p => p.discountType === 'percentage').length;
    const fixedDiscounts = promotions.filter(p => p.discountType === 'fixed').length;

    console.log('\n📊 Summary:');
    console.log(`   - Active promotions: ${activePromotions}`);
    console.log(`   - Inactive promotions: ${inactivePromotions}`);
    console.log(`   - Percentage discounts: ${percentageDiscounts}`);
    console.log(`   - Fixed discounts: ${fixedDiscounts}`);
    console.log(`   - Total promotions: ${savedCount}`);

  } catch (error) {
    console.error('❌ Error seeding promotions:', error);
    throw error;
  }
}

// Run the seeder
seedPromotions()
  .then(() => {
    console.log('\n🎉 Promotion seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Promotion seeding failed:', error);
    process.exit(1);
  });
