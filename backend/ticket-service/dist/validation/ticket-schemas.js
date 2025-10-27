"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTicketsQuerySchema = exports.uploadTicketReplyDocumentSchema = exports.uploadTicketDocumentSchema = exports.createTicketReplySchema = exports.updateTicketStatusSchema = exports.updateTicketSchema = exports.createAdminTicketSchema = exports.createTicketSchema = void 0;
const zod_1 = require("zod");
// =============== TICKET CREATION & UPDATES ===============
// Schema for creating a project support ticket (User -> Contractor)
exports.createTicketSchema = zod_1.z.object({
    project_id: zod_1.z.string()
        .uuid('Project ID must be a valid UUID')
        .describe('ID of the completed project'),
    title: zod_1.z.string()
        .min(5, 'Title must be at least 5 characters')
        .max(200, 'Title cannot exceed 200 characters')
        .describe('Ticket title'),
    description: zod_1.z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description cannot exceed 5000 characters')
        .describe('Detailed description of the issue'),
    category: zod_1.z.enum(['defect', 'maintenance', 'warranty', 'performance', 'billing', 'installation', 'other'])
        .describe('Category of the ticket'),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent'])
        .default('medium')
        .describe('Ticket priority level'),
});
// Schema for creating an admin support ticket (User -> Admin/SuperAdmin)
exports.createAdminTicketSchema = zod_1.z.object({
    title: zod_1.z.string()
        .min(5, 'Title must be at least 5 characters')
        .max(200, 'Title cannot exceed 200 characters')
        .describe('Ticket title'),
    description: zod_1.z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description cannot exceed 5000 characters')
        .describe('Detailed description of the issue'),
    category: zod_1.z.enum(['defect', 'maintenance', 'warranty', 'performance', 'billing', 'installation', 'account_issue', 'general_inquiry', 'complaint', 'other'])
        .describe('Category of the ticket'),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent'])
        .default('medium')
        .describe('Ticket priority level'),
});
exports.updateTicketSchema = zod_1.z.object({
    title: zod_1.z.string()
        .min(5, 'Title must be at least 5 characters')
        .max(200, 'Title cannot exceed 200 characters')
        .optional(),
    description: zod_1.z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description cannot exceed 5000 characters')
        .optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent'])
        .optional(),
    status: zod_1.z.enum(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'])
        .optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
});
exports.updateTicketStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'])
        .describe('New status for the ticket'),
    resolution_summary: zod_1.z.string()
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
exports.createTicketReplySchema = zod_1.z.object({
    message: zod_1.z.string()
        .min(5, 'Message must be at least 5 characters')
        .max(3000, 'Message cannot exceed 3000 characters')
        .describe('Reply message content'),
    is_solution: zod_1.z.boolean()
        .default(false)
        .describe('Mark if this reply solves the issue'),
});
// =============== DOCUMENT UPLOAD ===============
exports.uploadTicketDocumentSchema = zod_1.z.object({
    document_type: zod_1.z.enum(['image', 'video', 'pdf', 'other'])
        .describe('Type of document being uploaded'),
    title: zod_1.z.string()
        .max(255, 'Title cannot exceed 255 characters')
        .optional()
        .describe('Document title'),
    description: zod_1.z.string()
        .max(1000, 'Description cannot exceed 1000 characters')
        .optional()
        .describe('Document description'),
    // File metadata (these will be set by the file upload handler)
    file_url: zod_1.z.string().optional(),
    file_name: zod_1.z.string().optional(),
    file_size: zod_1.z.number().optional(),
    file_mime_type: zod_1.z.string().optional(),
});
exports.uploadTicketReplyDocumentSchema = zod_1.z.object({
    document_type: zod_1.z.enum(['image', 'video', 'pdf', 'other'])
        .describe('Type of document being uploaded'),
    file_url: zod_1.z.string().optional(),
    file_name: zod_1.z.string().optional(),
    file_size: zod_1.z.number().optional(),
    file_mime_type: zod_1.z.string().optional(),
});
// =============== QUERY FILTERS ===============
exports.getTicketsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened'])
        .optional()
        .describe('Filter by ticket status'),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent'])
        .optional()
        .describe('Filter by priority'),
    category: zod_1.z.enum(['defect', 'maintenance', 'warranty', 'performance', 'billing', 'installation', 'account_issue', 'general_inquiry', 'complaint', 'other'])
        .optional()
        .describe('Filter by category'),
    ticket_type: zod_1.z.enum(['project_support', 'admin_support'])
        .optional()
        .describe('Filter by ticket type'),
    page: zod_1.z.coerce.number()
        .int('Page must be an integer')
        .positive('Page must be positive')
        .default(1)
        .describe('Page number for pagination'),
    limit: zod_1.z.coerce.number()
        .int('Limit must be an integer')
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
        .default(10)
        .describe('Number of items per page'),
    sort: zod_1.z.enum(['created_at', 'updated_at', 'priority', 'status'])
        .default('created_at')
        .describe('Sort field'),
    order: zod_1.z.enum(['asc', 'desc'])
        .default('desc')
        .describe('Sort order'),
}).strict();
