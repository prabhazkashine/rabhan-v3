import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { ContractorProfileCreateRequest, ContractorProfileUpdateRequest } from '../validation/contractor-profile.schemas';
import { SAMALogger } from '../utils/sama-logger';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export class ContractorProfileController {

  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const contractorProfile = await prisma.contractorProfile.findUnique({
        where: { userId },
        include: {
          contractor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              nationalId: true,
              emailVerified: true,
              phoneVerified: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });

      if (!contractorProfile) {
        const contractor = await prisma.contractor.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            nationalId: true,
            emailVerified: true,
            phoneVerified: true,
            createdAt: true,
            updatedAt: true
          }
        });

        if (!contractor) {
          res.status(404).json({
            success: false,
            error: 'Contractor not found'
          });
          return;
        }

        SAMALogger.logAuthEvent('PROFILE_VIEW_BASIC', userId, {
          hasProfile: false,
          compliance: 'SAMA_PROFILE_FRAMEWORK'
        });

        res.json({
          success: true,
          data: {
            hasProfile: false,
            contractor,
            profile: null
          }
        });
        return;
      }

      SAMALogger.logAuthEvent('PROFILE_VIEW_COMPLETE', userId, {
        hasProfile: true,
        businessType: contractorProfile.businessType,
        contractorType: contractorProfile.contractorType,
        compliance: 'SAMA_PROFILE_FRAMEWORK'
      });

      res.json({
        success: true,
        data: {
          hasProfile: true,
          contractor: contractorProfile.contractor,
          profile: {
            id: contractorProfile.id,
            businessName: contractorProfile.businessName,
            businessNameAr: contractorProfile.businessNameAr,
            businessType: contractorProfile.businessType,
            commercialRegistration: contractorProfile.commercialRegistration,
            vatNumber: contractorProfile.vatNumber,
            email: contractorProfile.email,
            phone: contractorProfile.phone,
            whatsapp: contractorProfile.whatsapp,
            website: contractorProfile.website,
            addressLine1: contractorProfile.addressLine1,
            addressLine2: contractorProfile.addressLine2,
            city: contractorProfile.city,
            region: contractorProfile.region,
            postalCode: contractorProfile.postalCode,
            country: contractorProfile.country,
            latitude: contractorProfile.latitude ? Number(contractorProfile.latitude) : null,
            longitude: contractorProfile.longitude ? Number(contractorProfile.longitude) : null,
            establishedYear: contractorProfile.establishedYear,
            employeeCount: contractorProfile.employeeCount,
            description: contractorProfile.description,
            descriptionAr: contractorProfile.descriptionAr,
            serviceCategories: contractorProfile.serviceCategories,
            serviceAreas: contractorProfile.serviceAreas,
            yearsExperience: contractorProfile.yearsExperience,
            contractorType: contractorProfile.contractorType,
            canInstall: contractorProfile.canInstall,
            canSupplyOnly: contractorProfile.canSupplyOnly,
            status: contractorProfile.status,
            verificationLevel: contractorProfile.verificationLevel,
            totalProjects: contractorProfile.totalProjects,
            completedProjects: contractorProfile.completedProjects,
            averageRating: Number(contractorProfile.averageRating),
            totalReviews: contractorProfile.totalReviews,
            responseTimeHours: contractorProfile.responseTimeHours ? Number(contractorProfile.responseTimeHours) : null,
            bankAccountVerified: contractorProfile.bankAccountVerified,
            taxClearanceVerified: contractorProfile.taxClearanceVerified,
            financialStandingVerified: contractorProfile.financialStandingVerified,
            preferredLanguage: contractorProfile.preferredLanguage,
            emailNotifications: contractorProfile.emailNotifications,
            smsNotifications: contractorProfile.smsNotifications,
            marketingConsent: contractorProfile.marketingConsent,
            createdAt: contractorProfile.createdAt,
            updatedAt: contractorProfile.updatedAt
          }
        }
      });

    } catch (error) {
      const userId = (req as AuthenticatedRequest).user?.id;

      logger.error('Get contractor profile error:', error);
      SAMALogger.logError('PROFILE_VIEW_ERROR', error instanceof Error ? error : new Error('Unknown error'), userId);

      res.status(500).json({
        success: false,
        error: 'Failed to get contractor profile'
      });
    }
  };

  createProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      const data: ContractorProfileCreateRequest = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const existingProfile = await prisma.contractorProfile.findUnique({
        where: { userId }
      });

      if (existingProfile) {
        res.status(409).json({
          success: false,
          error: 'Profile already exists. Use update endpoint instead.',
          data: {
            profileId: existingProfile.id,
            status: existingProfile.status,
            verificationLevel: existingProfile.verificationLevel
          }
        });
        return;
      }

      const profile = await prisma.$transaction(async (tx) => {
        return await tx.contractorProfile.create({
          data: {
            userId,
            businessName: data.businessName,
            businessNameAr: data.businessNameAr || null,
            businessType: data.businessType,
            commercialRegistration: data.commercialRegistration || null,
            vatNumber: data.vatNumber || null,
            email: data.email,
            phone: data.phone,
            whatsapp: data.whatsapp || null,
            website: data.website || null,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 || null,
            city: data.city,
            region: data.region,
            postalCode: data.postalCode || null,
            country: data.country,
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            establishedYear: data.establishedYear || null,
            employeeCount: data.employeeCount || null,
            description: data.description || null,
            descriptionAr: data.descriptionAr || null,
            serviceCategories: data.serviceCategories,
            serviceAreas: data.serviceAreas,
            yearsExperience: data.yearsExperience,
            contractorType: data.contractorType,
            canInstall: data.canInstall,
            canSupplyOnly: data.canSupplyOnly,
            preferredLanguage: data.preferredLanguage,
            emailNotifications: data.emailNotifications,
            smsNotifications: data.smsNotifications,
            marketingConsent: data.marketingConsent,
            createdBy: userId,
            ipAddress: req.ip || null,
            userAgent: req.get('User-Agent') || null
          }
        });
      });

      SAMALogger.logAuthEvent('PROFILE_CREATED', userId, {
        businessType: profile.businessType,
        contractorType: profile.contractorType,
        serviceCategories: profile.serviceCategories,
        compliance: 'SAMA_PROFILE_FRAMEWORK'
      });

      res.status(201).json({
        success: true,
        message: 'Contractor profile created successfully',
        data: {
          profileId: profile.id,
          status: profile.status,
          verificationLevel: profile.verificationLevel
        }
      });

    } catch (error) {
      const userId = (req as AuthenticatedRequest).user?.id;

      logger.error('Create contractor profile error:', error);
      SAMALogger.logError('PROFILE_CREATE_ERROR', error instanceof Error ? error : new Error('Unknown error'), userId);

      res.status(500).json({
        success: false,
        error: 'Failed to create contractor profile'
      });
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      const data: ContractorProfileUpdateRequest = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const existingProfile = await prisma.contractorProfile.findUnique({
        where: { userId }
      });

      if (!existingProfile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found. Create profile first.'
        });
        return;
      }

      const updatedProfile = await prisma.$transaction(async (tx) => {
        return await tx.contractorProfile.update({
          where: { userId },
          data: {
            ...(data.businessName && { businessName: data.businessName }),
            ...(data.businessNameAr !== undefined && { businessNameAr: data.businessNameAr }),
            ...(data.businessType && { businessType: data.businessType }),
            ...(data.commercialRegistration !== undefined && { commercialRegistration: data.commercialRegistration }),
            ...(data.vatNumber !== undefined && { vatNumber: data.vatNumber }),
            ...(data.email && { email: data.email }),
            ...(data.phone && { phone: data.phone }),
            ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
            ...(data.website !== undefined && { website: data.website }),
            ...(data.addressLine1 && { addressLine1: data.addressLine1 }),
            ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 }),
            ...(data.city && { city: data.city }),
            ...(data.region && { region: data.region }),
            ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
            ...(data.country && { country: data.country }),
            ...(data.latitude !== undefined && { latitude: data.latitude }),
            ...(data.longitude !== undefined && { longitude: data.longitude }),
            ...(data.establishedYear !== undefined && { establishedYear: data.establishedYear }),
            ...(data.employeeCount !== undefined && { employeeCount: data.employeeCount }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.descriptionAr !== undefined && { descriptionAr: data.descriptionAr }),
            ...(data.serviceCategories && { serviceCategories: data.serviceCategories }),
            ...(data.serviceAreas && { serviceAreas: data.serviceAreas }),
            ...(data.yearsExperience !== undefined && { yearsExperience: data.yearsExperience }),
            ...(data.contractorType && { contractorType: data.contractorType }),
            ...(data.canInstall !== undefined && { canInstall: data.canInstall }),
            ...(data.canSupplyOnly !== undefined && { canSupplyOnly: data.canSupplyOnly }),
            ...(data.preferredLanguage && { preferredLanguage: data.preferredLanguage }),
            ...(data.emailNotifications !== undefined && { emailNotifications: data.emailNotifications }),
            ...(data.smsNotifications !== undefined && { smsNotifications: data.smsNotifications }),
            ...(data.marketingConsent !== undefined && { marketingConsent: data.marketingConsent }),
            updatedBy: userId,
            ipAddress: req.ip || null,
            userAgent: req.get('User-Agent') || null
          }
        });
      });

      SAMALogger.logAuthEvent('PROFILE_UPDATED', userId, {
        profileId: updatedProfile.id,
        businessType: updatedProfile.businessType,
        contractorType: updatedProfile.contractorType,
        updatedFields: Object.keys(data),
        compliance: 'SAMA_PROFILE_FRAMEWORK'
      });

      res.json({
        success: true,
        message: 'Contractor profile updated successfully',
        data: {
          profileId: updatedProfile.id,
          status: updatedProfile.status,
          verificationLevel: updatedProfile.verificationLevel,
          updatedAt: updatedProfile.updatedAt
        }
      });

    } catch (error) {
      const userId = (req as AuthenticatedRequest).user?.id;

      logger.error('Update contractor profile error:', error);
      SAMALogger.logError('PROFILE_UPDATE_ERROR', error instanceof Error ? error : new Error('Unknown error'), userId);

      if (error instanceof Error) {
        if (error.message.includes('Unique constraint failed')) {
          res.status(409).json({
            success: false,
            error: 'Profile with this information already exists'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Failed to update contractor profile'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update contractor profile'
        });
      }
    }
  };

  deleteProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const deletedProfile = await prisma.contractorProfile.update({
        where: { userId },
        data: {
          deletedAt: new Date(),
          updatedBy: userId
        }
      });

      SAMALogger.logAuthEvent('PROFILE_DELETED', userId, {
        profileId: deletedProfile.id,
        compliance: 'SAMA_PROFILE_FRAMEWORK'
      });

      res.json({
        success: true,
        message: 'Contractor profile deleted successfully'
      });

    } catch (error) {
      const userId = (req as AuthenticatedRequest).user?.id;

      logger.error('Delete contractor profile error:', error);
      SAMALogger.logError('PROFILE_DELETE_ERROR', error instanceof Error ? error : new Error('Unknown error'), userId);

      if (error instanceof Error) {
        if (error.message.includes('Record to update not found')) {
          res.status(404).json({
            success: false,
            error: 'Profile not found'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Failed to delete contractor profile'
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete contractor profile'
        });
      }
    }
  };
}

export const contractorProfileController = new ContractorProfileController();