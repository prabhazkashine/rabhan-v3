import { z } from 'zod';

/**
 * Business configuration percentages
 */
export interface BusinessConfigPercentages {
  rabhan_commission: number;
  rabhan_overprice: number;
  vat: number;
}

/**
 * Business configuration response
 */
export interface BusinessConfigResponse {
  id: string;
  config_key: string;
  config_value: BusinessConfigPercentages;
  description: string | null;
  is_active: boolean;
  updated_by: string | null;
  updated_at: Date;
  created_at: Date;
}

/**
 * Update business config schema
 */
export const updateBusinessConfigSchema = z.object({
  rabhan_commission: z.number().min(0).max(100).optional(),
  rabhan_overprice: z.number().min(0).max(100).optional(),
  vat: z.number().min(0).max(100).optional(),
});

export type UpdateBusinessConfigDTO = z.infer<typeof updateBusinessConfigSchema>;

/**
 * Contractor commission response
 */
export interface ContractorCommissionResponse {
  contractor_id: string;
  rabhan_commission: number | null;
  updated_at: Date;
}

/**
 * Update contractor commission schema
 */
export const updateContractorCommissionSchema = z.object({
  rabhan_commission: z.number().min(0).max(100),
});

export type UpdateContractorCommissionDTO = z.infer<typeof updateContractorCommissionSchema>;
