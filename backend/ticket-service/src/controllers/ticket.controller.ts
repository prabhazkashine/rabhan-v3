import { Response } from 'express';
import { ticketService } from '../services/ticket.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  CreateTicketRequest,
  CreateAdminTicketRequest,
  UpdateTicketRequest,
  UpdateTicketStatusRequest,
  CreateTicketReplyRequest,
  GetTicketsQuery,
} from '../validation/ticket-schemas';

export class TicketController {
  // ============ USER ENDPOINTS ============

  /**
   * Create a new support ticket for a completed project
   * POST /api/tickets
   * Validates project exists and automatically retrieves contractor_id from project
   */
  async createTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (req.headers['x-user-role'] !== 'user') {
        throw new AppError('Only user can create a ticket', 400);
      }

      const data = req.body as CreateTicketRequest;

      const authHeader = req.headers.authorization;
      const authToken = authHeader?.split(' ')[1] || '';

      if (!authToken) {
        throw new AppError('Authentication token is required', 401);
      }

      const ticket = await ticketService.createTicket(
        data,
        req.user.id,
        authToken
      );

      logger.info('Ticket created via API', {
        ticket_id: ticket.id,
        user_id: req.user.id,
        project_id: ticket.project_id,
        contractor_id: ticket.contractor_id
      });

      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        data: ticket
      });
    } catch (error) {
      logger.error('Error in createTicket controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get all tickets for the authenticated user
   * GET /api/tickets
   */
  async getUserTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const filters = (req as any).validatedQuery as GetTicketsQuery;

      const result = await ticketService.getUserTickets(req.user.id, filters);

      res.status(200).json({
        success: true,
        message: 'Tickets retrieved successfully',
        data: result.tickets,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      logger.error('Error in getUserTickets controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // ============ CONTRACTOR ENDPOINTS ============

  /**
   * Get all tickets assigned to the contractor
   * GET /api/tickets/contractor
   */
  async getContractorTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const filters = (req as any).validatedQuery as GetTicketsQuery;

      const result = await ticketService.getContractorTickets(req.user.id, filters);

      res.status(200).json({
        success: true,
        message: 'Tickets retrieved successfully',
        data: result.tickets,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      logger.error('Error in getContractorTickets controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contractorId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // ============ GENERAL ENDPOINTS ============

  /**
   * Get a specific ticket by ID
   * GET /api/tickets/:ticketId
   * Access control:
   * - User can view their own tickets
   * - Contractor can view tickets assigned to them
   * - Admin can view admin tickets assigned to them
   * - Super admin can view all admin tickets
   */
  async getTicketById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const ticket = await ticketService.getTicketById(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
        return;
      }

      let hasAccess = false;

      if (req.user.role === 'super_admin') {
        hasAccess = true;
      } else if (req.user.role === 'admin') {
        if (ticket.ticket_type === 'admin_support' && ticket.admin_id === req.user.id) {
          hasAccess = true;
        }
      } else if (req.user.role === 'user') {
        if (ticket.user_id === req.user.id) {
          hasAccess = true;
        }
      } else if (req.user.role === 'contractor') {
        // Contractor can view project_support tickets assigned to them
        // OR admin_support tickets they created
        if (
          (ticket.ticket_type === 'project_support' && ticket.contractor_id === req.user.id) ||
          (ticket.ticket_type === 'admin_support' && ticket.user_id === req.user.id)
        ) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to view this ticket'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Ticket retrieved successfully',
        data: ticket
      });
    } catch (error) {
      logger.error('Error in getTicketById controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update ticket details
   * PUT /api/tickets/:ticketId
   */
  async updateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { ticketId } = req.params;
      const data = req.body as UpdateTicketRequest;

      const updatedTicket = await ticketService.updateTicket(
        ticketId,
        data,
        req.user.id,
        req.user.role
      );

      res.status(200).json({
        success: true,
        message: 'Ticket updated successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error('Error in updateTicket controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Update ticket status (open, in_progress, resolved, closed, etc.)
   * PATCH /api/tickets/:ticketId/status
   */
  async updateTicketStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { ticketId } = req.params;
      const data = req.body as UpdateTicketStatusRequest;

      const updatedTicket = await ticketService.updateTicketStatus(
        ticketId,
        data,
        req.user.id,
        req.user.role
      );

      res.status(200).json({
        success: true,
        message: 'Ticket status updated successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error('Error in updateTicketStatus controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  // ============ REPLY ENDPOINTS ============

  /**
   * Add a reply to a ticket
   * POST /api/tickets/:ticketId/replies
   */
  async addReply(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { ticketId } = req.params;
      const data = req.body as CreateTicketReplyRequest;

      const reply = await ticketService.addReply(
        ticketId,
        data,
        req.user.id,
        req.user.role
      );

      res.status(201).json({
        success: true,
        message: 'Reply added successfully',
        data: reply
      });
    } catch (error) {
      logger.error('Error in addReply controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get all replies for a ticket
   * GET /api/tickets/:ticketId/replies
   */
  async getTicketReplies(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;

      const replies = await ticketService.getTicketReplies(ticketId);

      res.status(200).json({
        success: true,
        message: 'Replies retrieved successfully',
        data: replies
      });
    } catch (error) {
      logger.error('Error in getTicketReplies controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // ============ TIMELINE ENDPOINTS ============

  /**
   * Get timeline for a ticket
   * GET /api/tickets/:ticketId/timeline
   */
  async getTicketTimeline(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;

      const timeline = await ticketService.getTicketTimeline(ticketId);

      res.status(200).json({
        success: true,
        message: 'Timeline retrieved successfully',
        data: timeline
      });
    } catch (error) {
      logger.error('Error in getTicketTimeline controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // ============ DOCUMENT ENDPOINTS ============

  /**
   * Add documents to a ticket (handles file uploads)
   * POST /api/tickets/:ticketId/documents
   * Accepts multiple files (up to 3) via multipart/form-data
   */
  async addTicketDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { ticketId } = req.params;
      const files = req.files as Express.Multer.File[];

      // Check if files were uploaded
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded. Please select at least one file.'
        });
        return;
      }

      // Process and save each uploaded file
      const uploadedDocuments = [];
      for (const file of files) {
        const documentData = {
          document_type: file.mimetype.startsWith('image/') ? 'image' : 'pdf',
          file_url: `/uploads/tickets/${file.filename}`,
          file_name: file.originalname,
          file_size: file.size,
          file_mime_type: file.mimetype,
          title: req.body.title || file.originalname,
          description: req.body.description || undefined,
        };

        const document = await ticketService.addTicketDocument(
          ticketId,
          documentData,
          req.user.id,
          req.user.role
        );

        uploadedDocuments.push(document);
      }

      logger.info('Documents uploaded successfully', {
        ticket_id: ticketId,
        user_id: req.user.id,
        file_count: uploadedDocuments.length
      });

      res.status(201).json({
        success: true,
        message: `${uploadedDocuments.length} document(s) uploaded successfully`,
        data: uploadedDocuments
      });
    } catch (error) {
      logger.error('Error in addTicketDocument controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get all documents for a ticket
   * GET /api/tickets/:ticketId/documents
   */
  async getTicketDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;

      const documents = await ticketService.getTicketDocuments(ticketId);

      res.status(200).json({
        success: true,
        message: 'Documents retrieved successfully',
        data: documents
      });
    } catch (error) {
      logger.error('Error in getTicketDocuments controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // ============ ADMIN TICKET ENDPOINTS ============

  /**
   * Create a new admin support ticket (User/Contractor -> Admin/SuperAdmin)
   * POST /api/tickets/admin
   * Admin tickets are created unassigned (admin_id = null)
   * Super admin will assign them later if needed
   */
  async createAdminTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const data = req.body as CreateAdminTicketRequest;

      const ticket = await ticketService.createAdminTicket(
        data,
        req.user.id,
        req.user.role
      );

      logger.info('Admin ticket created via API', {
        ticket_id: ticket.id,
        user_id: req.user.id,
        user_role: req.user.role
      });

      res.status(201).json({
        success: true,
        message: 'Admin ticket created successfully',
        data: ticket
      });
    } catch (error) {
      logger.error('Error in createAdminTicket controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get all admin tickets (for admin/super_admin)
   * GET /api/tickets/admin
   * - Super admins see ALL admin tickets
   * - Regular admins see tickets assigned to them + unassigned tickets
   */
  async getAdminTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!['admin', 'super_admin'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Only admins can access admin tickets'
        });
        return;
      }

      const filters = (req as any).validatedQuery as GetTicketsQuery;

      const result = await ticketService.getAdminTickets(
        req.user.id,
        req.user.role,
        filters
      );

      res.status(200).json({
        success: true,
        message: 'Admin tickets retrieved successfully',
        data: result.tickets,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      logger.error('Error in getAdminTickets controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Assign admin ticket to an admin
   * PATCH /api/tickets/:ticketId/assign-admin
   * Only super_admin can assign tickets to admins
   */
  async assignAdminTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (req.user.role !== 'super_admin') {
        res.status(403).json({
          success: false,
          message: 'Only super admin can assign tickets'
        });
        return;
      }

      const { ticketId } = req.params;
      const { admin_id } = req.body;

      if (!admin_id) {
        res.status(400).json({
          success: false,
          message: 'admin_id is required'
        });
        return;
      }

      const updatedTicket = await ticketService.assignAdminTicket(
        ticketId,
        admin_id,
        req.user.id,
        req.user.role
      );

      res.status(200).json({
        success: true,
        message: 'Ticket assigned successfully',
        data: updatedTicket
      });
    } catch (error) {
      logger.error('Error in assignAdminTicket controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId: req.params.ticketId,
        userId: req.user?.id
      });

      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get user's admin tickets (tickets they created to admin)
   * GET /api/tickets/my-admin-tickets
   */
  async getUserAdminTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const filters = (req as any).validatedQuery as GetTicketsQuery;

      const result = await ticketService.getUserTickets(req.user.id, {
        ...filters,
        ticket_type: 'admin_support' as any
      });

      res.status(200).json({
        success: true,
        message: 'Your admin tickets retrieved successfully',
        data: result.tickets,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      logger.error('Error in getUserAdminTickets controller:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export const ticketController = new TicketController();
