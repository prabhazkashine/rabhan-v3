import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

/**
 * Global error handling middleware
 * Must be registered last in Express middleware chain
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Handle known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;

    switch (prismaError.code) {
      case 'P2002':
        res.status(409).json({
          success: false,
          message: 'A record with this information already exists',
          field: prismaError.meta?.target,
        });
        return;

      case 'P2025':
        res.status(404).json({
          success: false,
          message: 'Record not found',
        });
        return;

      case 'P2003':
        res.status(400).json({
          success: false,
          message: 'Invalid reference to related record',
        });
        return;

      default:
        res.status(400).json({
          success: false,
          message: 'Database operation failed',
          code: prismaError.code,
        });
        return;
    }
  }

  // Handle validation errors from Prisma
  if (err.name === 'PrismaClientValidationError') {
    res.status(400).json({
      success: false,
      message: 'Invalid data provided',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
};
