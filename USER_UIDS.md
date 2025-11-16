# Test Users - Firebase Setup Guide

## ✅ Users Created in Firebase Authentication

All 7 test users have been successfully created in Firebase Authentication. Now you need to add their Firestore documents.

## 📋 User Information

| # | Email | UID | Password | Role | Branch |
|---|-------|-----|----------|------|--------|
| 1 | admin@davidsalon.com | `nWIccWe4SLMqffWjufnAyVK1Rft1` | admin123 | system_admin | null |
| 2 | owner@davidsalon.com | `T6SVfwuNppbcvmFiawT5GvJBd3y2` | owner123 | franchise_owner | null |
| 3 | manager@davidsalon.com | `eRretnlIXQWZV8BPIZCLAvda6d62` | manager123 | branch_manager | branch_001 |
| 4 | receptionist@davidsalon.com | `xAOyEfBZLvbNTDvrJKpJ4b2HXiO2` | recept123 | receptionist | branch_001 |
| 5 | inventory@davidsalon.com | `khJAMkivc3VvxVnOtxGaKHmrcVZ2` | inventory123 | inventory_controller | branch_001 |
| 6 | stylist@davidsalon.com | `pOy2IVdgU6X4MmC4VvnXrmdpi0z2` | stylist123 | stylist | branch_001 |
| 7 | client@davidsalon.com | `4EUHbw9bWQWlvrPpGRNzeaREVct1` | client123 | client | null |

## 🔥 Add Firestore Documents

### Step 1: Go to Firebase Console
Visit: https://console.firebase.google.com/project/davids-salon/firestore

### Step 2: Create Users Collection
1. Click **"Start collection"** (or **"+"** if collection exists)
2. Collection ID: `users`
3. Click **Next**

### Step 3: Add Each User Document

For each user, click **"Add document"** and use the UID as the Document ID:

---

#### 1️⃣ System Admin
**Document ID:** `nWIccWe4SLMqffWjufnAyVK1Rft1`

| Field | Type | Value |
|-------|------|-------|
| email | string | admin@davidsalon.com |
| displayName | string | System Administrator |
| role | string | system_admin |
| branchId | null | null |
| active | boolean | true |

---

#### 2️⃣ Franchise Owner
**Document ID:** `T6SVfwuNppbcvmFiawT5GvJBd3y2`

| Field | Type | Value |
|-------|------|-------|
| email | string | owner@davidsalon.com |
| displayName | string | Franchise Owner |
| role | string | franchise_owner |
| branchId | null | null |
| active | boolean | true |

---

#### 3️⃣ Branch Manager
**Document ID:** `eRretnlIXQWZV8BPIZCLAvda6d62`

| Field | Type | Value |
|-------|------|-------|
| email | string | manager@davidsalon.com |
| displayName | string | Branch Manager |
| role | string | branch_manager |
| branchId | string | branch_001 |
| active | boolean | true |

---

#### 4️⃣ Receptionist
**Document ID:** `xAOyEfBZLvbNTDvrJKpJ4b2HXiO2`

| Field | Type | Value |
|-------|------|-------|
| email | string | receptionist@davidsalon.com |
| displayName | string | Front Desk Receptionist |
| role | string | receptionist |
| branchId | string | branch_001 |
| active | boolean | true |

---

#### 5️⃣ Inventory Controller
**Document ID:** `khJAMkivc3VvxVnOtxGaKHmrcVZ2`

| Field | Type | Value |
|-------|------|-------|
| email | string | inventory@davidsalon.com |
| displayName | string | Inventory Controller |
| role | string | inventory_controller |
| branchId | string | branch_001 |
| active | boolean | true |

---

#### 6️⃣ Stylist
**Document ID:** `pOy2IVdgU6X4MmC4VvnXrmdpi0z2`

| Field | Type | Value |
|-------|------|-------|
| email | string | stylist@davidsalon.com |
| displayName | string | Sarah Stylist |
| role | string | stylist |
| branchId | string | branch_001 |
| active | boolean | true |

---

#### 7️⃣ Client
**Document ID:** `4EUHbw9bWQWlvrPpGRNzeaREVct1`

| Field | Type | Value |
|-------|------|-------|
| email | string | client@davidsalon.com |
| displayName | string | John Client |
| role | string | client |
| branchId | null | null |
| active | boolean | true |

---

## ✅ Verification

After adding all documents:
1. Check Firestore Database → `users` collection should have 7 documents
2. Each document ID should match the UID from Firebase Authentication

## 🚀 Run the Application

Once all Firestore documents are created:

```bash
cd "C:\xampp\htdocs\CAPSTONE PROJECT DEVELOPMENT\dsms"
npm run dev
```

Visit: http://localhost:3000

## 🔐 Test Login

Try logging in with any of these credentials:

- **Admin:** admin@davidsalon.com / admin123
- **Owner:** owner@davidsalon.com / owner123
- **Manager:** manager@davidsalon.com / manager123
- **Receptionist:** receptionist@davidsalon.com / recept123
- **Inventory:** inventory@davidsalon.com / inventory123
- **Stylist:** stylist@davidsalon.com / stylist123
- **Client:** client@davidsalon.com / client123

---

**Note:** Each role will redirect to its respective dashboard after login.
