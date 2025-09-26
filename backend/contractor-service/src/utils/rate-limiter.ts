import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();

  create(config: RateLimitConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = config.keyGenerator ? config.keyGenerator(req) : req.ip || 'unknown';
      const now = Date.now();

      let requestInfo = this.requests.get(key);

      if (!requestInfo || now > requestInfo.resetTime) {
        requestInfo = {
          count: 1,
          resetTime: now + config.windowMs
        };
      } else {
        requestInfo.count++;
      }

      this.requests.set(key, requestInfo);

      if (requestInfo.count > config.maxRequests) {
        logger.warn('Rate limit exceeded:', {
          ip: req.ip,
          key,
          count: requestInfo.count,
          maxRequests: config.maxRequests
        });

        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((requestInfo.resetTime - now) / 1000)
        });
        return;
      }

      // Clean up old entries periodically
      if (Math.random() < 0.1) { // 10% chance
        this.cleanup();
      }

      next();
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, info] of this.requests.entries()) {
      if (now > info.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

const rateLimiter = new RateLimiter();

export const authRateLimit = rateLimiter.create({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 minutes
  keyGenerator: (req: Request) => `auth:${req.ip}`
});

export const generalRateLimit = rateLimiter.create({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  keyGenerator: (req: Request) => `general:${req.ip}`
});