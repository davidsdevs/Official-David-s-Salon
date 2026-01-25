# Salon-Use Deduction History Fix

## Issue
Salon-use stock deductions are not appearing in the "Stock Adjustments History" section of the Inventory Controller Stocks page, even though the deductions are working correctly.

## Root Cause
The Stock Adjustments History queries the `inventory_movements` collection with:
```javascript
where('branchId', '==', userData.branchId)
where('type', '==', 'stock_out')
orderBy('createdAt', 'desc')
```

This query requires a **composite index** on `inventory_movements` collection with fields:
- `branchId` (ASCENDING)
- `type` (ASCENDING)  
- `createdAt` (DESCENDING)

The index was missing from `firestore.indexes.json`, causing the query to fail silently.

## What Was Working
- Salon-use deductions successfully update stock quantities ✅
- Inventory movement records are created in Firestore ✅
- The records have correct `type: 'stock_out'` ✅

## What Wasn't Working
- The Stock Adjustments History page couldn't query the records ❌
- No error was shown to the user ❌
- Deductions appeared successful but weren't logged in the UI ❌

## Fix Applied

### 1. Added Firestore Index
Added the required composite index to `firestore.indexes.json`:

```json
{
  "collectionGroup": "inventory_movements",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "branchId", "order": "ASCENDING" },
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### 2. Deploy the Index
Run this command to deploy the index to Firestore:

```bash
firebase deploy --only firestore:indexes
```

This will create the index in your Firebase project. Index creation can take a few minutes depending on the amount of existing data.

## How Stock Adjustments History Works

The page displays three types of stock movements:

### 1. Force Adjustments
- Source: `stockAdjustments` collection
- Type: Manual stock adjustments by managers
- Shows: Previous stock, new stock, adjustment quantity, reason

### 2. Transaction Sales (including Salon-Use Deductions)
- Source: `inventory_movements` collection (type: 'stock_out')
- Type: Stock deductions from sales OR salon-use
- Shows: Quantity deducted, reason, batches used

### 3. Stock Transfers
- Source: `stock_transfer` collection
- Type: Stock moved between branches
- Shows: From/to branch, quantity, status

## Salon-Use Deduction Flow

When a salon-use deduction is made:

1. **Update product_batches**:
   - Deduct from `remainingQuantity`
   - Update status if depleted

2. **Update stocks collection**:
   - Deduct from `realTimeStock`
   - Deduct from `remainingQuantity`
   - Update status

3. **Create inventory_movements record**:
   ```javascript
   {
     branchId: "...",
     productId: "...",
     productName: "...",
     type: "stock_out",
     quantity: 2,
     reason: "Salon Use",
     notes: "...",
     createdBy: "...",
     batchDeductions: [...],
     createdAt: timestamp
   }
   ```

4. **Log activity**:
   - Create activity log for audit trail

## Testing After Fix

### 1. Deploy the Index
```bash
firebase deploy --only firestore:indexes
```

Wait for the index to build (check Firebase Console → Firestore → Indexes).

### 2. Hard Refresh Browser
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### 3. Test Deduction
1. Go to Inventory Controller → Stocks
2. Find a salon-use product
3. Click the minus icon to deduct stock
4. Enter quantity and reason
5. Submit

### 4. Verify in History
1. Scroll down to "Stock Adjustments History"
2. Select "Last 7 Days" filter
3. Click "Refresh"
4. You should see the deduction listed as "Transaction Sale"
5. Verify it shows:
   - Product name
   - Quantity deducted (negative number)
   - Reason (e.g., "Salon Use")
   - Batches used
   - Date/time

## Existing Data

All previous salon-use deductions that created `inventory_movements` records will automatically appear in the history once the index is built. No data migration needed.

## Files Modified
- `firestore.indexes.json` - Added composite index for inventory_movements

## Related Collections

### inventory_movements
Fields:
- `branchId` (string) - Branch where movement occurred
- `productId` (string) - Product affected
- `productName` (string) - Product name for display
- `type` (string) - 'stock_in' or 'stock_out'
- `quantity` (number) - Amount moved
- `reason` (string) - Why the movement occurred
- `notes` (string) - Additional details
- `createdBy` (string) - User who performed the action
- `batchDeductions` (array) - Which batches were affected
- `createdAt` (timestamp) - When it occurred

### stockAdjustments
Fields:
- `branchId` (string)
- `productId` (string)
- `previousStock` (number)
- `newStock` (number)
- `adjustmentQuantity` (number)
- `reason` (string)
- `notes` (string)
- `adjustedBy` (string)
- `managerCode` (string)
- `createdAt` (timestamp)

## Troubleshooting

### History Still Empty After Index Deployment

1. **Check index status**:
   - Go to Firebase Console → Firestore → Indexes
   - Verify the index shows "Enabled" (not "Building")

2. **Check browser console**:
   - Look for errors related to "inventory_movements"
   - Check if query is being executed

3. **Verify data exists**:
   - Go to Firebase Console → Firestore → inventory_movements
   - Check if documents exist with `type: 'stock_out'`
   - Verify `branchId` matches your current branch

4. **Check date filter**:
   - Try "All Time" filter instead of "Last 7 Days"
   - Existing deductions might be older than 7 days

### Query Still Failing

If the query still fails after index deployment:

1. Check if `branchId` in query matches `branchId` in documents (string vs string)
2. Verify `type` field is exactly 'stock_out' (case-sensitive)
3. Check if `createdAt` is a valid Firestore timestamp
4. Look for any error messages in browser console

## Prevention

When adding new queries with multiple where clauses and orderBy:
1. Add the required index to `firestore.indexes.json` immediately
2. Deploy indexes before testing: `firebase deploy --only firestore:indexes`
3. Check Firebase Console for index build status
4. Test the query after index is enabled
