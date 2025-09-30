import { z } from 'zod';

// Line item schema for detailed quotation (with pre-calculated values from frontend)
export const lineItemSchema = z.object({
  serial_number: z.number().int().optional(),
  item_name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  totalPrice: z.number().min(0),
  rabhanCommission: z.number().min(0),
  rabhanOverPrice: z.number().min(0),
  userPrice: z.number().min(0),
  vendorNetPrice: z.number().min(0),
  units: z.string().max(50).optional().default('unit'),
});

export type LineItem = z.infer<typeof lineItemSchema>;

// System specifications for detailed quotation
export const detailedSystemSpecsSchema = z.object({
  panels: z
    .object({
      brand: z.string().max(100),
      model: z.string().max(100),
      quantity: z.number().int().min(1),
      wattage: z.number().min(0),
      warranty_years: z.number().int().min(0),
    })
    .optional(),
  inverters: z
    .object({
      brand: z.string().max(100),
      model: z.string().max(100),
      quantity: z.number().int().min(1),
      capacity_kw: z.number().min(0),
      warranty_years: z.number().int().min(0),
    })
    .optional(),
  mounting: z
    .object({
      type: z.string().max(100),
      material: z.string().max(100),
      warranty_years: z.number().int().min(0),
    })
    .optional(),
  other_components: z.array(z.any()).optional(),
});

// Detailed quotation submission schema
export const submitDetailedQuotationSchema = z.object({
  request_id: z.string().uuid(),
  base_price: z.number().min(0),
  contractor_vat_number: z.string().max(50).optional(),
  installation_deadline: z.string().optional(), // Can be date string like "2025-10-30"
  payment_terms: z.string().max(2000).optional(),
  solar_system_capacity_kwp: z.number().min(0).max(1000),
  storage_capacity_kwh: z.number().min(0).max(10000).optional(),
  monthly_production_kwh: z.number().min(0).max(100000).optional(),
  price_per_kwp: z.number().min(0).optional(),
  installation_timeline_days: z.number().int().min(1).max(365).optional().default(30),
  system_specs: detailedSystemSpecsSchema.optional(),
  line_items: z.array(lineItemSchema).min(1).max(100),
});

export type SubmitDetailedQuotationDTO = z.infer<typeof submitDetailedQuotationSchema>;

// Line item with calculated pricing
export interface CalculatedLineItem {
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

// Quotation totals
export interface QuotationTotals {
  total_price: number;
  total_commission: number;
  total_over_price: number;
  total_user_price: number;
  total_vendor_net: number;
  vat_amount: number;
  total_payable: number;
}

// Detailed quotation response
export interface DetailedQuotationResponse {
  id: string;
  contractor_id: string;
  request_id: string;
  contractor_vat_number?: string;
  installation_deadline?: Date;
  payment_terms?: string;
  solar_system_capacity_kwp: number;
  storage_capacity_kwh?: number;
  monthly_production_kwh?: number;
  base_price: number;
  price_per_kwp: number;
  installation_timeline_days: number;
  system_specs?: any;
  admin_status: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  line_items: CalculatedLineItem[];
  totals: QuotationTotals;
}