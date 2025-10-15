import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { extractUserFromHeaders, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  selectPaymentMethodSchema,
  processDownpaymentSchema,
  processFullPaymentSchema,
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

// Select payment method (Single Pay or BNPL)
router.post(
  '/:projectId/select-payment-method',
  auth,
  validateParams(projectIdSchema),
  validateBody(selectPaymentMethodSchema),
  paymentController.selectPaymentMethod.bind(paymentController)
);

// Process full payment (single pay)
router.post(
  '/:projectId/pay-full',
  auth,
  validateParams(projectIdSchema),
  validateBody(processFullPaymentSchema),
  paymentController.processFullPayment.bind(paymentController)
);

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

// Get payment details (for project detail page)
router.get(
  '/:projectId/details',
  auth,
  validateParams(projectIdSchema),
  paymentController.getPaymentDetails.bind(paymentController)
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
