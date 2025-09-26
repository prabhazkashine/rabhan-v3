"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = require("../generated/prisma");
const jwt_1 = require("../utils/jwt");
const password_1 = require("../utils/password");
const validation_1 = require("../utils/validation");
const sama_logger_1 = require("../utils/sama-logger");
const logger_1 = require("../utils/logger");
const phone_verification_service_1 = require("./phone-verification.service");
const uuid_1 = require("uuid");
const prisma = new prisma_1.PrismaClient();
class AuthService {
    constructor() {
        this.phoneVerificationService = new phone_verification_service_1.PhoneVerificationService();
    }
    async register(data) {
        try {
            // Validate password
            const passwordValidation = password_1.PasswordUtils.validate(data.password);
            if (!passwordValidation.valid) {
                throw new Error(passwordValidation.errors.join(', '));
            }
            // Hash password
            const passwordHash = await password_1.PasswordUtils.hash(data.password);
            // Normalize phone if provided
            const normalizedPhone = data.phone ? validation_1.ValidationUtils.normalizePhone(data.phone) : null;
            // Check phone verification if phone is provided
            let phoneVerified = false;
            if (normalizedPhone) {
                phoneVerified = await this.phoneVerificationService.isPhoneVerified(normalizedPhone);
                if (!phoneVerified && process.env.NODE_ENV === 'production') {
                    throw new Error('Phone verification required before registration. Please verify your phone number first.');
                }
            }
            // Check for existing contractor
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
            // Create contractor using Prisma transaction
            const result = await prisma.$transaction(async (tx) => {
                // Create contractor
                const contractor = await tx.contractor.create({
                    data: {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        email: data.email.toLowerCase(),
                        passwordHash,
                        phone: normalizedPhone,
                        nationalId: data.nationalId || null,
                        provider: prisma_1.AuthProvider.EMAIL,
                        status: prisma_1.UserStatus.PENDING,
                        businessType: data.userType === 'BUSINESS' ? 'llc' : 'individual',
                        companyName: data.companyName,
                        crNumber: data.crNumber || null,
                        vatNumber: data.vatNumber || null,
                        emailVerified: false,
                        phoneVerified: phoneVerified
                    }
                });
                // Create linked contractor profile with basic information
                await tx.contractorProfile.create({
                    data: {
                        userId: contractor.id,
                        businessName: data.companyName,
                        businessType: data.userType === 'BUSINESS' ? prisma_1.BusinessType.llc : prisma_1.BusinessType.individual,
                        email: contractor.email,
                        phone: normalizedPhone || contractor.email, // Use email as fallback if no phone
                        addressLine1: 'To be updated', // Placeholder - user will update later
                        city: 'To be updated',
                        region: 'To be updated',
                        country: 'Saudi Arabia',
                        serviceCategories: [prisma_1.ServiceCategory.residential_solar], // Default service
                        serviceAreas: ['Riyadh'], // Default area
                        yearsExperience: 1, // Default experience
                        contractorType: prisma_1.ContractorType.full_solar_contractor, // Default type
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
                // Create session
                const sessionId = (0, uuid_1.v4)();
                const { accessToken, refreshToken, expiresIn } = jwt_1.JWTUtils.generateTokenPair(contractor.id, contractor.email, 'CONTRACTOR', sessionId);
                const expiresAt = new Date(Date.now() + jwt_1.JWTUtils.getExpiresInMs('7d'));
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
            // Log successful registration
            sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION', result.contractor.id, {
                role: 'CONTRACTOR',
                provider: prisma_1.AuthProvider.EMAIL,
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
        }
        catch (error) {
            logger_1.logger.error('Contractor registration failed:', error);
            if (error instanceof Error) {
                // Handle Prisma unique constraint errors
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
    async login(email, password, ipAddress) {
        try {
            // Find contractor
            const contractor = await prisma.contractor.findUnique({
                where: { email: email.toLowerCase() }
            });
            if (!contractor) {
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_FAILED', undefined, {
                    email,
                    error: 'User not found',
                    ip: ipAddress
                });
                throw new Error('Invalid email or password');
            }
            // Check if account is locked
            if (contractor.status === prisma_1.UserStatus.LOCKED || contractor.status === prisma_1.UserStatus.SUSPENDED) {
                sama_logger_1.SAMALogger.logSecurityEvent('CONTRACTOR_LOGIN_BLOCKED', contractor.id, {
                    email,
                    status: contractor.status,
                    ip: ipAddress
                });
                throw new Error('Account is locked or suspended');
            }
            // Verify password
            const isValidPassword = await password_1.PasswordUtils.verify(password, contractor.passwordHash);
            if (!isValidPassword) {
                // Update login attempts
                await prisma.contractor.update({
                    where: { id: contractor.id },
                    data: {
                        loginAttempts: contractor.loginAttempts + 1,
                        lockedUntil: contractor.loginAttempts + 1 >= 5
                            ? new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
                            : null
                    }
                });
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_FAILED', contractor.id, {
                    email,
                    error: 'Invalid password',
                    loginAttempts: contractor.loginAttempts + 1,
                    ip: ipAddress
                });
                throw new Error('Invalid email or password');
            }
            // Reset login attempts on successful login
            await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    loginAttempts: 0,
                    lockedUntil: null,
                    lastLoginAt: new Date()
                }
            });
            // Create new session
            const sessionId = (0, uuid_1.v4)();
            const { accessToken, refreshToken, expiresIn } = jwt_1.JWTUtils.generateTokenPair(contractor.id, contractor.email, 'CONTRACTOR', sessionId);
            const expiresAt = new Date(Date.now() + jwt_1.JWTUtils.getExpiresInMs('7d'));
            await prisma.contractorSession.create({
                data: {
                    id: sessionId,
                    contractorId: contractor.id,
                    refreshToken,
                    expiresAt
                }
            });
            sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_SUCCESS', contractor.id, {
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
        }
        catch (error) {
            logger_1.logger.error('Contractor login failed:', error);
            throw error;
        }
    }
    async refreshToken(refreshToken) {
        try {
            // Verify the refresh token
            const payload = jwt_1.JWTUtils.verifyRefreshToken(refreshToken);
            // Find the session
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
            // Generate new tokens
            const newSessionId = (0, uuid_1.v4)();
            const tokens = jwt_1.JWTUtils.generateTokenPair(session.contractor.id, session.contractor.email, 'CONTRACTOR', newSessionId);
            // Update session with new refresh token
            const expiresAt = new Date(Date.now() + jwt_1.JWTUtils.getExpiresInMs('7d'));
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
        }
        catch (error) {
            logger_1.logger.error('Token refresh failed:', error);
            throw new Error('Invalid or expired refresh token');
        }
    }
}
exports.AuthService = AuthService;
