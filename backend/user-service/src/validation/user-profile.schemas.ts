import { z } from 'zod';
import {
  PropertyType,
  PropertyOwnership,
  ElectricityConsumptionRange,
  PreferredLanguage,
  EmploymentStatus,
  ProfileVerificationStatus
} from '@prisma/client';

export const updateUserProfileSchema = z.object({
  // Personal Information
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces')
    .optional(),

  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces')
    .optional(),

  // Address Information
  region: z.string()
    .min(2, 'Region must be at least 2 characters')
    .max(100, 'Region cannot exceed 100 characters')
    .optional(),

  city: z.string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City cannot exceed 100 characters')
    .optional(),

  district: z.string()
    .min(2, 'District must be at least 2 characters')
    .max(100, 'District cannot exceed 100 characters')
    .optional(),

  streetAddress: z.string()
    .min(5, 'Street address must be at least 5 characters')
    .max(255, 'Street address cannot exceed 255 characters')
    .optional(),

  landmark: z.string()
    .max(255, 'Landmark cannot exceed 255 characters')
    .optional()
    .nullable(),

  postalCode: z.string()
    .max(10, 'Postal code cannot exceed 10 characters')
    .optional(),

  // Property & Energy Information
  propertyType: z.nativeEnum(PropertyType).optional(),

  propertyOwnership: z.nativeEnum(PropertyOwnership).optional(),

  roofSize: z.number()
    .positive('Roof size must be a positive number')
    .max(10000, 'Roof size cannot exceed 10000 square meters')
    .multipleOf(0.01, 'Roof size can have up to 2 decimal places')
    .optional(),

  gpsLatitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .multipleOf(0.00000001, 'Latitude precision too high')
    .optional(),

  gpsLongitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .multipleOf(0.00000001, 'Longitude precision too high')
    .optional(),

  electricityConsumption: z.nativeEnum(ElectricityConsumptionRange).optional(),

  electricityMeterNumber: z.string()
    .min(5, 'Electricity meter number must be at least 5 characters')
    .max(50, 'Electricity meter number cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Electricity meter number can only contain letters and numbers')
    .optional(),

  // Employment Information (optional for BNPL eligibility)
  employmentStatus: z.nativeEnum(EmploymentStatus).optional().nullable(),

  employerName: z.string()
    .min(2, 'Employer name must be at least 2 characters')
    .max(255, 'Employer name cannot exceed 255 characters')
    .optional()
    .nullable(),

  jobTitle: z.string()
    .min(2, 'Job title must be at least 2 characters')
    .max(255, 'Job title cannot exceed 255 characters')
    .optional()
    .nullable(),

  monthlyIncome: z.number()
    .positive('Monthly income must be a positive number')
    .max(1000000, 'Monthly income cannot exceed 1,000,000')
    .multipleOf(0.01, 'Monthly income can have up to 2 decimal places')
    .optional()
    .nullable(),

  yearsEmployed: z.number()
    .int('Years employed must be a whole number')
    .min(0, 'Years employed cannot be negative')
    .max(50, 'Years employed cannot exceed 50 years')
    .optional()
    .nullable(),

  // Solar System Preferences
  desiredSystemSize: z.number()
    .positive('Desired system size must be a positive number')
    .max(1000, 'Desired system size cannot exceed 1000 kW')
    .multipleOf(0.01, 'Desired system size can have up to 2 decimal places')
    .optional()
    .nullable(),

  budgetRange: z.string()
    .max(50, 'Budget range cannot exceed 50 characters')
    .optional()
    .nullable(),

  // Preferences
  preferredLanguage: z.nativeEnum(PreferredLanguage).optional(),

  emailNotifications: z.boolean().optional(),

  smsNotifications: z.boolean().optional(),

  marketingConsent: z.boolean().optional(),
});

export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileSchema>;