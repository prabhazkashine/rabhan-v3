import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { extractUserFromHeaders, requireRole } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import { getProjectsQuerySchema } from '../schemas/project.schemas';

const router = Router();
const auth = extractUserFromHeaders;

// Get contractor's projects
router.get(
  '/projects',
  auth,
  requireRole('contractor'),
  validateQuery(getProjectsQuerySchema),
  projectController.getContractorProjects.bind(projectController)
);

export default router;
