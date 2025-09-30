// Custom error classes for the quote service

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(500, message);
    this.name = 'DatabaseError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(400, message);
    this.name = 'BusinessRuleError';
  }
}

// Handle Prisma errors
export function handlePrismaError(error: any): AppError {
  if (error.code === 'P2002') {
    return new ConflictError('A record with this unique value already exists');
  }
  if (error.code === 'P2025') {
    return new NotFoundError('Record not found');
  }
  if (error.code === 'P2003') {
    return new ValidationError('Foreign key constraint failed');
  }
  return new DatabaseError(error.message || 'Database operation failed');
}