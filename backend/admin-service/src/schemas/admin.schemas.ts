import { z } from 'zod';
import { UserRole, UserStatus } from '../generated/prisma';

export const createAdminSchema = z.object({
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
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)'),

    role: z
      .enum([UserRole.ADMIN, UserRole.SUPER_ADMIN])
      .default(UserRole.ADMIN),

    status: z
      .enum([UserStatus.ACTIVE, UserStatus.SUSPENDED])
      .default(UserStatus.ACTIVE)
  })
});

export const updateAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid admin ID format')
  }),
  body: z.object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(100, 'First name cannot exceed 100 characters')
      .regex(/^[a-zA-Z\s]+$/, 'First name must contain only letters and spaces')
      .optional(),

    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(100, 'Last name cannot exceed 100 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Last name must contain only letters and spaces')
      .optional(),

    email: z
      .string()
      .email('Invalid email format')
      .max(255, 'Email cannot exceed 255 characters')
      .toLowerCase()
      .optional(),

    role: z
      .enum([UserRole.ADMIN, UserRole.SUPER_ADMIN])
      .optional(),

    status: z
      .enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.LOCKED])
      .optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
});

export const deleteAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid admin ID format')
  })
});

export const getAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid admin ID format')
  })
});

export const listAdminsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'Page must be a positive number')
      .transform(Number)
      .refine(n => n > 0, 'Page must be greater than 0')
      .default(() => 1),

    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .transform(Number)
      .refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100')
      .default(() => 10),

    role: z
      .enum([UserRole.ADMIN, UserRole.SUPER_ADMIN])
      .optional(),

    status: z
      .enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.LOCKED, UserStatus.PENDING])
      .optional()
  })
});

export type CreateAdminSchemaType = z.infer<typeof createAdminSchema>;
export type UpdateAdminSchemaType = z.infer<typeof updateAdminSchema>;
export type DeleteAdminSchemaType = z.infer<typeof deleteAdminSchema>;
export type GetAdminSchemaType = z.infer<typeof getAdminSchema>;
export type ListAdminsSchemaType = z.infer<typeof listAdminsSchema>;