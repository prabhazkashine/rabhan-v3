"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const saudiPhoneRegex = /^(05|5)[0-9]{8}$/;
const indianPhoneRegex = /^(\+91|91|0)?[6-9][0-9]{9}$/;
const phoneRegex = new RegExp(`(${saudiPhoneRegex.source})|(${indianPhoneRegex.source})`);
const nationalIdRegex = /^[12][0-9]{9}$/;
exports.registerSchema = zod_1.z.object({
    firstName: zod_1.z.string()
        .min(2, 'First name must be at least 2 characters')
        .max(50, 'First name cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9\s]+$/, 'First name can only contain letters, numbers, and spaces'),
    lastName: zod_1.z.string()
        .min(2, 'Last name must be at least 2 characters')
        .max(50, 'Last name cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9\s]+$/, 'Last name can only contain letters, numbers, and spaces'),
    email: zod_1.z.string()
        .email('Invalid email format')
        .toLowerCase(),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password cannot exceed 128 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    phone: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi (05xxxxxxxx) or Indian (+919xxxxxxxx) phone number')
        .optional(),
    nationalId: zod_1.z.string()
        .regex(nationalIdRegex, 'National ID must be a valid Saudi national ID (10 digits starting with 1 or 2)')
        .optional(),
    userType: zod_1.z.enum(['HOMEOWNER', 'CONTRACTOR', 'BUSINESS'])
        .default('HOMEOWNER'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string()
        .email('Invalid email format')
        .toLowerCase(),
    password: zod_1.z.string()
        .min(1, 'Password is required'),
});
exports.updateProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string()
        .min(2, 'First name must be at least 2 characters')
        .max(50, 'First name cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9\s]+$/, 'First name can only contain letters, numbers, and spaces')
        .optional(),
    lastName: zod_1.z.string()
        .min(2, 'Last name must be at least 2 characters')
        .max(50, 'Last name cannot exceed 50 characters')
        .regex(/^[a-zA-Z0-9\s]+$/, 'Last name can only contain letters, numbers, and spaces')
        .optional(),
    email: zod_1.z.string()
        .email('Invalid email format')
        .toLowerCase()
        .optional(),
    phone: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi (05xxxxxxxx) or Indian (+919xxxxxxxx) phone number')
        .optional(),
    nationalId: zod_1.z.string()
        .regex(nationalIdRegex, 'National ID must be a valid Saudi national ID (10 digits starting with 1 or 2)')
        .optional(),
    userType: zod_1.z.nativeEnum(client_1.UserType)
        .optional(),
});
