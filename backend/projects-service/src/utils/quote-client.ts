import axios from 'axios';
import { logger } from './logger';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:8000';
const QUOTE_SERVICE_URL = process.env.QUOTE_SERVICE_URL || 'http://localhost:3006';

interface QuoteLineItem {
  id: string;
  quotation_id: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  units: string;
  rabhan_commission: number;
  rabhan_overprice: number;
  user_price: number;
  vendor_net_price: number;
  vat: number;
  line_order: number;
}

interface QuoteData {
  id: string;
  request_id: string;
  contractor_id: string;
  base_price: number;
  price_per_kwp: number;
  overprice_amount: number;
  total_user_price: number;
  system_specs: Record<string, any>;
  installation_timeline_days: number;
  warranty_terms: Record<string, any>;
  maintenance_terms: Record<string, any>;
  admin_status: string;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  days_until_expiry: number;
  line_items: QuoteLineItem[];
}

interface QuoteApiResponse {
  success: boolean;
  message: string;
  data: {
    quote: QuoteData;
  };
}

/**
 * Fetch quote details from the quotes service
 * @param requestId - The UUID of the quote request
 * @param contractorId - The UUID of the contractor
 * @param authToken - The authentication token to forward to the quotes service
 * @returns Quote data with pricing and system details
 */
export async function fetchQuote(
  requestId: string,
  contractorId: string,
  authToken?: string
): Promise<QuoteData> {
  try {
    logger.info('Fetching quote from quotes service', {
      requestId,
      contractorId,
    });

    const url = `${API_GATEWAY_URL}/api/quotes/request/${requestId}/contractor/${contractorId}/quote`;

    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = authToken;
    }

    const response = await axios.get<QuoteApiResponse>(url, {
      timeout: 10000, // 10 seconds timeout
      headers,
    });

    if (!response.data.success || !response.data.data?.quote) {
      throw new Error('Invalid response from quotes service');
    }

    const quote = response.data.data.quote;

    logger.info('Quote fetched successfully', {
      quoteId: quote.id,
      basePrice: quote.base_price,
      adminStatus: quote.admin_status,
      status: quote.status,
    });

    return quote;
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

      logger.error('Failed to fetch quote from quotes service', {
        requestId,
        contractorId,
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      if (axiosError.response?.status === 404) {
        throw new Error('Quote not found');
      }

      if (axiosError.code === 'ECONNREFUSED') {
        throw new Error('Quotes service is unavailable');
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error fetching quote', { error: errorMessage });
    throw new Error('Failed to fetch quote details');
  }
}

/**
 * Calculate system size from line items
 * This is a helper to estimate system size if not provided directly
 */
export function calculateSystemSize(lineItems: QuoteLineItem[]): number {
  // Look for solar panel items to calculate total kWp
  const panelItem = lineItems.find(item =>
    item.item_name.toLowerCase().includes('panel') ||
    item.item_name.toLowerCase().includes('solar')
  );

  if (panelItem && panelItem.description) {
    // Try to extract wattage from description (e.g., "450W" or "450 W")
    const wattageMatch = panelItem.description.match(/(\d+)\s*W/i);
    if (wattageMatch) {
      const wattage = parseInt(wattageMatch[1]);
      const totalWatts = wattage * panelItem.quantity;
      return totalWatts / 1000; // Convert to kWp
    }
  }

  // Default fallback
  return 0;
}
