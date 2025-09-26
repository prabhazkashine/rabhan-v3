import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

class PasswordUtils {
  private static readonly SALT_LENGTH = 16;
  private static readonly HASH_ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 64;

  static validate(password: string): PasswordValidation {
    const errors: string[] = [];

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

  static async hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = randomBytes(this.SALT_LENGTH);

      const crypto = require('crypto');
      crypto.pbkdf2(password, salt, this.HASH_ITERATIONS, this.KEY_LENGTH, 'sha256', (err: any, derivedKey: Buffer) => {
        if (err) reject(err);
        resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
      });
    });
  }

  static async verify(password: string, hashedPassword: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [saltHex, keyHex] = hashedPassword.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      const key = Buffer.from(keyHex, 'hex');

      const crypto = require('crypto');
      crypto.pbkdf2(password, salt, this.HASH_ITERATIONS, this.KEY_LENGTH, 'sha256', (err: any, derivedKey: Buffer) => {
        if (err) reject(err);
        resolve(timingSafeEqual(key, derivedKey));
      });
    });
  }
}

export { PasswordUtils };