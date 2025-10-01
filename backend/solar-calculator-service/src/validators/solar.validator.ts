import { z } from 'zod';
import { CalculationMode, ClientType } from '../types/solar.types';

export const solarCalculationSchema = z
  .object({
    mode: z.nativeEnum(CalculationMode, {
      errorMap: () => ({ message: 'Invalid calculation mode' })
    }),

    clientType: z.nativeEnum(ClientType, {
      errorMap: () => ({ message: 'Client type must be either RESIDENTIAL or COMMERCIAL' })
    }),

    monthlyConsumption: z.number().optional(),

    monthlyBill: z.number().optional(),

    numberOfInstallments: z.number().refine(
      (val) => [12, 18, 24, 30, 36, 48, 60].includes(val),
      { message: 'Invalid number of installments. Must be 12, 18, 24, 30, 36, 48, or 60' }
    ),

    customerId: z.string().uuid({ message: 'Customer ID must be a valid UUID' }).optional()
  })
  .superRefine((data, ctx) => {
    // Validate monthlyConsumption when mode is MONTHLY_CONSUMPTION
    if (data.mode === CalculationMode.MONTHLY_CONSUMPTION) {
      if (data.monthlyConsumption === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monthly consumption is required when using consumption mode',
          path: ['monthlyConsumption']
        });
      } else if (data.monthlyConsumption < 6000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monthly consumption must be at least 6,000 KWH',
          path: ['monthlyConsumption']
        });
      } else if (data.monthlyConsumption > 24000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monthly consumption cannot exceed 24,000 KWH',
          path: ['monthlyConsumption']
        });
      }

      // monthlyBill should not be present
      if (data.monthlyBill !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monthly bill should not be provided when using consumption mode',
          path: ['monthlyBill']
        });
      }
    }

    // Validate monthlyBill when mode is MONTHLY_BILL
    if (data.mode === CalculationMode.MONTHLY_BILL) {
      if (data.monthlyBill === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monthly bill is required when using bill mode',
          path: ['monthlyBill']
        });
      } else {
        const minBill = data.clientType === ClientType.RESIDENTIAL ? 1080 : 1200;
        if (data.monthlyBill < minBill) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Monthly bill must be at least ${minBill} SAR for ${data.clientType.toLowerCase()} clients`,
            path: ['monthlyBill']
          });
        }
      }

      // monthlyConsumption should not be present
      if (data.monthlyConsumption !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Monthly consumption should not be provided when using bill mode',
          path: ['monthlyConsumption']
        });
      }
    }
  });

export type SolarCalculationSchema = z.infer<typeof solarCalculationSchema>;
