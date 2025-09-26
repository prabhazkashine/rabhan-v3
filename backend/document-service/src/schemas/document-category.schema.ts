import { z } from 'zod';

export const createDocumentCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  allowed_formats: z.array(z.enum(['pdf', 'jpg', 'jpeg', 'png'])),
  max_file_size_mb: z.number().int().positive().max(100),
  required_for_kyc: z.boolean(),
  user_type: z.enum(['USER', 'CONTRACTOR']),
  validation_rules: z.record(z.any()).optional().default({})
});

export const documentCategoryResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  allowed_formats: z.array(z.string()),
  max_file_size_mb: z.number(),
  required_for_kyc: z.boolean(),
  user_type: z.string(),
  validation_rules: z.record(z.any())
});

export const createMultipleCategoriesSchema = z.object({
  categories: z.array(createDocumentCategorySchema)
});

export const getCategoriesResponseSchema = z.object({
  success: z.boolean(),
  categories: z.array(documentCategoryResponseSchema)
});

export type CreateDocumentCategoryInput = z.infer<typeof createDocumentCategorySchema>;
export type DocumentCategoryResponse = z.infer<typeof documentCategoryResponseSchema>;
export type CreateMultipleCategoriesInput = z.infer<typeof createMultipleCategoriesSchema>;