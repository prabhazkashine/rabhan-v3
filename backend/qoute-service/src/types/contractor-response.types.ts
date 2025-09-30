import { z } from 'zod';

/**
 * Schema for contractor responding to a quote request assignment
 */
export const contractorRespondSchema = z.object({
  response: z.enum(['accepted', 'rejected'], {
    errorMap: () => ({ message: 'Response must be either "accepted" or "rejected"' }),
  }),
  notes: z.string().max(1000).optional(),
});

export type ContractorRespondDTO = z.infer<typeof contractorRespondSchema>;

/**
 * Response type for contractor respond endpoint
 */
export interface ContractorRespondResponse {
  success: boolean;
  message: string;
  data: {
    assignment_id: string;
    request_id: string;
    response: 'accepted' | 'rejected';
    responded_at: Date;
    next_steps: string;
  };
}