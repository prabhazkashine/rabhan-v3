import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Validate business rule constraints middleware
 */
export const validateBusinessConstraints = {
  /**
   * Validate price per kWp doesn't exceed maximum
   */
  pricePerKwp: (req: Request, res: Response, next: NextFunction): void => {
    const { price_per_kwp } = req.body;
    const maxPrice = parseFloat(process.env.MAX_PRICE_PER_KWP || '2000');

    if (price_per_kwp && price_per_kwp > maxPrice) {
      logger.warn('Price per kWp exceeds maximum', {
        provided: price_per_kwp,
        maximum: maxPrice,
        user_id: req.headers['x-user-id'],
      });

      res.status(400).json({
        success: false,
        message: 'Price validation failed',
        errors: [
          {
            field: 'price_per_kwp',
            message: `Price per kWp cannot exceed ${maxPrice} SAR`,
            value: price_per_kwp,
          },
        ],
      });
      return;
    }

    next();
  },
};