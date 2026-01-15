# Branch Pricing Field Migration Guide

## Problem
Services are showing "Not set" for branch prices even though prices exist in Firestore. This is because the field name was changed from `branchPrices` (old) to `branchPricing` (new).

### Old Format (branchPrices)
```javascript
{
  branchPrices: {
    "branch_id_123": {
      price: 1900
    }
  }
}
```

### New Format (branchPricing)
```javascript
{
  branchPricing: {
    "branch_id_123": 1900  // Direct value, not nested object
  }
}
```

## Solution

Run the migration script to convert all services from the old format to the new format.

### Step 1: Run the Migration Script

```bash
node migrate_branchPrices_to_branchPricing.js
```

### Step 2: Verify the Migration

The script will:
1. Check all services in the `services` collection
2. Convert `branchPrices` to `branchPricing` format
3. Remove the old `branchPrices` field
4. Show a summary of migrated services

### Expected Output

```
🔄 Starting migration: branchPrices → branchPricing
================================================

📊 Found 50 services to check

📋 Checking: D2 Treatment (service_001)
   ✓ Has old branchPrices field
   → Converting branch_123: { price: 1900 } → 1900
   ✅ Migrated successfully
   📝 New branchPricing: { branch_123: 1900 }

...

================================================
✅ Migration Complete!
================================================
📊 Summary:
   - Total services: 50
   - Migrated: 30
   - Skipped: 20
   - Errors: 0
================================================

🎉 All services migrated successfully!
```

## Alternative: Manual Fix in Firestore Console

If you prefer to fix it manually for a single service:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to Firestore Database
3. Find the `services` collection
4. Find the service (e.g., "D2 Treatment")
5. Look for the `branchPrices` field
6. If it exists with format: `{ "branchId": { price: 1900 } }`
7. Add a new field `branchPricing` with format: `{ "branchId": 1900 }`
8. Delete the old `branchPrices` field

### Example Manual Fix

**Before:**
```
services/service_001
  name: "D2 Treatment"
  branchPrices: {
    "2jcrfvY7pxnMdsc1qbC4": {
      price: 1900
    }
  }
```

**After:**
```
services/service_001
  name: "D2 Treatment"
  branchPricing: {
    "2jcrfvY7pxnMdsc1qbC4": 1900
  }
```

## Verification

After running the migration:

1. Go to Branch Manager → Services Management
2. Check if the service now shows the price (₱1,900)
3. The status should change from "Available" to "Offered"
4. You should be able to edit the price

## Why This Happened

The field name was changed as part of a system-wide update to simplify the data structure:
- **Old**: Nested object with `price` property
- **New**: Direct numeric value

This change makes the code simpler and more efficient, but requires a one-time migration of existing data.

## Related Files

- `src/services/branchServicesService.js` - Uses `branchPricing` field
- `src/pages/branch-manager/ServicesManagement.jsx` - Displays branch prices
- `docs/BRANCH_PRICING_STRUCTURE.md` - Documentation on pricing structure
- `FIRESTORE_UPDATES.md` - Details on the field name change

## Troubleshooting

### Service still shows "Not set" after migration

1. **Check Firestore Console**
   - Verify the `branchPricing` field exists
   - Verify your branch ID is in the `branchPricing` object
   - Verify the value is a number, not an object

2. **Check Browser Console**
   - Look for any errors when loading services
   - Check if the service data includes `isOfferedByBranch: true`

3. **Refresh the Page**
   - Clear browser cache
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Migration script fails

1. **Check Firebase credentials**
   - Verify the `firebaseConfig` in the script matches your `.env` file

2. **Check Firestore permissions**
   - Ensure you have write access to the `services` collection

3. **Check Node.js version**
   - Requires Node.js v14 or higher
   - Run `node --version` to check

## Support

If you continue to have issues after running the migration:
1. Check the console logs for specific error messages
2. Verify the service document structure in Firestore
3. Ensure your branch ID matches the one in the service's `branchPricing` field
