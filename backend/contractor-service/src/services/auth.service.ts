import { PrismaClient, AuthProvider, UserStatus, BusinessType, ServiceCategory, ContractorType } from '../generated/prisma';
import { ContractorRegisterRequest } from '../validation/contractor-schemas';
import { AuthTokens, JWTUtils } from '../utils/jwt';
import { PasswordUtils } from '../utils/password';
import { ValidationUtils } from '../utils/validation';
import { SAMALogger } from '../utils/sama-logger';
import { logger } from '../utils/logger';
import { PhoneVerificationService } from './phone-verification.service';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export class AuthService {
  private phoneVerificationService = new PhoneVerificationService();

  async register(data: ContractorRegisterRequest): Promise<AuthTokens> {
    try {
      const passwordValidation = PasswordUtils.validate(data.password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      const passwordHash = await PasswordUtils.hash(data.password);

      const normalizedPhone = data.phone ? ValidationUtils.normalizePhone(data.phone) : null;

      let phoneVerified = false;
      if (normalizedPhone) {
        phoneVerified = await this.phoneVerificationService.isPhoneVerified(normalizedPhone);

        if (!phoneVerified && process.env.NODE_ENV === 'production') {
          throw new Error('Phone verification required before registration. Please verify your phone number first.');
        }
      }

      const existingContractor = await prisma.contractor.findFirst({
        where: {
          OR: [
            { email: data.email.toLowerCase() },
            ...(data.nationalId ? [{ nationalId: data.nationalId }] : [])
          ]
        }
      });

      if (existingContractor) {
        if (existingContractor.email === data.email.toLowerCase()) {
          throw new Error('Email already registered');
        }
        if (existingContractor.nationalId === data.nationalId) {
          throw new Error('National ID already registered');
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const contractor = await tx.contractor.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email.toLowerCase(),
            passwordHash,
            phone: normalizedPhone,
            nationalId: data.nationalId || null,
            provider: AuthProvider.EMAIL,
            status: UserStatus.PENDING,
            businessType: data.userType === 'BUSINESS' ? 'llc' : 'individual',
            companyName: data.companyName,
            crNumber: data.crNumber || null,
            vatNumber: data.vatNumber || null,
            emailVerified: false,
            phoneVerified: phoneVerified
          }
        });

        await tx.contractorProfile.create({
          data: {
            userId: contractor.id,
            businessName: data.companyName,
            businessType: data.userType === 'BUSINESS' ? BusinessType.llc : BusinessType.individual,
            email: contractor.email,
            phone: normalizedPhone || contractor.email, // Use email as fallback if no phone
            addressLine1: 'To be updated', // Placeholder - user will update later
            city: 'To be updated',
            region: 'To be updated',
            country: 'Saudi Arabia',
            serviceCategories: [ServiceCategory.residential_solar], // Default service
            serviceAreas: ['Riyadh'], // Default area
            yearsExperience: 1, // Default experience
            contractorType: ContractorType.full_solar_contractor, // Default type
            canInstall: true,
            canSupplyOnly: false,
            preferredLanguage: 'ar',
            emailNotifications: true,
            smsNotifications: true,
            marketingConsent: false,
            createdBy: contractor.id,
            ...(data.crNumber && { commercialRegistration: data.crNumber }),
            ...(data.vatNumber && { vatNumber: data.vatNumber })
          }
        });

        const sessionId = uuidv4();
        const { accessToken, refreshToken, expiresIn } = JWTUtils.generateTokenPair(
          contractor.id,
          contractor.email,
          'CONTRACTOR' as any,
          sessionId
        );

        const expiresAt = new Date(Date.now() + JWTUtils.getExpiresInMs('7d'));
        await tx.contractorSession.create({
          data: {
            id: sessionId,
            contractorId: contractor.id,
            refreshToken,
            expiresAt
          }
        });

        return {
          contractor,
          accessToken,
          refreshToken,
          expiresIn
        };
      });

      SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION', result.contractor.id, {
        role: 'CONTRACTOR',
        provider: AuthProvider.EMAIL,
        companyName: data.companyName,
        userType: data.userType,
        profileCreated: true,
        compliance: 'SAMA_REGISTRATION_FRAMEWORK'
      });

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: {
          id: result.contractor.id,
          firstName: result.contractor.firstName,
          lastName: result.contractor.lastName,
          email: result.contractor.email,
          role: 'CONTRACTOR',
          phone: result.contractor.phone,
          nationalId: result.contractor.nationalId,
          userType: result.contractor.businessType,
          status: result.contractor.status,
          bnplEligible: false
        }
      };

    } catch (error) {
      logger.error('Contractor registration failed:', error);

      if (error instanceof Error) {
        if (error.message.includes('Unique constraint failed')) {
          if (error.message.includes('email')) {
            throw new Error('Email already registered');
          }
          if (error.message.includes('national_id')) {
            throw new Error('National ID already registered');
          }
        }
      }

      throw error;
    }
  }

  async login(email: string, password: string, ipAddress?: string): Promise<AuthTokens> {
    try {
      const contractor = await prisma.contractor.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!contractor) {
        SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_FAILED', undefined, {
          email,
          error: 'User not found',
          ip: ipAddress
        });
        throw new Error('Invalid email or password');
      }

      if (contractor.status === UserStatus.LOCKED || contractor.status === UserStatus.SUSPENDED) {
        SAMALogger.logSecurityEvent('CONTRACTOR_LOGIN_BLOCKED', contractor.id, {
          email,
          status: contractor.status,
          ip: ipAddress
        });
        throw new Error('Account is locked or suspended');
      }

      const isValidPassword = await PasswordUtils.verify(password, contractor.passwordHash!);

      if (!isValidPassword) {
        await prisma.contractor.update({
          where: { id: contractor.id },
          data: {
            loginAttempts: contractor.loginAttempts + 1,
            lockedUntil: contractor.loginAttempts + 1 >= 5
              ? new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
              : null
          }
        });

        SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_FAILED', contractor.id, {
          email,
          error: 'Invalid password',
          loginAttempts: contractor.loginAttempts + 1,
          ip: ipAddress
        });

        throw new Error('Invalid email or password');
      }

      await prisma.contractor.update({
        where: { id: contractor.id },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date()
        }
      });

      const sessionId = uuidv4();
      const { accessToken, refreshToken, expiresIn } = JWTUtils.generateTokenPair(
        contractor.id,
        contractor.email,
        'CONTRACTOR' as any,
        sessionId
      );

      const expiresAt = new Date(Date.now() + JWTUtils.getExpiresInMs('7d'));
      await prisma.contractorSession.create({
        data: {
          id: sessionId,
          contractorId: contractor.id,
          refreshToken,
          expiresAt
        }
      });

      SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_SUCCESS', contractor.id, {
        email,
        ip: ipAddress,
        sessionId
      });

      return {
        accessToken,
        refreshToken,
        expiresIn,
        user: {
          id: contractor.id,
          firstName: contractor.firstName,
          lastName: contractor.lastName,
          email: contractor.email,
          role: 'CONTRACTOR',
          phone: contractor.phone,
          nationalId: contractor.nationalId,
          userType: contractor.businessType,
          status: contractor.status,
          bnplEligible: false
        }
      };

    } catch (error) {
      logger.error('Contractor login failed:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = JWTUtils.verifyRefreshToken(refreshToken);

      const session = await prisma.contractorSession.findFirst({
        where: {
          refreshToken,
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          contractor: true
        }
      });

      if (!session) {
        throw new Error('Invalid or expired refresh token');
      }

      const newSessionId = uuidv4();
      const tokens = JWTUtils.generateTokenPair(
        session.contractor.id,
        session.contractor.email,
        'CONTRACTOR' as any,
        newSessionId
      );

      const expiresAt = new Date(Date.now() + JWTUtils.getExpiresInMs('7d'));
      await prisma.contractorSession.update({
        where: { id: session.id },
        data: {
          id: newSessionId,
          refreshToken: tokens.refreshToken,
          expiresAt,
          lastAccessedAt: new Date()
        }
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: session.contractor.id,
          firstName: session.contractor.firstName,
          lastName: session.contractor.lastName,
          email: session.contractor.email,
          role: 'CONTRACTOR',
          phone: session.contractor.phone,
          nationalId: session.contractor.nationalId,
          userType: session.contractor.businessType,
          status: session.contractor.status,
          bnplEligible: false
        }
      };

    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }
}