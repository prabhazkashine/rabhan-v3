import { z } from 'zod';
export declare const sendOTPSchema: z.ZodObject<{
    phoneNumber: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    countryCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const verifyOTPSchema: z.ZodObject<{
    phoneNumber: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    otp: z.ZodString;
    countryCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const checkPhoneStatusSchema: z.ZodObject<{
    phoneNumber: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export type SendOTPRequest = z.infer<typeof sendOTPSchema>;
export type VerifyOTPRequest = z.infer<typeof verifyOTPSchema>;
export type CheckPhoneStatusRequest = z.infer<typeof checkPhoneStatusSchema>;
