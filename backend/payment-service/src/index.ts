import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import paymentRoutes from './routes/payment.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 3009;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Payment Service API is running',
    timestamp: new Date().toISOString(),
    service: 'payment-service',
    version: '1.0.0',
    endpoints: {
      downpayment: 'POST /api/payments/:projectId/pay-downpayment',
      installment: 'POST /api/payments/:projectId/pay-installment',
      installmentSchedule: 'GET /api/payments/:projectId/installments',
      releasePayment: 'POST /api/payments/:projectId/release-payment (admin)',
    },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/payments', paymentRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

app.listen(port, () => {
  logger.info(`Payment service is running on http://localhost:${port}`, {
    port,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  });
  console.log(`Payment service is running on http://localhost:${port}`);
});