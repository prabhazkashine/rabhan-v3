import { Router, Request, Response, NextFunction } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createTicketSchema,
  createAdminTicketSchema,
  updateTicketSchema,
  updateTicketStatusSchema,
  createTicketReplySchema,
  uploadTicketDocumentSchema,
  getTicketsQuerySchema,
} from '../validation/ticket-schemas';
import { asyncHandler } from '../middleware/error-handler';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { uploadTicketDocuments, handleMulterError } from '../config/multer.config';

const router = Router();

const ticketIdParamSchema = z.object({
  ticketId: z.string().uuid('Invalid ticket ID format')
});

// ============ TICKET CREATION & MANAGEMENT ============

/**
 * POST /api/tickets
 * Create a new support ticket
 * Requires: user role, project_id (from completed project)
 */
router.post('/',
  authMiddleware.authenticate,
  validateRequest(createTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.createTicket(req, res);
  })
);

/**
 * GET /api/tickets
 * Get all tickets for the authenticated user (if user) or contractor (if contractor)
 */
router.get('/',
  authMiddleware.authenticate,
  validateQuery(getTicketsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.headers['x-user-role'] === 'contractor') {
      await ticketController.getContractorTickets(req, res);
    } else {
      await ticketController.getUserTickets(req, res);
    }
  })
);

// ============ ADMIN TICKET ROUTES (MUST COME BEFORE DYNAMIC ROUTES) ============

/**
 * POST /api/tickets/admin
 * Create a new admin support ticket (User/Contractor -> Admin/SuperAdmin)
 * Any authenticated user or contractor can create an admin ticket
 */
router.post('/admin',
  authMiddleware.authenticate,
  validateRequest(createAdminTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.createAdminTicket(req, res);
  })
);

/**
 * GET /api/tickets/admin
 * Get all admin support tickets
 * Only accessible by admin and super_admin roles
 */
router.get('/admin',
  authMiddleware.authenticate,
  authMiddleware.authorizeRole(['admin', 'super_admin']),
  validateQuery(getTicketsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.getAdminTickets(req, res);
  })
);

/**
 * GET /api/tickets/my-admin-tickets
 * Get user's own admin tickets (tickets they created to admin)
 * Accessible by any authenticated user
 */
router.get('/my-admin-tickets',
  authMiddleware.authenticate,
  validateQuery(getTicketsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.getUserAdminTickets(req, res);
  })
);

/**
 * GET /api/tickets/contractor
 * Get all tickets for a contractor
 */
router.get('/contractor',
  authMiddleware.authenticate,
  authMiddleware.authorizeRole(['contractor']),
  validateQuery(getTicketsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.getContractorTickets(req, res);
  })
);

// ============ DYNAMIC ROUTES (MUST COME AFTER SPECIFIC ROUTES) ============

/**
 * GET /api/tickets/:ticketId
 * Get a specific ticket by ID
 */
router.get('/:ticketId',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.getTicketById(req, res);
  })
);

/**
 * PUT /api/tickets/:ticketId
 * Update ticket details (title, description, priority)
 */
router.put('/:ticketId',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  validateRequest(updateTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.updateTicket(req, res);
  })
);

/**
 * PATCH /api/tickets/:ticketId/status
 * Update ticket status (open, in_progress, resolved, closed, etc.)
 */
router.patch('/:ticketId/status',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  validateRequest(updateTicketStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.updateTicketStatus(req, res);
  })
);

// ============ TICKET REPLIES ============

/**
 * POST /api/tickets/:ticketId/replies
 * Add a reply to a ticket
 */
router.post('/:ticketId/replies',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  validateRequest(createTicketReplySchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.addReply(req, res);
  })
);

/**
 * GET /api/tickets/:ticketId/replies
 * Get all replies for a ticket
 */
router.get('/:ticketId/replies',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.getTicketReplies(req, res);
  })
);

// ============ TICKET TIMELINE ============

/**
 * GET /api/tickets/:ticketId/timeline
 * Get full timeline/audit trail for a ticket
 * Shows all events: creation, replies, status changes, resolutions
 */
router.get('/:ticketId/timeline',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.getTicketTimeline(req, res);
  })
);

// ============ TICKET DOCUMENTS ============

/**
 * POST /api/tickets/:ticketId/documents
 * Upload documents to a ticket (images and PDFs only, max 3 files, 5MB each)
 * Uses multipart/form-data with field name "documents"
 */
router.post('/:ticketId/documents',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    uploadTicketDocuments(req, res, (err: any) => {
      if (err) {
        const errorMessage = handleMulterError(err);
        logger.error('File upload error:', { error: errorMessage });
        return res.status(400).json({
          success: false,
          message: errorMessage
        });
      }
      next();
    });
  },
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.addTicketDocument(req, res);
  })
);

/**
 * GET /api/tickets/:ticketId/documents
 * Get all documents for a ticket
 */
router.get('/:ticketId/documents',
  authMiddleware.authenticate,
  validateParams(ticketIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.getTicketDocuments(req, res);
  })
);

/**
 * PATCH /api/tickets/:ticketId/assign-admin
 * Assign an admin ticket to an admin/super_admin
 * Only accessible by admin and super_admin roles
 */
router.patch('/:ticketId/assign-admin',
  authMiddleware.authenticate,
  authMiddleware.authorizeRole(['admin', 'super_admin']),
  validateParams(ticketIdParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await ticketController.assignAdminTicket(req, res);
  })
);

export default router;
