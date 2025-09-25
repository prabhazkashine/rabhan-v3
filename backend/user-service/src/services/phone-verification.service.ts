import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface PhonePattern {
  name: string;
  pattern: RegExp;
  format: (phone: string) => string;
  example: string;
}

interface ValidationResult {
  isValid: boolean;
  formatted: string;
  country?: string;
}

export class PhoneVerificationService {
  private redis: Redis;

  private phonePatterns: { [key: string]: PhonePattern } = {
    SA: {
      name: 'Saudi Arabia',
      pattern: /^(05|5)[0-9]{8}$/,
      format: (phone: string) => phone.startsWith('05') ? phone : '0' + phone,
      example: '0512345678'
    },
    IN: {
      name: 'India',
      pattern: /^(\+91|91|0)?[6-9][0-9]{9}$/,
      format: (phone: string) => {
        const cleaned = phone.replace(/^\+91|^91|^0/, '');
        return cleaned.length === 10 ? `+91${cleaned}` : phone;
      },
      example: '+919876543210'
    }
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  private validatePhoneNumber(phoneNumber: string, countryCode?: string): ValidationResult {
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // If country code is specified, validate against that country only
    if (countryCode && this.phonePatterns[countryCode]) {
      const pattern = this.phonePatterns[countryCode];
      if (pattern.pattern.test(cleanPhone)) {
        return {
          isValid: true,
          formatted: pattern.format(cleanPhone),
          country: countryCode
        };
      }
    }

    // Try all supported countries
    for (const [code, pattern] of Object.entries(this.phonePatterns)) {
      if (pattern.pattern.test(cleanPhone)) {
        return {
          isValid: true,
          formatted: pattern.format(cleanPhone),
          country: code
        };
      }
    }

    return { isValid: false, formatted: cleanPhone };
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateSMSMessage(otp: string, countryCode: string): string {
    const messages = {
      SA: `Your Rabhan verification code is: ${otp}. Do not share this code with anyone.`,
      default: `Your verification code is: ${otp}. Do not share this code with anyone.`
    };

    return messages[countryCode as keyof typeof messages] || messages.default;
  }

  private getCountryName(countryCode: string): string {
    return this.phonePatterns[countryCode]?.name || 'Unknown';
  }

  private async getOTPAttempts(phoneNumber: string): Promise<number> {
    const attemptsKey = `otp_attempts:${phoneNumber}`;
    const attempts = await this.redis.get(attemptsKey);
    return parseInt(attempts || '0');
  }

  private async incrementOTPAttempts(phoneNumber: string): Promise<void> {
    const attemptsKey = `otp_attempts:${phoneNumber}`;
    const currentAttempts = await this.getOTPAttempts(phoneNumber);
    await this.redis.setex(attemptsKey, 3600, currentAttempts + 1); // 1 hour expiry
  }

  private async clearOTPAttempts(phoneNumber: string): Promise<void> {
    const attemptsKey = `otp_attempts:${phoneNumber}`;
    await this.redis.del(attemptsKey);
  }

  public async sendOTP(phoneNumber: string, userId?: string, countryCode?: string): Promise<void> {
    try {
      // Validate and format phone number for any supported country
      const validation = this.validatePhoneNumber(phoneNumber, countryCode);

      if (!validation.isValid || !validation.country) {
        const supportedCountries = Object.values(this.phonePatterns)
          .map(p => `${p.name} (${p.example})`)
          .join(', ');
        throw new Error(`Invalid phone number format. Supported countries: ${supportedCountries}`);
      }

      const formattedPhone = validation.formatted;
      const detectedCountry = validation.country;

      // Check rate limiting - max 5 attempts per hour
      const attempts = await this.getOTPAttempts(formattedPhone);
      if (attempts >= 5) {
        throw new Error('Too many OTP requests. Please try again later.');
      }

      // Generate OTP
      const otp = this.generateOTP();
      const otpKey = `phone_otp:${formattedPhone}`;

      // 🚀 DEVELOPMENT MODE: Use dummy OTP for easier testing
      const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.USE_DUMMY_OTP === 'true';

      if (isDevelopmentMode) {
        // Store dummy OTP '123456' for easy testing
        const dummyOTP = '123456';
        await this.redis.setex(otpKey, 300, dummyOTP);

        logger.info(`🧪 DEVELOPMENT MODE: Using dummy OTP '${dummyOTP}' for ${formattedPhone}`);
        logger.info(`📱 Real OTP would have been: ${otp}`);
      } else {
        // PRODUCTION MODE: Store real OTP (SMS integration would go here)
        await this.redis.setex(otpKey, 300, otp);
        logger.info(`OTP sent to ${formattedPhone} (${this.getCountryName(detectedCountry)})`);

        // TODO: Integrate with actual SMS service (Twilio, AWS SNS, etc.)
        // await this.smsService.sendSMS(formattedPhone, this.generateSMSMessage(otp, detectedCountry));
      }

      // Increment attempts
      await this.incrementOTPAttempts(formattedPhone);

    } catch (error) {
      logger.error('Send OTP error:', error);
      throw error;
    }
  }

  public async verifyOTP(phoneNumber: string, otp: string, userId?: string, countryCode?: string): Promise<boolean> {
    try {
      // Validate and format phone number
      const validation = this.validatePhoneNumber(phoneNumber, countryCode);

      if (!validation.isValid || !validation.country) {
        throw new Error('Invalid phone number format');
      }

      const formattedPhone = validation.formatted;
      const otpKey = `phone_otp:${formattedPhone}`;
      const storedOTP = await this.redis.get(otpKey);

      if (!storedOTP) {
        throw new Error('OTP expired or not found');
      }

      if (storedOTP !== otp) {
        throw new Error('Invalid OTP');
      }

      // OTP is valid, remove it and clear attempts
      await this.redis.del(otpKey);
      await this.clearOTPAttempts(formattedPhone);

      // Store verified phone for registration process (24 hour expiry)
      const verifiedPhoneKey = `verified_phone:${formattedPhone}`;
      await this.redis.setex(verifiedPhoneKey, 86400, 'true');

      logger.info(`Phone verification successful for ${formattedPhone}`);
      return true;
    } catch (error) {
      logger.error('Verify OTP error:', error);
      throw error;
    }
  }

  public async isPhoneVerified(phoneNumber: string): Promise<boolean> {
    try {
      const validation = this.validatePhoneNumber(phoneNumber);
      if (!validation.isValid) return false;

      const verifiedPhoneKey = `verified_phone:${validation.formatted}`;
      const isVerified = await this.redis.get(verifiedPhoneKey);
      return isVerified === 'true';
    } catch (error) {
      logger.error('Check phone verification error:', error);
      return false;
    }
  }
}