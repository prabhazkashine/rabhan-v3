import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Contractors Database Prisma Client (connects to contractors microservice DB)
// Using raw queries since we don't have the contractors schema in this service
class ContractorsPrismaClient {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!ContractorsPrismaClient.instance) {
      const contractorsDbUrl = process.env.CONTRACTORS_DATABASE_URL;

      if (!contractorsDbUrl) {
        throw new Error('CONTRACTORS_DATABASE_URL environment variable is not set');
      }

      ContractorsPrismaClient.instance = new PrismaClient({
        datasources: {
          db: {
            url: contractorsDbUrl,
          },
        },
        log: [
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ],
      });

      logger.info('Contractors Prisma Client initialized for raw queries');
    }

    return ContractorsPrismaClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (ContractorsPrismaClient.instance) {
      await ContractorsPrismaClient.instance.$disconnect();
      logger.info('Contractors Prisma Client disconnected');
    }
  }
}

export const contractorsClient = ContractorsPrismaClient.getInstance();

// Graceful shutdown
process.on('beforeExit', async () => {
  await ContractorsPrismaClient.disconnect();
});