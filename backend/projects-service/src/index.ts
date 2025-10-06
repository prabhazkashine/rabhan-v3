import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import projectRoutes from './routes/project.routes';
import contractorRoutes from './routes/contractor.routes';
import adminRoutes from './routes/admin.routes';

const app = express();
const port = process.env.PORT || 3008;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    message: 'Projects Service API is running',
    timestamp: new Date().toISOString(),
    service: 'projects-service',
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
app.use('/api/projects', projectRoutes);
app.use('/api/contractor', contractorRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`Projects service started on http://localhost:${port}`);
  console.log(`Projects service is running on http://localhost:${port}`);
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