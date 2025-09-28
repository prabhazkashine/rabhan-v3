import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { createPermissionMiddleware } from './dynamicPermissionMiddleware';
dotenv.config();

// Type guard for axios errors
interface AxiosErrorType {
  response?: {
    status: number;
  };
  isAxiosError?: boolean;
}

const isAxiosError = (error: unknown): error is AxiosErrorType => {
  return typeof error === 'object' && error !== null && 'response' in error;
};

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL;

interface PermissionRequest {
  resource: string;
  action: string;
  requireAll?: boolean;
}

interface PermissionResponse {
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

export const checkPermission = (resource: string, action: string, requireAll: boolean = true) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const userRole = req.headers['x-user-role'];

      if(userRole === "super_admin"){
        return next();
      }

      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Bearer token required'
        });
      }

      if (!ADMIN_SERVICE_URL) {
        console.error('ADMIN_SERVICE_URL not configured');
        return res.status(503).json({
          success: false,
          message: 'Service configuration error'
        });
      }

      const permissionPayload: PermissionRequest = {
        resource,
        action,
        requireAll
      };

      const response = await axios.post<PermissionResponse>(
        `${ADMIN_SERVICE_URL}/api/permissions/verify`,
        permissionPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );

      if (response.status === 200 && response.data.success && response.data.data.hasPermission) {
        req.headers['x-permission-checked'] = 'true';
        req.headers['x-checked-resource'] = resource;
        req.headers['x-checked-action'] = action;
        return next();
      } else {
        return res.status(403).json({
          success: false,
          message: response.data.message || 'Permission denied',
          requiredPermission: { resource, action }
        });
      }

    } catch (error: unknown) {
      console.error('Permission check error:', error);

      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }
        if (error.response?.status === 500) {
          return res.status(503).json({
            success: false,
            message: 'Permission service unavailable'
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Permission verification failed'
      });
    }
  };
};

export const checkMultiplePermissions = (permissions: Array<{resource: string, action: string}>, requireAll: boolean = true) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Bearer token required'
        });
      }

      if (!ADMIN_SERVICE_URL) {
        console.error('ADMIN_SERVICE_URL not configured');
        return res.status(503).json({
          success: false,
          message: 'Service configuration error'
        });
      }

      const permissionPayload = {
        permissions,
        requireAll
      };

      const response = await axios.post<PermissionResponse>(
        `${ADMIN_SERVICE_URL}/api/auth/verify-permissions`,
        permissionPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );

      if (response.status === 200 && response.data.success && response.data.data.hasPermission) {
        req.headers['x-permission-checked'] = 'true';
        req.headers['x-checked-permissions'] = JSON.stringify(permissions);
        return next();
      } else {
        return res.status(403).json({
          success: false,
          message: response.data.message || 'Permission denied',
          requiredPermissions: permissions,
          requireAll
        });
      }

    } catch (error: unknown) {
      console.error('Multiple permission check error:', error);

      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
          });
        }
        if (error.response?.status === 500) {
          return res.status(503).json({
            success: false,
            message: 'Permission service unavailable'
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Permission verification failed'
      });
    }
  };
};


export const autoPermissionCheck = (resource: string) => {
    
    return (req: Request, res: Response, next: NextFunction) => {
        const method = req.method.toUpperCase();
        let action: string;

        switch (method) {
            case 'GET':
                action = 'READ';
                break;
            case 'POST':
                action = 'CREATE'; 
                break;
            case 'PUT':
            case 'PATCH':
                action = 'UPDATE';
                break;
            case 'DELETE':
                action = 'DELETE'; 
                break;
            default:
                return res.status(405).json({ success: false, message: 'Method not allowed' });
        }

        const permissionMiddleware = createPermissionMiddleware(resource.toUpperCase(), action);
        permissionMiddleware(req, res, next);
    };
};