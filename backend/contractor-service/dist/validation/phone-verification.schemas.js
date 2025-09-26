"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPhoneStatusSchema = exports.verifyOTPSchema = exports.sendOTPSchema = void 0;
const zod_1 = require("zod");
const saudiPhoneRegex = /^(05|5)[0-9]{8}$/;
const internationalPhoneRegex = /^\+[1-9]\d{1,14}$/;
const phoneRegex = new RegExp(`(${saudiPhoneRegex.source})|(${internationalPhoneRegex.source})`);
exports.sendOTPSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
        .transform(phone => phone.replace(/[\s\-\(\)]/g, '')), // Remove spaces and formatting
    countryCode: zod_1.z.string()
        .length(2, 'Country code must be exactly 2 characters')
        .toUpperCase()
        .optional()
});
exports.verifyOTPSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
        .transform(phone => phone.replace(/[\s\-\(\)]/g, '')), // Remove spaces and formatting
    otp: zod_1.z.string()
        .length(6, 'OTP must be exactly 6 digits')
        .regex(/^\d{6}$/, 'OTP must contain only digits'),
    countryCode: zod_1.z.string()
        .length(2, 'Country code must be exactly 2 characters')
        .toUpperCase()
        .optional()
});
exports.checkPhoneStatusSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string()
        .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
        .transform(phone => phone.replace(/[\s\-\(\)]/g, '')) // Remove spaces and formatting
});
