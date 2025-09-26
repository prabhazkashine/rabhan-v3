"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneVerificationController = exports.PhoneVerificationController = void 0;
const phone_verification_service_1 = require("../services/phone-verification.service");
const sama_logger_1 = require("../utils/sama-logger");
const logger_1 = require("../utils/logger");
class PhoneVerificationController {
    constructor() {
        this.phoneVerificationService = new phone_verification_service_1.PhoneVerificationService();
        this.sendOTP = async (req, res) => {
            try {
                const { phoneNumber, countryCode } = req.body;
                const userId = req.user?.id;
                sama_logger_1.SAMALogger.logAuthEvent('OTP_SEND_ATTEMPT', userId, {
                    phone: phoneNumber,
                    countryCode,
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                await this.phoneVerificationService.sendOTP(phoneNumber, userId, countryCode);
                sama_logger_1.SAMALogger.logAuthEvent('OTP_SEND_SUCCESS', userId, {
                    phone: phoneNumber,
                    countryCode,
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                res.json({
                    success: true,
                    message: 'OTP sent successfully',
                    data: {
                        phoneNumber,
                        expiresInMinutes: 5,
                        ...(process.env.NODE_ENV === 'development' && {
                            developmentNote: 'In development mode, use OTP: 123456'
                        })
                    }
                });
            }
            catch (error) {
                const userId = req.user?.id;
                logger_1.logger.error('Send OTP error:', error);
                sama_logger_1.SAMALogger.logAuthEvent('OTP_SEND_FAILED', userId, {
                    phone: req.body.phoneNumber,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                if (error instanceof Error) {
                    if (error.message.includes('Invalid phone number format')) {
                        res.status(400).json({
                            success: false,
                            error: error.message
                        });
                    }
                    else if (error.message.includes('Too many OTP requests')) {
                        res.status(429).json({
                            success: false,
                            error: error.message
                        });
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to send OTP. Please try again.'
                        });
                    }
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to send OTP. Please try again.'
                    });
                }
            }
        };
        this.verifyOTP = async (req, res) => {
            try {
                const { phoneNumber, otp, countryCode } = req.body;
                const userId = req.user?.id;
                sama_logger_1.SAMALogger.logAuthEvent('OTP_VERIFY_ATTEMPT', userId, {
                    phone: phoneNumber,
                    countryCode,
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                const isValid = await this.phoneVerificationService.verifyOTP(phoneNumber, otp, userId, countryCode);
                if (isValid) {
                    sama_logger_1.SAMALogger.logAuthEvent('OTP_VERIFY_SUCCESS', userId, {
                        phone: phoneNumber,
                        countryCode,
                        ip: req.ip,
                        compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                    });
                    res.json({
                        success: true,
                        message: 'Phone number verified successfully',
                        data: {
                            phoneNumber,
                            verified: true,
                            verifiedAt: new Date().toISOString()
                        }
                    });
                }
                else {
                    sama_logger_1.SAMALogger.logSecurityEvent('OTP_VERIFY_FAILED', userId, {
                        phone: phoneNumber,
                        ip: req.ip,
                        compliance: 'SAMA_SECURITY_FRAMEWORK'
                    });
                    res.status(400).json({
                        success: false,
                        error: 'Invalid or expired OTP'
                    });
                }
            }
            catch (error) {
                const userId = req.user?.id;
                logger_1.logger.error('Verify OTP error:', error);
                sama_logger_1.SAMALogger.logAuthEvent('OTP_VERIFY_ERROR', userId, {
                    phone: req.body.phoneNumber,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                if (error instanceof Error) {
                    if (error.message.includes('Invalid phone number format')) {
                        res.status(400).json({
                            success: false,
                            error: 'Invalid phone number format'
                        });
                    }
                    else if (error.message.includes('OTP expired') || error.message.includes('Invalid OTP')) {
                        res.status(400).json({
                            success: false,
                            error: error.message
                        });
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to verify OTP. Please try again.'
                        });
                    }
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to verify OTP. Please try again.'
                    });
                }
            }
        };
        this.checkPhoneStatus = async (req, res) => {
            try {
                const { phoneNumber } = req.body;
                const userId = req.user?.id;
                const isVerified = await this.phoneVerificationService.isPhoneVerified(phoneNumber);
                sama_logger_1.SAMALogger.logAuthEvent('PHONE_STATUS_CHECK', userId, {
                    phone: phoneNumber,
                    verified: isVerified,
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                res.json({
                    success: true,
                    data: {
                        phoneNumber,
                        verified: isVerified,
                        checkedAt: new Date().toISOString()
                    }
                });
            }
            catch (error) {
                const userId = req.user?.id;
                logger_1.logger.error('Check phone status error:', error);
                sama_logger_1.SAMALogger.logError('PHONE_STATUS_CHECK_ERROR', error instanceof Error ? error : new Error('Unknown error'), userId);
                res.status(500).json({
                    success: false,
                    error: 'Failed to check phone verification status'
                });
            }
        };
        // Public endpoint for sending OTP before registration
        this.sendOTPPublic = async (req, res) => {
            try {
                const { phoneNumber, countryCode } = req.body;
                sama_logger_1.SAMALogger.logAuthEvent('PUBLIC_OTP_SEND_ATTEMPT', undefined, {
                    phone: phoneNumber,
                    countryCode,
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                await this.phoneVerificationService.sendOTP(phoneNumber, undefined, countryCode);
                sama_logger_1.SAMALogger.logAuthEvent('PUBLIC_OTP_SEND_SUCCESS', undefined, {
                    phone: phoneNumber,
                    countryCode,
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                res.json({
                    success: true,
                    message: 'OTP sent successfully',
                    data: {
                        phoneNumber,
                        expiresInMinutes: 5,
                        ...(process.env.NODE_ENV === 'development' && {
                            developmentNote: 'In development mode, use OTP: 123456'
                        })
                    }
                });
            }
            catch (error) {
                logger_1.logger.error('Send public OTP error:', error);
                sama_logger_1.SAMALogger.logAuthEvent('PUBLIC_OTP_SEND_FAILED', undefined, {
                    phone: req.body.phoneNumber,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                if (error instanceof Error) {
                    if (error.message.includes('Invalid phone number format')) {
                        res.status(400).json({
                            success: false,
                            error: error.message
                        });
                    }
                    else if (error.message.includes('Too many OTP requests')) {
                        res.status(429).json({
                            success: false,
                            error: error.message
                        });
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to send OTP. Please try again.'
                        });
                    }
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to send OTP. Please try again.'
                    });
                }
            }
        };
        // Public endpoint for verifying OTP before registration
        this.verifyOTPPublic = async (req, res) => {
            try {
                const { phoneNumber, otp, countryCode } = req.body;
                sama_logger_1.SAMALogger.logAuthEvent('PUBLIC_OTP_VERIFY_ATTEMPT', undefined, {
                    phone: phoneNumber,
                    countryCode,
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                const isValid = await this.phoneVerificationService.verifyOTP(phoneNumber, otp, undefined, countryCode);
                if (isValid) {
                    sama_logger_1.SAMALogger.logAuthEvent('PUBLIC_OTP_VERIFY_SUCCESS', undefined, {
                        phone: phoneNumber,
                        countryCode,
                        ip: req.ip,
                        compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                    });
                    res.json({
                        success: true,
                        message: 'Phone number verified successfully',
                        data: {
                            phoneNumber,
                            verified: true,
                            verifiedAt: new Date().toISOString()
                        }
                    });
                }
                else {
                    sama_logger_1.SAMALogger.logSecurityEvent('PUBLIC_OTP_VERIFY_FAILED', undefined, {
                        phone: phoneNumber,
                        ip: req.ip,
                        compliance: 'SAMA_SECURITY_FRAMEWORK'
                    });
                    res.status(400).json({
                        success: false,
                        error: 'Invalid or expired OTP'
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Verify public OTP error:', error);
                sama_logger_1.SAMALogger.logAuthEvent('PUBLIC_OTP_VERIFY_ERROR', undefined, {
                    phone: req.body.phoneNumber,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ip: req.ip,
                    compliance: 'SAMA_VERIFICATION_FRAMEWORK'
                });
                if (error instanceof Error) {
                    if (error.message.includes('Invalid phone number format')) {
                        res.status(400).json({
                            success: false,
                            error: 'Invalid phone number format'
                        });
                    }
                    else if (error.message.includes('OTP expired') || error.message.includes('Invalid OTP')) {
                        res.status(400).json({
                            success: false,
                            error: error.message
                        });
                    }
                    else {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to verify OTP. Please try again.'
                        });
                    }
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to verify OTP. Please try again.'
                    });
                }
            }
        };
    }
}
exports.PhoneVerificationController = PhoneVerificationController;
exports.phoneVerificationController = new PhoneVerificationController();
