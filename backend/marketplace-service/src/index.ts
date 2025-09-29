import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import path from 'path';

import logger from './utils/logger';
import db from './utils/database';
import { requestContext } from './middleware/request-context.middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';

import { routes } from './routes';

const app = express();
const port = process.env.PORT || 3004;

app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestContext);

// Serve static files for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

app.use(routes);

app.use(notFoundHandler);

app.use(errorHandler);

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await db.gracefulShutdown();
    logger.info('Database connections closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
}

async function startServer() {
  try {
    await db.connect();
    logger.info('Database connected successfully');

    const server = app.listen(port, () => {
      logger.info(`Marketplace service is running on http://localhost:${port}`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    });

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

startServer();