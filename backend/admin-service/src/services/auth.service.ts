import { PrismaClient, UserRole, UserStatus } from '../generated/prisma';
import { v4 as uuidv4 } from 'uuid';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { logger } from '../utils/logger';
import { RegisterRequest, LoginRequest, AuthResponse } from '../types/auth.types';

class AuthService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async registerAdmin(data: RegisterRequest): Promise<AuthResponse> {
    try {
      await this.prisma.$connect();

      const passwordValidation = PasswordUtils.validate(data.password);
      if (!passwordValidation.valid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      const existingAdmin = await this.prisma.admin.findUnique({
        where: { email: data.email },
      });

      if (existingAdmin) {
        throw new Error('Email already registered');
      }

      const passwordHash = await PasswordUtils.hash(data.password);

      const result = await this.prisma.$transaction(async (tx) => {
        const admin = await tx.admin.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            passwordHash,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            emailVerified: true,
          },
        });

        const sessionId = uuidv4();
        const tokens = JWTUtils.generateTokenPair(
          admin.id,
          admin.email,
          admin.role,
          sessionId
        );

        await tx.adminSession.create({
          data: {
            id: sessionId,
            adminId: admin.id,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        return { admin, tokens };
      });

      logger.info(`Admin registered successfully: ${result.admin.email}`, {
        adminId: result.admin.id,
        email: result.admin.email,
      });

      return {
        ...result.tokens,
        user: {
          id: result.admin.id,
          firstName: result.admin.firstName,
          lastName: result.admin.lastName,
          email: result.admin.email,
          role: result.admin.role,
          status: result.admin.status,
          emailVerified: result.admin.emailVerified,
          createdAt: result.admin.createdAt,
        },
      };

    } catch (error: any) {
      logger.error('Admin registration failed:', {
        error: error.message,
        email: data.email,
      });

      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('email')) {
          throw new Error('Email already registered');
        }
      }

      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async loginAdmin(data: LoginRequest): Promise<AuthResponse> {
    const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const LOCK_TIME = Number(process.env.LOCK_TIME) || 15 * 60 * 1000; // 15 minutes

    try {
      await this.prisma.$connect();

      const admin = await this.prisma.admin.findUnique({
        where: { email: data.email },
      });

      if (!admin) {
        logger.warn('Login attempt with non-existent email', {
          email: data.email,
        });
        throw new Error('Invalid email or password');
      }

      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        const remainingTime = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
        logger.warn('Login attempt on locked account', {
          adminId: admin.id,
          email: admin.email,
          remainingLockTime: remainingTime,
        });
        throw new Error(`Account is locked. Try again in ${remainingTime} minutes.`);
      }

      if (admin.status === UserStatus.SUSPENDED) {
        logger.warn('Login attempt on suspended account', {
          adminId: admin.id,
          email: admin.email,
        });
        throw new Error('Account is suspended. Contact support.');
      }

      const isPasswordValid = await PasswordUtils.verify(data.password, admin.passwordHash);

      if (!isPasswordValid) {
        const updatedAttempts = admin.loginAttempts + 1;
        const shouldLock = updatedAttempts >= MAX_LOGIN_ATTEMPTS;

        await this.prisma.admin.update({
          where: { id: admin.id },
          data: {
            loginAttempts: updatedAttempts,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCK_TIME) : null,
          },
        });

        logger.warn('Failed admin login attempt', {
          adminId: admin.id,
          email: admin.email,
          attempts: updatedAttempts,
          locked: shouldLock,
        });

        if (shouldLock) {
          throw new Error('Too many failed attempts. Account locked for 15 minutes.');
        }

        throw new Error('Invalid email or password');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const updatedAdmin = await tx.admin.update({
          where: { id: admin.id },
          data: {
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        const sessionId = uuidv4();
        const tokens = JWTUtils.generateTokenPair(
          updatedAdmin.id,
          updatedAdmin.email,
          updatedAdmin.role,
          sessionId
        );

        await tx.adminSession.create({
          data: {
            id: sessionId,
            adminId: updatedAdmin.id,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        return { admin: updatedAdmin, tokens };
      });

      logger.info('Admin logged in successfully', {
        adminId: result.admin.id,
        email: result.admin.email,
      });

      return {
        ...result.tokens,
        user: {
          id: result.admin.id,
          firstName: result.admin.firstName,
          lastName: result.admin.lastName,
          email: result.admin.email,
          role: result.admin.role,
          status: result.admin.status,
          emailVerified: result.admin.emailVerified,
          createdAt: result.admin.createdAt,
        },
      };

    } catch (error: any) {
      logger.error('Admin login failed:', {
        error: error.message,
        email: data.email,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async getAdminProfile(adminId: string): Promise<AuthResponse['user']> {
    try {
      await this.prisma.$connect();

      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      logger.info('Admin profile retrieved', {
        adminId: admin.id,
        email: admin.email,
      });

      return admin;

    } catch (error: any) {
      logger.error('Failed to get admin profile:', {
        error: error.message,
        adminId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

export { AuthService };