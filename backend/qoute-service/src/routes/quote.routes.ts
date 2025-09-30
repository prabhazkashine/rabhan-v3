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

// ------- ADMIN ROUTES ------

export default router;