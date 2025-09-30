import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

// Create Winston logger
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'quote-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Performance logger
class PerformanceLogger {
  startTimer(label: string) {
    const start = Date.now();
    return {
      end: (meta?: Record<string, any>) => {
        const duration = Date.now() - start;
        logger.info(`Performance: ${label}`, { duration_ms: duration, ...meta });
      },
    };
  }
}

export const performanceLogger = new PerformanceLogger();

// Audit logger for important business events
class AuditLogger {
  quote(action: string, data: Record<string, any>) {
    logger.info(`AUDIT: ${action}`, {
      audit_type: 'quote',
      action,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  wallet(action: string, data: Record<string, any>) {
    logger.info(`AUDIT: ${action}`, {
      audit_type: 'wallet',
      action,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  invoice(action: string, data: Record<string, any>) {
    logger.info(`AUDIT: ${action}`, {
      audit_type: 'invoice',
      action,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }
}

export const auditLogger = new AuditLogger();