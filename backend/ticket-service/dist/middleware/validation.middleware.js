"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParams = exports.validateQuery = exports.validateRequest = void 0;
const logger_1 = require("../utils/logger");
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.body);
            req.body = validated;
            next();
        }
        catch (error) {
            logger_1.logger.warn('Validation error:', {
                path: req.path,
                method: req.method,
                error: error.errors
            });
            const errorMessages = error.errors?.map((err) => ({
                field: err.path.join('.'),
                message: err.message
            })) || [];
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorMessages
            });
        }
    };
};
exports.validateRequest = validateRequest;
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.query);
            // Store validated query in a custom property since req.query is read-only
            req.validatedQuery = validated;
            next();
        }
        catch (error) {
            logger_1.logger.warn('Query validation error:', {
                path: req.path,
                method: req.method,
                error: error.errors || error.message,
                queryParams: req.query
            });
            const errorMessages = error.errors?.map((err) => ({
                field: err.path.join('.'),
                message: err.message
            })) || [];
            // If no specific error messages, provide generic message
            if (errorMessages.length === 0 && error.message) {
                errorMessages.push({
                    field: 'query',
                    message: error.message
                });
            }
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorMessages
            });
        }
    };
};
exports.validateQuery = validateQuery;
const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.params);
            req.params = validated;
            next();
        }
        catch (error) {
            logger_1.logger.warn('Params validation error:', {
                path: req.path,
                method: req.method,
                error: error.errors
            });
            const errorMessages = error.errors?.map((err) => ({
                field: err.path.join('.'),
                message: err.message
            })) || [];
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorMessages
            });
        }
    };
};
exports.validateParams = validateParams;
