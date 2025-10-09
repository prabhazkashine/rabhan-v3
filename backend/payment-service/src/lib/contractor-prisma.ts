import { PrismaClient } from '../generated/prisma-contractor';

const contractorPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default contractorPrisma;
