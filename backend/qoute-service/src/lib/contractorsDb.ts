import { Pool } from 'pg';
import { logger } from '../utils/logger';

// Contractors Database Connection Pool
class ContractorsDatabase {
  private static instance: Pool;

  public static getInstance(): Pool {
    if (!ContractorsDatabase.instance) {
      const connectionString = process.env.CONTRACTORS_DATABASE_URL;

      if (!connectionString) {
        throw new Error('CONTRACTORS_DATABASE_URL environment variable is not set');
      }

      ContractorsDatabase.instance = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Handle connection errors
      ContractorsDatabase.instance.on('error', (err) => {
        logger.error('Unexpected error on contractors database client', { error: err });
      });

      // Test connection
      ContractorsDatabase.instance.query('SELECT NOW()')
        .then(() => {
          logger.info('Contractors database connected successfully');
        })
        .catch((err) => {
          logger.error('Failed to connect to contractors database', { error: err });
        });

      logger.info('Contractors Database Pool initialized');
    }

    return ContractorsDatabase.instance;
  }

  public static async disconnect(): Promise<void> {
    if (ContractorsDatabase.instance) {
      await ContractorsDatabase.instance.end();
      logger.info('Contractors Database Pool disconnected');
    }
  }
}

export const contractorsDb = ContractorsDatabase.getInstance();

// Graceful shutdown
process.on('beforeExit', async () => {
  await ContractorsDatabase.disconnect();
});