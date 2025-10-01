import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// User Database Prisma Client
class UserPrismaClientSingleton {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!UserPrismaClientSingleton.instance) {
      const userDatabaseUrl = process.env.USER_DATABASE_URL;

      if (!userDatabaseUrl) {
        throw new Error('USER_DATABASE_URL environment variable is not set');
      }

      UserPrismaClientSingleton.instance = new PrismaClient({
        datasources: {
          db: {
            url: userDatabaseUrl,
          },
        },
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ],
      });

      // Log queries in development
      if (process.env.NODE_ENV === 'development') {
        UserPrismaClientSingleton.instance.$on('query' as never, (e: any) => {
          logger.debug('User DB Prisma Query', {
            query: e.query,
            params: e.params,
            duration: e.duration,
          });
        });
      }

      // Test connection
      UserPrismaClientSingleton.instance.$connect()
        .then(() => {
          logger.info('User Database Prisma Client connected successfully');
        })
        .catch((err) => {
          logger.error('Failed to connect User Database Prisma Client', { error: err });
        });

      logger.info('User Database Prisma Client initialized');
    }

    return UserPrismaClientSingleton.instance;
  }

  public static async disconnect(): Promise<void> {
    if (UserPrismaClientSingleton.instance) {
      await UserPrismaClientSingleton.instance.$disconnect();
      logger.info('User Database Prisma Client disconnected');
    }
  }
}

export const userPrisma = UserPrismaClientSingleton.getInstance();

// Graceful shutdown
process.on('beforeExit', async () => {
  await UserPrismaClientSingleton.disconnect();
});
