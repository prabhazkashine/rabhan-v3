import { UserRole } from '@prisma/client';
export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
    sessionId: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        role: string;
        phone: string | null;
        nationalId: string | null;
        userType: string;
        status: string;
        bnplEligible: boolean;
    };
}
declare class JWTUtils {
    private static readonly ACCESS_TOKEN_SECRET;
    private static readonly REFRESH_TOKEN_SECRET;
    private static readonly ACCESS_TOKEN_EXPIRES_IN;
    private static readonly REFRESH_TOKEN_EXPIRES_IN;
    static generateTokenPair(userId: string, email: string, role: UserRole, sessionId: string): AuthTokens;
    static verifyAccessToken(token: string): JWTPayload;
    static verifyRefreshToken(token: string): JWTPayload;
    static getExpiresInMs(expiresIn: string): number;
}
export { JWTUtils };
