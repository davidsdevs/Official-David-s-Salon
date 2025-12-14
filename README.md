# David's Salon Management System (DSMS)

A cloud-based multi-branch salon management platform powered by Firebase, React.js, and TailwindCSS.

## 🎯 Project Overview

DSMS is a comprehensive salon management system designed to centralize operations across multiple branches. The system provides role-based access control for different user types including System Admins, Franchise Owners, Branch Managers, Receptionists, Inventory Controllers, Stylists, and Clients.

## 📋 Features

### Phase 1 - User & Role Management (Current)
- ✅ Firebase Authentication
- ✅ Role-based access control
- ✅ User creation and management
- ✅ Protected routing system
- ✅ Responsive layouts for all user roles

### Upcoming Phases
- 📅 Branch Management
- 📅 Appointment Scheduling
- 📅 Billing & Point of Sale
- 📅 Inventory Management
- 📅 CRM Module
- 📅 Reports & Analytics
- 📅 Notifications & Communication

## 🛠️ Technology Stack

- **Frontend**: React.js 18 + Vite
- **Styling**: TailwindCSS 3
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **Database**: Firebase Firestore (NoSQL)
- **Icons**: Lucide React
- **Routing**: React Router DOM 6
- **Notifications**: React Hot Toast

## 📁 Project Structure

```
dsms/
├── src/
│   ├── components/
│   │   ├── layout/         # Header, Sidebar, Footer, ProtectedRoute
│   │   └── ui/             # Reusable UI components (planned)
│   ├── context/            # AuthContext for authentication
│   ├── layouts/            # Role-specific layouts
│   ├── pages/              # Page components for each role
│   ├── routes/             # Route configuration
│   ├── services/           # API services (planned)
│   ├── utils/              # Helper functions and constants
│   ├── config/             # Firebase configuration
│   ├── App.jsx             # Main App component
│   ├── main.jsx            # Entry point
│   └── main.css            # Global styles
├── public/                 # Static assets
├── firebase.json           # Firebase configuration
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── tailwind.config.js      # Tailwind configuration
├── vite.config.js          # Vite configuration
└── package.json            # Dependencies
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase account

### Installation

1. **Clone the repository**
   ```bash
   cd "C:\Users\kcana\OneDrive\Documents\CAPSTONE PROJECT DEVELOPMENT\dsms"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   
   a. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   
   b. Enable Authentication (Email/Password)
   
   c. Create a Firestore database
   
   d. Copy your Firebase configuration
   
   e. Update `.env` file with your Firebase credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **Deploy Firestore rules and indexes**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   firebase deploy --only firestore
   ```

5. **Create initial users in Firebase Console**
   
   Go to Firebase Console > Authentication > Users and create test users:
   - System Admin: `admin@davidsalon.com`
   - Branch Manager: `manager@davidsalon.com`
   - Receptionist: `receptionist@davidsalon.com`
   - etc.

6. **Create user documents in Firestore**
   
   For each user created, add a document in the `users` collection with:
   ```json
   {
     "email": "admin@davidsalon.com",
     "role": "system_admin",
     "displayName": "System Administrator",
     "branchId": null,
     "createdAt": "2024-01-01T00:00:00Z",
     "active": true
   }
   ```

### Running the Application

**Development Mode**
```bash
npm run dev
```
The application will open at `http://localhost:3000`

**Build for Production**
```bash
npm run build
```

**Preview Production Build**
```bash
npm run preview
```

**Firebase Emulators (Local Testing)**
```bash
npm run firebase:emulators
```

**Deploy to Firebase Hosting**
```bash
npm run firebase:deploy
```

## 👥 User Roles & Access

| Role | Access Level | Key Features |
|------|-------------|--------------|
| **System Admin** | Global | Manage users, branches, system settings |
| **Franchise Owner** | Multi-branch | Monitor all branches, view reports |
| **Branch Manager** | Branch-level | Manage staff, appointments, local operations |
| **Receptionist** | Front-desk | Schedule appointments, manage clients, billing |
| **Inventory Controller** | Branch-level | Manage stock, orders, inventory reports |
| **Stylist** | Individual | View schedule, update service status |
| **Client** | Limited | Book appointments, view history, manage profile |

## 🔐 Security

- Firebase Authentication for user management
- Firestore Security Rules for data access control
- Role-based authorization on all routes
- Protected routes with automatic redirection
- Encrypted data storage and transfer

## 📱 Responsive Design

The application is fully responsive and works on:
- 💻 Desktop (1024px+)
- 📱 Tablet (768px - 1023px)
- 📱 Mobile (320px - 767px)

## 🧪 Testing

To be implemented:
- Unit tests with Vitest
- Integration tests
- E2E tests with Playwright

## 📝 Development Guidelines

1. **Code Style**
   - Follow ESLint configuration
   - Use functional components with hooks
   - Keep components small and focused
   - Use TailwindCSS utility classes

2. **Component Structure**
   - One component per file
   - Use meaningful component names
   - Extract reusable components to `components/ui/`
   - Keep business logic in services

3. **State Management**
   - Use Context API for global state
   - Use local state for component-specific data
   - Consider Redux/Zustand for complex state (future)

4. **Git Workflow**
   - Create feature branches from `main`
   - Use descriptive commit messages
   - Submit pull requests for review
   - Keep commits atomic and focused

## 🐛 Known Issues

- CSS linter warnings for TailwindCSS directives (expected behavior)
- Firebase emulators require manual configuration on first run

## 📚 Resources

- [SRS Document](../docs/DSMS_SRS_v1.2_Main.md)
- [Project Plan](../docs/DSMS_Module1_Authentication_and_User_Management_Project_Plan.md)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is proprietary and confidential. All rights reserved.

## 👨‍💻 Development Team

- Project Manager: [Name]
- Technical Lead: [Name]
- Frontend Developer: [Name]
- Backend Developer: [Name]

## 📞 Support

For issues or questions, contact:
- Email: support@davidsalon.com
- Slack: #dsms-dev

---

**Version**: 1.0.0  
**Last Updated**: November 2024  
**Status**: Phase 1 - User & Role Management ✅
