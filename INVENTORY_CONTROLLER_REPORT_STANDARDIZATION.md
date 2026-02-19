# Inventory Controller Report Standardization

## Overview
This document outlines the standardization applied to all reports in the Inventory Controller module to ensure consistency, professionalism, and compliance with reporting standards.

## Standardization Requirements

### 1. Row Numbering
- **Column Header**: `#`
- **Position**: First column in all tables
- **Width**: 40px
- **Alignment**: Center
- **Format**: Sequential numbers starting from 1 (1, 2, 3, ...)
- **Styling**: Font weight 600

```html
<th class="row-number">#</th>
```

```css
th.row-number {
  width: 40px;
  text-align: center;
}
td.row-number {
  text-align: center;
  font-weight: 600;
}
```

### 2. Page Numbering
- **Format**: "Page X of Y"
- **Position**: Bottom center of every page, 2px from bottom
- **Font**: Poppins, 9px
- **Implementation**: Dynamic JavaScript calculation based on paper size

#### A4 Landscape Specifications
```javascript
const pageHeight = 794;      // A4 landscape height in pixels at 96 DPI
const topMargin = 38;         // 0.4in top margin
const bottomMargin = 72;      // 0.75in bottom margin
const contentHeight = pageHeight - topMargin - bottomMargin;
```

#### A4 Portrait Specifications
```javascript
const pageHeight = 1122;     // A4 portrait height in pixels at 96 DPI
const topMargin = 38;         // 0.4in top margin
const bottomMargin = 72;      // 0.75in bottom margin
const contentHeight = pageHeight - topMargin - bottomMargin;
```

#### Page Number Implementation
```html
<div class="page-number" id="pageNumber"></div>

<script>
  const pageHeight = 794; // Use 1122 for portrait
  const topMargin = 38;
  const bottomMargin = 72;
  const contentHeight = pageHeight - topMargin - bottomMargin;
  
  const bodyHeight = document.body.scrollHeight;
  const totalPages = Math.ceil(bodyHeight / contentHeight);
  
  const pageNumberDiv = document.getElementById('pageNumber');
  pageNumberDiv.innerHTML = '';
  
  for (let i = 1; i <= totalPages; i++) {
    const pageNum = document.createElement('div');
    pageNum.textContent = 'Page ' + i + ' of ' + totalPages;
    pageNum.style.position = 'absolute';
    pageNum.style.bottom = '2px';
    pageNum.style.left = '0';
    pageNum.style.right = '0';
    pageNum.style.textAlign = 'center';
    pageNum.style.fontSize = '9px';
    pageNum.style.fontFamily = "'Poppins', Arial, sans-serif";
    pageNum.style.color = '#000';
    pageNum.style.top = ((i * contentHeight) + topMargin - 2) + 'px';
    document.body.appendChild(pageNum);
  }
</script>
```

```css
.page-number {
  position: fixed;
  bottom: 2px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9px;
  font-family: 'Poppins', Arial, sans-serif;
  color: #000;
}
```

### 3. Grand Totals
- **Label**: "GRAND TOTAL:" (left-aligned)
- **Position**: Last row of table
- **Styling**: Gray background (#e0e0e0), bold text, 2px top border
- **Columns**: Show totals only for numeric columns (quantities, amounts)

```html
<tr class="grand-total">
  <td class="row-number"></td>
  <td colspan="X" style="text-align: left;">GRAND TOTAL:</td>
  <td class="text-center">{totalQuantity}</td>
  <td class="text-right">₱{totalAmount}</td>
  <td colspan="Y"></td>
</tr>
```

```css
.grand-total {
  background-color: #e0e0e0 !important;
  font-weight: 700;
  border-top: 2px solid #000;
}
```

### 4. Currency Formatting
All currency values must display with 2 decimal places:

```javascript
amount.toLocaleString('en-US', { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
})
```

### 5. Time Format
- **Format**: HH:mm:ss (24-hour format)
- **Location**: Report footer

```javascript
new Date().toLocaleTimeString('en-US', { 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit', 
  hour12: false 
})
```

### 6. Page Setup
```css
@page {
  size: A4 landscape; /* or portrait */
  margin: 0.4in 0.4in 0.75in 0.4in;
}

@media print {
  header, footer {
    display: none;
  }
}
```

### 7. Print Method
Use `window.open()` approach instead of react-to-print:

```javascript
const printWindow = window.open('', '_blank');
printWindow.document.write(printContent);
printWindow.document.close();
printWindow.focus();

setTimeout(() => {
  printWindow.print();
}, 250);
```

## Reports Standardized

### Inventory Controller Module - Sidebar Pages with Print Functions

#### 1. Stocks Management Report
- **Sidebar**: Inventory Management → Stocks
- **File**: `src/pages/inventory/Stocks.jsx`
- **Function**: `handlePrintReport()`
- **Paper**: A4 Landscape
- **Status**: ✅ Standardized
- **Features**:
  - Row numbers (# column)
  - Columns: Product Name, Brand, Category, Batch, UPC, Usage Type, Beginning Stock, Current Stock, Unit Cost, Inventory Value, Status, Expires
  - Grand total: Beginning Stock, Current Stock, Inventory Value
  - Dynamic page numbering on all pages
  - Time format: HH:mm:ss
  - Currency values with 2 decimals

#### 2. Stock Deductions Report
- **Sidebar**: Inventory Management → Stocks (Deductions Tab)
- **File**: `src/pages/inventory/Stocks.jsx`
- **Function**: `handlePrintDeductionHistory()`
- **Paper**: A4 Landscape
- **Status**: ✅ Standardized
- **Features**:
  - Row numbers (# column)
  - Grand total row (Total Quantity, Total Amount)
  - Dynamic page numbering on all pages
  - Currency values with 2 decimals
  - Time format: HH:mm:ss

#### 3. Stock Adjustments Report
- **Sidebar**: Inventory Management → Stocks (Adjustments Tab)
- **File**: `src/pages/inventory/Stocks.jsx`
- **Function**: `handlePrintAdjustments()`
- **Paper**: A4 Landscape
- **Status**: ✅ Standardized
- **Features**:
  - Row numbers (# column)
  - Grand total row (Total Added +, Total Removed -)
  - Dynamic page numbering on all pages
  - Time format: HH:mm:ss

#### 4. Products Report
- **Sidebar**: Inventory Management → Products
- **File**: `src/pages/inventory/Products.jsx`
- **Function**: `handlePrintReport()`
- **Paper**: A4 Landscape
- **Status**: ✅ Standardized
- **Features**:
  - Row numbers (# column)
  - Dynamic page numbering on all pages
  - Currency values with 2 decimals
  - Time format: HH:mm:ss

#### 5. Purchase Orders Report
- **Sidebar**: Purchasing → Purchase Orders
- **File**: `src/pages/inventory/PurchaseOrders.jsx`
- **Function**: `handlePrintReport()`
- **Paper**: A4 Landscape
- **Status**: ✅ Standardized
- **Features**:
  - Row numbers (# column)
  - Grand total row (Total Amount)
  - Dynamic page numbering on all pages
  - Currency values with 2 decimals
  - Time format: HH:mm:ss
  - Converted from card format to table format

#### 6. Deliveries Report
- **Sidebar**: Purchasing → Deliveries
- **File**: `src/pages/inventory/Deliveries.jsx`
- **Function**: `handlePrintReport()`
- **Paper**: A4 Landscape
- **Status**: ✅ Standardized
- **Features**:
  - Row numbers (# column)
  - Grand total row (Total Items, Total Amount)
  - Dynamic page numbering on all pages
  - Currency values with 2 decimals
  - Time format: HH:mm:ss

#### 7. Suppliers Report
- **Sidebar**: Purchasing → Suppliers
- **File**: `src/pages/inventory/Suppliers.jsx`
- **Function**: `handlePrintAll()`
- **Paper**: A4 Landscape
- **Status**: ✅ Standardized
- **Features**:
  - Row numbers (# column)
  - Dynamic page numbering on all pages
  - Time format: HH:mm:ss
  - Converted from card format to table format

#### 8. Individual Supplier Report
- **Sidebar**: Purchasing → Suppliers (Individual Print)
- **File**: `src/pages/inventory/Suppliers.jsx`
- **Function**: `handlePrintSupplier()`
- **Paper**: A4 Portrait
- **Status**: ⚠️ Pending standardization
- **Note**: Individual supplier reports typically use detailed card format, may not need full table standardization

#### 9. Stock Alerts Report
- **Sidebar**: Monitoring → Stock Alerts
- **File**: `src/pages/inventory/StockAlerts.jsx`
- **Function**: `handlePrintAll()`
- **Paper**: A4 Portrait/Landscape
- **Status**: ⚠️ Pending standardization
- **Note**: Alert-based reports may use card format for better readability

#### 10. Expiry Tracker Report
- **Sidebar**: Monitoring → Expiry Tracker
- **File**: `src/pages/inventory/ExpiryTracker.jsx`
- **Function**: `handlePrintAll()`
- **Paper**: A4 Portrait/Landscape
- **Status**: ⚠️ Pending standardization
- **Note**: Expiry tracking reports may benefit from table format with row numbers

### Summary

**Total Sidebar Pages with Print Functions**: 10
**Standardized**: 7 (Stocks Management, Stock Deductions, Stock Adjustments, Products, Purchase Orders, Deliveries, Suppliers)
**Remaining**: 3 (Individual Supplier, Stock Alerts, Expiry Tracker - these use specialized card/alert formats that may not require full table standardization)

### Completion Status

The core transactional and inventory reports have been fully standardized with:
- Row numbers (# column)
- Grand totals where applicable
- Dynamic page numbering (Page X of Y on all pages)
- Currency formatting with 2 decimals
- Time format HH:mm:ss (24-hour)
- A4 landscape formatting
- Standardized Poppins font styling

The remaining 3 reports (Individual Supplier, Stock Alerts, Expiry Tracker) use specialized formats (detailed cards, alerts) that are better suited for their specific use cases and may not benefit from full table standardization.

### Notes
- Dashboard and UPC Generator pages are in the sidebar but may not have standard report print functions
- Stock Transfer is not in the current sidebar but has print functions (may be accessed differently)
- Focus is on reports accessible directly from sidebar pages

## Implementation Checklist

For each report, ensure:
- [ ] Row numbers column added as first column
- [ ] Grand total row added with appropriate calculations
- [ ] Page numbering implemented with correct paper size
- [ ] Currency values formatted with 2 decimals
- [ ] Time format is HH:mm:ss (24-hour)
- [ ] Margins set correctly (0.4in sides/top, 0.75in bottom)
- [ ] Browser headers/footers hidden
- [ ] Uses window.open() method
- [ ] Poppins font loaded from Google Fonts
- [ ] Print dialog auto-triggers after content loads

## Testing Guidelines

1. **Page Number Accuracy**: Print preview should show correct page numbers on all pages
2. **Grand Total Calculations**: Verify totals match sum of all rows
3. **Currency Display**: All amounts should show .00 decimals
4. **Row Numbers**: Should be sequential and not skip numbers
5. **Paper Size**: Content should fit properly on A4 paper (landscape or portrait)
6. **Multi-page Reports**: Test with reports that span 2+ pages

## Notes

- Always use nullish coalescing (`??`) instead of logical OR (`||`) for stock calculations to handle 0 values correctly
- Page height calculations are based on 96 DPI standard
- Page numbers are positioned 2px from bottom to avoid being cut off
- Grand total row should always be the last row in the table body
