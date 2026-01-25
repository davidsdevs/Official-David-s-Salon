# URGENT: Fix Stock Display Issue

## The Problem

Your `stocks` collection has `remainingQuantity: 10` but it should be `3` (or `6` depending on which is correct).

The deduction code IS CORRECT in the files, but your **browser is running OLD cached JavaScript** that doesn't update `remainingQuantity`.

## Current Data State

**PRODUCT_BATCHES** (correct):
- `remainingQuantity: 3` ✅

**STOCKS** (incorrect):
- `realTimeStock: 6` ✅
- `remainingQuantity: 10` ❌ (should be 3 or 6)
- `status: "Out of Stock"` ❌ (should be "In Stock" since realTimeStock is 6)

## Fix Steps (DO IN ORDER)

### Step 1: Hard Refresh Browser
**CRITICAL**: You MUST do this to get the updated code!

- **Windows**: Press `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: Press `Cmd + Shift + R`

This clears the JavaScript cache and loads the latest code.

### Step 2: Fix the Existing Data
Run this script to fix the current stock:

```bash
node fix_single_stock.js
```

This will:
- Update `remainingQuantity` from 10 to 6
- Update `status` from "Out of Stock" to "In Stock"

### Step 3: Verify the Fix
1. Hard refresh browser again (Ctrl+Shift+R)
2. Go to Inventory Controller → Stocks
3. Find "Goldwell Kerasilk Control Conditioner"
4. Verify it shows "6 Current" (not "10 Current")

### Step 4: Test New Deduction
1. Click the minus icon to deduct 1 unit
2. Check the console logs - you should see:
   ```
   📦 Updating batch_stock: PO-2JC-01-SUP-001
   currentRemainingQuantity: 6
   newRemainingQuantity: 5
   ✅ Batch stock update queued: { remainingQuantity: 5 }
   ```
3. Verify the table updates to show "5 Current"
4. Check Firestore - both `realTimeStock` and `remainingQuantity` should be 5

## Why This Happened

1. The deduction code was updated to update both `realTimeStock` AND `remainingQuantity`
2. Your browser had the OLD code cached (only updated `realTimeStock`)
3. You did a deduction with the old code
4. Result: `realTimeStock` updated to 6, but `remainingQuantity` stayed at 10

## Prevention

Always hard refresh after code updates:
- Before testing new features
- After pulling new code
- When seeing unexpected behavior

## Verification Checklist

After the fix, verify:
- [ ] Browser hard refreshed (Ctrl+Shift+R)
- [ ] Script ran successfully
- [ ] Table shows "6 Current" (not "10 Current")
- [ ] Firestore shows `remainingQuantity: 6`
- [ ] Status shows "In Stock" (not "Out of Stock")
- [ ] New deduction updates both fields
- [ ] Console logs show `newRemainingQuantity` in updates

## If It Still Doesn't Work

1. Check browser console for errors
2. Verify you're looking at the correct branch in Firestore
3. Check if there are multiple stock documents for the same product
4. Clear browser cache completely (not just hard refresh)
5. Try in incognito/private browsing mode

## Technical Details

The updated code in `src/services/inventoryService.js` (lines 1043-1062) now:
```javascript
batch.update(batchStockRef, {
  realTimeStock: newRealTimeStock,
  remainingQuantity: newRemainingQuantity,  // ← This line was missing in old code
  status: newStatus,
  updatedAt: serverTimestamp()
});
```

The `getComputedStock()` function prioritizes:
1. `remainingQuantity` (if exists)
2. `realTimeStock` (fallback)
3. `beginningStock` (last resort)

Since `remainingQuantity: 10` exists (even though wrong), it takes priority over `realTimeStock: 6`, causing the display issue.
