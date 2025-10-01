import { Router } from 'express';
import { SolarCalculatorController } from '../controllers/solarCalculator.controller';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();
const solarCalculatorController = new SolarCalculatorController();

router.post(
  '/calculate',
  rateLimiter({ windowMs: 60000, max: 100 }),
  solarCalculatorController.calculate
);

export default router;
