import { z } from 'zod';
export declare const createTicketSchema: z.ZodObject<{
    project_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<{
        defect: "defect";
        maintenance: "maintenance";
        warranty: "warranty";
        performance: "performance";
        billing: "billing";
        installation: "installation";
        other: "other";
    }>;
    priority: z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>;
}, z.core.$strip>;
export declare const createAdminTicketSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<{
        defect: "defect";
        maintenance: "maintenance";
        warranty: "warranty";
        performance: "performance";
        billing: "billing";
        installation: "installation";
        other: "other";
        account_issue: "account_issue";
        general_inquiry: "general_inquiry";
        complaint: "complaint";
    }>;
    priority: z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>;
}, z.core.$strip>;
export declare const updateTicketSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        open: "open";
        in_progress: "in_progress";
        on_hold: "on_hold";
        resolved: "resolved";
        closed: "closed";
        reopened: "reopened";
    }>>;
}, z.core.$strip>;
export declare const updateTicketStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        open: "open";
        in_progress: "in_progress";
        on_hold: "on_hold";
        resolved: "resolved";
        closed: "closed";
        reopened: "reopened";
    }>;
    resolution_summary: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createTicketReplySchema: z.ZodObject<{
    message: z.ZodString;
    is_solution: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const uploadTicketDocumentSchema: z.ZodObject<{
    document_type: z.ZodEnum<{
        other: "other";
        image: "image";
        video: "video";
        pdf: "pdf";
    }>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    file_url: z.ZodOptional<z.ZodString>;
    file_name: z.ZodOptional<z.ZodString>;
    file_size: z.ZodOptional<z.ZodNumber>;
    file_mime_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const uploadTicketReplyDocumentSchema: z.ZodObject<{
    document_type: z.ZodEnum<{
        other: "other";
        image: "image";
        video: "video";
        pdf: "pdf";
    }>;
    file_url: z.ZodOptional<z.ZodString>;
    file_name: z.ZodOptional<z.ZodString>;
    file_size: z.ZodOptional<z.ZodNumber>;
    file_mime_type: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const getTicketsQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        open: "open";
        in_progress: "in_progress";
        on_hold: "on_hold";
        resolved: "resolved";
        closed: "closed";
        reopened: "reopened";
    }>>;
    priority: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        urgent: "urgent";
    }>>;
    category: z.ZodOptional<z.ZodEnum<{
        defect: "defect";
        maintenance: "maintenance";
        warranty: "warranty";
        performance: "performance";
        billing: "billing";
        installation: "installation";
        other: "other";
        account_issue: "account_issue";
        general_inquiry: "general_inquiry";
        complaint: "complaint";
    }>>;
    ticket_type: z.ZodOptional<z.ZodEnum<{
        project_support: "project_support";
        admin_support: "admin_support";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    sort: z.ZodDefault<z.ZodEnum<{
        priority: "priority";
        status: "status";
        created_at: "created_at";
        updated_at: "updated_at";
    }>>;
    order: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
}, z.core.$strict>;
export type CreateTicketRequest = z.infer<typeof createTicketSchema>;
export type CreateAdminTicketRequest = z.infer<typeof createAdminTicketSchema>;
export type UpdateTicketRequest = z.infer<typeof updateTicketSchema>;
export type UpdateTicketStatusRequest = z.infer<typeof updateTicketStatusSchema>;
export type CreateTicketReplyRequest = z.infer<typeof createTicketReplySchema>;
export type UploadTicketDocumentRequest = z.infer<typeof uploadTicketDocumentSchema>;
export type UploadTicketReplyDocumentRequest = z.infer<typeof uploadTicketReplyDocumentSchema>;
export type GetTicketsQuery = z.infer<typeof getTicketsQuerySchema>;
