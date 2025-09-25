import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { PhoneVerificationService } from '../services/phone-verification.service';
import { RegisterRequest, LoginRequest, UpdateProfileRequest } from '../validation/schemas';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

class AuthController {
  private authService: AuthService;
  private phoneVerificationService: PhoneVerificationService;

  constructor() {
    this.authService = new AuthService();
    this.phoneVerificationService = new PhoneVerificationService();
  }

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: RegisterRequest = req.body;

      const result = await this.authService.registerUser(data);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          user: result.user,
        },
      });

    } catch (error) {
      logger.error('User registration error:', {
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

      const result = await this.authService.loginUser(data);

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
      logger.error('User login error:', {
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

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
        return;
      }

      const tokens = await this.authService.refreshTokens(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: tokens,
      });

    } catch (error) {
      logger.error('Token refresh error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
      });

      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Token refresh failed',
        });
      }
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // In a real app, you'd get sessionId from the decoded JWT token
      // For now, we'll get it from the request body
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
        return;
      }

      await this.authService.logout(sessionId);

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });

    } catch (error) {
      logger.error('Logout error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Logout failed',
      });
    }
  };

  sendPhoneOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.body;
      const userId = undefined;

      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      await this.phoneVerificationService.sendOTP(phoneNumber, userId);

      res.json({
        success: true,
        message: 'OTP sent successfully'
      });
    } catch (error) {
      logger.error('Send phone OTP error:', error);

      if (error instanceof Error) {
        if (error.message.includes('Invalid Saudi phone number') || error.message.includes('Invalid phone number format')) {
          res.status(400).json({ error: 'Invalid Saudi phone number format' });
        } else if (error.message.includes('Too many OTP requests')) {
          res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
        } else {
          res.status(500).json({ error: 'Failed to send OTP' });
        }
      } else {
        res.status(500).json({ error: 'Failed to send OTP' });
      }
    }
  };

  verifyPhoneOTP = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber, otp } = req.body;
      const userId = undefined;

      if (!phoneNumber || !otp) {
        res.status(400).json({ error: 'Phone number and OTP are required' });
        return;
      }

      const isValid = await this.phoneVerificationService.verifyOTP(phoneNumber, otp, userId);

      if (isValid) {
        res.json({
          success: true,
          message: 'Phone verification successful'
        });
      } else {
        res.status(400).json({ error: 'Invalid OTP' });
      }
    } catch (error) {
      logger.error('Verify phone OTP error:', error);

      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          res.status(400).json({ error: 'OTP expired. Please request a new one.' });
        } else if (error.message.includes('Invalid OTP')) {
          res.status(400).json({ error: 'Invalid OTP' });
        } else {
          res.status(500).json({ error: 'Phone verification failed' });
        }
      } else {
        res.status(500).json({ error: 'Phone verification failed' });
      }
    }
  };

  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const user = await this.authService.getUserById(req.user.id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user
      });

    } catch (error) {
      logger.error('Get profile error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const updateData: UpdateProfileRequest = req.body;

      // Check if there are any fields to update
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
        return;
      }

      const updatedUser = await this.authService.updateUserProfile(req.user.id, updateData);

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });

    } catch (error) {
      logger.error('Update profile error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip
      });

      if (error instanceof Error) {
        if (error.message.includes('Email already registered')) {
          res.status(409).json({
            success: false,
            message: 'Email already registered'
          });
        } else if (error.message.includes('Phone number already registered')) {
          res.status(409).json({
            success: false,
            message: 'Phone number already registered'
          });
        } else if (error.message.includes('National ID already registered')) {
          res.status(409).json({
            success: false,
            message: 'National ID already registered'
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to update profile'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update profile'
        });
      }
    }
  };
}

export { AuthController };