# Promotions Seeding Summary

## Task Completed
Successfully seeded 18 promotions into the Firestore database with realistic date ranges and variety.

## Execution Details

### Script Used
- **File**: `scripts/seedPromotions.js`
- **Execution Date**: January 16, 2026
- **Status**: ✅ Completed Successfully

### Data Seeded

#### Promotion Breakdown
- **Total Promotions**: 18
- **Active Promotions**: 5 (currently running)
- **Inactive Promotions**: 13 (5 expired, 8 future)
- **Percentage Discounts**: 12
- **Fixed Amount Discounts**: 6

### Promotions Created

#### Active Promotions (Currently Running)
1. **Senior Citizen Special** - 15% off (Jan 15 → Jan 31, 2026)
   - Code: DS-2JC-VAS2H
2. **Birthday Month Treat** - ₱300 off (Jan 10 → Jan 25, 2026)
   - Code: DS-2JC-7LCT5
3. **Weekend Warrior** - 10% off (Jan 14 → Jan 24, 2026)
   - Code: DS-2JC-MZA7B
4. **First Time Client** - 20% off (Jan 16 → Jan 27, 2026)
   - Code: DS-2JC-AKZVC
5. **Loyalty Rewards** - ₱150 off (Jan 12 → Feb 7, 2026)
   - Code: DS-2JC-I4S4Z

#### Expired Promotions (Past)
1. **New Year Special** - 10% off (Nov 9 → Nov 28, 2025)
2. **Valentine's Day Promo** - 15% off (Oct 19 → Nov 5, 2025)
3. **Summer Glow Package** - ₱200 off (Nov 18 → Dec 6, 2025)
4. **Midweek Madness** - 20% off (Nov 7 → Nov 14, 2025)
5. **Student Discount** - 12% off (Nov 30 → Dec 13, 2025)

#### Future Promotions (Upcoming)
1. **Flash Sale Friday** - 25% off (Feb 2 → Feb 9, 2026)
2. **Mother's Day Special** - 18% off (Feb 5 → Feb 18, 2026)
3. **Back to School Promo** - ₱250 off (Feb 6 → Feb 17, 2026)
4. **Holiday Season Sale** - 15% off (Jan 23 → Feb 11, 2026)
5. **Anniversary Celebration** - 30% off (Jan 31 → Feb 11, 2026)
6. **Rainy Day Discount** - ₱100 off (Jan 31 → Feb 18, 2026)
7. **Early Bird Special** - 12% off (Jan 22 → Feb 11, 2026)
8. **Referral Bonus** - ₱200 off (Feb 8 → Feb 22, 2026)

### Promotion Structure

Each promotion includes:
- **applicableTo**: "all" (applies to all services/products)
- **branchId**: "2jcrfvY7pxnMdsc1qbC4" (Ayala Malls Harbor Point)
- **createdBy**: "sso_admin_001" (David Admin)
- **discountType**: "percentage" or "fixed"
- **discountValue**: Varies (10-30% or ₱100-300)
- **imageUrl**: Cloudinary image URL
- **isActive**: true/false (based on current date vs start/end dates)
- **maxUses**: null (unlimited uses)
- **promotionCode**: Unique code (format: DS-2JC-XXXXX)
- **usageType**: "one-time" (can be used once per customer)
- **usageCount**: 0 (no uses yet)
- **usedBy**: [] (empty array, no users yet)
- **sentTo**: [] (empty array)
- **specificProducts**: [] (applies to all)
- **specificServices**: [] (applies to all)
- **startDate**: Timestamp
- **endDate**: Timestamp
- **createdAt**: Timestamp (few days before start date)
- **updatedAt**: Timestamp (same as createdAt)

### Discount Distribution

#### Percentage Discounts (12 promotions)
- 10% off: 2 promotions
- 12% off: 2 promotions
- 15% off: 3 promotions
- 18% off: 1 promotion
- 20% off: 2 promotions
- 25% off: 1 promotion
- 30% off: 1 promotion

#### Fixed Amount Discounts (6 promotions)
- ₱100 off: 1 promotion
- ₱150 off: 1 promotion
- ₱200 off: 2 promotions
- ₱250 off: 1 promotion
- ₱300 off: 1 promotion

### Date Range Logic

The script creates three categories of promotions:
1. **Past (Expired)**: 5 promotions that ended 30-90 days ago
2. **Current (Active)**: 5 promotions that are currently running
3. **Future (Upcoming)**: 8 promotions that will start in the next 5-25 days

Each promotion has a duration of 7-21 days, and the creation date is set a few days before the start date.

## Verification

### How to Verify
1. Navigate to Branch Manager → Promotions or System Admin → Promotions
2. Check that 18 promotions are listed
3. Verify that 5 promotions show as "Active"
4. Check that promotion codes are unique (format: DS-2JC-XXXXX)
5. Verify date ranges make sense (no overlapping issues)
6. Test applying a promotion code during checkout

### Expected Results
- 18 total promotions in the database
- 5 active promotions available for use
- 13 inactive promotions (5 expired, 8 future)
- All promotions have unique codes
- Promotions can be filtered by status (active/inactive)
- Promotion codes can be applied during transactions

## Related Files
- `scripts/seedPromotions.js` - Promotion seeding script
- `src/pages/branch-manager/Promotions.jsx` - Branch Manager promotions page
- `src/pages/system-admin/Promotions.jsx` - System Admin promotions page
- `src/services/promotionService.js` - Promotion service

## Technical Notes

### Promotion Code Generation
- Format: `DS-2JC-XXXXX`
- Prefix: `DS-2JC-` (David's Salon - Branch 2JC)
- Suffix: 5 random alphanumeric characters
- All codes are unique

### Date Logic
- Past promotions: Started 30-90 days ago, duration 7-21 days
- Current promotions: Started 0-7 days ago, ends in 7-28 days
- Future promotions: Starts in 5-25 days, duration 7-21 days
- Creation date: Set a few days before start date

### Usage Tracking
- `usageCount`: Initialized to 0
- `usedBy`: Empty array, will be populated when customers use the code
- `usageType`: "one-time" (each customer can use once)
- `maxUses`: null (unlimited total uses)

## Next Steps
1. ✅ Promotion seeding completed
2. Test promotion application during checkout
3. Verify promotion filtering and search
4. Test promotion activation/deactivation
5. Verify promotion usage tracking
6. Test promotion expiration logic
