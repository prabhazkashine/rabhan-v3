"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const logger_1 = require("../utils/logger");
class AuthMiddleware {
    constructor() {
        this.authenticate = (req, res, next) => {
            try {
                // Get user info from headers (set by API Gateway)
                const userId = req.headers['x-user-id'];
                const userRole = req.headers['x-user-role'];
                if (!userId || !userRole) {
                    logger_1.logger.warn('Missing authentication headers', {
                        ip: req.ip,
                        path: req.path
                    });
                    res.status(401).json({
                        success: false,
                        message: 'Missing authentication headers'
                    });
                    return;
                }
                // Validate role
                const validRoles = ['user', 'contractor', 'admin', 'super_admin'];
                if (!validRoles.includes(userRole)) {
                    logger_1.logger.warn('Invalid user role', {
                        userId,
                        userRole,
                        path: req.path
                    });
                    res.status(403).json({
                        success: false,
                        message: 'Invalid user role'
                    });
                    return;
                }
                req.user = {
                    id: userId,
                    role: userRole,
                };
                logger_1.logger.debug('User authenticated', {
                    userId,
                    userRole,
                    path: req.path
                });
                next();
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
        // Optional: Verify user is of specific role
        this.authorizeRole = (allowedRoles) => {
            return (req, res, next) => {
                if (!req.user) {
                    res.status(401).json({
                        success: false,
                        message: 'Authentication required'
                    });
                    return;
                }
                if (!allowedRoles.includes(req.user.role)) {
                    logger_1.logger.warn('Authorization failed', {
                        userId: req.user.id,
                        userRole: req.user.role,
                        allowedRoles,
                        path: req.path
                    });
                    res.status(403).json({
                        success: false,
                        message: 'You do not have permission to perform this action'
                    });
                    return;
                }
                next();
            };
        };
    }
}
exports.authMiddleware = new AuthMiddleware();
