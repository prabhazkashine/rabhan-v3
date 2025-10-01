import { Request, Response } from 'express';
import { quoteService } from '../services/quote.service';
import { contractorAvailabilityService } from '../services/contractor-availability.service';
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
import { GetAdminQuotesFilters } from '../types/admin-quotes.types';
import { QuoteAssignment } from '../types/quote-assignments.types';
import { AdminContractorQuote } from '../types/admin-contractor-quotes.types';
import { ApproveQuoteDTO, RejectQuoteDTO } from '../types/admin-quote-actions.types';

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

  /**
   * @route   GET /api/quotes/admin/all-quotes
   * @desc    Get all quotes with filters for admin dashboard
   * @access  Private (Admin, Super Admin only)
   */
  getAllQuotes = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_all_quotes');

    try {
      const adminId = validateUserId(req);

      requireRole(req, ['admin', 'super_admin']);

      const filters: GetAdminQuotesFilters = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        status: req.query.status as string,
        search: req.query.search as string,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as any) || 'desc',
        contractor_id: req.query.contractor_id as string,
        min_amount: req.query.min_amount ? parseFloat(req.query.min_amount as string) : undefined,
        max_amount: req.query.max_amount ? parseFloat(req.query.max_amount as string) : undefined,
      };

      const result = await quoteService.getAllQuotes(filters);

      res.json({
        success: true,
        message: 'All quotes retrieved successfully',
        data: {
          quotes: result.quotes,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            pages: result.pages,
          },
        },
      });

      logger.info('All quotes retrieved by admin via API', {
        admin_id: adminId,
        page: filters.page,
        count: result.quotes.length,
        total: result.total,
      });
    } catch (error) {
      logger.error('Get all quotes for admin API error', {
        admin_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/quotes/admin/quote/:quoteId
   * @desc    Get individual quote details by ID
   * @access  Private (Admin, Super Admin only)
   */
  getQuoteDetails = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_quote_details');

    try {
      const adminId = validateUserId(req);

      requireRole(req, ['admin', 'super_admin']);

      const { quoteId } = req.params;

      const quote = await quoteService.getQuoteById(quoteId);

      if (!quote) {
        return res.status(404).json({
          success: false,
          message: 'Quote not found',
        });
      }

      res.json({
        success: true,
        message: 'Quote details retrieved successfully',
        data: {
          quote: quote,
        },
      });

      logger.info('Quote details accessed by admin via API', {
        admin_id: adminId,
        quote_id: quoteId,
      });
    } catch (error) {
      logger.error('Get quote details for admin API error', {
        admin_id: req.headers['x-user-id'],
        quote_id: req.params.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string, quote_id: req.params.quoteId });
    }
  });

  /**
   * @route   GET /api/quotes/admin/:quoteId/assignments
   * @desc    Get contractor assignments for a quote
   * @access  Private (Admin, Super Admin only)
   */
  getQuoteAssignments = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_quote_assignments');

    try {
      const adminId = validateUserId(req);

      requireRole(req, ['admin', 'super_admin']);

      const { quoteId } = req.params;

      const assignments: QuoteAssignment[] = await quoteService.getQuoteAssignments(quoteId);

      res.json({
        success: true,
        message: 'Quote assignments retrieved successfully',
        data: {
          assignments: assignments,
          count: assignments.length,
        },
      });

      logger.info('Quote assignments accessed by admin via API', {
        admin_id: adminId,
        quote_id: quoteId,
        assignment_count: assignments.length,
      });
    } catch (error) {
      logger.error('Get quote assignments for admin API error', {
        admin_id: req.headers['x-user-id'],
        quote_id: req.params.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string, quote_id: req.params.quoteId });
    }
  });

  /**
   * @route   GET /api/quotes/admin/:quoteId/contractor-quotes
   * @desc    Get contractor quotes for a specific request
   * @access  Private (Admin, Super Admin only)
   */
  getContractorQuotesForRequest = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_contractor_quotes_for_request');

    try {
      const adminId = validateUserId(req);

      requireRole(req, ['admin', 'super_admin']);

      const { quoteId } = req.params;

      const contractorQuotes: AdminContractorQuote[] = await quoteService.getContractorQuotesForRequest(quoteId);

      res.json({
        success: true,
        message: 'Contractor quotes retrieved successfully',
        data: {
          contractor_quotes: contractorQuotes,
          count: contractorQuotes.length,
        },
      });

      logger.info('Contractor quotes for request accessed by admin via API', {
        admin_id: adminId,
        quote_id: quoteId,
        quotes_count: contractorQuotes.length,
      });
    } catch (error) {
      logger.error('Get contractor quotes for request API error', {
        admin_id: req.headers['x-user-id'],
        quote_id: req.params.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string, quote_id: req.params.quoteId });
    }
  });

  /**
   * @route   PUT /api/quotes/admin/contractor-quotes/:quoteId/approve
   * @desc    Approve contractor quote
   * @access  Private (Admin, Super Admin only)
   */
  approveQuote = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_approve_quote');

    try {
      const adminId = validateUserId(req);

      requireRole(req, ['admin', 'super_admin']);

      const { quoteId } = req.params;
      const data: ApproveQuoteDTO = req.body;

      await quoteService.approveQuote(quoteId, adminId, data);

      res.json({
        success: true,
        message: 'Contractor quote approved successfully',
      });

      logger.info('Contractor quote approved by admin via API', {
        admin_id: adminId,
        quote_id: quoteId,
      });
    } catch (error) {
      logger.error('Approve contractor quote API error', {
        admin_id: req.headers['x-user-id'],
        quote_id: req.params.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string, quote_id: req.params.quoteId });
    }
  });

  /**
   * @route   PUT /api/quotes/admin/contractor-quotes/:quoteId/reject
   * @desc    Reject contractor quote
   * @access  Private (Admin, Super Admin only)
   */
  rejectQuote = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_reject_quote');

    try {
      // Validate admin ID from header
      const adminId = validateUserId(req);

      // Validate admin role (only admin and super_admin can access)
      requireRole(req, ['admin', 'super_admin']);

      const { quoteId } = req.params;
      const data: RejectQuoteDTO = req.body;

      // Reject the quote
      await quoteService.rejectQuote(quoteId, adminId, data);

      res.json({
        success: true,
        message: 'Contractor quote rejected successfully',
      });

      logger.info('Contractor quote rejected by admin via API', {
        admin_id: adminId,
        quote_id: quoteId,
        rejection_reason: data.rejection_reason,
      });
    } catch (error) {
      logger.error('Reject contractor quote API error', {
        admin_id: req.headers['x-user-id'],
        quote_id: req.params.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string, quote_id: req.params.quoteId });
    }
  });

  /**
   * @route   GET /api/quotes/contractor/availability-settings
   * @desc    Get contractor's availability settings
   * @access  Private (Contractors only)
   */
  getAvailabilitySettings = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_availability_settings');

    try {
      const contractorId = validateUserId(req);

      requireRole(req, ['contractor']);

      const settings = await contractorAvailabilityService.getAvailabilitySettings(contractorId);

      res.json({
        success: true,
        message: 'Availability settings retrieved successfully',
        data: settings,
      });

      logger.info('Contractor availability settings retrieved via API', {
        contractor_id: contractorId,
      });
    } catch (error) {
      logger.error('Get contractor availability settings API error', {
        contractor_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   PUT /api/quotes/contractor/weekly-schedule
   * @desc    Update contractor's weekly schedule
   * @access  Private (Contractors only)
   */
  updateWeeklySchedule = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_update_weekly_schedule');

    try {
      const contractorId = validateUserId(req);

      requireRole(req, ['contractor']);

      const updateData = req.body;

      const settings = await contractorAvailabilityService.updateWeeklySchedule(contractorId, updateData);

      res.json({
        success: true,
        message: 'Weekly schedule updated successfully',
        data: settings,
      });

      logger.info('Contractor weekly schedule updated via API', {
        contractor_id: contractorId,
      });
    } catch (error) {
      logger.error('Update contractor weekly schedule API error', {
        contractor_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/quotes/contractor/:contractor_id/availability
   * @desc    Get availability status for a specific contractor (public for users)
   * @access  Private (All authenticated users)
   */
  getContractorAvailability = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_contractor_availability');

    try {
      validateUserId(req);

      const { contractor_id } = req.params;
      const { include_schedule = 'true' } = req.query;

      const availabilityData = await contractorAvailabilityService.getContractorAvailability(
        contractor_id,
        include_schedule === 'true'
      );

      res.json({
        success: true,
        message: 'Contractor availability retrieved successfully',
        data: availabilityData,
      });

      logger.info('Contractor availability retrieved via API', {
        contractor_id,
        requested_by: req.headers['x-user-id'],
      });
    } catch (error) {
      logger.error('Get contractor availability API error', {
        contractor_id: req.params.contractor_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.params.contractor_id });
    }
  });

  /**
   * @route   GET /api/quotes/contractor/:contractor_id/available-slots
   * @desc    Get available time slots for a contractor on a specific date with booked slots excluded
   * @access  Private (All authenticated users)
   */
  getAvailableTimeSlots = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_available_time_slots');

    try {
      validateUserId(req);

      const { contractor_id } = req.params;
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'date query parameter is required (format: YYYY-MM-DD)',
        });
      }

      const availabilityData = await contractorAvailabilityService.getAvailableTimeSlots(
        contractor_id,
        date as string
      );

      res.json({
        success: true,
        message: 'Available time slots retrieved successfully',
        data: availabilityData,
      });

      logger.info('Available time slots retrieved via API', {
        contractor_id,
        date,
        requested_by: req.headers['x-user-id'],
      });
    } catch (error) {
      logger.error('Get available time slots API error', {
        contractor_id: req.params.contractor_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: req.params.contractor_id });
    }
  });
}

export const quoteController = new QuoteController();