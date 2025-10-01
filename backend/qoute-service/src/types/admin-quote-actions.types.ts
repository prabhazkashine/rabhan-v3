import { z } from 'zod';

/**
 * DTO for approving contractor quote
 */
export interface ApproveQuoteDTO {
  admin_notes?: string;
}

/**
 * DTO for rejecting contractor quote
 */
export interface RejectQuoteDTO {
  rejection_reason: string;
  admin_notes?: string;
}

/**
 * Zod schema for approving quote
 */
export const approveQuoteSchema = z.object({
  admin_notes: z.string().optional(),
});

/**
 * Zod schema for rejecting quote
 */
export const rejectQuoteSchema = z.object({
  rejection_reason: z.string().min(1, 'Rejection reason is required'),
  admin_notes: z.string().optional(),
});

/**
 * Zod schema for quote ID param
 */
export const quoteIdParamSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID format'),
});
