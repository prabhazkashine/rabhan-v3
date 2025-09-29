// Base error class for all custom errors
export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly isOperational: boolean;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      stack: this.stack
    };
  }
}

// 400 - Bad Request
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly errorCode = 'VALIDATION_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Validation failed', details?: any) {
    super(message, details);
  }
}

// 401 - Unauthorized
export class AuthenticationError extends BaseError {
  readonly statusCode = 401;
  readonly errorCode = 'AUTHENTICATION_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Authentication required', details?: any) {
    super(message, details);
  }
}

// 403 - Forbidden
export class AuthorizationError extends BaseError {
  readonly statusCode = 403;
  readonly errorCode = 'AUTHORIZATION_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Access denied', details?: any) {
    super(message, details);
  }
}

// 404 - Not Found
export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly errorCode = 'NOT_FOUND_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Resource not found', details?: any) {
    super(message, details);
  }
}

// 409 - Conflict
export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly errorCode = 'CONFLICT_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Resource conflict', details?: any) {
    super(message, details);
  }
}

// 422 - Unprocessable Entity
export class BusinessRuleError extends BaseError {
  readonly statusCode = 422;
  readonly errorCode = 'BUSINESS_RULE_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Business rule violation', details?: any) {
    super(message, details);
  }
}

// 429 - Too Many Requests
export class RateLimitError extends BaseError {
  readonly statusCode = 429;
  readonly errorCode = 'RATE_LIMIT_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Too many requests', details?: any) {
    super(message, details);
  }
}

// 500 - Internal Server Error
export class InternalServerError extends BaseError {
  readonly statusCode = 500;
  readonly errorCode = 'INTERNAL_SERVER_ERROR';
  readonly isOperational = false;

  constructor(message: string = 'Internal server error', details?: any) {
    super(message, details);
  }
}

// 502 - Bad Gateway
export class ExternalServiceError extends BaseError {
  readonly statusCode = 502;
  readonly errorCode = 'EXTERNAL_SERVICE_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'External service error', details?: any) {
    super(message, details);
  }
}

// 503 - Service Unavailable
export class ServiceUnavailableError extends BaseError {
  readonly statusCode = 503;
  readonly errorCode = 'SERVICE_UNAVAILABLE_ERROR';
  readonly isOperational = true;

  constructor(message: string = 'Service temporarily unavailable', details?: any) {
    super(message, details);
  }
}

// Database specific errors
export class DatabaseError extends BaseError {
  readonly statusCode = 500;
  readonly errorCode = 'DATABASE_ERROR';
  readonly isOperational = false;

  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, details);
  }
}

export class DatabaseConnectionError extends DatabaseError {
  readonly errorCode = 'DATABASE_CONNECTION_ERROR';

  constructor(message: string = 'Database connection failed', details?: any) {
    super(message, details);
  }
}

export class DatabaseTransactionError extends DatabaseError {
  readonly errorCode = 'DATABASE_TRANSACTION_ERROR';

  constructor(message: string = 'Database transaction failed', details?: any) {
    super(message, details);
  }
}

// Type guard to check if error is operational
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

// Helper to convert unknown errors to proper error objects
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('An unknown error occurred');
}

// Error factory for common scenarios
export class ErrorFactory {
  static validation(message: string, field?: string, value?: any) {
    return new ValidationError(message, { field, value });
  }

  static notFound(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    return new NotFoundError(message, { resource, identifier });
  }

  static conflict(resource: string, field: string, value: any) {
    const message = `${resource} with ${field} '${value}' already exists`;
    return new ConflictError(message, { resource, field, value });
  }

  static unauthorized(action?: string) {
    const message = action
      ? `Authentication required to ${action}`
      : 'Authentication required';
    return new AuthenticationError(message, { action });
  }

  static forbidden(action?: string, resource?: string) {
    const message = action && resource
      ? `Not authorized to ${action} ${resource}`
      : 'Access denied';
    return new AuthorizationError(message, { action, resource });
  }

  static businessRule(rule: string, details?: any) {
    return new BusinessRuleError(`Business rule violation: ${rule}`, details);
  }

  static database(operation: string, details?: any) {
    return new DatabaseError(`Database ${operation} failed`, details);
  }
}