# Branch Pricing Structure - Updated

## Overview
The DSMS services collection uses a **simplified branch pricing structure** where each service document stores branch-specific pricing in a single `branchPricing` map.

---

## 🗂️ Database Structure

### Collection: `services`
**Purpose:** Global services with branch-specific pricing

```javascript
services/{serviceId}
{
  // Service identification
  serviceId: "service_abc123",
  templateId: "haircut_basic",  // Optional: Links to template if created from one
  
  // Service information (global)
  name: "Basic Haircut",
  serviceName: "Basic Haircut",  // Alias for compatibility
  description: "Standard haircut service",
  category: "Hair Services",
  duration: 30,  // Default duration in minutes
  imageURL: "",  // Optional service image
  isChemical: false,  // Flag for chemical services
  isActive: true,  // Global active status
  
  // BRANCH-SPECIFIC PRICING (key feature)
  branchPricing: {
    "branch_makati": 200,          // Makati branch: ₱200
    "branch_qc": 150,              // QC branch: ₱150
    "XFL1DUK3fe3JrhygLYUv": 600    // Another branch: ₱600
  },
  
  // Metadata
  createdAt: Timestamp,
  createdBy: "uid",
  updatedAt: Timestamp,
  updatedBy: "uid"
}
```

---

## 🔑 Key Features

### 1. Single Service Document
- **One document** per service across all branches
- No duplicate service documents per branch
- Easier to maintain and update

### 2. Direct Price Values
- Structure: `{ branchId: price }` (direct number/string value)
- NOT: `{ branchId: { price: value } }` (nested object)
- Simpler to read and write

### 3. Branch Availability
- Service is **offered by a branch** if `branchPricing[branchId]` exists
- Service is **not offered** if `branchPricing[branchId]` is undefined
- Branch stops offering service by deleting the entry

---

## 📝 Example Data

```javascript
// Example: Hair Services with different branch pricing
{
  serviceId: "haircut_001",
  name: "Premium Haircut",
  category: "Hair Services",
  duration: 45,
  isActive: true,
  branchPricing: {
    "branch_makati": 350,     // Premium location: higher price
    "branch_qc": 250,         // Standard location
    "branch_manila": 300      // Mid-range location
  }
}

// Example: Service offered by only one branch
{
  serviceId: "luxury_facial_001",
  name: "Luxury Facial Treatment",
  category: "Facial Services",
  duration: 90,
  isActive: true,
  branchPricing: {
    "branch_makati": 1500     // Only Makati branch offers this
  }
}

// Example: New service not yet offered by any branch
{
  serviceId: "new_service_001",
  name: "New Service",
  category: "Treatments",
  duration: 60,
  isActive: true,
  branchPricing: {}           // Empty: no branches offer this yet
}
```

---

## 🔄 How It Works

### 1. System Admin Creates Global Service
```javascript
// System Admin creates the service (no pricing yet)
{
  name: "Basic Haircut",
  category: "Hair Services",
  duration: 30,
  isActive: true,
  branchPricing: {}  // Empty initially
}
```

### 2. Branch Manager Sets Price
```javascript
// Makati branch manager sets their price
await setBranchPrice("service_001", "branch_makati", 200, currentUser);

// Result:
{
  name: "Basic Haircut",
  branchPricing: {
    "branch_makati": 200
  }
}
```

### 3. Multiple Branches Set Prices
```javascript
// QC branch manager sets their price
await setBranchPrice("service_001", "branch_qc", 150, currentUser);

// Result:
{
  name: "Basic Haircut",
  branchPricing: {
    "branch_makati": 200,
    "branch_qc": 150
  }
}
```

### 4. Branch Stops Offering Service
```javascript
// Makati branch disables the service
await disableBranchService("service_001", "branch_makati", currentUser);

// Result:
{
  name: "Basic Haircut",
  branchPricing: {
    "branch_qc": 150  // Makati removed
  }
}
```

---

## 🛠️ API Functions

### Get Services for a Branch
```javascript
import { getBranchServices } from './services/branchServicesService';

// Get all services offered by Makati branch
const services = await getBranchServices('branch_makati');

// Returns:
[
  {
    id: "service_001",
    name: "Basic Haircut",
    category: "Hair Services",
    price: 200,  // ← Extracted from branchPricing.branch_makati
    duration: 30,
    branchPricing: { "branch_makati": 200, "branch_qc": 150 }
  },
  // ... more services
]
```

### Get All Services with Branch Config
```javascript
import { getAllServicesWithBranchConfig } from './services/branchServicesService';

// Get all services with Makati branch config
const services = await getAllServicesWithBranchConfig('branch_makati');

// Returns:
[
  {
    id: "service_001",
    name: "Basic Haircut",
    price: 200,              // ← Has price = offered
    isOfferedByBranch: true  // ← Flag for UI
  },
  {
    id: "service_002",
    name: "Hair Coloring",
    price: null,              // ← No price = not offered
    isOfferedByBranch: false  // ← Flag for UI
  }
]
```

### Set Branch Price
```javascript
import { setBranchPrice } from './services/branchServicesService';

// Set price for a branch
await setBranchPrice(
  'service_001',        // serviceId
  'branch_makati',      // branchId
  200,                  // price (direct value)
  currentUser           // user object
);
```

### Disable Service for Branch
```javascript
import { disableBranchService } from './services/branchServicesService';

// Remove service from branch
await disableBranchService(
  'service_001',        // serviceId
  'branch_makati',      // branchId
  currentUser           // user object
);
```

---

## 🔐 Firestore Security Rules

```javascript
match /services/{serviceId} {
  // Read: Anyone authenticated can read services
  allow read: if isAuthenticated() && isActiveUser();
  
  // Create: System Admin only (creates global services)
  allow create: if isSystemAdmin();
  
  // Update: System Admin can update any field
  // Branch Manager can only update branchPricing for their branch
  allow update: if isSystemAdmin() ||
    (isBranchManager() && 
     request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['branchPricing', 'updatedAt', 'updatedBy']));
  
  // Delete: System Admin only
  allow delete: if isSystemAdmin();
}
```

---

## 📊 Firestore Indexes

```json
{
  "collectionGroup": "services",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
}
```

---

## ✅ Benefits

### 1. Simplified Structure
- Direct price values instead of nested objects
- Easier to read and write
- Less code complexity

### 2. Flexible Pricing
- Each branch sets own pricing
- Same service, different prices
- Branch-specific availability

### 3. Efficient Queries
- Single query to get all services
- Filter client-side for branch-specific services
- No need for complex Firestore queries

### 4. Easy Maintenance
- Update service info once (global)
- Branch pricing managed independently
- Clear separation of concerns

---

## 🧪 Migration Notes

### Old Structure (deprecated)
```javascript
// OLD: Nested object with price property
branchPrices: {
  "branch_makati": { price: 200 }
}
```

### New Structure (current)
```javascript
// NEW: Direct price value
branchPricing: {
  "branch_makati": 200
}
```

### Changes Made
1. Renamed field: `branchPrices` → `branchPricing`
2. Simplified value: `{ price: value }` → `value`
3. Updated all service functions
4. Updated Firestore rules
5. Updated documentation

---

## 📁 Updated Files

### Service Layer
- ✅ `src/services/branchServicesService.js`
  - `getBranchServices(branchId)`
  - `getAllServicesWithBranchConfig(branchId)`
  - `setBranchPrice(serviceId, branchId, price, user)`
  - `disableBranchService(serviceId, branchId, user)`

- ✅ `src/services/serviceManagementService.js`
  - `saveService(serviceData, user)` - initializes empty branchPricing
  - `deleteService(serviceId, user)` - checks branchPricing before delete

### Database Configuration
- ✅ `firestore.rules` - Updated to use `branchPricing`
- ✅ `firestore.indexes.json` - Already correct

### Documentation
- ✅ `docs/SERVICE_TEMPLATES.md` - Updated structure examples
- ✅ `docs/BRANCH_PRICING_STRUCTURE.md` - This document (NEW)

---

## 🎯 Usage Examples

### For System Admins
```javascript
// Create a new global service
import { saveService } from './services/serviceManagementService';

await saveService({
  name: "Basic Haircut",
  category: "Hair Services",
  duration: 30,
  description: "Standard haircut service",
  isActive: true
  // No pricing - branches will set their own
}, currentUser);
```

### For Branch Managers
```javascript
// Set price for your branch
import { setBranchPrice } from './services/branchServicesService';

await setBranchPrice(
  serviceId,
  userBranchId,
  200,  // Your branch's price
  currentUser
);
```

### For Client Booking
```javascript
// Get services available at selected branch
import { getBranchServices } from './services/branchServicesService';

const branchServices = await getBranchServices(selectedBranchId);

// Display services with prices
branchServices.forEach(service => {
  console.log(`${service.name} - ₱${service.price}`);
});
```

---

**Last Updated:** November 14, 2024  
**Version:** 2.0 (Simplified Structure)  
**Status:** ✅ Implemented and Tested

