import { z } from 'zod';

/**
 * Schema for getting quotes for a specific request
 */
export const getQuotesForRequestSchema = z.object({
  status: z
    .enum(['pending_review', 'approved', 'rejected', 'revision_needed'])
    .optional(),
  sort_by: z
    .enum(['created_at', 'base_price', 'installation_timeline_days'])
    .default('base_price'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

export type GetQuotesForRequestFilters = z.infer<typeof getQuotesForRequestSchema>;

/**
 * Enriched contractor quote with contractor information
 */
export interface EnrichedContractorQuote {
  id: string;
  request_id: string;
  contractor_id: string;
  base_price: number;
  price_per_kwp: number;
  overprice_amount: number;
  total_user_price: number;
  system_specs?: any;
  installation_timeline_days?: number;
  warranty_terms?: any;
  maintenance_terms?: any;
  panels_brand?: string;
  panels_model?: string;
  panels_quantity?: number;
  inverter_brand?: string;
  inverter_model?: string;
  inverter_quantity?: number;
  admin_status: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
  days_until_expiry?: number;
  line_items?: QuoteLineItem[];

  // Contractor information
  contractor_name?: string;
  contractor_company?: string;
  contractor_email?: string;
  contractor_phone?: string;
  contractor_status?: string;
  contractor_verification_level?: number;
}

/**
 * Quote line item
 */
export interface QuoteLineItem {
  id: string;
  quotation_id: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  units: string;
  rabhan_commission: number;
  rabhan_overprice: number;
  user_price: number;
  vendor_net_price: number;
  vat: number;
  line_order: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Response type for get quotes for request
 */
export interface GetQuotesForRequestResponse {
  success: boolean;
  message: string;
  data: {
    quotes: EnrichedContractorQuote[];
    request_id: string;
    count: number;
  };
}