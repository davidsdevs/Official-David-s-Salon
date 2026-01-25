# Stock Adjustments History Improvements

## Changes Made

Updated the Stock Adjustments History section in the Inventory Controller Stocks page with the following improvements:

### 1. Pagination (Show 5 Records Per Page)
- **Default Display**: Shows only 5 adjustments per page
- **Pagination Controls**: Previous/Next buttons with page indicator
- **Page Info**: Shows "Showing X to Y of Z adjustments"
- **Auto-Reset**: Returns to page 1 when filters change

### 2. Custom Date Range Filter
- **Replaced**: Dropdown filter (All Time, Last 7 Days, etc.)
- **New**: Two date input fields (Start Date and End Date)
- **Flexibility**: Users can select any custom date range
- **Format**: Standard date picker inputs

### 3. Print Functionality
- **Print Button**: New button next to Refresh
- **Print Preview**: Opens in new window with formatted table
- **Includes**:
  - Branch name
  - Date range
  - Print date/time
  - All adjustments (not just current page)
  - Formatted table with all columns
  - Print and Close buttons

### 4. Scrollable Table
- **Max Height**: 384px (24rem)
- **Vertical Scroll**: Table body scrolls when content exceeds height
- **Sticky Header**: Table header stays visible while scrolling
- **Horizontal Scroll**: Maintains horizontal scrolling for wide tables

## Implementation Details

### State Variables Added
```javascript
const [adjustmentStartDate, setAdjustmentStartDate] = useState('');
const [adjustmentEndDate, setAdjustmentEndDate] = useState('');
const [adjustmentsPage, setAdjustmentsPage] = useState(1);
const adjustmentsPerPage = 5;
```

### Removed State
```javascript
// Removed: const [adjustmentDateFilter, setAdjustmentDateFilter] = useState('all');
```

### Date Range Logic
```javascript
// Use custom date range if provided
let startTimestamp = null;
let endTimestamp = null;

if (adjustmentStartDate) {
  const start = new Date(adjustmentStartDate);
  start.setHours(0, 0, 0, 0);
  startTimestamp = Timestamp.fromDate(start);
}

if (adjustmentEndDate) {
  const end = new Date(adjustmentEndDate);
  end.setHours(23, 59, 59, 999);
  endTimestamp = Timestamp.fromDate(end);
}
```

### Pagination Logic
```javascript
const paginatedAdjustments = useMemo(() => {
  const startIndex = (adjustmentsPage - 1) * adjustmentsPerPage;
  const endIndex = startIndex + adjustmentsPerPage;
  return stockAdjustments.slice(startIndex, endIndex);
}, [stockAdjustments, adjustmentsPage, adjustmentsPerPage]);
```

### Print Function
```javascript
const handlePrintAdjustments = () => {
  // Opens new window with formatted HTML table
  // Includes all adjustments (not paginated)
  // Styled for printing
  // Print and Close buttons
};
```

## UI Changes

### Before
```
[Dropdown: All Time ▼] [Refresh]
```

### After
```
[Start Date] to [End Date] [Refresh] [Print]
```

### Table Container
```html
<div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
  <table className="w-full">
    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
      <!-- Header stays visible while scrolling -->
    </thead>
    <tbody>
      <!-- Only 5 records shown -->
    </tbody>
  </table>
</div>
```

### Pagination Controls
```html
<div className="flex items-center justify-between mt-4 pt-4 border-t">
  <div className="text-sm text-gray-600">
    Showing 1 to 5 of 50 adjustments
  </div>
  <div className="flex items-center gap-2">
    <Button [Previous]>
    <span>Page 1 of 10</span>
    <Button [Next]>
  </div>
</div>
```

## User Experience

### Viewing Adjustments
1. **Default View**: Shows first 5 adjustments
2. **Scroll**: Scroll vertically within table to see all columns
3. **Navigate**: Use Previous/Next buttons to see more records
4. **Filter**: Select date range and click Refresh
5. **Print**: Click Print button to generate printable report

### Date Range Selection
1. Click Start Date input
2. Select start date from calendar
3. Click End Date input
4. Select end date from calendar
5. Click Refresh to load adjustments in range

### Printing
1. Click Print button
2. New window opens with formatted table
3. Review the report
4. Click Print button in new window
5. Select printer and print
6. Close window when done

## Benefits

### 1. Better Performance
- Only 5 records rendered at a time
- Faster initial load
- Smoother scrolling

### 2. Improved Usability
- Custom date ranges for specific periods
- Easy navigation with pagination
- Clear page indicators

### 3. Professional Reporting
- Print-friendly format
- Includes all necessary information
- Branded with branch name

### 4. Better Organization
- Scrollable table prevents page overflow
- Sticky header maintains context
- Clean, organized layout

## Testing

### Test Case 1: Pagination
1. Load Stock Adjustments History
2. Verify only 5 records shown
3. Click Next button
4. Verify next 5 records shown
5. Verify page indicator updates

### Test Case 2: Custom Date Range
1. Select Start Date (e.g., Jan 1, 2026)
2. Select End Date (e.g., Jan 31, 2026)
3. Click Refresh
4. Verify only adjustments in range shown
5. Verify pagination resets to page 1

### Test Case 3: Print
1. Load adjustments
2. Click Print button
3. Verify new window opens
4. Verify all adjustments included (not just current page)
5. Verify formatting is correct
6. Click Print button in new window
7. Verify print dialog opens

### Test Case 4: Scrolling
1. Load adjustments with many records
2. Scroll vertically in table
3. Verify header stays visible
4. Scroll horizontally
5. Verify all columns accessible

### Test Case 5: Empty State
1. Select date range with no adjustments
2. Click Refresh
3. Verify "No stock adjustments found" message
4. Verify pagination hidden

## Files Modified
- `src/pages/inventory/Stocks.jsx`
  - Line ~123: Updated state variables (removed adjustmentDateFilter, added adjustmentStartDate, adjustmentEndDate, adjustmentsPage)
  - Line ~2359: Updated loadStockAdjustments to use custom date range
  - Line ~2600: Added paginatedAdjustments useMemo
  - Line ~2615: Added handlePrintAdjustments function
  - Line ~2680: Updated Stock Adjustments History UI with date inputs, print button, scrollable table, and pagination

## Icons Used
- `Printer` - Print button
- `ChevronLeft` - Previous page button
- `ChevronRight` - Next page button
- `RefreshCw` - Refresh button (existing)

## Styling Classes
- `max-h-96` - Maximum height of 384px for table
- `overflow-y-auto` - Vertical scrolling
- `sticky top-0` - Sticky header
- `border border-gray-200 rounded-lg` - Table container border

## Future Enhancements
1. Export to Excel/CSV
2. Email report functionality
3. Save custom date ranges as presets
4. Filter by adjustment type
5. Sort by column headers
6. Bulk actions on adjustments
