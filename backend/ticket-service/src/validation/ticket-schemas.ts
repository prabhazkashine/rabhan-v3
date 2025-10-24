import { z } from 'zod';

// =============== TICKET CREATION & UPDATES ===============

// Schema for creating a project support ticket (User -> Contractor)
export const createTicketSchema = z.object({
  project_id: z.string()
    .uuid('Project ID must be a valid UUID')
    .describe('ID of the completed project'),

  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .describe('Ticket title'),

  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters')
    .describe('Detailed description of the issue'),

  category: z.enum(['defect', 'maintenance', 'warranty', 'performance', 'billing', 'installation', 'other'])
    .describe('Category of the ticket'),

  priority: z.enum(['low', 'medium', 'high', 'urgent'])
    .default('medium')
    .describe('Ticket priority level'),
});

// Schema for creating an admin support ticket (User -> Admin/SuperAdmin)
export const createAdminTicketSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .describe('Ticket title'),

  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters')
    .describe('Detailed description of the issue'),

  category: z.enum(['defect', 'maintenance', 'warranty', 'performance', 'billing', 'installation', 'account_issue', 'general_inquiry', 'complaint', 'other'])
    .describe('Category of the ticket'),

  priority: z.enum(['low', 'medium', 'high', 'urgent'])
    .default('medium')
    .describe('Ticket priority level'),
});

export const updateTicketSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),

  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters')
    .optional(),

  priority: z.enum(['low', 'medium', 'high', 'urgent'])
    .optional(),

  status: z.enum(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'])
    .optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'])
    .describe('New status for the ticket'),

  resolution_summary: z.string()
    .min(10, 'Resolution summary must be at least 10 characters')
    .max(2000, 'Resolution summary cannot exceed 2000 characters')
    .optional()
    .describe('Summary of resolution (required when resolving)'),
}).refine((data) => {
  if (data.status === 'resolved' && !data.resolution_summary) {
    return false;
  }
  return true;
}, {
  message: 'resolution_summary is required when marking ticket as resolved',
  path: ['resolution_summary']
});

// =============== TICKET REPLY ===============

export const createTicketReplySchema = z.object({
  message: z.string()
    .min(5, 'Message must be at least 5 characters')
    .max(3000, 'Message cannot exceed 3000 characters')
    .describe('Reply message content'),

  is_solution: z.boolean()
    .default(false)
    .describe('Mark if this reply solves the issue'),
});

// =============== DOCUMENT UPLOAD ===============

export const uploadTicketDocumentSchema = z.object({
  document_type: z.enum(['image', 'video', 'pdf', 'other'])
    .describe('Type of document being uploaded'),

  title: z.string()
    .max(255, 'Title cannot exceed 255 characters')
    .optional()
    .describe('Document title'),

  description: z.string()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional()
    .describe('Document description'),

  // File metadata (these will be set by the file upload handler)
  file_url: z.string().optional(),
  file_name: z.string().optional(),
  file_size: z.number().optional(),
  file_mime_type: z.string().optional(),
});

export const uploadTicketReplyDocumentSchema = z.object({
  document_type: z.enum(['image', 'video', 'pdf', 'other'])
    .describe('Type of document being uploaded'),

  file_url: z.string().optional(),
  file_name: z.string().optional(),
  file_size: z.number().optional(),
  file_mime_type: z.string().optional(),
});

// =============== QUERY FILTERS ===============

export const getTicketsQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'])
    .optional()
    .describe('Filter by ticket status'),

  priority: z.enum(['low', 'medium', 'high', 'urgent'])
    .optional()
    .describe('Filter by priority'),

  category: z.enum(['defect', 'maintenance', 'warranty', 'performance', 'billing', 'installation', 'account_issue', 'general_inquiry', 'complaint', 'other'])
    .optional()
    .describe('Filter by category'),

  ticket_type: z.enum(['project_support', 'admin_support'])
    .optional()
    .describe('Filter by ticket type'),

  page: z.coerce.number()
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1)
    .describe('Page number for pagination'),

  limit: z.coerce.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10)
    .describe('Number of items per page'),

  sort: z.enum(['created_at', 'updated_at', 'priority', 'status'])
    .default('created_at')
    .describe('Sort field'),

  order: z.enum(['asc', 'desc'])
    .default('desc')
    .describe('Sort order'),
}).strict();

// =============== TYPE EXPORTS ===============

export type CreateTicketRequest = z.infer<typeof createTicketSchema>;
export type CreateAdminTicketRequest = z.infer<typeof createAdminTicketSchema>;
export type UpdateTicketRequest = z.infer<typeof updateTicketSchema>;
export type UpdateTicketStatusRequest = z.infer<typeof updateTicketStatusSchema>;
export type CreateTicketReplyRequest = z.infer<typeof createTicketReplySchema>;
export type UploadTicketDocumentRequest = z.infer<typeof uploadTicketDocumentSchema>;
export type UploadTicketReplyDocumentRequest = z.infer<typeof uploadTicketReplyDocumentSchema>;
export type GetTicketsQuery = z.infer<typeof getTicketsQuerySchema>;
