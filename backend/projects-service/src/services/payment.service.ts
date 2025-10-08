import prisma from '../lib/prisma';
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
    input: SelectPaymentMethodInput
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
      // BNPL payment
      payment = await this.createBNPLPayment(
        project.id,
        totalAmount,
        input.downpayment_amount || 0,
        input.number_of_installments!
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
   */
  async processDownpayment(
    projectId: string,
    userId: string,
    input: ProcessDownpaymentInput
  ) {
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

    if (project.payment.payment_method !== PaymentMethod.bnpl) {
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

    const result = await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          payment_id: project.payment!.id,
          transaction_type: 'downpayment',
          amount: input.amount,
          status: 'success',
          transaction_reference: paymentResult.reference,
        },
      });

      const updatedPayment = await tx.projectPayment.update({
        where: { id: project.payment!.id },
        data: {
          paid_amount: { increment: input.amount },
          remaining_amount: { decrement: input.amount },
          payment_status: PaymentStatus.partially_paid,
        },
      });

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
    // Get installment
    const installment = await prisma.installmentSchedule.findUnique({
      where: { id: input.installment_id },
      include: {
        payment: {
          include: { project: true },
        },
      },
    });

    if (!installment) {
      throw new NotFoundError('Installment not found');
    }

    if (installment.payment.project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    if (installment.status === InstallmentStatus.paid) {
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

    const result = await prisma.$transaction(async (tx) => {
      // Update installment
      const updatedInstallment = await tx.installmentSchedule.update({
        where: { id: input.installment_id },
        data: {
          status: InstallmentStatus.paid,
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
      const updatedPayment = await tx.projectPayment.update({
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
          status: { not: InstallmentStatus.paid },
        },
      });

      if (unpaidCount === 0) {
        await tx.projectPayment.update({
          where: { id: installment.payment_id },
          data: {
            payment_status: PaymentStatus.completed,
            completed_at: new Date(),
          },
        });

        await tx.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.payment_completed },
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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { payment: true },
    });

    if (!project || !project.payment) {
      throw new NotFoundError('Project or payment not found');
    }

    if (project.payment.admin_paid_contractor) {
      throw new BusinessRuleError('Payment has already been released to contractor');
    }

    // For BNPL, admin pays full amount to contractor upfront
    // For single_pay, admin releases after user payment
    const amountToRelease = input.amount;

    const result = await prisma.$transaction(async (tx) => {
      await tx.projectPayment.update({
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

      return project.payment;
    });

    logger.info('Payment released to contractor', {
      projectId,
      amount: amountToRelease,
      adminId,
    });

    return result;
  }

  /**
   * Get installment schedule
   */
  async getInstallmentSchedule(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        payment: {
          include: {
            installments: {
              orderBy: { installment_number: 'asc' },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('Unauthorized');
    }

    return project.payment?.installments || [];
  }
}

export const paymentService = new PaymentService();
