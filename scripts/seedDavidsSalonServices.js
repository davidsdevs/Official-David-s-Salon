/**
 * Seed David's Salon Services
 * Creates service templates and assigns them to Ayala Harbor Point branch
 */

import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';

dotenv.config();

// Firebase config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Updated categories based on David's Salon menu
const CATEGORIES = [
  'Haircut and Blowdry',
  'Hair Coloring',
  'Hair Treatment',
  'Straightening and Perming',
  'Hair and Make Up',
  'Nail Care',
  'Waxing and Threading',
  'Massage'
];

// David's Salon services from menu
const SERVICES = [
  // HAIRCUT AND BLOWDRY
  {
    serviceName: "Cut, Shampoo and Blowdry",
    category: "Haircut and Blowdry",
    price: 450,
    duration: 60,
    description: "Professional haircut with shampoo and blowdry",
    isChemical: false
  },
  {
    serviceName: "Kid's Haircut",
    category: "Haircut and Blowdry",
    price: 300,
    duration: 45,
    description: "Haircut service for children",
    isChemical: false
  },
  {
    serviceName: "Shampoo and Blowdry",
    category: "Haircut and Blowdry",
    price: 300,
    duration: 45,
    description: "Hair wash and styling",
    isChemical: false
  },
  {
    serviceName: "Shampoo + Blowdry (Premium)",
    category: "Haircut and Blowdry",
    price: 1000,
    duration: 60,
    description: "Premium hair wash and styling service",
    isChemical: false
  },

  // HAIR COLORING
  {
    serviceName: "Tint",
    category: "Hair Coloring",
    price: 2600,
    duration: 120,
    description: "Full hair color tint service",
    isChemical: true
  },
  {
    serviceName: "Tint (Ammonia Free)",
    category: "Hair Coloring",
    price: 2600,
    duration: 120,
    description: "Ammonia-free hair color tint",
    isChemical: true
  },
  {
    serviceName: "Highlights Cap",
    category: "Hair Coloring",
    price: 2600,
    duration: 150,
    description: "Hair highlights using cap technique",
    isChemical: true
  },
  {
    serviceName: "Highlights Foil",
    category: "Hair Coloring",
    price: 2600,
    duration: 180,
    description: "Hair highlights using foil technique",
    isChemical: true
  },
  {
    serviceName: "Special Conditioning",
    category: "Hair Coloring",
    price: 2200,
    duration: 90,
    description: "Deep conditioning treatment for colored hair",
    isChemical: true
  },
  {
    serviceName: "Balayage",
    category: "Hair Coloring",
    price: 6000,
    duration: 240,
    description: "Hand-painted highlights for natural look",
    isChemical: true
  },

  // HAIR TREATMENT
  {
    serviceName: "Protein Treatment",
    category: "Hair Treatment",
    price: 800,
    duration: 60,
    description: "Strengthening protein treatment",
    isChemical: false
  },
  {
    serviceName: "Moroccan Treatment",
    category: "Hair Treatment",
    price: 1200,
    duration: 90,
    description: "Argan oil-based hair treatment",
    isChemical: false
  },
  {
    serviceName: "Plarma Full Head",
    category: "Hair Treatment",
    price: 1400,
    duration: 120,
    description: "Full head plasma treatment",
    isChemical: false
  },
  {
    serviceName: "Plarma",
    category: "Hair Treatment",
    price: 1800,
    duration: 90,
    description: "Plasma hair treatment",
    isChemical: false
  },
  {
    serviceName: "Q1 Luster",
    category: "Hair Treatment",
    price: 1800,
    duration: 90,
    description: "Shine-enhancing treatment",
    isChemical: false
  },
  {
    serviceName: "Foliage Booster",
    category: "Hair Treatment",
    price: 2400,
    duration: 120,
    description: "Hair volume and strength booster",
    isChemical: false
  },
  {
    serviceName: "D2 Treatment",
    category: "Hair Treatment",
    price: 2400,
    duration: 120,
    description: "Deep repair treatment",
    isChemical: false
  },
  {
    serviceName: "Tailoring",
    category: "Hair Treatment",
    price: 3500,
    duration: 150,
    description: "Customized hair treatment",
    isChemical: false
  },

  // STRAIGHTENING & PERMING
  {
    serviceName: "Perm",
    category: "Straightening and Perming",
    price: 3000,
    duration: 180,
    description: "Classic hair perm",
    isChemical: true
  },
  {
    serviceName: "Digital Perm",
    category: "Straightening and Perming",
    price: 6000,
    duration: 240,
    description: "Heat-assisted perm for long-lasting curls",
    isChemical: true
  },
  {
    serviceName: "Relaxing",
    category: "Straightening and Perming",
    price: 3800,
    duration: 180,
    description: "Hair relaxing treatment",
    isChemical: true
  },
  {
    serviceName: "Rebonding",
    category: "Straightening and Perming",
    price: 6000,
    duration: 240,
    description: "Hair straightening rebonding",
    isChemical: true
  },
  {
    serviceName: "Keratin Treatment",
    category: "Straightening and Perming",
    price: 3300,
    duration: 180,
    description: "Keratin-based smoothing treatment",
    isChemical: true
  },
  {
    serviceName: "Foliage",
    category: "Straightening and Perming",
    price: 3300,
    duration: 180,
    description: "Hair smoothing and strengthening",
    isChemical: true
  },
  {
    serviceName: "Kerateraphy",
    category: "Straightening and Perming",
    price: 5800,
    duration: 210,
    description: "Advanced keratin therapy",
    isChemical: true
  },

  // HAIR & MAKE UP
  {
    serviceName: "Hair & Make Up",
    category: "Hair and Make Up",
    price: 1700,
    duration: 90,
    description: "Complete hair styling and makeup",
    isChemical: false
  },
  {
    serviceName: "Hair Setting (Basic)",
    category: "Hair and Make Up",
    price: 850,
    duration: 45,
    description: "Basic hair styling and setting",
    isChemical: false
  },
  {
    serviceName: "Hair Setting (Premium)",
    category: "Hair and Make Up",
    price: 1200,
    duration: 60,
    description: "Premium hair styling and setting",
    isChemical: false
  },

  // NAIL CARE
  {
    serviceName: "Manicure",
    category: "Nail Care",
    price: 300,
    duration: 45,
    description: "Hand and nail care service",
    isChemical: false
  },
  {
    serviceName: "Pedicure",
    category: "Nail Care",
    price: 350,
    duration: 60,
    description: "Foot and nail care service",
    isChemical: false
  },
  {
    serviceName: "Nail Extension",
    category: "Nail Care",
    price: 1500,
    duration: 90,
    description: "Artificial nail extension application",
    isChemical: false
  },
  {
    serviceName: "Footspa",
    category: "Nail Care",
    price: 450,
    duration: 45,
    description: "Relaxing foot spa treatment",
    isChemical: false
  },
  {
    serviceName: "Gel FX",
    category: "Nail Care",
    price: 600,
    duration: 60,
    description: "Gel nail polish application",
    isChemical: false
  },
  {
    serviceName: "Change Polish",
    category: "Nail Care",
    price: 300,
    duration: 30,
    description: "Nail polish change service",
    isChemical: false
  },

  // WAXING AND THREADING
  {
    serviceName: "Threading",
    category: "Waxing and Threading",
    price: 300,
    duration: 30,
    description: "Facial hair removal using thread",
    isChemical: false
  },
  {
    serviceName: "Upper/Lower Lip Threading",
    category: "Waxing and Threading",
    price: 150,
    duration: 15,
    description: "Lip hair removal",
    isChemical: false
  },
  {
    serviceName: "Eyebrow Shape",
    category: "Waxing and Threading",
    price: 250,
    duration: 20,
    description: "Eyebrow shaping service",
    isChemical: false
  },
  {
    serviceName: "Underarm Waxing",
    category: "Waxing and Threading",
    price: 400,
    duration: 30,
    description: "Underarm hair removal",
    isChemical: false
  },
  {
    serviceName: "Half Leg Waxing",
    category: "Waxing and Threading",
    price: 600,
    duration: 45,
    description: "Half leg hair removal",
    isChemical: false
  },
  {
    serviceName: "Full Leg Waxing",
    category: "Waxing and Threading",
    price: 850,
    duration: 60,
    description: "Full leg hair removal",
    isChemical: false
  },

  // MASSAGE
  {
    serviceName: "Foot Massage",
    category: "Massage",
    price: 400,
    duration: 30,
    description: "Relaxing foot massage",
    isChemical: false
  },
  {
    serviceName: "Head Massage",
    category: "Massage",
    price: 400,
    duration: 30,
    description: "Relaxing head and scalp massage",
    isChemical: false
  }
];

async function seedServices() {
  try {
    console.log('🌱 Starting David\'s Salon services seeding...\n');

    // Step 1: Clear existing service templates
    console.log('📋 Clearing existing services...');
    const servicesRef = collection(db, 'services');
    const servicesSnapshot = await getDocs(servicesRef);
    
    if (!servicesSnapshot.empty) {
      const batch = writeBatch(db);
      servicesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${servicesSnapshot.size} existing services\n`);
    } else {
      console.log('✅ No existing services to delete\n');
    }

    // Step 2: Create global services (no branchId)
    console.log('🎨 Creating global services...');
    let createdCount = 0;
    
    for (const service of SERVICES) {
      const serviceData = {
        name: service.serviceName,
        description: service.description,
        category: service.category,
        duration: service.duration,
        price: service.price,
        isChemical: service.isChemical,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'services'), serviceData);
      createdCount++;
      console.log(`  ✅ Created: ${service.serviceName} (${service.category})`);
    }
    console.log(`\n✅ Created ${createdCount} global services\n`);

    // Step 3: Summary
    console.log('📊 SEEDING SUMMARY:');
    console.log('═══════════════════════════════════════');
    console.log(`Global Services: ${createdCount}`);
    console.log('\n🎉 David\'s Salon services seeding completed successfully!');
    
    // Category breakdown
    console.log('\n📂 Services by Category:');
    CATEGORIES.forEach(category => {
      const count = SERVICES.filter(s => s.category === category).length;
      console.log(`  ${category}: ${count} services`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    process.exit(1);
  }
}

seedServices();
