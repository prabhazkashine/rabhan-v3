import { Request, Response, NextFunction } from 'express';
import { SolarCalculatorService } from '../services/solarCalculator.service';
import { solarCalculationSchema } from '../validators/solar.validator';
import { SolarCalculationInput } from '../types/solar.types';
import { logger } from '../utils/logger';

export class SolarCalculatorController {
  private solarCalculatorService: SolarCalculatorService;

  constructor() {
    this.solarCalculatorService = new SolarCalculatorService();
  }

  public calculate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = process.hrtime.bigint();

      const validationResult = solarCalculationSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }

      const input: SolarCalculationInput = validationResult.data;

      if ((req as any).user?.id) {
        input.customerId = (req as any).user.id;
      }

      const result = await this.solarCalculatorService.calculate(input);

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;

      logger.info('Solar calculation completed', {
        calculationId: result.calculationId,
        clientType: result.clientType,
        duration: `${duration}ms`,
        customerId: input.customerId
      });

      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          calculationId: result.calculationId,
          timestamp: result.calculatedAt,
          processingTime: `${duration.toFixed(4)}ms`
        }
      });
    } catch (error) {
      logger.error('Solar calculation failed', { error, body: req.body });
      next(error);
    }
  };
}
