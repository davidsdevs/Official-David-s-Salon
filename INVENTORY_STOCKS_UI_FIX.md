# Inventory Stocks UI Fix - Current Stock Display

## Critical Issue Discovered

### Data Inconsistency in Firestore
The user's Firestore data shows an inconsistency between two fields in the `stocks` collection:

**STOCKS collection** (document ID: GNOmcN8HVWXccT33SmpK):
- `realTimeStock: 6` ✅ (correct - updated by deduction)
- `remainingQuantity: 10` ❌ (WRONG - NOT updated by old code!)
- `beginningStock: 10`

**PRODUCT_BATCHES collection**:
- `remainingQuantity: 3` ✅ (correct - updated properly)

### Root Cause
The deduction code was updated in a previous session to update BOTH `realTimeStock` AND `remainingQuantity` in the stocks collection. However:

1. **Old code** (before fix) only updated `realTimeStock`
2. **New code** (after fix) updates BOTH fields
3. **User's browser** was running old cached code during the deduction
4. **Result**: `realTimeStock` was updated to 6, but `remainingQuantity` stayed at 10

### Why This Matters
The `getComputedStock()` function uses this priority:
```javascript
remainingQuantity || realTimeStock || beginningStock
```

Since `remainingQuantity: 10` exists (even though it's wrong), it takes priority over `realTimeStock: 6`, causing the table to display 10 instead of 6.

### Which Collection Does Receptionist Use?
**Answer**: Receptionist checkout uses the `stocks` collection (not `product_batches`).

The billing service calls `inventoryService.deductStockFIFO()` which:
1. Updates `product_batches.remainingQuantity` ✅
2. Updates `stocks.realTimeStock` ✅  
3. Updates `stocks.remainingQuantity` ✅ (only in NEW code)

## Solutions

### Solution 1: Hard Refresh Browser (Immediate)
The user needs to **hard refresh** their browser to get the latest code:
- **Windows**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

This ensures future deductions will update both fields correctly.

### Solution 2: Fix Existing Data (Required)
Run the fix script to sync `remainingQuantity` with `realTimeStock` for all batch stocks:

```bash
node fix_stock_remaining_quantity.js
```

This script will:
1. Find all batch stocks where `remainingQuantity !== realTimeStock`
2. Update `remainingQuantity` to match `realTimeStock`
3. Report how many stocks were fixed

### Solution 3: Manual Fix (Alternative)
Manually update the Firestore document:
1. Go to Firebase Console → Firestore
2. Find the stocks document (ID: `GNOmcN8HVWXccT33SmpK`)
3. Update `remainingQuantity` from `10` to `6`

## Original Issue (UI Labels)

### Problem
User reported that the Inventory Controller stocks table was showing incorrect labels:
- **Table displayed**: "10 Beginning" and "10 Batch 1"  
- **Stock details modal showed**: "Beginning Stock: 10 units" and "Current Stock: 6 units"
- **Expected**: Table should display current stock value (6) with label "Current"

### Changes Made

#### 1. Fixed Stock Display Labels (`src/pages/inventory/Stocks.jsx`)

**First Batch Row (Main Row)**:
- Changed label from "Current Stock" to "Current" for consistency
- Line ~3414: `<div className="text-xs text-green-600">Current</div>`

**Expanded Batch Rows**:
- Changed label from "Batch {idx + 2}" to "Current" 
- Line ~3499: `<div className="text-xs text-gray-500">Current</div>`

#### 2. Improved Stock Reload After Deduction

**Enhanced Reload Logic** (Line ~4738):
```javascript
setTimeout(async () => {
  setStocks([]); // Clear current stocks to force fresh load
  setCurrentPage(1);
  setLastVisible(null);
  setHasMore(true);
  await loadData(); // Use loadData instead of reloadStocks
  console.log('✅ Stocks reloaded');
}, 1000); // Increased to 1000ms delay
```

**Changes**:
- Increased delay from 500ms to 1000ms for Firestore propagation
- Added explicit pagination state reset
- Changed from `reloadStocks()` to `loadData()` for thorough refresh

#### 3. Added Debug Logging

**Enhanced `getComputedStock` Function** (Line ~451):
```javascript
const getComputedStock = (stock) => {
  const baseStock = stock.remainingQuantity || stock.realTimeStock || stock.beginningStock || 0;
  // Debug logging for salon-use stocks
  if (stock.usageType === 'salon-use' && stock.batchNumber) {
    console.log(`📊 Computing stock for ${stock.batchNumber}:`, {
      remainingQuantity: stock.remainingQuantity,
      realTimeStock: stock.realTimeStock,
      beginningStock: stock.beginningStock,
      computed: baseStock
    });
  }
  return Math.max(0, baseStock);
};
```

## Testing After Fix

1. **Hard refresh browser** (Ctrl+Shift+R)
2. **Run fix script**: `node fix_stock_remaining_quantity.js`
3. **Verify in Inventory Controller → Stocks**:
   - Table shows "6" with "Current" label
   - Stock details modal shows "Current Stock: 6 units"
   - Console logs show `remainingQuantity: 6` being used
4. **Test new deduction**:
   - Deduct 1 unit from salon-use stock
   - Verify both `realTimeStock` and `remainingQuantity` are updated
   - Verify table displays updated value immediately

## Files Modified
- `src/pages/inventory/Stocks.jsx` - UI labels and reload logic
- `src/services/inventoryService.js` - Already fixed to update both fields (previous session)
- `fix_stock_remaining_quantity.js` - New script to fix inconsistent data

## Data Integrity Check

After running the fix, verify in Firestore that for ALL batch stocks:
```
realTimeStock === remainingQuantity
```

If they differ, it means:
- Old code was used for deduction, OR
- Manual adjustment was made to only one field

## Prevention

Going forward, the updated `inventoryService.deductStockFIFO()` ensures both fields are always updated together:
```javascript
batch.update(batchStockRef, {
  realTimeStock: newRealTimeStock,
  remainingQuantity: newRemainingQuantity,  // ← This line prevents the issue
  updatedAt: serverTimestamp()
});
```
