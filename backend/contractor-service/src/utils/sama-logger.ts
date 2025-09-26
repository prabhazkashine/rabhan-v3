import { logger } from './logger';

interface SAMALogData {
  userId?: string;
  email?: string;
  companyName?: string;
  userType?: string;
  ip?: string;
  role?: string;
  provider?: string;
  error?: string;
  compliance?: string;
  [key: string]: any;
}

export class SAMALogger {
  static logAuthEvent(event: string, userId?: string, data: SAMALogData = {}): void {
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
        logger.info(`[SAMA-AUTH] ${event}`, logData);
        break;
      case 'CONTRACTOR_LOGIN_ATTEMPT':
      case 'CONTRACTOR_LOGIN_SUCCESS':
      case 'CONTRACTOR_LOGIN_FAILED':
        logger.info(`[SAMA-AUTH] ${event}`, logData);
        break;
      default:
        logger.info(`[SAMA-AUTH] ${event}`, logData);
    }
  }

  static logBusinessEvent(event: string, userId?: string, data: SAMALogData = {}): void {
    const logData = {
      event,
      userId,
      timestamp: new Date().toISOString(),
      compliance: 'SAMA_BUSINESS_FRAMEWORK',
      ...data
    };

    logger.info(`[SAMA-BUSINESS] ${event}`, logData);
  }

  static logSecurityEvent(event: string, userId?: string, data: SAMALogData = {}): void {
    const logData = {
      event,
      userId,
      timestamp: new Date().toISOString(),
      compliance: 'SAMA_SECURITY_FRAMEWORK',
      ...data
    };

    logger.warn(`[SAMA-SECURITY] ${event}`, logData);
  }

  static logError(event: string, error: Error, userId?: string, data: SAMALogData = {}): void {
    const logData = {
      event,
      userId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      compliance: 'SAMA_ERROR_FRAMEWORK',
      ...data
    };

    logger.error(`[SAMA-ERROR] ${event}`, logData);
  }
}