"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordUtils = void 0;
const crypto_1 = require("crypto");
class PasswordUtils {
    static validate(password) {
        const errors = [];
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (password.length > 128) {
            errors.push('Password cannot exceed 128 characters');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (!/[@$!%*?&]/.test(password)) {
            errors.push('Password must contain at least one special character (@$!%*?&)');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    static async hash(password) {
        return new Promise((resolve, reject) => {
            const salt = (0, crypto_1.randomBytes)(this.SALT_LENGTH);
            const crypto = require('crypto');
            crypto.pbkdf2(password, salt, this.HASH_ITERATIONS, this.KEY_LENGTH, 'sha256', (err, derivedKey) => {
                if (err)
                    reject(err);
                resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
            });
        });
    }
    static async verify(password, hashedPassword) {
        return new Promise((resolve, reject) => {
            const [saltHex, keyHex] = hashedPassword.split(':');
            const salt = Buffer.from(saltHex, 'hex');
            const key = Buffer.from(keyHex, 'hex');
            const crypto = require('crypto');
            crypto.pbkdf2(password, salt, this.HASH_ITERATIONS, this.KEY_LENGTH, 'sha256', (err, derivedKey) => {
                if (err)
                    reject(err);
                resolve((0, crypto_1.timingSafeEqual)(key, derivedKey));
            });
        });
    }
}
exports.PasswordUtils = PasswordUtils;
PasswordUtils.SALT_LENGTH = 16;
PasswordUtils.HASH_ITERATIONS = 100000;
PasswordUtils.KEY_LENGTH = 64;
