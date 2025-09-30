import { z } from 'zod';

// Component specification schema
export const componentSpecSchema = z.object({
  name: z.string().max(200),
  type: z.string().max(100),
  brand: z.string().max(100),
  model: z.string().max(100),
  quantity: z.number().int().min(1),
  specifications: z.string().max(1000).optional(),
});

export type ComponentSpec = z.infer<typeof componentSpecSchema>;

// System specifications schema
export const systemSpecsSchema = z.object({
  total_capacity_kwp: z.number().min(1).max(1000),
  estimated_monthly_generation_kwh: z.number().min(0).max(1000000),
  estimated_annual_savings_sar: z.number().min(0).max(10000000),
  payback_period_years: z.number().min(0).max(50),
  system_efficiency_percent: z.number().min(10).max(100),
  monitoring_included: z.boolean(),
  grid_connection_type: z.enum(['grid_tied', 'hybrid', 'off_grid']),
  battery_storage_kwh: z.number().min(0).max(10000).optional(),
  components: z.array(componentSpecSchema).min(1).max(50),
});

export type SystemSpecs = z.infer<typeof systemSpecsSchema>;

// Warranty terms schema
export const warrantyTermsSchema = z.object({
  equipment_warranty_years: z.number().int().min(1).max(50),
  performance_warranty_years: z.number().int().min(1).max(50),
  installation_warranty_years: z.number().int().min(1).max(50),
  warranty_coverage: z.array(z.string().max(200)).min(1).max(20),
  warranty_conditions: z.string().max(2000),
});

export type WarrantyTerms = z.infer<typeof warrantyTermsSchema>;

// Maintenance terms schema
export const maintenanceTermsSchema = z.object({
  maintenance_included: z.boolean(),
  maintenance_period_years: z.number().int().min(0).max(50),
  maintenance_frequency: z.enum(['monthly', 'quarterly', 'biannual', 'annual']),
  maintenance_cost_annual: z.number().min(0).max(1000000),
  maintenance_scope: z.array(z.string().max(200)).min(1).max(20),
});

export type MaintenanceTerms = z.infer<typeof maintenanceTermsSchema>;

// Submit quote validation schema
export const submitQuoteSchema = z.object({
  request_id: z.string().uuid(),
  base_price: z.number().min(1).max(100000000),
  price_per_kwp: z.number().min(1).max(50000),
  system_specs: systemSpecsSchema,
  installation_timeline_days: z.number().int().min(1).max(365),
  warranty_terms: warrantyTermsSchema,
  maintenance_terms: maintenanceTermsSchema,
  panels_brand: z.string().max(100).optional(),
  panels_model: z.string().max(100).optional(),
  panels_quantity: z.number().int().min(1).max(10000).optional(),
  inverter_brand: z.string().max(100).optional(),
  inverter_model: z.string().max(100).optional(),
  inverter_quantity: z.number().int().min(1).max(100).optional(),
});

export type SubmitQuoteDTO = z.infer<typeof submitQuoteSchema>;

// Quote financial calculation
export interface QuoteFinancialCalculation {
  base_price: number;
  platform_overprice_percent: number;
  overprice_amount: number;
  total_user_price: number;
  platform_commission_percent: number;
  commission_amount: number;
  contractor_net_amount: number;
  platform_revenue: number;
  price_per_kwp: number;
  system_size_kwp: number;
}

// Pricing configuration
export interface PricingConfig {
  max_price_per_kwp: number;
  max_system_size_kwp: number;
  min_system_size_kwp: number;
  platform_overprice_percent: number;
  platform_commission_percent: number;
  vat_rate_percent: number;
}

// Contractor quote response
export interface ContractorQuoteResponse {
  id: string;
  request_id: string;
  contractor_id: string;
  base_price: number;
  price_per_kwp: number;
  overprice_amount: number;
  total_user_price: number;
  system_specs: any;
  installation_timeline_days: number;
  warranty_terms: any;
  maintenance_terms: any;
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
}