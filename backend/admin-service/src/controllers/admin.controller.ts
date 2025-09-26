import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { CreateAdminRequest, UpdateAdminRequest } from '../types/admin.types';
import { logger } from '../utils/logger';

class AdminController {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  createAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const data: CreateAdminRequest = req.body;

      const admin = await this.adminService.createAdmin(data, req.user.userId);

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        data: admin,
      });

    } catch (error) {
      logger.error('Admin creation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body?.email,
        createdBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Email already registered')) {
          res.status(409).json({
            success: false,
            message: 'Email already registered'
          });
        } else if (error.message.includes('Password validation failed')) {
          res.status(400).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to create admin'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to create admin'
        });
      }
    }
  };

  updateAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const adminId = req.params.id;
      const data: UpdateAdminRequest = req.body;

      const admin = await this.adminService.updateAdmin(adminId, data, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Admin updated successfully',
        data: admin,
      });

    } catch (error) {
      logger.error('Admin update error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: req.params.id,
        updatedBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Admin not found')) {
          res.status(404).json({
            success: false,
            message: 'Admin not found'
          });
        } else if (error.message.includes('Email already registered')) {
          res.status(409).json({
            success: false,
            message: 'Email already registered'
          });
        } else if (error.message.includes('Cannot change your own role')) {
          res.status(403).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to update admin'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update admin'
        });
      }
    }
  };

  deleteAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const adminId = req.params.id;

      await this.adminService.deleteAdmin(adminId, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Admin deleted successfully',
      });

    } catch (error) {
      logger.error('Admin deletion error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: req.params.id,
        deletedBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Admin not found')) {
          res.status(404).json({
            success: false,
            message: 'Admin not found'
          });
        } else if (error.message.includes('Cannot delete your own account')) {
          res.status(403).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to delete admin'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete admin'
        });
      }
    }
  };

  getAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
      const adminId = req.params.id;

      const admin = await this.adminService.getAdminById(adminId);

      res.status(200).json({
        success: true,
        message: 'Admin retrieved successfully',
        data: admin,
      });

    } catch (error) {
      logger.error('Get admin error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: req.params.id,
        requestedBy: req.user?.userId,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Admin not found')) {
          res.status(404).json({
            success: false,
            message: 'Admin not found'
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to retrieve admin'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve admin'
        });
      }
    }
  };

  listAdmins = async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, role, status } = req.query;

      const result = await this.adminService.listAdmins(
        Number(page) || 1,
        Number(limit) || 10,
        role as any,
        status as any
      );

      res.status(200).json({
        success: true,
        message: 'Admins retrieved successfully',
        data: result,
      });

    } catch (error) {
      logger.error('List admins error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.userId,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve admins'
      });
    }
  };
}

export { AdminController };