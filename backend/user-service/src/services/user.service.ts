import { PrismaClient, FlagStatus } from '../generated/prisma';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  nationalId: string | null;
  flagStatus: FlagStatus | null;
  samaCreditAmount: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SamaCreditUpdateResult {
  previousAmount: number;
  newAmount: number;
  operation: string;
}

class UserService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get user by ID with all relevant details
   * @param userId - The UUID of the user
   * @returns User data including flag status and SAMA credit amount
   */
  async getUserById(userId: string): Promise<UserData | null> {
    try {
      await this.prisma.$connect();

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          nationalId: true,
          flagStatus: true,
          samaCreditAmount: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return null;
      }

      logger.info('User fetched successfully', {
        userId: user.id,
        flagStatus: user.flagStatus,
        samaCreditAmount: user.samaCreditAmount.toString(),
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        nationalId: user.nationalId,
        flagStatus: user.flagStatus,
        samaCreditAmount: Number(user.samaCreditAmount),
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

    } catch (error: any) {
      logger.error('Get user by ID failed:', {
        error: error.message,
        userId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Update user's SAMA credit amount
   * @param userId - The UUID of the user
   * @param amount - Amount to deduct or add
   * @param operation - 'deduct' or 'add'
   * @param projectId - Project ID for tracking
   * @param reason - Reason for the credit update
   * @returns Previous and new credit amounts
   */
  async updateSamaCredit(
    userId: string,
    amount: number,
    operation: 'deduct' | 'add',
    projectId: string,
    reason: string
  ): Promise<SamaCreditUpdateResult | null> {
    try {
      await this.prisma.$connect();

      // Get current user with credit amount
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          samaCreditAmount: true,
        },
      });

      if (!user) {
        logger.warn('User not found for SAMA credit update', { userId });
        return null;
      }

      const previousAmount = Number(user.samaCreditAmount);
      let newAmount: number;

      // Calculate new amount based on operation
      if (operation === 'deduct') {
        newAmount = previousAmount - amount;

        // Prevent negative balance
        if (newAmount < 0) {
          throw new Error(
            `Insufficient SAMA credit. Current balance: ${previousAmount.toFixed(2)}, Requested deduction: ${amount.toFixed(2)}`
          );
        }
      } else {
        newAmount = previousAmount + amount;
      }

      // Update user's SAMA credit amount
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          samaCreditAmount: new Decimal(newAmount.toFixed(2)),
        },
      });

      logger.info('SAMA credit updated successfully', {
        userId,
        operation,
        amount,
        previousAmount,
        newAmount,
        projectId,
        reason,
      });

      return {
        previousAmount,
        newAmount,
        operation,
      };

    } catch (error: any) {
      logger.error('Update SAMA credit failed:', {
        error: error.message,
        userId,
        amount,
        operation,
        projectId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

export { UserService };
