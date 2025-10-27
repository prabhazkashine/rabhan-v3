import { Ticket, TicketReply, TicketStatus, TicketTimeline } from '../generated/prisma';
import { CreateTicketRequest, CreateAdminTicketRequest, UpdateTicketRequest, UpdateTicketStatusRequest, CreateTicketReplyRequest } from '../validation/ticket-schemas';
export declare class TicketService {
    /**
     * Create a new support ticket for a completed project
     * Validates project exists and is completed before creating ticket
     * Automatically retrieves contractor_id from the project
     */
    createTicket(data: CreateTicketRequest, userId: string, authToken: string): Promise<Ticket>;
    /**
     * Create a new admin support ticket (User/Contractor -> Admin/SuperAdmin)
     * Admin tickets are always created unassigned (admin_id = null)
     * Super admin will assign them later if needed
     */
    createAdminTicket(data: CreateAdminTicketRequest, userId: string, userRole: string): Promise<Ticket>;
    /**
     * Get all admin tickets for admins/super_admins
     * - Super admins see ALL admin_support tickets
     * - Regular admins see tickets assigned to them + unassigned tickets
     */
    getAdminTickets(adminId: string | null, userRole: string, filters?: {
        status?: TicketStatus;
        priority?: string;
        category?: string;
        page?: number;
        limit?: number;
        sort?: string;
        order?: 'asc' | 'desc';
    }): Promise<{
        tickets: Ticket[];
        total: number;
        page: number;
        limit: number;
    }>;
    /**
     * Assign an admin ticket to an admin
     * Only super_admin can assign tickets
     */
    assignAdminTicket(ticketId: string, adminId: string, assignedById: string, assignedByRole: string): Promise<Ticket>;
    /**
     * Get all tickets for a user (consumer)
     */
    getUserTickets(userId: string, filters?: {
        status?: TicketStatus;
        priority?: string;
        category?: string;
        ticket_type?: string;
        page?: number;
        limit?: number;
        sort?: string;
        order?: 'asc' | 'desc';
    }): Promise<{
        tickets: Ticket[];
        total: number;
        page: number;
        limit: number;
    }>;
    /**
     * Get all tickets for a contractor
     * Includes: project_support tickets assigned to contractor + admin_support tickets created by contractor
     */
    getContractorTickets(contractorId: string, filters?: {
        status?: TicketStatus;
        priority?: string;
        category?: string;
        ticket_type?: string;
        page?: number;
        limit?: number;
        sort?: string;
        order?: 'asc' | 'desc';
    }): Promise<{
        tickets: Ticket[];
        total: number;
        page: number;
        limit: number;
    }>;
    /**
     * Get a specific ticket by ID
     */
    getTicketById(ticketId: string): Promise<Ticket | null>;
    /**
     * Update ticket details
     */
    updateTicket(ticketId: string, data: UpdateTicketRequest, userId: string, userRole: string): Promise<Ticket>;
    /**
     * Update ticket status
     * Rules:
     * - Project tickets: Only user can mark as resolved
     * - Admin tickets: User, admin (assigned), or super_admin can mark as resolved
     */
    updateTicketStatus(ticketId: string, data: UpdateTicketStatusRequest, userId: string, userRole: string): Promise<Ticket>;
    /**
     * Add a reply to a ticket
     * Supports: user, contractor, admin, super_admin
     */
    addReply(ticketId: string, data: CreateTicketReplyRequest, userId: string, userRole: string): Promise<TicketReply>;
    /**
     * Get all replies for a ticket
     */
    getTicketReplies(ticketId: string): Promise<TicketReply[]>;
    /**
     * Create a timeline entry for a ticket
     */
    createTimelineEntry(ticketId: string, data: {
        event_type: string;
        title: string;
        description: string;
        created_by_id: string;
        created_by_role: string;
        created_by_name?: string;
        metadata?: any;
    }): Promise<TicketTimeline>;
    /**
     * Get timeline for a ticket
     */
    getTicketTimeline(ticketId: string): Promise<TicketTimeline[]>;
    /**
     * Add a document to a ticket
     */
    addTicketDocument(ticketId: string, documentData: {
        document_type: string;
        file_url: string;
        file_name: string;
        file_size?: number;
        file_mime_type?: string;
        title?: string;
        description?: string;
    }, userId: string, userRole: string): Promise<{
        title: string | null;
        description: string | null;
        document_type: string;
        file_url: string;
        file_name: string;
        file_size: number | null;
        file_mime_type: string | null;
        created_at: Date;
        updated_at: Date;
        id: string;
        ticket_id: string;
        uploaded_by_id: string;
        uploaded_by_role: string;
        is_verified: boolean;
        verified_by: string | null;
        verified_at: Date | null;
    }>;
    /**
     * Get documents for a ticket
     */
    getTicketDocuments(ticketId: string): Promise<{
        title: string | null;
        description: string | null;
        document_type: string;
        file_url: string;
        file_name: string;
        file_size: number | null;
        file_mime_type: string | null;
        created_at: Date;
        updated_at: Date;
        id: string;
        ticket_id: string;
        uploaded_by_id: string;
        uploaded_by_role: string;
        is_verified: boolean;
        verified_by: string | null;
        verified_at: Date | null;
    }[]>;
}
export declare const ticketService: TicketService;
