import { PrismaClient } from '../generated/prisma-projects';

const projectsPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default projectsPrisma;
