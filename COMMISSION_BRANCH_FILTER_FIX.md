# Commission Branch Filter Fix

## The Issue

The Stylist Commission page was showing commissions from ALL branches, while the Branch Manager Commissions page only showed commissions from their specific branch.

**Example:**
- Stylist (Claire Jessica Cruz) sees: ₱1,407.30 (all branches)
- Branch Manager sees: ₱1,231.15 (only their branch)
- Difference: ₱176.15 (commissions from other branches)

## Root Cause

The Stylist Commission page query was:
```javascript
// OLD - No branch filter
const paidTransactionsQuery = query(
  transactionsRef, 
  where('status', '==', 'paid')
);
```

This returned ALL paid transactions across ALL branches, then filtered by stylist ID in memory.

## The Fix

Updated the Stylist Commission page to filter by branch:

```javascript
// NEW - With branch filter
const paidTransactionsQuery = query(
  transactionsRef, 
  where('branchId', '==', userBranch),  // ← Added branch filter
  where('status', '==', 'paid')
);
```

## Changes Made

**File: `src/pages/stylist/Commission.jsx`**

1. Added `userBranch` to auth context import:
   ```javascript
   const { currentUser, userBranch } = useAuth();
   ```

2. Updated query to filter by branch:
   ```javascript
   const paidTransactionsQuery = query(
     transactionsRef, 
     where('branchId', '==', userBranch),
     where('status', '==', 'paid')
   );
   ```

3. Added branch check before loading:
   ```javascript
   if (!currentUser?.uid || !userBranch) {
     setLoading(false);
     return;
   }
   ```

4. Updated useEffect dependencies:
   ```javascript
   }, [currentUser?.uid, userBranch]);
   ```

## Expected Behavior

### Before Fix:
- Stylist sees commissions from ALL branches they've worked at
- Branch Manager sees commissions only from their branch
- **Totals don't match** ✗

### After Fix:
- Stylist sees commissions only from their assigned branch
- Branch Manager sees commissions only from their branch
- **Totals match** ✓

## Example Scenario

**Claire Jessica Cruz** is assigned to **Branch A**:

### Transactions:
1. Branch A - Service 1: ₱200 commission
2. Branch A - Service 2: ₱300 commission
3. Branch A - Service 3: ₱731.15 commission
4. Branch B - Service 4: ₱176.15 commission (worked as guest stylist)

### Before Fix:
- Stylist page: ₱1,407.30 (all 4 transactions)
- Branch Manager (Branch A): ₱1,231.15 (only Branch A transactions)
- **Mismatch!** ✗

### After Fix:
- Stylist page: ₱1,231.15 (only Branch A transactions)
- Branch Manager (Branch A): ₱1,231.15 (only Branch A transactions)
- **Match!** ✓

## Business Logic

This fix assumes:
1. Stylists are assigned to a specific branch (`userBranch`)
2. Stylists should only see commissions from their assigned branch
3. If a stylist works at multiple branches, they would need separate accounts or role switching

## Note on Multi-Branch Stylists

If your business allows stylists to work at multiple branches and they should see ALL their commissions:
- The old behavior was actually correct
- You would need a different solution (e.g., filter by stylist ID across all branches)
- The Branch Manager would still only see their branch's commissions

Please confirm which behavior is correct for your business model.
