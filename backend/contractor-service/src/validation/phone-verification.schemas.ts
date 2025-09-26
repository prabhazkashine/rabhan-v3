import { z } from 'zod';

const saudiPhoneRegex = /^(05|5)[0-9]{8}$/;
const internationalPhoneRegex = /^\+[1-9]\d{1,14}$/;
const phoneRegex = new RegExp(`(${saudiPhoneRegex.source})|(${internationalPhoneRegex.source})`);

export const sendOTPSchema = z.object({
  phoneNumber: z.string()
    .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
    .transform(phone => phone.replace(/[\s\-\(\)]/g, '')), // Remove spaces and formatting

  countryCode: z.string()
    .length(2, 'Country code must be exactly 2 characters')
    .toUpperCase()
    .optional()
});

export const verifyOTPSchema = z.object({
  phoneNumber: z.string()
    .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
    .transform(phone => phone.replace(/[\s\-\(\)]/g, '')), // Remove spaces and formatting

  otp: z.string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),

  countryCode: z.string()
    .length(2, 'Country code must be exactly 2 characters')
    .toUpperCase()
    .optional()
});

export const checkPhoneStatusSchema = z.object({
  phoneNumber: z.string()
    .regex(phoneRegex, 'Phone must be a valid Saudi phone number (05xxxxxxxx) or international number (+1234567890)')
    .transform(phone => phone.replace(/[\s\-\(\)]/g, '')) // Remove spaces and formatting
});

export type SendOTPRequest = z.infer<typeof sendOTPSchema>;
export type VerifyOTPRequest = z.infer<typeof verifyOTPSchema>;
export type CheckPhoneStatusRequest = z.infer<typeof checkPhoneStatusSchema>;