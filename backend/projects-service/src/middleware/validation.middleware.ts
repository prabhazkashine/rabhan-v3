import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Middleware to validate request body against a Zod schema
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors?.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })) || [];

        logger.warn('Request body validation failed', {
          path: req.path,
          errors,
        });

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
        return;
      }

      logger.error('Unexpected error in body validation', { error });
      next(error);
    }
  };
};

/**
 * Middleware to validate query parameters against a Zod schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors?.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })) || [];

        logger.warn('Query parameters validation failed', {
          path: req.path,
          errors,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors,
        });
        return;
      }

      logger.error('Unexpected error in query validation', { error });
      next(error);
    }
  };
};

/**
 * Middleware to validate route parameters against a Zod schema
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors?.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })) || [];

        logger.warn('Route parameters validation failed', {
          path: req.path,
          errors,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid route parameters',
          errors,
        });
        return;
      }

      logger.error('Unexpected error in params validation', { error });
      next(error);
    }
  };
};
