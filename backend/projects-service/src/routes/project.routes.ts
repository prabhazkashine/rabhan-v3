import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { authenticateToken, requireRole, extractUserFromHeaders } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createProjectSchema,
  updateProjectSchema,
  cancelProjectSchema,
  getProjectsQuerySchema,
} from '../schemas/project.schemas';
import {
  selectPaymentMethodSchema,
  processDownpaymentSchema,
  payInstallmentSchema,
  releasePaymentToContractorSchema,
} from '../schemas/payment.schemas';
import {
  scheduleInstallationSchema,
  startInstallationSchema,
  completeInstallationSchema,
  verifyCompletionSchema,
  qualityCheckSchema,
  uploadInstallationDocumentSchema,
} from '../schemas/installation.schemas';
import {
  createReviewSchema,
  respondToReviewSchema,
  moderateReviewSchema,
  getReviewsQuerySchema,
} from '../schemas/review.schemas';
import { z } from 'zod';

const router = Router();

const auth = extractUserFromHeaders;

const projectIdSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

// ==================== PROJECT ROUTES ====================

// Create project from approved quote
router.post(
  '/',
  auth,
  validateBody(createProjectSchema),
  projectController.createProject.bind(projectController)
);

// Get user's projects
router.get(
  '/',
  auth,
  validateQuery(getProjectsQuerySchema),
  projectController.getUserProjects.bind(projectController)
);

// Get specific project
router.get(
  '/:projectId',
  auth,
  validateParams(projectIdSchema),
  projectController.getProject.bind(projectController)
);

// Update project
router.put(
  '/:projectId',
  auth,
  validateParams(projectIdSchema),
  validateBody(updateProjectSchema),
  projectController.updateProject.bind(projectController)
);

// Cancel project
router.post(
  '/:projectId/cancel',
  auth,
  validateParams(projectIdSchema),
  validateBody(cancelProjectSchema),
  projectController.cancelProject.bind(projectController)
);

// Get project timeline
router.get(
  '/:projectId/timeline',
  auth,
  validateParams(projectIdSchema),
  projectController.getProjectTimeline.bind(projectController)
);

// ==================== PAYMENT ROUTES ====================

// Select payment method (single pay or BNPL)
router.post(
  '/:projectId/payment-method',
  auth,
  validateParams(projectIdSchema),
  validateBody(selectPaymentMethodSchema),
  projectController.selectPaymentMethod.bind(projectController)
);

// Process full payment (single pay)
router.post(
  '/:projectId/pay-full',
  auth,
  validateParams(projectIdSchema),
  projectController.processFullPayment.bind(projectController)
);

// Process downpayment (BNPL)
router.post(
  '/:projectId/pay-downpayment',
  auth,
  validateParams(projectIdSchema),
  validateBody(processDownpaymentSchema),
  projectController.processDownpayment.bind(projectController)
);

// Pay monthly installment
router.post(
  '/:projectId/pay-installment',
  auth,
  validateParams(projectIdSchema),
  validateBody(payInstallmentSchema),
  projectController.payInstallment.bind(projectController)
);

// Get installment schedule
router.get(
  '/:projectId/installments',
  auth,
  validateParams(projectIdSchema),
  projectController.getInstallmentSchedule.bind(projectController)
);

// ==================== INSTALLATION ROUTES ====================

// Schedule installation
router.post(
  '/:projectId/schedule-installation',
  auth,
  requireRole('contractor'),
  validateParams(projectIdSchema),
  validateBody(scheduleInstallationSchema),
  projectController.scheduleInstallation.bind(projectController)
);

// Start installation (contractor)
router.post(
  '/:projectId/start-installation',
  auth,
  requireRole('contractor'),
  validateParams(projectIdSchema),
  validateBody(startInstallationSchema),
  projectController.startInstallation.bind(projectController)
);

// Complete installation and send OTP (contractor)
router.post(
  '/:projectId/complete-installation',
  auth,
  requireRole('contractor'),
  validateParams(projectIdSchema),
  validateBody(completeInstallationSchema),
  projectController.completeInstallation.bind(projectController)
);

// Verify completion with OTP (user)
router.post(
  '/:projectId/verify-completion',
  auth,
  validateParams(projectIdSchema),
  validateBody(verifyCompletionSchema),
  projectController.verifyCompletion.bind(projectController)
);

// Upload installation document
router.post(
  '/:projectId/documents',
  auth,
  validateParams(projectIdSchema),
  validateBody(uploadInstallationDocumentSchema),
  projectController.uploadInstallationDocument.bind(projectController)
);

// Get installation details
router.get(
  '/:projectId/installation',
  auth,
  validateParams(projectIdSchema),
  projectController.getInstallation.bind(projectController)
);

// ==================== REVIEW ROUTES ====================

// Submit review (user)
router.post(
  '/:projectId/review',
  auth,
  validateParams(projectIdSchema),
  validateBody(createReviewSchema),
  projectController.createReview.bind(projectController)
);

// Get review for project
router.get(
  '/:projectId/review',
  auth,
  validateParams(projectIdSchema),
  projectController.getReview.bind(projectController)
);

// Contractor responds to review
router.post(
  '/:projectId/review/respond',
  auth,
  validateParams(projectIdSchema),
  validateBody(respondToReviewSchema),
  projectController.respondToReview.bind(projectController)
);

export default router;
