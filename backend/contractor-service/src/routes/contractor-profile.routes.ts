import { Router } from 'express';
import { contractorProfileController } from '../controllers/contractor-profile.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation';
import { contractorProfileCreateSchema, contractorProfileUpdateSchema } from '../validation/contractor-profile.schemas';
import { generalRateLimit } from '../utils/rate-limiter';

const router = Router();

router.use(authMiddleware.authenticate);

router.get('/',
  contractorProfileController.getProfile
);

router.post('/',
  generalRateLimit,
  validate(contractorProfileCreateSchema),
  contractorProfileController.createProfile
);

router.put('/',
  generalRateLimit,
  validate(contractorProfileUpdateSchema),
  contractorProfileController.updateProfile
);

router.delete('/',
  generalRateLimit,
  contractorProfileController.deleteProfile
);

export { router as contractorProfileRoutes };