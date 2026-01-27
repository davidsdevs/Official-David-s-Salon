# Branch Manager Reports Standardization

## Current Status
The Branch Manager Reports page (`src/pages/branch-manager/Reports.jsx`) is 2436 lines and contains multiple report types with existing print functionality using `react-to-print`.

## Reports to Standardize

### 1. Revenue Report ⭐ HIGH PRIORITY
- **Current**: Uses react-to-print with hidden div
- **Filters**: Date range, transaction type, status, view type (period/yearly)
- **Data**: Transactions with totals
- **Action**: Replace with standardized print utility

### 2. Transaction Report
- **Current**: Uses react-to-print
- **Filters**: Date range, yearly view toggle
- **Data**: Transaction list with details
- **Action**: Replace with standardized print utility

### 3. Service Performance Report
- **Current**: Uses react-to-print
- **Filters**: Date range
- **Data**: Service-wise performance metrics
- **Action**: Replace with standardized print utility

### 4. Product Sales Report
- **Current**: Uses react-to-print
- **Filters**: Date range, yearly view toggle
- **Data**: Product sales data
- **Action**: Replace with standardized print utility

### 5. Inventory Sales Report
- **Current**: Uses react-to-print
- **Filters**: Date range
- **Data**: Inventory movement and sales
- **Action**: Replace with standardized print utility

### 6. Staff List Report
- **Current**: Uses react-to-print
- **Filters**: None (shows all staff)
- **Data**: Staff members list
- **Action**: Replace with standardized print utility

### 7. Calendar Report
- **Current**: Uses react-to-print
- **Filters**: Date range
- **Data**: Appointments calendar view
- **Action**: Replace with standardized print utility

### 8. Leave Management Report
- **Current**: Uses react-to-print
- **Filters**: Date range
- **Data**: Leave requests and status
- **Action**: Replace with standardized print utility

## Implementation Strategy

Given the file size and complexity, I recommend:

### Option A: Incremental Update (Safer)
1. Keep existing structure
2. Replace each `handlePrint` function one by one
3. Remove `printRef` and hidden divs
4. Add standardized print handlers
5. Test each report type individually

### Option B: Complete Rewrite (Cleaner)
1. Create new file with modular structure
2. Separate each report type into its own component
3. Implement standardized printing from scratch
4. Better maintainability long-term

## Recommended Approach: Option A (Incremental)

### Step 1: Update Imports
```javascript
import { 
  generatePrintHTML, 
  printReport, 
  formatCurrency, 
  formatDate,
  formatNumber 
} from '../../utils/printHelpers';
```

### Step 2: Remove react-to-print
```javascript
// REMOVE:
import { useReactToPrint } from 'react-to-print';
const printRef = useRef();
const handlePrint = useReactToPrint({...});
```

### Step 3: Create Standardized Print Handlers

#### Revenue Report Print Handler
```javascript
const handlePrintRevenueReport = () => {
  const filteredData = // ... get filtered transactions
  
  const totalRevenue = filteredData.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalTransactions = filteredData.length;
  const avgTransaction = totalRevenue / totalTransactions || 0;
  
  const htmlContent = generatePrintHTML({
    title: 'Revenue Report',
    subtitle: `${branchInfo?.name || 'Branch'} - David's Salon`,
    filters: {
      dateRange: { start: dateRange.start, end: dateRange.end },
      branch: branchInfo?.name,
      transactionType: printFilters.transactionType,
      status: printFilters.status,
      viewType: printFilters.viewType
    },
    summaryData: [
      { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { label: 'Total Transactions', value: formatNumber(totalTransactions) },
      { label: 'Average Transaction', value: formatCurrency(avgTransaction) }
    ],
    tableHeaders: [
      { label: 'Date', align: 'text-left' },
      { label: 'Transaction ID', align: 'text-left' },
      { label: 'Client', align: 'text-left' },
      { label: 'Type', align: 'text-center' },
      { label: 'Amount', align: 'text-right' }
    ],
    tableRows: filteredData.map(t => [
      formatDate(t.createdAt),
      t.id.substring(0, 8),
      t.clientName || 'Walk-in',
      t.type || 'Service',
      { value: formatCurrency(t.totalAmount), className: 'currency' }
    ]),
    footerText: 'This report is generated for branch management purposes only.'
  });
  
  printReport(htmlContent);
};
```

### Step 4: Update Print Buttons
```javascript
// REPLACE:
<Button onClick={handlePrint}>Print</Button>

// WITH:
<Button onClick={handlePrintRevenueReport}>Print</Button>
```

### Step 5: Remove Hidden Print Divs
```javascript
// REMOVE all:
<div ref={printRef} className="hidden">
  {/* print content */}
</div>
```

## Testing Checklist

For each report type:
- [ ] Print button works
- [ ] Filters are displayed in print
- [ ] Summary statistics are correct
- [ ] Table data is properly formatted
- [ ] Currency values right-aligned
- [ ] Dates formatted consistently
- [ ] Poppins font loads
- [ ] Letter size optimization
- [ ] No background colors
- [ ] Page breaks appropriately

## Files to Update

1. `src/pages/branch-manager/Reports.jsx` - Main reports page
2. `src/pages/branch-manager/StaffReports.jsx` - Staff performance reports
3. `src/pages/branch-manager/Commissions.jsx` - Commission reports
4. `src/pages/branch-manager/ClientAnalytics.jsx` - Client analytics
5. `src/pages/branch-manager/Dashboard.jsx` - Dashboard (if has print)
6. `src/pages/branch-manager/ActivityLogs.jsx` - Activity logs
7. `src/pages/branch-manager/Inventory.jsx` - Inventory reports
8. `src/pages/branch-manager/Deliveries.jsx` - Delivery reports
9. `src/pages/branch-manager/Deposits.jsx` - Deposit reports

## Next Steps

1. Start with Revenue Report (most complex)
2. Test thoroughly
3. Apply same pattern to other report types
4. Move to next file (StaffReports.jsx)
5. Continue until all Branch Manager reports are standardized

## Estimated Time
- Reports.jsx: 2-3 hours (8 report types)
- StaffReports.jsx: 1 hour
- Commissions.jsx: 1 hour
- Other pages: 2-3 hours
- **Total**: 6-8 hours for all Branch Manager reports
