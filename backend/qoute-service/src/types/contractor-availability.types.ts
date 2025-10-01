/**
 * Day schedule for contractor availability
 */
export interface DaySchedule {
  working: boolean;
  start_time?: string;
  end_time?: string;
  start?: string; // Legacy field for backward compatibility
  end?: string;   // Legacy field for backward compatibility
}

/**
 * Weekly schedule for contractor
 */
export interface WeeklySchedule {
  sunday: DaySchedule;
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
}

/**
 * Update weekly schedule DTO
 */
export interface UpdateWeeklyScheduleDTO {
  weekly_schedule?: WeeklySchedule;
  weekly_hours?: WeeklySchedule; // Legacy support
  buffer_between_quotes_minutes?: number;
  max_quotes_per_day?: number;
}

/**
 * Contractor availability settings
 */
export interface ContractorAvailabilitySettings {
  contractor_id: string;
  weekly_schedule: WeeklySchedule;
  buffer_between_quotes_minutes: number;
  max_quotes_per_day: number;
  advance_notice_hours: number | null;
  preferred_contact_method: string | null;
  response_time_hours: number | null;
  is_currently_available: boolean;
  status_message: string | null;
  current_status: string;
  status_until: Date | null;
  unavailable_reason: string | null;
  last_seen_at: Date | null;
  last_quote_received_at: Date | null;
  timezone: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Public contractor availability response (for users to view)
 */
export interface ContractorAvailabilityResponse {
  contractor_id: string;
  is_available_now: boolean;
  availability_status: string;
  buffer_between_quotes_minutes: number;
  max_quotes_per_day: number;
  current_quotes_today: number;
  next_available_time: string | null;
  weekly_schedule?: WeeklySchedule;
}

/**
 * Day schedule with available time slots
 */
export interface DayScheduleWithSlots extends DaySchedule {
  available_slots?: string[];
  booked_slots?: string[];
}

/**
 * Weekly schedule with available time slots
 */
export interface WeeklyScheduleWithSlots {
  sunday: DayScheduleWithSlots;
  monday: DayScheduleWithSlots;
  tuesday: DayScheduleWithSlots;
  wednesday: DayScheduleWithSlots;
  thursday: DayScheduleWithSlots;
  friday: DayScheduleWithSlots;
  saturday: DayScheduleWithSlots;
}

/**
 * Contractor availability with time slots response
 */
export interface ContractorAvailabilityWithSlotsResponse {
  contractor_id: string;
  is_available_now: boolean;
  availability_status: string;
  buffer_between_quotes_minutes: number;
  max_quotes_per_day: number;
  current_quotes_today: number;
  next_available_time: string | null;
  weekly_schedule: WeeklyScheduleWithSlots;
}
