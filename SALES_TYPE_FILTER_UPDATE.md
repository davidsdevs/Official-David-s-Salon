# Sales Type Filter Implementation - Branch Manager Transactions

## Summary
Added a **Sales Type** filter to the Branch Manager Transactions (Billing) page, allowing filtering of transactions by:
- **Service Only** - Transactions containing only services
- **Product Only** - Transactions containing only products  
- **Mixed** - Transactions containing both services and products

## Changes Made

### 1. Filter State Management
**File:** `src/pages/branch-manager/Billing.jsx`

Added new state variable:
```javascript
const [salesTypeFilter, setSalesTypeFilter] = useState('all');
```

### 2. Filter Modal UI
Added Sales Type dropdown in the filter modal with 4 options:
- All Sales Types (default)
- Service Only
- Product Only
- Mixed (Service + Product)

The filter is positioned in the modal alongside other filters like Status, Payment Method, and Cashier.

### 3. Filter Logic
Updated the `filteredBills` useMemo to include sales type filtering:
```javascript
// Sales type filter
if (salesTypeFilter !== 'all' && bill.salesType !== salesTypeFilter) {
  return false;
}
```

Added `salesTypeFilter` to the dependency array of the useMemo hook.

### 4. Clear Filters Function
Updated `clearFilters()` to reset the sales type filter:
```javascript
setSalesTypeFilter('all');
```

### 5. Active Filters Detection
Updated `hasActiveFilters` to include sales type filter:
```javascript
const hasActiveFilters = searchTerm || statusFilter !== 'all' || paymentMethodFilter !== 'all' ||
  startDateFilter || endDateFilter || minAmountFilter || maxAmountFilter ||
  cashierFilter !== 'all' || receiptNumberFilter || salesTypeFilter !== 'all';
```

### 6. Filter Button Styling
Updated the filter button className to highlight when sales type filter is active:
```javascript
(statusFilter !== 'all' || paymentMethodFilter !== 'all' || startDateFilter || endDateFilter ||
 minAmountFilter || maxAmountFilter || cashierFilter !== 'all' || receiptNumberFilter || salesTypeFilter !== 'all')
```

### 7. CSV Export Enhancement
Added **Sales Type** column to CSV exports:
- Header: `'Sales Type'`
- Value: Capitalized sales type (Service, Product, or Mixed)
- Position: After Payment Method column

### 8. CSV Import Template
Updated the CSV import template to include Sales Type column with sample value "Service".

## Sales Type Values

The `salesType` field in bills can have three values:
- `'service'` - Transaction contains only services
- `'product'` - Transaction contains only products
- `'mixed'` - Transaction contains both services and products

These values are automatically determined by the billing service when creating a bill based on the items in the transaction.

## How to Use

### For Branch Managers:

1. **Open Transactions Page**
   - Navigate to Branch Manager → Transactions

2. **Click Filter Button**
   - Click the "Filter" button in the top toolbar

3. **Select Sales Type**
   - In the filter modal, find the "Sales Type" dropdown
   - Select one of:
     - All Sales Types (show all)
     - Service Only
     - Product Only
     - Mixed (Service + Product)

4. **Apply Filters**
   - Click "Apply Filters" to see filtered results
   - The filter button will be highlighted when active
   - Summary cards will update based on filtered data

5. **Clear Filters**
   - Click "Clear Filters" to reset all filters including sales type

### For Exports:

When exporting transactions to CSV, the Sales Type column will be included automatically, showing:
- "Service" for service-only transactions
- "Product" for product-only transactions
- "Mixed" for mixed transactions

## Technical Details

### Filter Position in Modal
The Sales Type filter is positioned in the filter modal grid:
- Row 2, Column 2 (after Cashier filter)
- Before Receipt Number filter
- Part of the 3-column responsive grid

### Data Source
The filter uses the `salesType` field from the bill document in Firestore, which is automatically set by the `createBill()` function in `billingService.js`.

### Performance
The filter is applied in the `filteredBills` useMemo hook, ensuring efficient filtering without unnecessary re-renders.

## Testing Checklist

- [x] Sales type filter state added
- [x] Filter dropdown added to modal UI
- [x] Filter logic implemented in filteredBills
- [x] Clear filters resets sales type
- [x] Active filter detection includes sales type
- [x] Filter button highlights when sales type is active
- [x] CSV export includes sales type column
- [x] CSV import template includes sales type
- [x] No TypeScript/ESLint errors
- [ ] Test filtering by Service Only
- [ ] Test filtering by Product Only
- [ ] Test filtering by Mixed
- [ ] Test combining with other filters
- [ ] Test CSV export with sales type
- [ ] Test clear filters functionality

## Related Files

- `src/pages/branch-manager/Billing.jsx` - Main implementation
- `src/services/billingService.js` - Sales type determination logic
- `src/pages/receptionist/Billing.jsx` - Similar page (not updated)

## Notes

- The sales type is automatically determined when creating a bill based on the items
- Service-only transactions are the most common type
- Mixed transactions occur when both services and products are sold together
- Product-only transactions are less common but occur for retail sales
- The filter works seamlessly with all other existing filters
