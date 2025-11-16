# 🧪 M02 - BRANCH MANAGEMENT TESTING GUIDE

**Module:** Branch Management  
**Version:** 2.0  
**Date:** November 9, 2025  
**Status:** Ready for Testing

---

## 📋 TEST OVERVIEW

This guide covers testing for the Branch Management module, including:
- Branch CRUD operations
- Branch Services Management (subcollection)
- Calendar & Holidays Management (subcollection)
- Branch Manager Dashboard
- Branch Details Modal
- Delete Branch functionality
- Role-based access control
- Operating hours configuration
- Branch statistics
- Activity logging

---

## 🎯 TEST PREREQUISITES

### Required Test Accounts:
1. **System Admin** - Full branch management access
2. **Franchise Owner** - Full branch management access (read/write)
3. **Branch Manager** - Limited access to assigned branch
4. **Receptionist** - Read-only access to assigned branch

### Test Data Needed:
- At least 2 branch records
- Users with different roles
- Branch Manager assigned to at least one branch

---

## 🧪 TEST CASES

### **TC-M02-001: System Admin - Create Branch**

**Objective:** Verify System Admin can create a new branch

**Steps:**
1. Login as System Admin
2. Navigate to "Branches" from sidebar
3. Click "Add Branch" button
4. Fill in branch details:
   - Branch Name: "David's Salon - Test Branch"
   - Address: "123 Test Street, Manila"
   - Contact: "+63 912 345 6789"
   - Email: "test@davidsalon.com"
   - Manager: Select a Branch Manager from dropdown
5. Configure operating hours (leave defaults or customize)
6. Click "Create Branch"

**Expected Results:**
- ✅ Success toast message appears
- ✅ Branch appears in the branches grid
- ✅ Branch status is "Active"
- ✅ Branch stats show 0 staff, 0 appointments, 0 inventory
- ✅ Activity log records "branch_created" action

**Test Data:**
```json
{
  "branchName": "David's Salon - Test Branch",
  "address": "123 Test Street, Manila",
  "contact": "+63 912 345 6789",
  "email": "test@davidsalon.com",
  "managerID": "[Select from dropdown]"
}
```

---

### **TC-M02-002: System Admin - Edit Branch**

**Objective:** Verify System Admin can edit branch details

**Steps:**
1. Login as System Admin
2. Navigate to "Branches"
3. Click "Edit" on any branch
4. Modify the following:
   - Address: Change to new address
   - Contact: Change phone number
   - Operating Hours: Change Monday hours to 10:00-19:00
5. Click "Update Branch"

**Expected Results:**
- ✅ Success toast message appears
- ✅ Branch details updated in the grid
- ✅ Activity log shows "branch_updated" with changed fields only
- ✅ Activity log details show before/after values

**Verify Activity Log:**
```json
{
  "action": "branch_updated",
  "details": {
    "changedFields": ["address", "contact", "operatingHours"],
    "changes": {
      "address": {
        "from": "Old Address",
        "to": "New Address"
      }
    }
  }
}
```

---

### **TC-M02-003: System Admin - Toggle Branch Status**

**Objective:** Verify System Admin can activate/deactivate branches

**Steps:**
1. Login as System Admin
2. Navigate to "Branches"
3. Find an active branch
4. Click "Deactivate" button
5. Verify status changes to "Inactive"
6. Click "Activate" button
7. Verify status changes back to "Active"

**Expected Results:**
- ✅ Status badge changes color (green ↔ red)
- ✅ Success toast for each action
- ✅ Activity log records "branch_deactivated" and "branch_activated"
- ✅ Inactive branches hidden from client booking (future feature)

---

### **TC-M02-004: Franchise Owner - View All Branches**

**Objective:** Verify Franchise Owner can view all branches

**Steps:**
1. Login as Franchise Owner
2. Navigate to "Branches" from sidebar
3. Verify all branches are visible
4. Check branch statistics

**Expected Results:**
- ✅ All branches displayed in grid
- ✅ Can see branch stats (staff count, etc.)
- ✅ Can edit any branch
- ✅ Can activate/deactivate branches
- ✅ Same functionality as System Admin

---

### **TC-M02-005: Franchise Owner - Create Branch**

**Objective:** Verify Franchise Owner can create branches

**Steps:**
1. Login as Franchise Owner
2. Navigate to "Branches"
3. Click "Add Branch"
4. Fill in all required details
5. Click "Create Branch"

**Expected Results:**
- ✅ Branch created successfully
- ✅ Same functionality as System Admin
- ✅ Activity log records action with Franchise Owner as performer

---

### **TC-M02-006: Branch Manager - View Own Branch**

**Objective:** Verify Branch Manager can only view their assigned branch

**Steps:**
1. Login as Branch Manager
2. Navigate to "Branch Settings" from sidebar
3. Verify branch details are displayed

**Expected Results:**
- ✅ Branch name displayed (read-only)
- ✅ Status badge shown
- ✅ Can see contact information
- ✅ Can see operating hours
- ✅ Cannot see other branches
- ✅ No access to "Branches" page (System Admin/Franchise Owner only)

---

### **TC-M02-007: Branch Manager - Update Branch Settings**

**Objective:** Verify Branch Manager can update limited fields

**Steps:**
1. Login as Branch Manager
2. Navigate to "Branch Settings"
3. Modify the following:
   - Address: Change address
   - Contact: Change phone number
   - Email: Change email
   - Operating Hours: Change Tuesday hours
4. Click "Save Changes"

**Expected Results:**
- ✅ Success toast message
- ✅ Changes saved to Firestore
- ✅ Activity log records "branch_updated"
- ✅ System Admin notified (info message shown)

**Cannot Modify:**
- ❌ Branch Name (read-only)
- ❌ Manager Assignment (read-only)
- ❌ Branch Status (read-only)

---

### **TC-M02-008: Branch Manager - Restricted Field Update**

**Objective:** Verify Branch Manager cannot update restricted fields

**Steps:**
1. Login as Branch Manager
2. Try to update branch via Firestore directly (or API):
   - Attempt to change `branchName`
   - Attempt to change `managerID`
   - Attempt to change `status`

**Expected Results:**
- ❌ Firestore rules reject the update
- ❌ Permission denied error
- ✅ Only allowed fields can be updated

**Firestore Rule Test:**
```javascript
// Should FAIL
{
  branchName: "New Name",  // ❌ Not allowed
  managerID: "new_manager" // ❌ Not allowed
}

// Should SUCCEED
{
  address: "New Address",     // ✅ Allowed
  contact: "+63 999 888 7777" // ✅ Allowed
}
```

---

### **TC-M02-009: Search and Filter Branches**

**Objective:** Verify search and filter functionality

**Steps:**
1. Login as System Admin or Franchise Owner
2. Navigate to "Branches"
3. Test search:
   - Enter branch name in search box
   - Enter address in search box
4. Test status filter:
   - Select "Active" from status dropdown
   - Select "Inactive" from status dropdown
   - Select "All Status"

**Expected Results:**
- ✅ Search filters branches by name or address
- ✅ Status filter shows only matching branches
- ✅ Filters work together (search + status)
- ✅ Results update in real-time

---

### **TC-M02-010: Branch Statistics**

**Objective:** Verify branch statistics are accurate

**Steps:**
1. Login as System Admin
2. Navigate to "Branches"
3. Check the stats cards at the top:
   - Total Branches
   - Active Branches
   - Inactive Branches
   - Total Staff
4. Check individual branch cards:
   - Staff count
   - Appointments count
   - Inventory items count

**Expected Results:**
- ✅ Total branches count is correct
- ✅ Active/Inactive counts match actual status
- ✅ Total staff count sums all branches
- ✅ Individual branch stats are accurate

**Note:** Appointments and Inventory counts will be 0 until those modules are implemented.

---

### **TC-M02-011: Operating Hours Configuration**

**Objective:** Verify operating hours can be configured correctly

**Steps:**
1. Create or edit a branch
2. Configure operating hours:
   - Set Monday: 09:00 - 18:00
   - Set Tuesday: 10:00 - 20:00
   - Set Wednesday: Closed (uncheck)
   - Set Thursday: 08:00 - 17:00
   - Leave others as default
3. Save the branch

**Expected Results:**
- ✅ Hours saved correctly
- ✅ Closed days marked as closed
- ✅ Time format validated (HH:MM)
- ✅ Operating hours displayed correctly in view mode

---

### **TC-M02-012: Manager Assignment**

**Objective:** Verify Branch Manager can be assigned to branch

**Steps:**
1. Login as System Admin
2. Create or edit a branch
3. Select a Branch Manager from dropdown
4. Save the branch
5. Login as that Branch Manager
6. Navigate to "Branch Settings"

**Expected Results:**
- ✅ Manager dropdown shows only users with Branch Manager role
- ✅ Manager can be assigned successfully
- ✅ Assigned manager can access Branch Settings
- ✅ Manager can only see their assigned branch

---

### **TC-M02-013: Activity Logging**

**Objective:** Verify all branch actions are logged

**Steps:**
1. Perform the following actions:
   - Create a branch
   - Update a branch
   - Activate a branch
   - Deactivate a branch
2. Navigate to "Activity Logs"
3. Search for branch-related activities

**Expected Results:**
- ✅ "branch_created" logged with branch details
- ✅ "branch_updated" logged with changed fields only
- ✅ "branch_activated" logged
- ✅ "branch_deactivated" logged
- ✅ All logs show correct performer and timestamp
- ✅ Details field shows relevant information

---

### **TC-M02-014: Receptionist - Read-Only Access**

**Objective:** Verify Receptionist can only read their branch

**Steps:**
1. Login as Receptionist
2. Try to access branch data via Firestore
3. Verify read access to assigned branch
4. Verify no write access

**Expected Results:**
- ✅ Can read assigned branch data
- ❌ Cannot create branches
- ❌ Cannot update branches
- ❌ Cannot delete branches
- ❌ Cannot access other branches

---

### **TC-M02-015: Unassigned Branch Manager**

**Objective:** Verify Branch Manager without assigned branch

**Steps:**
1. Create a Branch Manager user
2. Do NOT assign them to any branch
3. Login as that Branch Manager
4. Navigate to "Branch Settings"

**Expected Results:**
- ✅ Shows "No branch assigned to your account" message
- ✅ No error occurs
- ✅ Cannot access any branch data

---

## 📊 TEST SUMMARY CHECKLIST

### **Functionality Tests - Core Branch Management**
- [ ] TC-M02-001: Create Branch (System Admin)
- [ ] TC-M02-002: Edit Branch (System Admin)
- [ ] TC-M02-003: Toggle Branch Status
- [ ] TC-M02-004: View All Branches (Franchise Owner)
- [ ] TC-M02-005: Create Branch (Franchise Owner)
- [ ] TC-M02-006: View Own Branch (Branch Manager)
- [ ] TC-M02-007: Update Branch Settings (Branch Manager)
- [ ] TC-M02-008: Restricted Field Update
- [ ] TC-M02-009: Search and Filter
- [ ] TC-M02-010: Branch Statistics
- [ ] TC-M02-011: Operating Hours
- [ ] TC-M02-012: Manager Assignment
- [ ] TC-M02-013: Activity Logging
- [ ] TC-M02-014: Receptionist Access
- [ ] TC-M02-015: Unassigned Manager

### **Functionality Tests - New Features**
- [ ] TC-M02-016: Branch Manager Dashboard
- [ ] TC-M02-017: Branch Details Modal
- [ ] TC-M02-018: Delete Branch
- [ ] TC-M02-019: Services Management - Add Service
- [ ] TC-M02-020: Services Management - Edit Service
- [ ] TC-M02-021: Services Management - Toggle Service
- [ ] TC-M02-022: Services Management - Delete Service
- [ ] TC-M02-023: Services Management - Search and Filter
- [ ] TC-M02-024: Calendar Management - Add Holiday
- [ ] TC-M02-025: Calendar Management - Special Hours
- [ ] TC-M02-026: Calendar Management - Edit/Delete Entry
- [ ] TC-M02-027: Time Format Display
- [ ] TC-M02-028: Role Switching

### **Security Tests**
- [ ] Firestore rules enforce role-based access
- [ ] Branch Manager cannot modify restricted fields
- [ ] Staff cannot write to branches
- [ ] Activity logs cannot be tampered with

### **UI/UX Tests**
- [ ] Forms validate required fields
- [ ] Success/error messages display correctly
- [ ] Loading states work properly
- [ ] Responsive design on mobile/tablet
- [ ] Icons and badges display correctly

---

## 🐛 BUG REPORTING TEMPLATE

If you find any issues, report them using this format:

```markdown
**Bug ID:** M02-BUG-XXX
**Test Case:** TC-M02-XXX
**Severity:** Critical / High / Medium / Low
**Role:** System Admin / Franchise Owner / Branch Manager / etc.

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:**
What should happen

**Actual Result:**
What actually happened

**Screenshots:**
[Attach if applicable]

**Console Errors:**
[Paste any console errors]
```

---

## ✅ ACCEPTANCE CRITERIA

Module is considered complete when:

- ✅ All test cases pass
- ✅ No critical or high severity bugs
- ✅ Firestore rules properly enforce access control
- ✅ Activity logs record all branch actions
- ✅ UI is responsive and user-friendly
- ✅ Performance is acceptable (< 2 seconds for operations)

---

---

### **TC-M02-016: Branch Manager Dashboard**

**Objective:** Verify Branch Manager Dashboard displays correctly

**Steps:**
1. Login as Branch Manager
2. Navigate to Dashboard
3. Verify all sections are displayed

**Expected Results:**
- ✅ Branch information card shows (name, address, contact, email, today's hours)
- ✅ Status badge displays correctly
- ✅ 4 stat cards show (Staff, Appointments, Revenue, Inventory)
- ✅ Recent staff list displays (up to 5 staff members)
- ✅ Quick action buttons visible
- ✅ Operating hours display in 12-hour format (9:00 AM not 09:00)
- ✅ No branch assigned message shows if not assigned

---

### **TC-M02-017: Branch Details Modal**

**Objective:** Verify Branch Details Modal displays all information

**Steps:**
1. Login as System Admin or Franchise Owner
2. Navigate to "Branches"
3. Click "View" button on any branch
4. Verify modal content

**Expected Results:**
- ✅ Modal opens with branch details
- ✅ Basic information section (name, status)
- ✅ Contact information section (address, phone, email with icons)
- ✅ Operating hours for all 7 days in 12-hour format
- ✅ Branch statistics (staff, appointments, revenue, inventory)
- ✅ Metadata (created at, last updated)
- ✅ Close button works

---

### **TC-M02-018: Delete Branch**

**Objective:** Verify System Admin can delete branches with validation

**Steps:**
1. Login as System Admin
2. Navigate to "Branches"
3. Try to delete a branch WITH assigned staff
4. Try to delete a branch WITHOUT assigned staff

**Expected Results:**
- ❌ Cannot delete branch with assigned staff (error toast shown)
- ✅ Can delete branch without assigned staff
- ✅ Confirmation modal appears before deletion
- ✅ Activity log records "branch_deleted"
- ✅ Delete button only visible to System Admin (not Franchise Owner)

---

### **TC-M02-019: Services Management - Add Service**

**Objective:** Verify Branch Manager can add services

**Steps:**
1. Login as Branch Manager
2. Navigate to "Services"
3. Click "Add Service"
4. Fill in service details:
   - Service Name: "Haircut - Men"
   - Description: "Professional men's haircut"
   - Category: "Hair Services"
   - Duration: 30 minutes
   - Price: 150
   - Enabled: Checked
5. Click "Add Service"

**Expected Results:**
- ✅ Success toast message
- ✅ Service appears in services grid
- ✅ Service saved to `/branches/{branchId}/services` subcollection
- ✅ Activity log records "branch_service_added"
- ✅ Service shows as "Enabled"

---

### **TC-M02-020: Services Management - Edit Service**

**Objective:** Verify Branch Manager can edit services

**Steps:**
1. Login as Branch Manager
2. Navigate to "Services"
3. Click "Edit" on any service
4. Modify price and duration
5. Click "Update Service"

**Expected Results:**
- ✅ Success toast message
- ✅ Service updated in Firestore
- ✅ Activity log records "branch_service_updated"
- ✅ Changes reflected immediately

---

### **TC-M02-021: Services Management - Toggle Service**

**Objective:** Verify Branch Manager can enable/disable services

**Steps:**
1. Login as Branch Manager
2. Navigate to "Services"
3. Click "Disable" on an enabled service
4. Click "Enable" on a disabled service

**Expected Results:**
- ✅ Status badge changes (Enabled ↔ Disabled)
- ✅ Success toast for each action
- ✅ Activity log records "branch_service_toggled"
- ✅ Button text changes (Disable ↔ Enable)

---

### **TC-M02-022: Services Management - Delete Service**

**Objective:** Verify Branch Manager can delete services

**Steps:**
1. Login as Branch Manager
2. Navigate to "Services"
3. Click delete icon on any service
4. Confirm deletion in modal

**Expected Results:**
- ✅ Confirmation modal appears
- ✅ Service deleted from Firestore
- ✅ Activity log records "branch_service_deleted"
- ✅ Success toast message

---

### **TC-M02-023: Services Management - Search and Filter**

**Objective:** Verify search and filter work for services

**Steps:**
1. Login as Branch Manager
2. Navigate to "Services"
3. Test search by service name
4. Test filter by category

**Expected Results:**
- ✅ Search filters services in real-time
- ✅ Category filter shows only matching services
- ✅ Filters work together
- ✅ "No services found" message when no matches

---

### **TC-M02-024: Calendar Management - Add Holiday**

**Objective:** Verify Branch Manager can add holidays

**Steps:**
1. Login as Branch Manager
2. Navigate to "Calendar & Holidays"
3. Click "Add Entry"
4. Fill in details:
   - Date: Select future date
   - Title: "Christmas Day"
   - Type: "Holiday"
   - Description: "Branch closed for Christmas"
5. Click "Add Entry"

**Expected Results:**
- ✅ Success toast message
- ✅ Entry appears in "Upcoming Dates" section
- ✅ Entry saved to `/branches/{branchId}/calendar` subcollection
- ✅ Activity log records "branch_calendar_added"
- ✅ Type badge shows correct color

---

### **TC-M02-025: Calendar Management - Special Hours**

**Objective:** Verify Branch Manager can set special operating hours

**Steps:**
1. Login as Branch Manager
2. Navigate to "Calendar & Holidays"
3. Click "Add Entry"
4. Fill in details:
   - Date: Select future date
   - Title: "Holiday Special Hours"
   - Type: "Special Hours"
   - Special Hours: 10:00 AM - 3:00 PM
5. Click "Add Entry"

**Expected Results:**
- ✅ Entry created successfully
- ✅ Special hours displayed in entry
- ✅ Time shows in 12-hour format
- ✅ Entry type badge shows "Special Hours"

---

### **TC-M02-026: Calendar Management - Edit/Delete Entry**

**Objective:** Verify calendar entries can be edited and deleted

**Steps:**
1. Login as Branch Manager
2. Navigate to "Calendar & Holidays"
3. Click "Edit" on any entry
4. Modify the title
5. Save changes
6. Click "Delete" on any entry
7. Confirm deletion

**Expected Results:**
- ✅ Edit updates entry successfully
- ✅ Delete removes entry from Firestore
- ✅ Activity logs record both actions
- ✅ Confirmation modal appears before deletion

---

### **TC-M02-027: Time Format Display**

**Objective:** Verify all times display in 12-hour format

**Steps:**
1. Check operating hours in various places:
   - Branch Manager Dashboard
   - Branch Details Modal
   - Branch Settings page
   - Calendar special hours

**Expected Results:**
- ✅ All times show as "9:00 AM" not "09:00"
- ✅ All times show as "2:30 PM" not "14:30"
- ✅ Midnight shows as "12:00 AM"
- ✅ Noon shows as "12:00 PM"

---

### **TC-M02-028: Role Switching**

**Objective:** Verify profile navigation works after role switching

**Steps:**
1. Login with multi-role account
2. Switch to different role using Role Switcher
3. Click profile dropdown
4. Click "My Profile"
5. Click "Settings"

**Expected Results:**
- ✅ Profile page loads correctly for active role
- ✅ Settings page loads correctly for active role
- ✅ No navigation errors
- ✅ Role label updates in header

---

## 📝 NOTES

- **Appointments Count:** Will show 0 until Appointment module (M03) is implemented
- **Inventory Count:** Will show 0 until Inventory module (M05) is implemented
- **Revenue:** Will show 0 until Billing module (M04) is implemented
- **Branch Services:** ✅ Fully implemented with subcollection
- **Branch Calendar:** ✅ Fully implemented with subcollection
- **12-Hour Time Format:** ✅ Implemented for all time displays

---

**Happy Testing! 🎉**
