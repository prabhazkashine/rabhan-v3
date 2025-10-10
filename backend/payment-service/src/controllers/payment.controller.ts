import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { paymentService } from '../services/payment.service';
import { logger } from '../utils/logger';

export class PaymentController {
  /**
   * Select payment method (Single Pay or BNPL)
   */
  async selectPaymentMethod(req: AuthRequest, res: Response) {
    try {
      // Get total amount from request body or fetch from project
      const { total_amount, ...paymentInput } = req.body;

      const payment = await paymentService.selectPaymentMethod(
        req.params.projectId,
        req.user!.id,
        total_amount,
        paymentInput,
        req.headers['authorization']
      );

      res.json({
        success: true,
        message: 'Payment method selected successfully',
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process downpayment (BNPL)
   */
  async processDownpayment(req: AuthRequest, res: Response) {
    try {
      const payment = await paymentService.processDownpayment(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Downpayment processed successfully',
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Pay monthly installment
   */
  async payInstallment(req: AuthRequest, res: Response) {
    try {
      const installment = await paymentService.payInstallment(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Installment paid successfully',
        data: installment,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get installment schedule
   */
  async getInstallmentSchedule(req: AuthRequest, res: Response) {
    try {
      const installments = await paymentService.getInstallmentSchedule(
        req.params.projectId,
        req.user!.id
      );

      res.json({
        success: true,
        data: installments,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment details with installments (for project detail page)
   */
  async getPaymentDetails(req: AuthRequest, res: Response) {
    try {
      const paymentDetails = await paymentService.getPaymentDetails(
        req.params.projectId,
        req.user!.id,
        req.user!.role
      );

      res.json({
        success: true,
        data: paymentDetails,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Admin releases payment to contractor
   */
  async releasePaymentToContractor(req: AuthRequest, res: Response) {
    try {
      const payment = await paymentService.releasePaymentToContractor(
        req.params.projectId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        message: 'Payment released to contractor successfully',
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }
}

export const paymentController = new PaymentController();
