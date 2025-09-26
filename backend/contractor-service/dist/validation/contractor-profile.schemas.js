"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractorProfileUpdateSchema = exports.contractorProfileCreateSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../generated/prisma");
const phoneRegex = /^(05[0-9]{8}|\+[1-9]\d{1,14})$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex = /^https?:\/\/.+\..+/;
exports.contractorProfileCreateSchema = zod_1.z.object({
    // Basic Information
    businessName: zod_1.z.string()
        .min(2, 'Business name must be at least 2 characters')
        .max(255, 'Business name cannot exceed 255 characters'),
    businessNameAr: zod_1.z.string()
        .min(2, 'Arabic business name must be at least 2 characters')
        .max(255, 'Arabic business name cannot exceed 255 characters')
        .optional(),
    businessType: zod_1.z.nativeEnum(prisma_1.BusinessType)
        .default(prisma_1.BusinessType.individual),
    commercialRegistration: zod_1.z.string()
        .min(10, 'Commercial registration must be at least 10 characters')
        .max(100, 'Commercial registration cannot exceed 100 characters')
        .optional(),
    vatNumber: zod_1.z.string()
        .length(15, 'VAT number must be exactly 15 digits')
        .regex(/^[0-9]{15}$/, 'VAT number must contain only digits')
        .optional(),
    // Contact Information
    email: zod_1.z.string()
        .email('Invalid email format')
        .max(255, 'Email cannot exceed 255 characters'),
    phone: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)'),
    whatsapp: zod_1.z.string()
        .regex(phoneRegex, 'WhatsApp must be a valid phone number')
        .optional(),
    website: zod_1.z.string()
        .regex(urlRegex, 'Website must be a valid URL')
        .max(255, 'Website URL cannot exceed 255 characters')
        .optional(),
    // Address Information
    addressLine1: zod_1.z.string()
        .min(5, 'Address line 1 must be at least 5 characters')
        .max(255, 'Address line 1 cannot exceed 255 characters'),
    addressLine2: zod_1.z.string()
        .max(255, 'Address line 2 cannot exceed 255 characters')
        .optional(),
    city: zod_1.z.string()
        .min(2, 'City must be at least 2 characters')
        .max(100, 'City cannot exceed 100 characters'),
    region: zod_1.z.string()
        .min(2, 'Region must be at least 2 characters')
        .max(100, 'Region cannot exceed 100 characters'),
    postalCode: zod_1.z.string()
        .min(5, 'Postal code must be at least 5 characters')
        .max(20, 'Postal code cannot exceed 20 characters')
        .optional(),
    country: zod_1.z.string()
        .min(2, 'Country must be at least 2 characters')
        .max(100, 'Country cannot exceed 100 characters')
        .default('Saudi Arabia'),
    // GPS Coordinates
    latitude: zod_1.z.number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .optional(),
    longitude: zod_1.z.number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .optional(),
    // Business Details
    establishedYear: zod_1.z.number()
        .int('Established year must be a whole number')
        .min(1900, 'Established year cannot be before 1900')
        .max(new Date().getFullYear(), `Established year cannot be after ${new Date().getFullYear()}`)
        .optional(),
    employeeCount: zod_1.z.number()
        .int('Employee count must be a whole number')
        .min(1, 'Employee count must be at least 1')
        .max(10000, 'Employee count cannot exceed 10,000')
        .optional(),
    description: zod_1.z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(1000, 'Description cannot exceed 1000 characters')
        .optional(),
    descriptionAr: zod_1.z.string()
        .min(10, 'Arabic description must be at least 10 characters')
        .max(1000, 'Arabic description cannot exceed 1000 characters')
        .optional(),
    // Service Information
    serviceCategories: zod_1.z.array(zod_1.z.nativeEnum(prisma_1.ServiceCategory))
        .min(1, 'At least one service category is required')
        .default([prisma_1.ServiceCategory.residential_solar]),
    serviceAreas: zod_1.z.array(zod_1.z.string().min(2, 'Service area must be at least 2 characters'))
        .min(1, 'At least one service area is required')
        .default(['Riyadh']),
    yearsExperience: zod_1.z.number()
        .int('Years of experience must be a whole number')
        .min(0, 'Years of experience cannot be negative')
        .max(50, 'Years of experience cannot exceed 50')
        .default(1),
    // Contractor Type & Capabilities
    contractorType: zod_1.z.nativeEnum(prisma_1.ContractorType)
        .default(prisma_1.ContractorType.full_solar_contractor),
    canInstall: zod_1.z.boolean().default(true),
    canSupplyOnly: zod_1.z.boolean().default(false),
    // Preferences
    preferredLanguage: zod_1.z.string()
        .length(2, 'Language code must be exactly 2 characters')
        .default('ar'),
    emailNotifications: zod_1.z.boolean().default(true),
    smsNotifications: zod_1.z.boolean().default(true),
    marketingConsent: zod_1.z.boolean().default(false)
});
exports.contractorProfileUpdateSchema = zod_1.z.object({
    // Basic Information
    businessName: zod_1.z.string()
        .min(2, 'Business name must be at least 2 characters')
        .max(255, 'Business name cannot exceed 255 characters')
        .optional(),
    businessNameAr: zod_1.z.string()
        .min(2, 'Arabic business name must be at least 2 characters')
        .max(255, 'Arabic business name cannot exceed 255 characters')
        .optional(),
    businessType: zod_1.z.nativeEnum(prisma_1.BusinessType).optional(),
    commercialRegistration: zod_1.z.string()
        .min(10, 'Commercial registration must be at least 10 characters')
        .max(100, 'Commercial registration cannot exceed 100 characters')
        .optional(),
    vatNumber: zod_1.z.string()
        .length(15, 'VAT number must be exactly 15 digits')
        .regex(/^[0-9]{15}$/, 'VAT number must contain only digits')
        .optional(),
    // Contact Information
    email: zod_1.z.string()
        .email('Invalid email format')
        .max(255, 'Email cannot exceed 255 characters')
        .optional(),
    phone: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
        .optional(),
    whatsapp: zod_1.z.string()
        .regex(phoneRegex, 'WhatsApp must be a valid phone number')
        .optional(),
    website: zod_1.z.string()
        .regex(urlRegex, 'Website must be a valid URL')
        .max(255, 'Website URL cannot exceed 255 characters')
        .optional(),
    // Address Information
    addressLine1: zod_1.z.string()
        .min(5, 'Address line 1 must be at least 5 characters')
        .max(255, 'Address line 1 cannot exceed 255 characters')
        .optional(),
    addressLine2: zod_1.z.string()
        .max(255, 'Address line 2 cannot exceed 255 characters')
        .optional(),
    city: zod_1.z.string()
        .min(2, 'City must be at least 2 characters')
        .max(100, 'City cannot exceed 100 characters')
        .optional(),
    region: zod_1.z.string()
        .min(2, 'Region must be at least 2 characters')
        .max(100, 'Region cannot exceed 100 characters')
        .optional(),
    postalCode: zod_1.z.string()
        .min(5, 'Postal code must be at least 5 characters')
        .max(20, 'Postal code cannot exceed 20 characters')
        .optional(),
    country: zod_1.z.string()
        .min(2, 'Country must be at least 2 characters')
        .max(100, 'Country cannot exceed 100 characters')
        .optional(),
    // GPS Coordinates
    latitude: zod_1.z.number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .optional(),
    longitude: zod_1.z.number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .optional(),
    // Business Details
    establishedYear: zod_1.z.number()
        .int('Established year must be a whole number')
        .min(1900, 'Established year cannot be before 1900')
        .max(new Date().getFullYear(), `Established year cannot be after ${new Date().getFullYear()}`)
        .optional(),
    employeeCount: zod_1.z.number()
        .int('Employee count must be a whole number')
        .min(1, 'Employee count must be at least 1')
        .max(10000, 'Employee count cannot exceed 10,000')
        .optional(),
    description: zod_1.z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(1000, 'Description cannot exceed 1000 characters')
        .optional(),
    descriptionAr: zod_1.z.string()
        .min(10, 'Arabic description must be at least 10 characters')
        .max(1000, 'Arabic description cannot exceed 1000 characters')
        .optional(),
    // Service Information
    serviceCategories: zod_1.z.array(zod_1.z.nativeEnum(prisma_1.ServiceCategory))
        .min(1, 'At least one service category is required')
        .optional(),
    serviceAreas: zod_1.z.array(zod_1.z.string().min(2, 'Service area must be at least 2 characters'))
        .min(1, 'At least one service area is required')
        .optional(),
    yearsExperience: zod_1.z.number()
        .int('Years of experience must be a whole number')
        .min(0, 'Years of experience cannot be negative')
        .max(50, 'Years of experience cannot exceed 50')
        .optional(),
    // Contractor Type & Capabilities
    contractorType: zod_1.z.nativeEnum(prisma_1.ContractorType).optional(),
    canInstall: zod_1.z.boolean().optional(),
    canSupplyOnly: zod_1.z.boolean().optional(),
    // Preferences
    preferredLanguage: zod_1.z.string()
        .length(2, 'Language code must be exactly 2 characters')
        .optional(),
    emailNotifications: zod_1.z.boolean().optional(),
    smsNotifications: zod_1.z.boolean().optional(),
    marketingConsent: zod_1.z.boolean().optional()
});
