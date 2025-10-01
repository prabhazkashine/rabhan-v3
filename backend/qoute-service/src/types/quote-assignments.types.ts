import { z } from 'zod';

/**
 * Quote assignment with contractor and quote details
 */
export interface QuoteAssignment {
  id: string;
  request_id: string;
  contractor_id: string;
  status: string;
  assigned_at: Date;
  viewed_at: Date | null;
  responded_at: Date | null;
  response_notes: string | null;
  // Contractor details
  contractor_company: string;
  contractor_email: string;
  contractor_phone: string | null;
  // Quote details (if submitted)
  base_price: number | null;
  total_user_price: number | null;
  installation_timeline_days: number | null;
  is_selected: boolean | null;
  quote_status: string | null;
}

/**
 * Zod schema for quote ID param validation
 */
export const getQuoteAssignmentsSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID format'),
});
