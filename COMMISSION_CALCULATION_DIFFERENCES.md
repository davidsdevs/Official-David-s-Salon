# Product vs Service Commission Calculation

## Status: ✅ VERIFIED - Already Implemented Correctly

## Overview
Product commissions and service commissions are calculated differently in the system. This document clarifies the distinction.

---

## Commission Formulas

### Product Commission
```javascript
commissionPoints = (unitCost × quantity) × (commissionPercentage / 100)
```

**Based on**: `unitCost` (the cost of the product to the salon)

**Why**: Product commissions are based on the cost because the salon wants to incentivize selling products based on their actual cost, not the markup.

**Example**:
- Product: "Wella Color Touch Semi-Permanent"
- Unit Cost: ₱520
- Quantity: 2
- Commission %: 12%
- **Commission**: (₱520 × 2) × 0.12 = ₱124.80

---

### Service Commission
```javascript
commissionPoints = servicePrice × (commissionPercentage / 100)
```

**Based on**: `price` (the selling price of the service to the customer)

**Why**: Service commissions are based on the selling price because stylists earn commission on the revenue they generate for the salon.

**Example**:
- Service: "Special Conditioning"
- Price: ₱5,000
- Commission %: 5%
- **Commission**: ₱5,000 × 0.05 = ₱250

---

## Implementation Details

### File: `src/components/billing/BillingModalPOS.jsx`

#### 1. When Commissioner is Selected (lines 1691-1702)

```javascript
if (updatedItems[index].type === 'product') {
  // Product commission: (unitCost * quantity) * (commissionPercentage / 100)
  const unitCost = Number(updatedItems[index].unitCost) || 0;
  const quantity = Number(updatedItems[index].quantity) || 1;
  const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
  updatedItems[index].commissionPoints = (unitCost * quantity) * (commissionPercentage / 100);
} else if (updatedItems[index].type === 'service') {
  // Service commission: price * (commissionPercentage / 100)
  const servicePrice = Number(updatedItems[index].price) || 0;
  const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
  updatedItems[index].commissionPoints = servicePrice * (commissionPercentage / 100);
}
```

#### 2. When Quantity Changes (lines 1595-1599)

**Product**:
```javascript
if (updatedItems[index].commissionerId && updatedItems[index].unitCost && updatedItems[index].commissionPercentage) {
  const unitCost = Number(updatedItems[index].unitCost) || 0;
  const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
  updatedItems[index].commissionPoints = (unitCost * quantity) * (commissionPercentage / 100);
}
```

#### 3. When Service Price is Adjusted (lines 1583-1587)

**Service**:
```javascript
if (updatedItems[index].type === 'service' && updatedItems[index].commissionerId) {
  const servicePrice = Number(updatedItems[index].price) || 0;
  const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
  updatedItems[index].commissionPoints = servicePrice * (commissionPercentage / 100);
}
```

---

## Data Structure Comparison

### Product Item in Transaction
```javascript
{
  type: "product",
  id: "product_id",
  name: "Wella Color Touch Semi-Permanent",
  price: 820,           // Selling price (OTC price)
  unitCost: 520,        // Cost to salon (used for commission)
  quantity: 2,
  commissionPercentage: 12,
  commissionerId: "stylist_id",
  commissionerName: "John Doe",
  commissionPoints: 124.80  // (520 × 2) × 0.12
}
```

### Service Item in Transaction
```javascript
{
  type: "service",
  id: "service_id",
  name: "Special Conditioning",
  price: 5000,          // Selling price (used for commission)
  quantity: 1,
  commissionPercentage: 5,
  commissionerId: "stylist_id",
  commissionerName: "John Doe",
  commissionPoints: 250  // 5000 × 0.05
}
```

---

## Key Differences Summary

| Aspect | Product Commission | Service Commission |
|--------|-------------------|-------------------|
| **Based On** | `unitCost` (cost to salon) | `price` (selling price) |
| **Quantity** | Multiplied by quantity | Not multiplied (quantity is always 1 for services) |
| **Formula** | `(unitCost × qty) × (% / 100)` | `price × (% / 100)` |
| **Example** | ₱520 × 2 × 12% = ₱124.80 | ₱5,000 × 5% = ₱250 |
| **Recalculates When** | Quantity changes, Commissioner changes | Price adjusted, Commissioner changes |

---

## Why This Matters

### For Products:
- Commission is based on **cost**, not selling price
- This prevents inflated commissions from high markups
- Encourages selling products based on actual value to the salon
- Example: If a product costs ₱520 but sells for ₱820, commission is still based on ₱520

### For Services:
- Commission is based on **selling price**
- Stylists earn more when they charge more for their services
- Reflects the revenue generated for the salon
- Example: If a service sells for ₱5,000, commission is based on ₱5,000

---

## Testing Verification

### Test Product Commission:
1. Add a product to checkout
2. Check the product's `unitCost` in the database
3. Set quantity to 2
4. Select a commissioner
5. Verify: `commissionPoints = (unitCost × 2) × (commissionPercentage / 100)`

### Test Service Commission:
1. Add a service to checkout
2. Check the service's `price`
3. Select a commissioner
4. Verify: `commissionPoints = price × (commissionPercentage / 100)`
5. Adjust the price
6. Verify commission recalculates based on new price

---

## Console Verification

When you complete a transaction, check the console for:

```javascript
💰 Service commissions in transaction: [
  {
    name: "Special Conditioning",
    price: 5000,              // Selling price
    commissionPercentage: 5,
    commissionPoints: 250     // Based on price
  }
]

// Products will show:
{
  name: "Wella Color Touch",
  price: 820,                 // Selling price (OTC)
  unitCost: 520,              // Cost (used for commission)
  quantity: 2,
  commissionPercentage: 12,
  commissionPoints: 124.80    // Based on unitCost × quantity
}
```

---

## Related Files

- `src/components/billing/BillingModalPOS.jsx` - Commission calculation logic
- `src/pages/branch-manager/Commissions.jsx` - Commission display and reporting
- `SERVICE_COMMISSION_IMPLEMENTATION.md` - Overall implementation documentation

---

**Status**: Verified Correct
**Date**: January 25, 2026
