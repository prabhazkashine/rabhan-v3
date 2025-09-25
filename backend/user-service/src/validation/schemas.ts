import { z } from 'zod';
import { UserType } from '@prisma/client';

const saudiPhoneRegex = /^(05|5)[0-9]{8}$/;
const indianPhoneRegex = /^(\+91|91|0)?[6-9][0-9]{9}$/;
const phoneRegex = new RegExp(`(${saudiPhoneRegex.source})|(${indianPhoneRegex.source})`);
const nationalIdRegex = /^[12][0-9]{9}$/;

export const registerSchema = z.object({
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s]+$/, 'First name can only contain letters, numbers, and spaces'),

  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Last name can only contain letters, numbers, and spaces'),

  email: z.string()
    .email('Invalid email format')
    .toLowerCase(),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  phone: z.string()
    .regex(phoneRegex, 'Phone must be a valid Saudi (05xxxxxxxx) or Indian (+919xxxxxxxx) phone number')
    .optional(),

  nationalId: z.string()
    .regex(nationalIdRegex, 'National ID must be a valid Saudi national ID (10 digits starting with 1 or 2)')
    .optional(),

  userType: z.enum(['HOMEOWNER', 'CONTRACTOR', 'BUSINESS'])
    .default('HOMEOWNER'),
});

export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase(),

  password: z.string()
    .min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  firstName: z.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s]+$/, 'First name can only contain letters, numbers, and spaces')
    .optional(),

  lastName: z.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Last name can only contain letters, numbers, and spaces')
    .optional(),

  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional(),

  phone: z.string()
    .regex(phoneRegex, 'Phone must be a valid Saudi (05xxxxxxxx) or Indian (+919xxxxxxxx) phone number')
    .optional(),

  nationalId: z.string()
    .regex(nationalIdRegex, 'National ID must be a valid Saudi national ID (10 digits starting with 1 or 2)')
    .optional(),

  userType: z.nativeEnum(UserType)
    .optional(),
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;