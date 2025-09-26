export declare class PhoneVerificationService {
    private otpStore;
    private rateLimitStore;
    private verifiedPhones;
    private phonePatterns;
    constructor();
    private validatePhoneNumber;
    private generateOTP;
    private generateSMSMessage;
    private getCountryName;
    private cleanupExpiredData;
    private checkRateLimit;
    sendOTP(phoneNumber: string, userId?: string, countryCode?: string): Promise<void>;
    verifyOTP(phoneNumber: string, otp: string, userId?: string, countryCode?: string): Promise<boolean>;
    isPhoneVerified(phoneNumber: string): Promise<boolean>;
}
