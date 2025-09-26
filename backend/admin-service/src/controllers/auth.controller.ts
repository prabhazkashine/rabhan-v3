import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterRequest, LoginRequest } from '../types/auth.types';
import { logger } from '../utils/logger';

class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: RegisterRequest = req.body;

      const result = await this.authService.registerAdmin(data);

      res.status(201).json({
        success: true,
        message: 'Admin registered successfully',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          user: result.user,
        },
      });

    } catch (error) {
      logger.error('Admin registration error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body?.email,
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
            message: 'Registration failed'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Registration failed'
        });
      }
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: LoginRequest = req.body;

      const result = await this.authService.loginAdmin(data);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          user: result.user,
        },
      });

    } catch (error) {
      logger.error('Admin login error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body?.email,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('Invalid email or password')) {
          res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        } else if (error.message.includes('Account is locked')) {
          res.status(423).json({
            success: false,
            message: error.message
          });
        } else if (error.message.includes('Account is suspended')) {
          res.status(403).json({
            success: false,
            message: error.message
          });
        } else if (error.message.includes('Too many failed attempts')) {
          res.status(429).json({
            success: false,
            message: error.message
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Login failed'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Login failed'
        });
      }
    }
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const profile = await this.authService.getAdminProfile(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: profile,
      });

    } catch (error) {
      logger.error('Get profile error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
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
            message: 'Failed to retrieve profile'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve profile'
        });
      }
    }
  };
}

export { AuthController };