import { Request } from 'express';

// Common API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
    pagination?: PaginationMeta;
  };
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// User context (attached to request)
export interface UserContext {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  contractorId?: string;
}

// Request context (attached to request)
export interface RequestContext {
  requestId: string;
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
  correlationId?: string;
}

// Extended Express Request with our custom properties
export interface AuthenticatedRequest extends Request {
  user?: UserContext;
  context: RequestContext;
}

// Category related types
export interface Category {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  description?: string;
  descriptionAr?: string;
  icon?: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  productsCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Product related types
export interface Product {
  id: string;
  contractorId: string;
  categoryId: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  slug: string;
  brand: string;
  model?: string;
  sku?: string;
  specifications?: Record<string, any>;
  categorySpecs?: {
    batteries?: Record<string, any>;
    fullSystems?: Record<string, any>;
    inverters?: Record<string, any>;
    solarPanels?: Record<string, any>;
  };
  price: number;
  currency: string;
  vatIncluded: boolean;
  stockQuantity: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  productImages?: ProductImage[];
  category?: Category;
}

export interface ProductImage {
  id: string;
  productId: string;
  fileName: string;
  filePath: string;
  fileUrl?: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
}

// Database query options
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

// Audit log entry
export interface AuditLogEntry {
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

// Performance metrics
export interface PerformanceMetrics {
  startTime: bigint;
  endTime?: bigint;
  duration?: number;
  operation: string;
  success: boolean;
  additionalData?: Record<string, any>;
}