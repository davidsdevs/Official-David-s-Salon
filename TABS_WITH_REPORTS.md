# Pages with Reports, Dashboards, and Analytics

This document lists all pages in the system that contain reports, dashboards, analytics, or data visualization features that should be tested.

---

## 1. SYSTEM ADMIN

### Dashboard & Overview
- **Dashboard** (`/system-admin/dashboard`)
  - System overview statistics
  - User counts by role
  - Branch statistics
  - Database collection counts
  - Recent activity feed

### Reports & Analytics
- **Activity Logs** (`/system-admin/activity-logs`)
  - System-wide activity tracking
  - User action logs
  - Filterable by date, user, action type

- **Commission Management** (`/system-admin/commission-management`)
  - Commission rates configuration
  - Commission report generation
  - Printable commission reports

- **Suppliers** (`/system-admin/suppliers`)
  - Suppliers list with print report
  - Supplier statistics

---

## 2. OPERATIONAL MANAGER

### Dashboard & Overview
- **Dashboard** (`/operational-manager/dashboard`)
  - Total users count
  - Active branches count
  - Today's appointments
  - Total revenue
  - Active staff count
  - Total products
  - Total appointments
  - Recent activities feed

### Reports & Analytics
- **Branch Performance** (`/operational-manager/branch-performance`)
  - Revenue by branch
  - Appointments by branch
  - Staff performance metrics
  - Branch comparison charts

- **Price History Analytics** (`/operational-manager/price-history-analytics`)
  - Service price tracking
  - Price comparison across branches
  - Transaction counts per service
  - Revenue analysis
  - Line charts for price trends (when comparing all branches)
  - Bar charts for branch comparison

- **Activity Logs** (`/operational-manager/activity-logs`)
  - System-wide activity monitoring
  - Filterable logs

- **Inventory** (`/operational-manager/inventory`)
  - Stock levels across branches
  - Low stock alerts
  - Inventory value reports

- **Deposits** (`/operational-manager/deposits`)
  - Deposit tracking across branches
  - Deposit reports

- **Purchase Orders** (`/operational-manager/purchase-orders`)
  - PO tracking across branches
  - Order status reports

---

## 3. BRANCH MANAGER

### Dashboard & Overview
- **Dashboard** (`/branch-manager/dashboard`)
  - Today's appointments
  - Revenue statistics
  - Staff performance
  - Client statistics
  - Recent activities

### Reports & Analytics
- **Reports** (`/branch-manager/reports`)
  - Sales reports
  - Service reports
  - Product sales reports
  - Revenue analysis
  - Date range filtering
  - Export capabilities

- **Staff Reports** (`/branch-manager/staff-reports`)
  - Individual staff performance
  - Commission reports
  - Service counts
  - Revenue per staff member

- **Client Analytics** (`/branch-manager/client-analytics`)
  - Client segmentation (Silver, Gold, Platinum)
  - Client spending patterns
  - Loyalty tier distribution
  - Top clients

- **Commissions** (`/branch-manager/commissions`)
  - Staff commission tracking
  - Commission calculations
  - Payment history

- **Activity Logs** (`/branch-manager/activity-logs`)
  - Branch-specific activity logs
  - Staff action tracking

- **Inventory** (`/branch-manager/inventory`)
  - Branch stock levels
  - Stock movement reports
  - Low stock alerts

- **Deliveries** (`/branch-manager/deliveries`)
  - Delivery tracking
  - Received items reports

- **Deposits** (`/branch-manager/deposits`)
  - Branch deposit tracking
  - Deposit reports

---

## 4. RECEPTIONIST

### Dashboard & Overview
- **Dashboard** (`/receptionist/dashboard`)
  - Today's appointments
  - Check-in status
  - Quick stats
  - Upcoming appointments

### Reports
- **Sales Report** (`/receptionist/sales-report`)
  - Daily sales summary
  - Transaction reports
  - Service sales breakdown
  - Product sales breakdown
  - Payment method analysis
  - Date range filtering
  - Export capabilities

---

## 5. STYLIST

### Dashboard & Overview
- **Dashboard** (`/stylist/dashboard`)
  - Today's appointments
  - Today's earnings
  - Client type analytics (New, Returning, VIP)
  - Upcoming schedule
  - Performance stats

### Reports & Analytics
- **Commission** (`/stylist/commission`)
  - Personal commission tracking
  - Earnings by date range
  - Service-wise commission breakdown
  - Total earnings summary

- **Service History** (`/stylist/service-history`)
  - Transaction history
  - Commission per transaction
  - Client details
  - Service details
  - Date filtering
  - Client analytics link

- **Client Analytics Detail** (`/stylist/client-analytics/:clientId`)
  - Individual client analytics
  - Total spent by client
  - Total commission earned from client
  - Services rendered count
  - Average transaction value
  - Service history with client
  - Visit frequency

---

## 6. INVENTORY MANAGER (Branch Level)

### Dashboard & Overview
- **Dashboard** (`/inventory/dashboard`)
  - Stock overview
  - Low stock alerts
  - Recent activities
  - Inventory value

### Reports & Analytics
- **Reports** (`/inventory/reports`)
  - Stock movement reports
  - Usage reports
  - Expiry reports
  - Supplier reports
  - Date range filtering

- **Cost Analysis** (`/inventory/cost-analysis`)
  - Product cost tracking
  - Cost trends
  - Supplier cost comparison

- **Stock Alerts** (`/inventory/stock-alerts`)
  - Low stock items
  - Out of stock items
  - Reorder recommendations

- **Expiry Tracker** (`/inventory/expiry-tracker`)
  - Products nearing expiry
  - Expired products
  - Expiry date monitoring

- **Inventory Audit** (`/inventory/inventory-audit`)
  - Stock count verification
  - Discrepancy reports
  - Audit history

---

## 7. OVERALL INVENTORY MANAGER (System-Wide)

### Dashboard & Overview
- **Dashboard** (`/overall-inventory/dashboard`)
  - System-wide stock overview
  - Total inventory value
  - Stock alerts across branches
  - Recent activities

### Reports & Analytics
- **Reports** (`/overall-inventory/reports`)
  - System-wide inventory reports
  - Branch comparison
  - Stock movement across branches
  - Usage patterns

- **Product Sales** (`/overall-inventory/product-sales`)
  - Product sales analytics
  - Best-selling products
  - Sales trends
  - Revenue by product

- **Stock Alerts** (`/overall-inventory/stock-alerts`)
  - Low stock across all branches
  - Critical stock levels
  - Reorder recommendations

- **Expiry Tracker** (`/overall-inventory/expiry-tracker`)
  - Products nearing expiry (all branches)
  - Expired products tracking
  - Branch-wise expiry reports

- **Adjust Logs** (`/overall-inventory/adjust-logs`)
  - Stock adjustment history
  - Adjustment reasons
  - User tracking
  - Branch-wise adjustments

---

## 8. CLIENT

### Dashboard & Overview
- **Dashboard** (`/client/dashboard`)
  - Upcoming appointments
  - Loyalty points
  - Recent transactions
  - Rewards status

### Reports & Analytics
- **Transactions** (`/client/transactions`)
  - Transaction history
  - Service details
  - Payment history
  - Date filtering

- **Rewards** (`/client/rewards`)
  - Loyalty points balance
  - Points history
  - Tier status (Silver, Gold, Platinum)
  - Rewards redemption history

---

## Testing Checklist

### For Each Page, Verify:
- [ ] Page loads without errors
- [ ] Data displays correctly
- [ ] Filters work properly
- [ ] Date range selectors function
- [ ] Export/Print features work (if available)
- [ ] Charts and graphs render correctly
- [ ] Responsive design on tablet/mobile
- [ ] Loading states display properly
- [ ] Empty states show appropriate messages
- [ ] Calculations are accurate
- [ ] Sorting and pagination work

### Priority Testing Order:

#### High Priority (Revenue & Operations)
1. Branch Manager - Reports
2. Receptionist - Sales Report
3. Operational Manager - Dashboard
4. Operational Manager - Branch Performance
5. Branch Manager - Dashboard
6. Stylist - Commission
7. Branch Manager - Commissions

#### Medium Priority (Analytics & Monitoring)
8. Operational Manager - Price History Analytics
9. Branch Manager - Client Analytics
10. Branch Manager - Staff Reports
11. Stylist - Dashboard
12. Stylist - Service History
13. System Admin - Dashboard
14. Overall Inventory - Dashboard
15. Overall Inventory - Product Sales

#### Standard Priority (Tracking & Logs)
16. Inventory - Reports
17. Inventory - Dashboard
18. Overall Inventory - Reports
19. Activity Logs (all roles)
20. Client - Transactions
21. Client - Rewards

#### Low Priority (Specialized Reports)
22. Inventory - Cost Analysis
23. Inventory - Expiry Tracker
24. Overall Inventory - Expiry Tracker
25. Overall Inventory - Adjust Logs
26. Inventory - Inventory Audit
27. System Admin - Commission Management

---

## Notes

- All dashboards should display real-time or near-real-time data
- Reports should support date range filtering
- Export features should generate proper file formats (PDF, Excel, CSV)
- Print features should format content appropriately
- Charts should be interactive where applicable
- All monetary values should display in Philippine Peso (₱) format
- Dates should be formatted consistently across all reports
- Loading states should be shown during data fetching
- Error states should display helpful messages
- Empty states should guide users on next actions
