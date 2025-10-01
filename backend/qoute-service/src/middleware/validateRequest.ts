import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Middleware to validate request body or query against Zod schema
 * @param schema - Zod schema to validate against
 * @param source - Where to validate from: 'body' (default) or 'query'
 */
export function validateRequest(schema: ZodSchema, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = source === 'query' ? req.query : req.body;
      const validated = schema.parse(dataToValidate);

      if (source === 'query') {
        // Store validated query params in a custom property since req.query is read-only
        // Controllers should use req.query directly as it's already validated
        Object.assign(req.query, validated);
      } else {
        req.body = validated;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          source,
          errors: errorMessages,
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorMessages,
        });
      }

      logger.error('Unexpected validation error', {
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Validation error',
      });
    }
  };
}