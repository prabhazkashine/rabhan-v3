import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { z } from 'zod';
import { validateBody, validateParams } from '../middleware/validation.middleware';

const router = Router();

const projectIdSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

const updateStatusSchema = z.object({
  status: z.string(),
});

const addTimelineSchema = z.object({
  event_type: z.string(),
  title: z.string(),
  description: z.string(),
  created_by_id: z.string().optional(),
  created_by_role: z.string().optional(),
  metadata: z.any().optional(),
});

// ==================== INTERNAL API FOR OTHER SERVICES ====================
// These endpoints are called by other microservices (like payment-service)

// Get project info (basic details only)
router.get(
  '/:projectId/info',
  validateParams(projectIdSchema),
  projectController.getProjectInfo.bind(projectController)
);

// Update project status
router.patch(
  '/:projectId/status',
  validateParams(projectIdSchema),
  validateBody(updateStatusSchema),
  projectController.updateProjectStatus.bind(projectController)
);

// Add timeline event
router.post(
  '/:projectId/timeline',
  validateParams(projectIdSchema),
  validateBody(addTimelineSchema),
  projectController.addTimelineEvent.bind(projectController)
);

export default router;
