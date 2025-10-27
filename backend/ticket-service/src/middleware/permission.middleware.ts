import { Response, NextFunction } from 'express';
import axios from 'axios';
import { AuthenticatedRequest } from './auth.middleware';
import { logger } from '../utils/logger';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL;

/**
 * Permission check interface
 */
interface PermissionCheck {
  resource: string;
  action: string;
}

/**
 * Permission verification response from admin service
 */
interface PermissionVerificationResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    userRole: string;
    email: string;
    sessionId: string;
    resource: string;
    action: string;
    requireAll: boolean;
    hasPermission: boolean;
    checkedAt: string;
  };
}

/**
 * Check if user has a specific permission via admin service
 */
export const checkPermission = (resource: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user } = req;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Super admins bypass all permission checks
      if (user.role === 'super_admin') {
        logger.info('Super admin bypassing permission check', {
          user_id: user.id,
          resource,
          action
        });
        return next();
      }

      // Regular admins need permission verification
      if (user.role === 'admin') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader) {
            res.status(401).json({
              success: false,
              message: 'Authorization header required'
            });
            return;
          }

          // Verify permission with admin service
          const response = await axios.post<PermissionVerificationResponse>(
            `${ADMIN_SERVICE_URL}/api/permissions/verify`,
            {
              resource,
              action
            },
            {
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data.data.hasPermission) {
            logger.info('Permission check passed', {
              user_id: user.id,
              user_role: user.role,
              resource,
              action
            });
            return next();
          } else {
            logger.warn('Permission check failed', {
              user_id: user.id,
              user_role: user.role,
              resource,
              action
            });
            res.status(403).json({
              success: false,
              message: 'Forbidden: You do not have permission to access this resource',
              requiredPermission: { resource, action }
            });
            return;
          }
        } catch (error) {
          logger.error('Permission verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            user_id: user.id,
            resource,
            action
          });

          res.status(503).json({
            success: false,
            message: 'Permission verification service unavailable'
          });
          return;
        }
      }

      // Non-admin roles are not allowed to access admin endpoints
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only admins can access this resource'
      });
      return;
    } catch (error) {
      logger.error('Permission middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resource,
        action
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
      return;
    }
  };
};

/**
 * Check if user has multiple permissions (all required)
 */
export const checkAllPermissions = (permissions: PermissionCheck[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user } = req;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Super admins bypass all permission checks
      if (user.role === 'super_admin') {
        logger.info('Super admin bypassing multiple permission checks', {
          user_id: user.id,
          permissions
        });
        return next();
      }

      // Regular admins need permission verification
      if (user.role === 'admin') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader) {
            res.status(401).json({
              success: false,
              message: 'Authorization header required'
            });
            return;
          }

          // Verify multiple permissions with admin service
          const response = await axios.post<PermissionVerificationResponse>(
            `${ADMIN_SERVICE_URL}/api/permissions/verify`,
            {
              permissions,
              requireAll: true
            },
            {
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data.data.hasPermission) {
            logger.info('Multiple permission check passed', {
              user_id: user.id,
              user_role: user.role,
              permissions
            });
            return next();
          } else {
            logger.warn('Multiple permission check failed', {
              user_id: user.id,
              user_role: user.role,
              permissions
            });
            res.status(403).json({
              success: false,
              message: 'Forbidden: You do not have required permissions',
              requiredPermissions: permissions
            });
            return;
          }
        } catch (error) {
          logger.error('Multiple permission verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            user_id: user.id,
            permissions
          });

          res.status(503).json({
            success: false,
            message: 'Permission verification service unavailable'
          });
          return;
        }
      }

      // Non-admin roles are not allowed
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only admins can access this resource'
      });
      return;
    } catch (error) {
      logger.error('Multiple permission middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        permissions
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
      return;
    }
  };
};

/**
 * Conditional permission check - only applies to admin/super_admin roles
 * Other roles bypass this check
 */
export const checkAdminPermission = (resource: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user } = req;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (user.role !== 'admin' && user.role !== 'super_admin') {
        logger.info('Non-admin user bypassing permission check', {
          user_id: user.id,
          user_role: user.role,
          resource,
          action
        });
        return next();
      }

      if (user.role === 'super_admin') {
        logger.info('Super admin bypassing permission check', {
          user_id: user.id,
          resource,
          action
        });
        return next();
      }

      if (user.role === 'admin') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader) {
            res.status(401).json({
              success: false,
              message: 'Authorization header required'
            });
            return;
          }

          const response = await axios.post<PermissionVerificationResponse>(
            `${ADMIN_SERVICE_URL}/api/permissions/verify`,
            {
              resource,
              action
            },
            {
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data.data.hasPermission) {
            logger.info('Admin permission check passed', {
              user_id: user.id,
              user_role: user.role,
              resource,
              action
            });
            return next();
          } else {
            logger.warn('Admin permission check failed', {
              user_id: user.id,
              user_role: user.role,
              resource,
              action
            });
            res.status(403).json({
              success: false,
              message: 'Forbidden: You do not have permission to perform this action',
              requiredPermission: { resource, action }
            });
            return;
          }
        } catch (error) {
          logger.error('Admin permission verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            user_id: user.id,
            resource,
            action
          });

          res.status(503).json({
            success: false,
            message: 'Permission verification service unavailable'
          });
          return;
        }
      }

      return next();
    } catch (error) {
      logger.error('Conditional permission middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resource,
        action
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
      return;
    }
  };
};

/**
 * Check if user has any of the specified permissions (at least one required)
 */
export const checkAnyPermission = (permissions: PermissionCheck[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user } = req;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (user.role === 'super_admin') {
        logger.info('Super admin bypassing any permission checks', {
          user_id: user.id,
          permissions
        });
        return next();
      }

      if (user.role === 'admin') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader) {
            res.status(401).json({
              success: false,
              message: 'Authorization header required'
            });
            return;
          }

          const response = await axios.post<PermissionVerificationResponse>(
            `${ADMIN_SERVICE_URL}/api/permissions/verify`,
            {
              permissions,
              requireAll: false
            },
            {
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data.data.hasPermission) {
            logger.info('Any permission check passed', {
              user_id: user.id,
              user_role: user.role,
              permissions
            });
            return next();
          } else {
            logger.warn('Any permission check failed', {
              user_id: user.id,
              user_role: user.role,
              permissions
            });
            res.status(403).json({
              success: false,
              message: 'Forbidden: You do not have any of the required permissions',
              requiredPermissions: permissions
            });
            return;
          }
        } catch (error) {
          logger.error('Any permission verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            user_id: user.id,
            permissions
          });

          res.status(503).json({
            success: false,
            message: 'Permission verification service unavailable'
          });
          return;
        }
      }

      res.status(403).json({
        success: false,
        message: 'Forbidden: Only admins can access this resource'
      });
      return;
    } catch (error) {
      logger.error('Any permission middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        permissions
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
      return;
    }
  };
};
