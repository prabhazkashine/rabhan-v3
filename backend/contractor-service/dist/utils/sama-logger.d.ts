interface SAMALogData {
    userId?: string;
    email?: string;
    companyName?: string;
    userType?: string;
    ip?: string;
    role?: string;
    provider?: string;
    error?: string;
    compliance?: string;
    [key: string]: any;
}
export declare class SAMALogger {
    static logAuthEvent(event: string, userId?: string, data?: SAMALogData): void;
    static logBusinessEvent(event: string, userId?: string, data?: SAMALogData): void;
    static logSecurityEvent(event: string, userId?: string, data?: SAMALogData): void;
    static logError(event: string, error: Error, userId?: string, data?: SAMALogData): void;
}
export {};
