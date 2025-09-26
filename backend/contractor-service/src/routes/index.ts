import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { contractorProfileRoutes } from './contractor-profile.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', contractorProfileRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Contractor Service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export { router as apiRoutes };