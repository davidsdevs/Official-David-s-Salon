# Purchase Order Workflow Update

## Status: ✅ COMPLETE

## Overview
Updating the Purchase Order approval process to add Branch Manager as an intermediate approval step.

## Current Workflow
1. **Inventory Controller** creates PO → Status: "Pending"
2. **Overall Inventory Controller** approves → Status: "Approved"/"In Transit"

## New Workflow
1. **Inventory Controller** creates PO → Status: "Pending Branch Approval"
2. **Branch Manager** reviews and approves → Status: "Pending Overall Approval"
3. **Overall Inventory Controller** gives final approval → Status: "Approved"/"In Transit"

## Status Flow

### New Status Values:
- `Pending Branch Approval` - Waiting for Branch Manager review
- `Pending Overall Approval` - Branch Manager approved, waiting for Overall Inventory Controller
- `Approved` / `In Transit` - Final approval by Overall Inventory Controller
- `Rejected by Branch` - Rejected by Branch Manager
- `Rejected by Overall` - Rejected by Overall Inventory Controller

### Status Transitions:
```
Inventory Controller Creates PO
    ↓
[Pending Branch Approval]
    ↓
Branch Manager Reviews
    ├─ Approve → [Pending Overall Approval]
    └─ Reject → [Rejected by Branch]
    ↓
Overall Inventory Controller Reviews
    ├─ Approve → [Approved] / [In Transit]
    └─ Reject → [Rejected by Overall]
```

## Changes Required

### 1. Inventory Controller Page
**File**: `src/pages/inventory/PurchaseOrders.jsx`

- Change initial status from "Pending" to "Pending Branch Approval"
- Update status display and filters
- Show who approved at each level
- Cannot edit/delete orders after Branch Manager approval

### 2. Branch Manager Page  
**File**: `src/pages/branch-manager/PurchaseOrders.jsx`

- Can only approve/reject orders with status "Pending Branch Approval"
- Approval changes status to "Pending Overall Approval"
- Rejection changes status to "Rejected by Branch"
- Add approval tracking fields:
  - `branchApprovedBy`
  - `branchApprovedByName`
  - `branchApprovedAt`
  - `branchRejectedBy`
  - `branchRejectedByName`
  - `branchRejectedAt`
  - `branchRejectionNote`

### 3. Overall Inventory Controller Page
**File**: `src/pages/overall-inventory/PurchaseOrders.jsx`

- Can only approve/reject orders with status "Pending Overall Approval"
- Approval changes status to "In Transit" (ready for delivery)
- Rejection changes status to "Rejected by Overall"
- Rename existing approval fields:
  - `approvedBy` → `overallApprovedBy`
  - `approvedByName` → `overallApprovedByName`
  - `approvedAt` → `overallApprovedAt`
  - `rejectedBy` → `overallRejectedBy`
  - `rejectedByName` → `overallRejectedByName`
  - `rejectedAt` → `overallRejectedAt`
  - `rejectionNote` → `overallRejectionNote`

### 4. Operational Manager Page
**File**: `src/pages/operational-manager/PurchaseOrders.jsx`

- View-only access to all purchase orders
- Update status filters to include new statuses
- Show approval chain (who approved at each level)

## Database Schema Updates

### Purchase Order Document:
```javascript
{
  // Existing fields...
  status: "Pending Branch Approval" | "Pending Overall Approval" | "Approved" | "In Transit" | "Rejected by Branch" | "Rejected by Overall" | "Delivered",
  
  // Branch Manager Approval
  branchApprovedBy: "uid",
  branchApprovedByName: "Name",
  branchApprovedAt: Timestamp,
  branchRejectedBy: "uid",
  branchRejectedByName: "Name",
  branchRejectedAt: Timestamp,
  branchRejectionNote: "reason",
  
  // Overall Inventory Controller Approval
  overallApprovedBy: "uid",
  overallApprovedByName: "Name",
  overallApprovedAt: Timestamp,
  overallRejectedBy: "uid",
  overallRejectedByName: "Name",
  overallRejectedAt: Timestamp,
  overallRejectionNote: "reason"
}
```

## UI Updates

### Status Badge Colors:
- `Pending Branch Approval` - Yellow
- `Pending Overall Approval` - Blue
- `Approved` / `In Transit` - Green
- `Rejected by Branch` - Red
- `Rejected by Overall` - Dark Red
- `Delivered` - Emerald

### Approval Timeline Display:
Show approval chain in order details:
1. Created by Inventory Controller
2. Approved/Rejected by Branch Manager
3. Approved/Rejected by Overall Inventory Controller

## Benefits

1. **Better Control**: Branch Managers can review orders before they reach Overall Inventory
2. **Accountability**: Clear approval chain with timestamps
3. **Flexibility**: Branch Managers can reject unreasonable orders early
4. **Transparency**: Everyone can see who approved at each level
5. **Audit Trail**: Complete history of approvals and rejections

## Migration Notes

### Existing Purchase Orders:
- Orders with status "Pending" → Change to "Pending Branch Approval"
- Orders with status "Approved" → Keep as "Approved" (already fully approved)
- Add migration script to update existing orders

## Testing Checklist

- [ ] Inventory Controller can create PO with "Pending Branch Approval" status
- [ ] Branch Manager can see orders with "Pending Branch Approval"
- [ ] Branch Manager can approve → status changes to "Pending Overall Approval"
- [ ] Branch Manager can reject → status changes to "Rejected by Branch"
- [ ] Overall Inventory Controller sees orders with "Pending Overall Approval"
- [ ] Overall Inventory Controller can approve → status changes to "In Transit"
- [ ] Overall Inventory Controller can reject → status changes to "Rejected by Overall"
- [ ] Approval chain displays correctly in order details
- [ ] Status filters work for all roles
- [ ] Statistics update correctly
- [ ] Cannot edit/delete after approvals
- [ ] Rejection notes save properly
- [ ] Timestamps record correctly

## Files to Modify

1. `src/pages/inventory/PurchaseOrders.jsx`
2. `src/pages/branch-manager/PurchaseOrders.jsx`
3. `src/pages/overall-inventory/PurchaseOrders.jsx`
4. `src/pages/operational-manager/PurchaseOrders.jsx`

## Implementation Steps

1. ✅ Update Inventory Controller page (create with new status)
2. ✅ Update Branch Manager page (first approval level)
3. ✅ Update Overall Inventory Controller page (final approval level)
4. ✅ Update Operational Manager page (view-only with new statuses)
5. ⏳ Create migration script for existing orders (optional)
6. ⏳ Test complete workflow
7. ⏳ Update documentation

## Implementation Summary

### Changes Completed:

**1. Inventory Controller (`src/pages/inventory/PurchaseOrders.jsx`)**
- ✅ Changed initial PO status from "Pending" to "Pending Branch Approval"
- ✅ Updated status colors and icons for all new statuses
- ✅ Updated order statistics to include new pending statuses
- ✅ Restricted edit/delete to only "Pending Branch Approval" orders
- ✅ Updated all status displays throughout the page

**2. Branch Manager (`src/pages/branch-manager/PurchaseOrders.jsx`)**
- ✅ Updated approval to change status to "Pending Overall Approval"
- ✅ Changed approval fields to `branchApprovedBy`, `branchApprovedByName`, `branchApprovedAt`
- ✅ Updated rejection to change status to "Rejected by Branch"
- ✅ Changed rejection fields to `branchRejectedBy`, `branchRejectedByName`, `branchRejectedAt`, `branchRejectionNote`
- ✅ Updated `canApproveOrReject` to check for "Pending Branch Approval"
- ✅ Updated status colors and icons
- ✅ Updated order statistics

**3. Overall Inventory Controller (`src/pages/overall-inventory/PurchaseOrders.jsx`)**
- ✅ Updated approval to use `overallApprovedBy`, `overallApprovedByName`, `overallApprovedAt`
- ✅ Updated rejection to change status to "Rejected by Overall"
- ✅ Changed rejection fields to `overallRejectedBy`, `overallRejectedByName`, `overallRejectedAt`, `overallRejectionNote`
- ✅ Updated `canApproveOrReject` to check for "Pending Overall Approval"
- ✅ Updated status colors and icons
- ✅ Updated order statistics to include all rejection types

**4. Operational Manager (`src/pages/operational-manager/PurchaseOrders.jsx`)**
- ✅ Updated status colors and icons for all new statuses
- ✅ Updated order statistics to include new pending and rejection statuses
- ✅ View-only access maintained

### Database Fields Added:

**Branch Manager Approval:**
- `branchApprovedBy` - UID of branch manager who approved
- `branchApprovedByName` - Name of branch manager
- `branchApprovedAt` - Timestamp of approval
- `branchRejectedBy` - UID of branch manager who rejected
- `branchRejectedByName` - Name of branch manager
- `branchRejectedAt` - Timestamp of rejection
- `branchRejectionNote` - Reason for rejection

**Overall Inventory Controller Approval:**
- `overallApprovedBy` - UID of overall inventory controller who approved
- `overallApprovedByName` - Name of overall inventory controller
- `overallApprovedAt` - Timestamp of approval
- `overallRejectedBy` - UID of overall inventory controller who rejected
- `overallRejectedByName` - Name of overall inventory controller
- `overallRejectedAt` - Timestamp of rejection
- `overallRejectionNote` - Reason for rejection

### Status Values Implemented:
- ✅ `Pending Branch Approval` - Yellow (waiting for branch manager)
- ✅ `Pending Overall Approval` - Blue (waiting for overall inventory controller)
- ✅ `Approved` - Green (fully approved)
- ✅ `In Transit` - Purple (approved and in delivery)
- ✅ `Rejected by Branch` - Red (rejected by branch manager)
- ✅ `Rejected by Overall` - Dark Red (rejected by overall inventory controller)
- ✅ `Delivered` - Green (received at branch)
- ✅ Backward compatibility maintained for old "Pending" and "Rejected" statuses
