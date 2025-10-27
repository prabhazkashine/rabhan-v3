"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ticket_controller_1 = require("../controllers/ticket.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const ticket_schemas_1 = require("../validation/ticket-schemas");
const error_handler_1 = require("../middleware/error-handler");
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const multer_config_1 = require("../config/multer.config");
const router = (0, express_1.Router)();
const ticketIdParamSchema = zod_1.z.object({
    ticketId: zod_1.z.string().uuid('Invalid ticket ID format')
});
// ============ TICKET CREATION & MANAGEMENT ============
/**
 * POST /api/tickets
 * Create a new support ticket
 * Requires: user role, project_id (from completed project)
 */
router.post('/', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateRequest)(ticket_schemas_1.createTicketSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.createTicket(req, res);
}));
/**
 * GET /api/tickets
 * Get all tickets for the authenticated user (if user) or contractor (if contractor)
 */
router.get('/', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateQuery)(ticket_schemas_1.getTicketsQuerySchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    if (req.headers['x-user-role'] === 'contractor') {
        await ticket_controller_1.ticketController.getContractorTickets(req, res);
    }
    else {
        await ticket_controller_1.ticketController.getUserTickets(req, res);
    }
}));
// ============ ADMIN TICKET ROUTES (MUST COME BEFORE DYNAMIC ROUTES) ============
/**
 * POST /api/tickets/admin
 * Create a new admin support ticket (User/Contractor -> Admin/SuperAdmin)
 * Any authenticated user or contractor can create an admin ticket
 */
router.post('/admin', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateRequest)(ticket_schemas_1.createAdminTicketSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.createAdminTicket(req, res);
}));
/**
 * GET /api/tickets/admin
 * Get all admin support tickets
 * Only accessible by admin and super_admin roles
 */
router.get('/admin', auth_middleware_1.authMiddleware.authenticate, auth_middleware_1.authMiddleware.authorizeRole(['admin', 'super_admin']), (0, validation_middleware_1.validateQuery)(ticket_schemas_1.getTicketsQuerySchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.getAdminTickets(req, res);
}));
/**
 * GET /api/tickets/my-admin-tickets
 * Get user's own admin tickets (tickets they created to admin)
 * Accessible by any authenticated user
 */
router.get('/my-admin-tickets', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateQuery)(ticket_schemas_1.getTicketsQuerySchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.getUserAdminTickets(req, res);
}));
/**
 * GET /api/tickets/contractor
 * Get all tickets for a contractor
 */
router.get('/contractor', auth_middleware_1.authMiddleware.authenticate, auth_middleware_1.authMiddleware.authorizeRole(['contractor']), (0, validation_middleware_1.validateQuery)(ticket_schemas_1.getTicketsQuerySchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.getContractorTickets(req, res);
}));
// ============ DYNAMIC ROUTES (MUST COME AFTER SPECIFIC ROUTES) ============
/**
 * GET /api/tickets/:ticketId
 * Get a specific ticket by ID
 */
router.get('/:ticketId', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.getTicketById(req, res);
}));
/**
 * PUT /api/tickets/:ticketId
 * Update ticket details (title, description, priority)
 */
router.put('/:ticketId', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, validation_middleware_1.validateRequest)(ticket_schemas_1.updateTicketSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.updateTicket(req, res);
}));
/**
 * PATCH /api/tickets/:ticketId/status
 * Update ticket status (open, in_progress, resolved, closed, etc.)
 */
router.patch('/:ticketId/status', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, validation_middleware_1.validateRequest)(ticket_schemas_1.updateTicketStatusSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.updateTicketStatus(req, res);
}));
// ============ TICKET REPLIES ============
/**
 * POST /api/tickets/:ticketId/replies
 * Add a reply to a ticket
 */
router.post('/:ticketId/replies', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, validation_middleware_1.validateRequest)(ticket_schemas_1.createTicketReplySchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.addReply(req, res);
}));
/**
 * GET /api/tickets/:ticketId/replies
 * Get all replies for a ticket
 */
router.get('/:ticketId/replies', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.getTicketReplies(req, res);
}));
// ============ TICKET TIMELINE ============
/**
 * GET /api/tickets/:ticketId/timeline
 * Get full timeline/audit trail for a ticket
 * Shows all events: creation, replies, status changes, resolutions
 */
router.get('/:ticketId/timeline', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.getTicketTimeline(req, res);
}));
// ============ TICKET DOCUMENTS ============
/**
 * POST /api/tickets/:ticketId/documents
 * Upload documents to a ticket (images and PDFs only, max 3 files, 5MB each)
 * Uses multipart/form-data with field name "documents"
 */
router.post('/:ticketId/documents', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (req, res, next) => {
    (0, multer_config_1.uploadTicketDocuments)(req, res, (err) => {
        if (err) {
            const errorMessage = (0, multer_config_1.handleMulterError)(err);
            logger_1.logger.error('File upload error:', { error: errorMessage });
            return res.status(400).json({
                success: false,
                message: errorMessage
            });
        }
        next();
    });
}, (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.addTicketDocument(req, res);
}));
/**
 * GET /api/tickets/:ticketId/documents
 * Get all documents for a ticket
 */
router.get('/:ticketId/documents', auth_middleware_1.authMiddleware.authenticate, (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.getTicketDocuments(req, res);
}));
/**
 * PATCH /api/tickets/:ticketId/assign-admin
 * Assign an admin ticket to an admin/super_admin
 * Only accessible by admin and super_admin roles
 */
router.patch('/:ticketId/assign-admin', auth_middleware_1.authMiddleware.authenticate, auth_middleware_1.authMiddleware.authorizeRole(['admin', 'super_admin']), (0, validation_middleware_1.validateParams)(ticketIdParamSchema), (0, error_handler_1.asyncHandler)(async (req, res) => {
    await ticket_controller_1.ticketController.assignAdminTicket(req, res);
}));
exports.default = router;
