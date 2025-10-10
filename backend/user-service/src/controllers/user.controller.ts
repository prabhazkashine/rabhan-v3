import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { UpdateSamaCreditRequest } from '../validation/user.schemas';
import { logger } from '../utils/logger';

class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get user by ID
   * GET /api/users/:userId
   */
  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const user = await this.userService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: user
      });

    } catch (error) {
      logger.error('Get user by ID error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user'
      });
    }
  };

  /**
   * Update user SAMA credit amount
   * PATCH /api/users/:userId/sama-credit
   */
  updateSamaCredit = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const updateData: UpdateSamaCreditRequest = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      // Validate request body
      const { amount, operation, projectId, reason } = updateData;

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Amount must be a positive number'
        });
        return;
      }

      if (!operation || !['deduct', 'add'].includes(operation)) {
        res.status(400).json({
          success: false,
          message: 'Operation must be either "deduct" or "add"'
        });
        return;
      }

      if (!projectId) {
        res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          message: 'Reason is required'
        });
        return;
      }

      const result = await this.userService.updateSamaCredit(
        userId,
        amount,
        operation,
        projectId,
        reason
      );

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `SAMA credit ${operation === 'add' ? 'added' : 'deducted'} successfully`,
        data: result
      });

    } catch (error) {
      logger.error('Update SAMA credit error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        body: req.body,
        ip: req.ip
      });

      if (error instanceof Error) {
        if (error.message.includes('Insufficient')) {
          res.status(400).json({
            success: false,
            message: error.message
          });
        } else if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            message: 'User not found'
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to update SAMA credit'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update SAMA credit'
        });
      }
    }
  };
}

export { UserController };
