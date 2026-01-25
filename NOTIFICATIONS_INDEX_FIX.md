# Notifications Firestore Index Fix

**Date:** January 25, 2026  
**Status:** ✅ DEPLOYED

---

## Issue

Firestore was throwing errors when querying notifications:
```
FirebaseError: The query requires an index
```

The queries needed composite indexes for:
1. `recipientId` + `createdAt` (for fetching all notifications)
2. `isRead` + `recipientId` + `createdAt` (for fetching unread notifications)

---

## Solution

Added two composite indexes to `firestore.indexes.json`:

### Index 1: All Notifications Query
```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "recipientId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Used by:**
- `getNotifications(userId)` - Fetch all notifications for a user
- Stylist Appointments page - Recent notifications dropdown
- Stylist Notifications page - All notifications list

### Index 2: Unread Notifications Query
```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isRead", "order": "ASCENDING" },
    { "fieldPath": "recipientId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Used by:**
- `getNotifications(userId, { unreadOnly: true })` - Fetch unread notifications
- `getUnreadNotificationCount(userId)` - Count unread notifications
- Notification badge counts in layouts

---

## Deployment

```bash
firebase deploy --only firestore:indexes
```

**Result:** ✅ Successfully deployed

---

## Queries Supported

### Query 1: Fetch All Notifications
```javascript
notifications
  .where('recipientId', '==', userId)
  .orderBy('createdAt', 'desc')
  .limit(50)
```

### Query 2: Fetch Unread Notifications
```javascript
notifications
  .where('recipientId', '==', userId)
  .where('isRead', '==', false)
  .orderBy('createdAt', 'desc')
  .limit(1000)
```

---

## Files Modified

1. **firestore.indexes.json**
   - Added 2 composite indexes for notifications collection

---

## Testing

After deployment, verify:
- [x] Stylist can see notifications in dropdown
- [x] Unread count displays correctly
- [x] No Firestore index errors in console
- [x] Notifications page loads without errors
- [x] Badge counts update correctly

---

## Impact

**Before:**
- ❌ Notifications queries failed
- ❌ Console errors
- ❌ No notifications displayed
- ❌ Badge counts showed 0

**After:**
- ✅ Notifications queries work
- ✅ No console errors
- ✅ Notifications display correctly
- ✅ Badge counts accurate

---

## Performance

- **Index Build Time:** Instant (small dataset)
- **Query Performance:** Fast (indexed queries)
- **Storage Impact:** Minimal (2 indexes)
- **Read Cost:** Same (queries now work)

---

## Maintenance

These indexes are now part of the project configuration and will be:
- ✅ Version controlled in `firestore.indexes.json`
- ✅ Deployed with `firebase deploy --only firestore:indexes`
- ✅ Automatically created in new environments

---

## Summary

Successfully added and deployed Firestore composite indexes for the notifications collection. Notifications now work correctly for all users (stylists, clients, receptionists, etc.) without any index errors.

**Indexes Added:** 2  
**Deployment Status:** ✅ Success  
**Errors Fixed:** All notification query errors resolved

