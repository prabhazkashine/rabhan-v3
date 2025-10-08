import { PrismaClient } from '../generated/prisma-contractor';
import { logger } from '../utils/logger';

// Prevent multiple instances of Prisma Client in development
const globalForContractorPrisma = global as unknown as { contractorPrisma: PrismaClient };

export const contractorPrisma =
  globalForContractorPrisma.contractorPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForContractorPrisma.contractorPrisma = contractorPrisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('Disconnecting Contractor Prisma Client');
  await contractorPrisma.$disconnect();
});

export default contractorPrisma;
