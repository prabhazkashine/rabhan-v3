import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import quoteRoutes from './routes/quote.routes';
import businessConfigRoutes from './routes/business-config.routes';

const app = express();
const port = process.env.PORT || 3006;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    userId: req.headers['x-user-id'],
    userRole: req.headers['x-user-role'],
  });
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Quote Service API is running',
    timestamp: new Date().toISOString(),
    service: 'quote-service',
    version: '1.0.0',
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
app.use('/api/quotes', quoteRoutes);
app.use('/api/business-config', businessConfigRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`Quote service started on http://localhost:${port}`);
  console.log(`Quote service is running on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});