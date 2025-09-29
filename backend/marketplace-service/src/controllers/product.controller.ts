import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductQuerySchema,
  ProductParamsSchema,
  ProductApprovalSchema
} from '../schemas/product.schema';
import { AuthenticatedRequest, ApiResponse, Product } from '../types/common';
import { ValidationError, ErrorFactory } from '../utils/errors';
import logger from '../utils/logger';
import { prisma } from '../utils/database';
import { generateFileUrl } from '../utils/upload';

function validateUserId(req: Request): string {
  const userId = req.headers['x-user-id'] as string;

  if (!userId || userId === 'undefined' || userId === 'null') {
    throw new ValidationError('User authentication required - valid x-user-id header missing');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new ValidationError('Invalid user ID format - must be a valid UUID');
  }

  return userId;
}

export class ProductController {

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      logger.debug('Product creation request received', {
        body: req.body,
        headers: req.headers['content-type'],
        method: req.method,
        url: req.url
      });

      const validatedData = ProductCreateSchema.parse(req.body);
      const userId = validateUserId(req);

      // Handle uploaded images
      const uploadedFiles = req.files as Express.Multer.File[];
      const imageData = uploadedFiles ? uploadedFiles.map((file, index) => ({
        fileName: file.filename,
        filePath: file.path,
        fileUrl: generateFileUrl(req, file.filename),
        sortOrder: index,
        isPrimary: index === 0 // First image is primary
      })) : [];

      // Add images to validated data
      const productDataWithImages = {
        ...validatedData,
        images: imageData
      };

      const product = await productService.createProduct(productDataWithImages, userId);

      const response: ApiResponse<Product> = {
        success: true,
        data: product,
        message: 'Product created successfully and is pending approval',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_CREATE_ENDPOINT', duration, {
        productId: product.id,
        userId,
        success: true
      });

      res.status(201).json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Product creation failed in controller', error, {
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const { id } = ProductParamsSchema.parse(req.params);

      const userContractorId = validateUserId(req);

      const product = await productService.getProductById(id, userContractorId);

      const response: ApiResponse<Product> = {
        success: true,
        data: product,
        message: 'Product retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_GET_BY_ID_ENDPOINT', duration, {
        productId: id,
        userId: (req as AuthenticatedRequest).user?.id,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get product by ID failed in controller', error, {
        productId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const queryOptions = ProductQuerySchema.parse(req.query);

      const userContractorId = validateUserId(req);
      const userRole = req.headers['x-user-role'] as string;

      if (userRole === 'contractor' && userContractorId) {
        queryOptions.contractorId = userContractorId;
      }

      const result = await productService.getProducts(queryOptions, userContractorId);

      const response: ApiResponse<Product[]> = {
        success: true,
        data: result.products,
        message: 'Products retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0',
          pagination: result.pagination
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_GET_LIST_ENDPOINT', duration, {
        resultCount: result.products.length,
        page: queryOptions.page,
        limit: queryOptions.limit,
        userId: (req as AuthenticatedRequest).user?.id,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get products failed in controller', error, {
        query: req.query,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const { id } = ProductParamsSchema.parse(req.params);
      const validatedData = ProductUpdateSchema.parse(req.body);
      const userId = validateUserId(req);

      const existingProduct = await productService.getProductById(id);

      if (existingProduct.contractorId !== userId) {
        throw new ValidationError('You can only update your own products');
      }

      // Handle uploaded images
      const uploadedFiles = req.files as Express.Multer.File[];
      const newImageData = uploadedFiles ? uploadedFiles.map((file, index) => ({
        fileName: file.filename,
        filePath: file.path,
        fileUrl: generateFileUrl(req, file.filename),
        sortOrder: index,
        isPrimary: index === 0,
        action: 'add' as const
      })) : [];

      // Add new images to validated data
      const productDataWithImages = {
        ...validatedData,
        images: newImageData.length > 0 ? newImageData : undefined
      };

      const product = await productService.updateProduct(id, productDataWithImages, userId);

      const response: ApiResponse<Product> = {
        success: true,
        data: product,
        message: 'Product updated successfully and is pending approval',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_UPDATE_ENDPOINT', duration, {
        productId: id,
        userId,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Product update failed in controller', error, {
        productId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async hardDeleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const { id } = ProductParamsSchema.parse(req.params);

      const userId = validateUserId(req);

      await productService.hardDeleteProduct(id, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Product permanently deleted successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_HARD_DELETE_ENDPOINT', duration, {
        productId: id,
        userId,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Product hard deletion failed in controller', error, {
        productId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const { id } = ProductParamsSchema.parse(req.params);

      const userId = validateUserId(req);

      const existingProduct = await productService.getProductById(id);

      if (existingProduct.contractorId !== userId) {
        throw new ValidationError('You can only delete your own products');
      }

      await productService.deleteProduct(id, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Product deleted successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_DELETE_ENDPOINT', duration, {
        productId: id,
        userId,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Product deletion failed in controller', error, {
        productId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async approveProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const { id } = ProductParamsSchema.parse(req.params);
      const validatedData = ProductApprovalSchema.parse(req.body);

      const userId = validateUserId(req);
      const userRole = req.headers['x-user-role'] as string;

      if (!['admin', 'super_admin'].includes(userRole || '')) {
        throw new ValidationError('Only administrators can approve or reject products');
      }

      const product = await productService.approveProduct(id, validatedData, userId);

      const response: ApiResponse<Product> = {
        success: true,
        data: product,
        message: `Product ${validatedData.action}d successfully`,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_APPROVAL_ENDPOINT', duration, {
        productId: id,
        action: validatedData.action,
        userId,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Product approval failed in controller', error, {
        productId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getProductsPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const queryOptions = ProductQuerySchema.parse({
        ...req.query,
        status: 'ACTIVE' 
      });

      const result = await productService.getProducts(queryOptions);

      const response: ApiResponse<Product[]> = {
        success: true,
        data: result.products,
        message: 'Products retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0',
          pagination: result.pagination
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_GET_PUBLIC_ENDPOINT', duration, {
        resultCount: result.products.length,
        page: queryOptions.page,
        limit: queryOptions.limit,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get public products failed in controller', error, {
        query: req.query,
        requestId: req.headers['x-request-id'],
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getProductBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const slug = req.params.slug;
      if (!slug || typeof slug !== 'string') {
        throw new ValidationError('Invalid slug parameter');
      }

      const userContractorId = validateUserId(req);

      const product = await productService.getProductBySlug(slug, userContractorId);

      const response: ApiResponse<Product> = {
        success: true,
        data: product,
        message: 'Product retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_GET_BY_SLUG_ENDPOINT', duration, {
        slug,
        userId: (req as AuthenticatedRequest).user?.id,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get product by slug failed in controller', error, {
        slug: req.params.slug,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getPendingProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      // Validate user role
      const userRole = (req as AuthenticatedRequest).user?.role;
      if (!['admin', 'super_admin'].includes(userRole || '')) {
        throw new ValidationError('Only administrators can view pending products');
      }

      // Validate query parameters and force pending status
      const queryOptions = ProductQuerySchema.parse({
        ...req.query,
        status: 'PENDING'
      });

      // Get pending products
      const result = await productService.getProducts(queryOptions, (req as AuthenticatedRequest).user?.id);

      const response: ApiResponse<Product[]> = {
        success: true,
        data: result.products,
        message: 'Pending products retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0',
          pagination: result.pagination
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_GET_PENDING_ENDPOINT', duration, {
        resultCount: result.products.length,
        page: queryOptions.page,
        limit: queryOptions.limit,
        userId: (req as AuthenticatedRequest).user?.id,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get pending products failed in controller', error, {
        query: req.query,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getProductStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const userId = validateUserId(req);
      const userRole = req.headers['x-user-role'] as string;

      const stats = await productService.getProductStats(userId, userRole);

      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
        message: 'Product statistics retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PRODUCT_STATS_ENDPOINT', duration, {
        userId,
        userRole,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get product stats failed in controller', error, {
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getPendingProductStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const userId = validateUserId(req);
      const userRole = req.headers['x-user-role'] as string;

      // Get pending product statistics
      const pendingStats = await productService.getPendingProductStats(userId, userRole);

      const response: ApiResponse<typeof pendingStats> = {
        success: true,
        data: pendingStats,
        message: 'Pending product statistics retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('PENDING_PRODUCT_STATS_ENDPOINT', duration, {
        userId,
        userRole,
        totalPending: pendingStats.totalPending,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get pending product stats failed in controller', error, {
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }
}

// Export singleton instance
export const productController = new ProductController();