import { PrismaClient, UserProfile, ProfileVerificationStatus } from '@prisma/client';
import { UpdateUserProfileRequest } from '../validation/user-profile.schemas';
import { logger } from '../utils/logger';

export interface UserProfileResponse {
  id: string;
  authUserId: string;
  firstName: string;
  lastName: string;
  region: string;
  city: string;
  district: string;
  streetAddress: string;
  landmark: string | null;
  postalCode: string;
  propertyType: string;
  propertyOwnership: string;
  roofSize: number;
  gpsLatitude: number;
  gpsLongitude: number;
  electricityConsumption: string;
  electricityMeterNumber: string;
  employmentStatus: string | null;
  employerName: string | null;
  jobTitle: string | null;
  monthlyIncome: number | null;
  yearsEmployed: number | null;
  desiredSystemSize: number | null;
  budgetRange: string | null;
  preferredLanguage: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingConsent: boolean;
  profileCompleted: boolean;
  profileCompletionPercentage: number;
  bnplEligible: boolean;
  bnplMaxAmount: number;
  bnplRiskScore: number | null;
  verificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

class UserProfileService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getUserProfile(userId: string): Promise<UserProfileResponse | null> {
    try {
      await this.prisma.$connect();

      const profile = await this.prisma.userProfile.findUnique({
        where: { authUserId: userId },
      });

      if (!profile) {
        return null;
      }

      return this.mapToResponse(profile);

    } catch (error: any) {
      logger.error('Get user profile failed:', {
        error: error.message,
        userId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async updateUserProfile(userId: string, data: UpdateUserProfileRequest): Promise<UserProfileResponse | null> {
    try {
      await this.prisma.$connect();

      // Check if profile exists
      const existingProfile = await this.prisma.userProfile.findUnique({
        where: { authUserId: userId },
      });

      if (!existingProfile) {
        throw new Error('User profile not found');
      }

      // Merge existing data with update data for completion calculation
      const mergedData = {
        firstName: data.firstName || existingProfile.firstName,
        lastName: data.lastName || existingProfile.lastName,
        region: data.region || existingProfile.region,
        city: data.city || existingProfile.city,
        district: data.district || existingProfile.district,
        streetAddress: data.streetAddress || existingProfile.streetAddress,
        landmark: data.landmark !== undefined ? data.landmark : existingProfile.landmark,
        postalCode: data.postalCode || existingProfile.postalCode,
        propertyType: data.propertyType || existingProfile.propertyType,
        propertyOwnership: data.propertyOwnership || existingProfile.propertyOwnership,
        roofSize: data.roofSize || existingProfile.roofSize,
        gpsLatitude: data.gpsLatitude || existingProfile.gpsLatitude,
        gpsLongitude: data.gpsLongitude || existingProfile.gpsLongitude,
        electricityConsumption: data.electricityConsumption || existingProfile.electricityConsumption,
        electricityMeterNumber: data.electricityMeterNumber || existingProfile.electricityMeterNumber,
        employmentStatus: data.employmentStatus !== undefined ? data.employmentStatus : existingProfile.employmentStatus,
        employerName: data.employerName !== undefined ? data.employerName : existingProfile.employerName,
        jobTitle: data.jobTitle !== undefined ? data.jobTitle : existingProfile.jobTitle,
        monthlyIncome: data.monthlyIncome !== undefined ? data.monthlyIncome : existingProfile.monthlyIncome,
        yearsEmployed: data.yearsEmployed !== undefined ? data.yearsEmployed : existingProfile.yearsEmployed,
        desiredSystemSize: data.desiredSystemSize !== undefined ? data.desiredSystemSize : existingProfile.desiredSystemSize,
        budgetRange: data.budgetRange !== undefined ? data.budgetRange : existingProfile.budgetRange,
        preferredLanguage: data.preferredLanguage || existingProfile.preferredLanguage,
        emailNotifications: data.emailNotifications !== undefined ? data.emailNotifications : existingProfile.emailNotifications,
        smsNotifications: data.smsNotifications !== undefined ? data.smsNotifications : existingProfile.smsNotifications,
        marketingConsent: data.marketingConsent !== undefined ? data.marketingConsent : existingProfile.marketingConsent,
      };

      // Recalculate profile completion and BNPL eligibility
      const completionPercentage = this.calculateProfileCompletion(mergedData);
      const { bnplEligible, bnplMaxAmount, bnplRiskScore } = this.calculateBNPLEligibility(mergedData);

      // Build update data
      const updateData: any = {
        ...data,
        profileCompleted: completionPercentage === 100,
        profileCompletionPercentage: completionPercentage,
        bnplEligible,
        bnplMaxAmount,
        bnplRiskScore,
      };

      const updatedProfile = await this.prisma.userProfile.update({
        where: { authUserId: userId },
        data: updateData,
      });

      logger.info('User profile updated successfully', {
        userId,
        profileId: updatedProfile.id,
        completionPercentage,
        bnplEligible,
      });

      return this.mapToResponse(updatedProfile);

    } catch (error: any) {
      logger.error('Update user profile failed:', {
        error: error.message,
        userId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async deleteUserProfile(userId: string): Promise<void> {
    try {
      await this.prisma.$connect();

      const existingProfile = await this.prisma.userProfile.findUnique({
        where: { authUserId: userId },
      });

      if (!existingProfile) {
        throw new Error('User profile not found');
      }

      await this.prisma.userProfile.delete({
        where: { authUserId: userId },
      });

      logger.info('User profile deleted successfully', {
        userId,
        profileId: existingProfile.id,
      });

    } catch (error: any) {
      logger.error('Delete user profile failed:', {
        error: error.message,
        userId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private calculateProfileCompletion(data: any): number {
    const requiredFields = [
      'firstName', 'lastName', 'region', 'city', 'district',
      'streetAddress', 'postalCode', 'propertyType', 'propertyOwnership',
      'roofSize', 'gpsLatitude', 'gpsLongitude', 'electricityConsumption',
      'electricityMeterNumber'
    ];

    const optionalFields = [
      'landmark', 'employmentStatus', 'employerName', 'jobTitle',
      'monthlyIncome', 'yearsEmployed', 'desiredSystemSize', 'budgetRange'
    ];

    let completedRequired = 0;
    let completedOptional = 0;

    // Check required fields
    for (const field of requiredFields) {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        completedRequired++;
      }
    }

    // Check optional fields
    for (const field of optionalFields) {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        completedOptional++;
      }
    }

    // Required fields are worth 80%, optional fields 20%
    const requiredPercentage = (completedRequired / requiredFields.length) * 80;
    const optionalPercentage = (completedOptional / optionalFields.length) * 20;

    return Math.round(requiredPercentage + optionalPercentage);
  }

  private calculateBNPLEligibility(data: any): {
    bnplEligible: boolean;
    bnplMaxAmount: number;
    bnplRiskScore: number | null
  } {
    let riskScore = 0;
    let maxAmount = 0;

    // Employment status scoring
    if (data.employmentStatus === 'government') {
      riskScore += 30;
      maxAmount += 50000;
    } else if (data.employmentStatus === 'private') {
      riskScore += 20;
      maxAmount += 30000;
    } else if (data.employmentStatus === 'self_employed') {
      riskScore += 15;
      maxAmount += 20000;
    }

    // Monthly income scoring
    if (data.monthlyIncome) {
      if (data.monthlyIncome >= 15000) {
        riskScore += 25;
        maxAmount += 40000;
      } else if (data.monthlyIncome >= 10000) {
        riskScore += 20;
        maxAmount += 25000;
      } else if (data.monthlyIncome >= 5000) {
        riskScore += 15;
        maxAmount += 15000;
      }
    }

    // Years employed scoring
    if (data.yearsEmployed) {
      if (data.yearsEmployed >= 5) {
        riskScore += 20;
      } else if (data.yearsEmployed >= 2) {
        riskScore += 15;
      } else if (data.yearsEmployed >= 1) {
        riskScore += 10;
      }
    }

    // Property ownership scoring
    if (data.propertyOwnership === 'owned') {
      riskScore += 15;
      maxAmount += 10000;
    } else if (data.propertyOwnership === 'family_owned') {
      riskScore += 10;
      maxAmount += 5000;
    }

    // Property type scoring
    if (data.propertyType === 'villa') {
      riskScore += 10;
      maxAmount += 5000;
    } else if (data.propertyType === 'apartment') {
      riskScore += 5;
    }

    const finalRiskScore = Math.min(100, riskScore);
    const bnplEligible = finalRiskScore >= 50 && data.employmentStatus && data.monthlyIncome;

    return {
      bnplEligible,
      bnplMaxAmount: bnplEligible ? Math.min(maxAmount, 100000) : 0,
      bnplRiskScore: bnplEligible ? finalRiskScore / 100 : null,
    };
  }

  private mapToResponse(profile: UserProfile): UserProfileResponse {
    return {
      id: profile.id,
      authUserId: profile.authUserId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      region: profile.region,
      city: profile.city,
      district: profile.district,
      streetAddress: profile.streetAddress,
      landmark: profile.landmark,
      postalCode: profile.postalCode,
      propertyType: profile.propertyType,
      propertyOwnership: profile.propertyOwnership,
      roofSize: Number(profile.roofSize),
      gpsLatitude: Number(profile.gpsLatitude),
      gpsLongitude: Number(profile.gpsLongitude),
      electricityConsumption: profile.electricityConsumption,
      electricityMeterNumber: profile.electricityMeterNumber,
      employmentStatus: profile.employmentStatus,
      employerName: profile.employerName,
      jobTitle: profile.jobTitle,
      monthlyIncome: profile.monthlyIncome ? Number(profile.monthlyIncome) : null,
      yearsEmployed: profile.yearsEmployed,
      desiredSystemSize: profile.desiredSystemSize ? Number(profile.desiredSystemSize) : null,
      budgetRange: profile.budgetRange,
      preferredLanguage: profile.preferredLanguage,
      emailNotifications: profile.emailNotifications,
      smsNotifications: profile.smsNotifications,
      marketingConsent: profile.marketingConsent,
      profileCompleted: profile.profileCompleted,
      profileCompletionPercentage: profile.profileCompletionPercentage,
      bnplEligible: profile.bnplEligible,
      bnplMaxAmount: Number(profile.bnplMaxAmount),
      bnplRiskScore: profile.bnplRiskScore ? Number(profile.bnplRiskScore) : null,
      verificationStatus: profile.verificationStatus,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}

export { UserProfileService };