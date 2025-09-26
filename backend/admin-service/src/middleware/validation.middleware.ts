import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue: any) => ({
          field: issue.path.slice(1).join('.'),
          message: issue.message,
        }));

        logger.warn('Validation failed', {
          errors: errorMessages,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorMessages,
        });
      } else {
        logger.error('Unexpected validation error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        res.status(500).json({
          success: false,
          message: 'Internal server error',
        });
      }
    }
  };
};