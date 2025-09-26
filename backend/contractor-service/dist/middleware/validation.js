"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
const validate = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            logger_1.logger.debug('Validation error details:', {
                error: error,
                errorType: error?.constructor?.name,
                hasErrors: error instanceof zod_1.ZodError ? !!error.issues : false,
                path: req.path,
                body: req.body
            });
            if (error instanceof zod_1.ZodError && error.issues) {
                const validationErrors = error.issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                logger_1.logger.warn('Validation failed:', {
                    path: req.path,
                    method: req.method,
                    errors: validationErrors,
                    ip: req.ip,
                });
                res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors,
                });
                return;
            }
            logger_1.logger.error('Unexpected validation error:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                path: req.path,
                method: req.method,
            });
            res.status(500).json({
                success: false,
                message: 'Internal server error',
            });
        }
    };
};
exports.validate = validate;
