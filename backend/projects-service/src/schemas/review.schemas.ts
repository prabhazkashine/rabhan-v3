import { z } from 'zod';

/**
 * Schema for submitting a project review
 */
export const createReviewSchema = z.object({
  rating: z
    .number()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  review_text: z
    .string()
    .min(10, 'Review text must be at least 10 characters')
    .max(1000, 'Review text cannot exceed 1000 characters')
    .optional(),
  review_title: z.string().min(3).max(100).optional(),

  // Detailed ratings (optional, 1-5 scale)
  quality_rating: z.number().int().min(1).max(5).optional(),
  communication_rating: z.number().int().min(1).max(5).optional(),
  timeliness_rating: z.number().int().min(1).max(5).optional(),
  professionalism_rating: z.number().int().min(1).max(5).optional(),
  value_rating: z.number().int().min(1).max(5).optional(),

  would_recommend: z.boolean().optional(),

  // Photo URLs (if user uploads photos)
  photo_urls: z.array(z.string().url()).max(5, 'Maximum 5 photos allowed').optional(),
});

/**
 * Schema for contractor responding to a review
 */
export const respondToReviewSchema = z.object({
  contractor_response: z
    .string()
    .min(10, 'Response must be at least 10 characters')
    .max(500, 'Response cannot exceed 500 characters'),
});

/**
 * Schema for admin moderating a review
 */
export const moderateReviewSchema = z.object({
  is_visible: z.boolean().optional(),
  is_flagged: z.boolean().optional(),
  flag_reason: z.string().max(500).optional(),
});

/**
 * Schema for filtering reviews
 */
export const getReviewsQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  contractor_id: z.string().uuid().optional(),
  min_rating: z.string().optional().transform((val) => val ? Number(val) : undefined),
  max_rating: z.string().optional().transform((val) => val ? Number(val) : undefined),
  is_visible: z
    .string()
    .optional()
    .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  is_flagged: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  sort_by: z.enum(['created_at', 'rating']).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type RespondToReviewInput = z.infer<typeof respondToReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
export type GetReviewsQuery = z.infer<typeof getReviewsQuerySchema>;
