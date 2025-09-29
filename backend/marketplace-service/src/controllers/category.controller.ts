import { Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';
import {
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CategoryQuerySchema,
  CategoryParamsSchema
} from '../schemas/category.schema';
import { AuthenticatedRequest, ApiResponse, Category } from '../types/common';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

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

export class CategoryController {

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const validatedData = CategoryCreateSchema.parse(req.body);

      const userId = validateUserId(req);

      const category = await categoryService.createCategory(validatedData, userId);

      const response: ApiResponse<Category> = {
        success: true,
        data: category,
        message: 'Category created successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CATEGORY_CREATE_ENDPOINT', duration, {
        categoryId: category.id,
        userId,
        success: true
      });

      res.status(201).json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Category creation failed in controller', error, {
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      // Validate params
      const { id } = CategoryParamsSchema.parse(req.params);

      // Get category
      const category = await categoryService.getCategoryById(id, (req as AuthenticatedRequest).user?.id);

      const response: ApiResponse<Category> = {
        success: true,
        data: category,
        message: 'Category retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      // Performance monitoring
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CATEGORY_GET_BY_ID_ENDPOINT', duration, {
        categoryId: id,
        userId: (req as AuthenticatedRequest).user?.id,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get category by ID failed in controller', error, {
        categoryId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      // Validate params
      const slug = req.params.slug;
      if (!slug || typeof slug !== 'string') {
        throw new ValidationError('Invalid slug parameter');
      }

      // Get category
      const category = await categoryService.getCategoryBySlug(slug, (req as AuthenticatedRequest).user?.id);

      const response: ApiResponse<Category> = {
        success: true,
        data: category,
        message: 'Category retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      // Performance monitoring
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CATEGORY_GET_BY_SLUG_ENDPOINT', duration, {
        slug,
        userId: (req as AuthenticatedRequest).user?.id,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get category by slug failed in controller', error, {
        slug: req.params.slug,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      // Validate query parameters
      const queryOptions = CategoryQuerySchema.parse(req.query);

      // Get categories
      const result = await categoryService.getCategories(queryOptions, (req as AuthenticatedRequest).user?.id);

      const response: ApiResponse<Category[]> = {
        success: true,
        data: result.categories,
        message: 'Categories retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0',
          pagination: result.pagination
        }
      };

      // Performance monitoring
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CATEGORY_GET_LIST_ENDPOINT', duration, {
        resultCount: result.categories.length,
        page: queryOptions.page,
        limit: queryOptions.limit,
        userId: (req as AuthenticatedRequest).user?.id,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get categories failed in controller', error, {
        query: req.query,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const { id } = CategoryParamsSchema.parse(req.params);
      const validatedData = CategoryUpdateSchema.parse(req.body);

      const userId = validateUserId(req);

      const category = await categoryService.updateCategory(id, validatedData, userId);

      const response: ApiResponse<Category> = {
        success: true,
        data: category,
        message: 'Category updated successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CATEGORY_UPDATE_ENDPOINT', duration, {
        categoryId: id,
        userId,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Category update failed in controller', error, {
        categoryId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const { id } = CategoryParamsSchema.parse(req.params);

      const userId = validateUserId(req);

      await categoryService.deleteCategory(id, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Category deleted successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
          version: '1.0.0'
        }
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CATEGORY_DELETE_ENDPOINT', duration, {
        categoryId: id,
        userId,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Category deletion failed in controller', error, {
        categoryId: req.params.id,
        userId: (req as AuthenticatedRequest).user?.id,
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        performanceMetrics: { duration }
      });
      next(error);
    }
  }

  async getCategoriesPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const queryOptions = CategoryQuerySchema.parse({
        ...req.query,
        isActive: 'true'
      });

      const result = await categoryService.getCategories(queryOptions);

      const response: ApiResponse<Category[]> = {
        success: true,
        data: result.categories,
        message: 'Categories retrieved successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0',
          pagination: result.pagination
        }
      };

      // Performance monitoring
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CATEGORY_GET_PUBLIC_ENDPOINT', duration, {
        resultCount: result.categories.length,
        page: queryOptions.page,
        limit: queryOptions.limit,
        success: true
      });

      res.json(response);

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Get public categories failed in controller', error, {
        query: req.query,
        requestId: req.headers['x-request-id'],
        performanceMetrics: { duration }
      });
      next(error);
    }
  }
}

// Export singleton instance
export const categoryController = new CategoryController();