import { Response } from 'express';
import { UserProfileService } from '../services/user-profile.service';
import { UpdateUserProfileRequest } from '../validation/user-profile.schemas';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

class UserProfileController {
  private userProfileService: UserProfileService;

  constructor() {
    this.userProfileService = new UserProfileService();
  }

  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const profile = await this.userProfileService.getUserProfile(req.user.id);

      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'User profile not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully',
        data: profile
      });

    } catch (error) {
      logger.error('Get user profile error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user profile'
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

      const updateData: UpdateUserProfileRequest = req.body;

      // Check if there are any fields to update
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
        return;
      }

      const updatedProfile = await this.userProfileService.updateUserProfile(req.user.id, updateData);

      if (!updatedProfile) {
        res.status(404).json({
          success: false,
          message: 'User profile not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User profile updated successfully',
        data: updatedProfile
      });

    } catch (error) {
      logger.error('Update user profile error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('User profile not found')) {
          res.status(404).json({
            success: false,
            message: 'User profile not found'
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to update user profile'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update user profile'
        });
      }
    }
  };

  deleteProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      await this.userProfileService.deleteUserProfile(req.user.id);

      res.status(200).json({
        success: true,
        message: 'User profile deleted successfully'
      });

    } catch (error) {
      logger.error('Delete user profile error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip,
      });

      if (error instanceof Error) {
        if (error.message.includes('User profile not found')) {
          res.status(404).json({
            success: false,
            message: 'User profile not found'
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to delete user profile'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete user profile'
        });
      }
    }
  };

  getProfileCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const profile = await this.userProfileService.getUserProfile(req.user.id);

      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'User profile not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile completion status retrieved successfully',
        data: {
          profileCompleted: profile.profileCompleted,
          profileCompletionPercentage: profile.profileCompletionPercentage,
          bnplEligible: profile.bnplEligible,
          bnplMaxAmount: profile.bnplMaxAmount,
          bnplRiskScore: profile.bnplRiskScore,
          verificationStatus: profile.verificationStatus
        }
      });

    } catch (error) {
      logger.error('Get profile completion error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile completion status'
      });
    }
  };

  getBNPLEligibility = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const profile = await this.userProfileService.getUserProfile(req.user.id);

      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'User profile not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'BNPL eligibility retrieved successfully',
        data: {
          bnplEligible: profile.bnplEligible,
          bnplMaxAmount: profile.bnplMaxAmount,
          bnplRiskScore: profile.bnplRiskScore,
          verificationStatus: profile.verificationStatus,
          requirements: {
            employmentStatus: !!profile.employmentStatus,
            monthlyIncome: !!profile.monthlyIncome,
            profileCompleted: profile.profileCompleted
          }
        }
      });

    } catch (error) {
      logger.error('Get BNPL eligibility error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve BNPL eligibility'
      });
    }
  };
}

export { UserProfileController };