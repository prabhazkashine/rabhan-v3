import axios from 'axios';
import { logger } from './logger';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

export enum FlagStatus {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  nationalId?: string;
  flagStatus?: FlagStatus;
  samaCreditAmount: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserApiResponse {
  success: boolean;
  message?: string;
  data?: UserData;
}

interface UpdateCreditRequest {
  amount: number;
  operation: 'deduct' | 'add';
  projectId: string;
  reason: string;
}

interface UpdateCreditResponse {
  success: boolean;
  message: string;
  data: {
    previousAmount: number;
    newAmount: number;
    operation: string;
  };
}

/**
 * Fetch user details from the user service
 * @param userId - The UUID of the user
 * @param authToken - Optional authentication token to forward to the user service
 * @returns User data including flag status and SAMA credit amount
 */
export async function fetchUser(
  userId: string,
  authToken?: string
): Promise<UserData> {
  try {
    logger.info('Fetching user from user service', {
      userId,
    });

    const url = `${USER_SERVICE_URL}/api/users/${userId}`;

    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    const response = await axios.get<UserApiResponse>(url, {
      timeout: 10000, // 10 seconds timeout
      headers,
    });

    if (!response.data.success || !response.data.data) {
      throw new Error('Invalid response from user service');
    }

    const user = response.data.data;

    logger.info('User fetched successfully', {
      userId: user.id,
      flagStatus: user.flagStatus,
      samaCreditAmount: user.samaCreditAmount,
    });

    return user;
  } catch (error: unknown) {
    // Check if it's an axios error
    if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
      const axiosError = error as unknown as {
        message: string;
        response?: {
          status: number;
          data: unknown;
        };
        code?: string;
      };

      logger.error('Failed to fetch user from user service', {
        userId,
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      if (axiosError.response?.status === 404) {
        throw new Error('User not found');
      }

      if (axiosError.code === 'ECONNREFUSED') {
        throw new Error('User service is unavailable');
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error fetching user', { error: errorMessage });
    throw new Error('Failed to fetch user details');
  }
}

/**
 * Update user's SAMA credit amount
 * @param userId - The UUID of the user
 * @param amount - Amount to deduct or add
 * @param operation - 'deduct' or 'add'
 * @param projectId - Project ID for tracking
 * @param reason - Reason for the credit update
 * @param authToken - Optional authentication token
 */
export async function updateUserSamaCredit(
  userId: string,
  amount: number,
  operation: 'deduct' | 'add',
  projectId: string,
  reason: string,
  authToken?: string
): Promise<UpdateCreditResponse> {
  try {
    logger.info('Updating user SAMA credit', {
      userId,
      amount,
      operation,
      projectId,
    });

    const url = `${USER_SERVICE_URL}/api/users/${userId}/sama-credit`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    const payload: UpdateCreditRequest = {
      amount,
      operation,
      projectId,
      reason,
    };

    const response = await axios.patch<UpdateCreditResponse>(url, payload, {
      timeout: 10000,
      headers,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to update SAMA credit');
    }

    logger.info('User SAMA credit updated successfully', {
      userId,
      previousAmount: response.data.data.previousAmount,
      newAmount: response.data.data.newAmount,
      operation,
    });

    return response.data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
      const axiosError = error as unknown as {
        message: string;
        response?: {
          status: number;
          data: unknown;
        };
        code?: string;
      };

      logger.error('Failed to update user SAMA credit', {
        userId,
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      if (axiosError.response?.status === 404) {
        throw new Error('User not found');
      }

      if (axiosError.response?.status === 400) {
        const errorData = axiosError.response.data as any;
        throw new Error(errorData?.message || 'Invalid request');
      }

      if (axiosError.code === 'ECONNREFUSED') {
        throw new Error('User service is unavailable');
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error updating user SAMA credit', { error: errorMessage });
    throw new Error('Failed to update SAMA credit');
  }
}

/**
 * Check if user is eligible for BNPL based on flag status
 * @param flagStatus - User's flag status
 * @returns true if user can use BNPL
 */
export function isEligibleForBNPL(flagStatus?: FlagStatus): boolean {
  // Only GREEN flag users can use BNPL
  // RED flag users must use single payment only
  return flagStatus === FlagStatus.GREEN;
}

/**
 * Check if user has sufficient SAMA credit for the project
 * @param samaCreditAmount - User's available SAMA credit
 * @param projectAmount - Total project amount
 * @param downpaymentAmount - Downpayment amount (if any)
 * @returns Object with eligibility and required downpayment
 */
export function checkSamaCreditEligibility(
  samaCreditAmount: number,
  projectAmount: number,
  downpaymentAmount: number = 0
): {
  isEligible: boolean;
  reason?: string;
  requiredDownpayment?: number;
} {
  // If SAMA credit covers full project amount
  if (samaCreditAmount >= projectAmount) {
    return {
      isEligible: true,
    };
  }

  // If user has zero SAMA credit, they cannot use BNPL at all
  if (samaCreditAmount === 0) {
    return {
      isEligible: false,
      reason: `You have no SAMA credit available. BNPL is not available for this purchase. Please choose the single payment option to proceed with your project.`,
      requiredDownpayment: 0,
    };
  }

  // If user has some credit but not enough, they need to cover the difference with downpayment
  const shortfall = projectAmount - samaCreditAmount;

  if (downpaymentAmount >= shortfall) {
    return {
      isEligible: true,
    };
  }

  return {
    isEligible: false,
    reason: `Insufficient SAMA credit. You have ${samaCreditAmount} SAR but the project costs ${projectAmount} SAR. You need to provide a downpayment of at least ${shortfall} SAR to use BNPL, or choose the single payment option.`,
    requiredDownpayment: shortfall,
  };
}
