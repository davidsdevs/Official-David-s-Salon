# 🧪 M03: Appointment Management - Testing Guide

**Module:** M03 - Appointment Management  
**Version:** 1.0  
**Last Updated:** November 2024

---

## 📋 Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [User Role Testing](#user-role-testing)
3. [Functional Testing](#functional-testing)
4. [Security Testing](#security-testing)
5. [Performance Testing](#performance-testing)
6. [Edge Cases & Error Handling](#edge-cases--error-handling)
7. [Test Checklist](#test-checklist)

---

## 🔧 Test Environment Setup

### Prerequisites
- Firebase project configured
- Test user accounts for all roles
- Sample branch data
- Sample service data
- Sample stylist accounts

### Test Data Setup

```javascript
// Test Users
const testUsers = {
  client: {
    email: 'client.test@example.com',
    password: 'Test123!',
    role: 'Client'
  },
  receptionist: {
    email: 'receptionist.test@example.com',
    password: 'Test123!',
    role: 'Receptionist',
    branchId: 'branch1' 
  },
  stylist: {
    email: 'stylist.test@example.com',
    password: 'Test123!',
    role: 'Stylist',
    branchId: 'branch1'
  },
  branchManager: {
    email: 'manager.test@example.com',
    password: 'Test123!',
    role: 'Branch Manager',
    branchId: 'branch1'
  }
};

// Test Services
const testServices = [
  {
    serviceName: 'Haircut - Men',
    category: 'Hair Services',
    duration: 30,
    price: 150,
    enabled: true
  },
  {
    serviceName: 'Hair Color',
    category: 'Hair Services',
    duration: 120,
    price: 1500,
    enabled: true
  }
];
```

---

## 👥 User Role Testing

### 1. **Client Role Tests**

#### Test Case 1.1: View Appointments Page
- **Steps:**
  1. Login as client
  2. Navigate to Appointments page
- **Expected:** 
  - Page loads successfully
  - Shows "Book Appointment" button
  - Displays upcoming and past appointments sections

#### Test Case 1.2: Book New Appointment
- **Steps:**
  1. Click "Book Appointment"
  2. Select branch
  3. Select service
  4. Select date
  5. Choose available time slot
  6. Add optional notes
  7. Click "Confirm Booking"
- **Expected:**
  - Modal opens with booking form
  - Services load after branch selection
  - Available time slots display
  - Unavailable slots are disabled
  - Success toast appears
  - Appointment appears in upcoming list

#### Test Case 1.3: Cancel Appointment
- **Steps:**
  1. Find upcoming appointment
  2. Click "Cancel" button
  3. Enter cancellation reason
  4. Confirm cancellation
- **Expected:**
  - Confirmation modal appears
  - Appointment status changes to "Cancelled"
  - Appointment moves to past appointments
  - Success toast appears

#### Test Case 1.4: View Past Appointments
- **Steps:**
  1. Scroll to "Past Appointments" section
- **Expected:**
  - Shows completed and cancelled appointments
  - No action buttons visible
  - Displays up to 6 appointments

---

### 2. **Receptionist Role Tests**

#### Test Case 2.1: View Appointments Dashboard
- **Steps:**
  1. Login as receptionist
  2. Navigate to Appointments page
- **Expected:**
  - Stats cards show today's counts
  - Search and filter options visible
  - "New Appointment" and "Walk-in" buttons visible

#### Test Case 2.2: Create Regular Appointment
- **Steps:**
  1. Click "New Appointment"
  2. Select client from dropdown
  3. Select service and stylist
  4. Choose date and time
  5. Submit form
- **Expected:**
  - Client dropdown shows registered clients
  - Form validates required fields
  - Appointment created successfully

#### Test Case 2.3: Create Walk-in Appointment
- **Steps:**
  1. Click "Walk-in" button
  2. Enter client name and phone
  3. Select service
  4. Choose time slot
  5. Submit form
- **Expected:**
  - Manual entry fields appear
  - Phone number required
  - Email optional
  - Appointment created with walk-in flag

#### Test Case 2.4: Update Appointment Status
- **Steps:**
  1. Find pending appointment
  2. Click "Start" button
  3. Click "Complete" button
- **Expected:**
  - Status changes to "In Progress"
  - Button changes to "Complete"
  - Status changes to "Completed"

#### Test Case 2.5: Search and Filter
- **Steps:**
  1. Enter client name in search
  2. Select status filter
  3. Select date filter
- **Expected:**
  - Results update in real-time
  - Multiple filters work together
  - Shows "No appointments found" when empty

---

### 3. **Stylist Role Tests**

#### Test Case 3.1: View My Appointments
- **Steps:**
  1. Login as stylist
  2. Navigate to Appointments page
- **Expected:**
  - Shows only assigned appointments
  - Mobile-optimized layout
  - Stats cards display correctly

#### Test Case 3.2: Filter Appointments
- **Steps:**
  1. Click "Today" tab
  2. Click "Upcoming" tab
  3. Click "Completed" tab
- **Expected:**
  - Each tab shows relevant appointments
  - Counts update correctly
  - Smooth transitions

#### Test Case 3.3: Start Service
- **Steps:**
  1. Find confirmed appointment
  2. Click "Start Service"
- **Expected:**
  - Status changes to "In Progress"
  - Button changes to "Mark Complete"
  - Loading spinner shows during update

#### Test Case 3.4: Complete Service
- **Steps:**
  1. Find in-progress appointment
  2. Click "Mark Complete"
- **Expected:**
  - Status changes to "Completed"
  - Appointment moves to completed tab
  - Success notification

---

### 4. **Branch Manager Role Tests**

#### Test Case 4.1: View Analytics Dashboard
- **Steps:**
  1. Login as branch manager
  2. Navigate to Appointments page
- **Expected:**
  - Stats cards show totals
  - Top services ranking visible
  - Top stylists ranking visible
  - Performance metrics display  

#### Test Case 4.2: Change Date Range
- **Steps:**
  1. Select "Today" from dropdown
  2. Select "Last 7 Days"
  3. Select "Last 30 Days"
- **Expected:**
  - Data updates for selected range
  - Charts and stats recalculate
  - Recent appointments update

#### Test Case 4.3: View Top Services
- **Steps:**
  1. Check "Top Services" section
- **Expected:**
  - Shows up to 5 services
  - Ranked by booking count
  - Displays booking numbers

#### Test Case 4.4: View Top Stylists
- **Steps:**
  1. Check "Top Stylists" section
- **Expected:**
  - Shows up to 5 stylists
  - Ranked by appointment count
  - Displays appointment numbers

---

## 🔒 Security Testing

### Test Case S1: Firestore Rules - Client Access
- **Test:** Client tries to read other client's appointments
- **Expected:** Permission denied

### Test Case S2: Firestore Rules - Stylist Access
- **Test:** Stylist tries to read appointments not assigned to them
- **Expected:** Permission denied

### Test Case S3: Firestore Rules - Client Update
- **Test:** Client tries to update appointment status to "Completed"
- **Expected:** Permission denied (can only cancel/reschedule)

### Test Case S4: Firestore Rules - Delete
- **Test:** Receptionist tries to delete appointment
- **Expected:** Permission denied (only managers can delete)

### Test Case S5: Double Booking Prevention
- **Test:** Try to book same stylist at same time
- **Expected:** Error message "Time slot not available"

---

## ⚡ Performance Testing

### Test Case P1: Load Time
- **Test:** Measure page load time with 100 appointments
- **Expected:** < 2 seconds

### Test Case P2: Search Performance
- **Test:** Search through 500 appointments
- **Expected:** Results appear instantly

### Test Case P3: Filter Performance
- **Test:** Apply multiple filters to large dataset
- **Expected:** No lag or freezing

### Test Case P4: Concurrent Bookings
- **Test:** 10 users book appointments simultaneously
- **Expected:** All bookings succeed without conflicts

---

## 🐛 Edge Cases & Error Handling

### Test Case E1: Empty States
- **Test:** View appointments when none exist
- **Expected:** Shows empty state message with "Book appointment" CTA

### Test Case E2: Network Error
- **Test:** Disconnect internet during booking
- **Expected:** Error toast appears, form data preserved

### Test Case E3: Invalid Date Selection
- **Test:** Try to book appointment in the past
- **Expected:** Date picker prevents past dates

### Test Case E4: No Available Slots
- **Test:** Select fully booked date
- **Expected:** Shows "No available slots" message

### Test Case E5: Form Validation
- **Test:** Submit form with missing required fields
- **Expected:** Validation errors appear

### Test Case E6: Long Service Duration
- **Test:** Book 3-hour service near closing time
- **Expected:** Only shows slots that fit within operating hours

### Test Case E7: Cancelled Appointment Actions
- **Test:** Try to update status of cancelled appointment
- **Expected:** Action buttons hidden or disabled

---

## ✅ Test Checklist

### **Client Interface**
- [ ] Can view upcoming appointments
- [ ] Can view past appointments
- [ ] Can book new appointment
- [ ] Can select branch
- [ ] Can select service
- [ ] Can select optional stylist
- [ ] Can choose date
- [ ] Can see available time slots
- [ ] Can add notes
- [ ] Can cancel appointment
- [ ] Can provide cancellation reason
- [ ] Cannot book in the past
- [ ] Cannot double-book
- [ ] Receives success/error messages

### **Receptionist Interface**
- [ ] Can view all branch appointments
- [ ] Can create regular appointment
- [ ] Can create walk-in appointment
- [ ] Can search appointments
- [ ] Can filter by status
- [ ] Can filter by date
- [ ] Can update appointment status
- [ ] Can cancel appointments
- [ ] Stats cards show correct counts
- [ ] Loading states work properly

### **Stylist Interface**
- [ ] Can view assigned appointments only
- [ ] Can filter by today/upcoming/completed
- [ ] Can start service
- [ ] Can complete service
- [ ] Mobile layout works properly
- [ ] Contact links work (tel:, mailto:)
- [ ] Stats update correctly

### **Branch Manager Interface**
- [ ] Can view analytics dashboard
- [ ] Can change date range
- [ ] Top services display correctly
- [ ] Top stylists display correctly
- [ ] Performance metrics accurate
- [ ] Peak hours display correctly
- [ ] Recent appointments show

### **Security**
- [ ] Clients see only their appointments
- [ ] Stylists see only assigned appointments
- [ ] Proper role-based access control
- [ ] Double-booking prevention works
- [ ] Firestore rules enforced

### **Performance**
- [ ] Page loads in < 2 seconds
- [ ] Search is instant
- [ ] Filters apply quickly
- [ ] No memory leaks
- [ ] Handles large datasets

### **Error Handling**
- [ ] Network errors handled gracefully
- [ ] Form validation works
- [ ] Empty states display properly
- [ ] Loading states show
- [ ] Error messages are clear

---

## 📊 Test Results Template

```markdown
## Test Execution Report

**Date:** [Date]
**Tester:** [Name]
**Environment:** [Dev/Staging/Production]

### Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

### Failed Tests
| Test ID | Description | Severity | Notes |
|---------|-------------|----------|-------|
| TC-1.2  | Booking fails | High | Network timeout |

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommendations
1. [Recommendation]
2. [Recommendation]
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All test cases passed
- [ ] Security rules tested
- [ ] Performance benchmarks met
- [ ] Error handling verified
- [ ] Mobile responsiveness checked
- [ ] Cross-browser testing done
- [ ] Firestore indexes created
- [ ] Environment variables set
- [ ] Backup plan in place
- [ ] Rollback procedure documented

---

**Testing Status:** ✅ Ready for Testing  
**Next Steps:** Execute test cases and document results
