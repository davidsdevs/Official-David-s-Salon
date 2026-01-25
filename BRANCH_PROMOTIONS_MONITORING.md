# Branch Promotions Monitoring Implementation

## Overview
Transformed the Operational Manager System-Wide Promotions page into a Branch Promotions Monitoring view. This allows operational managers to monitor which promotions are active in each branch and drill down to see detailed promotion information.

## Changes Made

### 1. New View Modes
- **Branch List View**: Shows all branches as cards with promotion counts
- **Branch Detail View**: Shows detailed promotions for a selected branch (active + past)

### 2. Branch Cards View
Each branch card displays:
- Branch name and icon (Globe for system-wide, Building2 for regular branches)
- Branch address (if available)
- **Active Promotions Count**: Green badge showing number of currently active promotions
- **Total Promotions Count**: Gray badge showing total number of promotions (active + past)
- Click to drill down into branch details

### 3. Branch Detail View
When clicking a branch card, users see:
- **Back Button**: Return to branch list
- **Branch Header**: Branch name with icon
- **Stats Cards**: 3 summary cards showing:
  - Active Promotions (green)
  - Past Promotions (gray)
  - Total Promotions (blue)
- **Active Promotions Section**: Grid of active promotion cards with green theme
- **Past Promotions Section**: Grid of past/expired promotion cards with gray theme (75% opacity)

### 4. Promotion Cards
Each promotion card shows:
- Promotion name and description
- Active/Expired status badge
- Discount value (percentage or fixed amount)
- Promotion code
- Date range
- Action buttons: Edit, Send Email, Preview Email, Delete

### 5. Data Fetching
- Fetches both promotions and branches on page load
- Filters promotions by branch ID
- System-wide promotions (branchId === null) shown as a special "branch"
- Calculates active vs past promotions based on current date and promotion date range

### 6. Helper Functions
- `getActivePromotionsCount(branchId)`: Returns count of active promotions for a branch
- `getBranchPromotions(branchId)`: Returns all promotions for a branch
- `handleBranchClick(branch)`: Switches to detail view for selected branch
- `handleBackToBranchList()`: Returns to branch list view
- `isActive(promotion)`: Checks if promotion is currently active

## Features Preserved
- All existing promotion management features (create, edit, delete)
- Email sending functionality
- Email preview
- Image upload for promotions
- All promotion form fields and validation

## UI/UX Improvements
- Clear visual hierarchy with color-coded sections
- Hover effects on branch cards
- Smooth transitions between views
- Responsive grid layouts
- Icon-based visual indicators
- Active promotions use green theme
- Past promotions use gray theme with reduced opacity

## File Modified
- `src/pages/operational-manager/Promotions.jsx`

## Dependencies
- Added `ArrowLeft` and `TrendingUp` icons from lucide-react
- Uses existing `getAllBranches` from branchService
- Uses existing `getAllPromotions` from promotionService

## Testing Recommendations
1. Verify branch cards display correct promotion counts
2. Test clicking branch cards to view details
3. Verify active vs past promotions are correctly categorized
4. Test back button navigation
5. Verify system-wide promotions appear as a special branch
6. Test all existing promotion management features still work
7. Verify responsive layout on different screen sizes

## Notes
- System-wide promotions (branchId === null) are shown as a special "branch" at the top of the list
- Past promotions are displayed with 75% opacity to visually distinguish them
- Active promotions use green color scheme, past use gray
- All existing modals and functionality preserved
