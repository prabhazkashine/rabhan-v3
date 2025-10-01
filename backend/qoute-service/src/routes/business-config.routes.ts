import { Router } from 'express';
import { businessConfigController } from '../controllers/business-config.controller';
import { validateRequest } from '../middleware/validateRequest';
import { updateBusinessConfigSchema, updateContractorCommissionSchema } from '../types/business-config.types';

const router = Router();

/**
 * @route   GET /api/business-config
 * @desc    Get business configuration (rabhan commission, overprice, VAT percentages)
 * @access  Private (Admin, Super Admin only)
 */
router.get('/', businessConfigController.getBusinessConfig);

/**
 * @route   PUT /api/business-config
 * @desc    Update business configuration (rabhan commission, overprice, VAT percentages)
 * @access  Private (Admin, Super Admin only)
 */
router.put(
  '/',
  validateRequest(updateBusinessConfigSchema),
  businessConfigController.updateBusinessConfig
);

/**
 * @route   GET /api/business-config/contractor/:contractor_id/commission
 * @desc    Get contractor's rabhan commission
 * @access  Private (Admin, Super Admin only)
 */
router.get('/contractor/:contractor_id/commission', businessConfigController.getContractorCommission);

/**
 * @route   PUT /api/business-config/contractor/:contractor_id/commission
 * @desc    Update contractor's rabhan commission
 * @access  Private (Admin, Super Admin only)
 */
router.put(
  '/contractor/:contractor_id/commission',
  validateRequest(updateContractorCommissionSchema),
  businessConfigController.updateContractorCommission
);

export default router;
