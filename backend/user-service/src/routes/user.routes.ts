import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validate } from '../middleware/validation';
import { updateSamaCreditSchema } from '../validation/user.schemas';

const router = Router();
const userController = new UserController();

/**
 * Get user by ID
 * GET /api/users/:userId
 */
router.get('/:userId',
  userController.getUserById
);

/**
 * Update user SAMA credit
 * PATCH /api/users/:userId/sama-credit
 */
router.patch('/:userId/sama-credit',
  validate(updateSamaCreditSchema),
  userController.updateSamaCredit
);

export { router as userRoutes };
