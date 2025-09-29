import { z } from 'zod';

export const CategoryCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  nameAr: z.string()
    .max(100, 'Arabic name must be less than 100 characters')
    .trim()
    .optional(),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  descriptionAr: z.string()
    .max(1000, 'Arabic description must be less than 1000 characters')
    .trim()
    .optional(),
  icon: z.string()
    .max(50, 'Icon must be less than 50 characters')
    .trim()
    .optional(),
  imageUrl: z.string()
    .url('Invalid image URL')
    .max(500, 'Image URL must be less than 500 characters')
    .optional(),
  sortOrder: z.number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .optional(),
  isActive: z.boolean()
    .optional()
    .default(true)
});

export const CategoryUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .optional(),
  nameAr: z.string()
    .max(100, 'Arabic name must be less than 100 characters')
    .trim()
    .optional(),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim()
    .optional(),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  descriptionAr: z.string()
    .max(1000, 'Arabic description must be less than 1000 characters')
    .trim()
    .optional(),
  icon: z.string()
    .max(50, 'Icon must be less than 50 characters')
    .trim()
    .optional(),
  imageUrl: z.string()
    .url('Invalid image URL')
    .max(500, 'Image URL must be less than 500 characters')
    .optional(),
  sortOrder: z.number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .optional(),
  isActive: z.boolean()
    .optional()
});

export const CategoryQuerySchema = z.object({
  page: z.string()
    .optional()
    .default('1')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, 'Page must be a positive number'),
  limit: z.string()
    .optional()
    .default('10')
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  search: z.string()
    .max(100, 'Search term must be less than 100 characters')
    .trim()
    .optional(),
  isActive: z.string()
    .transform(val => val === 'true')
    .optional(),
  sortBy: z.enum(['name', 'createdAt', 'sortOrder', 'productsCount'])
    .optional()
    .default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc'])
    .optional()
    .default('asc')
});

export const CategoryParamsSchema = z.object({
  id: z.string()
    .uuid('Invalid category ID format')
});

// Type exports
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
export type CategoryQuery = z.infer<typeof CategoryQuerySchema>;
export type CategoryParams = z.infer<typeof CategoryParamsSchema>;