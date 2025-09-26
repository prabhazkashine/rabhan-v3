import 'dotenv/config';
import express from 'express';
import path from 'path';
import logger from './config/logger';
import documentCategoryRoutes from './routes/document-category.routes';
import documentRoutes from './routes/document.routes';

const app = express();
const port = process.env.PORT || 3004;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (with authentication later if needed)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Document Service API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/document-categories', documentCategoryRoutes);
app.use('/api/documents', documentRoutes);

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(port, () => {
  logger.info(`Document service is running on http://localhost:${port}`);
});