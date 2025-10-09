import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    sessionId?: string;
  };
}

/**
 * Middleware to verify JWT token
 * Expects token in Authorization header: Bearer <token>
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not configured');
      throw new Error('Authentication configuration error');
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      sessionId?: string;
    };

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };

    logger.info('User authenticated', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', {
        error: error.message,
        path: req.path,
      });
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token', {
        path: req.path,
      });
      res.status(401).json({
        success: false,
        message: 'Authentication token has expired',
      });
      return;
    }

    next(error);
  }
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userRole = req.user.role.toLowerCase();
    const hasRole = allowedRoles.some(
      (role) => role.toLowerCase() === userRole
    );

    if (!hasRole) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required_roles: allowedRoles,
      });
      return;
    }

    next();
  };
};

/**
 * Alternative: Extract user info from API Gateway headers
 * API Gateway sets x-user-id, x-user-role, x-user-email after authentication
 */
export const extractUserFromHeaders = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;
  const userEmail = req.headers['x-user-email'] as string;
  const sessionId = req.headers['x-session-id'] as string;

  if (!userId || !userRole) {
    logger.warn('Missing user headers from API Gateway', {
      path: req.path,
      headers: {
        hasUserId: !!userId,
        hasUserRole: !!userRole,
      },
    });

    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  req.user = {
    id: userId,
    email: userEmail,
    role: userRole,
    sessionId,
  };

  logger.info('User extracted from headers', {
    userId: req.user.id,
    role: req.user.role,
    path: req.path,
  });

  next();
};
