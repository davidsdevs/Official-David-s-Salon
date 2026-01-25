# Inventory Force Adjust - Implementation Guide

## Overview
This guide details the changes needed to update the Force Adjust functionality in the Overall Inventory Controller to use quantity adjustments instead of absolute stock values.

## File: `src/pages/overall-inventory/Inventory.jsx`

### Change 1: Update State Definition (Lines ~59-70)

**Current:**
```javascript
const [forceAdjustForm, setForceAdjustForm] = useState({
  stockId: '',
  productId: '',
  currentStock: '',
  newStock: '',              // REMOVE THIS
  adjustmentQuantity: '',
  reason: '',
  managerCode: '',
  notes: '',
  batchNumber: ''
});
```

**New:**
```javascript
const [forceAdjustForm, setForceAdjustForm] = useState({
  stockId: '',
  productId: '',
  currentStock: '',
  adjustmentQuantity: '',    // This becomes primary input
  reason: '',
  customReason: '',          // ADD THIS for "Other" option
  managerCode: '',
  notes: '',
  batchNumber: ''
});
```

### Change 2: Update handleSelectBatch Function (Lines ~827-842)

**Find and replace the `newStock: ''` line with:**
```javascript
adjustmentQuantity: '',
customReason: '',
```

### Change 3: Update resetForceAdjustModal Function (Lines ~844-865)

**Find and replace the `newStock: ''` line with:**
```javascript
adjustmentQuantity: '',
customReason: '',
```

### Change 4: Update Validation Function (Lines ~867-912)

**Replace the validation logic:**

```javascript
const handleValidateAdjustment = async () => {
  try {
    setIsSubmittingAdjust(true);
    setForceAdjustErrors({});

    // Validation
    const errors = {};
    
    // Validate adjustment quantity
    if (!forceAdjustForm.adjustmentQuantity || forceAdjustForm.adjustmentQuantity === '0') {
      errors.adjustmentQuantity = 'Adjustment quantity cannot be zero';
    } else {
      const adjustmentQty = parseInt(forceAdjustForm.adjustmentQuantity);
      const currentStock = parseInt(forceAdjustForm.currentStock || 0);
      const newStock = currentStock + adjustmentQty;
      
      if (newStock < 0) {
        errors.adjustmentQuantity = `Cannot deduct ${Math.abs(adjustmentQty)} units. Only ${currentStock} units available.`;
      }
    }

    if (!forceAdjustForm.reason) {
      errors.reason = 'Reason is required';
    }
    
    // Validate custom reason if "Other" is selected
    if (forceAdjustForm.reason === 'Other' && !forceAdjustForm.customReason?.trim()) {
      errors.customReason = 'Please specify the reason';
    }

    if (!forceAdjustForm.managerCode) {
      errors.managerCode = 'Manager authorization code is required';
    }

    if (Object.keys(errors).length > 0) {
      setForceAdjustErrors(errors);
      setIsSubmittingAdjust(false);
      return;
    }

    // Verify manager code
    const verificationResult = await verifyManagerCode(forceAdjustForm.managerCode, selectedBranch);

    if (!verificationResult.valid) {
      setForceAdjustErrors({ managerCode: 'Invalid manager authorization code. Please contact a branch manager.' });
      setIsSubmittingAdjust(false);
      return;
    }

    setVerifiedManager(verificationResult);
    setForceAdjustStep('confirm');
    setIsSubmittingAdjust(false);

  } catch (error) {
    console.error('Error validating adjustment:', error);
    setForceAdjustErrors({ general: 'Failed to validate. Please try again.' });
    setIsSubmittingAdjust(false);
  }
};
```

### Change 5: Update handleForceAdjust Function (Lines ~914-980)

**Replace the calculation and update logic:**

```javascript
const handleForceAdjust = async () => {
  try {
    setIsSubmittingAdjust(true);
    setForceAdjustErrors({});

    // Calculate new stock from adjustment
    const adjustmentQty = parseInt(forceAdjustForm.adjustmentQuantity);
    const currentStock = parseInt(forceAdjustForm.currentStock);
    const newStock = currentStock + adjustmentQty;
    
    // Get final reason (use customReason if "Other" was selected)
    const finalReason = forceAdjustForm.reason === 'Other' 
      ? forceAdjustForm.customReason 
      : forceAdjustForm.reason;

    const stockDocRef = doc(db, 'stocks', forceAdjustForm.stockId);

    // Create adjustment record
    const adjustmentData = {
      stockId: forceAdjustForm.stockId,
      productId: forceAdjustForm.productId,
      productName: forceAdjustForm.productName || selectedProductForAdjust?.productName || 'Unknown Product',
      batchNumber: forceAdjustForm.batchNumber || selectedBatchForAdjust?.batchNumber || '',
      branchId: selectedBranch,
      previousStock: currentStock,
      newStock: newStock,
      adjustmentQuantity: adjustmentQty,
      reason: finalReason,
      notes: forceAdjustForm.notes || '',
      adjustedBy: userData?.uid,
      managerCode: forceAdjustForm.managerCode.substring(0, 4) + '****',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'completed'
    };

    // Save to stockAdjustments collection
    await addDoc(collection(db, 'stockAdjustments'), adjustmentData);

    // Update the stock record
    await updateDoc(stockDocRef, {
      realTimeStock: newStock,
      remainingQuantity: newStock,
      updatedAt: serverTimestamp()
    });

    // Log activity
    const { logActivity } = await import('../../services/activityService');
    await logActivity({
      action: 'stock_force_adjustment',
      performedBy: userData?.uid,
      targetUser: null,
      branchId: selectedBranch,
      details: {
        stockId: forceAdjustForm.stockId,
        productId: forceAdjustForm.productId,
        productName: forceAdjustForm.productName,
        batchNumber: forceAdjustForm.batchNumber || 'N/A',
        previousStock: currentStock,
        newStock: newStock,
        adjustmentQuantity: adjustmentQty,
        reason: finalReason,
        notes: forceAdjustForm.notes || '',
        managerAuthorized: true
      }
    });

    toast.success(`Stock adjusted successfully! ${adjustmentQty >= 0 ? 'Added' : 'Deducted'} ${Math.abs(adjustmentQty)} units.`);
    resetForceAdjustModal();
    loadInventoryData();

  } catch (error) {
    console.error('Error adjusting stock:', error);
    toast.error('Failed to adjust stock. Please try again.');
    setForceAdjustErrors({ general: 'Failed to adjust stock. Please try again.' });
  } finally {
    setIsSubmittingAdjust(false);
  }
};
```

### Change 6: Update Form UI (Lines ~1980-2050)

**Replace the "New Stock Quantity" input section with:**

```jsx
{/* Adjustment Quantity */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Adjustment Quantity <span className="text-red-500">*</span>
  </label>
  <div className="text-xs text-gray-600 mb-2">
    Enter positive number to add stock, negative to deduct
  </div>
  <input
    type="number"
    value={forceAdjustForm.adjustmentQuantity}
    onChange={(e) => {
      setForceAdjustForm(prev => ({
        ...prev,
        adjustmentQuantity: e.target.value
      }));
      setForceAdjustErrors(prev => ({ ...prev, adjustmentQuantity: '' }));
    }}
    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      forceAdjustErrors.adjustmentQuantity ? 'border-red-500' : 'border-gray-300'
    }`}
    placeholder="e.g., +10 to add, -5 to deduct"
  />
  {forceAdjustForm.adjustmentQuantity && (
    <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Current Stock:</span>
        <span className="font-medium">{forceAdjustForm.currentStock} units</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span className="text-gray-600">Adjustment:</span>
        <span className={`font-medium ${
          parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? '+' : ''}{forceAdjustForm.adjustmentQuantity} units
        </span>
      </div>
      <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-300">
        <span className="text-gray-700 font-medium">New Stock:</span>
        <span className="font-bold text-blue-600">
          {parseInt(forceAdjustForm.currentStock || 0) + parseInt(forceAdjustForm.adjustmentQuantity || 0)} units
        </span>
      </div>
    </div>
  )}
  {forceAdjustErrors.adjustmentQuantity && (
    <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.adjustmentQuantity}</p>
  )}
</div>
```

### Change 7: Add Custom Reason Field (After reason dropdown)

**Add this after the reason dropdown:**

```jsx
{/* Custom Reason (shown when "Other" is selected) */}
{forceAdjustForm.reason === 'Other' && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Specify Reason <span className="text-red-500">*</span>
    </label>
    <textarea
      value={forceAdjustForm.customReason}
      onChange={(e) => {
        setForceAdjustForm(prev => ({ ...prev, customReason: e.target.value }));
        setForceAdjustErrors(prev => ({ ...prev, customReason: '' }));
      }}
      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
        forceAdjustErrors.customReason ? 'border-red-500' : 'border-gray-300'
      }`}
      rows="2"
      placeholder="Please specify the reason for adjustment"
    />
    {forceAdjustErrors.customReason && (
      <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.customReason}</p>
    )}
  </div>
)}
```

### Change 8: Update Confirmation Step Display (Lines ~2150-2170)

**Replace the confirmation display:**

```jsx
<div className="grid grid-cols-3 gap-4 mb-6">
  <div className="text-center">
    <label className="text-xs font-medium text-gray-500">Current Stock</label>
    <p className="text-2xl font-bold text-gray-900">{forceAdjustForm.currentStock}</p>
  </div>
  <div className="text-center">
    <label className="text-xs font-medium text-gray-500">Adjustment</label>
    <p className={`text-2xl font-bold ${
      parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? 'text-green-600' : 'text-red-600'
    }`}>
      {parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? '+' : ''}{forceAdjustForm.adjustmentQuantity}
    </p>
  </div>
  <div className="text-center">
    <label className="text-xs font-medium text-gray-500">New Stock</label>
    <p className="text-2xl font-bold text-blue-600">
      {parseInt(forceAdjustForm.currentStock || 0) + parseInt(forceAdjustForm.adjustmentQuantity || 0)}
    </p>
  </div>
</div>
```

## Testing Checklist

- [ ] Can add stock (positive adjustment)
- [ ] Can deduct stock (negative adjustment)
- [ ] Cannot deduct more than available stock
- [ ] Cannot enter zero adjustment
- [ ] Reason is required
- [ ] Custom reason required when "Other" selected
- [ ] Manager code validation works
- [ ] Confirmation step shows correct calculations
- [ ] Stock updates correctly in database
- [ ] Adjustment logs are created properly
- [ ] Activity logs are recorded

## Notes

- The key change is using `adjustmentQuantity` as the primary input instead of `newStock`
- New stock is calculated as: `currentStock + adjustmentQuantity`
- Positive adjustmentQuantity = Add stock
- Negative adjustmentQuantity = Deduct stock
- Validation ensures new stock never goes below 0
