import { z } from 'zod';

/**
 * Admin quote request with enriched user information
 */
export interface AdminQuoteRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  user_phone: string | null;
  system_size_kwp: number;
  location_address: string;
  service_area: string;
  status: string;
  property_details: any;
  electricity_consumption: any;
  created_at: Date;
  updated_at: Date;
  assigned_contractors_count: number;
  received_quotes_count: number;
  approved_quotes_count: number;
}

/**
 * Paginated admin quotes response
 */
export interface PaginatedAdminQuotes {
  quotes: AdminQuoteRequest[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Admin get all quotes filters
 */
export interface GetAdminQuotesFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort_by?: 'created_at' | 'updated_at' | 'system_size_kwp';
  sort_order?: 'asc' | 'desc';
  contractor_id?: string;
  min_amount?: number;
  max_amount?: number;
}

/**
 * Admin quote detail with enriched information
 */
export interface AdminQuoteDetail extends AdminQuoteRequest {
  // No additional fields needed for now, but can be extended
}

/**
 * Zod schema for admin quotes query validation
 */
export const getAdminQuotesSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : 20)),
  status: z.string().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'system_size_kwp']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  contractor_id: z.string().uuid().optional(),
  min_amount: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  max_amount: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
});

/**
 * Zod schema for quote ID param validation
 */
export const getQuoteByIdSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID format'),
});
