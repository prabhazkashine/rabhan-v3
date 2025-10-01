import { prisma } from '../lib/prisma';
import { contractorsClient } from '../lib/contractorsClient';
import { logger, performanceLogger } from '../utils/logger';
import { BusinessConfigResponse, BusinessConfigPercentages, UpdateBusinessConfigDTO, ContractorCommissionResponse, UpdateContractorCommissionDTO } from '../types/business-config.types';

const BUSINESS_CONFIG_KEY = 'pricing_percentages';

export class BusinessConfigService {
  /**
   * Get business configuration (commission, overprice, VAT percentages)
   */
  async getBusinessConfig(): Promise<BusinessConfigResponse> {
    const timer = performanceLogger.startTimer('get_business_config');

    try {
      const config = await prisma.businessConfig.findUnique({
        where: { configKey: BUSINESS_CONFIG_KEY },
      });

      if (!config) {
        // Create default config if not exists
        return await this.createDefaultConfig();
      }

      return {
        id: config.id,
        config_key: config.configKey,
        config_value: config.configValue as BusinessConfigPercentages,
        description: config.description,
        is_active: config.isActive,
        updated_by: config.updatedBy,
        updated_at: config.updatedAt,
        created_at: config.createdAt,
      };
    } catch (error) {
      logger.error('Failed to get business config', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end();
    }
  }

  /**
   * Update business configuration
   */
  async updateBusinessConfig(
    updates: UpdateBusinessConfigDTO,
    updatedBy: string
  ): Promise<BusinessConfigResponse> {
    const timer = performanceLogger.startTimer('update_business_config');

    try {
      // Get current config
      const currentConfig = await this.getBusinessConfig();
      const currentValues = currentConfig.config_value;

      // Merge updates with current values
      const newValues: BusinessConfigPercentages = {
        rabhan_commission: updates.rabhan_commission ?? currentValues.rabhan_commission,
        rabhan_overprice: updates.rabhan_overprice ?? currentValues.rabhan_overprice,
        vat: updates.vat ?? currentValues.vat,
      };

      // Update in database
      const updatedConfig = await prisma.businessConfig.update({
        where: { configKey: BUSINESS_CONFIG_KEY },
        data: {
          configValue: newValues,
          updatedBy,
        },
      });

      logger.info('Business config updated', {
        updated_by: updatedBy,
        changes: updates,
      });

      return {
        id: updatedConfig.id,
        config_key: updatedConfig.configKey,
        config_value: updatedConfig.configValue as BusinessConfigPercentages,
        description: updatedConfig.description,
        is_active: updatedConfig.isActive,
        updated_by: updatedConfig.updatedBy,
        updated_at: updatedConfig.updatedAt,
        created_at: updatedConfig.createdAt,
      };
    } catch (error) {
      logger.error('Failed to update business config', {
        updated_by: updatedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ updated_by: updatedBy });
    }
  }

  /**
   * Create default business configuration
   */
  private async createDefaultConfig(): Promise<BusinessConfigResponse> {
    const defaultValues: BusinessConfigPercentages = {
      rabhan_commission: 15,
      rabhan_overprice: 10,
      vat: 15,
    };

    const config = await prisma.businessConfig.create({
      data: {
        configKey: BUSINESS_CONFIG_KEY,
        configValue: defaultValues,
        description: 'Default pricing percentages for rabhan commission, overprice, and VAT',
        isActive: true,
      },
    });

    logger.info('Default business config created', {
      config_key: BUSINESS_CONFIG_KEY,
      values: defaultValues,
    });

    return {
      id: config.id,
      config_key: config.configKey,
      config_value: config.configValue as BusinessConfigPercentages,
      description: config.description,
      is_active: config.isActive,
      updated_by: config.updatedBy,
      updated_at: config.updatedAt,
      created_at: config.createdAt,
    };
  }

  /**
   * Get contractor commission by contractor ID
   */
  async getContractorCommission(contractorId: string): Promise<ContractorCommissionResponse> {
    const timer = performanceLogger.startTimer('get_contractor_commission');

    try {
      const result = await contractorsClient.$queryRaw<any[]>`
        SELECT
          id,
          rabhan_commission,
          updated_at
        FROM contractors
        WHERE id = ${contractorId}::uuid
      `;

      if (result.length === 0) {
        throw new Error('Contractor not found');
      }

      const contractor = result[0];

      return {
        contractor_id: contractor.id,
        rabhan_commission: contractor.rabhan_commission,
        updated_at: contractor.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get contractor commission', {
        contractor_id: contractorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: contractorId });
    }
  }

  /**
   * Update contractor commission
   */
  async updateContractorCommission(
    contractorId: string,
    data: UpdateContractorCommissionDTO,
    updatedBy: string
  ): Promise<ContractorCommissionResponse> {
    const timer = performanceLogger.startTimer('update_contractor_commission');

    try {
      const result = await contractorsClient.$queryRaw<any[]>`
        UPDATE contractors
        SET rabhan_commission = ${data.rabhan_commission},
            updated_at = NOW()
        WHERE id = ${contractorId}::uuid
        RETURNING id, rabhan_commission, updated_at
      `;

      if (result.length === 0) {
        throw new Error('Contractor not found');
      }

      const contractor = result[0];

      logger.info('Contractor commission updated', {
        contractor_id: contractorId,
        rabhan_commission: data.rabhan_commission,
        updated_by: updatedBy,
      });

      return {
        contractor_id: contractor.id,
        rabhan_commission: contractor.rabhan_commission,
        updated_at: contractor.updated_at,
      };
    } catch (error) {
      logger.error('Failed to update contractor commission', {
        contractor_id: contractorId,
        updated_by: updatedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      timer.end({ contractor_id: contractorId, updated_by: updatedBy });
    }
  }
}

export const businessConfigService = new BusinessConfigService();
