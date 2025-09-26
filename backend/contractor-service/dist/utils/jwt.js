"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTUtils = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class JWTUtils {
    static generateTokenPair(userId, email, role, sessionId) {
        const payload = {
            userId,
            email,
            role,
            sessionId
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, this.ACCESS_TOKEN_SECRET, {
            expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
        });
        const refreshToken = jsonwebtoken_1.default.sign(payload, this.REFRESH_TOKEN_SECRET, {
            expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: 900, // 15 minutes in seconds
        };
    }
    static verifyAccessToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, this.ACCESS_TOKEN_SECRET);
        }
        catch (error) {
            throw new Error('Invalid or expired access token');
        }
    }
    static verifyRefreshToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, this.REFRESH_TOKEN_SECRET);
        }
        catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }
    static getExpiresInMs(expiresIn) {
        const unit = expiresIn.slice(-1);
        const value = parseInt(expiresIn.slice(0, -1));
        switch (unit) {
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 900000; // 15 minutes default
        }
    }
}
exports.JWTUtils = JWTUtils;
JWTUtils.ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';
JWTUtils.REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
JWTUtils.ACCESS_TOKEN_EXPIRES_IN = '15m';
JWTUtils.REFRESH_TOKEN_EXPIRES_IN = '7d';
