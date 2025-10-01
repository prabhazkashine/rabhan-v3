import { z } from 'zod';

/**
 * Remove contractor from quote request schema
 */
export const removeContractorSchema = z.object({
  contractor_id: z.string().uuid(),
});

export type RemoveContractorDTO = z.infer<typeof removeContractorSchema>;

/**
 * Add contractor to quote request schema
 */
export const addContractorSchema = z.object({
  contractor_id: z.string().uuid(),
  inspection_schedule: z.string().datetime().optional(),
});

export type AddContractorDTO = z.infer<typeof addContractorSchema>;

/**
 * Quote contractor operation response
 */
export interface QuoteContractorOperationResponse {
  quote_request_id: string;
  selected_contractors: string[];
  inspection_dates: any;
  updated_at: Date;
  message: string;
}
