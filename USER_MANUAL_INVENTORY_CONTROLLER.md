# David's Salon Management System - Inventory Controller User Manual

## Welcome, Inventory Controller!

This manual guides you through all the features available to you in the David's Salon Management System (DSMS). As an inventory controller, you manage stock, track inventory movements, process purchase orders, handle deliveries, and ensure optimal inventory levels for your branch.

**Access:** Inventory Controller Dashboard with stock and supplier management
**Primary Purpose:** Manage branch inventory, stock levels, and supplier orders

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Stock Management](#stock-management)
4. [Inventory Adjustments](#inventory-adjustments)
5. [Purchase Orders](#purchase-orders)
6. [Deliveries & Receiving](#deliveries--receiving)
7. [Suppliers Management](#suppliers-management)
8. [Stock Alerts & Monitoring](#stock-alerts--monitoring)
9. [Expiry Tracker](#expiry-tracker)
10. [Stock Transfer](#stock-transfer)
11. [Reports & Analytics](#reports--analytics)
12. [UPC Generator](#upc-generator)
13. [Cost Analysis](#cost-analysis)
14. [Inventory Audit](#inventory-audit)
15. [Profile Management](#profile-management)
16. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## Getting Started

### Logging In

1. Navigate to the salon management system login page
2. Enter your **email address**
3. Enter your **password**
4. Click **"Sign In"**

### Role Selection

If you have multiple roles:
1. Select **"Inventory Controller"** from the role selection screen
2. The inventory dashboard will load
3. You'll see stock information for your branch

### Initial Setup

- Review current inventory levels
- Understand your branch's products
- Learn supplier contacts
- Set notification preferences for low stock alerts

---

## Dashboard Overview

Your inventory controller dashboard provides a complete view of stock management.

### Key Dashboard Sections

**Inventory Status**
- **Total Products** - Number of items in inventory
- **Total Inventory Value** - Combined cost of all stock
- **Low Stock Items** - Products below reorder point
- **Out of Stock** - Items with zero quantity
- **Critical Alerts** - Urgent items needing attention

**Quick Stats**
- **Inventory Health** - Overall status (green/yellow/red)
- **Turnover Rate** - How quickly items sell
- **Stock Accuracy** - Physical vs. system counts
- **Last Audit** - When last inventory audit occurred

**Stock Status Overview**
- Visual representation of inventory health
- Color-coded by status
- Breakdown by category

**Recent Movements**
- Latest stock additions
- Recent adjustments
- Pending deliveries
- Recently received orders

**Action Items**
- Low stock items needing reorder
- Expiring products
- Pending deliveries
- Outstanding purchase orders

### Main Navigation Menu

- **Dashboard** - Home/overview
- **Stocks** - Stock level management
- **Products** - Product database
- **Purchase Orders** - Order management
- **Deliveries** - Receiving shipments
- **Suppliers** - Supplier information
- **Stock Alerts** - Low stock monitoring
- **Expiry Tracker** - Expiration date management
- **Stock Transfer** - Inter-branch transfers
- **Reports** - Inventory analytics
- **UPC Generator** - Create barcodes
- **Cost Analysis** - Inventory costing
- **Inventory Audit** - Physical counts

---

## Stock Management

### Viewing Stock Levels

1. Click **"Stocks"** from the menu
2. View all products and their current quantities
3. Each product shows:
   - Product name
   - Current quantity
   - Unit (pcs, bottles, boxes, etc.)
   - Status (In Stock, Low Stock, Out of Stock)
   - Reorder point
   - Unit cost
   - Total value

### Searching for Products

1. Go to **"Stocks"**
2. Use the **search bar**
3. Search by:
   - Product name
   - SKU/Product code
   - Category
4. Results appear instantly

### Filtering Stock

Narrow down stock view:

1. Filter by **Status**:
   - All Items
   - In Stock
   - Low Stock
   - Out of Stock
   - Discontinued

2. Filter by **Category**:
   - Hair Care Products
   - Styling Products
   - Color Products
   - Nail Products
   - Etc.

3. Sort by:
   - Name (A-Z)
   - Quantity (high to low)
   - Value (high to low)
   - Reorder Point

### Stock Details

Click on any product to see:

- **Product Information**
  - Name and description
  - SKU/barcode
  - Category
  - Brand/manufacturer

- **Inventory Data**
  - Current quantity
  - Reorder point
  - Last reorder date
  - Supplier
  - Unit cost
  - Retail price (if sold)

- **Stock Movement History**
  - When added/received
  - Adjustments made
  - Sales/usage
  - Current balance

- **Expiry Information**
  - Batch numbers
  - Expiration dates
  - Age of oldest stock

---

## Inventory Adjustments

### When to Adjust Inventory

Adjustments are made for:

- **Damage** - Products damaged and unusable
- **Salon Use** - Products used in the salon (not sold)
- **Recount** - Correcting system vs. actual count
- **Waste** - Unusable products
- **Theft/Loss** - Missing items
- **Sampling** - Products given as samples
- **Promotional** - Items used for promotions

### Making Stock Adjustments

1. Click **"Stocks"**
2. Find the product to adjust
3. Click **"Adjust Stock"** or the adjustment icon
4. Enter adjustment details:
   - **Adjustment Type** - Add or Remove
   - **Quantity** - Amount to adjust
   - **Reason** - Why adjusting (damage, salon use, etc.)
   - **Notes** - Additional details
   - **Date** - When adjustment occurred
5. Click **"Save"**

### Adjustment Examples

**Damaged Product:**
- Type: Remove
- Quantity: 5
- Reason: Damage
- Notes: "Bottles damaged in delivery, unusable"

**Salon Use:**
- Type: Remove
- Quantity: 3
- Reason: Salon Use
- Notes: "Used for staff haircuts and treatments"

**Recount Correction:**
- Type: Add or Remove as needed
- Quantity: The difference
- Reason: Recount
- Notes: "Physical count corrected system count"

### Adjustment History

1. Open a product's details
2. Click **"Adjustment History"**
3. View all past adjustments:
   - Date of adjustment
   - Quantity changed
   - Reason
   - Who made it
   - Notes

---

## Purchase Orders

### Creating Purchase Orders

1. Click **"Purchase Orders"** from the menu
2. Click **"New Purchase Order"** or **"Create Order"**
3. Enter order details:
   - **Supplier** - Who you're ordering from
   - **Delivery Date** - When you need it
   - **Notes** - Special instructions
4. Add items to order:
   - Click **"Add Item"**
   - Select **Product** from dropdown
   - Enter **Quantity** needed
   - Unit price auto-fills
   - Can edit if pricing differs
5. Review order total
6. Click **"Save"** or **"Submit"**

### PO Status

Purchase orders have statuses:

- **Draft** - Not yet submitted
- **Pending** - Submitted but not confirmed
- **Ordered** - Confirmed with supplier
- **Shipped** - In transit
- **Delivered** - Received at branch
- **Cancelled** - Order cancelled

### Viewing Purchase Orders

1. Go to **"Purchase Orders"**
2. View all orders (current and historical)
3. Filter by:
   - **Status** - Draft, pending, ordered, etc.
   - **Date Range** - Specific period
   - **Supplier** - Orders from specific supplier
   - **Branch** - If multi-branch

### Purchase Order Details

Click on any PO to see:

- **Order Information**
  - Order number
  - Date created
  - Supplier
  - Expected delivery

- **Line Items**
  - Products ordered
  - Quantities
  - Unit prices
  - Line totals

- **Order Total**
  - Subtotal
  - Shipping (if applicable)
  - Taxes (if applicable)
  - Grand total

- **Status & History**
  - Current status
  - Status changes
  - Dates of each status

### Modifying Purchase Orders

Before order is confirmed:

1. Find the PO in Draft status
2. Click **"Edit"**
3. Make changes:
   - Add/remove items
   - Adjust quantities
   - Update notes
4. Click **"Save"**

After confirmation, contact supplier directly for changes.

### Cancelling Orders

1. Find the purchase order
2. Click **"Cancel"**
3. Enter reason for cancellation
4. Click **"Confirm"**
5. If already shipped, coordinate return with supplier

---

## Deliveries & Receiving

### Viewing Expected Deliveries

1. Click **"Deliveries"** from the menu
2. See upcoming and recent deliveries
3. Each shows:
   - Supplier name
   - Expected delivery date
   - Associated purchase order
   - Number of items
   - Status

### Receiving Shipments

When a shipment arrives:

1. Go to **"Deliveries"**
2. Find the expected delivery
3. Click **"Receive Delivery"** or **"Mark Received"**
4. System opens receipt form

### Completing Receipt

1. Verify the delivery:
   - Check supplier and order number
   - Count packages/boxes
   - Verify they match expected items
2. For each item, enter:
   - **Product** - What was ordered
   - **Expected Quantity** - What should be received
   - **Received Quantity** - What actually arrived
   - Note any discrepancies
3. Check for **Damage**:
   - Inspect all items
   - Note any damaged/defective items
   - Adjust received quantity if needed
4. Click **"Confirm Receipt"**

System updates:
- Stock quantities increase
- Delivery status changes to "Received"
- Items become available for use

### Handling Discrepancies

If received differs from ordered:

1. Document the discrepancy in the receipt
2. Take photos of damaged items if applicable
3. Contact supplier with details
4. Options:
   - **Accept as is** - Take what was sent
   - **Request replacement** - Supplier sends correct items
   - **Partial shipment** - Wait for rest or cancel
5. Track discrepancy resolution

### Return Process

For items that need to be returned:

1. Create a **Return Order** (if available)
2. Or contact supplier directly
3. Document items being returned
4. Adjust inventory when items ship back
5. Track refund/credit status

---

## Suppliers Management

### Viewing All Suppliers

1. Click **"Suppliers"** from the menu
2. View all suppliers your branch uses
3. Each shows:
   - Supplier name
   - Contact person
   - Phone/email
   - Address
   - Status (Active/Inactive)
   - Recent order count

### Supplier Details

Click on any supplier to view:

- **Contact Information**
  - Company name
  - Contact person
  - Phone number
  - Email address
  - Mailing address
  - Website (if available)

- **Payment Terms**
  - Payment method
  - Payment terms (Net 30, COD, etc.)
  - Account number (if applicable)

- **Order History**
  - All past orders
  - Dates and amounts
  - Items typically ordered
  - Delivery reliability

- **Performance Metrics**
  - On-time delivery rate
  - Quality issues
  - Response time
  - Pricing competitiveness

### Adding Suppliers

1. Click **"Suppliers"**
2. Click **"Add New Supplier"**
3. Enter supplier information:
   - **Company Name**
   - **Contact Person**
   - **Phone Number**
   - **Email Address**
   - **Address**
   - **Website** (optional)
   - **Payment Terms**
   - **Account Number** (if applicable)
4. Click **"Save"**

### Editing Supplier Information

1. Find the supplier
2. Click **"Edit"**
3. Update information as needed
4. Click **"Save Changes"**

### Supplier Performance

Track supplier reliability:

1. View supplier details
2. Check:
   - Delivery timeliness
   - Product quality
   - Order accuracy
   - Pricing trends
3. Use this info when deciding:
   - Whether to reorder
   - If supplier needs change
   - What to negotiate

### Supplier Communication

Keep supplier info updated for:

- Order placement
- Delivery coordination
- Issue resolution
- Payment processing
- Account management

---

## Stock Alerts & Monitoring

### Low Stock Alerts

The system alerts you when stock falls below reorder point:

1. Alerts appear on **Dashboard**
2. Go to **"Stock Alerts"** to review all alerts
3. Each alert shows:
   - Product name
   - Current quantity
   - Reorder point
   - Supplier
   - Lead time

### Reorder Point Setting

Reorder point is the stock level that triggers ordering:

- Typically set by operational manager
- Based on sales velocity and lead time
- Example: If selling 10 units/day and lead time is 5 days, reorder point might be 60 units

### Responding to Alerts

When you see a low stock alert:

1. Review the alert details
2. Check current quantity
3. Check reorder point
4. Create a purchase order:
   - Click **"Create PO"** from alert
   - Select supplier
   - Determine order quantity
   - Submit order

**Order Quantity Formula:**
- Reorder point + (daily usage × lead time)
- Or use supplier's minimum order quantity if higher

### Critical Stock

For items completely out of stock:

1. Review **"Out of Stock"** items
2. Prioritize reorders
3. Contact supplier for expedited delivery if needed
4. Consider alternatives if critical items

### Monitoring Stock Health

Regular monitoring helps:

- Prevent stockouts
- Reduce excess inventory
- Identify slow-moving items
- Adjust reorder points as needed
- Maintain cash flow efficiency

---

## Expiry Tracker

### Understanding Product Expiry

Some products have expiration dates:

- Hair care products
- Color products
- Treatment products
- Beauty products
- Medical supplies

### Viewing Expiry Dates

1. Click **"Expiry Tracker"** from the menu
2. View all products with expiration dates
3. Organized by expiration date (soonest first)
4. Color-coded by urgency:
   - **Red** - Expires within 7 days
   - **Yellow** - Expires within 30 days
   - **Green** - Expires in 30+ days

### Product Expiry Details

Each expiring product shows:

- **Product Name** - What product
- **Batch Number** - Specific batch
- **Expiration Date** - When it expires
- **Current Quantity** - How much in stock
- **Cost** - Value at risk

### Removing Expired Products

When a product expires:

1. Go to **"Expiry Tracker"**
2. Find the expired product
3. Click **"Remove From Stock"** or **"Dispose"**
4. Adjust the inventory:
   - Type: Remove
   - Quantity: All remaining
   - Reason: Expired
5. Note disposal method if required

### Preventing Expiry Issues

Best practices:

- **First In, First Out (FIFO)** - Use oldest stock first
- **Regular Monitoring** - Check expiry tracker weekly
- **Proper Storage** - Store appropriately to extend shelf life
- **Training** - Ensure staff uses products before expiry
- **Supplier Coordination** - Get products with longer shelf life

### Using Products Before Expiry

Track which products are likely to expire:

1. Check expiry tracker weekly
2. Use those products in services/promotions
3. Recommend to stylists to use before expiry
4. Offer to clients before disposal
5. Plan promotions around expiring stock

---

## Stock Transfer

### Inter-Branch Transfers

If your organization has multiple branches, you may transfer stock:

1. Click **"Stock Transfer"** from the menu
2. Click **"New Transfer"** or **"Initiate Transfer"**
3. Enter transfer details:
   - **From Branch** - Your branch
   - **To Branch** - Destination branch
   - **Reason** - Why transferring (excess, need, rebalance, etc.)
4. Add items:
   - **Product** - What to transfer
   - **Quantity** - How much
5. Review transfer details
6. Click **"Submit"**

### Transfer Process

1. **Initiate** - You submit transfer request
2. **Receive Branch Confirms** - Other branch confirms receipt
3. **Stock Updates** - Both branches' inventory adjusts
4. **Complete** - Transfer finalized

### Viewing Transfer History

1. Go to **"Stock Transfer"**
2. View all transfers (sent and received)
3. Filter by:
   - **Direction** - Sent or Received
   - **Date Range**
   - **Receiving Branch**
   - **Status**

### Receiving Transfers

When another branch sends you stock:

1. Go to **"Stock Transfer"**
2. View **"Pending Received Transfers"**
3. When stock arrives:
   - Verify items and quantities
   - Click **"Confirm Receipt"**
4. Stock is added to your inventory

---

## Reports & Analytics

### Available Reports

**Inventory Reports:**
- Stock levels by product
- Stock levels by category
- Inventory value summary
- Stock movement report

**Movement Reports:**
- Product sales/usage
- Stock adjustments
- Inbound/outbound tracking
- Inventory turnover

**Supplier Reports:**
- Orders by supplier
- Delivery performance
- Spend by supplier
- Quality issues

**Analysis Reports:**
- Cost analysis
- Profitability by item
- Slow-moving products
- High-value items

### Running Reports

1. Click **"Reports"** from the menu
2. Select **report type**
3. Choose **date range**
4. Apply filters:
   - By product category
   - By supplier
   - By status
5. Click **"Generate"**
6. Review results

### Exporting Reports

1. Open finished report
2. Click **"Export"** or **"Download"**
3. Choose format:
   - **PDF** - For printing/sharing
   - **Excel** - For further analysis
4. File downloads

### Using Reports

Reports help you:

- Understand inventory trends
- Identify slow-moving items
- Prioritize reorders
- Analyze supplier performance
- Make purchasing decisions
- Plan promotions
- Control costs

---

## UPC Generator

### Understanding UPCs

UPC (Universal Product Code) is a barcode for product identification:

- Enables fast checkout
- Tracks inventory
- Integrates with sales system
- Helps prevent errors

### Generating UPCs

1. Click **"UPC Generator"** from the menu
2. Select **product** to generate UPC for
3. System can:
   - Generate new UPC
   - Use existing supplier UPC
4. Click **"Generate"**
5. UPC is created and assigned to product

### Printing Barcodes

1. Go to **"UPC Generator"**
2. Select products to print
3. Click **"Print Barcodes"**
4. Printer dialog opens
5. Print barcode labels
6. Apply labels to products

### Using Barcodes

Barcodes help with:

- Quick stock counts (scan to verify)
- Fast checkout (scan at register)
- Inventory tracking
- Preventing counting errors

---

## Cost Analysis

### Understanding Inventory Costs

1. Click **"Cost Analysis"** from the menu
2. View detailed cost breakdown

### Cost Metrics

- **Total Inventory Value** - Cost of all stock
- **High-Value Items** - Most expensive products
- **Cost per Item** - Unit costs
- **Turnover Rate** - How quickly items sell
- **Holding Costs** - Cost of storing inventory

### Analyzing Item Profitability

For products sold in salon:

1. Compare cost vs. selling price
2. Calculate profit margin
3. Identify:
   - High-margin items (buy more)
   - Low-margin items (reduce stock)
   - Non-profit items (discontinue)

### Supplier Cost Comparison

Compare costs across suppliers:

1. Review same product from different suppliers
2. Consider:
   - Unit price
   - Shipping costs
   - Quality
   - Lead time
3. Switch suppliers if better value

### Reducing Inventory Costs

Strategies:

- Reduce holding costs (excess inventory)
- Negotiate better pricing with suppliers
- Consolidate orders for volume discounts
- Sell slow-moving inventory quickly
- Minimize waste/expiry

---

## Inventory Audit

### What is an Inventory Audit?

A physical count of all inventory to verify system accuracy.

### Planning an Audit

1. Click **"Inventory Audit"** from the menu
2. Click **"Schedule Audit"** or **"Start Audit"**
3. Choose audit approach:
   - **Full Audit** - Count everything
   - **Cycle Audit** - Count by category over time
   - **Spot Check** - Sample count

### Conducting the Audit

1. Print audit sheet (list of products with system quantities)
2. Count each product physically
3. Record actual count
4. Compare to system count
5. Investigate discrepancies

### Recording Audit Results

1. Go to **"Inventory Audit"**
2. Enter actual counts for each product
3. System calculates variances
4. Large discrepancies are highlighted
5. Review and accept variances
6. System generates adjustment recommendations

### Investigating Discrepancies

If physical count differs from system:

1. Recount to confirm
2. Review recent adjustments
3. Check for receiving errors
4. Look for data entry mistakes
5. Investigate possible theft/loss
6. Document findings

### Making Audit Adjustments

1. Review audit recommendations
2. Approve adjustments
3. System creates adjustment transactions
4. Inventory balances are corrected
5. Historical record maintained

### Regular Audit Schedule

Recommend:

- **Full Audit** - Quarterly or annually
- **Cycle Audits** - Monthly by category
- **Spot Checks** - Random weekly sampling

---

## Profile Management

### Accessing Your Profile

1. Click your **name/avatar** in top-right corner
2. Select **"Profile"** or **"My Account"**

### Profile Information

Your profile displays:

- **Personal Information**
  - Full name
  - Email
  - Phone

- **Employment Details**
  - Role
  - Branch
  - Hire date

- **Account Settings**
  - Password
  - Notifications
  - Preferences

### Changing Password

1. Go to **"Profile"**
2. Click **"Change Password"**
3. Enter **current password**
4. Enter **new password** (twice)
5. Click **"Update"**

**Requirements:**
- Minimum 8 characters
- Mix of upper/lowercase
- At least one number
- At least one special character

### Notification Preferences

1. Go to **"Profile"** → **"Notifications"**
2. Configure alerts for:
   - Low stock alerts
   - Delivery alerts
   - Expiry reminders
   - Order status updates
3. Choose delivery method (email, in-app, SMS)

---

## FAQ & Troubleshooting

### Stock Management

**Q: How often should I check stock levels?**
A: Daily for critical items, weekly for others. Check dashboard for alerts.

**Q: What's the difference between a recount and an adjustment?**
A: Both change quantity, but recount corrects system count while adjustment is for usage/damage.

**Q: Can I undo a stock adjustment?**
A: The adjustment is recorded. To reverse it, make an opposite adjustment and document why.

### Purchase Orders

**Q: How long does delivery usually take?**
A: Varies by supplier. Check supplier information or ask about lead time when ordering.

**Q: Can I modify a PO after submitting?**
A: Only if status is still "Draft" or "Pending". Contact supplier directly for "Ordered" or later.

**Q: What should I do if ordered item is out of stock at supplier?**
A: Supplier will notify you. Can choose substitute item or cancel that line.

### Receiving

**Q: What if received quantity doesn't match ordered?**
A: Document the discrepancy when receiving. Contact supplier and decide on replacement or return.

**Q: How do I handle damaged items during delivery?**
A: Note damage during receipt, take photos, contact supplier, make return claim.

**Q: Can I partially receive an order?**
A: Yes, receive what arrived and note pending items. Supplier should deliver rest soon.

### Expiry

**Q: How far in advance should I reorder before expiry?**
A: Check how fast product sells. If selling 10/day, start using when 60+ days remain.

**Q: Can expired products be used in salon?**
A: No, expired products should be disposed. Use before they expire.

**Q: What if I have a lot of product about to expire?**
A: Use in promotions, recommend to stylists, or offer discounts to move quickly.

### Technical

**Q: Why can't I find a product in the system?**
A: Product may not be in database. Add it first or check spelling in search.

**Q: The report won't generate.**
A: Check date range is valid. Try different browser or contact IT if persists.

**Q: Stock numbers seem incorrect.**
A: Run an audit to verify physical count. Review adjustments for errors.

---

## Tips & Best Practices

✅ **Do:**
- Check dashboard daily for alerts
- Use FIFO (First In, First Out) method
- Monitor expiry dates weekly
- Keep supplier contact info updated
- Document all adjustments
- Conduct regular audits
- Respond to low stock alerts promptly
- Build strong supplier relationships
- Review reports monthly
- Communicate with branch manager

❌ **Don't:**
- Ignore low stock alerts
- Let products expire
- Store damaged products
- Lose supplier invoices
- Skip inventory audits
- Make wild guesses on quantities
- Order without checking current stock
- Neglect supplier communication
- Ignore discrepancies
- Share supplier information inappropriately

---

## Daily Workflow

### Morning
1. Check dashboard for alerts
2. Review overnight deliveries if any
3. Check expiry tracker for items expiring soon
4. Plan for day's stock needs

### During the Day
1. Receive incoming deliveries
2. Monitor stock movements
3. Address low stock alerts
4. Respond to branch manager requests

### End of Day
1. Reconcile day's adjustments
2. Review any discrepancies
3. Plan next day's needs
4. Update supplier communications

---

## Getting Help

For assistance:

1. Refer to this manual
2. Contact your **Branch Manager** for branch questions
3. Reach out to **Overall Inventory Controller** for multi-branch issues
4. Contact **System Administrator** for technical problems

---

## System Requirements

- **Browser:** Chrome, Firefox, Safari, or Edge (latest)
- **Internet:** Stable connection required
- **Device:** Desktop or tablet recommended
- **Printer:** For barcode printing (optional)

---

## Updates & Changes

This manual is regularly updated as new features are added.

**Last Updated:** February 2026
**Version:** 1.0

---

**Great inventory management keeps the salon running smoothly. Well done!**
