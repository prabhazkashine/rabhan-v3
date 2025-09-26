import { Request, Response } from 'express';
import { RoleService } from '../services/role.service';
import { CreateRoleRequest, UpdateRoleRequest } from '../types/permissions.types';
import { logger } from '../utils/logger';

class RoleController {
  private roleService: RoleService;

  constructor() {
    this.roleService = new RoleService();
  }

  createRole = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const data: CreateRoleRequest = req.body;

      const role = await this.roleService.createRole(data, req.user.userId);

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role,
      });

    } catch (error) {
      logger.error('Role creation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roleName: req.body?.name,
        createdBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Role name already exists')) {
          res.status(409).json({
            success: false,
            message: 'Role name already exists'
          });
        } else if (error.message.includes('Permission') && error.message.includes('does not exist')) {
          res.status(400).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to create role'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to create role'
        });
      }
    }
  };

  updateRole = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const roleId = req.params.id;
      const data: UpdateRoleRequest = req.body;

      const role = await this.roleService.updateRole(roleId, data, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: role,
      });

    } catch (error) {
      logger.error('Role update error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roleId: req.params.id,
        updatedBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Role not found')) {
          res.status(404).json({
            success: false,
            message: 'Role not found'
          });
        } else if (error.message.includes('Role name already exists')) {
          res.status(409).json({
            success: false,
            message: 'Role name already exists'
          });
        } else if (error.message.includes('Permission') && error.message.includes('does not exist')) {
          res.status(400).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to update role'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update role'
        });
      }
    }
  };

  deleteRole = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const roleId = req.params.id;

      await this.roleService.deleteRole(roleId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Role deleted successfully',
      });

    } catch (error) {
      logger.error('Role deletion error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roleId: req.params.id,
        deletedBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Role not found')) {
          res.status(404).json({
            success: false,
            message: 'Role not found'
          });
        } else if (error.message.includes('Cannot delete role that is assigned to admins')) {
          res.status(409).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to delete role'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete role'
        });
      }
    }
  };

  getRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const roleId = req.params.id;

      const role = await this.roleService.getRoleById(roleId);

      res.status(200).json({
        success: true,
        message: 'Role retrieved successfully',
        data: role,
      });

    } catch (error) {
      logger.error('Get role error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roleId: req.params.id,
        requestedBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Role not found')) {
          res.status(404).json({
            success: false,
            message: 'Role not found'
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to retrieve role'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve role'
        });
      }
    }
  };

  listRoles = async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, isActive } = req.query;

      const result = await this.roleService.listRoles(
        Number(page) || 1,
        Number(limit) || 10,
        isActive !== undefined ? Boolean(isActive) : undefined
      );

      res.status(200).json({
        success: true,
        message: 'Roles retrieved successfully',
        data: result,
      });

    } catch (error) {
      logger.error('List roles error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve roles'
      });
    }
  };

  assignRole = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const adminId = req.params.adminId;
      const { roleId } = req.body;

      await this.roleService.assignRoleToAdmin(adminId, roleId, req.user.userId);

      res.status(200).json({
        success: true,
        message: roleId ? 'Role assigned successfully' : 'Role removed successfully',
      });

    } catch (error) {
      logger.error('Role assignment error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: req.params.adminId,
        roleId: req.body?.roleId,
        assignedBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Admin not found')) {
          res.status(404).json({
            success: false,
            message: 'Admin not found'
          });
        } else if (error.message.includes('Role not found')) {
          res.status(404).json({
            success: false,
            message: 'Role not found'
          });
        } else if (error.message.includes('Cannot assign inactive role')) {
          res.status(400).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to assign role'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to assign role'
        });
      }
    }
  };

  getPermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const permissions = await this.roleService.getAdminPermissions(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Permissions retrieved successfully',
        data: { permissions },
      });

    } catch (error) {
      logger.error('Get permissions error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve permissions'
      });
    }
  };

  initializePermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.roleService.initializePermissions();

      res.status(200).json({
        success: true,
        message: 'Permissions initialized successfully',
      });

    } catch (error) {
      logger.error('Initialize permissions error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to initialize permissions'
      });
    }
  };
}

export { RoleController };