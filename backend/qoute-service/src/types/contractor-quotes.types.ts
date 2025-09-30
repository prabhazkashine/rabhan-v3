import { z } from 'zod';

/**
 * Schema for getting contractor's quotes with pagination
 */
export const getContractorQuotesSchema = z.object({
  status: z
    .enum(['pending_review', 'approved', 'rejected', 'revision_needed'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort_by: z
    .enum(['created_at', 'updated_at', 'admin_status', 'base_price'])
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type GetContractorQuotesFilters = z.infer<typeof getContractorQuotesSchema>;

/**
 * Quotation totals
 */
export interface QuotationTotalsResponse {
  total_price: number;
  total_commission: number;
  total_over_price: number;
  total_user_price: number;
  total_vendor_net: number;
  vat_amount: number;
  total_payable: number;
}

/**
 * Line item in contractor quote
 */
export interface ContractorQuoteLineItem {
  id: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  rabhan_commission: number;
  rabhan_overprice: number;
  user_price: number;
  vendor_net_price: number;
  line_order: number;
}

/**
 * Contractor quote with enriched data
 */
export interface ContractorQuoteWithDetails {
  id: string;
  quote_request_id: string | null;
  contractor_id: string;
  request_id: string;
  base_price: number;
  price_per_kwp: number;
  overprice_amount: number;
  total_user_price: number | null;
  system_specs: any;
  installation_timeline_days: number;
  warranty_terms: any;
  maintenance_terms: any;
  panels_brand: string | null;
  panels_model: string | null;
  panels_quantity: number | null;
  inverter_brand: string | null;
  inverter_model: string | null;
  inverter_quantity: number | null;
  admin_status: string;
  admin_notes: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  is_selected: boolean;
  selected_at: Date | null;
  expires_at: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  contractor_vat_number: string | null;
  payment_terms: string | null;
  installation_deadline: Date | null;
  solar_system_capacity_kwp: number;
  storage_capacity_kwh: number | null;
  monthly_production_kwh: number | null;
  includes_battery: boolean;
  includes_monitoring: boolean;
  includes_maintenance: boolean;
  site_survey_required: boolean;
  permits_included: boolean;
  grid_connection_included: boolean;

  // Request details
  user_id: string;
  request_system_size: number;
  location_address: string;
  service_area: string;

  // Enriched data
  line_items: ContractorQuoteLineItem[];
  totals: QuotationTotalsResponse | null;
  status_display: string;
  created_at_formatted: string;
  installation_deadline_formatted: string | null;
}

/**
 * Paginated contractor quotes response
 */
export interface PaginatedContractorQuotes {
  quotes: ContractorQuoteWithDetails[];
  total: number;
}