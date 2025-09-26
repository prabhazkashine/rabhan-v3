import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

class AuthMiddleware {
  authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Access token is required'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const payload = JWTUtils.verifyAccessToken(token);

        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          sessionId: payload.sessionId
        };

        next();
      } catch (tokenError) {
        logger.warn('Invalid access token:', {
          error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
          ip: req.ip
        });

        res.status(401).json({
          success: false,
          message: 'Invalid or expired access token'
        });
      }

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
}

export const authMiddleware = new AuthMiddleware();