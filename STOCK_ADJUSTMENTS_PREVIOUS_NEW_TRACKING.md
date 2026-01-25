# Stock Adjustments Previous/New Stock Tracking

## Issues Fixed

### 1. Missing Previous/New Stock Values
**Problem**: Stock Adjustments History showed "-" for Previous and New stock columns because `inventory_movements` records didn't track these values.

**Solution**: Updated `inventoryService.deductStockFIFO()` to calculate and store previous and new stock values when creating inventory movement records.

### 2. Print Preview Not Auto-Opening
**Problem**: Print button opened a window with Print/Close buttons, requiring extra clicks.

**Solution**: Added `onload="window.print(); window.close();"` to auto-trigger print dialog and close window after printing.

## Changes Made

### 1. Updated Inventory Service
**File**: `src/services/inventoryService.js` (Line ~1083)

**Added Stock Tracking**:
```javascript
// Get current stock before deduction for tracking
let previousTotalStock = 0;
let newTotalStock = 0;

// Calculate total stock from batches
batchesToUse.forEach(b => {
  previousTotalStock += (b.remainingQuantity || 0);
});
newTotalStock = previousTotalStock - quantity;
```

**Updated Movement Record**:
```javascript
const movementData = {
  branchId: String(branchId),
  productId: String(productId),
  productName: String(deductionData.productName || ''),
  type: 'stock_out',
  quantity: quantity,
  previousStock: previousTotalStock, // NEW - Track stock before deduction
  newStock: newTotalStock, // NEW - Track stock after deduction
  reason: String(deductionData.reason || 'Stock reduced'),
  notes: String(deductionData.notes || ''),
  createdBy: String(deductionData.createdBy || ''),
  batchDeductions: updatedBatches,
  createdAt: serverTimestamp()
};
```

### 2. Updated Print Function
**File**: `src/pages/inventory/Stocks.jsx` (Line ~2610)

**Auto-Print**:
```html
<body onload="window.print(); window.close();">
```

**Removed Manual Buttons**:
- Removed Print and Close buttons from print preview
- Print dialog opens automatically
- Window closes automatically after printing/canceling

**Improved Styling**:
- Smaller font size (11px) for better fit
- Column widths specified for better layout
- Bold text for important values
- Center-aligned stock numbers

## How It Works

### Stock Tracking Flow

1. **Before Deduction**:
   - Calculate total stock from all batches: `previousTotalStock = sum of all batch remainingQuantity`
   - Example: Batch 1 (5 units) + Batch 2 (3 units) = 8 units

2. **During Deduction**:
   - Deduct quantity using FIFO: `quantity = 2 units`
   - Calculate new stock: `newTotalStock = previousTotalStock - quantity = 8 - 2 = 6 units`

3. **Create Movement Record**:
   ```javascript
   {
     previousStock: 8,
     newStock: 6,
     quantity: 2,
     // ... other fields
   }
   ```

4. **Display in History**:
   - Previous: 8
   - New: 6
   - Adjustment: -2

### Print Flow

1. **User Clicks Print Button**
2. **New Window Opens** with formatted HTML
3. **Print Dialog Auto-Opens** (`window.print()`)
4. **User Prints or Cancels**
5. **Window Auto-Closes** (`window.close()`)

## Visual Changes

### Stock Adjustments History Table

**Before**:
```
Previous | New | Adjustment
   -     |  -  |    -2
```

**After**:
```
Previous | New | Adjustment
   8     |  6  |    -2
```

### Print Preview

**Before**:
- Window opens with table
- Shows [Print] and [Close] buttons
- User must click Print
- User must click Close

**After**:
- Window opens with table
- Print dialog opens automatically
- Window closes automatically
- No manual button clicks needed

## Example Scenarios

### Scenario 1: Single Batch Deduction
- **Before**: Batch has 10 units
- **Deduct**: 3 units
- **After**: Batch has 7 units
- **Movement Record**:
  - previousStock: 10
  - newStock: 7
  - quantity: 3

### Scenario 2: Multi-Batch Deduction (FIFO)
- **Before**: 
  - Batch 1: 5 units
  - Batch 2: 8 units
  - Total: 13 units
- **Deduct**: 7 units (uses all of Batch 1 + 2 from Batch 2)
- **After**:
  - Batch 1: 0 units (depleted)
  - Batch 2: 6 units
  - Total: 6 units
- **Movement Record**:
  - previousStock: 13
  - newStock: 6
  - quantity: 7

### Scenario 3: Salon Use Deduction
- **Before**: 20 units
- **Deduct**: 2 units for salon use
- **After**: 18 units
- **Movement Record**:
  - previousStock: 20
  - newStock: 18
  - quantity: 2
  - reason: "Salon Use"

## Testing

### Test Case 1: New Deduction
1. Go to Inventory Controller → Stocks
2. Find a product with 10 units
3. Click minus icon to deduct
4. Enter quantity: 3
5. Submit
6. Go to Stock Adjustments History
7. **Expected**: 
   - Previous: 10
   - New: 7
   - Adjustment: -3

### Test Case 2: Print Preview
1. Go to Stock Adjustments History
2. Click Print button
3. **Expected**:
   - New window opens
   - Print dialog opens automatically
   - Shows all adjustments with Previous/New values
   - After printing/canceling, window closes automatically

### Test Case 3: Old Records
1. View Stock Adjustments History
2. Look at old records (before this update)
3. **Expected**:
   - Previous: - (dash)
   - New: - (dash)
   - Adjustment: shows value
   - Note: Old records don't have previous/new data

## Important Notes

### Existing Data
- **Old inventory movements** (created before this update) will show "-" for Previous/New
- **New inventory movements** (created after this update) will show actual values
- No data migration needed - old records remain as-is

### Stock Calculation
- Previous/New stock is calculated from **batch remainingQuantity**
- Uses FIFO (First In, First Out) logic
- Accounts for multiple batches
- Tracks total stock across all batches

### Print Behavior
- Auto-print works in most browsers
- Some browsers may block auto-close (security setting)
- User can manually close window if auto-close is blocked
- Print preview shows ALL adjustments (not paginated)

## Benefits

1. **Complete Audit Trail**: See exactly what stock was before and after each adjustment
2. **Better Tracking**: Understand stock changes at a glance
3. **Easier Reconciliation**: Match adjustments with actual stock levels
4. **Faster Printing**: No extra clicks needed
5. **Professional Reports**: Clean, formatted print output

## Files Modified
- `src/services/inventoryService.js`
  - Line ~1083: Added previousStock and newStock calculation
  - Line ~1107: Added previousStock and newStock to movement record

- `src/pages/inventory/Stocks.jsx`
  - Line ~2610: Updated handlePrintAdjustments with auto-print
  - Line ~2625: Added onload event for auto-print/close
  - Line ~2630: Improved print styling and layout

## Related
- Inventory movements now track complete stock history
- Print preview auto-opens for better UX
- Previous/new stock values help with inventory reconciliation
