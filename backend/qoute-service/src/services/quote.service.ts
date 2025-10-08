import { prisma } from '../lib/prisma';
import { logger, performanceLogger, auditLogger } from '../utils/logger';
import { ValidationError, handlePrismaError, NotFoundError, BusinessRuleError, ConflictError } from '../utils/errors';
import { CreateQuoteRequestDTO, QuoteRequestResponse } from '../types/quote.types';
import { contractorService } from './contractor.service';
import { QuoteAssignment } from '../types/quote-assignments.types';
import { AdminContractorQuote } from '../types/admin-contractor-quotes.types';
import { ApproveQuoteDTO, RejectQuoteDTO } from '../types/admin-quote-actions.types';
import { ContractorFilters, AvailableContractor } from '../types/contractor.types';
import { financialService } from './financial.service';
import { SubmitQuoteDTO, ContractorQuoteResponse } from '../types/quote-submission.types';
import {
  SubmitDetailedQuotationDTO,
  DetailedQuotationResponse,
  QuotationTotals,
} from '../types/detailed-quotation.types';
import {
  AssignedRequestFilters,
  ContractorAssignment,
  PaginatedAssignments,
} from '../types/assigned-requests.types';
import {
  GetQuotesForRequestFilters,
  EnrichedContractorQuote,
  QuoteLineItem,
} from '../types/get-quotes.types';
import {
  GetUserQuoteRequestsFilters,
  UserQuoteRequest,
  PaginatedUserQuoteRequests,
  AssignedContractorWithStatus,
} from '../types/user-quote-requests.types';
import {
  GetContractorQuotesFilters,
  ContractorQuoteWithDetails,
  PaginatedContractorQuotes,
  QuotationTotalsResponse,
  ContractorQuoteLineItem,
} from '../types/contractor-quotes.types';
import {
  GetAdminQuotesFilters,
  AdminQuoteRequest,
  PaginatedAdminQuotes,
} from '../types/admin-quotes.types';
import { RemoveContractorDTO, AddContractorDTO, QuoteContractorOperationResponse } from '../types/quote-contractor.types';
import { userPrisma } from '../lib/userPrisma';
import { Prisma } from '@prisma/client';

export class QuoteService {
  /**
   * Validate system size against business rules
   */
  private async validateSystemSize(systemSizeKwp: number): Promise<void> {
    try {
      const config = await prisma.businessConfig.findUnique({
        where: { configKey: 'pricing_rules' },
      });

      if (config && config.configValue) {
        const rules = config.configValue as any;
        const minSize = rules.min_system_size_kwp || 1;
        const maxSize = rules.max_system_size_kwp || 100;

        if (systemSizeKwp < minSize || systemSizeKwp > maxSize) {
          throw new ValidationError(
            `System size must be between ${minSize} and ${maxSize} kWp`
          );
        }
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      logger.warn('Could not validate system size against business rules', { error });
      // Continue without validation if config is not available
    }
  }

  /**
   * Notify contractors about new quote request
   */
  private async notifyContractorsOfNewRequest(
    requestId: string,
    contractorIds: string[]
  ): Promise<void> {
    try {
      // Create assignments for each contractor
      const assignments = contractorIds.map((contractorId) => ({
        requestId,
        contractorId,
        status: 'assigned',
      }));

      await prisma.contractorQuoteAssignment.createMany({
        data: assignments,
        skipDuplicates: true,
      });

      logger.info('Contractors notified of new quote request', {
        request_id: requestId,
        contractor_count: contractorIds.length,
      });

      // TODO: Send actual notifications (email, push, etc.)
    } catch (error) {
      logger.error('Failed to notify contractors', {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - notification failure shouldn't fail the request creation
    }
  }

  /**
   * Format quote request for API response
   */
  private formatQuoteRequest(quoteRequest: any): QuoteRequestResponse {
    return {
      id: quoteRequest.id,
      userId: quoteRequest.userId,
      systemSizeKwp: quoteRequest.systemSizeKwp,
      locationAddress: quoteRequest.locationAddress,
      serviceArea: quoteRequest.serviceArea,
      propertyDetails: quoteRequest.propertyDetails,
      electricityConsumption: quoteRequest.electricityConsumption,
      selectedContractors: quoteRequest.selectedContractors || [],
      inspectionDates: quoteRequest.inspectionDates,
      status: quoteRequest.status,
      createdAt: quoteRequest.createdAt,
      updatedAt: quoteRequest.updatedAt,
    };
  }

  /**
   * Create a new quote request
   */
  async createQuoteRequest(
    userId: string,
    data: CreateQuoteRequestDTO
  ): Promise<QuoteRequestResponse> {
    const timer = performanceLogger.startTimer('create_quote_request');

    try {
      await this.validateSystemSize(data.system_size_kwp);

      const propertyDetails = {
        ...(data.property_details || {}),
        contact_phone: data.contact_phone,
        notes: data.notes || null,
      };

      const electricityConsumption = {
        monthly_kwh: data.electricity_consumption || 500,
        average_bill: data.average_electricity_bill || 200,
        peak_usage_hours: data.peak_usage_hours || '12-16',
      };

      const inspectionDates = data.inspection_schedules || {};

      const quoteRequest = await prisma.quoteRequest.create({
        data: {
          userId,
          systemSizeKwp: data.system_size_kwp,
          locationAddress: data.location_address,
          serviceArea: data.service_area,
          contactPhone: data.contact_phone,
          propertyDetails: propertyDetails as any,
          electricityConsumption: electricityConsumption as any,
          selectedContractors: data.selected_contractors || [],
          inspectionDates: inspectionDates as any,
          status: 'pending',
        },
      });

      if (data.selected_contractors && data.selected_contractors.length > 0) {
        await this.notifyContractorsOfNewRequest(
          quoteRequest.id,
          data.selected_contractors
        );
      }

      auditLogger.quote('QUOTE_REQUEST_CREATED', {
        user_id: userId,
        request_id: quoteRequest.id,
        system_size_kwp: data.system_size_kwp,
        estimated_cost: data.system_size_kwp * 2000, // Base estimation
        selected_contractors: data.selected_contractors,
      });

      logger.info('Quote request created successfully', {
        user_id: userId,
        request_id: quoteRequest.id,
        system_size: data.system_size_kwp,
        contractors_notified: data.selected_contractors?.length || 0,
      });

      return this.formatQuoteRequest(quoteRequest);
    } catch (error) {
      logger.error('Failed to create quote request', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw handlePrismaError(error);
    } finally {
      timer.end({ user_id: userId });
    }
  }

  /**
   * Get quote request by ID with optional user ID validation
   */
  async getQuoteRequestById(requestId: string, userId?: string): Promise<QuoteRequestResponse | null> {
    try {
      const where: any = { id: requestId };

      if (userId) {
        where.userId = userId;
      }

      const quoteRequest = await prisma.quoteRequest.findFirst({
        where,
        include: {
          _count: {
            select: {
              contractorQuotes: true,
            },
          },
        },
      });

      if (!quoteRequest) {
        throw new NotFoundError('Quote request not found or you do not have access to it');
      }

      return this.formatQuoteRequest(quoteRequest);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get quote request', {
        request_id: requestId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    }
  }

  /**
   * Format quote request with contractor enrichment for user requests
   */
  private async formatUserQuoteRequest(
    quoteRequest: any,
    userRole: string,
    includeContractorDetails: boolean = false
  ): Promise<UserQuoteRequest> {
    // Parse property details
    const propertyDetails =
      typeof quoteRequest.propertyDetails === 'string'
        ? JSON.parse(quoteRequest.propertyDetails)
        : quoteRequest.propertyDetails || {};

    const baseData: UserQuoteRequest = {
      id: quoteRequest.id,
      user_id: quoteRequest.userId,
      property_details: propertyDetails,
      electricity_consumption: quoteRequest.electricityConsumption,
      system_size_kwp: parseFloat(quoteRequest.systemSizeKwp?.toString() || '0'),
      location_lat: quoteRequest.locationLat ? parseFloat(quoteRequest.locationLat.toString()) : undefined,
      location_lng: quoteRequest.locationLng ? parseFloat(quoteRequest.locationLng.toString()) : undefined,
      location_address: quoteRequest.locationAddress,
      roof_size_sqm: quoteRequest.roofSizeSqm ? parseFloat(quoteRequest.roofSizeSqm.toString()) : undefined,
      service_area: quoteRequest.serviceArea || '',
      status: quoteRequest.status,
      inspection_dates: quoteRequest.inspectionDates || {},
      selected_contractors: quoteRequest.selectedContractors || [],
      max_contractors: quoteRequest.maxContractors || 3,
      inspection_penalty_acknowledged: quoteRequest.inspectionPenaltyAcknowledged || false,
      penalty_amount: parseFloat(quoteRequest.penaltyAmount?.toString() || '0'),
      created_at: quoteRequest.createdAt,
      updated_at: quoteRequest.updatedAt,
      cancelled_at: quoteRequest.cancelledAt || null,
      cancellation_reason: quoteRequest.cancellationReason || null,
      contact_phone: propertyDetails.contact_phone || '',
      quotes_count: quoteRequest.quote_count || 0,
      approved_quote_count: quoteRequest.approved_quote_count || 0,
    };

    // Enrich with contractor details if requested
    if (includeContractorDetails) {
      // Get assigned contractors for this quote request
      const assignedContractors = await prisma.contractorQuoteAssignment.findMany({
        where: { requestId: baseData.id },
        orderBy: { assignedAt: 'asc' },
      });

      if (assignedContractors.length > 0) {
        const assignedContractorIds = assignedContractors.map((a) => a.contractorId);
        const contractorDetails = await contractorService.enrichContractorDetails(assignedContractorIds);

        // Combine contractor details with assignment status
        const contractorsWithStatus: AssignedContractorWithStatus[] = assignedContractors.map((assignment) => ({
          contractor_id: assignment.contractorId,
          assignment_status: assignment.status,
          assigned_at: assignment.assignedAt,
          responded_at: assignment.respondedAt,
          contractor_info: contractorDetails[assignment.contractorId] || null,
        }));

        baseData.assigned_contractors = contractorsWithStatus;
        baseData.contractor_details = contractorDetails;
      } else if (baseData.selected_contractors.length > 0) {
        // Fallback: include selected contractors if no assigned contractors
        const contractorDetails = await contractorService.enrichContractorDetails(baseData.selected_contractors);
        baseData.contractor_details = contractorDetails;
      }
    }

    return baseData;
  }

  /**
   * Get all quote requests for a user with pagination and enrichment
   */
  async getUserQuoteRequests(
    userId: string,
    filters: Partial<GetUserQuoteRequestsFilters> = {}
  ): Promise<PaginatedUserQuoteRequests> {
    const timer = performanceLogger.startTimer('get_user_quote_requests');

    try {
      const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc', status } = filters;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = { userId };

      if (status) {
        where.status = status;
      }

      // Get total count
      const total = await prisma.quoteRequest.count({ where });

      // Determine orderBy
      let orderBy: any = {};
      if (sort_by === 'created_at') {
        orderBy.createdAt = sort_order;
      } else if (sort_by === 'updated_at') {
        orderBy.updatedAt = sort_order;
      } else if (sort_by === 'system_size_kwp') {
        orderBy.systemSizeKwp = sort_order;
      } else {
        orderBy.createdAt = sort_order; // default
      }

      // Get requests with quote counts
      const quoteRequests = await prisma.quoteRequest.findMany({
        where,
        include: {
          _count: {
            select: {
              contractorQuotes: true,
            },
          },
          contractorQuotes: {
            where: {
              adminStatus: 'approved',
            },
            select: {
              id: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      // Format and enrich requests
      const requests = await Promise.all(
        quoteRequests.map(async (qr) => {
          const enrichedRequest = {
            ...qr,
            quote_count: qr._count.contractorQuotes,
            approved_quote_count: qr.contractorQuotes.length,
          };
          return this.formatUserQuoteRequest(enrichedRequest, 'user', true);
        })
      );

      logger.debug('Retrieved user quote requests', {
        user_id: userId,
        count: requests.length,
        total,
        page,
      });

      return { requests, total, page, limit };
    } catch (error) {
      logger.error('Failed to get user quote requests', {
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ user_id: userId });
    }
  }

  /**
   * Get available contractors for quote requests
   */
  async getAvailableContractors(filters: ContractorFilters): Promise<AvailableContractor[]> {
    const timer = performanceLogger.startTimer('get_available_contractors');

    try {
      const contractors = await contractorService.getAvailableContractors(filters);
      return contractors;
    } catch (error) {
      logger.error('Failed to get available contractors from quote service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
      });
      throw error;
    } finally {
      timer.end({ filters });
    }
  }

  /**
   * Validate quote pricing against business rules
   */
  private async validateQuotePricing(
    pricePerKwp: number,
    basePrice: number,
    systemSizeKwp: number
  ): Promise<void> {
    const config = await prisma.businessConfig.findUnique({
      where: { configKey: 'pricing_rules' },
    });

    const maxPricePerKwp = config?.configValue
      ? (config.configValue as any).max_price_per_kwp || 2000
      : 2000;

    if (pricePerKwp > maxPricePerKwp) {
      throw new BusinessRuleError(
        `Price per kWp cannot exceed ${maxPricePerKwp} SAR`,
        'PRICE_PER_KWP_TOO_HIGH',
        { provided: pricePerKwp, maximum: maxPricePerKwp }
      );
    }

    // Validate total price consistency
    const expectedBasePrice = Math.round(pricePerKwp * systemSizeKwp * 100) / 100;
    const priceDifference = Math.abs(basePrice - expectedBasePrice);

    if (priceDifference > 0.01) {
      // Allow for small rounding differences
      throw new BusinessRuleError(
        'Base price does not match price per kWp calculation',
        'PRICE_CALCULATION_MISMATCH',
        { base_price: basePrice, calculated_price: expectedBasePrice }
      );
    }
  }

  /**
   * Update request status if needed (when first quote is received)
   */
  private async updateRequestStatusIfNeeded(requestId: string): Promise<void> {
    try {
      const quoteCount = await prisma.contractorQuote.count({
        where: { requestId },
      });

      if (quoteCount === 1) {
        // This is the first quote, update request status
        await prisma.quoteRequest.update({
          where: { id: requestId },
          data: { status: 'quotes_received' },
        });

        logger.info('Updated quote request status to quotes_received', {
          request_id: requestId,
        });
      }
    } catch (error) {
      logger.error('Failed to update request status', {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - status update failure shouldn't fail the quote submission
    }
  }

  /**
   * Format contractor quote for API response
   */
  private formatContractorQuote(quote: any): ContractorQuoteResponse {
    return {
      id: quote.id,
      request_id: quote.requestId || quote.quoteRequestId,
      contractor_id: quote.contractorId,
      base_price: parseFloat(quote.basePrice),
      price_per_kwp: parseFloat(quote.pricePerKwp),
      overprice_amount: parseFloat(quote.overpriceAmount),
      total_user_price: parseFloat(quote.totalUserPrice),
      system_specs: quote.systemSpecs,
      installation_timeline_days: quote.installationTimelineDays,
      warranty_terms: quote.warrantyTerms,
      maintenance_terms: quote.maintenanceTerms,
      panels_brand: quote.panelsBrand,
      panels_model: quote.panelsModel,
      panels_quantity: quote.panelsQuantity,
      inverter_brand: quote.inverterBrand,
      inverter_model: quote.inverterModel,
      inverter_quantity: quote.inverterQuantity,
      admin_status: quote.adminStatus,
      status: quote.status,
      created_at: quote.createdAt,
      updated_at: quote.updatedAt,
    };
  }

  /**
   * Submit a contractor quote
   */
  async submitQuote(contractorId: string, data: SubmitQuoteDTO): Promise<ContractorQuoteResponse> {
    const timer = performanceLogger.startTimer('submit_quote');

    try {
      const request = await prisma.quoteRequest.findUnique({
        where: { id: data.request_id },
        select: { status: true, systemSizeKwp: true },
      });

      if (!request) {
        throw new NotFoundError('Quote request not found');
      }

      const validStatuses = ['pending', 'contractors_selected', 'quotes_received', 'open'];
      if (!validStatuses.includes(request.status)) {
        throw new BusinessRuleError(
          'Cannot submit quote for request in current status',
          'INVALID_REQUEST_STATUS',
          { current_status: request.status }
        );
      }

      await this.validateQuotePricing(data.price_per_kwp, data.base_price, request.systemSizeKwp!);

      const existingQuote = await prisma.contractorQuote.findFirst({
        where: {
          requestId: data.request_id,
          contractorId: contractorId,
        },
      });

      if (existingQuote) {
        throw new ConflictError('Quote already submitted for this request');
      }

      const financials = await financialService.calculateQuoteFinancials(
        data.base_price,
        data.price_per_kwp,
        request.systemSizeKwp!
      );

      const quote = await prisma.contractorQuote.create({
        data: {
          requestId: data.request_id,
          contractorId: contractorId,
          basePrice: financials.base_price,
          pricePerKwp: financials.price_per_kwp,
          overpriceAmount: financials.overprice_amount,
          totalUserPrice: financials.total_user_price,
          systemSpecs: data.system_specs as any,
          installationTimelineDays: data.installation_timeline_days,
          warrantyTerms: data.warranty_terms as any,
          maintenanceTerms: data.maintenance_terms as any,
          panelsBrand: data.panels_brand,
          panelsModel: data.panels_model,
          panelsQuantity: data.panels_quantity,
          inverterBrand: data.inverter_brand,
          inverterModel: data.inverter_model,
          inverterQuantity: data.inverter_quantity,
          status: 'submitted',
          adminStatus: 'pending_review',
        },
      });

      await this.updateRequestStatusIfNeeded(data.request_id);

      auditLogger.quote('CONTRACTOR_QUOTE_SUBMITTED', {
        contractor_id: contractorId,
        request_id: data.request_id,
        quote_id: quote.id,
        base_price: data.base_price,
        price_per_kwp: data.price_per_kwp,
      });

      logger.info('Contractor quote submitted successfully', {
        contractor_id: contractorId,
        quote_id: quote.id,
        request_id: data.request_id,
      });

      return this.formatContractorQuote(quote);
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof BusinessRuleError ||
        error instanceof ConflictError
      ) {
        throw error;
      }

      logger.error('Failed to submit contractor quote', {
        contractor_id: contractorId,
        request_id: data.request_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Calculate quotation totals from line items
   */
  private calculateQuotationTotals(lineItems: any[], vatRate: number): QuotationTotals {
    const totalPrice = lineItems.reduce((sum, item) => sum + parseFloat(item.totalPrice || item.total_price || 0), 0);
    const totalCommission = lineItems.reduce((sum, item) => sum + parseFloat(item.rabhanCommission || item.rabhan_commission || 0), 0);
    const totalOverPrice = lineItems.reduce((sum, item) => sum + parseFloat(item.rabhanOverPrice || item.rabhan_overprice || 0), 0);
    const totalUserPrice = lineItems.reduce((sum, item) => sum + parseFloat(item.userPrice || item.user_price || 0), 0);
    const totalVendorNet = lineItems.reduce((sum, item) => sum + parseFloat(item.vendorNetPrice || item.vendor_net_price || 0), 0);
    const vatAmount = totalVendorNet * (vatRate / 100);
    const totalPayable = totalVendorNet + vatAmount;

    return {
      total_price: Math.round(totalPrice * 100) / 100,
      total_commission: Math.round(totalCommission * 100) / 100,
      total_over_price: Math.round(totalOverPrice * 100) / 100,
      total_user_price: Math.round(totalUserPrice * 100) / 100,
      total_vendor_net: Math.round(totalVendorNet * 100) / 100,
      vat_amount: Math.round(vatAmount * 100) / 100,
      total_payable: Math.round(totalPayable * 100) / 100,
    };
  }

  /**
   * Submit detailed quotation with line items
   */
  async submitDetailedQuotation(
    contractorId: string,
    data: SubmitDetailedQuotationDTO
  ): Promise<DetailedQuotationResponse> {
    const timer = performanceLogger.startTimer('submit_detailed_quotation');

    try {
      const config = await prisma.businessConfig.findUnique({
        where: { configKey: 'pricing_rules' },
      });

      const vatRate = config?.configValue ? (config.configValue as any).vat_rate_percent || 15 : 15;

      if (!data.request_id) {
        throw new ValidationError('Request ID is required. Contractors can only submit quotes in response to assigned requests.');
      }

      const request = await prisma.quoteRequest.findFirst({
        where: {
          id: data.request_id,
          selectedContractors: {
            has: contractorId,
          },
        },
      });

      if (!request) {
        throw new BusinessRuleError(
          'Contractor is not assigned to this quote request. Only assigned contractors can submit quotes.',
          'NOT_ASSIGNED',
          { contractor_id: contractorId, request_id: data.request_id }
        );
      }

      const existingQuote = await prisma.contractorQuote.findFirst({
        where: {
          contractorId: contractorId,
          requestId: data.request_id,
        },
      });

      if (existingQuote) {
        throw new ConflictError('Contractor has already submitted a quotation for this request. Only one quotation per request is allowed.');
      }

      const totalBasePrice = data.base_price || 0;

      const result = await prisma.$transaction(async (tx) => {
        const quote = await tx.contractorQuote.create({
          data: {
            contractorId: contractorId,
            requestId: data.request_id,
            contractorVatNumber: data.contractor_vat_number,
            installationDeadline: data.installation_deadline ? new Date(data.installation_deadline) : undefined,
            paymentTerms: data.payment_terms,
            solarSystemCapacityKwp: data.solar_system_capacity_kwp,
            storageCapacityKwh: data.storage_capacity_kwh,
            monthlyProductionKwh: data.monthly_production_kwh,
            basePrice: totalBasePrice,
            pricePerKwp: data.price_per_kwp || (totalBasePrice / (data.solar_system_capacity_kwp || 1)),
            installationTimelineDays: data.installation_timeline_days || 30,
            systemSpecs: (data.system_specs || {}) as any,
            adminStatus: 'pending_review',
            status: 'submitted',
          },
        });

        const lineItems = [];
        if (data.line_items && data.line_items.length > 0) {
          for (let i = 0; i < data.line_items.length; i++) {
            const item = data.line_items[i];

            const lineItem = await tx.quotationLineItem.create({
              data: {
                quotationId: quote.id,
                itemName: item.item_name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                totalPrice: item.totalPrice,
                units: item.units || 'unit',
                rabhanCommission: item.rabhanCommission,
                rabhanOverprice: item.rabhanOverPrice,
                userPrice: item.userPrice,
                vendorNetPrice: item.vendorNetPrice,
                vat: item.vendorNetPrice * (vatRate / 100),
                lineOrder: item.serial_number || i + 1,
                sortOrder: item.serial_number || i + 1,
              },
            });

            lineItems.push(lineItem);
          }
        }

        return { quote, lineItems };
      });

      const { quote, lineItems } = result;

      const totals = this.calculateQuotationTotals(lineItems, vatRate);

      auditLogger.quote('DETAILED_QUOTATION_SUBMITTED', {
        contractor_id: contractorId,
        quotation_id: quote.id,
        request_id: data.request_id,
        line_items_count: lineItems.length,
        total_base_price: totalBasePrice,
        totals,
      });

      logger.info('Detailed quotation submitted successfully', {
        contractor_id: contractorId,
        quotation_id: quote.id,
        line_items_count: lineItems.length,
      });

      const response: DetailedQuotationResponse = {
        id: quote.id,
        contractor_id: quote.contractorId,
        request_id: quote.requestId!,
        contractor_vat_number: quote.contractorVatNumber || undefined,
        installation_deadline: quote.installationDeadline || undefined,
        payment_terms: quote.paymentTerms || undefined,
        solar_system_capacity_kwp: parseFloat(quote.solarSystemCapacityKwp?.toString() || '0'),
        storage_capacity_kwh: quote.storageCapacityKwh ? parseFloat(quote.storageCapacityKwh.toString()) : undefined,
        monthly_production_kwh: quote.monthlyProductionKwh ? parseFloat(quote.monthlyProductionKwh.toString()) : undefined,
        base_price: parseFloat(quote.basePrice?.toString() || '0'),
        price_per_kwp: parseFloat(quote.pricePerKwp?.toString() || '0'),
        installation_timeline_days: quote.installationTimelineDays || 30,
        system_specs: quote.systemSpecs,
        admin_status: quote.adminStatus,
        status: quote.status,
        created_at: quote.createdAt,
        updated_at: quote.updatedAt,
        line_items: lineItems.map((item) => ({
          id: item.id,
          quotation_id: item.quotationId,
          item_name: item.itemName,
          description: item.description || undefined,
          quantity: item.quantity,
          unit_price: parseFloat(item.unitPrice.toString()),
          total_price: item.totalPrice ? parseFloat(item.totalPrice.toString()) : 0,
          units: item.units,
          rabhan_commission: parseFloat(item.rabhanCommission.toString()),
          rabhan_overprice: parseFloat(item.rabhanOverprice.toString()),
          user_price: parseFloat(item.userPrice.toString()),
          vendor_net_price: parseFloat(item.vendorNetPrice.toString()),
          vat: parseFloat(item.vat.toString()),
          line_order: item.lineOrder,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        })),
        totals,
      };

      return response;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof BusinessRuleError ||
        error instanceof ConflictError
      ) {
        throw error;
      }

      logger.error('Failed to submit detailed quotation', {
        contractor_id: contractorId,
        request_id: data.request_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Get assigned quote requests for a contractor
   */
  async getContractorAssignedRequests(
    contractorId: string,
    filters: AssignedRequestFilters = {}
  ): Promise<PaginatedAssignments> {
    const timer = performanceLogger.startTimer('get_contractor_assigned_requests');

    try {
      const { page = 1, limit = 10, sort_by = 'assigned_at', sort_order = 'desc' } = filters;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        contractorId: contractorId,
      };

      if (filters.status) {
        where.status = filters.status;
      }

      // Get total count
      const total = await prisma.contractorQuoteAssignment.count({ where });

      // Determine sort field
      let orderBy: any = {};
      if (sort_by === 'assigned_at') {
        orderBy.assignedAt = sort_order;
      } else if (sort_by === 'created_at') {
        orderBy.createdAt = sort_order;
      } else if (sort_by === 'updated_at') {
        orderBy.updatedAt = sort_order;
      } else {
        orderBy.assignedAt = sort_order; // default
      }

      // Get assignments with quote request details
      const assignments = await prisma.contractorQuoteAssignment.findMany({
        where,
        include: {
          quoteRequest: {
            select: {
              id: true,
              userId: true,
              systemSizeKwp: true,
              locationAddress: true,
              serviceArea: true,
              propertyDetails: true,
              electricityConsumption: true,
              createdAt: true,
              status: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      // Check if contractor has submitted quotes for these requests
      const requestIds = assignments.map((a) => a.requestId);
      const submittedQuotes = await prisma.contractorQuote.findMany({
        where: {
          contractorId: contractorId,
          requestId: { in: requestIds },
        },
        select: {
          requestId: true,
        },
      });

      const submittedQuoteIds = new Set(submittedQuotes.map((q) => q.requestId));

      // Format response
      const formattedAssignments: ContractorAssignment[] = assignments.map((assignment) => ({
        assignment_id: assignment.id,
        request_id: assignment.requestId,
        contractor_id: assignment.contractorId,
        assignment_status: assignment.status,
        assigned_at: assignment.assignedAt,
        viewed_at: assignment.viewedAt || undefined,
        responded_at: assignment.respondedAt || undefined,
        response_notes: assignment.responseNotes || undefined,
        has_submitted_quote: submittedQuoteIds.has(assignment.requestId),
        quote_request: {
          user_id: assignment.quoteRequest.userId,
          system_size_kwp: assignment.quoteRequest.systemSizeKwp
            ? parseFloat(assignment.quoteRequest.systemSizeKwp.toString())
            : 0,
          location_address: assignment.quoteRequest.locationAddress,
          service_area: assignment.quoteRequest.serviceArea || '',
          property_details: assignment.quoteRequest.propertyDetails,
          electricity_consumption: assignment.quoteRequest.electricityConsumption,
          created_at: assignment.quoteRequest.createdAt,
          status: assignment.quoteRequest.status,
        },
      }));

      logger.debug('Retrieved contractor assigned requests', {
        contractor_id: contractorId,
        count: formattedAssignments.length,
        total,
        page,
      });

      return {
        assignments: formattedAssignments,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Failed to get contractor assigned requests', {
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Update quote request status based on all contractor responses
   */
  private async updateQuoteRequestStatusBasedOnContractorResponses(
    requestId: string
  ): Promise<void> {
    try {
      // Get all assignments for this request
      const assignments = await prisma.contractorQuoteAssignment.findMany({
        where: { requestId },
        select: { status: true },
      });

      if (assignments.length === 0) {
        return;
      }

      // Count responses
      const acceptedCount = assignments.filter((a) => a.status === 'accepted').length;
      const rejectedCount = assignments.filter((a) => a.status === 'rejected').length;

      let newStatus: string | null = null;

      // If at least one contractor accepted, set to in-progress
      if (acceptedCount > 0) {
        newStatus = 'in-progress';
      }
      // If all contractors rejected, set to rejected
      else if (rejectedCount === assignments.length) {
        newStatus = 'rejected';
      }

      // Update request status if needed
      if (newStatus) {
        await prisma.quoteRequest.update({
          where: { id: requestId },
          data: { status: newStatus },
        });

        logger.info('Updated quote request status based on contractor responses', {
          request_id: requestId,
          new_status: newStatus,
          accepted_count: acceptedCount,
          rejected_count: rejectedCount,
          total_assignments: assignments.length,
        });
      }
    } catch (error) {
      logger.error('Failed to update quote request status', {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - status update failure shouldn't fail the response
    }
  }

  /**
   * Contractor respond to quote request assignment (accept or reject)
   */
  async contractorRespondToRequest(
    contractorId: string,
    requestId: string,
    response: 'accepted' | 'rejected',
    notes?: string
  ): Promise<{ assignment_id: string; response: string; responded_at: Date }> {
    const timer = performanceLogger.startTimer('contractor_respond_to_request');

    try {
      // Check if assignment exists
      const assignment = await prisma.contractorQuoteAssignment.findFirst({
        where: {
          contractorId: contractorId,
          requestId: requestId,
        },
      });

      if (!assignment) {
        throw new NotFoundError('Assignment not found for this contractor and request');
      }

      // Validate assignment status - can only respond if assigned or viewed
      const validStatuses = ['assigned', 'viewed'];
      if (!validStatuses.includes(assignment.status)) {
        throw new BusinessRuleError(
          'Cannot respond to assignment in current status',
          'INVALID_ASSIGNMENT_STATUS',
          { current_status: assignment.status }
        );
      }

      // Update assignment with response
      const updatedAssignment = await prisma.contractorQuoteAssignment.update({
        where: { id: assignment.id },
        data: {
          status: response,
          responseNotes: notes,
          respondedAt: new Date(),
        },
      });

      // Update quote request status based on all contractor responses
      await this.updateQuoteRequestStatusBasedOnContractorResponses(requestId);

      auditLogger.quote('CONTRACTOR_RESPONDED_TO_REQUEST', {
        contractor_id: contractorId,
        request_id: requestId,
        assignment_id: assignment.id,
        response,
        notes,
      });

      logger.info('Contractor responded to quote request', {
        contractor_id: contractorId,
        request_id: requestId,
        response,
      });

      return {
        assignment_id: updatedAssignment.id,
        response: updatedAssignment.status,
        responded_at: updatedAssignment.respondedAt!,
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof BusinessRuleError) {
        throw error;
      }

      logger.error('Failed to respond to quote request', {
        contractor_id: contractorId,
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ contractor_id: contractorId, request_id: requestId });
    }
  }

  /**
   * Get status display text
   */
  private getStatusDisplay(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending_review: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      revision_needed: 'Revision Needed',
    };
    return statusMap[status] || status;
  }

  /**
   * Calculate quotation totals from line items for contractor quotes
   */
  private calculateContractorQuotationTotals(
    lineItems: any[],
    vatRate: number
  ): QuotationTotalsResponse {
    const totalPrice = lineItems.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
    const totalCommission = lineItems.reduce(
      (sum, item) => sum + parseFloat(item.rabhan_commission || 0),
      0
    );
    const totalOverPrice = lineItems.reduce(
      (sum, item) => sum + parseFloat(item.rabhan_overprice || 0),
      0
    );
    const totalUserPrice = lineItems.reduce((sum, item) => sum + parseFloat(item.user_price || 0), 0);
    const totalVendorNet = lineItems.reduce(
      (sum, item) => sum + parseFloat(item.vendor_net_price || 0),
      0
    );
    const vatAmount = totalVendorNet * (vatRate / 100);
    const totalPayable = totalVendorNet + vatAmount;

    return {
      total_price: Math.round(totalPrice * 100) / 100,
      total_commission: Math.round(totalCommission * 100) / 100,
      total_over_price: Math.round(totalOverPrice * 100) / 100,
      total_user_price: Math.round(totalUserPrice * 100) / 100,
      total_vendor_net: Math.round(totalVendorNet * 100) / 100,
      vat_amount: Math.round(vatAmount * 100) / 100,
      total_payable: Math.round(totalPayable * 100) / 100,
    };
  }

  /**
   * Get contractor's own quotes with pagination
   */
  async getContractorQuotes(
    contractorId: string,
    filters: Partial<GetContractorQuotesFilters> = {}
  ): Promise<PaginatedContractorQuotes> {
    const timer = performanceLogger.startTimer('get_contractor_quotes');

    try {
      const { page = 1, limit = 10, status, sort_by = 'created_at', sort_order = 'desc' } = filters;
      const skip = (page - 1) * limit;

      const where: any = {
        contractorId: contractorId,
      };

      if (status) {
        where.adminStatus = status;
      }

      const total = await prisma.contractorQuote.count({ where });

      let orderBy: any = {};
      if (sort_by === 'created_at') {
        orderBy.createdAt = sort_order;
      } else if (sort_by === 'updated_at') {
        orderBy.updatedAt = sort_order;
      } else if (sort_by === 'admin_status') {
        orderBy.adminStatus = sort_order;
      } else if (sort_by === 'base_price') {
        orderBy.basePrice = sort_order;
      } else {
        orderBy.createdAt = sort_order; // default
      }

      const quotes = await prisma.contractorQuote.findMany({
        where,
        include: {
          quotationLineItems: {
            orderBy: {
              lineOrder: 'asc',
            },
          },
          quoteRequest: {
            select: {
              userId: true,
              systemSizeKwp: true,
              locationAddress: true,
              serviceArea: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      const formattedQuotes: ContractorQuoteWithDetails[] = quotes.map((quote) => {
        const lineItems: ContractorQuoteLineItem[] = quote.quotationLineItems.map((item) => ({
          id: item.id,
          item_name: item.itemName,
          description: item.description || undefined,
          quantity: item.quantity,
          unit_price: parseFloat(item.unitPrice.toString()),
          total_price: item.totalPrice ? parseFloat(item.totalPrice.toString()) : 0,
          rabhan_commission: parseFloat(item.rabhanCommission.toString()),
          rabhan_overprice: parseFloat(item.rabhanOverprice.toString()),
          user_price: parseFloat(item.userPrice.toString()),
          vendor_net_price: parseFloat(item.vendorNetPrice.toString()),
          line_order: item.lineOrder,
        }));

        const totals =
          lineItems.length > 0 ? this.calculateContractorQuotationTotals(lineItems, 15) : null;

        const createdAtFormatted = new Date(quote.createdAt).toLocaleDateString('en-GB');
        const installationDeadlineFormatted = quote.installationDeadline
          ? new Date(quote.installationDeadline).toLocaleDateString('en-GB')
          : null;

        return {
          id: quote.id,
          quote_request_id: quote.quoteRequestId,
          contractor_id: quote.contractorId,
          request_id: quote.requestId!,
          base_price: parseFloat(quote.basePrice?.toString() || '0'),
          price_per_kwp: parseFloat(quote.pricePerKwp?.toString() || '0'),
          overprice_amount: parseFloat(quote.overpriceAmount.toString()),
          total_user_price: quote.totalUserPrice ? parseFloat(quote.totalUserPrice.toString()) : null,
          system_specs: quote.systemSpecs,
          installation_timeline_days: quote.installationTimelineDays || 30,
          warranty_terms: quote.warrantyTerms,
          maintenance_terms: quote.maintenanceTerms,
          panels_brand: quote.panelsBrand,
          panels_model: quote.panelsModel,
          panels_quantity: quote.panelsQuantity,
          inverter_brand: quote.inverterBrand,
          inverter_model: quote.inverterModel,
          inverter_quantity: quote.inverterQuantity,
          admin_status: quote.adminStatus,
          admin_notes: quote.adminNotes || '',
          reviewed_by: quote.reviewedBy,
          reviewed_at: quote.reviewedAt,
          rejection_reason: quote.rejectionReason,
          is_selected: quote.isSelected,
          selected_at: quote.selectedAt,
          expires_at: quote.expiresAt,
          status: quote.status,
          created_at: quote.createdAt,
          updated_at: quote.updatedAt,
          contractor_vat_number: quote.contractorVatNumber,
          payment_terms: quote.paymentTerms,
          installation_deadline: quote.installationDeadline,
          solar_system_capacity_kwp: parseFloat(quote.solarSystemCapacityKwp?.toString() || '0'),
          storage_capacity_kwh: quote.storageCapacityKwh
            ? parseFloat(quote.storageCapacityKwh.toString())
            : null,
          monthly_production_kwh: quote.monthlyProductionKwh
            ? parseFloat(quote.monthlyProductionKwh.toString())
            : null,
          includes_battery: quote.includesBattery,
          includes_monitoring: quote.includesMonitoring,
          includes_maintenance: quote.includesMaintenance,
          site_survey_required: quote.siteSurveyRequired,
          permits_included: quote.permitsIncluded,
          grid_connection_included: quote.gridConnectionIncluded,

          // Request details
          user_id: quote.quoteRequest?.userId || '',
          request_system_size: quote.quoteRequest?.systemSizeKwp
            ? parseFloat(quote.quoteRequest.systemSizeKwp.toString())
            : 0,
          location_address: quote.quoteRequest?.locationAddress || '',
          service_area: quote.quoteRequest?.serviceArea || '',

          // Enriched data
          line_items: lineItems,
          totals: totals,
          status_display: this.getStatusDisplay(quote.adminStatus),
          created_at_formatted: createdAtFormatted,
          installation_deadline_formatted: installationDeadlineFormatted,
        };
      });

      logger.info('Contractor quotes retrieved successfully', {
        contractor_id: contractorId,
        total_quotes: total,
        returned_quotes: formattedQuotes.length,
        filters: filters,
      });

      return { quotes: formattedQuotes, total };
    } catch (error) {
      logger.error('Failed to get contractor quotes', {
        contractor_id: contractorId,
        filters: filters,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Get quotes for a specific request
   */
  async getQuotesForRequest(
    requestId: string,
    filters: Partial<GetQuotesForRequestFilters> & { userRole?: string } = {}
  ): Promise<EnrichedContractorQuote[]> {
    const timer = performanceLogger.startTimer('get_quotes_for_request');

    try {
      const { status, sort_by = 'base_price', sort_order = 'asc', userRole } = filters;

      const where: any = {
        requestId: requestId,
      };

      if (userRole && userRole !== 'admin') {
        where.adminStatus = 'approved';
      }

      if (status) {
        where.adminStatus = status;
      }

      let orderBy: any = {};
      if (sort_by === 'base_price') {
        orderBy.basePrice = sort_order;
      } else if (sort_by === 'installation_timeline_days') {
        orderBy.installationTimelineDays = sort_order;
      } else if (sort_by === 'created_at') {
        orderBy.createdAt = sort_order;
      } else {
        orderBy.basePrice = sort_order;
      }

      const quotes = await prisma.contractorQuote.findMany({
        where,
        include: {
          quotationLineItems: {
            orderBy: {
              lineOrder: 'asc',
            },
          },
        },
        orderBy,
      });

      logger.info('Enriching quotes with contractor information', {
        request_id: requestId,
        quotes_found: quotes.length,
      });

      const enrichedQuotes = await Promise.all(
        quotes.map(async (quote) => {
          logger.debug('Fetching contractor info for', { contractor_id: quote.contractorId });

          const contractorInfo = await contractorService.fetchContractorInfo(quote.contractorId);

          logger.debug('Contractor info result', { contractor_info: contractorInfo });

          let daysUntilExpiry: number | undefined = undefined;
          if (quote.expiresAt) {
            const now = new Date();
            const expiry = new Date(quote.expiresAt);
            daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          }

          const lineItems: QuoteLineItem[] = quote.quotationLineItems.map((item) => ({
            id: item.id,
            quotation_id: item.quotationId,
            item_name: item.itemName,
            description: item.description || undefined,
            quantity: item.quantity,
            unit_price: parseFloat(item.unitPrice.toString()),
            total_price: item.totalPrice ? parseFloat(item.totalPrice.toString()) : 0,
            units: item.units,
            rabhan_commission: parseFloat(item.rabhanCommission.toString()),
            rabhan_overprice: parseFloat(item.rabhanOverprice.toString()),
            user_price: parseFloat(item.userPrice.toString()),
            vendor_net_price: parseFloat(item.vendorNetPrice.toString()),
            vat: parseFloat(item.vat.toString()),
            line_order: item.lineOrder,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
          }));

          const enrichedQuote: EnrichedContractorQuote = {
            id: quote.id,
            request_id: quote.requestId!,
            contractor_id: quote.contractorId,
            base_price: parseFloat(quote.basePrice?.toString() || '0'),
            price_per_kwp: parseFloat(quote.pricePerKwp?.toString() || '0'),
            overprice_amount: parseFloat(quote.overpriceAmount.toString()),
            total_user_price: parseFloat(quote.totalUserPrice?.toString() || '0'),
            system_specs: quote.systemSpecs,
            installation_timeline_days: quote.installationTimelineDays || undefined,
            warranty_terms: quote.warrantyTerms,
            maintenance_terms: quote.maintenanceTerms,
            panels_brand: quote.panelsBrand || undefined,
            panels_model: quote.panelsModel || undefined,
            panels_quantity: quote.panelsQuantity || undefined,
            inverter_brand: quote.inverterBrand || undefined,
            inverter_model: quote.inverterModel || undefined,
            inverter_quantity: quote.inverterQuantity || undefined,
            admin_status: quote.adminStatus,
            status: quote.status,
            created_at: quote.createdAt,
            updated_at: quote.updatedAt,
            expires_at: quote.expiresAt || undefined,
            days_until_expiry: daysUntilExpiry,
            line_items: lineItems.length > 0 ? lineItems : undefined,
            // Add contractor information if available
            contractor_name: contractorInfo?.business_name,
            contractor_company: contractorInfo?.business_name,
            contractor_email: contractorInfo?.email,
            contractor_phone: contractorInfo?.phone,
            contractor_status: contractorInfo?.status,
            contractor_verification_level: contractorInfo?.verification_level,
          };

          if (contractorInfo) {
            logger.debug('Enriched quote with contractor', { contractor_name: contractorInfo.business_name });
          } else {
            logger.warn('No contractor info found for quote', { contractor_id: quote.contractorId });
          }

          return enrichedQuote;
        })
      );

      logger.info('Quotes retrieved and enriched successfully', {
        request_id: requestId,
        quotes_count: enrichedQuotes.length,
      });

      return enrichedQuotes;
    } catch (error) {
      logger.error('Failed to get quotes for request', {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ request_id: requestId });
    }
  }

  /**
   * Get a single contractor quote by request ID and contractor ID
   */
  async getContractorQuoteByRequestAndContractor(
    requestId: string,
    contractorId: string,
    userRole?: string
  ): Promise<EnrichedContractorQuote | null> {
    const timer = performanceLogger.startTimer('get_contractor_quote_by_request_and_contractor');

    try {
      const where: any = {
        requestId: requestId,
        contractorId: contractorId,
      };

      if (userRole && userRole !== 'admin') {
        where.adminStatus = 'approved';
      }

      const quote = await prisma.contractorQuote.findFirst({
        where,
        include: {
          quotationLineItems: {
            orderBy: {
              lineOrder: 'asc',
            },
          },
        },
      });

      if (!quote) {
        logger.info('No quote found for request and contractor', {
          request_id: requestId,
          contractor_id: contractorId,
        });
        return null;
      }

      logger.debug('Fetching contractor info for', { contractor_id: quote.contractorId });

      const contractorInfo = await contractorService.fetchContractorInfo(quote.contractorId);

      logger.debug('Contractor info result', { contractor_info: contractorInfo });

      let daysUntilExpiry: number | undefined = undefined;
      if (quote.expiresAt) {
        const now = new Date();
        const expiry = new Date(quote.expiresAt);
        daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const lineItems: QuoteLineItem[] = quote.quotationLineItems.map((item) => ({
        id: item.id,
        quotation_id: item.quotationId,
        item_name: item.itemName,
        description: item.description || undefined,
        quantity: item.quantity,
        unit_price: parseFloat(item.unitPrice.toString()),
        total_price: item.totalPrice ? parseFloat(item.totalPrice.toString()) : 0,
        units: item.units,
        rabhan_commission: parseFloat(item.rabhanCommission.toString()),
        rabhan_overprice: parseFloat(item.rabhanOverprice.toString()),
        user_price: parseFloat(item.userPrice.toString()),
        vendor_net_price: parseFloat(item.vendorNetPrice.toString()),
        vat: parseFloat(item.vat.toString()),
        line_order: item.lineOrder,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      }));

      const enrichedQuote: EnrichedContractorQuote = {
        id: quote.id,
        request_id: quote.requestId!,
        contractor_id: quote.contractorId,
        base_price: parseFloat(quote.basePrice?.toString() || '0'),
        price_per_kwp: parseFloat(quote.pricePerKwp?.toString() || '0'),
        overprice_amount: parseFloat(quote.overpriceAmount.toString()),
        total_user_price: parseFloat(quote.totalUserPrice?.toString() || '0'),
        system_specs: quote.systemSpecs,
        installation_timeline_days: quote.installationTimelineDays || undefined,
        warranty_terms: quote.warrantyTerms,
        maintenance_terms: quote.maintenanceTerms,
        panels_brand: quote.panelsBrand || undefined,
        panels_model: quote.panelsModel || undefined,
        panels_quantity: quote.panelsQuantity || undefined,
        inverter_brand: quote.inverterBrand || undefined,
        inverter_model: quote.inverterModel || undefined,
        inverter_quantity: quote.inverterQuantity || undefined,
        admin_status: quote.adminStatus,
        status: quote.status,
        created_at: quote.createdAt,
        updated_at: quote.updatedAt,
        expires_at: quote.expiresAt || undefined,
        days_until_expiry: daysUntilExpiry,
        line_items: lineItems.length > 0 ? lineItems : undefined,
        // Add contractor information if available
        contractor_name: contractorInfo?.business_name,
        contractor_company: contractorInfo?.business_name,
        contractor_email: contractorInfo?.email,
        contractor_phone: contractorInfo?.phone,
        contractor_status: contractorInfo?.status,
        contractor_verification_level: contractorInfo?.verification_level,
      };

      if (contractorInfo) {
        logger.debug('Enriched quote with contractor', { contractor_name: contractorInfo.business_name });
      } else {
        logger.warn('No contractor info found for quote', { contractor_id: quote.contractorId });
      }

      logger.info('Quote retrieved and enriched successfully', {
        request_id: requestId,
        contractor_id: contractorId,
        quote_id: quote.id,
      });

      return enrichedQuote;
    } catch (error) {
      logger.error('Failed to get contractor quote by request and contractor', {
        request_id: requestId,
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ request_id: requestId, contractor_id: contractorId });
    }
  }

  /**
   * Get all quotes with optional filters (for admin dashboard)
   */
  async getAllQuotes(filters: GetAdminQuotesFilters = {}): Promise<PaginatedAdminQuotes> {
    const timer = performanceLogger.startTimer('get_all_quotes');

    try {
      const {
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'desc',
        status,
        search,
        contractor_id,
        min_amount,
        max_amount,
      } = filters;

      const skip = (page - 1) * limit;

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { locationAddress: { contains: search, mode: 'insensitive' } },
          { serviceArea: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (contractor_id) {
        where.selectedContractors = {
          has: contractor_id,
        };
      }

      if (min_amount || max_amount) {
        where.systemSizeKwp = {};
        if (min_amount) {
          where.systemSizeKwp.gte = min_amount / 2000; // Convert SAR to kWp (assuming base rate)
        }
        if (max_amount) {
          where.systemSizeKwp.lte = max_amount / 2000;
        }
      }

      const total = await prisma.quoteRequest.count({ where });

      let orderBy: any = {};
      if (sort_by === 'created_at') {
        orderBy.createdAt = sort_order;
      } else if (sort_by === 'updated_at') {
        orderBy.updatedAt = sort_order;
      } else if (sort_by === 'system_size_kwp') {
        orderBy.systemSizeKwp = sort_order;
      } else {
        orderBy.createdAt = sort_order; // default
      }

      const quoteRequests = await prisma.quoteRequest.findMany({
        where,
        include: {
          _count: {
            select: {
              contractorAssignments: true,
              contractorQuotes: true,
            },
          },
          contractorQuotes: {
            where: {
              adminStatus: 'approved',
            },
            select: {
              id: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      const userIds = [...new Set(quoteRequests.map((qr) => qr.userId))];

      const userDetailsMap: { [key: string]: any } = {};

      if (userIds.length > 0) {
        try {
          const users = await userPrisma.$queryRaw<Array<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string;
            phone: string | null;
          }>>`
            SELECT id, first_name, last_name, email, phone
            FROM users
            WHERE id = ANY(${Prisma.raw(`ARRAY['${userIds.join("','")}']::uuid[]`)})
          `;

          users.forEach((user) => {
            userDetailsMap[user.id] = user;
          });
        } catch (userError) {
          logger.warn('Failed to fetch user details from user service', {
            error: userError instanceof Error ? userError.message : 'Unknown error',
          });
        }
      }

      const quotes: AdminQuoteRequest[] = quoteRequests.map((qr) => {
        const propertyDetails =
          typeof qr.propertyDetails === 'string'
            ? JSON.parse(qr.propertyDetails)
            : qr.propertyDetails || {};

        const user = userDetailsMap[qr.userId];

        let userEmail: string;
        let userFirstName: string;
        let userLastName: string;
        let userPhone: string | null;

        if (user) {
          userEmail = user.email || `user-${qr.userId.slice(-8)}@rabhan.sa`;
          userFirstName = user.first_name || 'User';
          userLastName = user.last_name || qr.userId.slice(-4);
          userPhone = user.phone || propertyDetails.contact_phone || null;
        } else {
          const contactEmail =
            propertyDetails.contact_email ||
            propertyDetails.email ||
            `customer-${qr.userId.slice(-8)}@rabhan.sa`;

          const contactName =
            propertyDetails.contact_name || propertyDetails.customer_name || propertyDetails.name;

          if (contactName) {
            const nameParts = contactName.trim().split(' ');
            userFirstName = nameParts[0] || 'Customer';
            userLastName = nameParts.slice(1).join(' ') || qr.userId.slice(-4);
          } else {
            userFirstName = 'Customer';
            userLastName = qr.userId.slice(-4);
          }

          userEmail = contactEmail;
          userPhone = propertyDetails.contact_phone || propertyDetails.phone || null;
        }

        return {
          id: qr.id,
          user_id: qr.userId,
          user_email: userEmail,
          user_first_name: userFirstName,
          user_last_name: userLastName,
          user_phone: userPhone,
          system_size_kwp: parseFloat(qr.systemSizeKwp?.toString() || '0'),
          location_address: qr.locationAddress,
          service_area: qr.serviceArea || '',
          status: qr.status,
          property_details: propertyDetails,
          electricity_consumption: qr.electricityConsumption,
          created_at: qr.createdAt,
          updated_at: qr.updatedAt,
          assigned_contractors_count: qr._count.contractorAssignments,
          received_quotes_count: qr._count.contractorQuotes,
          approved_quotes_count: qr.contractorQuotes.length,
        };
      });

      logger.info('Retrieved all quotes for admin dashboard', {
        total,
        page,
        limit,
        status,
        search,
        returned_count: quotes.length,
      });

      return {
        quotes,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Failed to get all quotes for admin', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
      });
      throw handlePrismaError(error);
    } finally {
      timer.end();
    }
  }

  /**
   * Get a single quote by ID with enhanced user data (for admin)
   */
  async getQuoteById(quoteId: string): Promise<AdminQuoteRequest | null> {
    const timer = performanceLogger.startTimer('get_quote_by_id');

    try {
      const quoteRequest = await prisma.quoteRequest.findUnique({
        where: { id: quoteId },
        include: {
          _count: {
            select: {
              contractorAssignments: true,
              contractorQuotes: true,
            },
          },
          contractorQuotes: {
            where: {
              adminStatus: 'approved',
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!quoteRequest) {
        return null;
      }

      let userDetails: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string;
        phone: string | null;
      } | null = null;

      try {
        const users = await userPrisma.$queryRaw<Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string;
          phone: string | null;
        }>>`
          SELECT id, first_name, last_name, email, phone
          FROM users
          WHERE id = ${quoteRequest.userId}::uuid
        `;

        if (users.length > 0) {
          userDetails = users[0];
        }
      } catch (userError) {
        logger.warn('Failed to fetch user details from user service', {
          user_id: quoteRequest.userId,
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
      }

      const propertyDetails =
        typeof quoteRequest.propertyDetails === 'string'
          ? JSON.parse(quoteRequest.propertyDetails)
          : quoteRequest.propertyDetails || {};

      let userEmail: string;
      let userFirstName: string;
      let userLastName: string;
      let userPhone: string | null;

      if (userDetails) {
        userEmail = userDetails.email || `user-${quoteRequest.userId.slice(-8)}@rabhan.sa`;
        userFirstName = userDetails.first_name || 'User';
        userLastName = userDetails.last_name || quoteRequest.userId.slice(-4);
        userPhone = userDetails.phone || propertyDetails.contact_phone || null;
      } else {
        const contactEmail =
          propertyDetails.contact_email ||
          propertyDetails.email ||
          `customer-${quoteRequest.userId.slice(-8)}@rabhan.sa`;

        const contactName =
          propertyDetails.contact_name || propertyDetails.customer_name || propertyDetails.name;

        if (contactName) {
          const nameParts = contactName.trim().split(' ');
          userFirstName = nameParts[0] || 'Customer';
          userLastName = nameParts.slice(1).join(' ') || quoteRequest.userId.slice(-4);
        } else {
          userFirstName = 'Customer';
          userLastName = quoteRequest.userId.slice(-4);
        }

        userEmail = contactEmail;
        userPhone = propertyDetails.contact_phone || propertyDetails.phone || null;
      }

      const quote: AdminQuoteRequest = {
        id: quoteRequest.id,
        user_id: quoteRequest.userId,
        user_email: userEmail,
        user_first_name: userFirstName,
        user_last_name: userLastName,
        user_phone: userPhone,
        system_size_kwp: parseFloat(quoteRequest.systemSizeKwp?.toString() || '0'),
        location_address: quoteRequest.locationAddress,
        service_area: quoteRequest.serviceArea || '',
        status: quoteRequest.status,
        property_details: propertyDetails,
        electricity_consumption: quoteRequest.electricityConsumption,
        created_at: quoteRequest.createdAt,
        updated_at: quoteRequest.updatedAt,
        assigned_contractors_count: quoteRequest._count.contractorAssignments,
        received_quotes_count: quoteRequest._count.contractorQuotes,
        approved_quotes_count: quoteRequest.contractorQuotes.length,
      };

      logger.info('Retrieved quote details by ID', {
        quote_id: quoteId,
        has_user_data: !!userDetails,
      });

      return quote;
    } catch (error) {
      logger.error('Failed to get quote by ID', {
        quote_id: quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ quote_id: quoteId });
    }
  }

  /**
   * Get contractor assignments for a specific quote (for admin)
   */
  async getQuoteAssignments(quoteId: string): Promise<QuoteAssignment[]> {
    const timer = performanceLogger.startTimer('get_quote_assignments');

    try {
      const assignments = await prisma.contractorQuoteAssignment.findMany({
        where: { requestId: quoteId },
        include: {
          quoteRequest: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      });

      if (assignments.length === 0) {
        logger.info('No assignments found for quote', { quote_id: quoteId });
        return [];
      }

      const contractorIds = assignments.map((a) => a.contractorId);

      const contractorQuotes = await prisma.contractorQuote.findMany({
        where: {
          requestId: quoteId,
          contractorId: { in: contractorIds },
        },
        select: {
          contractorId: true,
          basePrice: true,
          totalUserPrice: true,
          installationTimelineDays: true,
          isSelected: true,
          adminStatus: true,
        },
      });

      const quotesMap = new Map(
        contractorQuotes.map((q) => [
          q.contractorId,
          {
            base_price: q.basePrice ? parseFloat(q.basePrice.toString()) : null,
            total_user_price: q.totalUserPrice ? parseFloat(q.totalUserPrice.toString()) : null,
            installation_timeline_days: q.installationTimelineDays,
            is_selected: q.isSelected,
            quote_status: q.adminStatus,
          },
        ])
      );

      const contractorDetailsMap = await contractorService.enrichContractorDetails(contractorIds);

      const enhancedAssignments: QuoteAssignment[] = assignments.map((assignment) => {
        const contractorInfo = contractorDetailsMap[assignment.contractorId];
        const quoteInfo = quotesMap.get(assignment.contractorId);

        return {
          id: assignment.id,
          request_id: assignment.requestId,
          contractor_id: assignment.contractorId,
          status: assignment.status,
          assigned_at: assignment.assignedAt,
          viewed_at: assignment.viewedAt,
          responded_at: assignment.respondedAt,
          response_notes: assignment.responseNotes,
          // Contractor details
          contractor_company: contractorInfo?.business_name || `Contractor ${assignment.contractorId.slice(-4)}`,
          contractor_email: contractorInfo?.email || `contractor-${assignment.contractorId.slice(-4)}@rabhan.sa`,
          contractor_phone: contractorInfo?.phone || null,
          // Quote details (if submitted)
          base_price: quoteInfo?.base_price || null,
          total_user_price: quoteInfo?.total_user_price || null,
          installation_timeline_days: quoteInfo?.installation_timeline_days || null,
          is_selected: quoteInfo?.is_selected || null,
          quote_status: quoteInfo?.quote_status || null,
        };
      });

      logger.info('Retrieved quote assignments', {
        quote_id: quoteId,
        assignment_count: enhancedAssignments.length,
      });

      return enhancedAssignments;
    } catch (error) {
      logger.error('Failed to get quote assignments', {
        quote_id: quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    } finally {
      timer.end({ quote_id: quoteId });
    }
  }

  /**
   * Get contractor quotes for a specific request (for admin)
   */
  async getContractorQuotesForRequest(quoteId: string): Promise<AdminContractorQuote[]> {
    const timer = performanceLogger.startTimer('get_contractor_quotes_for_request');

    try {
      const contractorQuotes = await prisma.contractorQuote.findMany({
        where: { requestId: quoteId },
        include: {
          quotationLineItems: {
            orderBy: { lineOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (contractorQuotes.length === 0) {
        logger.info('No contractor quotes found for request', { quote_id: quoteId });
        return [];
      }

      const contractorIds = contractorQuotes.map((q) => q.contractorId);

      const contractorDetailsMap = await contractorService.enrichContractorDetails(contractorIds);

      const formattedQuotes: AdminContractorQuote[] = contractorQuotes.map((quote) => {
        const contractorInfo = contractorDetailsMap[quote.contractorId];

        return {
          id: quote.id,
          request_id: quote.requestId,
          contractor_id: quote.contractorId,
          contractor_name: contractorInfo?.business_name || `Contractor ${quote.contractorId.slice(-4)}`,
          contractor_email: contractorInfo?.email || `contractor-${quote.contractorId.slice(-4)}@rabhan.sa`,
          contractor_phone: contractorInfo?.phone || null,
          base_price: parseFloat(quote.basePrice?.toString() || '0'),
          price_per_kwp: parseFloat(quote.pricePerKwp?.toString() || '0'),
          total_user_price: parseFloat(quote.totalUserPrice?.toString() || quote.basePrice?.toString() || '0'),
          overprice_amount: parseFloat(quote.overpriceAmount.toString()),
          system_specs: quote.systemSpecs,
          installation_timeline_days: quote.installationTimelineDays || 30,
          warranty_terms: quote.warrantyTerms,
          maintenance_terms: quote.maintenanceTerms,
          panels_brand: quote.panelsBrand,
          panels_model: quote.panelsModel,
          panels_quantity: quote.panelsQuantity,
          inverter_brand: quote.inverterBrand,
          inverter_model: quote.inverterModel,
          inverter_quantity: quote.inverterQuantity,
          admin_status: quote.adminStatus,
          status: quote.status,
          is_selected: quote.isSelected,
          selected_at: quote.selectedAt,
          expires_at: quote.expiresAt,
          created_at: quote.createdAt,
          updated_at: quote.updatedAt,
          // Additional fields from detailed quotation
          contractor_vat_number: quote.contractorVatNumber,
          payment_terms: quote.paymentTerms,
          installation_deadline: quote.installationDeadline,
          solar_system_capacity_kwp: quote.solarSystemCapacityKwp
            ? parseFloat(quote.solarSystemCapacityKwp.toString())
            : null,
          storage_capacity_kwh: quote.storageCapacityKwh
            ? parseFloat(quote.storageCapacityKwh.toString())
            : null,
          monthly_production_kwh: quote.monthlyProductionKwh
            ? parseFloat(quote.monthlyProductionKwh.toString())
            : null,
          includes_battery: quote.includesBattery,
          includes_monitoring: quote.includesMonitoring,
          includes_maintenance: quote.includesMaintenance,
          // Line items
          line_items: quote.quotationLineItems.map((item) => ({
            id: item.id,
            quotation_id: item.quotationId,
            item_name: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit_price: parseFloat(item.unitPrice.toString()),
            total_price: parseFloat(item.totalPrice?.toString() || '0'),
            units: item.units,
            rabhan_commission: parseFloat(item.rabhanCommission.toString()),
            rabhan_overprice: parseFloat(item.rabhanOverprice.toString()),
            user_price: parseFloat(item.userPrice.toString()),
            vendor_net_price: parseFloat(item.vendorNetPrice.toString()),
            vat: parseFloat(item.vat.toString()),
            line_order: item.lineOrder,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
          })),
        };
      });

      logger.info('Retrieved contractor quotes for request', {
        quote_id: quoteId,
        quotes_count: formattedQuotes.length,
      });

      return formattedQuotes;
    } catch (error) {
      logger.error('Failed to get contractor quotes for request', {
        quote_id: quoteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ quote_id: quoteId });
    }
  }

  /**
   * Approve contractor quote (for admin)
   */
  async approveQuote(quoteId: string, adminId: string, data: ApproveQuoteDTO): Promise<void> {
    const timer = performanceLogger.startTimer('approve_quote');

    try {
      const existingQuote = await prisma.contractorQuote.findUnique({
        where: { id: quoteId },
        select: { id: true, contractorId: true, requestId: true, adminStatus: true },
      });

      if (!existingQuote) {
        throw new NotFoundError('Contractor quote not found');
      }

      await prisma.contractorQuote.update({
        where: { id: quoteId },
        data: {
          adminStatus: 'approved',
          adminNotes: data.admin_notes || '',
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });

      auditLogger.quote('CONTRACTOR_QUOTE_APPROVED', {
        admin_id: adminId,
        quote_id: quoteId,
        contractor_id: existingQuote.contractorId,
        request_id: existingQuote.requestId,
        admin_notes: data.admin_notes,
      });

      logger.info('Contractor quote approved successfully', {
        quote_id: quoteId,
        admin_id: adminId,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to approve contractor quote', {
        quote_id: quoteId,
        admin_id: adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ quote_id: quoteId, admin_id: adminId });
    }
  }

  /**
   * Reject contractor quote (for admin)
   */
  async rejectQuote(quoteId: string, adminId: string, data: RejectQuoteDTO): Promise<void> {
    const timer = performanceLogger.startTimer('reject_quote');

    try {
      // Check if quote exists
      const existingQuote = await prisma.contractorQuote.findUnique({
        where: { id: quoteId },
        select: { id: true, contractorId: true, requestId: true, adminStatus: true },
      });

      if (!existingQuote) {
        throw new NotFoundError('Contractor quote not found');
      }

      // Update quote to rejected
      await prisma.contractorQuote.update({
        where: { id: quoteId },
        data: {
          adminStatus: 'rejected',
          adminNotes: data.admin_notes || '',
          rejectionReason: data.rejection_reason,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });

      auditLogger.quote('CONTRACTOR_QUOTE_REJECTED', {
        admin_id: adminId,
        quote_id: quoteId,
        contractor_id: existingQuote.contractorId,
        request_id: existingQuote.requestId,
        rejection_reason: data.rejection_reason,
        admin_notes: data.admin_notes,
      });

      logger.info('Contractor quote rejected successfully', {
        quote_id: quoteId,
        admin_id: adminId,
        rejection_reason: data.rejection_reason,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to reject contractor quote', {
        quote_id: quoteId,
        admin_id: adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw handlePrismaError(error);
    } finally {
      timer.end({ quote_id: quoteId, admin_id: adminId });
    }
  }

  /**
   * Remove contractor from quote request
   * Removes contractor from selected_contractors array and their inspection schedule
   */
  async removeContractorFromQuote(
    quoteRequestId: string,
    data: RemoveContractorDTO,
    userId: string
  ): Promise<QuoteContractorOperationResponse> {
    const timer = performanceLogger.startTimer('remove_contractor_from_quote');

    try {
      const quoteRequest = await prisma.quoteRequest.findUnique({
        where: { id: quoteRequestId },
      });

      if (!quoteRequest) {
        throw new NotFoundError('Quote request not found');
      }

      if (quoteRequest.userId !== userId) {
        throw new ValidationError('You can only modify your own quote requests');
      }

      const contractorIndex = quoteRequest.selectedContractors.indexOf(data.contractor_id);
      if (contractorIndex === -1) {
        throw new ValidationError('Contractor is not assigned to this quote request');
      }

      const updatedContractors = quoteRequest.selectedContractors.filter(
        (id) => id !== data.contractor_id
      );

      const inspectionDates = quoteRequest.inspectionDates as any;
      const updatedInspectionDates = { ...inspectionDates };

      const contractorsClient = (await import('../lib/contractorsClient')).contractorsClient;
      const contractorSettings = await contractorsClient.$queryRaw<any[]>`
        SELECT id FROM contractor_availability_settings
        WHERE contractor_id = ${data.contractor_id}::uuid AND is_active = TRUE
      `;

      if (contractorSettings.length > 0) {
        const settingsId = contractorSettings[0].id;
        delete updatedInspectionDates[settingsId];
      }

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteRequestId },
        data: {
          selectedContractors: updatedContractors,
          inspectionDates: updatedInspectionDates,
        },
      });

      logger.info('Contractor removed from quote request', {
        quote_request_id: quoteRequestId,
        contractor_id: data.contractor_id,
        user_id: userId,
      });

      return {
        quote_request_id: updated.id,
        selected_contractors: updated.selectedContractors,
        inspection_dates: updated.inspectionDates,
        updated_at: updated.updatedAt,
        message: 'Contractor removed successfully',
      };
    } catch (error) {
      logger.error('Failed to remove contractor from quote', {
        quote_request_id: quoteRequestId,
        contractor_id: data.contractor_id,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ quote_request_id: quoteRequestId, user_id: userId });
    }
  }

  /**
   * Add contractor to existing quote request
   * Adds contractor to selected_contractors array and their inspection schedule
   */
  async addContractorToQuote(
    quoteRequestId: string,
    data: AddContractorDTO,
    userId: string
  ): Promise<QuoteContractorOperationResponse> {
    const timer = performanceLogger.startTimer('add_contractor_to_quote');

    try {
      const quoteRequest = await prisma.quoteRequest.findUnique({
        where: { id: quoteRequestId },
      });

      if (!quoteRequest) {
        throw new NotFoundError('Quote request not found');
      }

      if (quoteRequest.userId !== userId) {
        throw new ValidationError('You can only modify your own quote requests');
      }

      if (quoteRequest.selectedContractors.includes(data.contractor_id)) {
        throw new ValidationError('Contractor is already assigned to this quote request');
      }

      if (quoteRequest.selectedContractors.length >= quoteRequest.maxContractors) {
        throw new ValidationError(
          `Maximum ${quoteRequest.maxContractors} contractors allowed per quote request`
        );
      }

      const updatedContractors = [...quoteRequest.selectedContractors, data.contractor_id];

      const inspectionDates = quoteRequest.inspectionDates as any;
      const updatedInspectionDates = { ...inspectionDates };

      const contractorsClient = (await import('../lib/contractorsClient')).contractorsClient;
      const contractorSettings = await contractorsClient.$queryRaw<any[]>`
        SELECT id FROM contractor_availability_settings
        WHERE contractor_id = ${data.contractor_id}::uuid AND is_active = TRUE
      `;

      if (contractorSettings.length > 0 && data.inspection_schedule) {
        const settingsId = contractorSettings[0].id;
        updatedInspectionDates[settingsId] = data.inspection_schedule;
      }

      const updated = await prisma.quoteRequest.update({
        where: { id: quoteRequestId },
        data: {
          selectedContractors: updatedContractors,
          inspectionDates: updatedInspectionDates,
        },
      });

      logger.info('Contractor added to quote request', {
        quote_request_id: quoteRequestId,
        contractor_id: data.contractor_id,
        user_id: userId,
        inspection_schedule: data.inspection_schedule,
      });

      return {
        quote_request_id: updated.id,
        selected_contractors: updated.selectedContractors,
        inspection_dates: updated.inspectionDates,
        updated_at: updated.updatedAt,
        message: 'Contractor added successfully',
      };
    } catch (error) {
      logger.error('Failed to add contractor to quote', {
        quote_request_id: quoteRequestId,
        contractor_id: data.contractor_id,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ quote_request_id: quoteRequestId, user_id: userId });
    }
  }
}

export const quoteService = new QuoteService();