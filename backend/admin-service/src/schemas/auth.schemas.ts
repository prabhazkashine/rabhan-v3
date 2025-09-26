import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(100, 'First name cannot exceed 100 characters')
      .regex(/^[a-zA-Z\s]+$/, 'First name must contain only letters and spaces'),

    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(100, 'Last name cannot exceed 100 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Last name must contain only letters and spaces'),

    email: z
      .string()
      .email('Invalid email format')
      .max(255, 'Email cannot exceed 255 characters')
      .toLowerCase(),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email format')
      .max(255, 'Email cannot exceed 255 characters')
      .toLowerCase(),

    password: z
      .string()
      .min(1, 'Password is required')
      .max(128, 'Password cannot exceed 128 characters')
  })
});

export type RegisterSchemaType = z.infer<typeof registerSchema>;
export type LoginSchemaType = z.infer<typeof loginSchema>;