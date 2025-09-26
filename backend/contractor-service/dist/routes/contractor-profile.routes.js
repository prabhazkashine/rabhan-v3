"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractorProfileRoutes = void 0;
const express_1 = require("express");
const contractor_profile_controller_1 = require("../controllers/contractor-profile.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_1 = require("../middleware/validation");
const contractor_profile_schemas_1 = require("../validation/contractor-profile.schemas");
const rate_limiter_1 = require("../utils/rate-limiter");
const router = (0, express_1.Router)();
exports.contractorProfileRoutes = router;
// All profile routes require authentication
router.use(auth_middleware_1.authMiddleware.authenticate);
// Get contractor profile
router.get('/', contractor_profile_controller_1.contractorProfileController.getProfile);
// Create contractor profile
router.post('/', rate_limiter_1.generalRateLimit, (0, validation_1.validate)(contractor_profile_schemas_1.contractorProfileCreateSchema), contractor_profile_controller_1.contractorProfileController.createProfile);
// Update contractor profile
router.put('/', rate_limiter_1.generalRateLimit, (0, validation_1.validate)(contractor_profile_schemas_1.contractorProfileUpdateSchema), contractor_profile_controller_1.contractorProfileController.updateProfile);
// Delete contractor profile (soft delete)
router.delete('/', rate_limiter_1.generalRateLimit, contractor_profile_controller_1.contractorProfileController.deleteProfile);
