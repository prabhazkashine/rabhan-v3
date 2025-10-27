import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
export declare class TicketController {
    /**
     * Create a new support ticket for a completed project
     * POST /api/tickets
     * Validates project exists and automatically retrieves contractor_id from project
     */
    createTicket(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get all tickets for the authenticated user
     * GET /api/tickets
     */
    getUserTickets(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get all tickets assigned to the contractor
     * GET /api/tickets/contractor
     */
    getContractorTickets(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get a specific ticket by ID
     * GET /api/tickets/:ticketId
     * Access control:
     * - User can view their own tickets
     * - Contractor can view tickets assigned to them
     * - Admin can view admin tickets assigned to them
     * - Super admin can view all admin tickets
     */
    getTicketById(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update ticket details
     * PUT /api/tickets/:ticketId
     */
    updateTicket(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update ticket status (open, in_progress, resolved, closed, etc.)
     * PATCH /api/tickets/:ticketId/status
     */
    updateTicketStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Add a reply to a ticket
     * POST /api/tickets/:ticketId/replies
     */
    addReply(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get all replies for a ticket
     * GET /api/tickets/:ticketId/replies
     */
    getTicketReplies(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get timeline for a ticket
     * GET /api/tickets/:ticketId/timeline
     */
    getTicketTimeline(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Add documents to a ticket (handles file uploads)
     * POST /api/tickets/:ticketId/documents
     * Accepts multiple files (up to 3) via multipart/form-data
     */
    addTicketDocument(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get all documents for a ticket
     * GET /api/tickets/:ticketId/documents
     */
    getTicketDocuments(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Create a new admin support ticket (User/Contractor -> Admin/SuperAdmin)
     * POST /api/tickets/admin
     * Admin tickets are created unassigned (admin_id = null)
     * Super admin will assign them later if needed
     */
    createAdminTicket(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get all admin tickets (for admin/super_admin)
     * GET /api/tickets/admin
     * - Super admins see ALL admin tickets
     * - Regular admins see tickets assigned to them + unassigned tickets
     */
    getAdminTickets(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Assign admin ticket to an admin
     * PATCH /api/tickets/:ticketId/assign-admin
     * Only super_admin can assign tickets to admins
     */
    assignAdminTicket(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get user's admin tickets (tickets they created to admin)
     * GET /api/tickets/my-admin-tickets
     */
    getUserAdminTickets(req: AuthenticatedRequest, res: Response): Promise<void>;
}
export declare const ticketController: TicketController;
