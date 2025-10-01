import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import solarCalculatorRoutes from './routes/solarCalculator.routes';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 3007;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Solar Calculator Service API is running',
    timestamp: new Date().toISOString(),
    service: 'solar-calculator-service',
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

// Routes
app.use('/api/solar', solarCalculatorRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err, path: req.path });
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Solar Calculator service is running on http://localhost:${port}`);
  console.log(`Solar Calculator service is running on http://localhost:${port}`);
});