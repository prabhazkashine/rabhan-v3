# BNPL Eligibility & SAMA Credit System

## Overview
This document explains the Buy Now Pay Later (BNPL) eligibility system integrated with the SAMA credit system for the Projects Service.

## Feature Requirements

### 1. Flag Status Check
Users must have a **GREEN** flag status to be eligible for BNPL.

**Flag Status Types:**
- `GREEN` ✅ - Eligible for BNPL
- `YELLOW` ⚠️ - Not eligible for BNPL (must use single payment)
- `RED` ❌ - Not eligible for BNPL (must use single payment)

### 2. SAMA Credit Amount Check
The user's `samaCreditAmount` acts as a loan limit for BNPL purchases.

**Scenarios:**

#### Scenario A: Full Credit Coverage
```
Project Amount: 10,000 SAR
SAMA Credit: 10,000 SAR
Downpayment: 0 SAR (optional)
Result: ✅ Approved
```

#### Scenario B: Partial Credit Coverage
```
Project Amount: 20,000 SAR
SAMA Credit: 10,000 SAR
Downpayment: 10,000 SAR (required)
Result: ✅ Approved (user pays 10,000 as downpayment)
```

#### Scenario C: Insufficient Credit
```
Project Amount: 20,000 SAR
SAMA Credit: 10,000 SAR
Downpayment: 5,000 SAR
Result: ❌ Rejected (need minimum 10,000 SAR downpayment)
```

### 3. SAMA Credit Deduction
When BNPL is selected, **only the available SAMA credit** is deducted (not the full project amount).

**Example 1: Full Credit Coverage**
```
Before: samaCreditAmount = 20,000 SAR
Project Amount: 20,000 SAR
Downpayment: 0 SAR
SAMA Credit Deducted: 20,000 SAR
After Selection: samaCreditAmount = 0 SAR
```

**Example 2: Partial Credit Coverage**
```
Before: samaCreditAmount = 10,000 SAR
Project Amount: 25,600 SAR
Downpayment: 15,600 SAR (paid upfront)
SAMA Credit Deducted: 10,000 SAR (only what user has)
After Selection: samaCreditAmount = 0 SAR
```

**Key Point:** The system deducts `Math.min(samaCreditAmount, totalProjectAmount)` to avoid over-deduction.

### 4. SAMA Credit Replenishment
As the user pays installments, the amount is added back to their `samaCreditAmount` (handled in user-service).

---

## API Implementation

### Endpoint: Select Payment Method
```http
POST /api/projects/:projectId/payment-method
```

### Request Payload
```json
{
  "payment_method": "bnpl",
  "downpayment_amount": 10000,
  "number_of_installments": 10
}
```

**Payment Methods:**
- `single_pay` - One-time full payment (no eligibility checks)
- `bnpl` - Buy Now Pay Later (eligibility checks apply)

---

## Validation Flow

### Step 1: Flag Status Validation
```typescript
if (payment_method === "bnpl") {
  if (user.flagStatus !== "GREEN") {
    throw Error("Only GREEN flag users can use BNPL")
  }
}
```

### Step 2: SAMA Credit Validation
```typescript
// Check for zero credit
if (samaCreditAmount === 0) {
  throw Error("No SAMA credit available. Use single payment option.")
}

// Check for insufficient credit
const shortfall = projectAmount - samaCreditAmount;

if (shortfall > 0 && downpaymentAmount < shortfall) {
  throw Error(`Need minimum ${shortfall} SAR downpayment or use single payment`)
}
```

### Step 3: SAMA Credit Deduction
```typescript
// Fetch current user SAMA credit
const user = await fetchUser(userId);

// Calculate actual deduction (only deduct what user has)
const samaCreditToDeduct = Math.min(user.samaCreditAmount, projectAmount);

// Deduct SAMA credit from user account
await updateUserSamaCredit({
  userId,
  amount: samaCreditToDeduct,
  operation: "deduct",
  projectId,
  reason: `BNPL selected. Total: ${projectAmount}, Credit used: ${samaCreditToDeduct}, Downpayment: ${downpaymentAmount}`
})
```

---

## Error Responses

### 1. RED Flag User Attempts BNPL
```json
{
  "success": false,
  "message": "You are not eligible for Buy Now Pay Later. Your account flag status is RED. Only GREEN flag users can use BNPL. Please use single payment option."
}
```

### 2. Zero SAMA Credit
```json
{
  "success": false,
  "message": "You have no SAMA credit available. BNPL is not available for this purchase. Please choose the single payment option to proceed with your project."
}
```

### 3. Insufficient SAMA Credit (with partial credit)
```json
{
  "success": false,
  "message": "Insufficient SAMA credit. You have 10000 SAR but the project costs 20000 SAR. You need to provide a downpayment of at least 10000 SAR to use BNPL, or choose the single payment option."
}
```

### 4. SAMA Credit Deduction Failed
```json
{
  "success": false,
  "message": "Failed to deduct SAMA credit. Please try again or contact support."
}
```

---

## Code Files Modified

### 1. New File: `src/utils/user-client.ts`
- `fetchUser()` - Fetches user details from user-service
- `isEligibleForBNPL()` - Checks flag status
- `checkSamaCreditEligibility()` - Validates SAMA credit amount
- `updateUserSamaCredit()` - Deducts/adds SAMA credit

### 2. Updated: `src/services/payment.service.ts`
- **selectPaymentMethod()** - Added eligibility checks before BNPL selection
- **createBNPLPayment()** - Added SAMA credit deduction logic

### 3. Updated: `src/controllers/project.controller.ts`
- **selectPaymentMethod()** - Passes authToken to service layer

---

## User Service Integration

### Required Endpoint in User Service
```http
GET /api/users/:userId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "flagStatus": "GREEN",
    "samaCreditAmount": 50000.00,
    // ... other fields
  }
}
```

### Required Endpoint for Credit Updates
```http
PATCH /api/users/:userId/sama-credit
```

**Request:**
```json
{
  "amount": 20000,
  "operation": "deduct",
  "projectId": "uuid",
  "reason": "BNPL selected for project"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SAMA credit updated successfully",
  "data": {
    "previousAmount": 50000,
    "newAmount": 30000,
    "operation": "deduct"
  }
}
```

---

## Testing Scenarios

### Test Case 1: GREEN Flag with Full Credit
```
User: flagStatus=GREEN, samaCreditAmount=50000
Project: 20000 SAR
Payload: { payment_method: "bnpl", number_of_installments: 10 }
Expected: ✅ Success
```

### Test Case 2: RED Flag User
```
User: flagStatus=RED, samaCreditAmount=50000
Project: 20000 SAR
Payload: { payment_method: "bnpl", number_of_installments: 10 }
Expected: ❌ Error - Not eligible
```

### Test Case 3: Insufficient Credit without Downpayment
```
User: flagStatus=GREEN, samaCreditAmount=10000
Project: 20000 SAR
Payload: { payment_method: "bnpl", number_of_installments: 10 }
Expected: ❌ Error - Need 10000 SAR downpayment
```

### Test Case 4: Insufficient Credit with Valid Downpayment
```
User: flagStatus=GREEN, samaCreditAmount=10000
Project: 20000 SAR
Payload: {
  payment_method: "bnpl",
  downpayment_amount: 10000,
  number_of_installments: 10
}
Expected: ✅ Success
```

### Test Case 5: Single Payment (No Restrictions)
```
User: flagStatus=RED, samaCreditAmount=0
Project: 20000 SAR
Payload: { payment_method: "single_pay" }
Expected: ✅ Success (no eligibility checks for single payment)
```

---

## Logging

All eligibility checks and SAMA credit operations are logged:

```typescript
logger.info('User flag status check passed', { userId, flagStatus });
logger.info('SAMA credit check passed', {
  userId,
  samaCreditAmount,
  projectAmount,
  downpayment
});
logger.info('SAMA credit deducted successfully', {
  userId,
  projectId,
  amount
});
```

---

## Environment Variables

```env
USER_SERVICE_URL=http://localhost:3001
```

---

## Future Enhancements

1. **Credit Replenishment**: Implement automatic credit replenishment when installments are paid
2. **Credit History**: Track credit usage history in project timeline
3. **Credit Limits**: Dynamic credit limits based on user payment history
4. **Partial Payments**: Support for paying downpayments in installments
5. **Credit Score**: Integration with external credit scoring systems

---

## Security Considerations

1. ✅ User can only modify their own projects
2. ✅ Flag status is fetched from authoritative source (user-service)
3. ✅ SAMA credit operations are atomic and logged
4. ✅ Authorization tokens are forwarded to user-service
5. ✅ Failed credit deductions prevent payment method selection

---

## Support

For issues or questions regarding BNPL eligibility:
1. Check user's flag status in user-service
2. Verify SAMA credit amount is sufficient
3. Review logs for detailed error messages
4. Contact system administrator for flag status updates
