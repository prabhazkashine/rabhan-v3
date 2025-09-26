import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { validate } from '../middleware/validation.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/authorization.middleware';
import {
  createAdminSchema,
  updateAdminSchema,
  deleteAdminSchema,
  getAdminSchema,
  listAdminsSchema
} from '../schemas/admin.schemas';

const router = Router();
const adminController = new AdminController();

router.post('/',
  authenticateToken,
  requireSuperAdmin,
  validate(createAdminSchema),
  adminController.createAdmin
);

router.get('/',
  authenticateToken,
  requireSuperAdmin,
  validate(listAdminsSchema),
  adminController.listAdmins
);

router.get('/:id',
  authenticateToken,
  requireSuperAdmin,
  validate(getAdminSchema),
  adminController.getAdmin
);

router.put('/:id',
  authenticateToken,
  requireSuperAdmin,
  validate(updateAdminSchema),
  adminController.updateAdmin
);

router.delete('/:id',
  authenticateToken,
  requireSuperAdmin,
  validate(deleteAdminSchema),
  adminController.deleteAdmin
);

export { router as adminRoutes };