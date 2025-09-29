import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../types/common';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  const userAgent = req.headers['user-agent'];
  const ipAddress = getClientIpAddress(req);
  const correlationId = req.headers['x-correlation-id'] as string;

  (req as AuthenticatedRequest).context = {
    requestId,
    timestamp: new Date().toISOString(),
    userAgent,
    ipAddress,
    correlationId
  };

  res.setHeader('x-request-id', requestId);

  if (correlationId) {
    res.setHeader('x-correlation-id', correlationId);
  }

  next();
}

function getClientIpAddress(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }

  const clientIp = req.headers['x-client-ip'] as string;
  if (clientIp) {
    return clientIp;
  }

  return req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection as any)?.socket?.remoteAddress ||
         'unknown';
}