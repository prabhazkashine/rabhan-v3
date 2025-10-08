# Contractor Balance Update Setup

This document explains how the contractor balance is updated when admin releases payment.

## Overview

When admin releases payment to a contractor via the `/api/admin/projects/:projectId/release-payment` endpoint, the system now:

1. Updates the project payment record in the projects database
2. **Increments the contractor's balance** in the contractor database
3. Logs the transaction in the project timeline

## Setup Instructions

### 1. Generate Prisma Client for Contractor Database

Run the following command to generate the Prisma client for the contractor schema:

```bash
npx prisma generate --schema=./prisma/contractor-schema.prisma
```

This will create the Prisma client at `src/generated/prisma-contractor/`.

### 2. Environment Configuration

Ensure your `.env` file has the contractor database URL:

```env
CONTRACTORS_DATABASE_URL="postgresql://postgres:12345@localhost:5432/rabhan_contractors?schema=public"
```

### 3. Test the Integration

After setup, when you call the release payment endpoint:

```bash
POST /api/admin/projects/:projectId/release-payment
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "amount": 50000,
  "contractor_bank_name": "Al Rajhi Bank",
  "contractor_iban": "SA0380000000608010167519",
  "contractor_account_holder": "John Doe",
  "payment_reference": "BANK-TRANSFER-123",
  "notes": "Payment for Project XYZ"
}
```

The contractor's balance will be incremented by the specified amount.

## Database Schema

### Contractor Table (Minimal Schema Used)

```prisma
model Contractor {
  id           String   @id @default(uuid()) @db.Uuid
  firstName    String?  @map("first_name")
  lastName     String?  @map("last_name")
  email        String   @unique
  balance      Decimal? @db.Decimal(12, 2)  // <-- This field is updated
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
}
```

## How It Works

### Code Flow in `payment.service.ts`

```typescript
async releasePaymentToContractor(projectId, adminId, input) {
  // 1. Get project and verify
  const project = await prisma.project.findUnique({...});

  // 2. Verify contractor exists in contractor DB
  const contractor = await contractorPrisma.contractor.findUnique({
    where: { id: project.contractor_id }
  });

  // 3. Update payment record in projects DB (transaction)
  await prisma.$transaction(async (tx) => {
    await tx.projectPayment.update({...});
    await tx.projectTimeline.create({...});
  });

  // 4. Increment contractor balance in contractor DB
  await contractorPrisma.contractor.update({
    where: { id: project.contractor_id },
    data: {
      balance: {
        increment: amountToRelease  // <-- Prisma atomic increment
      }
    }
  });
}
```

## Error Handling

If the contractor balance update fails:
- The payment record in projects DB is still updated
- An error is logged with full context
- A BusinessRuleError is thrown with message: "Payment recorded but failed to update contractor balance. Please contact support."
- Admin should be notified to manually reconcile

## Logging

The system logs:

1. **Success**: When balance is updated successfully
   ```
   INFO: Contractor balance updated {
     contractorId: "uuid",
     amountAdded: 50000,
     projectId: "uuid"
   }
   ```

2. **Error**: When balance update fails
   ```
   ERROR: Failed to update contractor balance {
     error: "message",
     contractorId: "uuid",
     projectId: "uuid",
     amount: 50000
   }
   ```

## Future Improvements

Consider implementing:
1. **Distributed Transaction**: Use saga pattern or 2-phase commit
2. **Retry Mechanism**: Automatic retry with exponential backoff
3. **Event Sourcing**: Publish event when payment is released, contractor service subscribes
4. **Compensation Transaction**: Rollback payment record if balance update fails
5. **Admin Alert**: Notify admin immediately on balance update failure

## Maintenance Commands

### Re-generate Prisma clients after schema changes:

```bash
# Projects DB client
npx prisma generate

# Contractor DB client
npx prisma generate --schema=./prisma/contractor-schema.prisma

# Both at once
npx prisma generate && npx prisma generate --schema=./prisma/contractor-schema.prisma
```

### Check contractor balance:

```sql
SELECT id, first_name, last_name, email, balance
FROM contractors
WHERE id = 'contractor-uuid';
```

## Files Modified

1. **prisma/contractor-schema.prisma** - New schema file for contractor DB
2. **src/lib/contractor-prisma.ts** - New Prisma client for contractor DB
3. **src/services/payment.service.ts** - Updated to increment balance
