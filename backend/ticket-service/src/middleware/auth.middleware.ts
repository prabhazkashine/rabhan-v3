import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role: string;
  };
}

class AuthMiddleware {
  authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // Get user info from headers (set by API Gateway)
      const userId = req.headers['x-user-id'] as string;
      const userRole = req.headers['x-user-role'] as string;

      if (!userId || !userRole) {
        logger.warn('Missing authentication headers', {
          ip: req.ip,
          path: req.path
        });

        res.status(401).json({
          success: false,
          message: 'Missing authentication headers'
        });
        return;
      }

      // Validate role
      const validRoles = ['user', 'contractor', 'admin', 'super_admin'];
      if (!validRoles.includes(userRole)) {
        logger.warn('Invalid user role', {
          userId,
          userRole,
          path: req.path
        });

        res.status(403).json({
          success: false,
          message: 'Invalid user role'
        });
        return;
      }

      req.user = {
        id: userId,
        role: userRole,
      };

      logger.debug('User authenticated', {
        userId,
        userRole,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Authentication middleware error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  };

  // Optional: Verify user is of specific role
  authorizeRole = (allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Authorization failed', {
          userId: req.user.id,
          userRole: req.user.role,
          allowedRoles,
          path: req.path
        });

        res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
        return;
      }

      next();
    };
  };
}

export const authMiddleware = new AuthMiddleware();
