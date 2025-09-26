import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';

const router = Router();
const authController = new AuthController();

router.post('/register',
  validate(registerSchema),
  authController.register
);

router.post('/login',
  validate(loginSchema),
  authController.login
);

router.get('/profile',
  authenticateToken,
  authController.getProfile
);

export { router as authRoutes };