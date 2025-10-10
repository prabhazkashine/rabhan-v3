import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { logger } from '../utils/logger';

export const validateBody = (schema: ZodType<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request body validation failed', {
          errors: error.issues,
          path: req.path,
        });

        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues.map((err: any) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      // Handle non-ZodError errors
      logger.error('Unexpected validation error', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Validation processing error',
      });
      return;
    }
  };
};

export const validateQuery = (schema: ZodType<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Query parameters validation failed', {
          errors: error.issues,
          path: req.path,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.issues.map((err: any) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      // Handle non-ZodError errors
      logger.error('Unexpected query validation error', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Query validation processing error',
      });
      return;
    }
  };
};

export const validateParams = (schema: ZodType<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Path parameters validation failed', {
          errors: error.issues,
          path: req.path,
        });

        res.status(400).json({
          success: false,
          message: 'Invalid path parameters',
          errors: error.issues.map((err: any) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      // Handle non-ZodError errors
      logger.error('Unexpected params validation error', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Params validation processing error',
      });
      return;
    }
  };
};
