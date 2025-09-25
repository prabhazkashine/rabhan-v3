import { Router } from 'express';
import { UserProfileController } from '../controllers/user-profile.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation';
import { updateUserProfileSchema } from '../validation/user-profile.schemas';

const router = Router();
const userProfileController = new UserProfileController();

router.use(authMiddleware.authenticate);

router.get('/',
  userProfileController.getProfile
);

router.put('/',
  validate(updateUserProfileSchema),
  userProfileController.updateProfile
);

router.delete('/',
  userProfileController.deleteProfile
);

router.get('/completion',
  userProfileController.getProfileCompletion
);

router.get('/bnpl-eligibility',
  userProfileController.getBNPLEligibility
);

export { router as userProfileRoutes };