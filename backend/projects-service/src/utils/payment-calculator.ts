import { Decimal } from '@prisma/client/runtime/library';
import { logger } from './logger';

export interface BNPLCalculation {
  total_amount: number;
  downpayment_amount: number;
  remaining_amount: number;
  number_of_installments: number;
  monthly_emi: number;
  installment_schedule: InstallmentScheduleItem[];
}

export interface InstallmentScheduleItem {
  installment_number: number;
  amount: number;
  due_date: Date;
}

export interface PaymentCalculationInput {
  total_amount: number;
  payment_method: 'single_pay' | 'bnpl';
  downpayment_amount?: number;
  number_of_installments?: number;
}

/**
 * Calculate BNPL payment schedule
 */
export function calculateBNPLSchedule(
  totalAmount: number,
  downpayment: number,
  numberOfInstallments: number
): BNPLCalculation {
  const startTime = Date.now();

  // Validate inputs
  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than 0');
  }

  if (downpayment < 0 || downpayment >= totalAmount) {
    throw new Error('Downpayment must be between 0 and total amount');
  }

  if (numberOfInstallments < 1 || numberOfInstallments > 24) {
    throw new Error('Number of installments must be between 1 and 24');
  }

  // Calculate remaining amount
  const remainingAmount = totalAmount - downpayment;

  // Calculate monthly EMI (simple division, no interest in this implementation)
  // In production, you might add interest rate calculations
  const monthlyEMI = parseFloat((remainingAmount / numberOfInstallments).toFixed(2));

  // Generate installment schedule
  const installmentSchedule: InstallmentScheduleItem[] = [];
  const currentDate = new Date();

  for (let i = 1; i <= numberOfInstallments; i++) {
    const dueDate = new Date(currentDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    dueDate.setHours(23, 59, 59, 999); // End of day

    // For the last installment, adjust to cover any rounding differences
    const amount = i === numberOfInstallments
      ? parseFloat((remainingAmount - (monthlyEMI * (numberOfInstallments - 1))).toFixed(2))
      : monthlyEMI;

    installmentSchedule.push({
      installment_number: i,
      amount,
      due_date: dueDate,
    });
  }

  const calculation: BNPLCalculation = {
    total_amount: totalAmount,
    downpayment_amount: downpayment,
    remaining_amount: remainingAmount,
    number_of_installments: numberOfInstallments,
    monthly_emi: monthlyEMI,
    installment_schedule: installmentSchedule,
  };

  logger.info('BNPL schedule calculated', {
    totalAmount,
    downpayment,
    numberOfInstallments,
    monthlyEMI,
    calculationTime: Date.now() - startTime,
  });

  return calculation;
}

/**
 * Validate payment method selection
 */
export function validatePaymentSelection(input: PaymentCalculationInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.payment_method === 'bnpl') {
    if (!input.number_of_installments) {
      errors.push('Number of installments is required for BNPL');
    } else if (input.number_of_installments < 3 || input.number_of_installments > 24) {
      errors.push('Number of installments must be between 3 and 24');
    }

    if (input.downpayment_amount && input.downpayment_amount >= input.total_amount) {
      errors.push('Downpayment cannot be equal to or greater than total amount');
    }

    // Minimum installment amount validation (e.g., 100 SAR minimum)
    const minInstallmentAmount = 100;
    const remainingAmount = input.total_amount - (input.downpayment_amount || 0);
    const emiAmount = remainingAmount / (input.number_of_installments || 1);

    if (emiAmount < minInstallmentAmount) {
      errors.push(`Monthly installment amount must be at least ${minInstallmentAmount} SAR`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate mock payment reference
 */
export function generatePaymentReference(prefix: string = 'PAY'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Mock payment processing
 * In production, integrate with actual payment gateway
 */
export async function processMockPayment(
  amount: number,
  paymentMethod: string,
  userId: string
): Promise<{
  success: boolean;
  reference: string;
  message: string;
}> {
  try {
    logger.info('Processing mock payment', {
      amount,
      paymentMethod,
      userId,
    });

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock: 95% success rate
    const isSuccess = Math.random() > 0.05;

    if (!isSuccess) {
      return {
        success: false,
        reference: '',
        message: 'Payment failed: Insufficient funds (MOCK)',
      };
    }

    const reference = generatePaymentReference('PAY');

    logger.info('Mock payment processed successfully', {
      amount,
      reference,
      userId,
    });

    return {
      success: true,
      reference,
      message: 'Payment processed successfully',
    };
  } catch (error) {
    logger.error('Mock payment processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      amount,
      userId,
    });

    return {
      success: false,
      reference: '',
      message: 'Payment processing failed',
    };
  }
}

/**
 * Calculate overdue days for an installment
 */
export function calculateOverdueDays(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (today <= due) {
    return 0;
  }

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Calculate late fee (example: 1% per week overdue, max 10%)
 */
export function calculateLateFee(amount: number, overdueDays: number): number {
  if (overdueDays <= 0) {
    return 0;
  }

  const weeksOverdue = Math.ceil(overdueDays / 7);
  const lateFeePercentage = Math.min(weeksOverdue * 1, 10); // Max 10%
  const lateFee = (amount * lateFeePercentage) / 100;

  return parseFloat(lateFee.toFixed(2));
}

/**
 * Convert Prisma Decimal to number
 */
export function decimalToNumber(decimal: Decimal | number): number {
  if (typeof decimal === 'number') {
    return decimal;
  }
  return parseFloat(decimal.toString());
}

/**
 * Format currency for display (SAR)
 */
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('en-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SAR`;
}
