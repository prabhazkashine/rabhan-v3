"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRoutes = void 0;
const express_1 = require("express");
const auth_routes_1 = require("./auth.routes");
const contractor_profile_routes_1 = require("./contractor-profile.routes");
const router = (0, express_1.Router)();
exports.apiRoutes = router;
router.use('/auth', auth_routes_1.authRoutes);
router.use('/profile', contractor_profile_routes_1.contractorProfileRoutes);
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Contractor Service is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
