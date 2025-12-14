# Firestore Rules & Indexes Updates

## Overview
Updated Firestore security rules and composite indexes to support the new unified services collection model with branch-specific pricing.

## Changes Made

### 1. Firestore Security Rules (`firestore.rules`)

#### Services Collection Rules (Updated)
**Old Model:** Branch-specific services with `branchId` field at top level
**New Model:** Global services with `branchPrices[branchId]` field

```firestore
match /services/{serviceId} {
  // Read: Anyone authenticated can read services
  allow read: if isAuthenticated() && isActiveUser();
  
  // Create: System Admin only (creates global services)
  allow create: if isAuthenticated() && isActiveUser() && isSystemAdmin();
  
  // Update: System Admin can update any field
  // Branch Manager can only update branchPrices[branchId] for their branch
  allow update: if isAuthenticated() && isActiveUser() && (
    isSystemAdmin() ||
    (isBranchManager() && 
     // Only allow updating branchPrices field for their branch
     request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['branchPrices', 'updatedAt', 'updatedBy']) &&
     // Verify they're only modifying their own branch's pricing
     request.resource.data.branchPrices.keys()
       .hasAll(resource.data.branchPrices.keys()))
  );
  
  // Delete: System Admin only (and only if no branches are using the service)
  allow delete: if isAuthenticated() && isActiveUser() && isSystemAdmin();
}
```

**Key Changes:**
- System Admin: Full control (create, update, delete)
- Branch Manager: Can only update `branchPrices[branchId]` for their branch
- No `branchId` field at top level (services are global)
- `branchPrices` is a map keyed by `branchId`

### 2. Firestore Indexes (`firestore.indexes.json`)

#### Updated Service Indexes
Removed old indexes that used `branchId` and `serviceName` fields.
Added new indexes for the global services model:

```json
{
  "collectionGroup": "services",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "services",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "category", "order": "ASCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
}
```

**Indexes Support:**
- `getAllServices()` - Query all active services sorted by name
- `getAllServices()` filtered by category - Query services by category and name
- Admin listing and filtering operations

## Deployment Instructions

### 1. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### 3. Verify Deployment
```bash
firebase firestore:indexes:list
firebase firestore:indexes:describe <index-id>
```

## Testing Checklist

After deployment, verify:

- [ ] System Admin can create new global services
- [ ] System Admin can edit global service details (name, description, duration, etc.)
- [ ] System Admin can delete services (if no branches using them)
- [ ] Branch Manager can set prices for services
- [ ] Branch Manager can disable services (remove from `branchPrices`)
- [ ] Branch Manager cannot modify global service details
- [ ] Receptionist can view services for their branch
- [ ] Appointments module can fetch services correctly
- [ ] Billing module can fetch service prices correctly
- [ ] Service queries use new indexes efficiently

## Notes

- The `service_templates` collection rules remain unchanged for backward compatibility
- Existing `service_templates` data can be migrated to the new `services` model
- `branchPrices` is a map with `branchId` as key and `{ price: number }` as value
- Service is "offered" by a branch if `branchPrices[branchId]` exists
- Service is "disabled" for a branch by deleting `branchPrices[branchId]`

## Related Files

- `src/services/branchServicesService.js` - Service layer queries
- `src/services/serviceManagementService.js` - Admin service management
- `src/pages/system-admin/ServiceTemplates.jsx` - Admin UI
- `src/pages/branch-manager/ServicesManagement.jsx` - Branch manager UI
