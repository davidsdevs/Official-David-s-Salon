# Quick Fix Guide - Stock Deduction Error

## 🚨 Problem
Getting error: **"Insufficient stock. Only 1 units available"** when UI shows 8 units.

## ✅ Solution (3 Steps)

### Step 1: Run the Fix Script
```bash
node fix_batch_stock_sync.js
```

### Step 2: Hard Refresh Browser
Press **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)

### Step 3: Try Deduction Again
It should work now! ✨

---

## 🎯 Quick Single Stock Fix

If you just need to fix one stock:

```bash
node fix_single_stock.js "PO-2JC-01-SUP-001"
```

Replace with your batch number, then hard refresh browser.

---

## 📝 What This Fixes

Syncs these values to match what the UI shows:
- ✅ `stocks.realTimeStock` (what you see)
- 🔄 `stocks.remainingQuantity` (gets synced)
- 🔄 `product_batches.remainingQuantity` (gets synced)

---

## 🔍 Optional: Clean Up Old History

If you want to see the new "Previous/New Stock" tracking in action, delete old inventory movements:

**In Firestore Console:**
1. Go to `inventory_movements` collection
2. Delete all documents (or just old ones)
3. New deductions will show proper Previous/New values

**Or run in Firebase Console:**
```javascript
db.collection('inventory_movements').get().then(snapshot => {
  snapshot.forEach(doc => doc.ref.delete());
});
```

---

## 💡 Why This Happened

Old code only updated `product_batches` but not `stocks.remainingQuantity`. The new code (already deployed) updates BOTH, so this won't happen again.

---

## 📚 More Details

See `BATCH_STOCK_SYNC_FIX.md` for full documentation.
