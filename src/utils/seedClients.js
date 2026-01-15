import { collection, doc, getDocs, query, setDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { firebaseConfig } from '../config/firebase';
import { hashPassword } from '../services/rolePasswordService';

const USERS_COLLECTION = 'users';

const CLIENT_USERS = [
  { firstName: 'Kyle', middleName: 'Andrei', lastName: 'Santos' },
  { firstName: 'Jasmine', middleName: 'Mae', lastName: 'Reyes' },
  { firstName: 'Mikaela', middleName: 'Joy', lastName: 'Dela Cruz' },
  { firstName: 'Enzo', middleName: 'Gabriel', lastName: 'Garcia' },
  { firstName: 'Andrea', middleName: 'Nicole', lastName: 'Mendoza' },
  { firstName: 'Joshua', middleName: 'Paolo', lastName: 'Ramos' },
  { firstName: 'Danica', middleName: 'Claire', lastName: 'Bautista' },
  { firstName: 'Francis', middleName: 'Miguel', lastName: 'Navarro' },
  { firstName: 'Bianca', middleName: 'Isabel', lastName: 'Flores' },
  { firstName: 'Gab', middleName: 'Luis', lastName: 'Castillo' },
  { firstName: 'Trisha', middleName: 'Anne', lastName: 'Villanueva' },
  { firstName: 'Kenji', middleName: 'Rafael', lastName: 'Lim' },
  { firstName: 'Alyssa', middleName: 'Marie', lastName: 'Cruz' },
  { firstName: 'Ethan', middleName: 'James', lastName: 'Torres' },
  { firstName: 'Katrina', middleName: 'Faith', lastName: 'Domingo' },
  { firstName: 'Jerome', middleName: 'Benedict', lastName: 'Pascual' },
  { firstName: 'Sofia', middleName: 'Bea', lastName: 'Aquino' },
  { firstName: 'Lance', middleName: 'Matthew', lastName: 'Valdez' },
  { firstName: 'Patricia', middleName: 'Gwen', lastName: 'Salazar' },
  { firstName: 'Nathan', middleName: 'Cole', lastName: 'Tan' },
  { firstName: 'Kyla', middleName: 'Rose', lastName: 'Morales' },
  { firstName: 'Marco', middleName: 'Antonio', lastName: 'Rivera' },
  { firstName: 'Hazel', middleName: 'Louise', lastName: 'Hernandez' },
  { firstName: 'Cj', middleName: 'Noel', lastName: 'Gonzales' },
  { firstName: 'Rica', middleName: 'Elaine', lastName: 'Delos Santos' },
  { firstName: 'Sean', middleName: 'Patrick', lastName: 'Ramirez' },
  { firstName: 'Nadine', middleName: 'Grace', lastName: 'Sy' },
  { firstName: 'Adrian', middleName: 'Jose', lastName: 'Alvarez' },
  { firstName: 'Janelle', middleName: 'Kristine', lastName: 'Chua' },
  { firstName: 'Bryan', middleName: 'Rey', lastName: 'Diaz' }
];

const toEmailSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '.')
  .replace(/[^a-z0-9.]/g, '');

const randomPhilippineMobile = () => {
  const suffix = Math.floor(Math.random() * 900000000) + 100000000;
  return `09${suffix}`;
};

export const seedClients = async (options = {}) => {
  const {
    password = 'Client123!',
    emailDomain = 'gmail.com',
    createdBy = 'seed'
  } = options;

  const usersRef = collection(db, USERS_COLLECTION);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < CLIENT_USERS.length; i++) {
    const client = CLIENT_USERS[i];

    const base = `${toEmailSlug(client.firstName)}.${toEmailSlug(client.lastName)}`;
    const email = `${base}${String(i + 1).padStart(2, '0')}@${emailDomain}`;

    const existingQuery = query(usersRef, where('email', '==', email));
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      skipped++;
      continue;
    }

    const userId = doc(usersRef).id;
    const now = Timestamp.now();
    const hashedClientPassword = await hashPassword(password);

    const userDocData = {
      email,
      firstName: client.firstName,
      middleName: client.middleName || '',
      lastName: client.lastName,
      phone: '',
      phoneNumber: randomPhilippineMobile(),
      roles: ['client'],
      role: 'client',
      branchId: null,
      isActive: true,
      isGuest: false,
      rolePasswords: {
        client: hashedClientPassword
      },
      createdAt: now,
      updatedAt: now,
      createdBy
    };

    await setDoc(doc(db, USERS_COLLECTION, userId), userDocData);
    created++;
  }

  return { created, skipped, total: CLIENT_USERS.length, password, projectId: firebaseConfig.projectId };
};
