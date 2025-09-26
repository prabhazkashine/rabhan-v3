import { Router } from 'express';
import { PermissionController } from '../controllers/permission.controller';
import { validate } from '../middleware/validation.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  checkPermissionSchema,
  checkMultiplePermissionsSchema,
  checkPermissionByAdminIdSchema,
  checkMultiplePermissionsByAdminIdSchema
} from '../schemas/permission.schemas';

const router = Router();
const permissionController = new PermissionController();

// For authenticated users - check their own permissions
router.post('/check',
  authenticateToken,
  validate(checkPermissionSchema),
  permissionController.checkPermission
);

// For authenticated users - check multiple permissions
router.post('/check-multiple',
  authenticateToken,
  validate(checkMultiplePermissionsSchema),
  permissionController.checkMultiplePermissions
);


router.post('/verify',
  permissionController.verifyTokenAndPermissions
);

router.post('/check-by-admin-id',
  validate(checkPermissionByAdminIdSchema),
  permissionController.checkPermissionByAdminId
);

router.post('/check-multiple-by-admin-id',
  validate(checkMultiplePermissionsByAdminIdSchema),
  permissionController.checkMultiplePermissionsByAdminId
);

export { router as permissionRoutes };