import express from 'express';
import { authRoutes } from './routes/auth.routes';
import { userProfileRoutes } from './routes/user-profile.routes';
import { logger } from './utils/logger';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'User Service API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user/profile', userProfileRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

app.listen(port, () => {
  logger.info(`User service is running on port ${port}`);
  console.log(`User service is running on http://localhost:${port}`);
});