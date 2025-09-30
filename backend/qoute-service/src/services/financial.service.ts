import { prisma } from '../lib/prisma';
import { logger, performanceLogger, auditLogger } from '../utils/logger';
import { ValidationError, BusinessRuleError } from '../utils/errors';
import { QuoteFinancialCalculation, PricingConfig } from '../types/quote-submission.types';

export class FinancialService {
  /**
   * Get pricing configuration from database
   */
  private async getPricingConfig(): Promise<PricingConfig> {
    try {
      const config = await prisma.businessConfig.findUnique({
        where: { configKey: 'pricing_rules' },
      });

      if (!config || !config.configValue) {
        // Return default configuration
        return {
          max_price_per_kwp: 2000,
          max_system_size_kwp: 100,
          min_system_size_kwp: 1,
          platform_overprice_percent: 10,
          platform_commission_percent: 15,
          vat_rate_percent: 15,
        };
      }

      const rules = config.configValue as any;
      return {
        max_price_per_kwp: rules.max_price_per_kwp || 2000,
        max_system_size_kwp: rules.max_system_size_kwp || 100,
        min_system_size_kwp: rules.min_system_size_kwp || 1,
        platform_overprice_percent: rules.platform_overprice_percent || 10,
        platform_commission_percent: rules.platform_commission_percent || 15,
        vat_rate_percent: rules.vat_rate_percent || 15,
      };
    } catch (error) {
      logger.error('Failed to get pricing config', { error });
      // Return default configuration on error
      return {
        max_price_per_kwp: 2000,
        max_system_size_kwp: 100,
        min_system_size_kwp: 1,
        platform_overprice_percent: 10,
        platform_commission_percent: 15,
        vat_rate_percent: 15,
      };
    }
  }

  /**
   * Validate financial inputs
   */
  private validateFinancialInputs(
    basePrice: number,
    pricePerKwp: number,
    systemSizeKwp: number,
    config: PricingConfig
  ): void {
    if (basePrice <= 0) {
      throw new ValidationError('Base price must be greater than 0');
    }

    if (pricePerKwp <= 0) {
      throw new ValidationError('Price per kWp must be greater than 0');
    }

    if (systemSizeKwp <= 0) {
      throw new ValidationError('System size must be greater than 0');
    }

    if (pricePerKwp > config.max_price_per_kwp) {
      throw new BusinessRuleError(
        `Price per kWp cannot exceed ${config.max_price_per_kwp} SAR`,
        'PRICE_PER_KWP_TOO_HIGH',
        { provided: pricePerKwp, maximum: config.max_price_per_kwp }
      );
    }

    if (systemSizeKwp > config.max_system_size_kwp) {
      throw new BusinessRuleError(
        `System size cannot exceed ${config.max_system_size_kwp} kWp`,
        'SYSTEM_SIZE_TOO_LARGE',
        { provided: systemSizeKwp, maximum: config.max_system_size_kwp }
      );
    }

    if (systemSizeKwp < config.min_system_size_kwp) {
      throw new BusinessRuleError(
        `System size cannot be less than ${config.min_system_size_kwp} kWp`,
        'SYSTEM_SIZE_TOO_SMALL',
        { provided: systemSizeKwp, minimum: config.min_system_size_kwp }
      );
    }
  }

  /**
   * Calculate platform markup (overprice)
   */
  private calculatePlatformMarkup(basePrice: number, overpricePercent: number): number {
    return (basePrice * overpricePercent) / 100;
  }

  /**
   * Calculate platform commission
   */
  private calculatePlatformCommission(basePrice: number, commissionPercent: number): number {
    return (basePrice * commissionPercent) / 100;
  }

  /**
   * Round money to 2 decimal places
   */
  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Calculate quote financials
   */
  async calculateQuoteFinancials(
    basePrice: number,
    pricePerKwp: number,
    systemSizeKwp: number,
    customConfig?: Partial<PricingConfig>
  ): Promise<QuoteFinancialCalculation> {
    const timer = performanceLogger.startTimer('calculate_quote_financials');

    try {
      // Get pricing configuration
      const config = customConfig
        ? { ...(await this.getPricingConfig()), ...customConfig }
        : await this.getPricingConfig();

      // Validate inputs
      this.validateFinancialInputs(basePrice, pricePerKwp, systemSizeKwp, config);

      // Calculate platform markup (overprice)
      const overpriceAmount = this.calculatePlatformMarkup(basePrice, config.platform_overprice_percent);

      // Calculate total user price
      const totalUserPrice = basePrice + overpriceAmount;

      // Calculate platform commission (from contractor)
      const commissionAmount = this.calculatePlatformCommission(basePrice, config.platform_commission_percent);

      // Calculate contractor net amount (what contractor receives)
      const contractorNetAmount = basePrice - commissionAmount;

      // Platform revenue = commission + markup
      const platformRevenue = commissionAmount + overpriceAmount;

      const calculation: QuoteFinancialCalculation = {
        base_price: this.roundMoney(basePrice),
        platform_overprice_percent: config.platform_overprice_percent,
        overprice_amount: this.roundMoney(overpriceAmount),
        total_user_price: this.roundMoney(totalUserPrice),
        platform_commission_percent: config.platform_commission_percent,
        commission_amount: this.roundMoney(commissionAmount),
        contractor_net_amount: this.roundMoney(contractorNetAmount),
        platform_revenue: this.roundMoney(platformRevenue),
        price_per_kwp: this.roundMoney(pricePerKwp),
        system_size_kwp: systemSizeKwp,
      };

      // Audit log the calculation
      auditLogger.quote('QUOTE_FINANCIAL_CALCULATION', {
        base_price: calculation.base_price,
        total_user_price: calculation.total_user_price,
        commission_amount: calculation.commission_amount,
        platform_revenue: calculation.platform_revenue,
        system_size_kwp: systemSizeKwp,
        config_used: {
          overprice_percent: config.platform_overprice_percent,
          commission_percent: config.platform_commission_percent,
        },
      });

      logger.info('Quote financial calculation completed', {
        base_price: calculation.base_price,
        user_total: calculation.total_user_price,
        contractor_net: calculation.contractor_net_amount,
        platform_revenue: calculation.platform_revenue,
      });

      return calculation;
    } catch (error) {
      logger.error('Failed to calculate quote financials', {
        base_price: basePrice,
        price_per_kwp: pricePerKwp,
        system_size: systemSizeKwp,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({
        base_price: basePrice,
        system_size: systemSizeKwp,
      });
    }
  }
}

export const financialService = new FinancialService();