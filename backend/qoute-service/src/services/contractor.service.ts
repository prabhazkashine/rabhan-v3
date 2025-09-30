import { contractorsClient } from '../lib/contractorsClient';
import { logger } from '../utils/logger';
import {
  ContractorFilters,
  AvailableContractor,
  ContractorAvailability,
} from '../types/contractor.types';

export class ContractorService {
  /**
   * Calculate response time estimate based on availability
   */
  private calculateResponseTimeEstimate(availability: ContractorAvailability): string {
    if (availability.is_available_now) {
      return '< 1 hour';
    }

    const bufferMinutes = availability.buffer_time_remaining || 0;
    if (bufferMinutes < 60) {
      return `~${Math.ceil(bufferMinutes)} minutes`;
    }

    const hours = Math.ceil(bufferMinutes / 60);
    if (hours < 24) {
      return `~${hours} hours`;
    }

    const days = Math.ceil(hours / 24);
    return `~${days} days`;
  }

  /**
   * Get availability for multiple contractors
   * Note: This is a placeholder. You should implement actual availability logic
   * based on your contractor availability table/service
   */
  private async getMultipleContractorsAvailability(
    contractorIds: string[],
    includeSchedule: boolean = true
  ): Promise<ContractorAvailability[]> {
    // TODO: Implement actual availability checking logic
    // For now, return default availability for all contractors
    return contractorIds.map((contractorId) => ({
      contractor_id: contractorId,
      is_available_now: true,
      availability_status: 'available',
      buffer_between_quotes_minutes: 60,
      max_quotes_per_day: 5,
      buffer_time_remaining: 0,
    }));
  }

  /**
   * Fetch contractor information by ID
   */
  async fetchContractorInfo(contractorId: string): Promise<{
    id: string;
    email: string;
    phone: string;
    business_name: string;
    status: string;
    verification_level: number;
  } | null> {
    try {
      const query = `
        SELECT
          c.id,
          c.email,
          c.phone,
          c.status,
          c.company_name as business_name,
          p.verification_level
        FROM contractors c
        LEFT JOIN contractors_profiles p ON c.id = p.user_id
        WHERE c.id = $1
      `;

      const result: any[] = await contractorsClient.$queryRawUnsafe(query, contractorId);

      if (!result || result.length === 0) {
        logger.warn('Contractor not found', { contractor_id: contractorId });
        return null;
      }

      const contractor = result[0];
      return {
        id: contractor.id,
        email: contractor.email,
        phone: contractor.phone || '',
        business_name: contractor.business_name || '',
        status: contractor.status,
        verification_level: contractor.verification_level || 1,
      };
    } catch (error) {
      logger.error('Failed to fetch contractor info', {
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Enrich multiple contractors with their details
   */
  async enrichContractorDetails(contractorIds: string[]): Promise<Record<string, any>> {
    try {
      if (!contractorIds || contractorIds.length === 0) {
        logger.debug('No contractor IDs provided for enrichment');
        return {};
      }

      logger.info('Enriching contractor details', {
        contractor_ids: contractorIds,
        count: contractorIds.length,
      });

      // Use Prisma's parameterized query with proper UUID casting
      const placeholders = contractorIds.map((_, index) => `$${index + 1}::uuid`).join(', ');

      const query = `
        SELECT
          c.id,
          c.email,
          c.phone,
          c.status,
          c.company_name as business_name,
          p.company_name_arabic as business_name_ar,
          p.verification_level
        FROM contractors c
        LEFT JOIN contractors_profiles p ON c.id = p.user_id
        WHERE c.id IN (${placeholders})
      `;

      logger.debug('Executing contractor enrichment query', { query, params: contractorIds });

      const result: any[] = await contractorsClient.$queryRawUnsafe(query, ...contractorIds);

      logger.info('Contractor query result', {
        requested_ids: contractorIds,
        found_count: result.length,
        found_ids: result.map((r) => r.id),
      });

      // Create a map of contractor_id -> contractor details
      const contractorMap: Record<string, any> = {};

      result.forEach((contractor) => {
        contractorMap[contractor.id] = {
          id: contractor.id,
          business_name: contractor.business_name || '',
          business_name_ar: contractor.business_name_ar || contractor.business_name || '',
          status: contractor.status?.toLowerCase() || 'active',
          verification_level: contractor.verification_level || 1,
          email: contractor.email,
          phone: contractor.phone || '',
          user_type: 'contractor', // Default value since column doesn't exist in contractors table
        };
      });

      logger.info('Successfully enriched contractor details', {
        requested_count: contractorIds.length,
        found_count: Object.keys(contractorMap).length,
        contractor_map_keys: Object.keys(contractorMap),
      });

      return contractorMap;
    } catch (error) {
      logger.error('Failed to enrich contractor details', {
        contractor_ids: contractorIds,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {};
    }
  }

  /**
   * Get available contractors with filters
   */
  async getAvailableContractors(filters: ContractorFilters): Promise<AvailableContractor[]> {
    try {
      logger.info('Getting available contractors', { filters });

      // Only get ACTIVE and PENDING contractors
      const contractorsQuery = `
        SELECT
          c.id,
          c.email,
          c.phone,
          c.status,
          c.company_name,
          c.cr_number,
          c.vat_number,
          c.business_type,
          c.sama_verified,
          c.created_at,
          p.company_name_arabic,
          p.city,
          p.region,
          p.service_areas,
          p.service_categories,
          p.years_experience,
          p.verification_level,
          p.average_rating,
          p.total_reviews,
          p.completed_projects,
          p.total_projects
        FROM contractors c
        LEFT JOIN contractors_profiles p ON c.id = p.user_id
        WHERE c.status IN ('ACTIVE', 'PENDING')
        ORDER BY c.created_at DESC
      `;

      const contractors: any[] = await contractorsClient.$queryRawUnsafe(contractorsQuery);

      if (!contractors || contractors.length === 0) {
        logger.warn('No contractors found in contractors database');
        return [];
      }

      logger.info(`Found ${contractors.length} contractors with auth accounts`);

      const contractorIds = contractors.map((c: any) => c.id);

      const availabilityData = await this.getMultipleContractorsAvailability(
        contractorIds,
        true
      );

      const availabilityMap = new Map<string, ContractorAvailability>();
      availabilityData.forEach((avail) => {
        availabilityMap.set(avail.contractor_id, avail);
      });

      const availableContractors: AvailableContractor[] = contractors.map((contractor: any) => {
        const availability = availabilityMap.get(contractor.id) || {
          contractor_id: contractor.id,
          is_available_now: false,
          availability_status: 'unknown',
          buffer_between_quotes_minutes: 60,
          max_quotes_per_day: 5,
        };

        return {
          id: contractor.id,
          email: contractor.email,
          phone: contractor.phone || '',
          status: contractor.status,
          business_name: contractor.company_name,
          business_name_ar: contractor.company_name_arabic || contractor.company_name,
          company_name: contractor.company_name,
          business_type: contractor.business_type,
          cr_number: contractor.cr_number || '',
          vat_number: contractor.vat_number || '',
          verification_level: contractor.sama_verified ? 3 : contractor.verification_level || 1,
          average_rating: contractor.average_rating ? parseFloat(contractor.average_rating) : 4.5,
          total_reviews: contractor.total_reviews || 10,
          completed_projects: contractor.completed_projects || 5,
          total_projects: contractor.total_projects || 5,
          years_experience: contractor.years_experience || 5,
          city: contractor.city || 'Riyadh',
          region: contractor.region || 'Riyadh Region',
          service_areas: contractor.service_areas || ['Riyadh', 'Riyadh Region'],
          service_categories: contractor.service_categories || ['residential_solar'],
          created_at: contractor.created_at,
          availability: {
            is_currently_available: availability.is_available_now,
            availability_status: availability.availability_status,
            buffer_between_quotes_minutes: availability.buffer_between_quotes_minutes,
            max_quotes_per_day: availability.max_quotes_per_day,
            next_available_time: availability.next_available_time,
            buffer_time_remaining: availability.buffer_time_remaining,
            working_hours_today: availability.working_hours_today,
            last_seen_at: availability.last_seen_at,
            response_time_estimate: this.calculateResponseTimeEstimate(availability),
          },
        };
      });

      // Apply filters
      let filteredContractors = availableContractors;

      // Filter by region
      if (filters.region) {
        filteredContractors = filteredContractors.filter((c) =>
          c.region.toLowerCase().includes(filters.region!.toLowerCase())
        );
      }

      // Filter by city
      if (filters.city) {
        filteredContractors = filteredContractors.filter((c) =>
          c.city.toLowerCase().includes(filters.city!.toLowerCase())
        );
      }

      // Filter by minimum rating
      if (filters.min_rating) {
        filteredContractors = filteredContractors.filter(
          (c) => c.average_rating >= filters.min_rating!
        );
      }

      // Filter by verification level
      if (filters.verification_level) {
        filteredContractors = filteredContractors.filter(
          (c) => c.verification_level >= filters.verification_level!
        );
      }

      // Sort contractors
      filteredContractors.sort((a, b) => {
        // Priority 1: Available contractors first
        if (
          a.availability.is_currently_available &&
          !b.availability.is_currently_available
        ) {
          return -1;
        }
        if (
          !a.availability.is_currently_available &&
          b.availability.is_currently_available
        ) {
          return 1;
        }

        // Priority 2: Shorter buffer time remaining
        const aBuffer = a.availability.buffer_time_remaining || 0;
        const bBuffer = b.availability.buffer_time_remaining || 0;
        if (aBuffer !== bBuffer) {
          return aBuffer - bBuffer;
        }

        // Priority 3: Custom sorting criteria
        if (filters.sort_by === 'average_rating') {
          return filters.sort_order === 'desc'
            ? b.average_rating - a.average_rating
            : a.average_rating - b.average_rating;
        }

        // Default: Sort by created date
        return filters.sort_order === 'desc'
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // Apply limit
      const limited = filteredContractors.slice(0, filters.limit || 20);

      logger.info(`Returning ${limited.length} available contractors`, {
        total_contractors: contractors.length,
        filtered_contractors: limited.length,
      });

      return limited;
    } catch (error) {
      logger.error('Failed to get available contractors', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        filters,
      });
      throw error;
    }
  }
}

export const contractorService = new ContractorService();