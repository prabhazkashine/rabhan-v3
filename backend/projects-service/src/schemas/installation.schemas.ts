import { z } from 'zod';

/**
 * Schema for scheduling installation
 */
export const scheduleInstallationSchema = z.object({
  scheduled_date: z.string().datetime('Invalid date format'),
  scheduled_time_slot: z
    .string()
    .regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, 'Time slot must be in format HH:MM-HH:MM')
    .optional(),
  estimated_duration_hours: z.number().int().min(1).max(24).optional(),
  team_lead_name: z.string().min(2).max(100).optional(),
  team_lead_phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number').optional(),
  installation_notes: z.string().max(1000).optional(),
});

/**
 * Schema for starting installation
 */
export const startInstallationSchema = z.object({
  installation_team: z.string().max(500).optional(),
  team_lead_name: z.string().min(2).max(100).optional(),
  team_lead_phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number').optional(),
  installation_notes: z.string().max(1000).optional(),
});

/**
 * Schema for completing installation (contractor side)
 */
export const completeInstallationSchema = z.object({
  actual_duration_hours: z.number().int().min(1).max(48).optional(),
  equipment_installed: z.array(z.object({
    name: z.string(),
    model: z.string().optional(),
    serial_number: z.string().optional(),
    quantity: z.number().int().positive().optional(),
  })).optional(),
  warranty_info: z.object({
    warranty_period_years: z.number().positive().optional(),
    warranty_provider: z.string().optional(),
    warranty_certificate_number: z.string().optional(),
  }).optional(),
  installation_notes: z.string().max(1000).optional(),
  contractor_notes: z.string().max(1000).optional(),
  issues_encountered: z.string().max(1000).optional(),
});

/**
 * Schema for OTP verification (user side)
 */
export const verifyCompletionSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only numbers'),
});

/**
 * Schema for quality check (admin/inspector)
 */
export const qualityCheckSchema = z.object({
  quality_check_passed: z.boolean(),
  quality_check_notes: z.string().max(1000).optional(),
  quality_checked_by: z.string().uuid('Invalid inspector ID').optional(),
});

/**
 * Schema for uploading installation document
 */
export const uploadInstallationDocumentSchema = z.object({
  document_type: z.enum([
    'installation_photo',
    'certificate',
    'warranty',
    'invoice',
    'contract',
  ]),
  title: z.string().min(3).max(200),
  description: z.string().max(500).optional(),
  file_name: z.string(),
  file_url: z.string().url('Invalid file URL'),
  file_size: z.number().int().positive().optional(),
  file_mime_type: z.string().optional(),
});

export type ScheduleInstallationInput = z.infer<typeof scheduleInstallationSchema>;
export type StartInstallationInput = z.infer<typeof startInstallationSchema>;
export type CompleteInstallationInput = z.infer<typeof completeInstallationSchema>;
export type VerifyCompletionInput = z.infer<typeof verifyCompletionSchema>;
export type QualityCheckInput = z.infer<typeof qualityCheckSchema>;
export type UploadInstallationDocumentInput = z.infer<typeof uploadInstallationDocumentSchema>;
