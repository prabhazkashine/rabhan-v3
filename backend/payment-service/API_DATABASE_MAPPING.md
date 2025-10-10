# Payment Service - API Database Mapping

## Overview
The Payment Service currently works **ONLY with the PROJECTS DATABASE**. The payment schema defined in this service (`prisma/schema.prisma`) is **NOT being used**.

---

## Database Architecture

### Currently Active:
```
Payment Service
    ↓
Projects Database (via projectsPrisma)
    ├── Project
    ├── ProjectPayment
    ├── InstallmentSchedule
    ├── PaymentTransaction
    └── ProjectTimeline
```

### Not Used:
```
Payment Database (via prisma) ❌
    ├── ProjectPayment
    ├── InstallmentSchedule
    └── ProjectPaymentTransaction
```

---

## API Endpoints & Database Usage

### 1. **POST** `/api/payments/:projectId/pay-downpayment`

**Purpose:** User pays the initial downpayment for BNPL

**Database:** **PROJECTS DATABASE** (`projectsPrisma`)

**Operations:**
```typescript
// Line 34: Read from projects database
const project = await projectsPrisma.project.findUnique({
  where: { id: projectId },
  include: { payment: true },
});

// Line 69-108: Transaction on projects database
await projectsPrisma.$transaction(async (tx) => {
  // Create payment transaction
  await tx.paymentTransaction.create(...);

  // Update project payment
  await tx.projectPayment.update(...);

  // Add timeline entry
  await tx.projectTimeline.create(...);
});
```

**Tables Modified:**
- ✅ `PaymentTransaction` (projects DB)
- ✅ `ProjectPayment` (projects DB)
- ✅ `ProjectTimeline` (projects DB)

---

### 2. **POST** `/api/payments/:projectId/pay-installment`

**Purpose:** User pays monthly installment

**Databases:**
- **PROJECTS DATABASE** (`projectsPrisma`) - Primary operations
- **USER SERVICE** (via API call) - SAMA credit replenishment

**Operations:**
```typescript
// Line 128: Read installment from projects database
const installment = await projectsPrisma.installmentSchedule.findUnique({
  where: { id: input.installment_id },
  include: { payment: true },
});

// Line 140: Read project from projects database
const project = await projectsPrisma.project.findUnique({
  where: { id: projectId },
});

// Line 171-254: Transaction on projects database
await projectsPrisma.$transaction(async (tx) => {
  // Update installment status
  await tx.installmentSchedule.update(...);

  // Create payment transaction
  await tx.paymentTransaction.create(...);

  // Update payment totals
  await tx.projectPayment.update(...);

  // Check if all paid & update project status
  await tx.project.update(...);

  // Add timeline entry
  await tx.projectTimeline.create(...);
});

// Line 261-267: Call user service API
await updateUserSamaCredit(
  userId,
  installmentAmount,
  'add',
  projectId,
  'Installment paid - replenishing SAMA credit'
);
```

**Tables Modified:**
- ✅ `InstallmentSchedule` (projects DB)
- ✅ `PaymentTransaction` (projects DB)
- ✅ `ProjectPayment` (projects DB)
- ✅ `Project` (projects DB) - status updated if all paid
- ✅ `ProjectTimeline` (projects DB)
- ✅ `User.samaCreditAmount` (user service via API)

---

### 3. **POST** `/api/payments/:projectId/release-payment` (Admin Only)

**Purpose:** Admin releases payment to contractor

**Databases:**
- **PROJECTS DATABASE** (`projectsPrisma`) - Payment records
- **CONTRACTOR DATABASE** (`contractorPrisma`) - Balance update

**Operations:**
```typescript
// Line 311: Read project from projects database
const project = await projectsPrisma.project.findUnique({
  where: { id: projectId },
  include: { payment: true },
});

// Line 324: Read contractor from contractor database
const contractor = await contractorPrisma.contractor.findUnique({
  where: { id: project.contractor_id },
});

// Line 337-368: Transaction on projects database
await projectsPrisma.$transaction(async (tx) => {
  // Update payment with admin release info
  await tx.projectPayment.update(...);

  // Add timeline entry
  await tx.projectTimeline.create(...);
});

// Line 372-391: Update contractor balance (separate transaction)
const currentContractor = await contractorPrisma.contractor.findUnique({
  where: { id: project.contractor_id },
  select: { balance: true },
});

await contractorPrisma.contractor.update({
  where: { id: project.contractor_id },
  data: { balance: newBalance },
});
```

**Tables Modified:**
- ✅ `ProjectPayment` (projects DB)
- ✅ `ProjectTimeline` (projects DB)
- ✅ `Contractor.balance` (contractor DB)

---

### 4. **GET** `/api/payments/:projectId/installments`

**Purpose:** Get installment schedule for a project

**Database:** **PROJECTS DATABASE** (`projectsPrisma`)

**Operations:**
```typescript
// Line 390: Read project from projects database
const project = await projectsPrisma.project.findUnique({
  where: { id: projectId },
});

// Line 403: Read payment with installments from projects database
const payment = await projectsPrisma.projectPayment.findUnique({
  where: { project_id: projectId },
  include: {
    installments: {
      orderBy: { installment_number: 'asc' },
    },
  },
});

return payment?.installments || [];
```

**Tables Read:**
- ✅ `Project` (projects DB)
- ✅ `ProjectPayment` (projects DB)
- ✅ `InstallmentSchedule` (projects DB)

---

## Database Connection Details

### 1. Projects Database (`projectsPrisma`)
**File:** [src/lib/projects-prisma.ts](src/lib/projects-prisma.ts)
```typescript
import { PrismaClient } from '../generated/prisma-projects';
const projectsPrisma = new PrismaClient();
```
**Schema:** [prisma/projects-schema.prisma](prisma/projects-schema.prisma)
**Environment Variable:** `PROJECT_DATABASE_URL`

**Used For:**
- ✅ All payment operations
- ✅ All installment operations
- ✅ All transaction records
- ✅ Project status updates
- ✅ Timeline entries

---

### 2. Contractor Database (`contractorPrisma`)
**File:** [src/lib/contractor-prisma.ts](src/lib/contractor-prisma.ts)
```typescript
import { PrismaClient } from '../generated/prisma-contractor';
const contractorPrisma = new PrismaClient();
```
**Schema:** [prisma/contractor-schema.prisma](prisma/contractor-schema.prisma)
**Environment Variable:** `CONTRACTORS_DATABASE_URL`

**Used For:**
- ✅ Reading contractor info
- ✅ Updating contractor balance (when admin releases payment)

---

### 3. Payment Database (`prisma`) ❌ **NOT USED**
**File:** [src/lib/prisma.ts](src/lib/prisma.ts)
```typescript
import { PrismaClient } from '../generated/prisma';
const prisma = new PrismaClient();
```
**Schema:** [prisma/schema.prisma](prisma/schema.prisma)
**Environment Variable:** `DATABASE_URL`

**Status:** ⚠️ **DEFINED BUT NOT IMPORTED OR USED IN ANY FILE**

This was created when the payment service was separated from projects-service, but the migration is incomplete. All payment operations still happen in the projects database.

---

## Summary Table

| API Endpoint | Method | Primary Database | Secondary Database | Tables Modified |
|--------------|--------|------------------|-------------------|-----------------|
| `/pay-downpayment` | POST | Projects DB | - | PaymentTransaction, ProjectPayment, ProjectTimeline |
| `/pay-installment` | POST | Projects DB | User Service (API) | InstallmentSchedule, PaymentTransaction, ProjectPayment, Project, ProjectTimeline, User.samaCreditAmount |
| `/release-payment` | POST | Projects DB | Contractor DB | ProjectPayment, ProjectTimeline, Contractor.balance |
| `/installments` | GET | Projects DB | - | Read only: Project, ProjectPayment, InstallmentSchedule |

---

## Environment Variables Required

```bash
# Projects Database (CURRENTLY USED)
PROJECT_DATABASE_URL=postgresql://user:pass@host:5432/projects_db

# Contractor Database (USED FOR BALANCE UPDATES)
CONTRACTORS_DATABASE_URL=postgresql://user:pass@host:5432/contractors_db

# Payment Database (NOT USED - BUT DEFINED)
DATABASE_URL=postgresql://user:pass@host:5432/payments_db

# User Service (FOR SAMA CREDIT UPDATES)
USER_SERVICE_URL=http://localhost:3001
```

---

## Key Insights

### ✅ What's Working:
1. All payment operations work correctly
2. Uses projects database (same as projects-service)
3. Cross-database updates work (contractor balance)
4. SAMA credit replenishment via user-service API

### ⚠️ Potential Issues:
1. **Payment schema not used** - `prisma/schema.prisma` is defined but unused
2. **Data duplication** - Payment data exists only in projects database
3. **Service separation incomplete** - Payment service doesn't have its own data
4. **Tight coupling** - Payment service depends on projects database schema

### 🔄 Future Migration (Optional):
If you want to truly separate the payment service:
1. Migrate payment data to payment database
2. Update all `projectsPrisma` calls to `prisma`
3. Projects service reads payment data via API calls
4. Complete microservice separation

**Current State:** Payment service is a **functional API layer** but not a true independent microservice yet.

---

## Conclusion

**All 3 payment APIs currently work with the PROJECTS DATABASE (`projectsPrisma`)**, not the payment schema. The payment database schema exists but is completely unused. This is a valid architectural choice for now, as it keeps related data together and avoids distributed transaction complexity.

The only external database interactions are:
- Contractor balance updates (contractor DB)
- SAMA credit updates (user service API)
