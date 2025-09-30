// Contractor filters for querying
export interface ContractorFilters {
  region?: string;
  city?: string;
  min_rating?: number;
  verification_level?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Contractor availability information
export interface ContractorAvailability {
  contractor_id: string;
  is_available_now: boolean;
  availability_status: string;
  buffer_between_quotes_minutes: number;
  max_quotes_per_day: number;
  next_available_time?: string;
  buffer_time_remaining?: number;
  working_hours_today?: any;
  last_seen_at?: string;
}

// Available contractor response
export interface AvailableContractor {
  id: string;
  email: string;
  phone: string;
  status: string;
  business_name: string;
  business_name_ar: string;
  company_name: string;
  business_type: string;
  cr_number: string;
  vat_number: string;
  verification_level: number;
  average_rating: number;
  total_reviews: number;
  completed_projects: number;
  total_projects: number;
  years_experience: number;
  city: string;
  region: string;
  service_areas: string[];
  service_categories: string[];
  created_at: Date;
  availability: {
    is_currently_available: boolean;
    availability_status: string;
    buffer_between_quotes_minutes: number;
    max_quotes_per_day: number;
    next_available_time?: string;
    buffer_time_remaining?: number;
    working_hours_today?: any;
    last_seen_at?: string;
    response_time_estimate?: string;
  };
}

// Contractor from auth database
export interface ContractorAuthRecord {
  id: string;
  company_name: string;
  cr_number: string;
  vat_number: string;
  business_type: string;
  email: string;
  phone: string;
  status: string;
  created_at: Date;
  sama_verified?: boolean;
}