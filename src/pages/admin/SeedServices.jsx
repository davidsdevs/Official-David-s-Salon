/**
 * Service Seeding Page - Admin Only
 * Seeds David's Salon services to database
 */

import { useState } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const BRANCH_ID = 'XFL1DUK3fe3JrhygLYUv'; // Ayala Mall Harbor Point

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

const SeedServices = () => {
  const [seeding, setSeeding] = useState(false);
  const [progress, setProgress] = useState('');
  const [completed, setCompleted] = useState(false);

  const seedServices = async () => {
    try {
      setSeeding(true);
      setCompleted(false);
      setProgress('Starting service seeding...');

      // Step 1: Clear existing service templates
      setProgress('Clearing existing service templates...');
      const templatesRef = collection(db, 'service_templates');
      const templatesSnapshot = await getDocs(templatesRef);
      
      if (!templatesSnapshot.empty) {
        const batch = writeBatch(db);
        templatesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        setProgress(`Deleted ${templatesSnapshot.size} existing templates`);
      }

      // Step 2: Clear existing services for the branch
      setProgress('Clearing existing branch services...');
      const servicesRef = collection(db, 'services');
      const branchServicesQuery = query(servicesRef, where('branchId', '==', BRANCH_ID));
      const branchServicesSnapshot = await getDocs(branchServicesQuery);
      
      if (!branchServicesSnapshot.empty) {
        const batch = writeBatch(db);
        branchServicesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        setProgress(`Deleted ${branchServicesSnapshot.size} existing branch services`);
      }

      // Step 3: Create service templates
      setProgress('Creating service templates...');
      const templateIds = {};
      
      for (let i = 0; i < SERVICES.length; i++) {
        const service = SERVICES[i];
        const templateData = {
          ...service,
          enabled: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'service_templates'), templateData);
        templateIds[service.serviceName] = docRef.id;
        setProgress(`Created template ${i + 1}/${SERVICES.length}: ${service.serviceName}`);
      }

      // Step 4: Assign services to branch
      setProgress('Assigning services to Ayala Harbor Point branch...');
      
      for (let i = 0; i < SERVICES.length; i++) {
        const service = SERVICES[i];
        const serviceData = {
          ...service,
          branchId: BRANCH_ID,
          templateId: templateIds[service.serviceName],
          enabled: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'services'), serviceData);
        setProgress(`Assigned service ${i + 1}/${SERVICES.length}: ${service.serviceName}`);
      }

      setProgress(`✅ Successfully seeded ${SERVICES.length} services!`);
      setCompleted(true);
      toast.success('Services seeded successfully!');
    } catch (error) {
      console.error('Error seeding services:', error);
      setProgress(`❌ Error: ${error.message}`);
      toast.error('Failed to seed services');
    } finally {
      setSeeding(false);
    }
  };

  const categories = [...new Set(SERVICES.map(s => s.category))];
  const categoryCounts = categories.map(cat => ({
    category: cat,
    count: SERVICES.filter(s => s.category === cat).length
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Seed David's Salon Services
          </h1>
          <p className="text-gray-600">
            This will seed {SERVICES.length} services across {categories.length} categories to Ayala Harbor Point branch.
          </p>
        </div>

        {/* Service Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Services by Category</h2>
          <div className="grid grid-cols-2 gap-4">
            {categoryCounts.map(({ category, count }) => (
              <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{category}</span>
                <span className="text-sm font-bold text-primary-600">{count} services</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seed Button */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <button
            onClick={seedServices}
            disabled={seeding}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {seeding ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Seeding Services...
              </>
            ) : completed ? (
              <>
                <Check className="w-5 h-5" />
                Seed Completed
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Start Seeding
              </>
            )}
          </button>
        </div>

        {/* Progress */}
        {progress && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-3">
              {completed ? (
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : seeding ? (
                <RefreshCw className="w-5 h-5 text-primary-600 animate-spin flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Progress</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{progress}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeedServices;
