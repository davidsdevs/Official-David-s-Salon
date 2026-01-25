# Batch Stock Synchronization Fix

## Problem

When trying to deduct stock, you get an error like:
```
Insufficient stock. Only 1 units available.
```

But the UI shows 8 units available.

## Root Cause

The `stocks` collection and `product_batches` collection are out of sync:

- **stocks.realTimeStock**: 8 (what UI shows)
- **stocks.remainingQuantity**: 10 (not updated)
- **product_batches.remainingQuantity**: 1 (what deduction checks)

This happened because old code deducted from `product_batches` but didn't update `stocks.remainingQuantity`.

## Solution

Run the synchronization script to fix all batch stocks at once.

### Option 1: Fix All Batch Stocks (Recommended)

```bash
node fix_batch_stock_sync.js
```

This will:
1. Find all batch stocks
2. Compare `stocks` vs `product_batches` collections
3. Sync all three fields to match `stocks.realTimeStock` (the UI source of truth)
4. Show a summary of what was fixed

### Option 2: Fix Single Stock (Quick Fix)

If you just need to fix one specific stock:

```bash
node fix_single_stock.js "PO-2JC-01-SUP-001"
```

Replace `"PO-2JC-01-SUP-001"` with your batch number.

## After Running the Script

1. **Hard refresh your browser**: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Try the deduction again**: It should work now
3. **Check the stock**: The values should be synced

## What Gets Synced

The script syncs these three fields to match `stocks.realTimeStock`:

| Collection | Field | Description |
|------------|-------|-------------|
| `stocks` | `realTimeStock` | ✅ Source of truth (UI shows this) |
| `stocks` | `remainingQuantity` | 🔄 Synced to match realTimeStock |
| `product_batches` | `remainingQuantity` | 🔄 Synced to match realTimeStock |

## Example Output

```
🔧 Starting batch stock synchronization fix...

📦 Found 5 batch stocks to check

📊 Goldwell Kerasilk Control Conditioner
   Batch: PO-2JC-01-SUP-001
   Stock ID: FXmBGJxWPBrXR8V87mm9
   Batch ID: abc123
   Current values:
     - stocks.realTimeStock: 8
     - stocks.remainingQuantity: 10
     - product_batches.remainingQuantity: 1
   🔄 Syncing to: 8
   📝 Updating stocks.remainingQuantity: 10 → 8
   📝 Updating product_batches.remainingQuantity: 1 → 8
   📝 Updating product_batches.status: active → active
   ✅ Synced successfully

============================================================
📊 SUMMARY
============================================================
✅ Fixed: 1 stocks
✓  Already synced: 4 stocks
⚠️  Errors: 0 stocks
📦 Total checked: 5 stocks
============================================================

🎉 Synchronization complete!
💡 Next steps:
   1. Hard refresh your browser (Ctrl+Shift+R)
   2. Try the deduction again
   3. It should work now!
```

## Prevention

The current code (after recent updates) now properly updates BOTH collections:

1. **product_batches.remainingQuantity** - Updated in FIFO deduction
2. **stocks.realTimeStock** - Updated in batch stock update
3. **stocks.remainingQuantity** - Updated in batch stock update

So this sync issue should not happen again with new deductions.

## Troubleshooting

### Script says "No stock found"
- Check the batch number is correct
- Make sure you're using the exact batch number from Firestore

### Still getting error after running script
1. Hard refresh browser (Ctrl+Shift+R)
2. Check Firestore console to verify the values are synced
3. Try logging out and back in
4. Clear browser cache

### Want to see old deduction history
The old `inventory_movements` records don't have `previousStock` and `newStock` values. You can:
1. Keep them for historical reference (they'll show "-")
2. Delete the collection to start fresh with new tracking

To delete old movements:
```javascript
// In Firestore console, delete the inventory_movements collection
// Or run this in Firebase console:
db.collection('inventory_movements').get().then(snapshot => {
  snapshot.forEach(doc => doc.ref.delete());
});
```

## Files Modified

- `fix_batch_stock_sync.js` - Fixes all batch stocks
- `fix_single_stock.js` - Fixes a single batch stock
- `src/services/inventoryService.js` - Updated to sync both collections
- `src/pages/inventory/Stocks.jsx` - UI improvements

## Related Documentation

- `STOCK_ADJUSTMENTS_PREVIOUS_NEW_TRACKING.md` - Previous/New stock tracking
- `SALON_USE_DEDUCTION_TYPE_FIX.md` - Type classification fix
- `STOCK_ADJUSTMENTS_HISTORY_IMPROVEMENTS.md` - History improvements
