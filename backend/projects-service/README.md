# Projects Service

The Projects Service manages the complete lifecycle of solar installation projects from payment to completion, including payment processing (single pay and BNPL), installation tracking with OTP verification, and contractor reviews.

## Features

### 🔄 Project Management
- Create projects from approved quotes
- Track project status through multiple stages
- Complete project timeline and audit trail
- Project cancellation with reason tracking

### 💳 Payment Processing
- **Single Payment**: One-time full payment
- **BNPL (Buy Now Pay Later)**:
  - Optional downpayment
  - Flexible installments (3-24 months)
  - Automatic payment schedule generation
  - Late fee calculation for overdue payments
  - Monthly EMI tracking
- Mock payment gateway for development
- Admin payment release to contractors

### 🔨 Installation Tracking
- Installation scheduling with time slots
- Start/complete installation workflow
- **OTP Verification**: User verifies completion via SMS OTP
- Equipment and warranty tracking
- Installation duration monitoring
- Quality check system
- Document uploads (photos, certificates, warranties)

### ⭐ Review & Rating System
- 1-5 star ratings with detailed categories
- Review text and optional photos
- Contractor response capability
- Admin moderation (hide/flag reviews)
- Aggregate rating calculations

## Tech Stack

- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Validation**: Zod schemas
- **Logging**: Winston
- **Authentication**: JWT (via API Gateway headers)

## Database Schema

### Core Models
- **Project**: Main project entity
- **ProjectPayment**: Payment details and status
- **InstallmentSchedule**: BNPL payment schedule
- **PaymentTransaction**: Individual payment transactions
- **ProjectInstallation**: Installation tracking and OTP
- **ProjectReview**: Ratings and reviews
- **ProjectTimeline**: Audit trail
- **ProjectDocument**: File uploads

## API Endpoints

### User Routes (`/api/projects`)

#### Project Management
- `POST /` - Create project from quote
- `GET /` - Get user's projects (paginated)
- `GET /:projectId` - Get project details
- `PUT /:projectId` - Update project
- `POST /:projectId/cancel` - Cancel project
- `GET /:projectId/timeline` - Get project timeline

#### Payment
- `POST /:projectId/payment-method` - Select payment method (single/BNPL)
- `POST /:projectId/pay-full` - Process full payment
- `POST /:projectId/pay-downpayment` - Pay BNPL downpayment
- `POST /:projectId/pay-installment` - Pay monthly installment
- `GET /:projectId/installments` - Get installment schedule

#### Installation
- `POST /:projectId/schedule-installation` - Schedule installation
- `POST /:projectId/verify-completion` - Verify with OTP
- `POST /:projectId/documents` - Upload documents
- `GET /:projectId/installation` - Get installation details

#### Reviews
- `POST /:projectId/review` - Submit review
- `GET /:projectId/review` - Get project review

### Contractor Routes (`/api/contractor`)
- `GET /projects` - Get contractor's projects
- `POST /projects/:projectId/start-installation` - Start installation
- `POST /projects/:projectId/complete-installation` - Complete (sends OTP)
- `POST /projects/:projectId/review/respond` - Respond to review

### Admin Routes (`/api/admin`)
- `GET /projects` - Get all projects (filtered, paginated)
- `POST /projects/:projectId/release-payment` - Release payment to contractor
- `POST /projects/:projectId/quality-check` - Perform quality check
- `GET /reviews` - Get all reviews
- `PUT /reviews/:reviewId/moderate` - Moderate review

## Setup

### 1. Install Dependencies
```bash
cd backend/projects-service
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Setup Database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Or push schema without migrations
npx prisma db push
```

### 4. Run Service
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/rabhan_projects

# Server
PORT=3007
NODE_ENV=development

# JWT (must match other services)
JWT_SECRET=your-jwt-secret

# Service URLs
USER_SERVICE_URL=http://localhost:3001
CONTRACTOR_SERVICE_URL=http://localhost:3002
QUOTE_SERVICE_URL=http://localhost:3006
```

## Project Workflow

### Phase 1: Project Creation
1. User selects approved contractor quote
2. System creates project with `payment_pending` status

### Phase 2: Payment Selection
1. User chooses payment method:
   - **Single Pay**: Full amount in one payment
   - **BNPL**: Downpayment + monthly installments
2. System generates payment schedule (for BNPL)
3. Status → `payment_processing`

### Phase 3: Payment Processing

**Single Pay:**
1. User pays full amount (mock payment)
2. Payment received → Status: `payment_completed`
3. Ready for installation

**BNPL:**
1. Optional: User pays downpayment
2. Admin pays full amount to contractor
3. User pays monthly installments
4. Each installment tracked separately
5. Late fees applied for overdue payments

### Phase 4: Installation
1. Contractor schedules installation → Status: `installation_scheduled`
2. Contractor starts work → Status: `installation_in_progress`
3. Contractor completes work → Triggers OTP to user
4. User receives OTP via SMS
5. User verifies completion with OTP → Status: `installation_completed`

### Phase 5: Review & Completion
1. User submits rating and review
2. Contractor can respond to review
3. Project marked as `completed`

## Payment Calculations

### BNPL Example
```typescript
Total Amount: 50,000 SAR
Downpayment: 10,000 SAR (optional)
Months: 12

Remaining: 50,000 - 10,000 = 40,000 SAR
Monthly EMI: 40,000 / 12 = 3,333.33 SAR

Installment Schedule:
- Month 1: 3,333.33 SAR (due: Feb 1, 2025)
- Month 2: 3,333.33 SAR (due: Mar 1, 2025)
- ...
- Month 12: 3,333.38 SAR (due: Jan 1, 2026)
```

### Late Fees
- 1% per week overdue
- Maximum 10% of installment amount

## OTP Verification Flow

1. Contractor completes installation
2. System generates 6-digit OTP
3. OTP sent to user's mobile via SMS (mock in dev)
4. OTP valid for 10 minutes
5. User has 3 attempts to enter correct OTP
6. Upon successful verification:
   - Installation marked as verified
   - Project status updated
   - Review request sent to user

## Mock Payment System

For development, the service uses a mock payment gateway:

```typescript
// 95% success rate
const paymentResult = await processMockPayment(amount, method, userId);

if (paymentResult.success) {
  // Payment successful
  // Reference: PAY-ABC123XYZ
}
```

## Logging

All operations are logged with Winston:

```typescript
logger.info('Project created', {
  projectId,
  userId,
  totalAmount,
  paymentMethod
});

logger.error('Payment failed', {
  projectId,
  error: error.message
});
```

Logs stored in:
- `logs/error.log` - Errors only
- `logs/combined.log` - All logs

## Validation

All inputs validated with Zod schemas:

```typescript
const createProjectSchema = z.object({
  quote_id: z.string().uuid(),
  preferred_installation_date: z.string().datetime().optional(),
  project_name: z.string().min(3).max(200).optional(),
});
```

## Error Handling

Custom error classes:
- `ValidationError` (400)
- `NotFoundError` (404)
- `BusinessRuleError` (422)
- `PaymentError` (402)
- `ConflictError` (409)

## Integration with Other Services

### Quote Service
- Fetch quote details for project creation
- Validate quote is approved

### User Service
- Get user contact info for OTP
- Fetch user BNPL eligibility

### Contractor Service
- Update contractor rating after reviews
- Fetch contractor payment details

### API Gateway
- Authentication via headers (x-user-id, x-user-role)
- Routes requests to this service

## Future Enhancements

- [ ] Real payment gateway integration (Stripe, PayPal, Tap)
- [ ] Real SMS service (Twilio, AWS SNS)
- [ ] Email notifications
- [ ] File upload to cloud storage (AWS S3)
- [ ] Push notifications for mobile app
- [ ] Automated payment reminders
- [ ] Dispute resolution system
- [ ] Invoice generation
- [ ] Analytics dashboard

## License

Proprietary - Rabhan Solar Platform
