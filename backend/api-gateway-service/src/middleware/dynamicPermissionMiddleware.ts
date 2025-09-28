import { Request, Response, NextFunction } from 'express';
import { getRequiredPermission, RoutePermission } from '../config/permissions';
import { checkPermission, checkMultiplePermissions } from './permissionMiddleware';

export const dynamicPermissionCheck = (req: Request, res: Response, next: NextFunction) => {
  const route = req.route?.path || req.path;
  const method = req.method;

  const requiredPermission = getRequiredPermission(route, method);

  if (!requiredPermission) {
    return next();
  }

  if (!Array.isArray(requiredPermission)) {
    const singlePermission = requiredPermission as RoutePermission;
    return checkPermission(singlePermission.resource, singlePermission.action)(req, res, next);
  }

  const multiplePermissions = requiredPermission as RoutePermission[];
  const permissions = multiplePermissions.map(p => ({
    resource: p.resource,
    action: p.action
  }));

  return checkMultiplePermissions(permissions, true)(req, res, next);
};

export const createPermissionMiddleware = (resource: string, action: string) => {
  return checkPermission(resource, action);
};

export const createAnyPermissionMiddleware = (permissions: Array<{resource: string, action: string}>) => {
  return checkMultiplePermissions(permissions, false);
};

export const createAllPermissionsMiddleware = (permissions: Array<{resource: string, action: string}>) => {
  return checkMultiplePermissions(permissions, true); 
};