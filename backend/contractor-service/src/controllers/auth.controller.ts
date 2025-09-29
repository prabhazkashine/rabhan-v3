import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ContractorRegisterRequest, ContractorLoginRequest } from '../validation/contractor-schemas';
import { SAMALogger } from '../utils/sama-logger';
import { logger } from '../utils/logger';
import { PhoneVerificationService } from '../services/phone-verification.service';
import { JWTUtils } from '../utils/jwt';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

export class AuthController {
  
  private authService = new AuthService();
  private phoneVerificationService: PhoneVerificationService;

  constructor() {
    this.authService = new AuthService();
    this.phoneVerificationService = new PhoneVerificationService();
  }

  contractorRegister = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: ContractorRegisterRequest = req.body;

      data.role = 'CONTRACTOR';
      if (!data.userType) {
        data.userType = 'BUSINESS';
      }

      const companyName = data.companyName;

      SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION_ATTEMPT', undefined, {
        email: data.email,
        companyName: companyName,
        userType: data.userType,
        ip: req.ip
      });

      const tokens = await this.authService.register(data);

      SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION_SUCCESS', tokens.user?.id, {
        email: data.email,
        companyName: companyName,
        userType: data.userType,
        ip: req.ip,
        compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
      });

      res.status(201).json({
        success: true,
        message: 'Contractor registered successfully',
        data: tokens
      });

    } catch (error) {
      logger.error('Contractor registration error:', error);

      SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION_FAILED', undefined, {
        email: req.body.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
      });

      if (error instanceof Error) {
        if (error.message.includes('Email already registered')) {
          res.status(409).json({
            success: false,
            error: 'Business email already registered'
          });
        } else if (error.message.includes('National ID already registered')) {
          res.status(409).json({
            success: false,
            error: 'National ID already registered'
          });
        } else if (error.message.includes('Password must')) {
          res.status(400).json({
            success: false,
            error: error.message
          });
        } else if (error.message.includes('Company name is required')) {
          res.status(400).json({
            success: false,
            error: 'Company name is required'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Contractor registration failed'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Contractor registration failed'
        });
      }
    }
  };

  contractorLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password }: ContractorLoginRequest = req.body;

      SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_ATTEMPT', undefined, {
        email,
        ip: req.ip
      });

      const tokens = await this.authService.login(email, password, req.ip);

      SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_SUCCESS', tokens.user?.id, {
        email,
        ip: req.ip,
        compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: tokens
      });

    } catch (error) {
      logger.error('Contractor login error:', error);

      SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_FAILED', undefined, {
        email: req.body.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
      });

      if (error instanceof Error) {
        if (error.message.includes('Invalid email or password')) {
          res.status(401).json({
            success: false,
            error: 'Invalid email or password'
          });
        } else if (error.message.includes('Account is locked')) {
          res.status(423).json({
            success: false,
            error: 'Account is locked. Please try again later.'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Login failed'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Login failed'
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
          error: 'Refresh token is required'
        });
        return;
      }

      const tokens = await this.authService.refreshToken(refreshToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens
      });

    } catch (error) {
      logger.error('Token refresh error:', error);

      res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      // The user is available from auth middleware
      const user = (req as any).user;

      const userId = user.id;

      const contractor = await prisma.contractor.findUnique({
        where: { id: userId },
      });


      if (!contractor) {
        res.status(401).json({
          success: false,
          error: 'Contractor not found'
        });
        return;
      }

      if (contractor) {
          const { passwordHash, ...safeData } = contractor;
          res.json({
            success: true,
            message: "Profile retrieved successfully",
            data: safeData,
          });
        }

    } catch (error) {
      logger.error('Get profile error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
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

  verify = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Access token is required',
          data: {
            isValid: false
          }
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const payload = JWTUtils.verifyAccessToken(token);

        res.status(200).json({
          success: true,
          message: 'Token is valid',
          data: {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
            sessionId: payload.sessionId,
            isValid: true
          }
        });

      } catch (tokenError) {
        logger.warn('Invalid access token in verify endpoint:', {
          error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
          ip: req.ip
        });

        res.status(401).json({
          success: false,
          message: 'Invalid or expired access token',
          data: {
            isValid: false
          }
        });
      }

    } catch (error) {
      logger.error('Token verification error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: 'Token verification failed',
        data: {
          isValid: false
        }
      });
    }
  };
}

export const authController = new AuthController();