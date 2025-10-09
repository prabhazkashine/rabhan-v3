import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { extractUserFromHeaders, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  processDownpaymentSchema,
  payInstallmentSchema,
  releasePaymentToContractorSchema,
} from '../schemas/payment.schemas';
import { z } from 'zod';

const router = Router();
const auth = extractUserFromHeaders;

const projectIdSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

// ==================== USER PAYMENT ROUTES ====================

// Process downpayment (BNPL)
router.post(
  '/:projectId/pay-downpayment',
  auth,
  validateParams(projectIdSchema),
  validateBody(processDownpaymentSchema),
  paymentController.processDownpayment.bind(paymentController)
);

// Pay monthly installment
router.post(
  '/:projectId/pay-installment',
  auth,
  validateParams(projectIdSchema),
  validateBody(payInstallmentSchema),
  paymentController.payInstallment.bind(paymentController)
);

// Get installment schedule
router.get(
  '/:projectId/installments',
  auth,
  validateParams(projectIdSchema),
  paymentController.getInstallmentSchedule.bind(paymentController)
);

// ==================== ADMIN PAYMENT ROUTES ====================

// Release payment to contractor (admin only)
router.post(
  '/:projectId/release-payment',
  auth,
  requireRole('admin', 'super_admin'),
  validateParams(projectIdSchema),
  validateBody(releasePaymentToContractorSchema),
  paymentController.releasePaymentToContractor.bind(paymentController)
);

export default router;
