import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { generalRateLimit } from './utils/rate-limiter';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 3002;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://your-domain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(generalRateLimit);

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Contractor Service API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      register: '/api/auth/contractor/register',
      login: '/api/auth/contractor/login',
      refresh: '/api/auth/contractor/refresh',
      profile: '/api/auth/contractor/profile',
      sendOTP: '/api/auth/send-otp',
      verifyOTP: '/api/auth/verify-otp',
      contractorProfile: {
        get: '/api/profile',
        create: '/api/profile',
        update: '/api/profile',
        delete: '/api/profile'
      }
    }
  });
});

app.use(notFoundHandler);

app.use(errorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

app.listen(port, () => {
  logger.info(`Contractor service is running on http://localhost:${port}`, {
    port,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});