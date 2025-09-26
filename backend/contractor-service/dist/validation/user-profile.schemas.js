"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfileSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.updateUserProfileSchema = zod_1.z.object({
    // Personal Information
    firstName: zod_1.z.string()
        .min(2, 'First name must be at least 2 characters')
        .max(100, 'First name cannot exceed 100 characters')
        .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces')
        .optional(),
    lastName: zod_1.z.string()
        .min(2, 'Last name must be at least 2 characters')
        .max(100, 'Last name cannot exceed 100 characters')
        .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces')
        .optional(),
    // Address Information
    region: zod_1.z.string()
        .min(2, 'Region must be at least 2 characters')
        .max(100, 'Region cannot exceed 100 characters')
        .optional(),
    city: zod_1.z.string()
        .min(2, 'City must be at least 2 characters')
        .max(100, 'City cannot exceed 100 characters')
        .optional(),
    district: zod_1.z.string()
        .min(2, 'District must be at least 2 characters')
        .max(100, 'District cannot exceed 100 characters')
        .optional(),
    streetAddress: zod_1.z.string()
        .min(5, 'Street address must be at least 5 characters')
        .max(255, 'Street address cannot exceed 255 characters')
        .optional(),
    landmark: zod_1.z.string()
        .max(255, 'Landmark cannot exceed 255 characters')
        .optional()
        .nullable(),
    postalCode: zod_1.z.string()
        .max(10, 'Postal code cannot exceed 10 characters')
        .optional(),
    // Property & Energy Information
    propertyType: zod_1.z.nativeEnum(client_1.PropertyType).optional(),
    propertyOwnership: zod_1.z.nativeEnum(client_1.PropertyOwnership).optional(),
    roofSize: zod_1.z.number()
        .positive('Roof size must be a positive number')
        .max(10000, 'Roof size cannot exceed 10000 square meters')
        .multipleOf(0.01, 'Roof size can have up to 2 decimal places')
        .optional(),
    gpsLatitude: zod_1.z.number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .multipleOf(0.00000001, 'Latitude precision too high')
        .optional(),
    gpsLongitude: zod_1.z.number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .multipleOf(0.00000001, 'Longitude precision too high')
        .optional(),
    electricityConsumption: zod_1.z.nativeEnum(client_1.ElectricityConsumptionRange).optional(),
    electricityMeterNumber: zod_1.z.string()
        .min(5, 'Electricity meter number must be at least 5 characters')
        .max(50, 'Electricity meter number cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9]+$/, 'Electricity meter number can only contain letters and numbers')
        .optional(),
    // Employment Information (optional for BNPL eligibility)
    employmentStatus: zod_1.z.nativeEnum(client_1.EmploymentStatus).optional().nullable(),
    employerName: zod_1.z.string()
        .min(2, 'Employer name must be at least 2 characters')
        .max(255, 'Employer name cannot exceed 255 characters')
        .optional()
        .nullable(),
    jobTitle: zod_1.z.string()
        .min(2, 'Job title must be at least 2 characters')
        .max(255, 'Job title cannot exceed 255 characters')
        .optional()
        .nullable(),
    monthlyIncome: zod_1.z.number()
        .positive('Monthly income must be a positive number')
        .max(1000000, 'Monthly income cannot exceed 1,000,000')
        .multipleOf(0.01, 'Monthly income can have up to 2 decimal places')
        .optional()
        .nullable(),
    yearsEmployed: zod_1.z.number()
        .int('Years employed must be a whole number')
        .min(0, 'Years employed cannot be negative')
        .max(50, 'Years employed cannot exceed 50 years')
        .optional()
        .nullable(),
    // Solar System Preferences
    desiredSystemSize: zod_1.z.number()
        .positive('Desired system size must be a positive number')
        .max(1000, 'Desired system size cannot exceed 1000 kW')
        .multipleOf(0.01, 'Desired system size can have up to 2 decimal places')
        .optional()
        .nullable(),
    budgetRange: zod_1.z.string()
        .max(50, 'Budget range cannot exceed 50 characters')
        .optional()
        .nullable(),
    // Preferences
    preferredLanguage: zod_1.z.nativeEnum(client_1.PreferredLanguage).optional(),
    emailNotifications: zod_1.z.boolean().optional(),
    smsNotifications: zod_1.z.boolean().optional(),
    marketingConsent: zod_1.z.boolean().optional(),
});
