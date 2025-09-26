"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractorLoginSchema = exports.contractorRegisterSchema = void 0;
const zod_1 = require("zod");
const saudiPhoneRegex = /^(05|5)[0-9]{8}$/;
const internationalPhoneRegex = /^\+[1-9]\d{1,14}$/;
const phoneRegex = new RegExp(`(${saudiPhoneRegex.source})|(${internationalPhoneRegex.source})`);
const nationalIdRegex = /^[12][0-9]{9}$/;
const crNumberRegex = /^[0-9]{10}$/;
const vatNumberRegex = /^[0-9]{15}$/;
exports.contractorRegisterSchema = zod_1.z.object({
    firstName: zod_1.z.string()
        .min(2, 'First name must be at least 2 characters')
        .max(100, 'First name cannot exceed 100 characters')
        .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters and spaces'),
    lastName: zod_1.z.string()
        .min(2, 'Last name must be at least 2 characters')
        .max(100, 'Last name cannot exceed 100 characters')
        .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters and spaces'),
    email: zod_1.z.string()
        .email('Invalid email format')
        .toLowerCase()
        .max(255, 'Email cannot exceed 255 characters'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password cannot exceed 128 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    phone: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
        .optional(),
    nationalId: zod_1.z.string()
        .regex(nationalIdRegex, 'National ID must be a valid Saudi national ID (10 digits starting with 1 or 2)')
        .optional(),
    companyName: zod_1.z.string()
        .min(2, 'Company name must be at least 2 characters')
        .max(255, 'Company name cannot exceed 255 characters'),
    crNumber: zod_1.z.string()
        .regex(crNumberRegex, 'CR number must be exactly 10 digits')
        .optional(),
    vatNumber: zod_1.z.string()
        .regex(vatNumberRegex, 'VAT number must be exactly 15 digits')
        .optional(),
    userType: zod_1.z.enum(['BUSINESS', 'individual'])
        .default('BUSINESS'),
    role: zod_1.z.enum(['CONTRACTOR'])
        .default('CONTRACTOR'),
    businessType: zod_1.z.enum(['llc', 'individual'])
        .default('llc')
});
exports.contractorLoginSchema = zod_1.z.object({
    email: zod_1.z.string()
        .email('Invalid email format')
        .toLowerCase(),
    password: zod_1.z.string()
        .min(1, 'Password is required')
});
