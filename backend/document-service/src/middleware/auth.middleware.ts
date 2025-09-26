import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';

interface AuthenticatedUser {
  userId: string;
  userType: 'USER' | 'CONTRACTOR';
  email: string;
  role: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export class AuthMiddleware {
  private readonly USER_JWT_SECRET: string;
  private readonly CONTRACTOR_JWT_SECRET: string;

  constructor() {
    this.USER_JWT_SECRET = process.env.USER_JWT_SECRET || 'user-service-secret';
    this.CONTRACTOR_JWT_SECRET = process.env.CONTRACTOR_JWT_SECRET || 'contractor-service-secret';
  }

  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Missing or invalid authorization header', {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.status(401).json({
          success: false,
          error: 'Access denied',
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required'
        });
        return;
      }

      const token = authHeader.substring(7);

      // Try to decode the token to determine if it's USER or CONTRACTOR
      let decoded: any = null;
      let userType: 'USER' | 'CONTRACTOR' | null = null;

      // First try with USER JWT secret
      try {
        decoded = jwt.verify(token, this.USER_JWT_SECRET);
        userType = 'USER';
        logger.info('Token verified with USER service secret', { userId: decoded.userId });
      } catch (userJwtError) {
        // If USER verification fails, try CONTRACTOR JWT secret
        try {
          decoded = jwt.verify(token, this.CONTRACTOR_JWT_SECRET);
          userType = 'CONTRACTOR';
          logger.info('Token verified with CONTRACTOR service secret', { userId: decoded.userId });
        } catch (contractorJwtError) {
          logger.warn('Token verification failed with both secrets', {
            userError: userJwtError instanceof Error ? userJwtError.message : 'Unknown',
            contractorError: contractorJwtError instanceof Error ? contractorJwtError.message : 'Unknown',
            ip: req.ip
          });

          res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
            message: 'The provided token is invalid or expired'
          });
          return;
        }
      }

      if (!decoded || !userType) {
        res.status(401).json({
          success: false,
          error: 'Token verification failed',
          code: 'VERIFICATION_FAILED'
        });
        return;
      }

      // Extract user info from token payload
      const { userId, email, role, sessionId } = decoded;

      if (!userId || !email) {
        logger.warn('Token missing required fields', {
          tokenPayload: { userId, email, role, sessionId },
          userType,
          ip: req.ip
        });

        res.status(401).json({
          success: false,
          error: 'Invalid token payload',
          code: 'INVALID_TOKEN_PAYLOAD',
          message: 'Token does not contain required user information'
        });
        return;
      }

      // Attach user info to request
      req.user = {
        userId,
        userType,
        email,
        role: role || 'user',
        sessionId: sessionId || ''
      };

      logger.info('User authenticated successfully', {
        userId,
        userType,
        email,
        role: req.user.role
      });

      next();
    } catch (error: any) {
      logger.error('Authentication error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR',
        message: 'Internal authentication error'
      });
    }
  };

  // Method to verify token against a specific service secret (useful for debugging)
  public verifyWithSecret(token: string, secret: string): any {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }

  // Method to get token info without verification (for debugging)
  public decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }
}