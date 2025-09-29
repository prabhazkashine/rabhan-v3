import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, UserContext } from '../types/common';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import logger from '../utils/logger';

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      throw new AuthenticationError('Access token required');
    }
    let jwtSecret = process.env.JWT_ACCESS_SECRET;

    const userType = req.headers['x-user-type'] as string;
    if (userType === 'contractor') {
      jwtSecret = process.env.CONTRACTOR_JWT_SECRET;
    } else if (userType === 'user') {
      jwtSecret = process.env.USER_JWT_SECRET;
    }

    if (!jwtSecret) {
      logger.error('JWT secret not configured', null, {
        userType,
        requestId: (req as AuthenticatedRequest).context?.requestId
      });
      throw new AuthenticationError('Authentication configuration error');
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    if (!decoded.id || !decoded.email) {
      throw new AuthenticationError('Invalid token payload');
    }

    (req as AuthenticatedRequest).user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
      contractorId: decoded.contractorId
    };

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.auditPerformance('JWT_VERIFICATION', duration, {
      userId: (req as AuthenticatedRequest).user!.id,
      userType,
      success: true
    });

    logger.auditAuthentication(
      (req as AuthenticatedRequest).user!.id,
      'TOKEN_REFRESH',
      (req as AuthenticatedRequest).context?.ipAddress,
      (req as AuthenticatedRequest).context?.userAgent,
      {
        userType,
        role: (req as AuthenticatedRequest).user!.role
      }
    );

    next();

  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;

    if (error instanceof jwt.JsonWebTokenError) {
      logger.auditSecurity(
        'INVALID_JWT_TOKEN',
        'MEDIUM',
        undefined,
        (req as AuthenticatedRequest).context?.ipAddress,
        {
          error: error.message,
          userAgent: (req as AuthenticatedRequest).context?.userAgent,
          requestId: (req as AuthenticatedRequest).context?.requestId
        }
      );

      logger.error('JWT verification failed', error, {
        requestId: (req as AuthenticatedRequest).context?.requestId,
        performanceMetrics: { duration }
      });

      next(new AuthenticationError('Invalid or expired token'));
    } else {
      logger.error('Authentication middleware error', error, {
        requestId: (req as AuthenticatedRequest).context?.requestId,
        performanceMetrics: { duration }
      });
      next(error);
    }
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    next();
    return;
  }

  authenticateToken(req, res, next);
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!(req as AuthenticatedRequest).user) {
        throw new AuthenticationError('User authentication required');
      }

      if (!allowedRoles.includes((req as AuthenticatedRequest).user!.role)) {
        logger.auditSecurity(
          'UNAUTHORIZED_ROLE_ACCESS',
          'HIGH',
          (req as AuthenticatedRequest).user!.id,
          (req as AuthenticatedRequest).context?.ipAddress,
          {
            userRole: (req as AuthenticatedRequest).user!.role,
            requiredRoles: allowedRoles,
            requestPath: req.path,
            requestMethod: req.method
          }
        );

        throw new AuthorizationError(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!(req as AuthenticatedRequest).user) {
        throw new AuthenticationError('User authentication required');
      }

      const userPermissions = (req as AuthenticatedRequest).user!.permissions || [];
      const hasPermission = requiredPermissions.every(permission =>
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        logger.auditSecurity(
          'UNAUTHORIZED_PERMISSION_ACCESS',
          'HIGH',
          (req as AuthenticatedRequest).user!.id,
          (req as AuthenticatedRequest).context?.ipAddress,
          {
            userPermissions,
            requiredPermissions,
            requestPath: req.path,
            requestMethod: req.method
          }
        );

        throw new AuthorizationError(
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireContractorAccess(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!(req as AuthenticatedRequest).user) {
      throw new AuthenticationError('User authentication required');
    }

    const user = (req as AuthenticatedRequest).user!;

    if (user.role === 'admin' || user.role === 'super_admin') {
      next();
      return;
    }

    if (user.role === 'contractor') {
      if (!user.contractorId) {
        throw new AuthorizationError('Contractor ID not found in user context');
      }

      req.body.contractorId = user.contractorId;
      req.query.contractorId = user.contractorId;

      next();
      return;
    }

    throw new AuthorizationError('Access denied to contractor resources');

  } catch (error) {
    next(error);
  }
}