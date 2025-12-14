# Transaction ID Format - Sample Scenarios

## Logic Overview

The transaction ID is formatted as: **BRANCHCODE-XXXX**

Where:
- **BRANCHCODE**: First 3 characters of the branch document ID (uppercase)
- **XXXX**: Transaction sequence number for that branch (4 digits, zero-padded)

---

## Sample Scenarios

### Scenario 1: New Branch - First Transaction

**Branch Document ID**: `abc123xyz456`  
**Branch Code**: `ABC` (first 3 characters, uppercase)  
**Existing Transactions**: 0  
**New Transaction Count**: 1  

**Result**: `ABC-0001`

---

### Scenario 2: Same Branch - Second Transaction

**Branch Document ID**: `abc123xyz456`  
**Branch Code**: `ABC`  
**Existing Transactions**: 1 (ABC-0001 already exists)  
**New Transaction Count**: 2  

**Result**: `ABC-0002`

---

### Scenario 3: Different Branch - First Transaction

**Branch Document ID**: `xyz789def012`  
**Branch Code**: `XYZ` (first 3 characters, uppercase)  
**Existing Transactions**: 0  
**New Transaction Count**: 1  

**Result**: `XYZ-0001`

---

### Scenario 4: Branch with Short ID

**Branch Document ID**: `ab` (only 2 characters)  
**Branch Code**: `ABX` (padded with 'X' to make 3 characters)  
**Existing Transactions**: 0  
**New Transaction Count**: 1  

**Result**: `ABX-0001`

---

### Scenario 5: Branch with Many Transactions

**Branch Document ID**: `mak123branch`  
**Branch Code**: `MAK`  
**Existing Transactions**: 150  
**New Transaction Count**: 151  

**Result**: `MAK-0151`

---

### Scenario 6: Multiple Branches with Same Starting Characters

**Branch 1 Document ID**: `makati001`  
**Branch 1 Code**: `MAK`  
**Branch 1 Transaction Count**: 5  
**Result**: `MAK-0006`

**Branch 2 Document ID**: `makati002`  
**Branch 2 Code**: `MAK` (same code!)  
**Branch 2 Transaction Count**: 3  
**Result**: `MAK-0004`

**Note**: If two branches have the same first 3 characters, they will have the same branch code but different transaction numbers based on their individual branch transaction counts.

---

## Real-World Example Flow

### Day 1 - Opening Day

1. **Makati Branch** (ID: `makati001`)
   - First transaction: `MAK-0001`
   - Second transaction: `MAK-0002`
   - Third transaction: `MAK-0003`

2. **Quezon City Branch** (ID: `qc001branch`)
   - First transaction: `QC0-0001`
   - Second transaction: `QC0-0002`

3. **Makati Branch** continues:
   - Fourth transaction: `MAK-0004`
   - Fifth transaction: `MAK-0005`

### Day 2

1. **Makati Branch**:
   - Sixth transaction: `MAK-0006`
   - Seventh transaction: `MAK-0007`

2. **Quezon City Branch**:
   - Third transaction: `QC0-0003`

---

## Important Notes

1. **Transaction Count is Per Branch**: Each branch maintains its own sequence
2. **Branch Code is Based on Document ID**: Uses the first 3 characters of the branch document ID in Firestore
3. **Zero-Padding**: Transaction numbers are always 4 digits (0001, 0002, ..., 0151, etc.)
4. **Uppercase**: Branch codes are always uppercase
5. **Fallback**: If branch fetch fails, uses branchId directly (first 3 chars)

---

## Display in Receipt

- **Receipt No**: Manual handwritten receipt number (e.g., `12345`)
- **Transaction ID**: System-generated formatted ID (e.g., `MAK-0001`)

Both are displayed on the receipt for easy reference.

