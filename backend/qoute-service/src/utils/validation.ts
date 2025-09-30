import { Request } from 'express';
import { ValidationError } from './errors';

/**
 * Validates and extracts user ID from request headers
 * @param req Express request object
 * @returns Validated user ID
 * @throws ValidationError if user ID is missing or invalid
 */
export function validateUserId(req: Request): string {
  const userId = req.headers['x-user-id'] as string;

  if (!userId || userId === 'undefined' || userId === 'null') {
    throw new ValidationError('User authentication required - valid x-user-id header missing');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new ValidationError('Invalid user ID format - must be a valid UUID');
  }

  return userId;
}

/**
 * Validates and extracts user role from request headers
 * @param req Express request object
 * @returns User role (user, contractor, admin, super_admin)
 */
export function validateUserRole(req: Request): string {
  const role = req.headers['x-user-role'] as string;

  if (!role) {
    throw new ValidationError('User role required - x-user-role header missing');
  }

  const validRoles = ['user', 'contractor', 'admin', 'super_admin'];
  if (!validRoles.includes(role)) {
    throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  return role;
}

/**
 * Check if user has required role
 * @param req Express request object
 * @param allowedRoles Array of allowed roles
 * @returns true if user has required role
 * @throws ValidationError if user doesn't have required role
 */
export function requireRole(req: Request, allowedRoles: string[]): boolean {
  const userRole = validateUserRole(req);

  if (!allowedRoles.includes(userRole)) {
    throw new ValidationError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }

  return true;
}