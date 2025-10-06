import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { extractUserFromHeaders, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { getProjectsQuerySchema } from '../schemas/project.schemas';
import { releasePaymentToContractorSchema } from '../schemas/payment.schemas';
import { qualityCheckSchema, moderateReviewSchema, getReviewsQuerySchema } from '../schemas/review.schemas';
import { z } from 'zod';

const router = Router();
const auth = extractUserFromHeaders;

const projectIdSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

const reviewIdSchema = z.object({
  reviewId: z.string().uuid('Invalid review ID'),
});

const contractorIdSchema = z.object({
  contractorId: z.string().uuid('Invalid contractor ID'),
});

// ==================== ADMIN PROJECT MANAGEMENT ====================

// Get all projects (admin)
router.get(
  '/projects',
  auth,
  requireRole('admin', 'super_admin'),
  validateQuery(getProjectsQuerySchema),
  projectController.getAllProjects.bind(projectController)
);

// Release payment to contractor
router.post(
  '/projects/:projectId/release-payment',
  auth,
  requireRole('admin', 'super_admin'),
  validateParams(projectIdSchema),
  validateBody(releasePaymentToContractorSchema),
  projectController.releasePaymentToContractor.bind(projectController)
);

// Perform quality check
router.post(
  '/projects/:projectId/quality-check',
  auth,
  requireRole('admin', 'super_admin'),
  validateParams(projectIdSchema),
  validateBody(qualityCheckSchema),
  projectController.performQualityCheck.bind(projectController)
);

// ==================== ADMIN REVIEW MANAGEMENT ====================

// Get all reviews
router.get(
  '/reviews',
  auth,
  requireRole('admin', 'super_admin'),
  validateQuery(getReviewsQuerySchema),
  projectController.getAllReviews.bind(projectController)
);

// Get contractor's reviews
router.get(
  '/reviews/contractor/:contractorId',
  auth,
  requireRole('admin', 'super_admin'),
  validateParams(contractorIdSchema),
  validateQuery(getReviewsQuerySchema),
  projectController.getContractorReviews.bind(projectController)
);

// Moderate review (hide/flag)
router.put(
  '/reviews/:reviewId/moderate',
  auth,
  requireRole('admin', 'super_admin'),
  validateParams(reviewIdSchema),
  validateBody(moderateReviewSchema),
  projectController.moderateReview.bind(projectController)
);

export default router;
