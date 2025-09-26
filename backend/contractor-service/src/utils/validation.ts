export class ValidationUtils {
  static normalizePhone(phone: string): string {
    let normalized = phone.replace(/[\s\-\(\)]/g, '');

    if (normalized.startsWith('+966')) {
      normalized = '0' + normalized.substring(4);
    } else if (normalized.startsWith('966')) {
      normalized = '0' + normalized.substring(3);
    } else if (normalized.startsWith('5') && normalized.length === 9) {
      normalized = '0' + normalized;
    }
    else if (normalized.startsWith('+')) {
      return normalized;
    }

    return normalized;
  }

  static normalizeSaudiPhone(phone: string): string {
    return this.normalizePhone(phone);
  }

  static isValidPhone(phone: string): boolean {
    const normalized = this.normalizePhone(phone);

    if (/^05[0-9]{8}$/.test(normalized)) {
      return true;
    }

    if (/^\+[1-9]\d{1,14}$/.test(normalized)) {
      return true;
    }

    return false;
  }

  static isValidSaudiPhone(phone: string): boolean {
    const normalized = this.normalizePhone(phone);
    return /^05[0-9]{8}$/.test(normalized);
  }

  static isValidNationalId(nationalId: string): boolean {
    return /^[12][0-9]{9}$/.test(nationalId);
  }

  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}