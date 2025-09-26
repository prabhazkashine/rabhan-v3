import { PrismaClient, UserRole, UserStatus, UserType, PreferredLanguage, ProfileVerificationStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { RegisterRequest, LoginRequest } from '../validation/schemas';
import { PasswordUtils } from '../utils/password';
import { JWTUtils, AuthTokens } from '../utils/jwt';
import { logger } from '../utils/logger';

export interface UserResponse {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  nationalId: string | null;
  role: UserRole;
  status: UserStatus;
  userType: UserType;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  bnpl_eligible?: boolean;
}

export interface AuthResponse extends AuthTokens {
  user: UserResponse;
}

class AuthService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async registerUser(data: RegisterRequest): Promise<AuthResponse> {
    try {
      await this.prisma.$connect();

      const passwordValidation = PasswordUtils.validate(data.password);
      if (!passwordValidation.valid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('Email already registered');
      }

      const passwordHash = await PasswordUtils.hash(data.password);

      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            nationalId: data.nationalId,
            passwordHash,
            role: UserRole.USER,
            status: UserStatus.PENDING,
            userType: data.userType,
          },
        });

        const sessionId = uuidv4();
        const tokens = JWTUtils.generateTokenPair(
          user.id,
          user.email,
          user.role,
          sessionId
        );

        await tx.userSession.create({
          data: {
            id: sessionId,
            userId: user.id,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        // Create basic user profile with only firstName and lastName
        await tx.userProfile.create({
          data: {
            authUserId: user.id,
            firstName: data.firstName,
            lastName: data.lastName,
            // Default values for required fields (will be updated later)
            region: '',
            city: '',
            district: '',
            streetAddress: '',
            postalCode: '00000',
            propertyType: 'apartment', // Default property type
            propertyOwnership: 'rented', // Default ownership
            roofSize: 0,
            gpsLatitude: 0,
            gpsLongitude: 0,
            electricityConsumption: 'E0_200', // Default consumption
            electricityMeterNumber: '',
            preferredLanguage: PreferredLanguage.ar,
            emailNotifications: true,
            smsNotifications: true,
            marketingConsent: false,
            profileCompleted: false,
            profileCompletionPercentage: 15, // Only firstName and lastName filled
            bnplEligible: false,
            bnplMaxAmount: 0,
            verificationStatus: ProfileVerificationStatus.not_verified,
          },
        });

        return { user, tokens };
      });

      logger.info(`User registered successfully: ${result.user.email}`, {
        userId: result.user.id,
        email: result.user.email,
      });

      return {
        ...result.tokens,
        user: {
          id: result.user.id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone,
          nationalId: result.user.nationalId,
          role: result.user.role,
          status: result.user.status,
          userType: result.user.userType,
          emailVerified: result.user.emailVerified,
          phoneVerified: result.user.phoneVerified,
          createdAt: result.user.createdAt,
          bnpl_eligible: false
        },
      };

    } catch (error: any) {
      logger.error('User registration failed:', {
        error: error.message,
        email: data.email,
      });

      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('email')) {
          throw new Error('Email already registered');
        }
        if (error.meta?.target?.includes('phone')) {
          throw new Error('Phone number already registered');
        }
        if (error.meta?.target?.includes('national_id')) {
          throw new Error('National ID already registered');
        }
      }

      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async loginUser(data: LoginRequest): Promise<AuthResponse> {
    const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS);
    const LOCK_TIME = Number(process.env.LOCK_TIME); 

    try {
      await this.prisma.$connect();

      const user = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        logger.warn('Login attempt with non-existent email', {
          email: data.email,
        });
        throw new Error('Invalid email or password');
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        logger.warn('Login attempt on locked account', {
          userId: user.id,
          email: user.email,
          remainingLockTime: remainingTime,
        });
        throw new Error(`Account is locked. Try again in ${remainingTime} minutes.`);
      }

      if (user.status === UserStatus.SUSPENDED) {
        logger.warn('Login attempt on suspended account', {
          userId: user.id,
          email: user.email,
        });
        throw new Error('Account is suspended. Contact support.');
      }

      const isPasswordValid = await PasswordUtils.verify(data.password, user.passwordHash);

      if (!isPasswordValid) {
        const updatedAttempts = user.loginAttempts + 1;
        const shouldLock = updatedAttempts >= MAX_LOGIN_ATTEMPTS;

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: updatedAttempts,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCK_TIME) : null,
          },
        });

        logger.warn('Failed login attempt', {
          userId: user.id,
          email: user.email,
          attempts: updatedAttempts,
          locked: shouldLock,
        });

        if (shouldLock) {
          throw new Error('Too many failed attempts. Account locked for 15 minutes.');
        }

        throw new Error('Invalid email or password');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            status: user.status === UserStatus.PENDING ? UserStatus.ACTIVE : user.status,
          },
        });

        const sessionId = uuidv4();
        const tokens = JWTUtils.generateTokenPair(
          updatedUser.id,
          updatedUser.email,
          updatedUser.role,
          sessionId
        );

        await tx.userSession.create({
          data: {
            id: sessionId,
            userId: updatedUser.id,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        return { user: updatedUser, tokens };
      });

      logger.info('User logged in successfully', {
        userId: result.user.id,
        email: result.user.email,
      });

      return {
        ...result.tokens,
        user: {
          id: result.user.id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          phone: result.user.phone,
          nationalId: result.user.nationalId,
          role: result.user.role,
          status: result.user.status,
          userType: result.user.userType,
          emailVerified: result.user.emailVerified,
          phoneVerified: result.user.phoneVerified,
          createdAt: result.user.createdAt,
          bnpl_eligible: false
        },
      };

    } catch (error: any) {
      logger.error('User login failed:', {
        error: error.message,
        email: data.email,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      await this.prisma.$connect();

      const payload = JWTUtils.verifyRefreshToken(refreshToken);

      const session = await this.prisma.userSession.findUnique({
        where: {
          id: payload.sessionId,
          refreshToken: refreshToken,
        },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token');
      }

      const newSessionId = uuidv4();
      const newTokens = JWTUtils.generateTokenPair(
        session.user.id,
        session.user.email,
        session.user.role,
        newSessionId
      );

      await this.prisma.userSession.update({
        where: { id: session.id },
        data: {
          id: newSessionId,
          refreshToken: newTokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      logger.info('Tokens refreshed successfully', {
        userId: session.user.id,
        email: session.user.email,
      });

      return newTokens;

    } catch (error: any) {
      logger.error('Token refresh failed:', {
        error: error.message,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async logout(sessionId: string): Promise<void> {
    try {
      await this.prisma.$connect();

      await this.prisma.userSession.delete({
        where: { id: sessionId },
      });

      logger.info('User logged out successfully', { sessionId });

    } catch (error: any) {
      logger.error('Logout failed:', {
        error: error.message,
        sessionId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async getUserById(userId: string): Promise<UserResponse | null> {
    try {
      await this.prisma.$connect();

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        nationalId: user.nationalId,
        role: user.role,
        status: user.status,
        userType: user.userType,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt,
      };

    } catch (error: any) {
      logger.error('Get user by ID failed:', {
        error: error.message,
        userId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async updateUserProfile(userId: string, updateData: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationalId: string;
    userType: UserType;
  }>): Promise<UserResponse | null> {
    try {
      await this.prisma.$connect();

      // Check if email is being updated and already exists
      if (updateData.email) {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            email: updateData.email,
            NOT: { id: userId }
          }
        });

        if (existingUser) {
          throw new Error('Email already registered');
        }
      }

      // Check if phone is being updated and already exists
      if (updateData.phone) {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            phone: updateData.phone,
            NOT: { id: userId }
          }
        });

        if (existingUser) {
          throw new Error('Phone number already registered');
        }
      }

      // Check if nationalId is being updated and already exists
      if (updateData.nationalId) {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            nationalId: updateData.nationalId,
            NOT: { id: userId }
          }
        });

        if (existingUser) {
          throw new Error('National ID already registered');
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      logger.info('User profile updated successfully', {
        userId: updatedUser.id,
        email: updatedUser.email,
      });

      return {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        nationalId: updatedUser.nationalId,
        role: updatedUser.role,
        status: updatedUser.status,
        userType: updatedUser.userType,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
        createdAt: updatedUser.createdAt,
      };

    } catch (error: any) {
      logger.error('Update user profile failed:', {
        error: error.message,
        userId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

export { AuthService };