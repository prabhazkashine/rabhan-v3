import { z } from 'zod';

/**
 * Schema for getting user's quote requests with pagination
 */
export const getUserQuoteRequestsSchema = z.object({
  status: z
    .enum([
      'pending',
      'contractors_selected',
      'quotes_received',
      'quote_selected',
      'completed',
      'cancelled',
      'in-progress',
      'rejected',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort_by: z
    .enum(['created_at', 'updated_at', 'system_size_kwp'])
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type GetUserQuoteRequestsFilters = z.infer<typeof getUserQuoteRequestsSchema>;

/**
 * Contractor information
 */
export interface ContractorInfo {
  id: string;
  business_name: string;
  business_name_ar: string;
  status: string;
  verification_level: number;
  email: string;
  phone: string;
  user_type: string;
}

/**
 * Assigned contractor with status
 */
export interface AssignedContractorWithStatus {
  contractor_id: string;
  assignment_status: string;
  assigned_at: Date;
  responded_at: Date | null;
  contractor_info: ContractorInfo | null;
}

/**
 * User quote request with enriched data
 */
export interface UserQuoteRequest {
  id: string;
  user_id: string;
  property_details: any;
  electricity_consumption: any;
  system_size_kwp: number;
  location_lat?: number;
  location_lng?: number;
  location_address: string;
  roof_size_sqm?: number;
  service_area: string;
  status: string;
  inspection_dates: any;
  selected_contractors: string[];
  max_contractors: number;
  inspection_penalty_acknowledged: boolean;
  penalty_amount: number;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  contact_phone: string;
  quotes_count: number;
  approved_quote_count: number;
  assigned_contractors?: AssignedContractorWithStatus[];
  contractor_details?: Record<string, ContractorInfo>;
}

/**
 * Paginated user quote requests response
 */
export interface PaginatedUserQuoteRequests {
  requests: UserQuoteRequest[];
  total: number;
  page: number;
  limit: number;
}