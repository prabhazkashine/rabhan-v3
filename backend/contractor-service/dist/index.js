"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const routes_1 = require("./routes");
const error_handler_1 = require("./middleware/error-handler");
const rate_limiter_1 = require("./utils/rate-limiter");
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
const port = process.env.PORT || 3002;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://your-domain.com']
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(rate_limiter_1.generalRateLimit);
app.use('/api', routes_1.apiRoutes);
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Contractor Service API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            register: '/api/auth/contractor/register',
            login: '/api/auth/contractor/login',
            refresh: '/api/auth/contractor/refresh',
            profile: '/api/auth/contractor/profile',
            sendOTP: '/api/auth/send-otp',
            verifyOTP: '/api/auth/verify-otp',
            contractorProfile: {
                get: '/api/profile',
                create: '/api/profile',
                update: '/api/profile',
                delete: '/api/profile'
            }
        }
    });
});
app.use(error_handler_1.notFoundHandler);
app.use(error_handler_1.errorHandler);
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
app.listen(port, () => {
    logger_1.logger.info(`Contractor service is running on http://localhost:${port}`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
    });
});
