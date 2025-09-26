import { Request, Response } from 'express';
import { RoleService } from '../services/role.service';
import { ResourceType, PermissionAction } from '../generated/prisma';
import { logger } from '../utils/logger';
import { JWTUtils } from '../utils/jwt';

class PermissionController {
  private roleService: RoleService;

  constructor() {
    this.roleService = new RoleService();
  }

  checkPermission = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          hasPermission: false
        });
        return;
      }

      const { resource, action } = req.body;
      const userId = req.user.userId;

      const userPermissions = await this.roleService.getAdminPermissions(userId);

      const hasPermission = req.user.role === 'SUPER_ADMIN' ||
        userPermissions.some(perm => perm.resource === resource && perm.action === action);

      logger.info('Permission check completed', {
        userId,
        userRole: req.user.role,
        resource,
        action,
        hasPermission,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: hasPermission ? 'Permission granted' : 'Permission denied',
        data: {
          userId,
          userRole: req.user.role,
          resource,
          action,
          hasPermission,
          checkedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Permission check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        resource: req.body?.resource,
        action: req.body?.action,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Permission check failed',
        hasPermission: false
      });
    }
  };

  checkMultiplePermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          hasPermission: false
        });
        return;
      }

      const { permissions, requireAll = true } = req.body;
      const userId = req.user.userId;

      if (req.user.role === 'SUPER_ADMIN') {
        res.status(200).json({
          success: true,
          message: 'All permissions granted (SUPER_ADMIN)',
          data: {
            userId,
            userRole: req.user.role,
            permissions,
            hasPermission: true,
            requireAll,
            checkedAt: new Date().toISOString()
          }
        });
        return;
      }

      const userPermissions = await this.roleService.getAdminPermissions(userId);

      let hasPermission: boolean;
      if (requireAll) {
        hasPermission = permissions.every((requiredPerm: { resource: ResourceType, action: PermissionAction }) =>
          userPermissions.some(userPerm =>
            userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
          )
        );
      } else {
        hasPermission = permissions.some((requiredPerm: { resource: ResourceType, action: PermissionAction }) =>
          userPermissions.some(userPerm =>
            userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
          )
        );
      }

      logger.info('Multiple permissions check completed', {
        userId,
        userRole: req.user.role,
        permissions,
        requireAll,
        hasPermission,
        userPermissionsCount: userPermissions.length,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: hasPermission ? 'Permissions granted' : 'Permissions denied',
        data: {
          userId,
          userRole: req.user.role,
          permissions,
          requireAll,
          hasPermission,
          checkedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Multiple permissions check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        permissions: req.body?.permissions,
        requireAll: req.body?.requireAll,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Permission check failed',
        hasPermission: false
      });
    }
  };

  verifyTokenAndPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'Access token required',
          hasPermission: false
        });
        return;
      }

      let decoded;
      try {
        decoded = JWTUtils.verifyAccessToken(token);
      } catch (error) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired access token',
          hasPermission: false
        });
        return;
      }

      const { resource, action, permissions, requireAll = true } = req.body;

      if (decoded.role === 'SUPER_ADMIN') {
        res.status(200).json({
          success: true,
          message: 'Permission granted (SUPER_ADMIN)',
          data: {
            userId: decoded.userId,
            userRole: decoded.role,
            resource,
            action,
            permissions,
            hasPermission: true,
            checkedAt: new Date().toISOString()
          }
        });
        return;
      }

      const userPermissions = await this.roleService.getAdminPermissions(decoded.userId);

      let hasPermission = false;

      if (resource && action) {
        hasPermission = userPermissions.some(perm => perm.resource === resource && perm.action === action);
      } else if (permissions && Array.isArray(permissions)) {
        if (requireAll) {
          hasPermission = permissions.every((requiredPerm: { resource: ResourceType, action: PermissionAction }) =>
            userPermissions.some(userPerm =>
              userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
            )
          );
        } else {
          hasPermission = permissions.some((requiredPerm: { resource: ResourceType, action: PermissionAction }) =>
            userPermissions.some(userPerm =>
              userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
            )
          );
        }
      }

      logger.info('Token verification and permission check completed', {
        userId: decoded.userId,
        userRole: decoded.role,
        resource,
        action,
        permissions,
        requireAll,
        hasPermission,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: hasPermission ? 'Permission granted' : 'Permission denied',
        data: {
          userId: decoded.userId,
          userRole: decoded.role,
          email: decoded.email,
          sessionId: decoded.sessionId,
          resource,
          action,
          permissions,
          requireAll,
          hasPermission,
          checkedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Token verification and permission check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resource: req.body?.resource,
        action: req.body?.action,
        permissions: req.body?.permissions,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Permission verification failed',
        hasPermission: false
      });
    }
  };

  checkPermissionByAdminId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { adminId, resource, action } = req.body;

      const admin = await this.roleService.getAdminById(adminId);

      if (admin.role === 'SUPER_ADMIN') {
        logger.info('Permission granted for admin by ID (SUPER_ADMIN)', {
          adminId,
          resource,
          action,
          userRole: admin.role,
          ip: req.ip,
        });

        res.status(200).json({
          success: true,
          message: 'Permission granted (SUPER_ADMIN)',
          data: {
            adminId,
            userRole: admin.role,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            resource,
            action,
            hasPermission: true,
            checkedAt: new Date().toISOString()
          }
        });
        return;
      }

      const userPermissions = await this.roleService.getAdminPermissions(adminId);

      const hasPermission = userPermissions.some(perm => perm.resource === resource && perm.action === action);

      logger.info('Permission check by admin ID completed', {
        adminId,
        userRole: admin.role,
        resource,
        action,
        hasPermission,
        userPermissionsCount: userPermissions.length,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: hasPermission ? 'Permission granted' : 'Permission denied',
        data: {
          adminId,
          userRole: admin.role,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          resource,
          action,
          hasPermission,
          checkedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Permission check by admin ID error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: req.body?.adminId,
        resource: req.body?.resource,
        action: req.body?.action,
        ip: req.ip,
      });

      if (error instanceof Error && error.message.includes('Admin not found')) {
        res.status(404).json({
          success: false,
          message: 'Admin not found',
          hasPermission: false
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Permission check failed',
          hasPermission: false
        });
      }
    }
  };

  checkMultiplePermissionsByAdminId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { adminId, permissions, requireAll = true } = req.body;

      const admin = await this.roleService.getAdminById(adminId);

      if (admin.role === 'SUPER_ADMIN') {
        logger.info('All permissions granted for admin by ID (SUPER_ADMIN)', {
          adminId,
          permissions,
          requireAll,
          userRole: admin.role,
          ip: req.ip,
        });

        res.status(200).json({
          success: true,
          message: 'All permissions granted (SUPER_ADMIN)',
          data: {
            adminId,
            userRole: admin.role,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            permissions,
            requireAll,
            hasPermission: true,
            checkedAt: new Date().toISOString()
          }
        });
        return;
      }

      const userPermissions = await this.roleService.getAdminPermissions(adminId);

      let hasPermission: boolean;
      if (requireAll) {
        hasPermission = permissions.every((requiredPerm: { resource: ResourceType, action: PermissionAction }) =>
          userPermissions.some(userPerm =>
            userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
          )
        );
      } else {
        hasPermission = permissions.some((requiredPerm: { resource: ResourceType, action: PermissionAction }) =>
          userPermissions.some(userPerm =>
            userPerm.resource === requiredPerm.resource && userPerm.action === requiredPerm.action
          )
        );
      }

      logger.info('Multiple permissions check by admin ID completed', {
        adminId,
        userRole: admin.role,
        permissions,
        requireAll,
        hasPermission,
        userPermissionsCount: userPermissions.length,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: hasPermission ? 'Permissions granted' : 'Permissions denied',
        data: {
          adminId,
          userRole: admin.role,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          permissions,
          requireAll,
          hasPermission,
          checkedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Multiple permissions check by admin ID error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: req.body?.adminId,
        permissions: req.body?.permissions,
        requireAll: req.body?.requireAll,
        ip: req.ip,
      });

      if (error instanceof Error && error.message.includes('Admin not found')) {
        res.status(404).json({
          success: false,
          message: 'Admin not found',
          hasPermission: false
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Permission check failed',
          hasPermission: false
        });
      }
    }
  };
}

export { PermissionController };