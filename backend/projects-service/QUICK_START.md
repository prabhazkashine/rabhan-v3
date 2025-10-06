# Quick Start Guide - Projects Service

## Setup in 3 Minutes ⚡

### 1. Install & Configure (30 seconds)
```bash
cd backend/projects-service
npm install
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://postgres:12345@localhost:5432/rabhan_projects?schema=public"
JWT_SECRET=your-jwt-secret
PORT=3007
```

### 2. Setup Database (1 minute)
```bash
# Generate Prisma client
npx prisma generate

# Create database and tables
npx prisma db push
```

### 3. Start Service (5 seconds)
```bash
npm run dev
```

Server should start on http://localhost:3007

---

## Test the API 🧪

### Health Check
```bash
curl http://localhost:3007/health
```

Expected:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-..."
}
```

### Create a Project
```bash
curl -X POST http://localhost:3007/api/projects \
  -H "x-user-id: user-123" \
  -H "x-user-role: user" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_name": "Solar Installation - Villa",
    "description": "10 kWp solar system installation"
  }'
```

### Select Payment Method (BNPL)
```bash
# Replace {projectId} with actual project ID from above
curl -X POST http://localhost:3007/api/projects/{projectId}/payment-method \
  -H "x-user-id: user-123" \
  -H "x-user-role: user" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method": "bnpl",
    "downpayment_amount": 10000,
    "number_of_installments": 12
  }'
```

### Get Project Details
```bash
curl http://localhost:3007/api/projects/{projectId} \
  -H "x-user-id: user-123" \
  -H "x-user-role: user"
```

---

## Complete Test Workflow 🔄

### 1. Project Creation
```javascript
POST /api/projects
Headers: x-user-id, x-user-role: user
Body: {
  "quote_id": "uuid-here",
  "project_name": "My Solar Project"
}

// Response: Project created with status "payment_pending"
```

### 2. Select BNPL Payment
```javascript
POST /api/projects/{projectId}/payment-method
Body: {
  "payment_method": "bnpl",
  "downpayment_amount": 10000,
  "number_of_installments": 12
}

// Response: Payment schedule with 12 monthly installments
// Check: GET /api/projects/{projectId}/installments
```

### 3. Pay Downpayment
```javascript
POST /api/projects/{projectId}/pay-downpayment
Body: {
  "amount": 10000
}

// Response: Downpayment processed (MOCK)
// Console: "📱 SMS MOCK: OTP is: 123456" (for testing)
```

### 4. Admin Releases Payment to Contractor
```javascript
POST /api/admin/projects/{projectId}/release-payment
Headers: x-user-role: admin
Body: {
  "amount": 50000,
  "notes": "Full payment for project"
}

// Response: Payment released to contractor
```

### 5. Schedule Installation
```javascript
POST /api/projects/{projectId}/schedule-installation
Body: {
  "scheduled_date": "2025-02-01T09:00:00Z",
  "scheduled_time_slot": "09:00-12:00",
  "estimated_duration_hours": 8
}

// Response: Installation scheduled
// Status: "installation_scheduled"
```

### 6. Contractor Starts Installation
```javascript
POST /api/projects/{projectId}/start-installation
Headers: x-user-id: contractor-123, x-user-role: contractor
Body: {
  "installation_team": "Team A - 3 members",
  "team_lead_name": "Ahmad Ali",
  "team_lead_phone": "+966501234567"
}

// Response: Installation started
// Status: "installation_in_progress"
```

### 7. Contractor Completes Installation
```javascript
POST /api/projects/{projectId}/complete-installation
Headers: x-user-role: contractor
Body: {
  "actual_duration_hours": 7,
  "equipment_installed": [
    {
      "name": "Solar Panel",
      "model": "Panel-500W",
      "quantity": 20
    },
    {
      "name": "Inverter",
      "model": "INV-10K",
      "quantity": 1
    }
  ]
}

// Response: OTP sent to user
// Console: "📱 SMS MOCK: OTP for project {id} is: 654321"
// Status: "awaiting_verification"
```

### 8. User Verifies with OTP
```javascript
POST /api/projects/{projectId}/verify-completion
Headers: x-user-role: user
Body: {
  "otp": "654321"  // From console in step 7
}

// Response: Installation verified
// Status: "installation_completed"
```

### 9. User Submits Review
```javascript
POST /api/projects/{projectId}/review
Headers: x-user-role: user
Body: {
  "rating": 4.5,
  "review_text": "Excellent work! Professional team and timely completion.",
  "review_title": "Great Experience",
  "quality_rating": 5,
  "communication_rating": 4,
  "timeliness_rating": 5,
  "professionalism_rating": 5,
  "would_recommend": true
}

// Response: Review submitted
// Status: "completed"
```

### 10. Pay Monthly Installment
```javascript
// Get installment schedule first
GET /api/projects/{projectId}/installments

// Pay first installment
POST /api/projects/{projectId}/pay-installment
Body: {
  "installment_id": "installment-uuid-from-schedule",
  "amount": 3333.33
}

// Response: Installment paid
// Console: "📱 Payment processed: PAY-ABC123"
```

---

## Database Queries 🔍

```bash
# Connect to database
psql postgresql://postgres:12345@localhost:5432/rabhan_projects

# View projects
SELECT id, user_id, contractor_id, status, total_amount, created_at
FROM projects
ORDER BY created_at DESC
LIMIT 5;

# View payments
SELECT p.id, p.payment_method, p.payment_status, p.total_amount, p.paid_amount
FROM project_payments p
JOIN projects pr ON p.project_id = pr.id
ORDER BY p.created_at DESC;

# View installments
SELECT i.installment_number, i.amount, i.due_date, i.status, i.paid_at
FROM installment_schedules i
WHERE payment_id = 'payment-id-here'
ORDER BY installment_number;

# View timeline
SELECT event_type, title, description, created_at
FROM project_timelines
WHERE project_id = 'project-id-here'
ORDER BY created_at DESC;

# View reviews
SELECT pr.rating, pr.review_text, pr.would_recommend, pr.created_at
FROM project_reviews pr
JOIN projects p ON pr.project_id = p.id
ORDER BY pr.created_at DESC;
```

---

## Prisma Studio (Visual Database)
```bash
npx prisma studio
```

Opens browser at http://localhost:5555 with visual database interface.

---

## Common Issues & Fixes 🔧

### Issue: Database connection failed
```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -l | grep rabhan_projects

# Create database if missing
createdb rabhan_projects
```

### Issue: Prisma client not found
```bash
# Regenerate client
npx prisma generate
```

### Issue: Tables don't exist
```bash
# Push schema to database
npx prisma db push
```

### Issue: Port already in use
```bash
# Change port in .env
PORT=3008

# Or kill process on port 3007
# Windows:
netstat -ano | findstr :3007
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3007 | xargs kill
```

---

## Development Tips 💡

### 1. Watch Logs in Real-Time
```bash
# Terminal 1: Run service
npm run dev

# Terminal 2: Watch combined logs
tail -f logs/combined.log

# Terminal 3: Watch errors only
tail -f logs/error.log
```

### 2. Test OTP Flow
OTP codes are printed to console in development:
```
📱 SMS MOCK: OTP for project abc-123 is: 654321
```

### 3. Mock Payment Reference
Payment references are auto-generated:
```
PAY-ABC123XYZ   (Single payment)
BNPL-XYZ789ABC  (BNPL)
```

### 4. Reset Data
```bash
# Clear all data
npx prisma migrate reset

# Soft reset (keep schema)
npx prisma db push --force-reset
```

---

## Integration with API Gateway

If using with API Gateway (recommended):

1. **API Gateway** receives request
2. **API Gateway** authenticates user
3. **API Gateway** sets headers:
   - `x-user-id`
   - `x-user-role`
   - `x-user-email`
4. **API Gateway** proxies to Projects Service
5. **Projects Service** extracts user from headers

No JWT verification needed in Projects Service!

---

## Useful Commands 📋

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# Push schema without migration
npx prisma db push

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Run development server
npm run dev

# Build for production
npm run build

# Run production
npm start

# View logs
tail -f logs/combined.log
tail -f logs/error.log
```

---

## What's Mocked? 🎭

For development, these are mocked:

1. **Payment Gateway** - Always succeeds (95% rate)
2. **SMS Service** - Logs to console instead
3. **Email Service** - Logs to console instead
4. **Quote Service API** - Returns mock quote data
5. **User Service API** - Returns mock user data
6. **Contractor Service API** - Returns mock contractor data

In production, replace these with real integrations!

---

## Need Help? 🆘

Check these files:
- `README.md` - Full documentation
- `IMPLEMENTATION_SUMMARY.md` - What's implemented
- `prisma/schema.prisma` - Database schema
- `src/routes/*.routes.ts` - API endpoints

Happy coding! 🚀
