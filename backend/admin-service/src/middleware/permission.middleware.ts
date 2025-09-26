import { Request, Response, NextFunction } from 'express';
import { ResourceType, PermissionAction } from '../generated/prisma';
import { RoleService } from '../services/role.service';
import { logger } from '../utils/logger';

// Cache for permissions to avoid database calls
const permissionCache = new Map<string, { permissions: Array<{resource: ResourceType, action: PermissionAction}>, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const requirePermission = (resource: ResourceType, action: PermissionAction) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        logger.warn('Permission check failed: No user in request', {
          resource,
          action,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // SUPER_ADMIN always has all permissions
      if (req.user.role === 'SUPER_ADMIN') {
        logger.debug('Permission granted: SUPER_ADMIN access', {
          userId: req.user.userId,
          resource,
          action,
          path: req.path,
          method: req.method,
        });
        next();
        return;
      }

      const userId = req.user.userId;
      const cacheKey = userId;
      const now = Date.now();

      // Check cache first
      const cached = permissionCache.get(cacheKey);
      let userPermissions: Array<{resource: ResourceType, action: PermissionAction}>;

      if (cached && (now - cached.timestamp < CACHE_DURATION)) {
        userPermissions = cached.permissions;
      } else {
        // Fetch permissions from database
        const roleService = new RoleService();
        userPermissions = await roleService.getAdminPermissions(userId);

        // Cache the permissions
        permissionCache.set(cacheKey, {
          permissions: userPermissions,
          timestamp: now
        });
      }

      // Check if user has the required permission
      const hasPermission = userPermissions.some(
        perm => perm.resource === resource && perm.action === action
      );

      if (!hasPermission) {
        logger.warn('Permission denied: Insufficient permissions', {
          userId: req.user.userId,
          userRole: req.user.role,
          requiredResource: resource,
          requiredAction: action,
          userPermissions: userPermissions.length,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required: ${resource}:${action}`
        });
        return;
      }

      logger.debug('Permission granted', {
        userId: req.user.userId,
        resource,
        action,
        path: req.path,
        method: req.method,
      });

      next();

    } catch (error) {
      logger.error('Permission check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        resource,
        action,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

export const clearPermissionCache = (userId?: string): void => {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
};

export const requireAllPermissions = (...permissions: Array<{resource: ResourceType, action: PermissionAction}>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (req.user.role === 'SUPER_ADMIN') {
        next();
        return;
      }

      const userId = req.user.userId;
      const roleService = new RoleService();
      const userPermissions = await roleService.getAdminPermissions(userId);

      const hasAllPermissions = permissions.every(requiredPerm =>
        userPermissions.some(userPerm =>
          userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
        )
      );

      if (!hasAllPermissions) {
        logger.warn('Permission denied: Missing required permissions', {
          userId: req.user.userId,
          requiredPermissions: permissions,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        res.status(403).json({
          success: false,
          message: 'Insufficient permissions for this operation'
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Multiple permission check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        requiredPermissions: permissions,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

export const requireAnyPermission = (...permissions: Array<{resource: ResourceType, action: PermissionAction}>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (req.user.role === 'SUPER_ADMIN') {
        next();
        return;
      }

      const userId = req.user.userId;
      const roleService = new RoleService();
      const userPermissions = await roleService.getAdminPermissions(userId);

      const hasAnyPermission = permissions.some(requiredPerm =>
        userPermissions.some(userPerm =>
          userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
        )
      );

      if (!hasAnyPermission) {
        logger.warn('Permission denied: No matching permissions', {
          userId: req.user.userId,
          requiredPermissions: permissions,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        res.status(403).json({
          success: false,
          message: 'Insufficient permissions for this operation'
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Any permission check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        requiredPermissions: permissions,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};