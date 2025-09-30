import { Request, Response } from 'express';
import { quoteService } from '../services/quote.service';
import { validateUserId, requireRole } from '../utils/validation';
import { logger, performanceLogger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { CreateQuoteRequestDTO } from '../types/quote.types';
import { ContractorFilters } from '../types/contractor.types';
import { SubmitQuoteDTO } from '../types/quote-submission.types';
import { SubmitDetailedQuotationDTO } from '../types/detailed-quotation.types';
import { AssignedRequestFilters } from '../types/assigned-requests.types';
import { ContractorRespondDTO } from '../types/contractor-response.types';
import { GetQuotesForRequestFilters } from '../types/get-quotes.types';
import { GetUserQuoteRequestsFilters } from '../types/user-quote-requests.types';
import { GetContractorQuotesFilters } from '../types/contractor-quotes.types';

export class QuoteController {
  /**
   * @route   POST /api/quotes/request
   * @desc    Create a new quote request
   * @access  Private (Users only)
   */
  createQuoteRequest = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_create_quote_request');

    try {
      // Validate user ID from header
      const userId = validateUserId(req);

      // Validate user role (only users can create quote requests)
      requireRole(req, ['user']);

      // Create quote request
      const quoteRequest = await quoteService.createQuoteRequest(
        userId,
        req.body as CreateQuoteRequestDTO
      );

      res.status(201).json({
        success: true,
        message: 'Quote request created successfully',
        data: {
          quote_request: quoteRequest,
        },
      });

      logger.info('Quote request created via API', {
        user_id: userId,
        request_id: quoteRequest.id,
      });
    } catch (error) {
      logger.error('Create quote request API error', {
        user_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ user_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/quotes/request/:id
   * @desc    Get quote request by ID
   * @access  Private
   */
  getQuoteRequest = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_quote_request');

    try {
      // Validate user ID from header
      const userId = validateUserId(req);
      const { id } = req.params;

      const quoteRequest = await quoteService.getQuoteRequestById(id);

      if (!quoteRequest) {
        return res.status(404).json({
          success: false,
          message: 'Quote request not found',
        });
      }

      // Check if user has access to this quote request
      const userRole = req.headers['x-user-role'] as string;
      if (userRole === 'user' && quoteRequest.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.status(200).json({
        success: true,
        data: {
          quote_request: quoteRequest,
        },
      });

      logger.info('Quote request retrieved via API', {
        user_id: userId,
        request_id: id,
      });
    } catch (error) {
      logger.error('Get quote request API error', {
        user_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ user_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/quotes/my-requests
   * @desc    Get all quote requests for the authenticated user with pagination
   * @access  Private (Users only)
   */
  getUserQuoteRequests = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_user_quote_requests');

    try {
      // Validate user ID from header
      const userId = validateUserId(req);

      // Validate user role (only users can get their own requests)
      requireRole(req, ['user']);

      const filters: GetUserQuoteRequestsFilters = {
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as any) || 'desc',
      };

      const result = await quoteService.getUserQuoteRequests(userId, filters);

      res.json({
        success: true,
        message: 'Quote requests retrieved successfully',
        data: {
          requests: result.requests,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            pages: Math.ceil(result.total / result.limit),
          },
        },
      });

      logger.info('User quote requests retrieved via API', {
        user_id: userId,
        page: filters.page,
        count: result.requests.length,
        total: result.total,
      });
    } catch (error) {
      logger.error('Get user quote requests API error', {
        user_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ user_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/quotes/available-contractors
   * @desc    Get available contractors for quote requests (only contractors who can login)
   * @access  Private (Users only)
   */
  getAvailableContractors = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_available_contractors');

    try {
      const userId = validateUserId(req);

      const filters: ContractorFilters = {
        region: req.query.region as string,
        city: req.query.city as string,
        min_rating: req.query.min_rating ? parseFloat(req.query.min_rating as string) : undefined,
        verification_level: req.query.verification_level
          ? parseInt(req.query.verification_level as string)
          : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sort_by: (req.query.sort_by as string) || 'average_rating',
        sort_order: ((req.query.sort_order as string) || 'desc') as 'asc' | 'desc',
      };

      const contractors = await quoteService.getAvailableContractors(filters);

      res.json({
        success: true,
        message: 'Available contractors retrieved successfully',
        data: {
          contractors: contractors,
          total: contractors.length,
        },
      });

      logger.info('Available contractors retrieved via API', {
        user_id: userId,
        total: contractors.length,
        filters,
      });
    } catch (error) {
      logger.error('Failed to get available contractors', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        user_id: req.headers['x-user-id'],
        filters: req.query,
      });
      throw error;
    } finally {
      timer.end({ user_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   POST /api/quotes/submit
   * @desc    Submit a quote for a request
   * @access  Private (Contractors only)
   */
  submitQuote = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_submit_quote');

    try {
      // Validate contractor ID from header
      const contractorId = validateUserId(req);

      // Validate contractor role (only contractors can submit quotes)
      requireRole(req, ['contractor']);

      const quote = await quoteService.submitQuote(contractorId, req.body as SubmitQuoteDTO);

      res.status(201).json({
        success: true,
        message: 'Quote submitted successfully',
        data: {
          quote: quote,
        },
      });

      logger.info('Quote submitted via API', {
        contractor_id: contractorId,
        quote_id: quote.id,
        request_id: quote.request_id,
      });
    } catch (error) {
      logger.error('Submit quote API error', {
        contractor_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   POST /api/quotes/contractor/submit-detailed-quotation
   * @desc    Submit detailed quotation with line items
   * @access  Private (Contractors only)
   */
  submitDetailedQuotation = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_submit_detailed_quotation');

    try {
      // Validate contractor ID from header
      const contractorId = validateUserId(req);

      // Validate contractor role
      requireRole(req, ['contractor']);

      const quotationData = req.body as SubmitDetailedQuotationDTO;

      const quotation = await quoteService.submitDetailedQuotation(contractorId, quotationData);

      res.status(201).json({
        success: true,
        message: 'Detailed quotation submitted successfully',
        data: {
          quotation: quotation,
          status: 'pending_admin_approval',
          next_steps: [
            'Wait for admin review and approval',
            'You will be notified once the quotation is reviewed',
          ],
        },
      });

      logger.info('Detailed quotation submitted via API', {
        contractor_id: contractorId,
        quotation_id: quotation.id,
        request_id: quotation.request_id,
        line_items_count: quotation.line_items?.length || 0,
      });
    } catch (error) {
      logger.error('Submit detailed quotation API error', {
        contractor_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/quotes/contractor/assigned-requests
   * @desc    Get assigned quote requests for contractor
   * @access  Private (Contractors only)
   */
  getContractorAssignedRequests = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_contractor_assigned_requests');

    try {
      // Validate contractor ID from header
      const contractorId = validateUserId(req);

      // Validate contractor role
      requireRole(req, ['contractor']);

      const filters: AssignedRequestFilters = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        status: req.query.status as string,
        sort_by: (req.query.sort_by as string) || 'assigned_at',
        sort_order: (req.query.sort_order as string) || 'desc',
      };

      const result = await quoteService.getContractorAssignedRequests(contractorId, filters);

      res.json({
        success: true,
        message: 'Assigned quote requests retrieved successfully',
        data: {
          assigned_requests: result.assignments,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            pages: Math.ceil(result.total / result.limit),
          },
          contractor_id: contractorId,
        },
      });

      logger.info('Contractor assigned requests retrieved via API', {
        contractor_id: contractorId,
        page: filters.page,
        limit: filters.limit,
        total_found: result.assignments.length,
      });
    } catch (error) {
      logger.error('Get contractor assigned requests API error', {
        contractor_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   POST /api/quotes/contractor/respond/:request_id
   * @desc    Contractor respond to quote request assignment (accept or reject)
   * @access  Private (Contractors only)
   */
  contractorRespondToRequest = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_contractor_respond_to_request');

    try {
      const contractorId = validateUserId(req);

      requireRole(req, ['contractor']);

      const { request_id } = req.params;
      const { response, notes } = req.body as ContractorRespondDTO;

      const result = await quoteService.contractorRespondToRequest(
        contractorId,
        request_id,
        response,
        notes
      );

      const nextSteps =
        response === 'accepted'
          ? 'You can now submit a quote for this request'
          : 'You have declined this request. No further action is required.';

      res.json({
        success: true,
        message: `Request ${response} successfully`,
        data: {
          assignment_id: result.assignment_id,
          request_id: request_id,
          response: result.response,
          responded_at: result.responded_at,
          next_steps: nextSteps,
        },
      });

      logger.info('Contractor responded to quote request via API', {
        contractor_id: contractorId,
        request_id: request_id,
        response: response,
      });
    } catch (error) {
      logger.error('Contractor respond to request API error', {
        contractor_id: req.headers['x-user-id'],
        request_id: req.params.request_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/quotes/request/:request_id/quotes
   * @desc    Get quotes for a specific request
   * @access  Private (Users, Admins)
   */
  getQuotesForRequest = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_quotes_for_request');

    try {
      const userId = validateUserId(req);
      const userRole = req.headers['x-user-role'] as string;
      const { request_id } = req.params;

      const filters: GetQuotesForRequestFilters & { userRole?: string } = {
        status: req.query.status as any,
        sort_by: (req.query.sort_by as any) || 'base_price',
        sort_order: (req.query.sort_order as any) || 'asc',
        userRole: userRole,
      };

      if (userRole !== 'admin') {
        await quoteService.getQuoteRequestById(request_id, userId);
      }

      const quotes = await quoteService.getQuotesForRequest(request_id, filters);

      res.json({
        success: true,
        message: 'Quotes retrieved successfully',
        data: {
          quotes: quotes,
          request_id: request_id,
          count: quotes.length,
        },
      });

      logger.info('Quotes for request retrieved via API', {
        request_id: request_id,
        user_id: userId,
        count: quotes.length,
      });
    } catch (error) {
      logger.error('Get quotes for request API error', {
        request_id: req.params.request_id,
        user_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ request_id: req.params.request_id });
    }
  });

  /**
   * @route   GET /api/quotes/contractor/my-quotes
   * @desc    Get contractor's submitted quotes with pagination
   * @access  Private (Contractors only)
   */
  getContractorQuotes = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_contractor_quotes');

    try {
      const contractorId = validateUserId(req);

      requireRole(req, ['contractor']);

      const filters: GetContractorQuotesFilters = {
        status: req.query.status as any,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as any) || 'desc',
      };

      const result = await quoteService.getContractorQuotes(contractorId, filters);

      res.json({
        success: true,
        message: 'Contractor quotes retrieved successfully',
        data: {
          quotes: result.quotes,
          pagination: {
            total: result.total,
            page: filters.page,
            limit: filters.limit,
            pages: Math.ceil(result.total / filters.limit),
          },
        },
      });

      logger.info('Contractor quotes retrieved via API', {
        contractor_id: contractorId,
        page: filters.page,
        count: result.quotes.length,
        total: result.total,
      });
    } catch (error) {
      logger.error('Get contractor quotes API error', {
        contractor_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.headers['x-user-id'] as string });
    }
  });
}

export const quoteController = new QuoteController();