import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation';
import { registerSchema, loginSchema, updateProfileSchema } from '../validation/schemas';

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

router.post('/refresh-token',
  authController.refreshToken
);

router.post('/logout',
  authController.logout
);

// Phone verification routes
router.post('/phone/send-otp',
  authController.sendPhoneOTP
);

router.post('/phone/verify-otp',
  authController.verifyPhoneOTP
);

// Profile routes
router.get('/profile',
  authMiddleware.authenticate,
  authController.getProfile
);

router.put('/profile',
  authMiddleware.authenticate,
  validate(updateProfileSchema),
  authController.updateProfile
);

router.get('/verify',
  authController.verify
);

export { router as authRoutes };