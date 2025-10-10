# SAMA Credit Deduction Fix

## Problem
When a user had **partial SAMA credit** and provided a downpayment to cover the difference, the system was trying to deduct the **full project amount** from their SAMA credit, causing the deduction to fail.

### Example Error Scenario:
```
User SAMA Credit: 10,000 SAR
Project Cost: 25,600 SAR
Downpayment Provided: 15,600 SAR
System Attempted to Deduct: 25,600 SAR ❌ (FAILED - Insufficient credit)
```

**Error Message:**
```json
{
  "error": "Insufficient SAMA credit. Current balance: 10000.00, Requested deduction: 25600.00"
}
```

---

## Solution
Changed the logic to **only deduct the available SAMA credit**, not the full project amount.

### Fixed Logic:
```typescript
// Before (WRONG):
await updateUserSamaCredit(userId, totalAmount, 'deduct', ...);
// Tried to deduct 25,600 SAR when user only has 10,000 SAR

// After (CORRECT):
const user = await fetchUser(userId);
const samaCreditToDeduct = Math.min(user.samaCreditAmount, totalAmount);
await updateUserSamaCredit(userId, samaCreditToDeduct, 'deduct', ...);
// Deducts only 10,000 SAR (what user has)
```

---

## How It Works Now

### Scenario 1: Full Credit Coverage
```
User SAMA Credit: 25,600 SAR
Project Cost: 25,600 SAR
Downpayment: 0 SAR

✅ Deduct from SAMA: 25,600 SAR (all of it)
✅ User pays upfront: 0 SAR
✅ Total covered: 25,600 SAR
```

### Scenario 2: Partial Credit Coverage
```
User SAMA Credit: 10,000 SAR
Project Cost: 25,600 SAR
Downpayment: 15,600 SAR (required)

✅ Deduct from SAMA: 10,000 SAR (only what user has)
✅ User pays upfront: 15,600 SAR (downpayment)
✅ Total covered: 25,600 SAR
```

### Scenario 3: Zero Credit
```
User SAMA Credit: 0 SAR
Project Cost: 25,600 SAR

❌ Rejected with message:
"You have no SAMA credit available. BNPL is not available for this purchase.
Please choose the single payment option to proceed with your project."
```

---

## Payment Breakdown

### Example: 25,600 SAR Project with 10,000 SAR Credit

**At BNPL Selection:**
- SAMA credit deducted: **10,000 SAR** ✅
- Downpayment required: **15,600 SAR** (user pays this upfront)
- User's remaining SAMA credit: **0 SAR**

**Monthly Installments:**
- The 10,000 SAR from SAMA credit is divided into installments
- User pays monthly EMI: 10,000 ÷ 10 = 1,000 SAR/month
- As user pays each installment, **only that 1,000 SAR** is added back to their SAMA credit
- **Important:** The 15,600 SAR downpayment is NOT added back (it was cash, not borrowed)

**Credit Restoration Timeline:**
```
Month 1: Pay 1,000 SAR → SAMA Credit: 1,000 SAR
Month 2: Pay 1,000 SAR → SAMA Credit: 2,000 SAR
Month 3: Pay 1,000 SAR → SAMA Credit: 3,000 SAR
...
Month 10: Pay 1,000 SAR → SAMA Credit: 10,000 SAR (fully restored)
```

---

## Code Changes

### File: `src/services/payment.service.ts`

**Function:** `createBNPLPayment()`

```typescript
// NEW: Fetch user to get current SAMA credit
const user = await fetchUser(userId, authToken);

// NEW: Calculate actual deduction amount
const samaCreditToDeduct = Math.min(user.samaCreditAmount, totalAmount);

// UPDATED: Deduct only available credit
await updateUserSamaCredit(
  userId,
  samaCreditToDeduct,  // Changed from totalAmount
  'deduct',
  projectId,
  `BNPL selected for project ${projectId}. Total: ${totalAmount} SAR, SAMA credit used: ${samaCreditToDeduct} SAR, Downpayment: ${downpayment} SAR`,
  authToken
);
```

---

## Validation Flow

1. **Check Flag Status** → Must be GREEN ✅
2. **Check SAMA Credit:**
   - If credit ≥ project cost → Approve
   - If credit = 0 → Reject with helpful message
   - If 0 < credit < project cost → Require downpayment to cover difference
3. **Deduct SAMA Credit:**
   - Calculate: `Math.min(samaCreditAmount, projectAmount)`
   - Deduct only what user has
   - Log the breakdown (total, credit used, downpayment)

---

## Testing

### Test Case 1: Partial Credit with Valid Downpayment
```json
Request:
{
  "payment_method": "bnpl",
  "downpayment_amount": 15600,
  "number_of_installments": 10
}

User State:
- flagStatus: "GREEN"
- samaCreditAmount: 10000
- Project Cost: 25600

Expected Result: ✅ Success
- SAMA credit deducted: 10000
- Downpayment required: 15600
- Payment method created successfully
```

### Test Case 2: Partial Credit with Insufficient Downpayment
```json
Request:
{
  "payment_method": "bnpl",
  "downpayment_amount": 5000,
  "number_of_installments": 10
}

User State:
- flagStatus: "GREEN"
- samaCreditAmount: 10000
- Project Cost: 25600

Expected Result: ❌ Error
"Insufficient SAMA credit. You have 10000 SAR but the project costs 25600 SAR.
You need to provide a downpayment of at least 15600 SAR to use BNPL,
or choose the single payment option."
```

---

## Benefits

✅ **No More Failed Deductions** - System only deducts available credit
✅ **Accurate Logging** - Shows breakdown of credit used vs downpayment
✅ **Better User Experience** - Clear messages about what's needed
✅ **Flexible Payments** - Users can use partial credit + downpayment

---

## Important: Credit Replenishment Rules

### What Gets Added Back to SAMA Credit:
✅ **Installment Payments ONLY**
- Only the amount that was deducted from SAMA credit gets restored
- Each installment payment adds back to the credit limit
- This works like a revolving credit line

❌ **Downpayment Does NOT Get Added Back**
- Downpayment is cash paid upfront, not borrowed from SAMA credit
- It's the user's own money covering the shortfall
- No replenishment needed because it wasn't borrowed

### Example:
```
Project: 25,600 SAR
SAMA Credit Available: 10,000 SAR
Downpayment: 15,600 SAR (cash)

Amount to Replenish: 10,000 SAR (over 10 months)
Amount NOT to Replenish: 15,600 SAR (downpayment)

When user pays installment #1 (1,000 SAR):
  → Add 1,000 SAR to SAMA credit
  → New balance: 1,000 SAR

When user pays installment #10 (1,000 SAR):
  → Add 1,000 SAR to SAMA credit
  → Final balance: 10,000 SAR (restored to original)
```

### For User Service Implementation:
When processing installment payments, the user-service should:
1. Identify the payment as an installment payment
2. Get the installment amount (e.g., 1,000 SAR)
3. Add that amount to user's `samaCreditAmount`
4. Log the transaction for audit

**Do NOT add the downpayment amount to SAMA credit - it was never borrowed!**

---

## Related Documentation

- See [BNPL_ELIGIBILITY.md](./BNPL_ELIGIBILITY.md) for full feature documentation
- User service must implement credit replenishment when installments are paid
