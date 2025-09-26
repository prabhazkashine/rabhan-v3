import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { validate } from '../middleware/validation.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/authorization.middleware';
import {
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  getRoleSchema,
  listRolesSchema,
  assignRoleSchema
} from '../schemas/roles.schemas';

const router = Router();
const roleController = new RoleController();

// Initialize permissions (should be called once on system setup)
router.post('/initialize-permissions',
  authenticateToken,
  requireSuperAdmin,
  roleController.initializePermissions
);

router.post('/',
  authenticateToken,
  requireSuperAdmin,
  validate(createRoleSchema),
  roleController.createRole
);

router.get('/',
  authenticateToken,
  requireSuperAdmin,
  validate(listRolesSchema),
  roleController.listRoles
);

router.get('/:id',
  authenticateToken,
  requireSuperAdmin,
  validate(getRoleSchema),
  roleController.getRole
);

router.put('/:id',
  authenticateToken,
  requireSuperAdmin,
  validate(updateRoleSchema),
  roleController.updateRole
);

router.delete('/:id',
  authenticateToken,
  requireSuperAdmin,
  validate(deleteRoleSchema),
  roleController.deleteRole
);

router.post('/assign/:adminId',
  authenticateToken,
  requireSuperAdmin,
  validate(assignRoleSchema),
  roleController.assignRole
);

router.get('/my/permissions',
  authenticateToken,
  roleController.getPermissions
);

export { router as roleRoutes };