# Dual Receipt Generation Implementation

## Overview
Implement a dual receipt printing system where receptionists can print both a Merchant's Copy and a Customer's Copy based on system settings controlled by the System Admin.

## Implementation Date
February 19, 2026

## Requirements

### 1. Receipt Types
- **Merchant's Copy**: Always printed first, labeled "MERCHANT'S COPY" at the top
- **Customer's Copy**: Optionally printed second, labeled "CUSTOMER'S COPY" at the top (only if enabled in settings)

### 2. System Settings Control
- System Admin can toggle "Print Customer Copy" option in Receipt Settings
- Setting location: System Settings Page → Receipt Settings section
- Default value: Enabled (true)

### 3. Receipt Label Placement
- Copy type label must appear at the very top of the receipt
- Position: Above "DAVID'S SALON" header
- Format: Bold, centered, uppercase text
- Example:
  ```
  MERCHANT'S COPY
  
  DAVID'S SALON
  [rest of receipt content]
  ```

### 4. User Access
- **System Admin**: Can enable/disable customer copy printing in settings
- **Receptionist**: Can only print receipts based on the current setting (cannot override)

## Technical Implementation

### Database Schema

#### System Settings Collection: `systemSettings`
Add new field to receipt settings:
```javascript
{
  receiptSettings: {
    printCustomerCopy: true,  // Boolean - controls if customer copy is printed
    // ... other receipt settings
  }
}
```

### Files to Modify

#### 1. System Settings Page
**File**: `src/pages/system-admin/SystemSettings.jsx` (or similar)

Add toggle control in Receipt Settings section:
```jsx
<div className="setting-item">
  <label>Print Customer Copy</label>
  <Toggle
    checked={settings.receiptSettings.printCustomerCopy}
    onChange={(value) => handleSettingChange('receiptSettings.printCustomerCopy', value)}
  />
  <p className="text-sm text-gray-600">
    When enabled, receptionists will print both merchant and customer copies of receipts
  </p>
</div>
```

#### 2. Receptionist Billing/POS Component
**File**: `src/pages/receptionist/Billing.jsx` or `src/components/billing/BillingModalPOS.jsx`

**Current Flow**:
- Single receipt print on transaction completion

**New Flow**:
1. Fetch receipt settings from system settings
2. Print Merchant's Copy (always)
3. If `printCustomerCopy` is enabled, print Customer's Copy

**Implementation**:
```javascript
// Fetch system settings
const [receiptSettings, setReceiptSettings] = useState({
  printCustomerCopy: true
});

useEffect(() => {
  const fetchReceiptSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'systemSettings', 'receiptSettings'));
      if (settingsDoc.exists()) {
        setReceiptSettings(settingsDoc.data());
      }
    } catch (error) {
      console.error('Error fetching receipt settings:', error);
    }
  };
  fetchReceiptSettings();
}, []);

// Modified print function
const handlePrintReceipt = async (transactionData) => {
  try {
    // Print Merchant's Copy (always)
    await printReceipt(transactionData, 'MERCHANT\'S COPY');
    
    // Print Customer's Copy (if enabled)
    if (receiptSettings.printCustomerCopy) {
      // Small delay to ensure first print completes
      await new Promise(resolve => setTimeout(resolve, 500));
      await printReceipt(transactionData, 'CUSTOMER\'S COPY');
    }
    
    toast.success('Receipt(s) printed successfully');
  } catch (error) {
    console.error('Error printing receipt:', error);
    toast.error('Failed to print receipt');
  }
};

// Updated receipt generation function
const printReceipt = (transactionData, copyType) => {
  const receiptHTML = generateReceiptHTML(transactionData, copyType);
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(receiptHTML);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

// Updated HTML generation with copy type label
const generateReceiptHTML = (transactionData, copyType) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${copyType}</title>
        <style>
          @media print {
            @page { margin: 0; }
            body { margin: 0.5cm; }
          }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            margin: 0 auto;
            padding: 10px;
          }
          .copy-type {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            letter-spacing: 1px;
          }
          .header {
            text-align: center;
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 5px;
          }
          /* ... rest of receipt styles ... */
        </style>
      </head>
      <body>
        <div class="copy-type">${copyType}</div>
        <div class="header">DAVID'S SALON</div>
        <!-- Rest of receipt content -->
      </body>
    </html>
  `;
};
```

### Receipt Layout Structure

```
┌─────────────────────────────────┐
│      MERCHANT'S COPY            │  ← Copy type label (bold, centered)
│                                 │
│        DAVID'S SALON            │  ← Salon name
│     123 Main Street             │
│   City, Province 1234           │
│   Tel: (123) 456-7890           │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ Receipt #: 2024-001             │
│ Date: Feb 19, 2026 14:30        │
│ Cashier: Jane Doe               │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ ITEMS:                          │
│ Haircut              ₱350.00    │
│ Hair Color           ₱800.00    │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ Subtotal:           ₱1,150.00   │
│ Discount:              ₱50.00   │
│ Total:              ₱1,100.00   │
│                                 │
│ Payment: Cash                   │
│ Amount Paid:        ₱1,200.00   │
│ Change:               ₱100.00   │
│                                 │
│ ─────────────────────────────── │
│                                 │
│   Thank you for your visit!     │
│                                 │
└─────────────────────────────────┘
```

## User Experience Flow

### System Admin Flow
1. Navigate to System Settings
2. Go to Receipt Settings section
3. Toggle "Print Customer Copy" on/off
4. Save settings
5. Setting applies immediately to all receptionists

### Receptionist Flow

**When Customer Copy is ENABLED**:
1. Complete transaction
2. Click "Print Receipt" button
3. System prints Merchant's Copy first
4. System automatically prints Customer's Copy second
5. Receptionist gives Customer's Copy to customer
6. Receptionist keeps Merchant's Copy for records

**When Customer Copy is DISABLED**:
1. Complete transaction
2. Click "Print Receipt" button
3. System prints only Merchant's Copy
4. Receptionist keeps receipt for records

## Benefits

1. **Compliance**: Merchant's copy always printed for record-keeping
2. **Flexibility**: System Admin can control customer copy printing based on business needs
3. **Cost Savings**: Can disable customer copy to save paper when not needed
4. **Clear Labeling**: Each copy clearly marked to prevent confusion
5. **Audit Trail**: Merchant's copy ensures transaction records are maintained

## Edge Cases & Considerations

### 1. Print Failure
- If Merchant's Copy fails: Show error, don't print Customer's Copy
- If Customer's Copy fails: Show warning but transaction is still complete (Merchant's Copy already printed)

### 2. Setting Changes
- Changes to print settings apply immediately
- No need to restart application
- Active print jobs use the setting value at the time of printing

### 3. Manual Reprint
- If receptionist needs to reprint, both copies print again (if enabled)
- Consider adding option to print specific copy type on reprint

### 4. Multiple Printers
- If business has multiple printers, ensure both copies go to the same printer
- Consider adding printer selection in settings

## Testing Checklist

### System Admin Tests
- [ ] Can access Receipt Settings in System Settings
- [ ] Can toggle "Print Customer Copy" on/off
- [ ] Setting saves successfully
- [ ] Setting persists after page refresh
- [ ] Setting applies to all receptionists immediately

### Receptionist Tests (Customer Copy ENABLED)
- [ ] Merchant's Copy prints first with correct label
- [ ] Customer's Copy prints second with correct label
- [ ] Both copies have identical content (except label)
- [ ] Both copies print automatically without additional clicks
- [ ] Success message shows after both copies print

### Receptionist Tests (Customer Copy DISABLED)
- [ ] Only Merchant's Copy prints
- [ ] No Customer's Copy is printed
- [ ] Success message shows after Merchant's Copy prints
- [ ] No errors or warnings about missing Customer's Copy

### Receipt Content Tests
- [ ] Copy type label appears at the very top
- [ ] Copy type label is bold and centered
- [ ] "DAVID'S SALON" header appears below copy type label
- [ ] All transaction details are correct on both copies
- [ ] Receipt formatting is consistent between copies

### Error Handling Tests
- [ ] Graceful handling if settings cannot be fetched
- [ ] Default to enabled if settings are missing
- [ ] Error message if Merchant's Copy fails to print
- [ ] Warning message if Customer's Copy fails (but transaction completes)

## Implementation Priority

1. **High Priority**: Add setting to System Settings page
2. **High Priority**: Modify receipt printing logic in Receptionist component
3. **High Priority**: Add copy type label to receipt template
4. **Medium Priority**: Add error handling for print failures
5. **Low Priority**: Add manual reprint with copy type selection

## Future Enhancements

1. **Copy Type Selection**: Allow receptionist to manually select which copy to print on reprint
2. **Email Receipt**: Option to email Customer's Copy instead of printing
3. **Print Preview**: Show preview before printing with copy type indicated
4. **Print Count**: Track how many copies of each type have been printed
5. **Printer Selection**: Allow different printers for Merchant vs Customer copies
6. **SMS Receipt**: Option to send receipt via SMS instead of printing

## Notes

- The Merchant's Copy is ALWAYS printed regardless of settings (for compliance and record-keeping)
- Only the Customer's Copy printing can be controlled by the System Admin
- The copy type label should be clearly visible and distinguishable
- Consider paper size and printer compatibility when implementing
- Test with actual thermal printers commonly used in salons

## Related Files

- `src/pages/system-admin/SystemSettings.jsx` - System settings page
- `src/pages/receptionist/Billing.jsx` - Receptionist billing page
- `src/components/billing/BillingModalPOS.jsx` - POS modal component
- `src/services/receiptService.js` - Receipt generation service (if exists)
- `src/utils/printUtils.js` - Print utility functions (if exists)

## Database Collections

- `systemSettings` - Stores receipt settings including printCustomerCopy flag
- `transactions` - Transaction records (no changes needed)

## Success Criteria

✅ System Admin can toggle customer copy printing in settings
✅ Merchant's Copy always prints with "MERCHANT'S COPY" label at top
✅ Customer's Copy prints only when enabled with "CUSTOMER'S COPY" label at top
✅ Both copies have identical content except for the copy type label
✅ Copy type label appears above "DAVID'S SALON" header
✅ Setting changes apply immediately to all receptionists
✅ Proper error handling for print failures
✅ Clear user feedback on print success/failure
