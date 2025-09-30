import { z } from 'zod';

// Simple property details schema
export const simplePropertyDetailsSchema = z.object({
  property_type: z.string().max(50),
  roof_type: z.string().max(50),
  roof_orientation: z.string().max(50),
  shading_issues: z.boolean(),
});

export type SimplePropertyDetails = z.infer<typeof simplePropertyDetailsSchema>;

// Electricity consumption schema
export const electricityConsumptionSchema = z.object({
  monthly_kwh: z.number().optional(),
  average_bill: z.number().optional(),
  peak_usage_hours: z.string().optional(),
});

export type ElectricityConsumption = z.infer<typeof electricityConsumptionSchema>;

// Create quote request validation schema
export const createQuoteRequestSchema = z.object({
  system_size_kwp: z.number().min(1).max(50),
  location_address: z.string().max(500),
  service_area: z.string().max(100),
  contact_phone: z.string().max(20),
  notes: z.string().max(1000).optional().default(''),
  property_details: simplePropertyDetailsSchema.optional(),
  selected_contractors: z.array(z.string().uuid()).min(0).max(10).optional(),
  inspection_schedules: z.record(z.string().uuid(), z.string().datetime()).optional(),
  electricity_consumption: z.number().optional(),
  average_electricity_bill: z.number().optional(),
  peak_usage_hours: z.string().optional(),
});

export type CreateQuoteRequestDTO = z.infer<typeof createQuoteRequestSchema>;

// Quote request response type
export interface QuoteRequestResponse {
  id: string;
  userId: string;
  systemSizeKwp: number;
  locationAddress: string;
  serviceArea: string;
  propertyDetails: any;
  electricityConsumption: any;
  selectedContractors: string[];
  inspectionDates: any;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extended Request type with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}