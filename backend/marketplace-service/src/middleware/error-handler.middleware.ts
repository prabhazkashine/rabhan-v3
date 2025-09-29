import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BaseError, isOperationalError, normalizeError } from '../utils/errors';
import { ApiResponse, AuthenticatedRequest } from '../types/common';
import logger from '../utils/logger';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const normalizedError = normalizeError(error);

  const errorResponse = generateErrorResponse(normalizedError, req);

  logError(normalizedError, req, errorResponse);

  res.status(errorResponse.statusCode).json(errorResponse.apiResponse);
}

function generateErrorResponse(error: Error, req: Request) {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  if (error instanceof BaseError) {
    statusCode = error.statusCode;
    errorCode = error.errorCode;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = error.issues.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
  }

  const apiResponse: ApiResponse = {
    success: false,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (req as AuthenticatedRequest).context?.requestId || req.headers['x-request-id'] as string || 'unknown',
      version: '1.0.0'
    },
    errors: details ? (Array.isArray(details) ? details : [{ message, details }]) : [{ message }]
  };

  if (process.env.NODE_ENV === 'production' && !isOperationalError(error)) {
    apiResponse.message = 'Internal server error';
    apiResponse.errors = [{ message: 'Internal server error' }];
  }

  return {
    statusCode,
    errorCode,
    apiResponse
  };
}

function logError(error: Error, req: Request, errorResponse: any): void {
  const logData = {
    error: error.stack || error.message,
    errorType: error.constructor.name,
    statusCode: errorResponse.statusCode,
    errorCode: errorResponse.errorCode,
    requestId: (req as AuthenticatedRequest).context?.requestId || req.headers['x-request-id'],
    userId: (req as AuthenticatedRequest).user?.id,
    method: req.method,
    url: req.originalUrl,
    userAgent: (req as AuthenticatedRequest).context?.userAgent || req.headers['user-agent'],
    ipAddress: (req as AuthenticatedRequest).context?.ipAddress || req.ip,
    body: sanitizeLogData(req.body),
    query: req.query,
    params: req.params
  };

  if (errorResponse.statusCode >= 500) {
    logger.error('Server error occurred', error, logData);

    if (errorResponse.statusCode >= 500) {
      logger.auditSecurity(
        'SYSTEM_ERROR',
        'HIGH',
        (req as AuthenticatedRequest).user?.id,
        (req as AuthenticatedRequest).context?.ipAddress || req.ip,
        logData
      );
    }
  } else if (errorResponse.statusCode >= 400) {
    logger.warn('Client error occurred', logData);

    if (errorResponse.statusCode === 401 || errorResponse.statusCode === 403) {
      logger.auditSecurity(
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'MEDIUM',
        (req as AuthenticatedRequest).user?.id,
        (req as AuthenticatedRequest).context?.ipAddress || req.ip,
        logData
      );
    }
  } else {
    logger.info('Request completed with error', logData);
  }
}

function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'session'
  ];

  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
      version: '1.0.0'
    },
    errors: [{ message: 'Route not found' }]
  };

  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip
  });

  res.status(404).json(response);
}