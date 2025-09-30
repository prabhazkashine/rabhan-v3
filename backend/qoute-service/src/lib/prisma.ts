import { PrismaClient } from '../generated/prisma';
import { logger } from '../utils/logger';

// Singleton Prisma Client
class PrismaClientSingleton {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!PrismaClientSingleton.instance) {
      PrismaClientSingleton.instance = new PrismaClient({
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ],
      });

      // Log queries in development
      if (process.env.NODE_ENV === 'development') {
        PrismaClientSingleton.instance.$on('query' as never, (e: any) => {
          logger.debug('Prisma Query', {
            query: e.query,
            params: e.params,
            duration: e.duration,
          });
        });
      }

      logger.info('Prisma Client initialized');
    }

    return PrismaClientSingleton.instance;
  }

  public static async disconnect(): Promise<void> {
    if (PrismaClientSingleton.instance) {
      await PrismaClientSingleton.instance.$disconnect();
      logger.info('Prisma Client disconnected');
    }
  }
}

export const prisma = PrismaClientSingleton.getInstance();

// Graceful shutdown
process.on('beforeExit', async () => {
  await PrismaClientSingleton.disconnect();
});