"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const rate_limiter_1 = require("../utils/rate-limiter");
const validation_1 = require("../middleware/validation");
const validation_2 = require("../validation");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
exports.authRoutes = router;
// Contractor Registration
router.post('/contractor/register', rate_limiter_1.authRateLimit, (0, validation_1.validate)(validation_2.validationSchemas.contractorRegister), auth_controller_1.authController.contractorRegister);
// Contractor Login
router.post('/contractor/login', rate_limiter_1.authRateLimit, (0, validation_1.validate)(validation_2.validationSchemas.contractorLogin), auth_controller_1.authController.contractorLogin);
// Refresh Token
router.post('/contractor/refresh', rate_limiter_1.authRateLimit, auth_controller_1.authController.refreshToken);
// Get Profile (Protected)
router.get('/contractor/profile', auth_middleware_1.authMiddleware.authenticate, auth_controller_1.authController.getProfile);
// Phone OTP endpoints
router.post('/send-otp', rate_limiter_1.authRateLimit, auth_controller_1.authController.sendPhoneOTP);
router.post('/verify-otp', rate_limiter_1.authRateLimit, auth_controller_1.authController.verifyPhoneOTP);
