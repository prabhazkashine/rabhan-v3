import axios from 'axios';
import { logger } from './logger';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3009';

interface ProcessDownpaymentRequest {
  amount: number;
}

interface PayInstallmentRequest {
  installment_id: string;
  amount: number;
}

interface ReleasePaymentRequest {
  amount: number;
  payment_reference?: string;
  notes?: string;
  contractor_bank_name?: string;
  contractor_iban?: string;
  contractor_account_holder?: string;
}

/**
 * Call Payment Service to process downpayment
 */
export async function processDownpaymentViaPaymentService(
  projectId: string,
  userId: string,
  data: ProcessDownpaymentRequest,
  authToken?: string
): Promise<any> {
  try {
    const headers: Record<string, string> = {
      'x-user-id': userId,
      'x-user-role': 'user',
    };

    if (authToken) {
      headers['Authorization'] = authToken;
    }

    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/${projectId}/pay-downpayment`,
      data,
      {
        headers,
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to process downpayment via payment service', {
      projectId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Call Payment Service to pay installment
 */
export async function payInstallmentViaPaymentService(
  projectId: string,
  userId: string,
  data: PayInstallmentRequest,
  authToken?: string
): Promise<any> {
  try {
    const headers: Record<string, string> = {
      'x-user-id': userId,
      'x-user-role': 'user',
    };

    if (authToken) {
      headers['Authorization'] = authToken;
    }

    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/${projectId}/pay-installment`,
      data,
      {
        headers,
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to pay installment via payment service', {
      projectId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Call Payment Service to release payment to contractor
 */
export async function releasePaymentViaPaymentService(
  projectId: string,
  adminId: string,
  data: ReleasePaymentRequest,
  authToken?: string
): Promise<any> {
  try {
    const headers: Record<string, string> = {
      'x-user-id': adminId,
      'x-user-role': 'admin',
    };

    if (authToken) {
      headers['Authorization'] = authToken;
    }

    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/${projectId}/release-payment`,
      data,
      {
        headers,
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to release payment via payment service', {
      projectId,
      adminId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Call Payment Service to get installment schedule
 */
export async function getInstallmentScheduleViaPaymentService(
  projectId: string,
  userId: string,
  authToken?: string
): Promise<any> {
  try {
    const headers: Record<string, string> = {
      'x-user-id': userId,
      'x-user-role': 'user',
    };

    if (authToken) {
      headers['Authorization'] = authToken;
    }

    const response = await axios.get(
      `${PAYMENT_SERVICE_URL}/api/payments/${projectId}/installments`,
      {
        headers,
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to get installment schedule via payment service', {
      projectId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Call Payment Service to get payment details with installments
 * Returns null if payment doesn't exist (graceful handling)
 */
export async function getPaymentDetailsViaPaymentService(
  projectId: string,
  userId: string,
  userRole: string
): Promise<any> {
  try {
    const headers: Record<string, string> = {
      'x-user-id': userId,
      'x-user-role': userRole,
    };

    logger.info('Fetching payment details from payment service', {
      projectId,
      userId,
      userRole,
      url: `${PAYMENT_SERVICE_URL}/api/payments/${projectId}/details`,
    });

    // Get full payment details from payment service
    const response = await axios.get<{ success: boolean; data: any }>(
      `${PAYMENT_SERVICE_URL}/api/payments/${projectId}/details`,
      {
        headers,
        timeout: 10000,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      }
    );

    logger.info('Payment service response', {
      projectId,
      status: response.status,
      success: response.data?.success,
      hasData: !!response.data?.data,
    });

    // If payment doesn't exist yet, return null
    if (response.status === 404 || !response.data.success || !response.data.data) {
      logger.info('No payment found for project', {
        projectId,
        status: response.status,
        responseSuccess: response.data?.success,
      });
      return null;
    }

    return response.data.data;
  } catch (error) {
    // Log error but return null to allow project to be fetched without payment data
    logger.error('Failed to get payment details from payment service', {
      projectId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
