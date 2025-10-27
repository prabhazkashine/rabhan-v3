"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
require("dotenv/config");
const logger_1 = require("./utils/logger");
const error_handler_1 = require("./middleware/error-handler");
const ticket_routes_1 = __importDefault(require("./routes/ticket.routes"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3010;
// CORS
app.use((0, cors_1.default)());
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static file serving for uploaded documents
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Request logging
app.use((req, res, next) => {
    logger_1.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Ticket Service API is running',
        timestamp: new Date().toISOString(),
        service: 'ticket-service',
        version: '1.0.0'
    });
});
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});
// API routes
app.use('/api/tickets', ticket_routes_1.default);
// 404 handler
app.use(error_handler_1.notFoundHandler);
// Error handler (must be last)
app.use(error_handler_1.errorHandler);
app.listen(port, () => {
    logger_1.logger.info(`Ticket service is running on http://localhost:${port}`);
    console.log(`✅ Ticket service is running on http://localhost:${port}`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
