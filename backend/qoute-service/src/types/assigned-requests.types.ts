import { z } from 'zod';

// Query parameters for getting assigned requests
export const getQuoteRequestsSchema = z.object({
  status: z
    .enum(['pending', 'contractors_selected', 'quotes_received', 'quote_selected', 'completed', 'cancelled'])
    .optional(),
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .optional()
    .default('1'),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default('10'),
  sort_by: z.enum(['created_at', 'updated_at', 'system_size_kwp', 'assigned_at']).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type GetQuoteRequestsQuery = z.infer<typeof getQuoteRequestsSchema>;

// Filters for getting assigned requests
export interface AssignedRequestFilters {
  status?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
}

// Quote request within assignment
export interface AssignedQuoteRequest {
  user_id: string;
  system_size_kwp: number;
  location_address: string;
  service_area: string;
  property_details: any;
  electricity_consumption: any;
  created_at: Date;
  status: string;
}

// Contractor assignment response
export interface ContractorAssignment {
  assignment_id: string;
  request_id: string;
  contractor_id: string;
  assignment_status: string;
  assigned_at: Date;
  viewed_at?: Date;
  responded_at?: Date;
  response_notes?: string;
  has_submitted_quote: boolean;
  quote_request: AssignedQuoteRequest;
}

// Paginated response
export interface PaginatedAssignments {
  assignments: ContractorAssignment[];
  total: number;
  page: number;
  limit: number;
}