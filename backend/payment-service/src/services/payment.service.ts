import prisma from '../lib/prisma'; // Use payment service's own database
import contractorPrisma from '../lib/contractor-prisma';
import axios from 'axios';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  BusinessRuleError,
  PaymentError,
  ValidationError,
} from '../utils/errors';
import {
  calculateOverdueDays,
  calculateLateFee,
  decimalToNumber,
  processMockPayment,
  generatePaymentReference,
  calculateBNPLSchedule,
  validatePaymentSelection,
} from '../utils/payment-calculator';
import {
  updateUserSamaCredit,
  fetchUser,
  isEligibleForBNPL,
  checkSamaCreditEligibility
} from '../utils/user-client';
import type {
  SelectPaymentMethodInput,
  ProcessDownpaymentInput,
  ProcessFullPaymentInput,
  PayInstallmentInput,
  ReleasePaymentToContractorInput,
} from '../schemas/payment.schemas';

const PROJECTS_SERVICE_URL = process.env.PROJECTS_SERVICE_URL || 'http://localhost:3008';

/**
 * Helper to get project details from Projects Service
 */
async function getProjectFromProjectsService(projectId: string): Promise<{
  id: string;
  user_id: string;
  contractor_id: string;
  status: string;
  total_amount?: number;
}> {
  try {
    const response = await axios.get<{
      success: boolean;
      data: {
        id: string;
        user_id: string;
        contractor_id: string;
        status: string;
        total_amount?: number;
      };
    }>(`${PROJECTS_SERVICE_URL}/api/internal/projects/${projectId}/info`, {
      timeout: 5000,
    });

    console.log(response, 'responseresponseresponse')

    if (!response.data.success) {
      throw new Error('Failed to fetch project details');
    }

    return response.data.data;
  } catch (error) {
    console.log(error, 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
    logger.error('Failed to fetch project from projects service', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new BusinessRuleError('Unable to verify project details. Please try again.');
  }
}

/**
 * Helper to update project status in Projects Service
 */
async function updateProjectStatus(projectId: string, status: string): Promise<void> {
  try {
    await axios.patch(
      `${PROJECTS_SERVICE_URL}/api/internal/projects/${projectId}/status`,
      { status },
      { timeout: 5000 }
    );
  } catch (error) {
    logger.error('Failed to update project status', {
      projectId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - payment succeeded, status update is secondary
  }
}

/**
 * Helper to add timeline event in Projects Service
 */
async function addProjectTimeline(
  projectId: string,
  event: {
    event_type: string;
    title: string;
    description: string;
    created_by_id?: string;
    created_by_role?: string;
    metadata?: any;
  }
): Promise<void> {
  try {
    await axios.post(
      `${PROJECTS_SERVICE_URL}/api/internal/projects/${projectId}/timeline`,
      event,
      { timeout: 5000 }
    );
  } catch (error) {
    logger.error('Failed to add project timeline', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - timeline is secondary
  }
}

export class PaymentService {
  /**
   * Select payment method (Single Pay or BNPL)
   * Creates payment record in Payment Service database
   */
  async selectPaymentMethod(
    projectId: string,
    userId: string,
    totalAmount: number | undefined,
    input: SelectPaymentMethodInput,
    authToken?: string
  ) {
    const startTime = Date.now();

    logger.info('Selecting payment method', {
      projectId,
      userId,
      paymentMethod: input.payment_method,
    });

    // Get project details from projects service
    const project = await getProjectFromProjectsService(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('You can only configure payment for your own projects');
    }

    console.log(project, 'pppppppppppppppppppppppppp')

    // Auto-fetch total_amount from project if not provided
    const finalTotalAmount = totalAmount ?? project.total_amount;

    if (!finalTotalAmount || finalTotalAmount <= 0) {
      throw new ValidationError(
        'Total amount could not be determined. Please ensure the project has a valid cost or provide total_amount in the request.'
      );
    }

    logger.info('Total amount determined', {
      projectId,
      providedAmount: totalAmount,
      projectCost: project.total_amount,
      finalAmount: finalTotalAmount,
      source: totalAmount ? 'request' : 'project',
    });

    // Check if payment already exists
    const existingPayment = await prisma.projectPayment.findUnique({
      where: { project_id: projectId },
    });

    if (existingPayment) {
      throw new BusinessRuleError('Payment method has already been selected');
    }

    // Validate payment selection
    const validation = validatePaymentSelection({
      total_amount: finalTotalAmount,
      payment_method: input.payment_method,
      downpayment_amount: input.downpayment_amount,
      number_of_installments: input.number_of_installments,
    });

    if (!validation.isValid) {
      throw new ValidationError(validation.errors.join(', '));
    }

    // Additional BNPL-specific validations
    if (input.payment_method === 'bnpl') {
      // Fetch user details to check BNPL eligibility
      const user = await fetchUser(userId, authToken);

      // Check if user's flag status allows BNPL
      if (!isEligibleForBNPL(user.flagStatus)) {
        throw new BusinessRuleError(
          'You are not eligible for Buy Now Pay Later. Your account flag status does not permit BNPL purchases. Please use the single payment option or contact support for more information.'
        );
      }

      // Check SAMA credit eligibility
      const creditCheck = checkSamaCreditEligibility(
        user.samaCreditAmount,
        finalTotalAmount,
        input.downpayment_amount || 0
      );

      if (!creditCheck.isEligible) {
        throw new BusinessRuleError(creditCheck.reason || 'Insufficient SAMA credit for BNPL');
      }

      // Deduct SAMA credit for BNPL
      const amountToDeduct = Math.min(user.samaCreditAmount, finalTotalAmount - (input.downpayment_amount || 0));

      if (amountToDeduct > 0) {
        try {
          await updateUserSamaCredit(
            userId,
            amountToDeduct,
            'deduct',
            projectId,
            `SAMA credit deducted for BNPL payment on project ${projectId}. Amount: ${amountToDeduct} SAR.`,
            authToken
          );

          logger.info('SAMA credit deducted for BNPL', {
            userId,
            projectId,
            amountDeducted: amountToDeduct,
            previousAmount: user.samaCreditAmount,
            newAmount: user.samaCreditAmount - amountToDeduct,
          });
        } catch (error) {
          logger.error('Failed to deduct SAMA credit for BNPL', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            projectId,
            amountAttempted: amountToDeduct,
          });
          throw new BusinessRuleError(
            'Failed to process SAMA credit deduction. Please try again or contact support.'
          );
        }
      }
    }

    let payment;

    if (input.payment_method === 'single_pay') {
      // Single payment
      payment = await this.createSinglePayment(projectId, finalTotalAmount);
    } else if (input.payment_method === 'bnpl') {
      // BNPL payment - create payment with installment schedule
      payment = await this.createBNPLPayment(
        projectId,
        finalTotalAmount,
        input.downpayment_amount || 0,
        input.number_of_installments!
      );
    }

    // Update project status to payment_processing
    await updateProjectStatus(projectId, 'payment_processing');

    // Add timeline event
    await addProjectTimeline(projectId, {
      event_type: 'payment_method_selected',
      title: input.payment_method === 'bnpl' ? 'BNPL Payment Selected' : 'Single Payment Selected',
      description: input.payment_method === 'bnpl'
        ? `User selected Buy Now Pay Later with ${input.number_of_installments} monthly installments`
        : 'User selected to pay the full amount in one payment',
      created_by_id: userId,
      created_by_role: 'user',
      metadata: {
        payment_method: input.payment_method,
        total_amount: finalTotalAmount,
        ...(input.payment_method === 'bnpl' && {
          downpayment: input.downpayment_amount,
          number_of_installments: input.number_of_installments,
        }),
      },
    });

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
    const payment = await prisma.projectPayment.create({
      data: {
        project_id: projectId,
        payment_method: 'single_pay',
        payment_status: 'pending',
        total_amount: totalAmount,
        remaining_amount: totalAmount,
        payment_reference: generatePaymentReference('SPY'),
      },
    });

    logger.info('Single payment record created in Payment DB', {
      projectId,
      paymentId: payment.id,
    });

    return payment;
  }

  /**
   * Create BNPL payment record with installment schedule
   */
  private async createBNPLPayment(
    projectId: string,
    totalAmount: number,
    downpayment: number,
    numberOfInstallments: number
  ) {
    const schedule = calculateBNPLSchedule(totalAmount, downpayment, numberOfInstallments);

    return await prisma.$transaction(async (tx) => {
      const payment = await tx.projectPayment.create({
        data: {
          project_id: projectId,
          payment_method: 'bnpl',
          payment_status: downpayment > 0 ? 'pending' : 'partially_paid',
          total_amount: totalAmount,
          downpayment_amount: downpayment,
          remaining_amount: schedule.remaining_amount,
          paid_amount: 0,
          number_of_installments: numberOfInstallments,
          monthly_emi: schedule.monthly_emi,
          payment_reference: generatePaymentReference('BNPL'),
        },
      });

      // Create installment schedule
      for (const installment of schedule.installment_schedule) {
        await tx.installmentSchedule.create({
          data: {
            payment_id: payment.id,
            installment_number: installment.installment_number,
            amount: installment.amount,
            due_date: installment.due_date,
            status: 'upcoming',
          },
        });
      }

      logger.info('BNPL payment record created in Payment DB', {
        projectId,
        paymentId: payment.id,
        numberOfInstallments,
        downpayment,
      });

      return payment;
    });
  }

  /**
   * Process full payment (single pay)
   */
  async processFullPayment(
    projectId: string,
    userId: string,
    input: ProcessFullPaymentInput
  ) {
    const startTime = Date.now();

    logger.info('Processing full payment', {
      projectId,
      userId,
      amount: input.amount,
    });

    // Get project details from projects service
    const project = await getProjectFromProjectsService(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    // Get payment from payment service database
    const payment = await prisma.projectPayment.findUnique({
      where: { project_id: projectId },
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    if (payment.payment_method !== 'single_pay') {
      throw new BusinessRuleError('This project is not using single payment method');
    }

    if (payment.payment_status === 'completed') {
      throw new BusinessRuleError('Payment has already been completed');
    }

    const totalAmount = decimalToNumber(payment.total_amount);
    const paymentAmount = input.amount || totalAmount;

    if (paymentAmount < totalAmount) {
      throw new ValidationError(`Payment amount must be at least ${totalAmount} SAR`);
    }

    // Process mock payment
    const paymentResult = await processMockPayment(paymentAmount, 'full_payment', userId);

    if (!paymentResult.success) {
      throw new PaymentError(paymentResult.message);
    }

    // Update payment service database
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      await tx.projectPaymentTransaction.create({
        data: {
          payment_id: payment.id,
          transaction_type: 'full_payment',
          amount: paymentAmount,
          status: 'success',
          transaction_reference: paymentResult.reference,
        },
      });

      // Update payment record
      const updatedPayment = await tx.projectPayment.update({
        where: { id: payment.id },
        data: {
          paid_amount: paymentAmount,
          remaining_amount: 0,
          payment_status: 'completed',
          completed_at: new Date(),
        },
      });

      return updatedPayment;
    });

    // Update project status to payment_completed
    await updateProjectStatus(projectId, 'payment_completed');

    // Add timeline entry in projects service
    await addProjectTimeline(projectId, {
      event_type: 'full_payment_received',
      title: 'Full Payment Received',
      description: `Full payment of ${paymentAmount} SAR received`,
      created_by_id: userId,
      created_by_role: 'user',
      metadata: {
        amount: paymentAmount,
        transaction_reference: paymentResult.reference,
      },
    });

    logger.info('Full payment processed successfully', {
      projectId,
      amount: paymentAmount,
      reference: paymentResult.reference,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Process downpayment for BNPL
   */
  async processDownpayment(
    projectId: string,
    userId: string,
    input: ProcessDownpaymentInput
  ) {
    // Get project details from projects service
    const project = await getProjectFromProjectsService(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    // Get payment from payment service database
    const payment = await prisma.projectPayment.findUnique({
      where: { project_id: projectId },
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    if (payment.payment_method !== 'bnpl') {
      throw new BusinessRuleError('This project is not using BNPL');
    }

    const expectedDownpayment = decimalToNumber(payment.downpayment_amount);

    if (input.amount !== expectedDownpayment) {
      throw new ValidationError(`Downpayment amount must be ${expectedDownpayment} SAR`);
    }

    if (decimalToNumber(payment.paid_amount) >= expectedDownpayment) {
      throw new BusinessRuleError('Downpayment has already been paid');
    }

    // Process mock payment
    const paymentResult = await processMockPayment(input.amount, 'downpayment', userId);

    if (!paymentResult.success) {
      throw new PaymentError(paymentResult.message);
    }

    // Update payment service database
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      await tx.projectPaymentTransaction.create({
        data: {
          payment_id: payment.id,
          transaction_type: 'downpayment',
          amount: input.amount,
          status: 'success',
          transaction_reference: paymentResult.reference,
        },
      });

      // Update payment record
      const updatedPayment = await tx.projectPayment.update({
        where: { id: payment.id },
        data: {
          paid_amount: { increment: input.amount },
          remaining_amount: { decrement: input.amount },
          payment_status: 'partially_paid',
        },
      });

      return updatedPayment;
    });

    // Add timeline entry in projects service
    await addProjectTimeline(projectId, {
      event_type: 'downpayment_received',
      title: 'Downpayment Received',
      description: `Downpayment of ${input.amount} SAR received`,
      created_by_id: userId,
      created_by_role: 'user',
      metadata: {
        amount: input.amount,
        transaction_reference: paymentResult.reference,
      },
    });

    logger.info('Downpayment processed', {
      projectId,
      amount: input.amount,
      reference: paymentResult.reference,
    });

    return result;
  }

  /**
   * Pay monthly installment
   */
  async payInstallment(
    projectId: string,
    userId: string,
    input: PayInstallmentInput
  ) {
    // Get installment from payment service database
    const installment = await prisma.installmentSchedule.findUnique({
      where: { id: input.installment_id },
      include: {
        payment: true,
      },
    });

    if (!installment) {
      throw new NotFoundError('Installment not found');
    }

    // Verify project ownership
    const project = await getProjectFromProjectsService(projectId);

    if (!project || project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    if (installment.status === 'paid') {
      throw new BusinessRuleError('Installment has already been paid');
    }

    const installmentAmount = decimalToNumber(installment.amount);

    // Check for late fees
    const overdueDays = calculateOverdueDays(installment.due_date);
    const lateFee = calculateLateFee(installmentAmount, overdueDays);
    const totalAmount = installmentAmount + lateFee;

    if (input.amount < totalAmount) {
      throw new ValidationError(
        `Payment amount must be at least ${totalAmount} SAR (including late fee of ${lateFee} SAR)`
      );
    }

    // Process payment
    const paymentResult = await processMockPayment(input.amount, 'installment', userId);

    if (!paymentResult.success) {
      throw new PaymentError(paymentResult.message);
    }

    // Update payment service database
    const result = await prisma.$transaction(async (tx) => {
      // Update installment
      const updatedInstallment = await tx.installmentSchedule.update({
        where: { id: input.installment_id },
        data: {
          status: 'paid',
          paid_amount: input.amount,
          paid_at: new Date(),
          payment_reference: paymentResult.reference,
          is_overdue: overdueDays > 0,
          overdue_days: overdueDays,
          late_fee: lateFee,
        },
      });

      // Create transaction
      await tx.projectPaymentTransaction.create({
        data: {
          payment_id: installment.payment_id,
          transaction_type: 'installment',
          amount: input.amount,
          status: 'success',
          transaction_reference: paymentResult.reference,
          installment_id: input.installment_id,
          metadata: {
            installment_number: installment.installment_number,
            late_fee: lateFee,
            overdue_days: overdueDays,
          },
        },
      });

      // Update payment
      await tx.projectPayment.update({
        where: { id: installment.payment_id },
        data: {
          paid_amount: { increment: input.amount },
          remaining_amount: { decrement: installmentAmount },
        },
      });

      // Check if all installments are paid
      const unpaidCount = await tx.installmentSchedule.count({
        where: {
          payment_id: installment.payment_id,
          status: { not: 'paid' },
        },
      });

      if (unpaidCount === 0) {
        await tx.projectPayment.update({
          where: { id: installment.payment_id },
          data: {
            payment_status: 'completed',
            completed_at: new Date(),
          },
        });

        // Update project status
        await updateProjectStatus(projectId, 'payment_completed');
      }

      return updatedInstallment;
    });

    // Add timeline entry in projects service
    await addProjectTimeline(projectId, {
      event_type: 'installment_paid',
      title: `Installment ${installment.installment_number} Paid`,
      description: `Monthly installment of ${input.amount} SAR paid`,
      created_by_id: userId,
      created_by_role: 'user',
      metadata: {
        installment_number: installment.installment_number,
        amount: input.amount,
        late_fee: lateFee,
        transaction_reference: paymentResult.reference,
      },
    });

    // Replenish SAMA credit for BNPL payments
    // Only the installment amount (not late fees) gets added back to SAMA credit
    if (installment.payment.payment_method === 'bnpl') {
      try {
        await updateUserSamaCredit(
          userId,
          installmentAmount,
          'add',
          projectId,
          `Installment #${installment.installment_number} paid for project ${projectId}. Replenishing ${installmentAmount} SAR to SAMA credit.`
        );

        logger.info('SAMA credit replenished after installment payment', {
          userId,
          projectId,
          installmentNumber: installment.installment_number,
          amountReplenished: installmentAmount,
          lateFeeNotReplenished: lateFee,
        });
      } catch (error) {
        logger.error('Failed to replenish SAMA credit after installment payment', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          projectId,
          installmentId: input.installment_id,
          amountAttempted: installmentAmount,
        });

        // TODO: Create compensation task for manual processing
      }
    }

    logger.info('Installment paid', {
      projectId,
      installmentId: input.installment_id,
      amount: input.amount,
      lateFee,
    });

    return result;
  }

  /**
   * Admin releases payment to contractor
   */
  async releasePaymentToContractor(
    projectId: string,
    adminId: string,
    input: ReleasePaymentToContractorInput
  ) {
    // Get project details
    const project = await getProjectFromProjectsService(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Get payment from payment service database
    const payment = await prisma.projectPayment.findUnique({
      where: { project_id: projectId },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.admin_paid_contractor) {
      throw new BusinessRuleError('Payment has already been released to contractor');
    }

    const contractor = await contractorPrisma.contractor.findUnique({
      where: { id: project.contractor_id },
    });

    if (!contractor) {
      throw new NotFoundError('Contractor not found in contractor database');
    }

    const amountToRelease = input.amount;

    // Update payment service database
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.projectPayment.update({
        where: { id: payment.id },
        data: {
          admin_paid_contractor: true,
          admin_payment_amount: amountToRelease,
          admin_paid_at: new Date(),
          admin_payment_reference: input.payment_reference || generatePaymentReference('ADM'),
          admin_payment_notes: input.notes,
          contractor_bank_name: input.contractor_bank_name,
          contractor_iban: input.contractor_iban,
          contractor_account_holder: input.contractor_account_holder,
        },
      });

      return updatedPayment;
    });

    // Add timeline entry in projects service
    await addProjectTimeline(projectId, {
      event_type: 'admin_action',
      title: 'Payment Released to Contractor',
      description: `Admin released ${amountToRelease} SAR to contractor`,
      created_by_id: adminId,
      created_by_role: 'admin',
      metadata: {
        amount: amountToRelease,
        reference: input.payment_reference,
      },
    });

    // Update contractor balance
    try {
      const currentContractor = await contractorPrisma.contractor.findUnique({
        where: { id: project.contractor_id },
        select: { balance: true },
      });

      if (!currentContractor) {
        throw new Error('Contractor not found');
      }

      const currentBalance = currentContractor.balance
        ? parseFloat(currentContractor.balance.toString())
        : 0;
      const newBalance = currentBalance + amountToRelease;

      await contractorPrisma.contractor.update({
        where: { id: project.contractor_id },
        data: {
          balance: newBalance,
        },
      });

      logger.info('Contractor balance updated', {
        contractorId: project.contractor_id,
        previousBalance: currentBalance,
        amountAdded: amountToRelease,
        newBalance: newBalance,
        projectId,
      });
    } catch (error) {
      logger.error('Failed to update contractor balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contractorId: project.contractor_id,
        projectId,
        amount: amountToRelease,
      });

      throw new BusinessRuleError(
        'Payment recorded but failed to update contractor balance. Please contact support.'
      );
    }

    logger.info('Payment released to contractor', {
      projectId,
      amount: amountToRelease,
      adminId,
      contractorId: project.contractor_id,
    });

    return result;
  }

  /**
   * Get installment schedule
   */
  async getInstallmentSchedule(projectId: string, userId: string) {
    // Verify project ownership
    const project = await getProjectFromProjectsService(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    // Get from payment service database
    const payment = await prisma.projectPayment.findUnique({
      where: { project_id: projectId },
      include: {
        installments: {
          orderBy: { installment_number: 'asc' },
        },
      },
    });

    return payment?.installments || [];
  }

  /**
   * Get payment details with installments (for project detail page)
   * Returns null if payment doesn't exist
   */
  async getPaymentDetails(projectId: string, userId: string, userRole: string) {
    // Verify project ownership
    const project = await getProjectFromProjectsService(projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    logger.info('Authorization check for payment details', {
      projectId,
      userId,
      userRole,
      projectUserId: project.user_id,
      projectContractorId: project.contractor_id,
    });

    // Check authorization
    if (
      userRole.toLowerCase() !== 'admin' &&
      userRole.toLowerCase() !== 'super_admin' &&
      project.user_id !== userId &&
      project.contractor_id !== userId
    ) {
      logger.error('Authorization failed for payment details', {
        projectId,
        userId,
        userRole,
        projectUserId: project.user_id,
        projectContractorId: project.contractor_id,
      });
      throw new BusinessRuleError('Unauthorized');
    }

    // Get payment with installments from payment service database
    const payment = await prisma.projectPayment.findUnique({
      where: { project_id: projectId },
      include: {
        installments: {
          orderBy: { installment_number: 'asc' },
        },
      },
    });

    return payment;
  }
}

export const paymentService = new PaymentService();
