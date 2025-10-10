# SAMA Credit Replenishment Implementation

## Overview
When users pay monthly installments for BNPL projects, the installment amount is automatically added back to their SAMA credit. This implements a **revolving credit system** where users regain their credit limit as they repay.

---

## How It Works

### Core Principle
**Only amounts borrowed from SAMA credit get replenished. Cash payments (downpayments) do NOT get added back.**

### Example Scenario

#### Initial State:
```
User SAMA Credit: 10,000 SAR
Project Cost: 25,600 SAR
Payment Method: BNPL (10 installments)
```

#### At BNPL Selection (in projects-service):
```
SAMA Credit Deducted: 10,000 SAR (what user had)
Downpayment Required: 15,600 SAR (cash payment to cover shortfall)
User's Remaining SAMA Credit: 0 SAR

Monthly EMI: 10,000 ÷ 10 = 1,000 SAR/month
```

#### Payment Timeline:
```
Month 1: User pays 1,000 SAR
  → Installment marked as paid ✅
  → 1,000 SAR added to SAMA credit
  → New SAMA Credit: 1,000 SAR

Month 2: User pays 1,000 SAR
  → Installment marked as paid ✅
  → 1,000 SAR added to SAMA credit
  → New SAMA Credit: 2,000 SAR

...

Month 10: User pays 1,000 SAR (final installment)
  → Installment marked as paid ✅
  → 1,000 SAR added to SAMA credit
  → New SAMA Credit: 10,000 SAR (fully restored!)
```

---

## Implementation Details

### File: `src/services/payment.service.ts`

**Function:** `payInstallment()` - Line 256-290

```typescript
// After successfully processing the installment payment...

// Replenish SAMA credit for BNPL payments
if (installment.payment.payment_method === 'bnpl') {
  try {
    await updateUserSamaCredit(
      userId,
      installmentAmount, // Only base amount, NOT late fees
      'add',
      projectId,
      `Installment #${installment.installment_number} paid...`
    );

    logger.info('SAMA credit replenished after installment payment', {
      userId,
      projectId,
      installmentNumber: installment.installment_number,
      amountReplenished: installmentAmount,
      lateFeeNotReplenished: lateFee,
    });
  } catch (error) {
    // Log error but don't fail the payment
    logger.error('Failed to replenish SAMA credit...', {...});
  }
}
```

### Key Features:

1. **Only BNPL Payments** - Checks if `payment_method === 'bnpl'`
2. **Base Amount Only** - Replenishes `installmentAmount`, NOT late fees
3. **Non-Blocking** - If credit update fails, payment still succeeds
4. **Comprehensive Logging** - Tracks successes and failures

---

## User Service Integration

### Required User Service Endpoint

**PATCH** `/api/users/:userId/sama-credit`

**Request Body:**
```json
{
  "amount": 1000,
  "operation": "add",
  "projectId": "uuid-here",
  "reason": "Installment #1 paid for project abc-123. Replenishing 1000 SAR to SAMA credit."
}
```

**Response:**
```json
{
  "success": true,
  "message": "SAMA credit updated successfully",
  "data": {
    "previousAmount": 0,
    "newAmount": 1000,
    "operation": "add"
  }
}
```

### User Service Implementation (Expected)

The user service should:
1. Validate the user exists
2. Get current `samaCreditAmount`
3. Add the amount: `newAmount = currentAmount + amount`
4. Update the user record
5. Log the transaction for audit trail
6. Return the updated amounts

---

## Important Rules

### ✅ What Gets Replenished:
- **Installment base amount** - The amount deducted from SAMA credit
- **BNPL payments only** - Not single-pay transactions
- **Successful payments** - Only after payment is confirmed

### ❌ What Does NOT Get Replenished:
- **Late fees** - These are penalties, not borrowed amounts
- **Downpayments** - These were cash payments, not SAMA credit
- **Failed payments** - No replenishment if payment fails
- **Single-pay transactions** - These don't use SAMA credit

---

## Late Fee Handling

### Example with Late Payment:
```
Installment Amount: 1,000 SAR
Overdue Days: 14 days (2 weeks)
Late Fee: 20 SAR (2% penalty)
Total Payment: 1,020 SAR

User Pays: 1,020 SAR
Amount Replenished to SAMA: 1,000 SAR (NOT 1,020)

Why? Late fees are penalties and shouldn't restore credit.
```

---

## Error Handling

### Strategy: Non-Blocking
If SAMA credit update fails, the installment payment still succeeds because:
1. User paid successfully (payment gateway confirmed)
2. Installment is marked as paid in database
3. SAMA credit update is a **separate concern**

### What Happens on Failure:
1. ✅ Payment transaction completes
2. ✅ Installment marked as paid
3. ✅ Project status updated if needed
4. ❌ SAMA credit NOT updated
5. 📝 Error logged with full details

### Recovery Options:
- **Manual Admin Intervention** - Admin can manually adjust credit
- **Retry Mechanism** - Could implement background job to retry
- **Alert System** - Notify admins of failed credit updates

---

## Testing Scenarios

### Test Case 1: Successful Payment with Credit Replenishment
```json
Scenario:
- User has 0 SAR SAMA credit (already deducted at BNPL selection)
- Pays installment of 1,000 SAR
- No late fees

Expected Result:
✅ Payment succeeds
✅ Installment marked as paid
✅ SAMA credit increased by 1,000 SAR
✅ New SAMA credit balance: 1,000 SAR

Logs:
- "Installment paid"
- "SAMA credit replenished after installment payment"
```

### Test Case 2: Late Payment with Fee
```json
Scenario:
- User has 2,000 SAR SAMA credit
- Pays installment of 1,000 SAR + 50 SAR late fee = 1,050 SAR

Expected Result:
✅ Payment of 1,050 SAR succeeds
✅ Installment marked as paid (with late_fee: 50)
✅ SAMA credit increased by 1,000 SAR (NOT 1,050)
✅ New SAMA credit balance: 3,000 SAR

Logs:
- "amountReplenished": 1000
- "lateFeeNotReplenished": 50
```

### Test Case 3: User Service Unavailable
```json
Scenario:
- User pays 1,000 SAR installment
- User service is down/unreachable

Expected Result:
✅ Payment succeeds (user charged successfully)
✅ Installment marked as paid
❌ SAMA credit NOT updated
📝 Error logged: "Failed to replenish SAMA credit after installment payment"

Impact:
- User sees payment success (correct)
- Admin needs to manually adjust SAMA credit later
```

### Test Case 4: Final Installment Payment
```json
Scenario:
- User pays final (10th) installment of 1,000 SAR
- Current SAMA credit: 9,000 SAR

Expected Result:
✅ Payment succeeds
✅ All installments now paid
✅ Project status → "payment_completed"
✅ SAMA credit increased by 1,000 SAR
✅ Final SAMA credit: 10,000 SAR (fully restored!)

Timeline Entry:
- "Installment 10 Paid" event created
```

---

## Configuration

### Environment Variables

Add to `.env`:
```bash
USER_SERVICE_URL=http://localhost:3001
```

### Required Dependencies

Already installed:
- `axios` - For HTTP requests to user service
- `winston` - For logging

---

## API Flow Diagram

```
User Pays Installment
        ↓
POST /api/payments/:projectId/pay-installment
        ↓
[Payment Service]
        ↓
1. Validate installment exists & unpaid
2. Calculate late fees (if any)
3. Process payment (mock gateway)
        ↓
4. Database Transaction:
   - Mark installment as paid
   - Create payment transaction
   - Update payment totals
   - Check if all paid → complete project
   - Create timeline entry
        ↓
5. Check if BNPL → Call User Service
        ↓
PATCH /api/users/:userId/sama-credit
{
  "amount": installmentAmount,
  "operation": "add",
  "projectId": "...",
  "reason": "Installment #X paid..."
}
        ↓
[User Service]
        ↓
- Validate user
- Add amount to samaCreditAmount
- Save & return new balance
        ↓
✅ Return success to user
```

---

## Logging

### Successful Replenishment:
```json
{
  "level": "info",
  "message": "SAMA credit replenished after installment payment",
  "userId": "uuid",
  "projectId": "uuid",
  "installmentNumber": 3,
  "amountReplenished": 1000,
  "lateFeeNotReplenished": 0
}
```

### Failed Replenishment:
```json
{
  "level": "error",
  "message": "Failed to replenish SAMA credit after installment payment",
  "error": "User service is unavailable",
  "userId": "uuid",
  "projectId": "uuid",
  "installmentId": "uuid",
  "amountAttempted": 1000
}
```

---

## Future Enhancements

### Potential Improvements:

1. **Retry Mechanism**
   - Queue failed credit updates
   - Background job retries every 5 minutes
   - Give up after 5 attempts, alert admin

2. **Webhook System**
   - User service sends webhook on credit update
   - Payment service verifies update succeeded

3. **Admin Dashboard**
   - Show failed credit updates
   - Provide manual retry button
   - Audit trail of all credit changes

4. **Real-time Notifications**
   - Notify user when credit is replenished
   - SMS/email: "Your SAMA credit has been restored by 1,000 SAR"

5. **Credit History Tracking**
   - Store all credit transactions in separate table
   - Track: deductions, replenishments, manual adjustments
   - Generate statements for users

---

## Related Documentation

- [SAMA_CREDIT_DEDUCTION_FIX.md](../projects-service/SAMA_CREDIT_DEDUCTION_FIX.md) - How credit is deducted at BNPL selection
- [BNPL_ELIGIBILITY.md](../projects-service/BNPL_ELIGIBILITY.md) - Full BNPL feature documentation

---

## Support

### Common Issues:

**Q: User paid installment but credit not updated**
- Check logs for "Failed to replenish SAMA credit"
- Verify user service is running
- Manually update credit via admin panel

**Q: Should downpayment be added to SAMA credit?**
- **NO!** Downpayment is cash, not borrowed from SAMA
- Only installment amounts get replenished

**Q: What about late fees?**
- Late fees are penalties, not replenished to SAMA credit
- Only base installment amount gets added back

**Q: Payment failed but credit was added?**
- This shouldn't happen - credit update is AFTER payment success
- If it does, indicates a race condition bug - report to dev team

---

**Implementation Date:** December 2024
**Version:** 1.0.0
**Service:** payment-service
