import { z } from 'zod';
export declare const updateUserProfileSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    district: z.ZodOptional<z.ZodString>;
    streetAddress: z.ZodOptional<z.ZodString>;
    landmark: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    postalCode: z.ZodOptional<z.ZodString>;
    propertyType: z.ZodOptional<z.ZodEnum<{
        villa: "villa";
        apartment: "apartment";
        duplex: "duplex";
        townhouse: "townhouse";
        commercial: "commercial";
        industrial: "industrial";
        other: "other";
    }>>;
    propertyOwnership: z.ZodOptional<z.ZodEnum<{
        owned: "owned";
        rented: "rented";
        leased: "leased";
        family_owned: "family_owned";
    }>>;
    roofSize: z.ZodOptional<z.ZodNumber>;
    gpsLatitude: z.ZodOptional<z.ZodNumber>;
    gpsLongitude: z.ZodOptional<z.ZodNumber>;
    electricityConsumption: z.ZodOptional<z.ZodEnum<{
        E0_200: "E0_200";
        E200_400: "E200_400";
        E400_600: "E400_600";
        E600_800: "E600_800";
        E800_1000: "E800_1000";
        E1000_1200: "E1000_1200";
        E1200_1500: "E1200_1500";
        E1500_PLUS: "E1500_PLUS";
    }>>;
    electricityMeterNumber: z.ZodOptional<z.ZodString>;
    employmentStatus: z.ZodNullable<z.ZodOptional<z.ZodEnum<{
        government: "government";
        private: "private";
        self_employed: "self_employed";
        student: "student";
        retired: "retired";
    }>>>;
    employerName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    jobTitle: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    monthlyIncome: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    yearsEmployed: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    desiredSystemSize: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    budgetRange: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    preferredLanguage: z.ZodOptional<z.ZodEnum<{
        en: "en";
        ar: "ar";
    }>>;
    emailNotifications: z.ZodOptional<z.ZodBoolean>;
    smsNotifications: z.ZodOptional<z.ZodBoolean>;
    marketingConsent: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileSchema>;
