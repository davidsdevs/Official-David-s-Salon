# Commission Calculation - CORRECTED

## The Issue
The commission pages were using hardcoded default percentages (60% for services, 10% for products) instead of using the actual `commissionPercentage` stored in the service/product definition.

## The Fix
Updated both Branch Manager and Stylist commission pages to:
1. Use the `commissionPercentage` from the transaction item (which comes from the service/product definition)
2. Remove hardcoded defaults
3. Log warnings when `commissionPercentage` is missing (0 or undefined)

## How Commission is Now Calculated

### For Services:

```javascript
// 1. Get service price and quantity
const quantity = item.quantity || 1;
const itemPrice = item.price || 0;
const lineTotal = itemPrice * quantity;

// 2. Calculate commission
let commissionPoints;

// Option A: If commissionPoints is already calculated and stored
if (item.commissionPoints != null && item.commissionPoints > 0) {
  commissionPoints = item.commissionPoints;
} 
// Option B: Calculate from the service's commission percentage
else {
  const commissionPercent = item.commissionPercentage || 0; // NO DEFAULT!
  commissionPoints = (lineTotal * commissionPercent) / 100;
}
```

**Example:**
- Service: "D2 Treatment" = ₱4,000
- Commission Percentage: 5% (from service definition)
- Commission = ₱4,000 × 5% = ₱200 ✓

**NOT:**
- ~~Commission = ₱4,000 × 60% = ₱2,400~~ ✗ (old incorrect calculation)

### For Products:

```javascript
// 1. Get product price and quantity
const quantity = item.quantity || 1;
const itemPrice = item.price || 0;
const lineTotal = itemPrice * quantity;

// 2. Calculate commission
let commissionPoints;

// Option A: If commissionPoints is already calculated and stored
if (item.commissionPoints != null && item.commissionPoints > 0) {
  commissionPoints = item.commissionPoints;
} 
// Option B: Calculate from the product's commission percentage
else {
  const commissionPercent = item.commissionPercentage || 0; // NO DEFAULT!
  commissionPoints = (lineTotal * commissionPercent) / 100;
}
```

**Example:**
- Product: "Hair Serum" = ₱500
- Commission Percentage: 15% (from product definition)
- Commission = ₱500 × 15% = ₱75 ✓

## Where Commission Percentage Comes From

### Service Definition (Firestore):
```javascript
{
  name: "Special Conditioning",
  category: "Hair Coloring",
  commissionPercentage: 5,  // ← This is used!
  branchPricing: {
    "2jcrfvY7pxnMdsc1qbC4": 5000
  },
  // ... other fields
}
```

### Transaction Item (when service is added):
```javascript
{
  type: "service",
  name: "Special Conditioning",
  price: 5000,
  quantity: 1,
  commissionPercentage: 5,  // ← Copied from service definition
  stylistId: "stylist123",
  stylistName: "Claire Jessica Cruz",
  // Commission is calculated: 5000 × 5% = 250
}
```

## Files Updated

1. **`src/pages/branch-manager/Commissions.jsx`**
   - Removed default 60% for services
   - Removed default 10% for products
   - Added warning logs for missing commissionPercentage

2. **`src/pages/stylist/Commission.jsx`**
   - Removed default 60% for services
   - Removed default 10% for products
   - Added warning logs for missing commissionPercentage

## Expected Behavior

### If commissionPercentage is properly set:
- ✓ Commission calculated correctly using the service/product's percentage
- ✓ Branch Manager and Stylist pages show matching totals

### If commissionPercentage is missing (0 or undefined):
- ⚠️ Warning logged to console
- Commission calculated as ₱0
- This indicates a data issue that needs to be fixed

## Verification

To verify the fix is working:

1. Check browser console for any warnings about missing commissionPercentage
2. Compare commission totals between Branch Manager and Stylist pages - they should match
3. Verify individual service commissions match their defined percentages

Example:
- Service: "D2 Treatment" with 5% commission on ₱4,000 = ₱200
- Service: "Balayage" with 8% commission on ₱2,500 = ₱200
- Service: "Haircut" with 10% commission on ₱500 = ₱50
- Total Commission: ₱450

## Important Notes

1. **No more defaults**: The system will NOT assume 60% or 10% anymore
2. **Data integrity**: All services and products MUST have commissionPercentage set
3. **Backward compatibility**: Old transactions without commissionPercentage will show ₱0 commission
4. **Commission tracking**: The billing system already saves commissionPercentage correctly for new transactions
