import prisma from '../lib/prisma';
import contractorPrisma from '../lib/contractor-prisma';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  BusinessRuleError,
  PaymentError,
  ValidationError,
} from '../utils/errors';
import { ProjectStatus, PaymentStatus, InstallmentStatus, PaymentMethod } from '../generated/prisma';
import {
  calculateBNPLSchedule,
  validatePaymentSelection,
  processMockPayment,
  generatePaymentReference,
  calculateOverdueDays,
  calculateLateFee,
  decimalToNumber,
} from '../utils/payment-calculator';
import {
  fetchUser,
  isEligibleForBNPL,
  checkSamaCreditEligibility,
  updateUserSamaCredit,
} from '../utils/user-client';
import type {
  SelectPaymentMethodInput,
  ProcessDownpaymentInput,
  PayInstallmentInput,
  ReleasePaymentToContractorInput,
} from '../schemas/payment.schemas';

export class PaymentService {
  /**
   * Select payment method (Single Pay or BNPL)
   */
  async selectPaymentMethod(
    projectId: string,
    userId: string,
    input: SelectPaymentMethodInput,
    authToken?: string
  ) {
    const startTime = Date.now();

    logger.info('Selecting payment method', {
      projectId,
      userId,
      paymentMethod: input.payment_method,
    });

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { payment: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('You can only configure payment for your own projects');
    }

    if (project.status !== ProjectStatus.payment_pending) {
      throw new BusinessRuleError('Payment method can only be selected for pending payments');
    }

    if (project.payment) {
      throw new BusinessRuleError('Payment method has already been selected');
    }

    const totalAmount = decimalToNumber(project.total_amount);

    // If BNPL is selected, check user eligibility
    if (input.payment_method === PaymentMethod.bnpl) {
      // Fetch user details from user-service
      const user = await fetchUser(userId, authToken);

      // Check flag status - only GREEN flag users can use BNPL
      if (!isEligibleForBNPL(user.flagStatus)) {
        throw new BusinessRuleError(
          `You are not eligible for Buy Now Pay Later. Your account flag status is ${user.flagStatus || 'not set'}. Only GREEN flag users can use BNPL. Please use single payment option.`
        );
      }

      logger.info('User flag status check passed', {
        userId,
        flagStatus: user.flagStatus,
      });

      // Check SAMA credit eligibility
      const creditCheck = checkSamaCreditEligibility(
        user.samaCreditAmount,
        totalAmount,
        input.downpayment_amount || 0
      );

      if (!creditCheck.isEligible) {
        throw new BusinessRuleError(
          creditCheck.reason || 'Insufficient SAMA credit for BNPL'
        );
      }

      logger.info('SAMA credit check passed', {
        userId,
        samaCreditAmount: user.samaCreditAmount,
        projectAmount: totalAmount,
        downpayment: input.downpayment_amount || 0,
      });
    }

    const validation = validatePaymentSelection({
      total_amount: totalAmount,
      payment_method: input.payment_method,
      downpayment_amount: input.downpayment_amount,
      number_of_installments: input.number_of_installments,
    });

    if (!validation.isValid) {
      throw new ValidationError(validation.errors.join(', '));
    }

    let payment;

    if (input.payment_method === PaymentMethod.single_pay) {
      // Single payment
      payment = await this.createSinglePayment(project.id, totalAmount);
    } else if (input.payment_method === PaymentMethod.bnpl) {
      // BNPL payment - deduct SAMA credit and create payment
      payment = await this.createBNPLPayment(
        project.id,
        userId,
        totalAmount,
        input.downpayment_amount || 0,
        input.number_of_installments!,
        authToken
      );
    }

    logger.info('Payment method selected', {
      projectId,
      paymentMethod: input.payment_method,
      duration: Date.now() - startTime,
    });

    return payment;
  }

  /**
   * Create single payment record
   */
  private async createSinglePayment(projectId: string, totalAmount: number) {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.projectPayment.create({
        data: {
          project_id: projectId,
          payment_method: PaymentMethod.single_pay,
          payment_status: PaymentStatus.pending,
          total_amount: totalAmount,
          remaining_amount: totalAmount,
          payment_reference: generatePaymentReference('SPY'),
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.payment_processing },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'payment_method_selected',
          title: 'Single Payment Selected',
          description: 'User selected to pay the full amount in one payment',
          created_by_role: 'user',
          metadata: {
            payment_method: 'single_pay',
            total_amount: totalAmount,
          },
        },
      });

      return payment;
    });
  }

  /**
   * Create BNPL payment record with installment schedule and deduct SAMA credit
   */
  private async createBNPLPayment(
    projectId: string,
    userId: string,
    totalAmount: number,
    downpayment: number,
    numberOfInstallments: number,
    authToken?: string
  ) {
    const schedule = calculateBNPLSchedule(totalAmount, downpayment, numberOfInstallments);

    // Fetch user to get current SAMA credit amount
    const user = await fetchUser(userId, authToken);

    // Calculate actual deduction amount
    // If user has partial credit, deduct only what they have
    // The rest is covered by downpayment
    const samaCreditToDeduct = Math.min(user.samaCreditAmount, totalAmount);

    // Deduct SAMA credit from user account
    try {
      await updateUserSamaCredit(
        userId,
        samaCreditToDeduct,
        'deduct',
        projectId,
        `BNPL selected for project ${projectId}. Total: ${totalAmount} SAR, SAMA credit used: ${samaCreditToDeduct} SAR, Downpayment: ${downpayment} SAR`,
        authToken
      );

      logger.info('SAMA credit deducted successfully', {
        userId,
        projectId,
        totalAmount,
        samaCreditDeducted: samaCreditToDeduct,
        downpaymentAmount: downpayment,
      });
    } catch (error) {
      logger.error('Failed to deduct SAMA credit', {
        userId,
        projectId,
        amount: samaCreditToDeduct,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new BusinessRuleError(
        'Failed to deduct SAMA credit. Please try again or contact support.'
      );
    }

    return await prisma.$transaction(async (tx) => {
      const payment = await tx.projectPayment.create({
        data: {
          project_id: projectId,
          payment_method: PaymentMethod.bnpl,
          payment_status: downpayment > 0 ? PaymentStatus.pending : PaymentStatus.partially_paid,
          total_amount: totalAmount,
          downpayment_amount: downpayment,
          remaining_amount: schedule.remaining_amount,
          paid_amount: 0,
          number_of_installments: numberOfInstallments,
          monthly_emi: schedule.monthly_emi,
          payment_reference: generatePaymentReference('BNPL'),
        },
      });

      for (const installment of schedule.installment_schedule) {
        await tx.installmentSchedule.create({
          data: {
            payment_id: payment.id,
            installment_number: installment.installment_number,
            amount: installment.amount,
            due_date: installment.due_date,
            status: InstallmentStatus.upcoming,
          },
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.payment_processing },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'payment_method_selected',
          title: 'BNPL Payment Selected',
          description: `User selected Buy Now Pay Later with ${numberOfInstallments} monthly installments`,
          created_by_role: 'user',
          metadata: {
            payment_method: 'bnpl',
            total_amount: totalAmount,
            downpayment: downpayment,
            number_of_installments: numberOfInstallments,
            monthly_emi: schedule.monthly_emi,
          },
        },
      });

      return payment;
    });
  }

  /**
   * Process full payment (single pay)
   */
  async processFullPayment(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { payment: true },
    });

    if (!project || !project.payment) {
      throw new NotFoundError('Project or payment not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    if (project.payment.payment_method !== PaymentMethod.single_pay) {
      throw new BusinessRuleError('This endpoint is for single payments only');
    }

    if (project.payment.payment_status === PaymentStatus.completed) {
      throw new BusinessRuleError('Payment has already been completed');
    }

    const amount = decimalToNumber(project.payment.total_amount);

    const paymentResult = await processMockPayment(amount, 'single_pay', userId);

    if (!paymentResult.success) {
      throw new PaymentError(paymentResult.message);
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          payment_id: project.payment!.id,
          transaction_type: 'full_payment',
          amount,
          status: 'success',
          transaction_reference: paymentResult.reference,
        },
      });

      const updatedPayment = await tx.projectPayment.update({
        where: { id: project.payment!.id },
        data: {
          payment_status: PaymentStatus.completed,
          paid_amount: amount,
          remaining_amount: 0,
          completed_at: new Date(),
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.payment_completed },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'payment_completed',
          title: 'Payment Completed',
          description: `Full payment of ${amount} SAR received`,
          created_by_id: userId,
          created_by_role: 'user',
          metadata: {
            amount,
            transaction_reference: paymentResult.reference,
          },
        },
      });

      return updatedPayment;
    });

    logger.info('Full payment processed', {
      projectId,
      amount,
      reference: paymentResult.reference,
    });

    return result;
  }

  /**
   * Process downpayment for BNPL
   * DELEGATED TO PAYMENT SERVICE
   */
  async processDownpayment(
    projectId: string,
    userId: string,
    input: ProcessDownpaymentInput
  ) {
    // Delegate to Payment Service
    const { processDownpaymentViaPaymentService } = await import('../utils/payment-client');

    try {
      const result = await processDownpaymentViaPaymentService(
        projectId,
        userId,
        { amount: input.amount }
      );

      logger.info('Downpayment processed via payment service', {
        projectId,
        amount: input.amount,
      });

      return result.data;
    } catch (error) {
      logger.error('Failed to process downpayment via payment service', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Pay monthly installment
   * DELEGATED TO PAYMENT SERVICE
   */
  async payInstallment(
    projectId: string,
    userId: string,
    input: PayInstallmentInput
  ) {
    // Delegate to Payment Service
    const { payInstallmentViaPaymentService } = await import('../utils/payment-client');

    try {
      const result = await payInstallmentViaPaymentService(
        projectId,
        userId,
        {
          installment_id: input.installment_id,
          amount: input.amount,
        }
      );

      logger.info('Installment paid via payment service', {
        projectId,
        installmentId: input.installment_id,
        amount: input.amount,
      });

      return result.data;
    } catch (error) {
      logger.error('Failed to pay installment via payment service', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Admin releases payment to contractor
   * DELEGATED TO PAYMENT SERVICE
   */
  async releasePaymentToContractor(
    projectId: string,
    adminId: string,
    input: ReleasePaymentToContractorInput
  ) {
    // Delegate to Payment Service
    const { releasePaymentViaPaymentService } = await import('../utils/payment-client');

    try {
      const result = await releasePaymentViaPaymentService(
        projectId,
        adminId,
        input
      );

      logger.info('Payment released to contractor via payment service', {
        projectId,
        amount: input.amount,
        adminId,
      });

      return result.data;
    } catch (error) {
      logger.error('Failed to release payment via payment service', {
        projectId,
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get installment schedule
   * DELEGATED TO PAYMENT SERVICE
   */
  async getInstallmentSchedule(projectId: string, userId: string) {
    // Delegate to Payment Service
    const { getInstallmentScheduleViaPaymentService } = await import('../utils/payment-client');

    try {
      const result = await getInstallmentScheduleViaPaymentService(
        projectId,
        userId
      );

      logger.info('Installment schedule fetched via payment service', {
        projectId,
        userId,
      });

      return result.data;
    } catch (error) {
      logger.error('Failed to get installment schedule via payment service', {
        projectId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
