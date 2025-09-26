import { z } from 'zod';
export declare const contractorRegisterSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    nationalId: z.ZodOptional<z.ZodString>;
    companyName: z.ZodString;
    crNumber: z.ZodOptional<z.ZodString>;
    vatNumber: z.ZodOptional<z.ZodString>;
    userType: z.ZodDefault<z.ZodEnum<{
        BUSINESS: "BUSINESS";
        individual: "individual";
    }>>;
    role: z.ZodDefault<z.ZodEnum<{
        CONTRACTOR: "CONTRACTOR";
    }>>;
    businessType: z.ZodDefault<z.ZodEnum<{
        individual: "individual";
        llc: "llc";
    }>>;
}, z.core.$strip>;
export declare const contractorLoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type ContractorRegisterRequest = z.infer<typeof contractorRegisterSchema>;
export type ContractorLoginRequest = z.infer<typeof contractorLoginSchema>;
