import { z } from 'zod';

/**
 * Quotation line item
 */
export interface QuotationLineItem {
  id: string;
  quotation_id: string;
  item_name: string;
  description: string | null;
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
 * Admin view of contractor quote with contractor details
 */
export interface AdminContractorQuote {
  id: string;
  request_id: string | null;
  contractor_id: string;
  contractor_name: string;
  contractor_email: string;
  contractor_phone: string | null;
  base_price: number;
  price_per_kwp: number;
  total_user_price: number;
  overprice_amount: number;
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
  status: string;
  is_selected: boolean;
  selected_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Additional fields from detailed quotation
  contractor_vat_number: string | null;
  payment_terms: string | null;
  installation_deadline: Date | null;
  solar_system_capacity_kwp: number | null;
  storage_capacity_kwh: number | null;
  monthly_production_kwh: number | null;
  includes_battery: boolean;
  includes_monitoring: boolean;
  includes_maintenance: boolean;
  // Line items
  line_items: QuotationLineItem[];
}

/**
 * Zod schema for quote ID param validation
 */
export const getContractorQuotesForRequestSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID format'),
});
