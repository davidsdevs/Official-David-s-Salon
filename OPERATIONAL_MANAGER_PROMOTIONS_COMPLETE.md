# Operational Manager Promotions - System-Wide Creation Enabled

## Summary
Enabled the Operational Manager to create and manage system-wide promotions that apply to all branches, with the same functionality as System Admin.

## Changes Made

### 1. Updated Page Title and Description
**File**: `src/pages/operational-manager/Promotions.jsx`

Changed the page header from "Branch Promotions Monitoring" to "System-Wide Promotions" with description "Create and manage promotions across all branches" to reflect the ability to create promotions, not just monitor them.

### 2. Added "Create System-Wide Promotion" Button on Main Page
**File**: `src/pages/operational-manager/Promotions.jsx`

Added a prominent "Create System-Wide Promotion" button in the main page header that:
- Appears immediately when the page loads
- Opens the promotion creation modal
- Uses the existing `handleCreate` function

**Location**: Main page header, next to the page title

```jsx
<Button
  onClick={handleCreate}
  className="flex items-center gap-2"
>
  <Plus className="h-5 w-5" />
  Create System-Wide Promotion
</Button>
```

### 3. Added "Create Promotion" Button in Detail View
**File**: `src/pages/operational-manager/Promotions.jsx`

Added a "Create Promotion" button in the branch detail view header that:
- Only appears when viewing the "System-Wide Promotions" section
- Opens the promotion creation modal
- Provides an alternative way to create promotions

**Location**: Detail view header, next to the "Back to Branches" button

### 4. Fixed handleCreate Function
**File**: `src/pages/operational-manager/Promotions.jsx`

Added `branchId: ''` to the initial form data in `handleCreate` to ensure the field is properly initialized (empty string will be converted to null for system-wide promotions).

### 5. Verified Existing Functionality

The page already had all the necessary infrastructure matching System Admin:
- ✅ `handleCreate` function - initializes form with empty data
- ✅ `handleSubmit` function - creates/updates promotions with `branchId: null` for system-wide
- ✅ Modal form - complete with all fields, no branch selector
- ✅ System-wide indicator - blue banner stating "This promotion will be available in ALL branches"
- ✅ Image upload - Cloudinary integration
- ✅ Email preview and sending - to selected clients
- ✅ Edit and delete functionality - for existing promotions
- ✅ Promotion code generation - auto-generate random codes

## How It Works (Same as System Admin)

### Creating a System-Wide Promotion

**Method 1: From Main Page (Recommended)**
1. Navigate to Operational Manager → Promotions
2. Click "Create System-Wide Promotion" button in the header
3. Fill in the promotion details and submit

**Method 2: From Detail View**
1. Navigate to Operational Manager → Promotions
2. Click on "System-Wide Promotions" card
3. Click "Create Promotion" button in the header
4. Fill in the promotion details and submit

### Promotion Form Fields

- **Promotion Name** (required) - e.g., "Summer Sale 2024"
- **Promotion Code** (required) - Can be auto-generated or manually entered
- **Description** - Optional description of the promotion
- **Discount Type** - Percentage (%) or Fixed Amount (₱)
- **Discount Value** (required) - The discount amount
- **Target Segment** - all, silver, gold, platinum
- **Applicable To** - all, services, products, specific items
- **Usage Type** - one-time or repeating
- **Max Uses** - Optional limit for repeating promotions
- **Start Date** (required)
- **End Date** (required)
- **Image** - Optional promotional image
- **Active Status** - Toggle to activate/deactivate

The promotion is created with `branchId: null`, making it available to all branches.

## Key Differences from Branch Manager

- **Operational Manager**: Can ONLY create system-wide promotions (branchId = null)
- **Branch Manager**: Can create branch-specific promotions (branchId = specific branch)
- **System Admin**: Can create both system-wide and branch-specific promotions

## Database Structure

System-wide promotions are stored in Firestore with:
```javascript
{
  name: "Promotion Name",
  title: "Promotion Name", // Backward compatibility
  promotionCode: "PROMO123",
  branchId: null, // null = system-wide, applies to all branches
  discountType: "percentage",
  discountValue: 20,
  startDate: Timestamp,
  endDate: Timestamp,
  isActive: true,
  imageUrl: "https://...",
  // ... other fields
}
```

## Validation

The system validates:
- ✅ Required fields (name, code, discount value, dates)
- ✅ End date must be after start date
- ✅ Image size (max 5MB)
- ✅ Image type (must be image file)
- ✅ Promotion code uniqueness
- ✅ Date validity when applying promotion
- ✅ Max uses must be positive number (for repeating promotions)

## Email Integration

System-wide promotions can be sent to clients via email:
- Select specific clients or all clients
- Preview email before sending
- Email includes promotion image, details, code, and validity period
- Tracks send success/failure

## Notes

- System-wide promotions (branchId = null) are automatically available to all branches
- Branch-specific promotions can still be created by Branch Managers
- When validating a promotion code, the system checks both branch-specific and system-wide promotions
- The Operational Manager can only create system-wide promotions, not branch-specific ones
- The functionality is identical to System Admin's system-wide promotion creation

## Testing Checklist

- [x] "Create System-Wide Promotion" button appears on main page
- [x] "Create Promotion" button appears in System-Wide Promotions detail view
- [x] Both buttons open the creation modal
- [x] Modal has all required fields
- [x] Modal shows "This promotion will be available in ALL branches" message
- [x] Form validation works correctly
- [x] Promotion code can be auto-generated
- [x] Promotion is created with branchId = null
- [x] Created promotion appears in the list
- [x] Edit functionality works
- [x] Delete functionality works
- [x] Email sending works
- [x] Email preview works
- [x] Image upload works

## Related Files

- `src/pages/operational-manager/Promotions.jsx` - Main page component
- `src/pages/system-admin/Promotions.jsx` - Reference implementation
- `src/services/promotionService.js` - Promotion CRUD operations
- `src/services/emailService.js` - Email sending functionality
- `src/services/cloudinaryService.js` - Image upload functionality
