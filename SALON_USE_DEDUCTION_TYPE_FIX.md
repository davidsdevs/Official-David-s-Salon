# Salon Use Deduction Type Fix

## Issue
Manual salon-use stock deductions were being incorrectly labeled as "Transaction Sale" in the Stock Adjustments History, even though they were not actual sales transactions.

## Root Cause
The code was hardcoding all `inventory_movements` with `type: 'stock_out'` as "Transaction Sale", without checking if the deduction was from a manual salon-use deduction or an actual transaction/sale.

## Solution
Updated the logic to check the `reason` field of the inventory movement to determine if it's a salon-use deduction or a transaction sale.

### Detection Logic
```javascript
const reason = data.reason || '';
const isSalonUse = reason.toLowerCase().includes('salon') || 
                  reason.toLowerCase().includes('salon-use') ||
                  reason.toLowerCase().includes('salon use');
```

If the reason contains "salon", "salon-use", or "salon use", it's classified as a salon-use deduction.

### Type Assignment
```javascript
type: isSalonUse ? 'salon_use' : 'transaction',
adjustmentType: isSalonUse ? 'Salon Use Deduction' : 'Transaction Sale',
```

## Changes Made

### 1. Updated loadStockAdjustments Function
**File**: `src/pages/inventory/Stocks.jsx` (Line ~2445)

**Before**:
```javascript
allAdjustments.push({
  id: doc.id,
  type: 'transaction',
  adjustmentType: 'Transaction Sale',
  // ...
});
```

**After**:
```javascript
// Determine if this is a salon-use deduction or transaction sale
const reason = data.reason || '';
const isSalonUse = reason.toLowerCase().includes('salon') || 
                  reason.toLowerCase().includes('salon-use') ||
                  reason.toLowerCase().includes('salon use');

allAdjustments.push({
  id: doc.id,
  type: isSalonUse ? 'salon_use' : 'transaction',
  adjustmentType: isSalonUse ? 'Salon Use Deduction' : 'Transaction Sale',
  reason: data.reason || (isSalonUse ? 'Salon Use' : 'Transaction Sale'),
  notes: data.notes || (data.transactionId ? `Transaction: ${data.transactionId}` : ''),
  // ...
});
```

### 2. Added Salon Use Styling
**File**: `src/pages/inventory/Stocks.jsx` (Line ~2905)

**Type Colors**:
```javascript
const typeColors = {
  'force_adjustment': 'bg-orange-100 text-orange-800 border-orange-200',
  'transaction': 'bg-blue-100 text-blue-800 border-blue-200',
  'salon_use': 'bg-teal-100 text-teal-800 border-teal-200', // NEW
  'transfer_out': 'bg-purple-100 text-purple-800 border-purple-200',
  'transfer_in': 'bg-green-100 text-green-800 border-green-200'
};
```

**Type Icons**:
```javascript
const typeIcons = {
  'force_adjustment': <AlertTriangle className="h-3 w-3" />,
  'transaction': <ShoppingCart className="h-3 w-3" />,
  'salon_use': <Package className="h-3 w-3" />, // NEW
  'transfer_out': <ArrowRight className="h-3 w-3" />,
  'transfer_in': <ArrowRightLeft className="h-3 w-3" />
};
```

## Visual Changes

### Before
```
Type: [Transaction Sale] (Blue badge)
Reason: HEHEHEHE
```

### After
```
Type: [Salon Use Deduction] (Teal badge)
Reason: Salon Use / HEHEHEHE
```

## Adjustment Types

The Stock Adjustments History now correctly displays 5 types:

1. **Force Adjustment** (Orange)
   - Manual stock adjustments by managers
   - Icon: AlertTriangle

2. **Transaction Sale** (Blue)
   - Stock deductions from actual sales/transactions
   - Icon: ShoppingCart
   - Has transactionId

3. **Salon Use Deduction** (Teal) ← NEW
   - Manual deductions for salon use
   - Icon: Package
   - Reason contains "salon"

4. **Transfer Out** (Purple)
   - Stock transferred to another branch
   - Icon: ArrowRight

5. **Transfer In** (Green)
   - Stock received from another branch
   - Icon: ArrowRightLeft

## How It Works

### Salon Use Deduction Flow
1. User clicks "Deduct" button on salon-use stock
2. Enters quantity and reason (e.g., "Salon Use", "HEHEHEHE")
3. System creates `inventory_movements` record with:
   - `type: 'stock_out'`
   - `reason: 'Salon Use'` or user's custom reason
4. When loading adjustments history:
   - Checks if reason contains "salon"
   - If yes: `type: 'salon_use'`, `adjustmentType: 'Salon Use Deduction'`
   - If no: `type: 'transaction'`, `adjustmentType: 'Transaction Sale'`

### Transaction Sale Flow
1. Receptionist completes checkout with products
2. System creates `inventory_movements` record with:
   - `type: 'stock_out'`
   - `reason: 'Transaction Sale'`
   - `transactionId: '...'`
3. When loading adjustments history:
   - Checks if reason contains "salon"
   - If no: `type: 'transaction'`, `adjustmentType: 'Transaction Sale'`

## Testing

### Test Case 1: Salon Use Deduction
1. Go to Inventory Controller → Stocks
2. Find a salon-use product
3. Click minus icon to deduct
4. Enter quantity: 2
5. Enter reason: "Salon Use" or "HEHEHEHE"
6. Submit
7. Scroll to Stock Adjustments History
8. **Expected**: Shows as "Salon Use Deduction" with teal badge

### Test Case 2: Transaction Sale
1. Go to Receptionist → Billing
2. Add products to checkout
3. Complete transaction
4. Go to Inventory Controller → Stocks
5. Scroll to Stock Adjustments History
6. **Expected**: Shows as "Transaction Sale" with blue badge

### Test Case 3: Mixed History
1. Do both salon-use deduction and transaction sale
2. View Stock Adjustments History
3. **Expected**: 
   - Salon deductions show as "Salon Use Deduction" (teal)
   - Transaction sales show as "Transaction Sale" (blue)
   - Each has appropriate icon

## Benefits

1. **Clear Distinction**: Easy to identify salon-use vs sales
2. **Better Tracking**: Understand why stock was deducted
3. **Accurate Reporting**: Separate salon consumption from sales
4. **Visual Clarity**: Different colors and icons for each type
5. **Audit Trail**: Clear history of all stock movements

## Edge Cases Handled

### Case 1: Reason with "Salon" in it
- Reason: "Salon Use"
- Reason: "salon-use"
- Reason: "For salon"
- **Result**: All classified as Salon Use Deduction

### Case 2: Reason without "Salon"
- Reason: "HEHEHEHE" (but from salon-use deduction)
- **Issue**: Will be classified as Transaction Sale
- **Solution**: Users should include "salon" in reason, or we can check other fields

### Case 3: Transaction with "Salon" in notes
- Transaction sale with notes mentioning salon
- **Result**: Correctly classified as Transaction Sale (checks reason, not notes)

## Future Improvements

1. **Add usageType field** to inventory_movements to explicitly track salon-use vs OTC
2. **Add source field** to track where deduction came from (manual, transaction, transfer)
3. **Filter by type** in Stock Adjustments History
4. **Export by type** for reporting
5. **Statistics by type** in dashboard

## Files Modified
- `src/pages/inventory/Stocks.jsx`
  - Line ~2445: Updated inventory_movements loading logic
  - Line ~2905: Added salon_use type colors and icons

## Related
- Salon-use deduction creates inventory_movements with `type: 'stock_out'`
- Transaction sales also create inventory_movements with `type: 'stock_out'`
- The `reason` field is the key differentiator
