import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../utils/logger';
import { AppError } from './error-handler';

export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      logger.warn('Validation error:', {
        path: req.path,
        method: req.method,
        error: error.errors
      });

      const errorMessages = error.errors?.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      })) || [];

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      // Store validated query in a custom property since req.query is read-only
      (req as any).validatedQuery = validated;
      next();
    } catch (error: any) {
      logger.warn('Query validation error:', {
        path: req.path,
        method: req.method,
        error: error.errors || error.message,
        queryParams: req.query
      });

      const errorMessages = error.errors?.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      })) || [];

      // If no specific error messages, provide generic message
      if (errorMessages.length === 0 && error.message) {
        errorMessages.push({
          field: 'query',
          message: error.message
        });
      }

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated as any;
      next();
    } catch (error: any) {
      logger.warn('Params validation error:', {
        path: req.path,
        method: req.method,
        error: error.errors
      });

      const errorMessages = error.errors?.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      })) || [];

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }
  };
};
