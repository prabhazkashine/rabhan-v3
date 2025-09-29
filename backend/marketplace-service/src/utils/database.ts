import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { DatabaseError, DatabaseConnectionError } from './errors';

class DatabaseManager {
  private static instance: DatabaseManager;
  private prisma: PrismaClient;
  private isConnected: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    this.setupEventListeners();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private setupEventListeners() {
    this.prisma.$on('query', (e) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Database Query', {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target
        });
      }
    });

    this.prisma.$on('error', (e) => {
      logger.error('Database Error', e, {
        target: e.target,
        timestamp: e.timestamp
      });
    });

    this.prisma.$on('info', (e) => {
      logger.info('Database Info', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });

    this.prisma.$on('warn', (e) => {
      logger.warn('Database Warning', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to database', error);
      throw new DatabaseConnectionError('Failed to connect to database', error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect from database', error);
      throw new DatabaseError('Failed to disconnect from database', error);
    }
  }

  public getClient(): PrismaClient {
    if (!this.isConnected) {
      logger.warn('Database client accessed before connection established');
    }
    return this.prisma;
  }

  public isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }

  // Graceful shutdown
  public async gracefulShutdown(): Promise<void> {
    logger.info('Initiating graceful database shutdown');
    await this.disconnect();
  }
}

// Export singleton instance
const db = DatabaseManager.getInstance();
export default db;

// Export Prisma client for direct access when needed
export const prisma = db.getClient();