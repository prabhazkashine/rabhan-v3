import express from 'express';
import 'dotenv/config';
import cors from 'cors';

// Import utilities and middleware
import logger from './utils/logger';
import db from './utils/database';
import { requestContext } from './middleware/request-context.middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';

// Import routes
import { routes } from './routes';

const app = express();
const port = process.env.PORT || 3004;

// Global middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request context middleware (must be before routes)
app.use(requestContext);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Marketplace Service API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'marketplace-service',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use(routes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close database connections
    await db.gracefulShutdown();
    logger.info('Database connections closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Connect to database
    await db.connect();
    logger.info('Database connected successfully');

    // Start HTTP server
    const server = app.listen(port, () => {
      logger.info(`Marketplace service is running on http://localhost:${port}`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`, error);
      } else {
        logger.error('Server error', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the application
startServer();