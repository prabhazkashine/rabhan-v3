import { Router } from 'express';
import { quoteController } from '../controllers/quote.controller';
import { validateRequest } from '../middleware/validateRequest';
import { createQuoteRequestSchema } from '../types/quote.types';
import { submitQuoteSchema } from '../types/quote-submission.types';
import { submitDetailedQuotationSchema } from '../types/detailed-quotation.types';
import { getQuoteRequestsSchema } from '../types/assigned-requests.types';
import { validateBusinessConstraints } from '../middleware/businessConstraints';
import { contractorRespondSchema } from '../types/contractor-response.types';
import { getQuotesForRequestSchema } from '../types/get-quotes.types';
import { getUserQuoteRequestsSchema } from '../types/user-quote-requests.types';
import { getContractorQuotesSchema } from '../types/contractor-quotes.types';
import { getAdminQuotesSchema } from '../types/admin-quotes.types';
import { approveQuoteSchema, rejectQuoteSchema } from '../types/admin-quote-actions.types';

const router = Router();

// ------- USER ROUTES ------

router.post(
  '/request',
  validateRequest(createQuoteRequestSchema),
  quoteController.createQuoteRequest
);

router.get(
  '/request/:id',
  quoteController.getQuoteRequest
);

/**
 * @route   GET /api/quotes/my-requests
 * @desc    Get user's quote requests with pagination
 * @access  Private (Users only)
 */
router.get(
  '/my-requests',
  validateRequest(getUserQuoteRequestsSchema, 'query'),
  quoteController.getUserQuoteRequests
);

/**
 * @route   GET /api/quotes/available-contractors
 * @desc    Get available contractors for quote requests (only contractors who can login)
 * @access  Private (Users only)
 */
router.get(
  '/available-contractors',
  quoteController.getAvailableContractors
);



/**
 * @route   GET /api/quotes/request/:request_id/quotes
 * @desc    Get quotes for a specific request
 * @access  Private (Users, Admins)
 */
router.get(
  '/request/:request_id/quotes',
  validateRequest(getQuotesForRequestSchema, 'query'),
  quoteController.getQuotesForRequest
);


// ------- CONTRACTORS ROUTES ------

/**
 * @route   POST /api/quotes/submit
 * @desc    Submit a quote for a request
 * @access  Private (Contractors only)
 */
router.post(
  '/submit',
  validateRequest(submitQuoteSchema),
  validateBusinessConstraints.pricePerKwp,
  quoteController.submitQuote
);

/**
 * @route   POST /api/quotes/contractor/submit-detailed-quotation
 * @desc    Submit detailed quotation with line items
 * @access  Private (Contractors only)
 */
router.post(
  '/contractor/submit-detailed-quotation',
  validateRequest(submitDetailedQuotationSchema),
  quoteController.submitDetailedQuotation
);

/**
 * @route   GET /api/quotes/contractor/assigned-requests
 * @desc    Get assigned quote requests for contractor
 * @access  Private (Contractors only)
 */
router.get(
  '/contractor/assigned-requests',
  validateRequest(getQuoteRequestsSchema, 'query'),
  quoteController.getContractorAssignedRequests
);

/**
 * @route   POST /api/quotes/contractor/respond/:request_id
 * @desc    Contractor respond to quote request assignment (accept or reject)
 * @access  Private (Contractors only)
 */
router.post(
  '/contractor/respond/:request_id',
  validateRequest(contractorRespondSchema),
  quoteController.contractorRespondToRequest
);

/**
 * @route   GET /api/quotes/contractor/my-quotes
 * @desc    Get contractor's submitted quotes with pagination
 * @access  Private (Contractors only)
 */
router.get(
  '/contractor/my-quotes',
  validateRequest(getContractorQuotesSchema, 'query'),
  quoteController.getContractorQuotes
);

/**
 * @route   GET /api/quotes/contractor/availability-settings
 * @desc    Get contractor's availability settings
 * @access  Private (Contractors only)
 */
router.get(
  '/contractor/availability-settings',
  quoteController.getAvailabilitySettings
);

/**
 * @route   PUT /api/quotes/contractor/weekly-schedule
 * @desc    Update contractor's weekly schedule
 * @access  Private (Contractors only)
 */
router.put(
  '/contractor/weekly-schedule',
  quoteController.updateWeeklySchedule
);

/**
 * @route   GET /api/quotes/contractor/:contractor_id/availability
 * @desc    Get availability status for a specific contractor (public for users)
 * @access  Private (All authenticated users)
 */
router.get(
  '/contractor/:contractor_id/availability',
  quoteController.getContractorAvailability
);

/**
 * @route   GET /api/quotes/contractor/:contractor_id/available-slots?date=YYYY-MM-DD
 * @desc    Get available time slots for a contractor on a specific date with booked slots excluded
 * @access  Private (All authenticated users)
 */
router.get(
  '/contractor/:contractor_id/available-slots',
  quoteController.getAvailableTimeSlots
);

// ------- ADMIN ROUTES ------

/**
 * @route   GET /api/quotes/admin/all-quotes
 * @desc    Get all quotes with filters for admin dashboard
 * @access  Private (Admin, Super Admin only)
 */
router.get(
  '/admin/all-quotes',
  validateRequest(getAdminQuotesSchema, 'query'),
  quoteController.getAllQuotes
);

/**
 * @route   GET /api/quotes/admin/quote/:quoteId
 * @desc    Get individual quote details by ID
 * @access  Private (Admin, Super Admin only)
 */
router.get(
  '/admin/quote/:quoteId',
  quoteController.getQuoteDetails
);

/**
 * @route   GET /api/quotes/admin/:quoteId/assignments
 * @desc    Get contractor assignments for a quote
 * @access  Private (Admin, Super Admin only)
 */
router.get(
  '/admin/:quoteId/assignments',
  quoteController.getQuoteAssignments
);

/**
 * @route   GET /api/quotes/admin/:quoteId/contractor-quotes
 * @desc    Get contractor quotes for a specific request
 * @access  Private (Admin, Super Admin only)
 */
router.get(
  '/admin/:quoteId/contractor-quotes',
  quoteController.getContractorQuotesForRequest
);

/**
 * @route   PUT /api/quotes/admin/contractor-quotes/:quoteId/approve
 * @desc    Approve contractor quote
 * @access  Private (Admin, Super Admin only)
 */
router.put(
  '/admin/contractor-quotes/:quoteId/approve',
  validateRequest(approveQuoteSchema),
  quoteController.approveQuote
);

/**
 * @route   PUT /api/quotes/admin/contractor-quotes/:quoteId/reject
 * @desc    Reject contractor quote
 * @access  Private (Admin, Super Admin only)
 */
router.put(
  '/admin/contractor-quotes/:quoteId/reject',
  validateRequest(rejectQuoteSchema),
  quoteController.rejectQuote
);

export default router;