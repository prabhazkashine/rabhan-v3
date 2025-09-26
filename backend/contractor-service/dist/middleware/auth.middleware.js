"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jwt_1 = require("../utils/jwt");
const logger_1 = require("../utils/logger");
class AuthMiddleware {
    constructor() {
        this.authenticate = (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    res.status(401).json({
                        success: false,
                        message: 'Access token is required'
                    });
                    return;
                }
                const token = authHeader.substring(7); // Remove 'Bearer ' prefix
                try {
                    const payload = jwt_1.JWTUtils.verifyAccessToken(token);
                    req.user = {
                        id: payload.userId,
                        email: payload.email,
                        role: payload.role,
                        sessionId: payload.sessionId
                    };
                    next();
                }
                catch (tokenError) {
                    logger_1.logger.warn('Invalid access token:', {
                        error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
                        ip: req.ip
                    });
                    res.status(401).json({
                        success: false,
                        message: 'Invalid or expired access token'
                    });
                }
            }
            catch (error) {
                logger_1.logger.error('Authentication middleware error:', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ip: req.ip
                });
                res.status(500).json({
                    success: false,
                    message: 'Authentication failed'
                });
            }
        };
    }
}
exports.authMiddleware = new AuthMiddleware();
