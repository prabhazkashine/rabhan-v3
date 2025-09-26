"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneVerificationRoutes = void 0;
const express_1 = require("express");
const phone_verification_controller_1 = require("../controllers/phone-verification.controller");
const rate_limiter_1 = require("../utils/rate-limiter");
const validation_1 = require("../middleware/validation");
const phone_verification_schemas_1 = require("../validation/phone-verification.schemas");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
exports.phoneVerificationRoutes = router;
// Public routes (for phone verification before registration)
router.post('/send-otp', rate_limiter_1.authRateLimit, (0, validation_1.validate)(phone_verification_schemas_1.sendOTPSchema), phone_verification_controller_1.phoneVerificationController.sendOTPPublic);
router.post('/verify-otp', rate_limiter_1.authRateLimit, (0, validation_1.validate)(phone_verification_schemas_1.verifyOTPSchema), phone_verification_controller_1.phoneVerificationController.verifyOTPPublic);
// Protected routes (for authenticated contractors)
router.post('/contractor/send-otp', rate_limiter_1.authRateLimit, auth_middleware_1.authMiddleware.authenticate, (0, validation_1.validate)(phone_verification_schemas_1.sendOTPSchema), phone_verification_controller_1.phoneVerificationController.sendOTP);
router.post('/contractor/verify-otp', rate_limiter_1.authRateLimit, auth_middleware_1.authMiddleware.authenticate, (0, validation_1.validate)(phone_verification_schemas_1.verifyOTPSchema), phone_verification_controller_1.phoneVerificationController.verifyOTP);
router.post('/contractor/check-status', auth_middleware_1.authMiddleware.authenticate, (0, validation_1.validate)(phone_verification_schemas_1.checkPhoneStatusSchema), phone_verification_controller_1.phoneVerificationController.checkPhoneStatus);
