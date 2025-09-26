import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authRateLimit } from '../utils/rate-limiter';
import { validate } from '../middleware/validation';
import { validationSchemas } from '../validation';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/contractor/register',
  authRateLimit,
  validate(validationSchemas.contractorRegister),
  authController.contractorRegister
);

router.post('/contractor/login',
  authRateLimit,
  validate(validationSchemas.contractorLogin),
  authController.contractorLogin
);

router.post('/contractor/refresh',
  authRateLimit,
  authController.refreshToken
);

router.get('/contractor/profile',
  authMiddleware.authenticate,
  authController.getProfile
);

router.post('/send-otp',
  authRateLimit,
  authController.sendPhoneOTP
);

router.post('/verify-otp',
  authRateLimit,
  authController.verifyPhoneOTP
);

export { router as authRoutes };