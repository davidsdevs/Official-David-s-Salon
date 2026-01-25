# Inventory Stock Condition Filter Implementation

## Feature Added
Added a new "Stock Condition" filter to the Inventory Controller Stocks page that allows filtering stocks by their condition: All, Good, Expired, or Depleted.

## Filter Options

### 1. All Conditions (Default)
Shows all stocks regardless of condition.

### 2. Good
Shows stocks that are:
- **Active** (not expired)
- **Not depleted** (has stock available)
- **Status is not "Out of Stock"**

This filter helps identify healthy, usable inventory.

### 3. Expired
Shows stocks that have:
- **Expiration date in the past**

This filter helps identify stocks that need to be removed or disposed of.

### 4. Depleted
Shows stocks that are:
- **Zero stock** (currentStock <= 0), OR
- **Status is "Out of Stock"**

This filter helps identify stocks that need to be reordered.

## Implementation Details

### Filter Logic
```javascript
if (filters.condition !== 'all') {
  const now = new Date();
  const expirationDate = stock.expirationDate ? new Date(stock.expirationDate) : null;
  const isExpired = expirationDate && expirationDate < now;
  const isDepleted = currentStock <= 0 || stock.status === 'Out of Stock';
  
  if (filters.condition === 'good') {
    // Good = Active, not expired, has stock
    matchesCondition = !isExpired && !isDepleted && stock.status !== 'Out of Stock';
  } else if (filters.condition === 'expired') {
    // Expired = Past expiration date
    matchesCondition = isExpired;
  } else if (filters.condition === 'depleted') {
    // Depleted = Zero stock or Out of Stock status
    matchesCondition = isDepleted;
  }
}
```

### UI Location
The filter is located in the **Advanced Filters Modal**, accessible by clicking the "Filter" button in the Stocks page toolbar.

**Filter Order in Modal**:
1. Status
2. Category
3. Stock Range
4. Usage Type
5. **Stock Condition** ← NEW
6. Batch Number
7. Low Stock Checkbox

## Use Cases

### 1. Daily Inventory Check
**Filter**: Good
- Shows only healthy, usable stocks
- Helps focus on available inventory
- Excludes expired or depleted items

### 2. Expiry Management
**Filter**: Expired
- Identifies stocks past expiration date
- Helps with disposal planning
- Ensures compliance with safety standards

### 3. Reorder Planning
**Filter**: Depleted
- Shows stocks that need reordering
- Helps prevent stockouts
- Prioritizes purchase order creation

### 4. Inventory Cleanup
**Filter**: Expired + Depleted (use separately)
- Identifies items to remove from inventory
- Helps maintain accurate stock records
- Reduces clutter in stock list

## Filter Combinations

The condition filter works with all other filters:

### Example 1: Expired Salon-Use Products
- **Usage Type**: Salon Use Only
- **Condition**: Expired
- **Result**: Shows only expired salon-use products

### Example 2: Depleted OTC Products in Hair Care
- **Category**: Hair Care
- **Usage Type**: OTC Only
- **Condition**: Depleted
- **Result**: Shows depleted OTC hair care products that need reordering

### Example 3: Good Stock with Low Quantity
- **Condition**: Good
- **Stock Range**: Min 0, Max 10
- **Result**: Shows healthy stocks with low quantity (need reorder soon)

## Visual Indicators

### Filter Button
The filter button shows an active state (blue background) when any filter is applied, including the condition filter.

### Results Count
The filter button displays the number of stocks matching all active filters.

### Modal Summary
The modal shows "Showing X of Y stocks" to indicate how many stocks match the current filters.

## Technical Details

### State Management
```javascript
const [filters, setFilters] = useState({
  status: 'all',
  category: 'all',
  stockRange: { min: '', max: '' },
  lowStock: false,
  usageType: 'all',
  batchNumber: '',
  condition: 'all' // NEW
});
```

### Filter Reset
The "Reset Filters" button clears all filters including the condition filter, returning to the default "All Conditions" view.

### Performance
The condition filter is applied in the `filteredStocks` useMemo hook, ensuring efficient filtering even with large datasets.

## Files Modified
- `src/pages/inventory/Stocks.jsx`
  - Line ~193: Added `condition: 'all'` to filters state
  - Line ~775: Added condition filter logic in filteredStocks
  - Line ~3141: Updated filter button active state check
  - Line ~4470: Added Stock Condition dropdown in filter modal
  - Line ~4527: Updated reset filters to include condition

## Testing

### Test Case 1: Good Stocks
1. Open Inventory Controller → Stocks
2. Click "Filter" button
3. Select "Stock Condition" → "Good"
4. Click "Apply Filters"
5. **Expected**: Only stocks that are active, not expired, and have stock are shown

### Test Case 2: Expired Stocks
1. Click "Filter" button
2. Select "Stock Condition" → "Expired"
3. Click "Apply Filters"
4. **Expected**: Only stocks with expiration date in the past are shown

### Test Case 3: Depleted Stocks
1. Click "Filter" button
2. Select "Stock Condition" → "Depleted"
3. Click "Apply Filters"
4. **Expected**: Only stocks with zero quantity or "Out of Stock" status are shown

### Test Case 4: Filter Combination
1. Click "Filter" button
2. Select "Usage Type" → "Salon Use Only"
3. Select "Stock Condition" → "Expired"
4. Click "Apply Filters"
5. **Expected**: Only expired salon-use stocks are shown

### Test Case 5: Reset Filters
1. Apply any condition filter
2. Click "Reset Filters"
3. **Expected**: Condition filter returns to "All Conditions" and all stocks are shown

## Benefits

1. **Improved Inventory Management**: Quickly identify stocks by condition
2. **Better Expiry Control**: Easily find and manage expired products
3. **Efficient Reordering**: Identify depleted stocks that need replenishment
4. **Cleaner Stock View**: Focus on good, usable inventory
5. **Compliance**: Ensure expired products are identified and removed
6. **Time Savings**: No need to manually scan through all stocks

## Future Enhancements

Potential improvements:
1. Add "Near Expiry" condition (e.g., expiring within 30 days)
2. Add "Low Stock" condition (below minimum threshold)
3. Add color coding for different conditions in the table
4. Add quick filter buttons above the table (like tabs)
5. Add condition statistics in the dashboard
