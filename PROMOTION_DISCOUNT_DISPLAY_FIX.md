# Promotion Discount Display Enhancement

## Issue
The promotion code discount was showing as "₱0.00" and didn't display the discount percentage next to the promotion name.

## Solution Implemented

### 1. Enhanced Bill Breakdown Display
Updated the "Bill Breakdown" section to show:
- **Promotion name** below the discount amount
- **Discount percentage** (if percentage-based) next to "Promotion" label
- **Actual discount amount** in red

**Before:**
```
Promotions
-₱0.00
```

**After:**
```
Promotion (20%)
-₱700.00
Bearded Men? You are Discounted!
```

### 2. Enhanced Applied Promotion Display
Updated the applied promotion confirmation to show:
- **Promotion name**
- **Discount percentage** (if applicable)
- **Actual discount amount**

**Before:**
```
✓ Bearded Men? You are Discounted! - ₱0.00 off
```

**After:**
```
✓ Bearded Men? You are Discounted! (20%) - ₱700.00 off
```

## Changes Made

### File: `src/components/billing/TwoStepCheckoutModal.jsx`

#### 1. Bill Breakdown Section (Lines ~790-800)
```javascript
{/* Promotions - Only show if exists */}
{formData.promotionDiscount > 0 && appliedPromotion && (
  <div className="bg-white rounded-lg p-4 border-2 border-red-200">
    <span className="text-sm text-gray-600 font-medium block mb-1">
      Promotion
      {appliedPromotion.discountType === 'percentage' && (
        <span className="ml-1 text-red-600">({appliedPromotion.discountValue}%)</span>
      )}
    </span>
    <span className="text-2xl font-bold text-red-600">-₱{formData.promotionDiscount.toFixed(2)}</span>
    <span className="text-xs text-gray-500 block mt-1">{appliedPromotion.name}</span>
  </div>
)}
```

#### 2. Applied Promotion Confirmation (Lines ~644-654)
```javascript
{appliedPromotion && (
  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
    <div className="flex items-center gap-2">
      <CheckCircle className="w-4 h-4 text-green-600" />
      <span className="text-sm text-green-800 font-bold">
        {appliedPromotion.name}
        {appliedPromotion.discountType === 'percentage' && (
          <span className="ml-1">({appliedPromotion.discountValue}%)</span>
        )}
        {' '}- ₱{formData.promotionDiscount.toFixed(2)} off
      </span>
    </div>
  </div>
)}
```

## Display Examples

### Example 1: Percentage-Based Promotion (20% off)
**Subtotal:** ₱3,500.00

**Bill Breakdown:**
```
┌─────────────────────────────┐
│ Subtotal                    │
│ ₱3,500.00                   │
└─────────────────────────────┘

┌─────────────────────────────┐
│ VAT (12%)                   │
│ +₱375.00                    │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Promotion (20%)             │
│ -₱700.00                    │
│ Bearded Men? You are        │
│ Discounted!                 │
└─────────────────────────────┘

Total Due: ₱3,175.00
```

**Applied Promotion:**
```
✓ Bearded Men? You are Discounted! (20%) - ₱700.00 off
```

### Example 2: Fixed Amount Promotion (₱500 off)
**Subtotal:** ₱2,000.00

**Bill Breakdown:**
```
┌─────────────────────────────┐
│ Subtotal                    │
│ ₱2,000.00                   │
└─────────────────────────────┘

┌─────────────────────────────┐
│ VAT (12%)                   │
│ +₱214.29                    │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Promotion                   │
│ -₱500.00                    │
│ New Customer Discount       │
└─────────────────────────────┘

Total Due: ₱1,714.29
```

**Applied Promotion:**
```
✓ New Customer Discount - ₱500.00 off
```

## Features

### ✅ Shows Discount Percentage
- Only displays for percentage-based promotions
- Shows in red next to "Promotion" label
- Format: `Promotion (20%)`

### ✅ Shows Promotion Name
- Displays below the discount amount
- Small gray text for clarity
- Full promotion name visible

### ✅ Shows Actual Discount Amount
- Large, bold red text
- Format: `-₱700.00`
- Clearly visible in breakdown

### ✅ Conditional Display
- Only shows when `formData.promotionDiscount > 0`
- Only shows when `appliedPromotion` exists
- Prevents showing "₱0.00" discounts

## Testing

### Test Case 1: Percentage Promotion
1. Add service worth ₱3,500
2. Apply promotion code: "BEARDED20" (20% off)
3. **Expected:**
   - Breakdown shows: "Promotion (20%)" with "-₱700.00"
   - Promotion name shows below: "Bearded Men? You are Discounted!"
   - Applied promotion shows: "✓ Bearded Men? You are Discounted! (20%) - ₱700.00 off"

### Test Case 2: Fixed Amount Promotion
1. Add service worth ₱2,000
2. Apply promotion code: "SAVE500" (₱500 off)
3. **Expected:**
   - Breakdown shows: "Promotion" with "-₱500.00"
   - Promotion name shows below: "Save ₱500"
   - Applied promotion shows: "✓ Save ₱500 - ₱500.00 off"
   - No percentage shown (fixed amount)

### Test Case 3: No Promotion
1. Add service worth ₱1,500
2. Don't apply any promotion
3. **Expected:**
   - No promotion section in breakdown
   - No applied promotion message
   - Only subtotal and VAT shown

## Files Modified

- `src/components/billing/TwoStepCheckoutModal.jsx` - Enhanced promotion display

## Status: ✅ COMPLETE

The promotion discount now displays correctly with:
- Actual discount amount (not ₱0.00)
- Discount percentage for percentage-based promotions
- Promotion name for clarity
- Proper conditional rendering
