import { contractorsClient } from '../lib/contractorsClient';
import { logger, performanceLogger } from '../utils/logger';
import { ContractorAvailabilitySettings, DaySchedule, WeeklySchedule, UpdateWeeklyScheduleDTO, ContractorAvailabilityResponse } from '../types/contractor-availability.types';
import { prisma } from '../lib/prisma';

export class ContractorAvailabilityService {
  /**
   * Get contractor's availability settings
   */
  async getAvailabilitySettings(contractorId: string): Promise<ContractorAvailabilitySettings> {
    const timer = performanceLogger.startTimer('get_availability_settings');

    try {
      const result = await contractorsClient.$queryRaw<any[]>`
        SELECT
          cas.*,
          cqs.current_status,
          cqs.status_until,
          cqs.unavailable_reason,
          cqs.last_seen_at,
          cqs.last_quote_received_at
        FROM contractor_availability_settings cas
        LEFT JOIN contractor_quick_status cqs ON cas.contractor_id = cqs.contractor_id
        WHERE cas.contractor_id = ${contractorId}::uuid AND cas.is_active = TRUE
      `;

      if (result.length === 0) {
        // Create default settings if not exists
        return await this.createDefaultAvailabilitySettings(contractorId);
      }

      return this.formatAvailabilitySettings(result[0]);
    } catch (error) {
      logger.error('Failed to get availability settings', {
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Create default availability settings for contractor
   */
  private async createDefaultAvailabilitySettings(contractorId: string): Promise<ContractorAvailabilitySettings> {
    try {
      const insertResult = await contractorsClient.$queryRaw<any[]>`
        INSERT INTO contractor_availability_settings (
          id,
          contractor_id,
          monday_start, monday_end,
          tuesday_start, tuesday_end,
          wednesday_start, wednesday_end,
          thursday_start, thursday_end,
          sunday_start, sunday_end,
          buffer_between_quotes_minutes,
          max_quotes_per_day,
          advance_notice_hours,
          preferred_contact_method,
          response_time_hours,
          is_currently_available,
          timezone,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          ${contractorId}::uuid,
          '08:00', '17:00',
          '08:00', '17:00',
          '08:00', '17:00',
          '08:00', '17:00',
          '08:00', '17:00',
          60,
          5,
          4,
          'phone',
          2,
          TRUE,
          'Asia/Riyadh',
          TRUE,
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      await contractorsClient.$queryRaw`
        INSERT INTO contractor_quick_status (
          id,
          contractor_id,
          current_status,
          last_seen_at,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${contractorId}::uuid,
          'available',
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (contractor_id) DO NOTHING
      `;

      logger.info('Default availability settings created', { contractor_id: contractorId });

      const result = await contractorsClient.$queryRaw<any[]>`
        SELECT
          cas.*,
          cqs.current_status,
          cqs.status_until,
          cqs.unavailable_reason,
          cqs.last_seen_at,
          cqs.last_quote_received_at
        FROM contractor_availability_settings cas
        LEFT JOIN contractor_quick_status cqs ON cas.contractor_id = cqs.contractor_id
        WHERE cas.contractor_id = ${contractorId}::uuid
      `;

      return this.formatAvailabilitySettings(result[0]);
    } catch (error) {
      logger.error('Failed to create default availability settings', {
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Format availability settings from database row
   */
  private formatAvailabilitySettings(row: any): ContractorAvailabilitySettings {
    return {
      contractor_id: row.contractor_id,
      weekly_schedule: {
        sunday: this.formatDaySchedule(row.sunday_start, row.sunday_end),
        monday: this.formatDaySchedule(row.monday_start, row.monday_end),
        tuesday: this.formatDaySchedule(row.tuesday_start, row.tuesday_end),
        wednesday: this.formatDaySchedule(row.wednesday_start, row.wednesday_end),
        thursday: this.formatDaySchedule(row.thursday_start, row.thursday_end),
        friday: this.formatDaySchedule(row.friday_start, row.friday_end),
        saturday: this.formatDaySchedule(row.saturday_start, row.saturday_end),
      },
      buffer_between_quotes_minutes: row.buffer_between_quotes_minutes,
      max_quotes_per_day: row.max_quotes_per_day,
      advance_notice_hours: row.advance_notice_hours,
      preferred_contact_method: row.preferred_contact_method,
      response_time_hours: row.response_time_hours,
      is_currently_available: row.is_currently_available,
      status_message: row.status_message,
      current_status: row.current_status || 'available',
      status_until: row.status_until,
      unavailable_reason: row.unavailable_reason,
      last_seen_at: row.last_seen_at,
      last_quote_received_at: row.last_quote_received_at,
      timezone: row.timezone || 'Asia/Riyadh',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Format day schedule
   */
  private formatDaySchedule(startTime: string | null, endTime: string | null): DaySchedule {
    if (!startTime || !endTime) {
      return { working: false };
    }

    return {
      working: true,
      start_time: startTime,
      end_time: endTime,
      // Keep legacy fields for backward compatibility
      start: startTime,
      end: endTime,
    };
  }

  /**
   * Update contractor's weekly schedule
   */
  async updateWeeklySchedule(
    contractorId: string,
    updateData: UpdateWeeklyScheduleDTO
  ): Promise<ContractorAvailabilitySettings> {
    const timer = performanceLogger.startTimer('update_weekly_schedule');

    try {
      const weeklySchedule = updateData.weekly_schedule || updateData.weekly_hours;

      if (weeklySchedule) {
        this.validateWeeklySchedule(weeklySchedule);
      }

      if (updateData.buffer_between_quotes_minutes !== undefined) {
        if (updateData.buffer_between_quotes_minutes < 30 || updateData.buffer_between_quotes_minutes > 60) {
          throw new Error('Buffer time must be between 30 and 60 minutes');
        }
      }

      if (updateData.max_quotes_per_day !== undefined) {
        if (updateData.max_quotes_per_day < 1 || updateData.max_quotes_per_day > 20) {
          throw new Error('Max quotes per day must be between 1 and 20');
        }
      }

      const updateParts: string[] = [];

      if (weeklySchedule) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        for (const day of days) {
          const daySchedule = weeklySchedule[day as keyof WeeklySchedule];
          if (daySchedule !== undefined) {
            const startTime = daySchedule.start_time || daySchedule.start;
            const endTime = daySchedule.end_time || daySchedule.end;

            if (daySchedule.working && startTime && endTime) {
              updateParts.push(`${day}_start = '${startTime}'`);
              updateParts.push(`${day}_end = '${endTime}'`);
            } else {
              updateParts.push(`${day}_start = NULL`);
              updateParts.push(`${day}_end = NULL`);
            }
          }
        }
      }

      if (updateData.buffer_between_quotes_minutes !== undefined) {
        updateParts.push(`buffer_between_quotes_minutes = ${updateData.buffer_between_quotes_minutes}`);
      }

      if (updateData.max_quotes_per_day !== undefined) {
        updateParts.push(`max_quotes_per_day = ${updateData.max_quotes_per_day}`);
      }

      if (updateParts.length === 0) {
        throw new Error('No valid updates provided');
      }

      updateParts.push('updated_at = NOW()');

      // Execute update using raw SQL
      const updateSQL = `
        UPDATE contractor_availability_settings
        SET ${updateParts.join(', ')}
        WHERE contractor_id = '${contractorId}' AND is_active = TRUE
      `;

      await contractorsClient.$executeRawUnsafe(updateSQL);

      logger.info('Weekly schedule updated', {
        contractor_id: contractorId,
        updates: Object.keys(updateData),
      });

      // Return updated settings
      return await this.getAvailabilitySettings(contractorId);
    } catch (error) {
      logger.error('Failed to update weekly schedule', {
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Validate weekly schedule format and time ranges
   */
  private validateWeeklySchedule(weeklySchedule: WeeklySchedule): void {
    const days: (keyof WeeklySchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const day of days) {
      const daySchedule = weeklySchedule[day];
      if (!daySchedule) continue;

      if (daySchedule.working) {
        const startTime = daySchedule.start_time || daySchedule.start;
        const endTime = daySchedule.end_time || daySchedule.end;

        if (!startTime || !endTime) {
          throw new Error(`${day}: Start and end times are required when working is true`);
        }

        // Validate time format
        if (!timeRegex.test(startTime)) {
          throw new Error(`${day}: Invalid start time format. Use HH:MM format`);
        }
        if (!timeRegex.test(endTime)) {
          throw new Error(`${day}: Invalid end time format. Use HH:MM format`);
        }

        // Validate time range
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          throw new Error(`${day}: End time must be after start time`);
        }
      }
    }
  }

  /**
   * Get availability for a specific contractor (public method for users)
   */
  async getContractorAvailability(
    contractorId: string,
    includeSchedule: boolean = true
  ): Promise<ContractorAvailabilityResponse> {
    const timer = performanceLogger.startTimer('get_contractor_availability');

    try {
      const result = await contractorsClient.$queryRaw<any[]>`
        SELECT
          cas.*,
          cqs.current_status,
          cqs.status_until,
          cqs.unavailable_reason,
          cqs.last_seen_at,
          cqs.last_quote_received_at
        FROM contractor_availability_settings cas
        LEFT JOIN contractor_quick_status cqs ON cas.contractor_id = cqs.contractor_id
        WHERE cas.contractor_id = ${contractorId}::uuid AND cas.is_active = TRUE
      `;

      if (result.length === 0) {
        // Create default settings for this contractor if they don't exist
        const defaultSettings = await this.createDefaultAvailabilitySettings(contractorId);
        return {
          contractor_id: contractorId,
          is_available_now: defaultSettings.is_currently_available,
          availability_status: 'available',
          buffer_between_quotes_minutes: defaultSettings.buffer_between_quotes_minutes,
          max_quotes_per_day: defaultSettings.max_quotes_per_day,
          current_quotes_today: 0,
          next_available_time: null,
          weekly_schedule: includeSchedule ? defaultSettings.weekly_schedule : undefined,
        };
      }

      const row = result[0];

      const availability: ContractorAvailabilityResponse = {
        contractor_id: contractorId,
        is_available_now:
          row.is_currently_available && (row.current_status === 'available' || !row.current_status),
        availability_status: row.current_status || 'available',
        buffer_between_quotes_minutes: row.buffer_between_quotes_minutes,
        max_quotes_per_day: row.max_quotes_per_day,
        current_quotes_today: 0, // TODO: Calculate actual quotes today
        next_available_time: null, // TODO: Calculate next available time
      };

      if (includeSchedule) {
        availability.weekly_schedule = {
          sunday: this.formatDaySchedule(row.sunday_start, row.sunday_end),
          monday: this.formatDaySchedule(row.monday_start, row.monday_end),
          tuesday: this.formatDaySchedule(row.tuesday_start, row.tuesday_end),
          wednesday: this.formatDaySchedule(row.wednesday_start, row.wednesday_end),
          thursday: this.formatDaySchedule(row.thursday_start, row.thursday_end),
          friday: this.formatDaySchedule(row.friday_start, row.friday_end),
          saturday: this.formatDaySchedule(row.saturday_start, row.saturday_end),
        };
      }

      return availability;
    } catch (error) {
      logger.error('Failed to get contractor availability', {
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Get contractor availability with available time slots for a specific date
   * This checks existing bookings and returns only available time slots
   */
  async getAvailableTimeSlots(
    contractorId: string,
    date: string
  ): Promise<{
    contractor_id: string;
    date: string;
    day_of_week: string;
    is_working_day: boolean;
    buffer_between_quotes_minutes: number;
    max_quotes_per_day: number;
    start_time: string | null;
    end_time: string | null;
    available_slots: string[];
    booked_slots: string[];
    remaining_slots_count: number;
  }> {
    const timer = performanceLogger.startTimer('get_available_time_slots');

    try {
      // Parse the date
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];

      // Get contractor availability settings
      const result = await contractorsClient.$queryRaw<any[]>`
        SELECT
          cas.*,
          cqs.current_status,
          cqs.status_until
        FROM contractor_availability_settings cas
        LEFT JOIN contractor_quick_status cqs ON cas.contractor_id = cqs.contractor_id
        WHERE cas.contractor_id = ${contractorId}::uuid AND cas.is_active = TRUE
      `;

      if (result.length === 0) {
        // Create default settings if not found
        await this.createDefaultAvailabilitySettings(contractorId);
        return await this.getAvailableTimeSlots(contractorId, date);
      }

      const row = result[0];
      const bufferMinutes = row.buffer_between_quotes_minutes || 60;
      const maxQuotesPerDay = row.max_quotes_per_day || 5;

      // Get start and end times for the specific day
      const startTimeField = `${dayName}_start`;
      const endTimeField = `${dayName}_end`;
      const startTime = row[startTimeField];
      const endTime = row[endTimeField];

      if (!startTime || !endTime) {
        return {
          contractor_id: contractorId,
          date,
          day_of_week: dayName,
          is_working_day: false,
          buffer_between_quotes_minutes: bufferMinutes,
          max_quotes_per_day: maxQuotesPerDay,
          start_time: null,
          end_time: null,
          available_slots: [],
          booked_slots: [],
          remaining_slots_count: 0,
        };
      }

      // Generate all possible time slots based on buffer
      const allSlots: string[] = [];
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      let currentMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      while (currentMinutes < endMinutes) {
        const hour = Math.floor(currentMinutes / 60);
        const min = currentMinutes % 60;
        allSlots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        currentMinutes += bufferMinutes;
      }

      // First, get the availability settings ID for this contractor
      const availabilitySettingsId = row.id;

      // Get all booked inspection times for this contractor on this specific date
      const dateStr = targetDate.toISOString().split('T')[0];
      const bookedSlots = await prisma.$queryRaw<any[]>`
        SELECT
          qr.inspection_dates
        FROM quote_requests qr
        WHERE qr.selected_contractors @> ARRAY[${contractorId}]::uuid[]
          AND qr.status NOT IN ('cancelled', 'rejected')
      `;

      // Extract booked times for the specific date
      const bookedTimes = new Set<string>();

      for (const booking of bookedSlots) {
        // inspection_dates is stored as JSON object: { "availability_settings_id": "datetime", ... }
        if (booking.inspection_dates && typeof booking.inspection_dates === 'object') {
          // Check if this contractor's availability settings ID has a booking
          const bookingTime = booking.inspection_dates[availabilitySettingsId];

          if (bookingTime) {
            // Parse the ISO string to extract date and time in UTC
            const bookingTimeStr = bookingTime.toString();
            const inspectionDateStr = bookingTimeStr.split('T')[0]; // YYYY-MM-DD

            if (inspectionDateStr === dateStr) {
              // Extract time from ISO string (HH:MM from "YYYY-MM-DDTHH:MM:SS")
              const timePart = bookingTimeStr.split('T')[1]; // "HH:MM:SS..." or "HH:MM:SS.sssZ"
              const timeKey = timePart.substring(0, 5); // "HH:MM"
              bookedTimes.add(timeKey);
            }
          }
        }
      }

      // Calculate available slots
      const availableSlots = allSlots.filter(slot => !bookedTimes.has(slot));

      return {
        contractor_id: contractorId,
        date,
        day_of_week: dayName,
        is_working_day: true,
        buffer_between_quotes_minutes: bufferMinutes,
        max_quotes_per_day: maxQuotesPerDay,
        start_time: startTime,
        end_time: endTime,
        available_slots: availableSlots,
        booked_slots: Array.from(bookedTimes),
        remaining_slots_count: availableSlots.length,
      };
    } catch (error) {
      logger.error('Failed to get available time slots', {
        contractor_id: contractorId,
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }
}

export const contractorAvailabilityService = new ContractorAvailabilityService();
