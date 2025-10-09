import projectsPrisma from '../lib/projects-prisma';
import contractorPrisma from '../lib/contractor-prisma';
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
} from '../utils/payment-calculator';
import type {
  ProcessDownpaymentInput,
  PayInstallmentInput,
  ReleasePaymentToContractorInput,
} from '../schemas/payment.schemas';

export class PaymentService {
  /**
   * Process downpayment for BNPL
   */
  async processDownpayment(
    projectId: string,
    userId: string,
    input: ProcessDownpaymentInput
  ) {
    // Get project from projects database
    const project = await projectsPrisma.project.findUnique({
      where: { id: projectId },
      include: { payment: true },
    });

    if (!project || !project.payment) {
      throw new NotFoundError('Project or payment not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    if (project.payment.payment_method !== 'bnpl') {
      throw new BusinessRuleError('This project is not using BNPL');
    }

    const expectedDownpayment = decimalToNumber(project.payment.downpayment_amount);

    if (input.amount !== expectedDownpayment) {
      throw new ValidationError(`Downpayment amount must be ${expectedDownpayment} SAR`);
    }

    if (decimalToNumber(project.payment.paid_amount) >= expectedDownpayment) {
      throw new BusinessRuleError('Downpayment has already been paid');
    }

    // Process mock payment
    const paymentResult = await processMockPayment(input.amount, 'downpayment', userId);

    if (!paymentResult.success) {
      throw new PaymentError(paymentResult.message);
    }

    // Update projects database
    const result = await projectsPrisma.$transaction(async (tx) => {
      // Create transaction record
      await tx.paymentTransaction.create({
        data: {
          payment_id: project.payment!.id,
          transaction_type: 'downpayment',
          amount: input.amount,
          status: 'success',
          transaction_reference: paymentResult.reference,
        },
      });

      // Update payment record
      const updatedPayment = await tx.projectPayment.update({
        where: { id: project.payment!.id },
        data: {
          paid_amount: { increment: input.amount },
          remaining_amount: { decrement: input.amount },
          payment_status: 'partially_paid',
        },
      });

      // Add timeline entry
      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'downpayment_received',
          title: 'Downpayment Received',
          description: `Downpayment of ${input.amount} SAR received`,
          created_by_id: userId,
          created_by_role: 'user',
          metadata: {
            amount: input.amount,
            transaction_reference: paymentResult.reference,
          },
        },
      });

      return updatedPayment;
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
    // Get installment from projects database
    const installment = await projectsPrisma.installmentSchedule.findUnique({
      where: { id: input.installment_id },
      include: {
        payment: true,
      },
    });

    if (!installment) {
      throw new NotFoundError('Installment not found');
    }

    // Get project to verify ownership
    const project = await projectsPrisma.project.findUnique({
      where: { id: projectId },
    });

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
      throw new ValidationError(`Payment amount must be at least ${totalAmount} SAR (including late fee of ${lateFee} SAR)`);
    }

    // Process payment
    const paymentResult = await processMockPayment(input.amount, 'installment', userId);

    if (!paymentResult.success) {
      throw new PaymentError(paymentResult.message);
    }

    // Update projects database
    const result = await projectsPrisma.$transaction(async (tx) => {
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
      await tx.paymentTransaction.create({
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

        await tx.project.update({
          where: { id: projectId },
          data: { status: 'payment_completed' },
        });
      }

      // Timeline entry
      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
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
        },
      });

      return updatedInstallment;
    });

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
    // Get project
    const project = await projectsPrisma.project.findUnique({
      where: { id: projectId },
      include: { payment: true },
    });

    if (!project || !project.payment) {
      throw new NotFoundError('Project or payment not found');
    }

    if (project.payment.admin_paid_contractor) {
      throw new BusinessRuleError('Payment has already been released to contractor');
    }

    const contractor = await contractorPrisma.contractor.findUnique({
      where: { id: project.contractor_id },
    });

    if (!contractor) {
      throw new NotFoundError('Contractor not found in contractor database');
    }

    // For BNPL, admin pays full amount to contractor upfront
    // For single_pay, admin releases after user payment
    const amountToRelease = input.amount;

    // Update projects database
    const result = await projectsPrisma.$transaction(async (tx) => {
      const updatedPayment = await tx.projectPayment.update({
        where: { id: project.payment!.id },
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

      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'admin_action',
          title: 'Payment Released to Contractor',
          description: `Admin released ${amountToRelease} SAR to contractor`,
          created_by_id: adminId,
          created_by_role: 'admin',
          metadata: {
            amount: amountToRelease,
            reference: input.payment_reference,
          },
        },
      });

      return updatedPayment;
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
    const project = await projectsPrisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    // Get from projects database (where the data currently exists)
    const payment = await projectsPrisma.projectPayment.findUnique({
      where: { project_id: projectId },
      include: {
        installments: {
          orderBy: { installment_number: 'asc' },
        },
      },
    });

    return payment?.installments || [];
  }
}

export const paymentService = new PaymentService();
