import { Request, Response } from 'express';
import { businessConfigService } from '../services/business-config.service';
import { asyncHandler } from '../middleware/errorHandler';
import { logger, performanceLogger } from '../utils/logger';
import { validateUserId, requireRole } from '../utils/validation';

export class BusinessConfigController {
  /**
   * @route   GET /api/business-config
   * @desc    Get business configuration (commission, overprice, VAT)
   * @access  Private (Admin, Super Admin only)
   */
  getBusinessConfig = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_business_config');

    try {
      const adminId = validateUserId(req);
      requireRole(req, ['admin', 'super_admin']);

      const config = await businessConfigService.getBusinessConfig();

      res.json({
        success: true,
        message: 'Business configuration retrieved successfully',
        data: config,
      });

      logger.info('Business config retrieved via API', {
        admin_id: adminId,
      });
    } catch (error) {
      logger.error('Get business config API error', {
        admin_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   PUT /api/business-config
   * @desc    Update business configuration (commission, overprice, VAT)
   * @access  Private (Admin, Super Admin only)
   */
  updateBusinessConfig = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_update_business_config');

    try {
      const adminId = validateUserId(req);
      requireRole(req, ['admin', 'super_admin']);

      const updates = req.body;

      const config = await businessConfigService.updateBusinessConfig(updates, adminId);

      res.json({
        success: true,
        message: 'Business configuration updated successfully',
        data: config,
      });

      logger.info('Business config updated via API', {
        admin_id: adminId,
        updates,
      });
    } catch (error) {
      logger.error('Update business config API error', {
        admin_id: req.headers['x-user-id'],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   GET /api/business-config/contractor/:contractor_id/commission
   * @desc    Get contractor's rabhan commission
   * @access  Private (Admin, Super Admin only)
   */
  getContractorCommission = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_get_contractor_commission');

    try {
      const adminId = validateUserId(req);
      requireRole(req, ['admin', 'super_admin']);

      const { contractor_id } = req.params;

      const commission = await businessConfigService.getContractorCommission(contractor_id);

      res.json({
        success: true,
        message: 'Contractor commission retrieved successfully',
        data: commission,
      });

      logger.info('Contractor commission retrieved via API', {
        admin_id: adminId,
        contractor_id,
      });
    } catch (error) {
      logger.error('Get contractor commission API error', {
        admin_id: req.headers['x-user-id'],
        contractor_id: req.params.contractor_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string });
    }
  });

  /**
   * @route   PUT /api/business-config/contractor/:contractor_id/commission
   * @desc    Update contractor's rabhan commission
   * @access  Private (Admin, Super Admin only)
   */
  updateContractorCommission = asyncHandler(async (req: Request, res: Response) => {
    const timer = performanceLogger.startTimer('controller_update_contractor_commission');

    try {
      const adminId = validateUserId(req);
      requireRole(req, ['admin', 'super_admin']);

      const { contractor_id } = req.params;
      const updates = req.body;

      const commission = await businessConfigService.updateContractorCommission(
        contractor_id,
        updates,
        adminId
      );

      res.json({
        success: true,
        message: 'Contractor commission updated successfully',
        data: commission,
      });

      logger.info('Contractor commission updated via API', {
        admin_id: adminId,
        contractor_id,
        updates,
      });
    } catch (error) {
      logger.error('Update contractor commission API error', {
        admin_id: req.headers['x-user-id'],
        contractor_id: req.params.contractor_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ admin_id: req.headers['x-user-id'] as string });
    }
  });
}

export const businessConfigController = new BusinessConfigController();
