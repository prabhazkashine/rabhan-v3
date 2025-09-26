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

interface OTPData {
  otp: string;
  expiresAt: number;
  attempts: number;
}

interface RateLimit {
  count: number;
  resetTime: number;
}

export class PhoneVerificationService {
  private otpStore = new Map<string, OTPData>();
  private rateLimitStore = new Map<string, RateLimit>();
  private verifiedPhones = new Map<string, number>(); // phone -> timestamp

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
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60000); // Cleanup every minute
  }

  private validatePhoneNumber(phoneNumber: string, countryCode?: string): ValidationResult {
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

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

  private cleanupExpiredData(): void {
    const now = Date.now();

    for (const [key, data] of this.otpStore.entries()) {
      if (now > data.expiresAt) {
        this.otpStore.delete(key);
      }
    }

    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now > data.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }

    for (const [key, timestamp] of this.verifiedPhones.entries()) {
      if (now > timestamp + (24 * 60 * 60 * 1000)) {
        this.verifiedPhones.delete(key);
      }
    }
  }

  private checkRateLimit(phoneNumber: string): boolean {
    const now = Date.now();
    const rateLimit = this.rateLimitStore.get(phoneNumber);

    if (!rateLimit || now > rateLimit.resetTime) {
      this.rateLimitStore.set(phoneNumber, {
        count: 1,
        resetTime: now + (60 * 60 * 1000) // 1 hour
      });
      return false;
    }

    if (rateLimit.count >= 5) {
      return true; // Rate limited
    }

    rateLimit.count++;
    return false;
  }

  public async sendOTP(phoneNumber: string, userId?: string, countryCode?: string): Promise<void> {
    try {
      const validation = this.validatePhoneNumber(phoneNumber, countryCode);

      if (!validation.isValid || !validation.country) {
        const supportedCountries = Object.values(this.phonePatterns)
          .map(p => `${p.name} (${p.example})`)
          .join(', ');
        throw new Error(`Invalid phone number format. Supported countries: ${supportedCountries}`);
      }

      const formattedPhone = validation.formatted;
      const detectedCountry = validation.country;

      if (this.checkRateLimit(formattedPhone)) {
        throw new Error('Too many OTP requests. Please try again later.');
      }

      const otp = this.generateOTP();
      const now = Date.now();

      const isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.USE_DUMMY_OTP === 'true';

      const otpToStore = isDevelopmentMode ? '123456' : otp;

      this.otpStore.set(formattedPhone, {
        otp: otpToStore,
        expiresAt: now + (5 * 60 * 1000), // 5 minutes
        attempts: 0
      });

      if (isDevelopmentMode) {
        logger.info(`🧪 DEVELOPMENT MODE: Using dummy OTP '${otpToStore}' for ${formattedPhone}`);
        logger.info(`📱 Real OTP would have been: ${otp}`);
      } else {
        logger.info(`OTP sent to ${formattedPhone} (${this.getCountryName(detectedCountry)})`);
      }

    } catch (error) {
      logger.error('Send OTP error:', error);
      throw error;
    }
  }

  public async verifyOTP(phoneNumber: string, otp: string, userId?: string, countryCode?: string): Promise<boolean> {
    try {
      const validation = this.validatePhoneNumber(phoneNumber, countryCode);

      if (!validation.isValid || !validation.country) {
        throw new Error('Invalid phone number format');
      }

      const formattedPhone = validation.formatted;
      const otpData = this.otpStore.get(formattedPhone);

      if (!otpData) {
        throw new Error('OTP expired or not found');
      }

      const now = Date.now();

      if (now > otpData.expiresAt) {
        this.otpStore.delete(formattedPhone);
        throw new Error('OTP expired or not found');
      }

      if (otpData.attempts >= 3) {
        this.otpStore.delete(formattedPhone);
        throw new Error('Maximum verification attempts exceeded');
      }

      if (otpData.otp !== otp) {
        otpData.attempts++;
        this.otpStore.set(formattedPhone, otpData);
        throw new Error('Invalid OTP');
      }

      this.otpStore.delete(formattedPhone);
      this.rateLimitStore.delete(formattedPhone); // Clear rate limit on successful verification

      this.verifiedPhones.set(formattedPhone, now);

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

      const formattedPhone = validation.formatted;
      const verificationTime = this.verifiedPhones.get(formattedPhone);

      if (!verificationTime) return false;

      const now = Date.now();
      if (now > verificationTime + (24 * 60 * 60 * 1000)) {
        this.verifiedPhones.delete(formattedPhone);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Check phone verification error:', error);
      return false;
    }
  }
}