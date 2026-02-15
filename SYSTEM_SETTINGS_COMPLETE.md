# System Settings - Implementation Complete

## Overview
Created a comprehensive System Settings page in System Admin where David's Salon details, TIN, BIR information, and all company-wide settings can be configured. The settings are automatically applied to receipts and throughout the system.

## Features Implemented

### 1. System Settings Page (`/admin/system-settings`)

#### Five Configuration Tabs

**1. Company Information**
- Company Name (required)
- Legal Company Name
- Company Tagline
- Business Type (Sole Proprietorship/Partnership/Corporation/Cooperative)
- Date Established
- SEC Registration No.
- DTI Registration No.
- Mayor's Permit No.

**2. BIR Information**
- TIN (Tax Identification Number) - Format: XXX-XXX-XXX-XXX
- VAT Registered toggle
- BIR Accreditation No.
- BIR Permit No.
- BIR Permit Date Issued

**3. Contact Details**
- Head Office Address (Street, City, Province, Zip Code)
- Head Office Phone
- Head Office Email
- Customer Service Phone
- Customer Service Email
- Fax Number
- Website URL
- Facebook Page
- Instagram Handle

**4. Receipt Settings**
- Receipt Header
- Receipt Footer
- Return/Exchange Policy
- Warranty Policy

**5. Operational Settings**
- Default Currency (PHP/USD)
- Default Timezone
- Fiscal Year Start
- Feature Toggles:
  - Loyalty Program
  - Promotions
  - Referral Program
  - Online Booking

### 2. System Settings Service

**File**: `src/services/systemSettingsService.js`

#### Core Functions

**getSystemSettings()**
- Fetches current system settings from Firestore
- Returns default settings if none exist
- Handles date conversions

**updateSystemSettings(settingsData, currentUser)**
- Creates or updates system settings
- Logs activity for audit trail
- Handles date field conversions
- Shows success/error toasts

**validateSystemSettings(settingsData)**
- Validates company name (required)
- Validates TIN format (XXX-XXX-XXX-XXX)
- Validates email addresses
- Validates phone numbers (Philippine format)
- Validates URLs
- Returns validation errors

**resetSystemSettingsToDefault(currentUser)**
- Resets to default Philippine settings
- Logs activity
- Requires confirmation

**getFormattedAddress(settings)**
- Returns formatted company address string

**getCompanyContactInfo(settings)**
- Returns structured contact information object

### 3. Receipt Integration

The Receipt component now automatically uses system settings:

**Company Name**
- Uses `systemSettings.companyName` instead of hardcoded "DAVID'S SALON"

**TIN**
- Uses `systemSettings.tin` with fallback to branch TIN
- Format: XXX-XXX-XXX-XXX

**VAT Registration**
- Shows "VAT Registered" or "Non-VAT" based on `systemSettings.vatRegistered`

**BIR Information**
- Accreditation No: `systemSettings.birAccreditationNo`
- Permit No: `systemSettings.birPermitNo`
- Date Issued: `systemSettings.birPermitDateIssued`

**Receipt Footer**
- Uses `systemSettings.receiptFooter`
- Default: "Thank you for your purchase!"

**Return Policy**
- Uses `systemSettings.returnPolicy`
- Displayed on all receipts

### 4. Database Structure

#### Collection: `system_settings`
```javascript
{
  // Company Information
  companyName: "David's Salon",
  companyLegalName: "David's Salon Corporation",
  companyTagline: "Your Beauty, Our Passion",
  
  // BIR Information
  tin: "000-000-000-000",
  birAccreditationNo: "ACC-12345",
  birPermitNo: "PER-67890",
  birPermitDateIssued: Timestamp,
  vatRegistered: true,
  
  // Head Office
  headOfficeAddress: "123 Main Street",
  headOfficeCity: "Manila",
  headOfficeProvince: "Metro Manila",
  headOfficeZipCode: "1000",
  headOfficePhone: "+63 2 1234 5678",
  headOfficeEmail: "info@davidssalon.com",
  headOfficeFax: "+63 2 1234 5679",
  
  // Business Information
  businessType: "Corporation",
  dateEstablished: Timestamp,
  secRegistrationNo: "SEC-XXXXXXXXX",
  dtiRegistrationNo: "DTI-XXXXXXXXX",
  mayorPermitNo: "MP-XXXXXXXXX",
  
  // Contact Information
  customerServicePhone: "+63 2 8888 8888",
  customerServiceEmail: "support@davidssalon.com",
  websiteUrl: "https://www.davidssalon.com",
  facebookPage: "facebook.com/davidssalon",
  instagramHandle: "@davidssalon",
  
  // Receipt Settings
  receiptHeader: "David's Salon",
  receiptFooter: "Thank you for choosing David's Salon!",
  returnPolicy: "Products may be returned within 7 days...",
  warrantyPolicy: "Services are guaranteed for 7 days...",
  
  // System Settings
  defaultCurrency: "PHP",
  defaultTimezone: "Asia/Manila",
  defaultLanguage: "en",
  fiscalYearStart: "01-01",
  
  // Feature Toggles
  enableLoyaltyProgram: true,
  enablePromotions: true,
  enableReferralProgram: true,
  enableOnlineBooking: true,
  
  isActive: true,
  createdBy: "userId",
  createdByName: "User Name",
  createdAt: Timestamp,
  updatedBy: "userId",
  updatedByName: "User Name",
  updatedAt: Timestamp
}
```

## User Interface

### Navigation
- **Location**: System Admin → Configuration → System Settings
- **URL**: `/admin/system-settings`
- **Icon**: Building2 (Settings icon)

### Page Layout
1. **Header**
   - Title: "System Settings"
   - Description: "Configure company-wide settings and information"
   - Actions: Reset to Default, Save Changes

2. **Validation Errors Banner** (if errors exist)
   - Red background
   - List of validation errors
   - Clear error messages

3. **Info Banner**
   - Blue background
   - Explains settings apply company-wide
   - Reminds to keep information accurate

4. **Tab Navigation**
   - Company Info
   - BIR Information
   - Contact Details
   - Receipt Settings
   - Operational

5. **Tab Content**
   - Form fields organized by category
   - Input validation
   - Helper text
   - Toggles for boolean settings

6. **Save Reminder** (if changes exist)
   - Yellow background
   - Unsaved changes warning
   - Quick save button

### Validation

**TIN Format**
- Pattern: `XXX-XXX-XXX-XXX`
- Example: `123-456-789-000`
- Error: "TIN must be in format: XXX-XXX-XXX-XXX"

**Email Validation**
- Standard email format
- Error: "Email is invalid"

**Phone Validation**
- Philippine format: `+63XXXXXXXXXX` or `09XXXXXXXXX`
- Error: "Phone number is invalid"

**URL Validation**
- Valid URL format
- Error: "URL is invalid"

**Required Fields**
- Company Name (required)
- Error: "Company name is required"

## Integration Points

### Receipt Component
```javascript
// Automatically loads system settings
const [systemSettings, setSystemSettings] = useState(null);

useEffect(() => {
  const loadSettings = async () => {
    const settings = await getSystemSettings();
    setSystemSettings(settings);
  };
  loadSettings();
}, []);

// Uses settings in receipt
<h1>{systemSettings?.companyName || "DAVID'S SALON"}</h1>
<p>TIN: {systemSettings?.tin || '000-000-000-000'}</p>
<p>{systemSettings?.vatRegistered ? 'VAT Registered' : 'Non-VAT'}</p>
```

### Future Integration Points
- Email templates (use company name, contact info)
- Reports (use company header, TIN)
- Invoices (use BIR information)
- Website (use contact information)
- Marketing materials (use tagline, social media)

## Activity Logging

All system settings changes are logged:
- **Action**: CREATE_SYSTEM_SETTINGS or UPDATE_SYSTEM_SETTINGS
- **Performed By**: User ID and name
- **Target**: system_settings
- **Details**: Description of change
- **Metadata**: Full settings data
- **Timestamp**: When change occurred

## Default Settings

### Philippine Business Defaults
```javascript
{
  companyName: "David's Salon",
  companyLegalName: "David's Salon Corporation",
  companyTagline: "Your Beauty, Our Passion",
  tin: "000-000-000-000",
  vatRegistered: true,
  businessType: "Corporation",
  defaultCurrency: "PHP",
  defaultTimezone: "Asia/Manila",
  defaultLanguage: "en",
  fiscalYearStart: "01-01",
  enableLoyaltyProgram: true,
  enablePromotions: true,
  enableReferralProgram: true,
  enableOnlineBooking: true
}
```

## Usage Guide

### Initial Setup
1. Login as System Admin
2. Navigate to Configuration → System Settings
3. Fill in Company Information tab
4. Fill in BIR Information tab (TIN is critical)
5. Fill in Contact Details tab
6. Customize Receipt Settings tab
7. Configure Operational Settings tab
8. Click "Save Changes"

### Updating Settings
1. Navigate to System Settings
2. Select the tab you want to update
3. Modify the fields
4. Click "Save Changes"
5. Changes apply immediately to new receipts

### Resetting to Default
1. Click "Reset to Default" button
2. Confirm the action
3. All settings reset to Philippine defaults
4. Save to apply

## Files Created/Modified

### Created
- `src/services/systemSettingsService.js` - System settings service
- `src/pages/system-admin/SystemSettings.jsx` - Settings page UI
- `SYSTEM_SETTINGS_COMPLETE.md` - This documentation

### Modified
- `src/components/billing/Receipt.jsx` - Uses system settings
- `src/layouts/SystemAdminLayout.jsx` - Added menu item
- `src/routes/AppRoutes.jsx` - Added route

## Benefits

1. **Centralized Configuration**: Single source for company information
2. **BIR Compliance**: Proper TIN and registration details
3. **Consistency**: Same information across all receipts
4. **Easy Updates**: Change once, applies everywhere
5. **Audit Trail**: All changes logged
6. **Validation**: Prevents invalid data
7. **Professional**: Proper company branding
8. **Flexibility**: Customize for different business types
9. **Future-Proof**: Easy to extend with new settings
10. **User-Friendly**: Clear UI with helpful information

## Testing Checklist

### System Settings Page
- [ ] Access System Settings page
- [ ] View all five tabs
- [ ] Update company name
- [ ] Update TIN
- [ ] Toggle VAT registered
- [ ] Update BIR information
- [ ] Update contact details
- [ ] Update receipt settings
- [ ] Toggle feature flags
- [ ] Save changes
- [ ] Reset to default
- [ ] Verify validation errors
- [ ] Check activity logging

### Receipt Integration
- [ ] Create new transaction
- [ ] Print receipt
- [ ] Verify company name shows
- [ ] Verify TIN shows correctly
- [ ] Verify VAT status shows
- [ ] Verify BIR info shows
- [ ] Verify receipt footer shows
- [ ] Verify return policy shows
- [ ] Update settings
- [ ] Create new transaction
- [ ] Verify new settings applied

## Conclusion

The System Settings feature is fully implemented and integrated:
- ✅ Comprehensive settings page
- ✅ Five organized tabs
- ✅ BIR information configuration
- ✅ TIN management
- ✅ Receipt integration
- ✅ Validation
- ✅ Activity logging
- ✅ Default settings
- ✅ Reset functionality
- ✅ User-friendly interface

David's Salon details are now fully configurable and automatically applied throughout the system!
