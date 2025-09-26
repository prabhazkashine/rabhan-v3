export declare const validationSchemas: {
    contractorRegister: import("zod").ZodObject<{
        firstName: import("zod").ZodString;
        lastName: import("zod").ZodString;
        email: import("zod").ZodString;
        password: import("zod").ZodString;
        phone: import("zod").ZodOptional<import("zod").ZodString>;
        nationalId: import("zod").ZodOptional<import("zod").ZodString>;
        companyName: import("zod").ZodString;
        crNumber: import("zod").ZodOptional<import("zod").ZodString>;
        vatNumber: import("zod").ZodOptional<import("zod").ZodString>;
        userType: import("zod").ZodDefault<import("zod").ZodEnum<{
            BUSINESS: "BUSINESS";
            individual: "individual";
        }>>;
        role: import("zod").ZodDefault<import("zod").ZodEnum<{
            CONTRACTOR: "CONTRACTOR";
        }>>;
        businessType: import("zod").ZodDefault<import("zod").ZodEnum<{
            individual: "individual";
            llc: "llc";
        }>>;
    }, import("zod/v4/core").$strip>;
    contractorLogin: import("zod").ZodObject<{
        email: import("zod").ZodString;
        password: import("zod").ZodString;
    }, import("zod/v4/core").$strip>;
    sendOTP: import("zod").ZodObject<{
        phoneNumber: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>;
        countryCode: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strip>;
    verifyOTP: import("zod").ZodObject<{
        phoneNumber: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>;
        otp: import("zod").ZodString;
        countryCode: import("zod").ZodOptional<import("zod").ZodString>;
    }, import("zod/v4/core").$strip>;
    checkPhoneStatus: import("zod").ZodObject<{
        phoneNumber: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>;
    }, import("zod/v4/core").$strip>;
    contractorProfileCreate: import("zod").ZodObject<{
        businessName: import("zod").ZodString;
        businessNameAr: import("zod").ZodOptional<import("zod").ZodString>;
        businessType: import("zod").ZodDefault<import("zod").ZodEnum<{
            individual: "individual";
            llc: "llc";
            corporation: "corporation";
            partnership: "partnership";
            other: "other";
        }>>;
        commercialRegistration: import("zod").ZodOptional<import("zod").ZodString>;
        vatNumber: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodString;
        phone: import("zod").ZodString;
        whatsapp: import("zod").ZodOptional<import("zod").ZodString>;
        website: import("zod").ZodOptional<import("zod").ZodString>;
        addressLine1: import("zod").ZodString;
        addressLine2: import("zod").ZodOptional<import("zod").ZodString>;
        city: import("zod").ZodString;
        region: import("zod").ZodString;
        postalCode: import("zod").ZodOptional<import("zod").ZodString>;
        country: import("zod").ZodDefault<import("zod").ZodString>;
        latitude: import("zod").ZodOptional<import("zod").ZodNumber>;
        longitude: import("zod").ZodOptional<import("zod").ZodNumber>;
        establishedYear: import("zod").ZodOptional<import("zod").ZodNumber>;
        employeeCount: import("zod").ZodOptional<import("zod").ZodNumber>;
        description: import("zod").ZodOptional<import("zod").ZodString>;
        descriptionAr: import("zod").ZodOptional<import("zod").ZodString>;
        serviceCategories: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodEnum<{
            residential_solar: "residential_solar";
            commercial_solar: "commercial_solar";
            industrial_solar: "industrial_solar";
            maintenance: "maintenance";
            consultation: "consultation";
            design: "design";
            electrical: "electrical";
            roofing: "roofing";
            all: "all";
        }>>>;
        serviceAreas: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodString>>;
        yearsExperience: import("zod").ZodDefault<import("zod").ZodNumber>;
        contractorType: import("zod").ZodDefault<import("zod").ZodEnum<{
            full_solar_contractor: "full_solar_contractor";
            solar_vendor_only: "solar_vendor_only";
        }>>;
        canInstall: import("zod").ZodDefault<import("zod").ZodBoolean>;
        canSupplyOnly: import("zod").ZodDefault<import("zod").ZodBoolean>;
        preferredLanguage: import("zod").ZodDefault<import("zod").ZodString>;
        emailNotifications: import("zod").ZodDefault<import("zod").ZodBoolean>;
        smsNotifications: import("zod").ZodDefault<import("zod").ZodBoolean>;
        marketingConsent: import("zod").ZodDefault<import("zod").ZodBoolean>;
    }, import("zod/v4/core").$strip>;
    contractorProfileUpdate: import("zod").ZodObject<{
        businessName: import("zod").ZodOptional<import("zod").ZodString>;
        businessNameAr: import("zod").ZodOptional<import("zod").ZodString>;
        businessType: import("zod").ZodOptional<import("zod").ZodEnum<{
            individual: "individual";
            llc: "llc";
            corporation: "corporation";
            partnership: "partnership";
            other: "other";
        }>>;
        commercialRegistration: import("zod").ZodOptional<import("zod").ZodString>;
        vatNumber: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodOptional<import("zod").ZodString>;
        phone: import("zod").ZodOptional<import("zod").ZodString>;
        whatsapp: import("zod").ZodOptional<import("zod").ZodString>;
        website: import("zod").ZodOptional<import("zod").ZodString>;
        addressLine1: import("zod").ZodOptional<import("zod").ZodString>;
        addressLine2: import("zod").ZodOptional<import("zod").ZodString>;
        city: import("zod").ZodOptional<import("zod").ZodString>;
        region: import("zod").ZodOptional<import("zod").ZodString>;
        postalCode: import("zod").ZodOptional<import("zod").ZodString>;
        country: import("zod").ZodOptional<import("zod").ZodString>;
        latitude: import("zod").ZodOptional<import("zod").ZodNumber>;
        longitude: import("zod").ZodOptional<import("zod").ZodNumber>;
        establishedYear: import("zod").ZodOptional<import("zod").ZodNumber>;
        employeeCount: import("zod").ZodOptional<import("zod").ZodNumber>;
        description: import("zod").ZodOptional<import("zod").ZodString>;
        descriptionAr: import("zod").ZodOptional<import("zod").ZodString>;
        serviceCategories: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
            residential_solar: "residential_solar";
            commercial_solar: "commercial_solar";
            industrial_solar: "industrial_solar";
            maintenance: "maintenance";
            consultation: "consultation";
            design: "design";
            electrical: "electrical";
            roofing: "roofing";
            all: "all";
        }>>>;
        serviceAreas: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
        yearsExperience: import("zod").ZodOptional<import("zod").ZodNumber>;
        contractorType: import("zod").ZodOptional<import("zod").ZodEnum<{
            full_solar_contractor: "full_solar_contractor";
            solar_vendor_only: "solar_vendor_only";
        }>>;
        canInstall: import("zod").ZodOptional<import("zod").ZodBoolean>;
        canSupplyOnly: import("zod").ZodOptional<import("zod").ZodBoolean>;
        preferredLanguage: import("zod").ZodOptional<import("zod").ZodString>;
        emailNotifications: import("zod").ZodOptional<import("zod").ZodBoolean>;
        smsNotifications: import("zod").ZodOptional<import("zod").ZodBoolean>;
        marketingConsent: import("zod").ZodOptional<import("zod").ZodBoolean>;
    }, import("zod/v4/core").$strip>;
};
