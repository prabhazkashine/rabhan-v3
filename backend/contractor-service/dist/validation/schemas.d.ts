import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    nationalId: z.ZodOptional<z.ZodString>;
    userType: z.ZodDefault<z.ZodEnum<{
        BUSINESS: "BUSINESS";
        CONTRACTOR: "CONTRACTOR";
        HOMEOWNER: "HOMEOWNER";
    }>>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const updateProfileSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    nationalId: z.ZodOptional<z.ZodString>;
    userType: z.ZodOptional<z.ZodEnum<{
        HOMEOWNER: "HOMEOWNER";
        CONTRACTOR: "CONTRACTOR";
        BUSINESS: "BUSINESS";
    }>>;
}, z.core.$strip>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
