import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Custom log levels for SAMA compliance
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    audit: 3,
    performance: 4,
    debug: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    audit: 'blue',
    performance: 'magenta',
    debug: 'cyan'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      requestId,
      userId,
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}] ${requestId ? `[${requestId}] ` : ''}${message}${metaStr ? '\n' + metaStr : ''}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'marketplace-service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    // Audit log file for SAMA compliance
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'audit',
      maxsize: 10485760, // 10MB
      maxFiles: 20
    })
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Extended logger with SAMA compliance methods
class ExtendedLogger {
  private winston: winston.Logger;

  constructor(winstonLogger: winston.Logger) {
    this.winston = winstonLogger;
  }

  // Standard logging methods
  error(message: string, error?: any, meta?: any) {
    this.winston.error(message, {
      error: error?.stack || error,
      errorMessage: error?.message,
      ...meta
    });
  }

  warn(message: string, meta?: any) {
    this.winston.warn(message, meta);
  }

  info(message: string, meta?: any) {
    this.winston.info(message, meta);
  }

  debug(message: string, meta?: any) {
    this.winston.debug(message, meta);
  }

  // SAMA Compliance: Data access audit logging
  auditDataAccess(
    userId: string,
    tableName: string,
    recordId: string,
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    additionalData?: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    this.winston.log('audit', 'Data access audit', {
      auditType: 'DATA_ACCESS',
      userId,
      tableName,
      recordId,
      action,
      ipAddress,
      userAgent,
      ...additionalData
    });
  }

  // SAMA Compliance: Authentication audit logging
  auditAuthentication(
    userId: string,
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'TOKEN_REFRESH',
    ipAddress?: string,
    userAgent?: string,
    additionalData?: any
  ) {
    this.winston.log('audit', 'Authentication audit', {
      auditType: 'AUTHENTICATION',
      userId,
      action,
      ipAddress,
      userAgent,
      ...additionalData
    });
  }

  // Performance monitoring
  auditPerformance(
    operation: string,
    durationMs: number,
    additionalData?: any
  ) {
    this.winston.log('performance', 'Performance audit', {
      auditType: 'PERFORMANCE',
      operation,
      durationMs,
      performanceFlag: durationMs > 1000 ? 'SLOW' : 'NORMAL',
      ...additionalData
    });
  }

  // Security audit logging
  auditSecurity(
    event: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    userId?: string,
    ipAddress?: string,
    additionalData?: any
  ) {
    this.winston.log('audit', 'Security audit', {
      auditType: 'SECURITY',
      event,
      severity,
      userId,
      ipAddress,
      ...additionalData
    });
  }

  // Business operation audit
  auditBusinessOperation(
    operation: string,
    userId: string,
    entityType: string,
    entityId: string,
    oldValues?: any,
    newValues?: any,
    additionalData?: any
  ) {
    this.winston.log('audit', 'Business operation audit', {
      auditType: 'BUSINESS_OPERATION',
      operation,
      userId,
      entityType,
      entityId,
      oldValues,
      newValues,
      ...additionalData
    });
  }
}

// Export extended logger instance
export default new ExtendedLogger(logger);

// Export winston logger for advanced usage if needed
export { logger as winstonLogger };