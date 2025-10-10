import { z } from 'zod';

export const updateSamaCreditSchema = z.object({
  amount: z.number()
    .positive('Amount must be a positive number')
    .max(1000000, 'Amount cannot exceed 1,000,000')
    .multipleOf(0.01, 'Amount can have up to 2 decimal places'),

  operation: z.enum(['deduct', 'add'], {
    errorMap: () => ({ message: 'Operation must be either "deduct" or "add"' }),
  }),

  projectId: z.string()
    .uuid('Project ID must be a valid UUID')
    .min(1, 'Project ID is required'),

  reason: z.string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export type UpdateSamaCreditRequest = z.infer<typeof updateSamaCreditSchema>;
