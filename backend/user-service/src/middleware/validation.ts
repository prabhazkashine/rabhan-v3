import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      logger.debug('Validation error details:', {
        error: error,
        errorType: error?.constructor?.name,
        hasErrors: error instanceof ZodError ? !!error.errors : false,
        path: req.path,
        body: req.body
      });

      if (error instanceof ZodError && error.errors) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn('Validation failed:', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
        return;
      }

      logger.error('Unexpected validation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
};