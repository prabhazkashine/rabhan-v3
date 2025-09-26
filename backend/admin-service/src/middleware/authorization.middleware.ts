import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../generated/prisma';
import { logger } from '../utils/logger';

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    logger.warn('Authorization failed: No user in request', {
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

  if (req.user.role !== UserRole.SUPER_ADMIN) {
    logger.warn('Authorization failed: Insufficient permissions', {
      userId: req.user.userId,
      userRole: req.user.role,
      requiredRole: UserRole.SUPER_ADMIN,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(403).json({
      success: false,
      message: 'Super Admin access required'
    });
    return;
  }

  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    logger.warn('Authorization failed: No user in request', {
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

  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
    logger.warn('Authorization failed: Insufficient permissions', {
      userId: req.user.userId,
      userRole: req.user.role,
      requiredRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }

  next();
};