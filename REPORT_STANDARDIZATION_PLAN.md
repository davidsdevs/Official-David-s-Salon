# Report Standardization Implementation Plan

## Objective
Standardize all 42 report pages to use:
- Letter size paper (8.5" x 11")
- Poppins font
- Ink-saving design (no fills/backgrounds)
- Display applied filters in printed output

## Utility Created
✅ `src/utils/printHelpers.js` - Reusable print formatting utility

## Implementation Approach

### Phase 1: High Priority (Revenue & Operations) - 7 Reports
1. ✅ Branch Manager - Reports
2. ✅ Receptionist - Sales Report  
3. ✅ Operational Manager - Dashboard
4. ✅ Operational Manager - Branch Performance
5. ✅ Branch Manager - Dashboard
6. ✅ Stylist - Commission
7. ✅ Branch Manager - Commissions

### Phase 2: Medium Priority (Analytics & Monitoring) - 8 Reports
8. ⬜ Operational Manager - Price History Analytics
9. ⬜ Branch Manager - Client Analytics
10. ⬜ Branch Manager - Staff Reports
11. ⬜ Stylist - Dashboard
12. ⬜ Stylist - Service History
13. ⬜ System Admin - Dashboard
14. ⬜ Overall Inventory - Dashboard
15. ⬜ Overall Inventory - Product Sales

### Phase 3: Standard Priority (Tracking & Logs) - 11 Reports
16. ⬜ Inventory - Reports
17. ⬜ Inventory - Dashboard
18. ⬜ Overall Inventory - Reports
19. ⬜ Activity Logs - System Admin
20. ⬜ Activity Logs - Operational Manager
21. ⬜ Activity Logs - Branch Manager
22. ⬜ Client - Transactions
23. ⬜ Client - Rewards
24. ⬜ Branch Manager - Inventory
25. ⬜ Branch Manager - Deliveries
26. ⬜ Branch Manager - Deposits

### Phase 4: Low Priority (Specialized Reports) - 16 Reports
27. ⬜ Inventory - Cost Analysis
28. ⬜ Inventory - Expiry Tracker
29. ⬜ Overall Inventory - Expiry Tracker
30. ⬜ Overall Inventory - Adjust Logs
31. ⬜ Inventory - Inventory Audit
32. ⬜ System Admin - Commission Management
33. ⬜ Inventory - Stock Alerts
34. ⬜ Overall Inventory - Stock Alerts
35. ⬜ Operational Manager - Inventory
36. ⬜ Operational Manager - Deposits
37. ⬜ Operational Manager - Purchase Orders
38. ⬜ Branch Manager - Purchase Orders
39. ⬜ Inventory - Purchase Orders
40. ⬜ Overall Inventory - Purchase Orders
41. ⬜ Inventory - Deliveries
42. ⬜ System Admin - Suppliers

## Standard Implementation Pattern

For each report page:

### 1. Import the utility
```javascript
import { 
  generatePrintHTML, 
  printReport, 
  formatCurrency, 
  formatDate 
} from '../../utils/printHelpers';
```

### 2. Create print handler
```javascript
const handlePrint = () => {
  const htmlContent = generatePrintHTML({
    title: 'Report Title',
    subtitle: 'David\'s Salon Management System',
    filters: {
      dateRange: { start: startDate, end: endDate },
      branch: selectedBranch,
      branchName: branchName,
      status: statusFilter,
      // ... other filters
    },
    summaryData: [
      { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
      { label: 'Total Transactions', value: transactionCount },
      // ... other summary items
    ],
    tableHeaders: [
      { label: 'Date', align: 'text-left' },
      { label: 'Description', align: 'text-left' },
      { label: 'Amount', align: 'text-right' },
      // ... other headers
    ],
    tableRows: data.map(item => [
      formatDate(item.date),
      item.description,
      { value: formatCurrency(item.amount), className: 'currency' },
      // ... other cells
    ]),
    footerText: 'This report is generated for internal use only.'
  });
  
  printReport(htmlContent);
};
```

### 3. Add print button
```javascript
<Button onClick={handlePrint} className="flex items-center gap-2">
  <Printer className="h-4 w-4" />
  Print Report
</Button>
```

## Key Requirements for Each Report

### Must Include:
- ✅ Report title
- ✅ Generation date/time
- ✅ Applied filters section
- ✅ Summary statistics (if applicable)
- ✅ Data table with proper formatting
- ✅ Footer with disclaimer
- ✅ Poppins font
- ✅ Letter size optimization
- ✅ No background colors/fills
- ✅ Proper alignment (currency right-aligned, text left-aligned)

### Design Specifications:
- **Page Size**: Letter (8.5" x 11")
- **Margins**: 0.5 inch all sides
- **Font**: Poppins (300, 400, 500, 600, 700 weights)
- **Font Sizes**:
  - Title: 18pt
  - Subtitle: 12pt
  - Section headers: 11pt
  - Body text: 10pt
  - Table text: 9pt
  - Footer: 8pt
- **Colors**: Black text only (#000, #333 for secondary)
- **Borders**: 1px or 2px solid black lines only
- **No fills**: White background only

## Testing Checklist for Each Report

- [ ] Print button is visible and accessible
- [ ] Clicking print opens print preview
- [ ] Report title is correct
- [ ] Generation date/time displays correctly
- [ ] All applied filters are shown
- [ ] Summary statistics are accurate
- [ ] Table headers are clear
- [ ] Table data is properly formatted
- [ ] Currency values are right-aligned with ₱ symbol
- [ ] Dates are formatted consistently
- [ ] Page breaks appropriately for long reports
- [ ] Footer displays correctly
- [ ] No background colors in print
- [ ] Poppins font loads correctly
- [ ] Content fits within letter size margins
- [ ] Print is ink-efficient

## Notes

- Some reports may need custom table structures
- Charts/graphs should be converted to tables for printing
- Very long reports may need page break optimization
- Some reports may have multiple print options (summary vs detailed)

## Progress Tracking

**Total Reports**: 42
**Completed**: 0
**In Progress**: 0
**Remaining**: 42

**Estimated Time**: 
- Phase 1: 3-4 hours
- Phase 2: 3-4 hours
- Phase 3: 4-5 hours
- Phase 4: 6-8 hours
- **Total**: 16-21 hours

## Next Steps

1. Start with Phase 1 (High Priority reports)
2. Test each implementation thoroughly
3. Move to next phase after completion
4. Document any issues or special cases
5. Final review and testing of all reports
