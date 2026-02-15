# Tax Configuration - Quick Start Guide

## Access Tax Configuration

1. **Login as System Admin**
2. **Navigate to**: Configuration → Tax Configuration
3. **URL**: `/admin/tax-configuration`

## Configure Tax Settings

### Step 1: Set VAT Rate
- Default: 12% (Philippines standard)
- Toggle: VAT Inclusive (VAT included in prices) or Exclusive (VAT added on top)
- Set minimum amount threshold if needed

### Step 2: Set Service Charge (Optional)
- Default: 0%
- Common: 10% for hospitality
- Toggle: Inclusive or Exclusive

### Step 3: Configure Special Discounts
- Senior Citizen: 20% (Philippine law)
- PWD: 20% (Philippine law)
- Enable VAT exemption for senior/PWD

### Step 4: Save Configuration
- Click "Save Changes"
- Configuration applies immediately to all new transactions

## How It Works

### Automatic Application
- Tax configuration is automatically applied to ALL transactions
- No manual intervention needed at checkout
- Works in Receptionist Checkout and Billing POS

### Calculation Example

**Regular Transaction (₱1,000)**
```
Subtotal:     ₱1,000.00
VAT (12%):    ₱107.14 (inclusive)
Total:        ₱1,000.00
```

**Senior Citizen (₱1,000)**
```
Subtotal:     ₱1,000.00
Discount:     -₱200.00 (20%)
VAT:          ₱0.00 (exempt)
Total:        ₱800.00
```

**With Service Charge (₱1,000)**
```
Subtotal:     ₱1,000.00
VAT (12%):    ₱107.14 (inclusive)
Service:      +₱100.00 (10% exclusive)
Total:        ₱1,100.00
```

## Key Features

✅ **VAT Configuration** - Set rate, inclusive/exclusive, minimum threshold
✅ **Service Charge** - Optional additional charge
✅ **Senior Citizen Discount** - 20% with VAT exemption
✅ **PWD Discount** - 20% with VAT exemption
✅ **Real-time Preview** - See calculations before saving
✅ **Validation** - Prevents invalid configurations
✅ **Activity Logging** - All changes tracked
✅ **BIR Compliant** - Philippine tax law compliance

## Philippine Tax Compliance

### VAT (12%)
- Standard rate for most goods and services
- Must be shown on receipts
- Can be inclusive or exclusive

### Senior Citizen (RA 9994)
- 20% discount on goods and services
- Exempt from 12% VAT
- Requires valid senior citizen ID

### PWD (RA 10754)
- 20% discount on goods and services
- Exempt from 12% VAT
- Requires valid PWD ID

## Where Tax is Applied

1. **Receptionist Checkout** - Appointment billing
2. **Billing POS** - Walk-in sales
3. **Product Sales** - OTC product purchases
4. **Service Sales** - Service transactions
5. **Mixed Transactions** - Products + Services

## Receipt Display

Tax information automatically appears on receipts:
```
Subtotal:           ₱1,000.00
Tax (12%):          ₱107.14
Service Charge:     ₱100.00
─────────────────────────────
Total:              ₱1,100.00
```

## Reset to Default

If you need to reset:
1. Click "Reset to Default"
2. Confirm action
3. Default Philippine settings restored:
   - VAT: 12% (inclusive)
   - Service Charge: 0%
   - Senior Discount: 20%
   - PWD Discount: 20%
   - VAT Exempt: Yes

## Support

**Issue**: Tax not applying
**Fix**: Check if configuration is active

**Issue**: Wrong amount
**Fix**: Verify inclusive/exclusive setting

**Issue**: Can't save
**Fix**: Check validation errors

## Next Steps

1. Configure your tax settings
2. Test with a sample transaction
3. Verify receipt shows correct tax
4. Train staff on senior/PWD discounts
5. Monitor tax calculations

---

**Note**: Tax configuration applies to ALL branches and transactions. Changes take effect immediately for new transactions.
