# API Integrations in David's Salon Management System

This document lists all APIs and external services used in the project.

---

## 🔥 Firebase Services (Backend as a Service)

### **Firebase Authentication**
- **Service**: Firebase Auth
- **Purpose**: User authentication and authorization
- **Config Location**: `src/config/firebase.js`
- **Environment Variables**:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`

### **Cloud Firestore**
- **Service**: Firestore Database
- **Purpose**: NoSQL database for storing all application data
- **Collections Used**:
  - `users`, `branches`, `appointments`, `transactions`, `inventory`, `products`, `clients`, `schedules`, `promotions`, `deposits`, `stocks`, `purchaseOrders`, `activityLogs`, etc.

### **Firebase Storage**
- **Service**: Firebase Storage
- **Purpose**: File storage (images, documents)
- **Config Location**: `src/config/firebase.js`
- **Environment Variable**: `VITE_FIREBASE_STORAGE_BUCKET`

---

## 🌐 Third-Party External APIs

### **1. OpenAI API**
- **Base URL**: `https://api.openai.com/v1`
- **Service File**: `src/services/openaiService.js`
- **Purpose**: AI-powered business insights and recommendations
- **Endpoints Used**:
  - `/chat/completions` - Generate insights and recommendations
- **Features**:
  - Client analytics insights
  - Product sales insights
  - Promotion recommendations
  - Individual client recommendations
- **Model**: `gpt-4o-mini`
- **Environment Variable**: `VITE_OPENAI_API_KEY`
- **Usage**:
  - Client analytics page
  - Inventory analytics
  - Promotion management

### **2. EmailJS API**
- **Base URL**: `https://api.emailjs.com/api/v1.0/email/send`
- **Service File**: `src/services/emailService.js` (EmailJS class implementation)
- **Purpose**: Email delivery service for client-facing emails
- **Library**: `@emailjs/browser`
- **Configuration**:
  - Service ID: `service_david_devs`
  - Template ID: `template_j6ktzo1`
  - Public Key: Configured via EmailJS dashboard
- **Environment Variables** (Optional):
  - `VITE_EMAILJS_SERVICE_ID`
  - `VITE_EMAILJS_TEMPLATE_ID`
  - `VITE_EMAILJS_PUBLIC_KEY`
- **Email Types**:
  - **Promotion emails to clients** (Primary use)
- **Usage**:
  - Branch Manager → Promotions page
  - Sending promotion notifications to clients
- **Note**: Uses EmailJS client-side SDK for sending emails directly from the browser

### **2b. SendGrid API** (Alternative/Additional Email Service)
- **Base URL**: `https://api.sendgrid.com/v3`
- **Service File**: `src/services/emailService.js`
- **Purpose**: Email delivery service for system emails
- **Endpoints Used**:
  - `/mail/send` - Send transactional emails
- **Environment Variables**:
  - `VITE_SENDGRID_API_KEY`
  - `VITE_SENDGRID_FROM_EMAIL`
- **Email Types**:
  - Welcome emails
  - Purchase order emails to suppliers
  - Account activation/deactivation emails
  - Password reset notifications
  - User creation notifications

### **3. Cloudinary API**
- **Base URL**: `https://api.cloudinary.com/v1_1/{cloudName}/image/upload`
- **Service Files**:
  - `src/services/cloudinaryService.js`
  - `src/services/imageService.js`
- **Purpose**: Cloud-based image upload, storage, and transformation
- **Endpoints Used**:
  - `/image/upload` - Upload images
  - Image transformation URLs for optimized delivery
- **Features**:
  - Image upload with compression
  - Automatic image optimization
  - Image transformations (resize, crop, format conversion)
- **Config**:
  - Cloud Name: `dn0jgdjts`
  - Upload Preset: `daviddevs_images`
- **Environment Variables**:
  - `VITE_CLOUDINARY_CLOUD_NAME`
  - `VITE_CLOUDINARY_UPLOAD_PRESET`
- **Usage**:
  - Product images
  - Receipt images for deposits
  - Profile pictures
  - Service images
  - Portfolio images

### **4. Nager.Date API (Public Holidays)**
- **Base URL**: `https://date.nager.at/api/v3`
- **Service File**: `src/services/holidaysApiService.js`
- **Purpose**: Fetch public holidays for different countries
- **Endpoints Used**:
  - `/PublicHolidays/{year}/{countryCode}` - Get holidays for a year
  - `/AvailableCountries` - Get list of available countries
- **Features**:
  - Free API (no API key required)
  - Supports multiple countries
  - ISO 3166-1 alpha-2 country codes
- **Default Country**: Philippines (PH)
- **Usage**:
  - Calendar management
  - Holiday verification
  - Schedule planning

---

## 📚 JavaScript Libraries (Client-Side)

### **Tesseract.js (OCR)**
- **Type**: JavaScript Library (not a REST API)
- **Service File**: `src/utils/ocrService.js`
- **Purpose**: Optical Character Recognition for extracting text from images
- **Usage**: Extract amounts from receipt images for deposit verification
- **Model**: English language model
- **Features**:
  - Extract text from receipt images
  - Amount extraction with pattern matching
  - Amount validation against expected totals

---

## 🔧 Internal Service APIs (Application Services)

These are internal service abstractions that wrap Firebase and external API calls:

### **1. Appointment API Service**
- **File**: `src/services/appointmentApiService.js`
- **Purpose**: Appointment management operations
- **Operations**: CRUD for appointments

### **2. Transaction API Service**
- **File**: `src/services/transactionApiService.js`
- **Purpose**: Transaction and billing operations
- **Operations**: Sales transactions, payments, reports

### **3. User Service**
- **File**: `src/services/userService.js`
- **Purpose**: User/staff management
- **Operations**: User CRUD, role management

### **4. Branch Service**
- **File**: `src/services/branchService.js`
- **Purpose**: Branch management
- **Operations**: Branch CRUD, branch data retrieval

### **5. Client Service**
- **File**: `src/services/clientService.js`
- **Purpose**: Client management
- **Operations**: Client CRUD, client analytics

### **6. Inventory Service**
- **File**: `src/services/inventoryService.js`
- **Purpose**: Inventory and stock management
- **Operations**: Stock tracking, inventory CRUD

### **7. Product Service**
- **File**: `src/services/productService.js`
- **Purpose**: Product catalog management
- **Operations**: Product CRUD, product data

### **8. Service Service**
- **File**: `src/services/serviceService.js`
- **Purpose**: Salon service management
- **Operations**: Service CRUD, service templates

### **9. Schedule Service**
- **File**: `src/services/scheduleService.js`
- **Purpose**: Staff scheduling
- **Operations**: Schedule CRUD, availability

### **10. Deposit Service**
- **File**: `src/services/depositService.js`
- **Purpose**: Bank deposit management
- **Operations**: Deposit CRUD, receipt management

### **11. Email Service**
- **File**: `src/services/emailService.js`
- **Purpose**: Email notifications
- **Operations**: Send various email types
- **Note**: Uses EmailJS for promotion emails, SendGrid for other system emails

### **12. Cloudinary Service**
- **File**: `src/services/cloudinaryService.js`
- **Purpose**: Image upload and management (wraps Cloudinary API)
- **Operations**: Upload, delete, transform images

### **13. OpenAI Service**
- **File**: `src/services/openaiService.js`
- **Purpose**: AI-powered insights (wraps OpenAI API)
- **Operations**: Generate business insights and recommendations

### **14. Stock Alerts Service**
- **File**: `src/services/stockAlertsService.js`
- **Purpose**: Stock monitoring and alerts
- **Operations**: Alert generation, monitoring

### **15. Stock Listener Service**
- **File**: `src/services/stockListenerService.js`
- **Purpose**: Real-time stock updates
- **Operations**: Real-time stock tracking

### **16. Activity Service**
- **File**: `src/services/activityService.js`
- **Purpose**: Activity logging
- **Operations**: Log system activities

### **17. Promotion Service**
- **File**: `src/services/promotionService.js`
- **Purpose**: Promotion management
- **Operations**: Promotion CRUD

### **18. Loyalty Service**
- **File**: `src/services/loyaltyService.js`
- **Purpose**: Loyalty program management
- **Operations**: Points management, rewards

### **19. Notification Service**
- **File**: `src/services/notificationService.js`
- **Purpose**: Push notifications
- **Operations**: Send notifications

### **20. Leave Management Service**
- **File**: `src/services/leaveManagementService.js`
- **Purpose**: Staff leave management
- **Operations**: Leave requests, approvals

### **21. Branch Calendar Service**
- **File**: `src/services/branchCalendarService.js`
- **Purpose**: Branch calendar operations
- **Operations**: Calendar events, holidays

### **22. Branch Content Service**
- **File**: `src/services/branchContentService.js`
- **Purpose**: Branch content management
- **Operations**: Content CRUD

### **23. Role Password Service**
- **File**: `src/services/rolePasswordService.js`
- **Purpose**: Role-based password management
- **Operations**: Password storage and verification

### **24. Holidays API Service**
- **File**: `src/services/holidaysApiService.js`
- **Purpose**: Public holidays (wraps Nager.Date API)
- **Operations**: Fetch holidays, verify dates

### **25. Billing Service**
- **File**: `src/services/billingService.js`
- **Purpose**: Billing operations
- **Operations**: Invoice generation, billing

### **26. Catalog Service**
- **File**: `src/services/catalogService.js`
- **Purpose**: Product/service catalog
- **Operations**: Catalog management

### **27. Price History Service**
- **File**: `src/services/priceHistoryService.js`
- **Purpose**: Price tracking and history
- **Operations**: Price history, analytics

### **28. Referral Service**
- **File**: `src/services/referralService.js`
- **Purpose**: Referral program management
- **Operations**: Referral tracking

### **29. Feedback Service**
- **File**: `src/services/feedbackService.js`
- **Purpose**: Customer feedback management
- **Operations**: Feedback CRUD

### **30. Arrivals Service**
- **File**: `src/services/arrivalsService.js`
- **Purpose**: Client arrival tracking
- **Operations**: Arrival notifications

### **31. Stylist Lending Service**
- **File**: `src/services/stylistLendingService.js`
- **Purpose**: Stylist lending between branches
- **Operations**: Lending management

### **32. Weekly Stock Recorder**
- **File**: `src/services/weeklyStockRecorder.js`
- **Purpose**: Weekly stock recording
- **Operations**: Stock recording automation

---

## 📊 Summary

### **External APIs: 5**
1. Firebase (Auth, Firestore, Storage)
2. OpenAI API
3. EmailJS API
4. SendGrid API (optional/alternative)
5. Nager.Date API
6. Cloudinary API

### **Client-Side Libraries: 1**
1. Tesseract.js (OCR)

### **Internal Service APIs: 32+**
Multiple service files that abstract Firebase and external API calls

---

## 🔐 Environment Variables Required

```env
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# EmailJS (For Promotion Emails)
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=

# SendGrid (Optional - for system emails)
VITE_SENDGRID_API_KEY=
VITE_SENDGRID_FROM_EMAIL=

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=

# OpenAI (Optional)
VITE_OPENAI_API_KEY=
```

---

## 📝 Notes

- **Firebase** is the primary backend infrastructure
- **External APIs** are used for specific features (AI, emails, images, holidays)
- **Internal Services** provide abstraction layers and business logic
- Most data operations go through Firebase Firestore
- Real-time updates use Firestore listeners
- File uploads use Cloudinary (not Firebase Storage in most cases)

