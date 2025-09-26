"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const sama_logger_1 = require("../utils/sama-logger");
const logger_1 = require("../utils/logger");
const phone_verification_service_1 = require("../services/phone-verification.service");
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class AuthController {
    constructor() {
        this.authService = new auth_service_1.AuthService();
        this.contractorRegister = async (req, res) => {
            try {
                const data = req.body;
                // Set role and userType for contractor
                data.role = 'CONTRACTOR';
                if (!data.userType) {
                    data.userType = 'BUSINESS';
                }
                // Extract company info for logging
                const companyName = data.companyName;
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION_ATTEMPT', undefined, {
                    email: data.email,
                    companyName: companyName,
                    userType: data.userType,
                    ip: req.ip
                });
                // Register contractor
                const tokens = await this.authService.register(data);
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION_SUCCESS', tokens.user?.id, {
                    email: data.email,
                    companyName: companyName,
                    userType: data.userType,
                    ip: req.ip,
                    compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
                });
                res.status(201).json({
                    success: true,
                    message: 'Contractor registered successfully',
                    data: tokens
                });
            }
            catch (error) {
                logger_1.logger.error('Contractor registration error:', error);
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_REGISTRATION_FAILED', undefined, {
                    email: req.body.email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ip: req.ip,
                    compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
                });
                if (error instanceof Error) {
                    if (error.message.includes('Email already registered')) {
                        res.status(409).json({
                            success: false,
                            error: 'Business email already registered'
                        });
                    }
                    else if (error.message.includes('National ID already registered')) {
                        res.status(409).json({
                            success: false,
                            error: 'National ID already registered'
                        });
                    }
                    else if (error.message.includes('Password must')) {
                        res.status(400).json({
                            success: false,
                            error: error.message
                        });
                    }
                    else if (error.message.includes('Company name is required')) {
                        res.status(400).json({
                            success: false,
                            error: 'Company name is required'
                        });
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: 'Contractor registration failed'
                        });
                    }
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: 'Contractor registration failed'
                    });
                }
            }
        };
        this.contractorLogin = async (req, res) => {
            try {
                const { email, password } = req.body;
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_ATTEMPT', undefined, {
                    email,
                    ip: req.ip
                });
                const tokens = await this.authService.login(email, password, req.ip);
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_SUCCESS', tokens.user?.id, {
                    email,
                    ip: req.ip,
                    compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
                });
                res.json({
                    success: true,
                    message: 'Login successful',
                    data: tokens
                });
            }
            catch (error) {
                logger_1.logger.error('Contractor login error:', error);
                sama_logger_1.SAMALogger.logAuthEvent('CONTRACTOR_LOGIN_FAILED', undefined, {
                    email: req.body.email,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ip: req.ip,
                    compliance: 'SAMA_THIRD_PARTY_FRAMEWORK'
                });
                if (error instanceof Error) {
                    if (error.message.includes('Invalid email or password')) {
                        res.status(401).json({
                            success: false,
                            error: 'Invalid email or password'
                        });
                    }
                    else if (error.message.includes('Account is locked')) {
                        res.status(423).json({
                            success: false,
                            error: 'Account is locked. Please try again later.'
                        });
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: 'Login failed'
                        });
                    }
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: 'Login failed'
                    });
                }
            }
        };
        this.refreshToken = async (req, res) => {
            try {
                const { refreshToken } = req.body;
                if (!refreshToken) {
                    res.status(400).json({
                        success: false,
                        error: 'Refresh token is required'
                    });
                    return;
                }
                const tokens = await this.authService.refreshToken(refreshToken);
                res.json({
                    success: true,
                    message: 'Token refreshed successfully',
                    data: tokens
                });
            }
            catch (error) {
                logger_1.logger.error('Token refresh error:', error);
                res.status(401).json({
                    success: false,
                    error: 'Invalid or expired refresh token'
                });
            }
        };
        this.getProfile = async (req, res) => {
            try {
                // The user is available from auth middleware
                const user = req.user;
                const userId = user.id;
                const contractor = await prisma.contractor.findUnique({
                    where: { id: userId },
                });
                if (!contractor) {
                    res.status(401).json({
                        success: false,
                        error: 'Contractor not found'
                    });
                    return;
                }
                if (contractor) {
                    const { passwordHash, ...safeData } = contractor;
                    res.json({
                        success: true,
                        message: "Profile retrieved successfully",
                        data: safeData,
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Get profile error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get profile'
                });
            }
        };
        this.sendPhoneOTP = async (req, res) => {
            try {
                const { phoneNumber } = req.body;
                const userId = undefined;
                if (!phoneNumber) {
                    res.status(400).json({ error: 'Phone number is required' });
                    return;
                }
                await this.phoneVerificationService.sendOTP(phoneNumber, userId);
                res.json({
                    success: true,
                    message: 'OTP sent successfully'
                });
            }
            catch (error) {
                logger_1.logger.error('Send phone OTP error:', error);
                if (error instanceof Error) {
                    if (error.message.includes('Invalid Saudi phone number') || error.message.includes('Invalid phone number format')) {
                        res.status(400).json({ error: 'Invalid Saudi phone number format' });
                    }
                    else if (error.message.includes('Too many OTP requests')) {
                        res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
                    }
                    else {
                        res.status(500).json({ error: 'Failed to send OTP' });
                    }
                }
                else {
                    res.status(500).json({ error: 'Failed to send OTP' });
                }
            }
        };
        this.verifyPhoneOTP = async (req, res) => {
            try {
                const { phoneNumber, otp } = req.body;
                const userId = undefined;
                if (!phoneNumber || !otp) {
                    res.status(400).json({ error: 'Phone number and OTP are required' });
                    return;
                }
                const isValid = await this.phoneVerificationService.verifyOTP(phoneNumber, otp, userId);
                if (isValid) {
                    res.json({
                        success: true,
                        message: 'Phone verification successful'
                    });
                }
                else {
                    res.status(400).json({ error: 'Invalid OTP' });
                }
            }
            catch (error) {
                logger_1.logger.error('Verify phone OTP error:', error);
                if (error instanceof Error) {
                    if (error.message.includes('expired')) {
                        res.status(400).json({ error: 'OTP expired. Please request a new one.' });
                    }
                    else if (error.message.includes('Invalid OTP')) {
                        res.status(400).json({ error: 'Invalid OTP' });
                    }
                    else {
                        res.status(500).json({ error: 'Phone verification failed' });
                    }
                }
                else {
                    res.status(500).json({ error: 'Phone verification failed' });
                }
            }
        };
        this.authService = new auth_service_1.AuthService();
        this.phoneVerificationService = new phone_verification_service_1.PhoneVerificationService();
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
