import { z } from 'zod';

/**
 * Schema for creating a new project from an approved quote
 */
export const createProjectSchema = z.object({
  quote_id: z.string().uuid('Invalid quote ID format'),
  preferred_installation_date: z.string().datetime().optional(),
  project_name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  contractor_id: z.string().uuid('Invalid contractor ID format')
});

/**
 * Schema for updating project details
 */
export const updateProjectSchema = z.object({
  project_name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  preferred_installation_date: z.string().datetime().optional(),
  property_address: z.string().max(500).optional(),
});

/**
 * Schema for cancelling a project
 */
export const cancelProjectSchema = z.object({
  cancellation_reason: z.string().min(10).max(1000, 'Cancellation reason must be between 10 and 1000 characters'),
});

/**
 * Schema for project filters and pagination
 */
export const getProjectsQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  status: z.enum([
    'payment_pending',
    'payment_processing',
    'payment_completed',
    'installation_scheduled',
    'installation_in_progress',
    'installation_completed',
    'completed',
    'cancelled',
    'on_hold',
  ]).optional(),
  contractor_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'total_amount']).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CancelProjectInput = z.infer<typeof cancelProjectSchema>;
export type GetProjectsQuery = z.infer<typeof getProjectsQuerySchema>;
