"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMALogger = void 0;
const logger_1 = require("./logger");
class SAMALogger {
    static logAuthEvent(event, userId, data = {}) {
        const logData = {
            event,
            userId,
            timestamp: new Date().toISOString(),
            compliance: 'SAMA_THIRD_PARTY_FRAMEWORK',
            ...data
        };
        switch (event) {
            case 'CONTRACTOR_REGISTRATION_ATTEMPT':
            case 'CONTRACTOR_REGISTRATION_SUCCESS':
            case 'CONTRACTOR_REGISTRATION_FAILED':
                logger_1.logger.info(`[SAMA-AUTH] ${event}`, logData);
                break;
            case 'CONTRACTOR_LOGIN_ATTEMPT':
            case 'CONTRACTOR_LOGIN_SUCCESS':
            case 'CONTRACTOR_LOGIN_FAILED':
                logger_1.logger.info(`[SAMA-AUTH] ${event}`, logData);
                break;
            default:
                logger_1.logger.info(`[SAMA-AUTH] ${event}`, logData);
        }
    }
    static logBusinessEvent(event, userId, data = {}) {
        const logData = {
            event,
            userId,
            timestamp: new Date().toISOString(),
            compliance: 'SAMA_BUSINESS_FRAMEWORK',
            ...data
        };
        logger_1.logger.info(`[SAMA-BUSINESS] ${event}`, logData);
    }
    static logSecurityEvent(event, userId, data = {}) {
        const logData = {
            event,
            userId,
            timestamp: new Date().toISOString(),
            compliance: 'SAMA_SECURITY_FRAMEWORK',
            ...data
        };
        logger_1.logger.warn(`[SAMA-SECURITY] ${event}`, logData);
    }
    static logError(event, error, userId, data = {}) {
        const logData = {
            event,
            userId,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            compliance: 'SAMA_ERROR_FRAMEWORK',
            ...data
        };
        logger_1.logger.error(`[SAMA-ERROR] ${event}`, logData);
    }
}
exports.SAMALogger = SAMALogger;
