import { z } from 'zod';

/**
 * Schema for selecting payment method
 * Note: total_amount is optional - if not provided, it will be fetched from the project
 */
export const selectPaymentMethodSchema = z.object({
  total_amount: z.number().positive('Total amount must be positive').optional(),
  payment_method: z.enum(['single_pay', 'bnpl']),
  downpayment_amount: z
    .number()
    .min(0, 'Downpayment cannot be negative')
    .optional(),
  number_of_installments: z
    .number()
    .int('Number of installments must be an integer')
    .min(3, 'Minimum 3 installments required')
    .max(24, 'Maximum 24 installments allowed')
    .optional(),
}).refine(
  (data) => {
    // If BNPL, number_of_installments is required
    if (data.payment_method === 'bnpl') {
      return data.number_of_installments !== undefined;
    }
    return true;
  },
  {
    message: 'Number of installments is required for BNPL payment method',
    path: ['number_of_installments'],
  }
);

/**
 * Schema for processing downpayment
 */
export const processDownpaymentSchema = z.object({
  amount: z
    .number()
    .positive('Downpayment amount must be positive'),
  payment_reference: z.string().optional(), // For mock payment gateway
});

/**
 * Schema for paying an installment
 */
export const payInstallmentSchema = z.object({
  installment_id: z.string().uuid('Invalid installment ID'),
  amount: z.number().positive('Payment amount must be positive'),
  payment_reference: z.string().optional(),
});

/**
 * Schema for processing full payment (single pay)
 */
export const processFullPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be positive').optional(),
  payment_reference: z.string().optional(), // For mock payment gateway
});

/**
 * Schema for admin releasing payment to contractor
 */
export const releasePaymentToContractorSchema = z.object({
  amount: z.number().positive('Payment amount must be positive'),
  payment_reference: z.string().optional(),
  notes: z.string().max(500).optional(),
  contractor_bank_name: z.string().optional(),
  contractor_iban: z.string().optional(),
  contractor_account_holder: z.string().optional(),
});

/**
 * Schema for payment filters
 */
export const getPaymentsQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  payment_method: z.enum(['single_pay', 'bnpl']).optional(),
  payment_status: z.enum([
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'partially_paid',
  ]).optional(),
  admin_paid_contractor: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type SelectPaymentMethodInput = z.infer<typeof selectPaymentMethodSchema>;
export type ProcessDownpaymentInput = z.infer<typeof processDownpaymentSchema>;
export type ProcessFullPaymentInput = z.infer<typeof processFullPaymentSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
export type ReleasePaymentToContractorInput = z.infer<typeof releasePaymentToContractorSchema>;
export type GetPaymentsQuery = z.infer<typeof getPaymentsQuerySchema>;
