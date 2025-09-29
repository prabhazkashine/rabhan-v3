import { z } from 'zod';

export const ProductCreateSchema = z.object({
  categoryId: z.string()
    .uuid('Invalid category ID format'),
  contractorName: z.string().max(255, 'Contractor name must be less than 255 characters')
    .trim()
    .optional(),
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim(),
  nameAr: z.string()
    .max(255, 'Arabic name must be less than 255 characters')
    .trim()
    .optional(),
  description: z.string()
    .max(5000, 'Description must be less than 5000 characters')
    .trim()
    .optional(),
  descriptionAr: z.string()
    .max(5000, 'Arabic description must be less than 5000 characters')
    .trim()
    .optional(),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(255, 'Slug must be less than 255 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),
  brand: z.string()
    .min(1, 'Brand is required')
    .max(100, 'Brand must be less than 100 characters')
    .trim(),
  model: z.string()
    .max(100, 'Model must be less than 100 characters')
    .trim()
    .optional(),
  sku: z.string()
    .max(50, 'SKU must be less than 50 characters')
    .trim()
    .optional(),
  specifications: z.record(z.string(), z.any())
    .optional()
    .default({}),
  price: z.number()
    .positive('Price must be positive')
    .max(999999.99, 'Price too large'),
  currency: z.string()
    .length(3, 'Currency must be 3 characters')
    .optional()
    .default('SAR'),
  vatIncluded: z.boolean()
    .optional()
    .default(true),
  stockQuantity: z.number()
    .int('Stock quantity must be an integer')
    .min(0, 'Stock quantity cannot be negative')
    .default(0),
  images: z.array(z.object({
    fileName: z.string().min(1, 'File name is required'),
    filePath: z.string().min(1, 'File path is required'),
    fileUrl: z.string().url('Invalid file URL').optional(),
    sortOrder: z.number().int().min(0).optional().default(0),
    isPrimary: z.boolean().optional().default(false)
  })).optional().default([])
});

export const ProductUpdateSchema = z.object({
  categoryId: z.string()
    .uuid('Invalid category ID format')
    .optional(),
  contractorName: z.string().max(255, 'Contractor name must be less than 255 characters')
    .trim()
    .optional(),
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters')
    .trim()
    .optional(),
  nameAr: z.string()
    .max(255, 'Arabic name must be less than 255 characters')
    .trim()
    .optional(),
  description: z.string()
    .max(5000, 'Description must be less than 5000 characters')
    .trim()
    .optional(),
  descriptionAr: z.string()
    .max(5000, 'Arabic description must be less than 5000 characters')
    .trim()
    .optional(),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(255, 'Slug must be less than 255 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .trim()
    .optional(),
  brand: z.string()
    .min(1, 'Brand is required')
    .max(100, 'Brand must be less than 100 characters')
    .trim()
    .optional(),
  model: z.string()
    .max(100, 'Model must be less than 100 characters')
    .trim()
    .optional(),
  sku: z.string()
    .max(50, 'SKU must be less than 50 characters')
    .trim()
    .optional(),
  specifications: z.record(z.string(), z.any())
    .optional(),
  price: z.number()
    .positive('Price must be positive')
    .max(999999.99, 'Price too large')
    .optional(),
  currency: z.string()
    .length(3, 'Currency must be 3 characters')
    .optional(),
  vatIncluded: z.boolean()
    .optional(),
  stockQuantity: z.number()
    .int('Stock quantity must be an integer')
    .min(0, 'Stock quantity cannot be negative')
    .optional(),
  images: z.array(z.object({
    id: z.string().uuid().optional(), // For existing images
    fileName: z.string().min(1, 'File name is required'),
    filePath: z.string().min(1, 'File path is required'),
    fileUrl: z.string().url('Invalid file URL').optional(),
    sortOrder: z.number().int().min(0).optional().default(0),
    isPrimary: z.boolean().optional().default(false),
    action: z.enum(['keep', 'delete', 'add']).optional().default('add')
  })).optional()
});

export const ProductQuerySchema = z.object({
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
  categoryId: z.string()
    .uuid('Invalid category ID format')
    .optional(),
  contractorId: z.string()
    .uuid('Invalid contractor ID format')
    .optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE'])
    .optional(),
  stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])
    .optional(),
  minPrice: z.string()
    .optional()
    .transform(val => val ? parseFloat(val) : undefined)
    .refine(val => val === undefined || val >= 0, 'Minimum price must be non-negative'),
  maxPrice: z.string()
    .optional()
    .transform(val => val ? parseFloat(val) : undefined)
    .refine(val => val === undefined || val >= 0, 'Maximum price must be non-negative'),
  sortBy: z.enum(['name', 'price', 'createdAt', 'stockQuantity', 'brand'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc'])
    .optional()
    .default('desc')
});

export const ProductParamsSchema = z.object({
  id: z.string()
    .uuid('Invalid product ID format')
});

export const ProductApprovalSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    message: 'Action must be either "approve" or "reject"'
  }),
  reason: z.string()
    .max(500, 'Reason must be less than 500 characters')
    .trim()
    .optional(),
  adminNotes: z.string()
    .max(1000, 'Admin notes must be less than 1000 characters')
    .trim()
    .optional()
});

// Type exports
export type ProductCreate = z.infer<typeof ProductCreateSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
export type ProductParams = z.infer<typeof ProductParamsSchema>;
export type ProductApproval = z.infer<typeof ProductApprovalSchema>;