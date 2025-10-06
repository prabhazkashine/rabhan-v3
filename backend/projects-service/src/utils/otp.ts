import crypto from 'crypto';
import { logger } from './logger';

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  const otp = crypto.randomInt(100000, 999999).toString();
  logger.info('OTP generated', { otpLength: otp.length });
  return otp;
}

/**
 * Calculate OTP expiry time (default 10 minutes from now)
 */
export function getOTPExpiry(minutes: number = 10): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}

/**
 * Verify if OTP is still valid
 */
export function isOTPValid(expiresAt: Date): boolean {
  return new Date() < new Date(expiresAt);
}

/**
 * Mock SMS sending function
 * In production, integrate with actual SMS service (Twilio, AWS SNS, etc.)
 */
export async function sendOTPViaSMS(
  phoneNumber: string,
  otp: string,
  projectId: string
): Promise<boolean> {
  try {
    logger.info('Sending OTP via SMS (MOCK)', {
      phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'), // Mask middle digits
      projectId,
      otpSent: true,
    });

    // MOCK: In production, call actual SMS API
    // Example: await twilioClient.messages.create({...})

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // For development, log the OTP
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n📱 SMS MOCK: OTP for project ${projectId} is: ${otp}\n`);
    }

    return true;
  } catch (error) {
    logger.error('Failed to send OTP via SMS', {
      error: error instanceof Error ? error.message : 'Unknown error',
      phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
      projectId,
    });
    return false;
  }
}

/**
 * Mock email sending function for notifications
 */
export async function sendEmailNotification(
  email: string,
  subject: string,
  message: string
): Promise<boolean> {
  try {
    logger.info('Sending email notification (MOCK)', {
      email: email.replace(/(.{3})(.*)(@.*)/, '$1***$3'), // Mask email
      subject,
    });

    // MOCK: In production, integrate with email service (SendGrid, AWS SES, etc.)

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n📧 EMAIL MOCK: To: ${email}\nSubject: ${subject}\nMessage: ${message}\n`);
    }

    return true;
  } catch (error) {
    logger.error('Failed to send email notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email: email.replace(/(.{3})(.*)(@.*)/, '$1***$3'),
    });
    return false;
  }
}
