import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import {
  ConflictError,
  NotFoundError,
  DatabaseError,
  ErrorFactory
} from '../utils/errors';
import {
  Category,
  QueryOptions,
  PaginationMeta
} from '../types/common';
import {
  CategoryCreate,
  CategoryUpdate,
  CategoryQuery
} from '../schemas/category.schema';

export class CategoryService {

  async createCategory(categoryData: CategoryCreate, userId: string): Promise<Category> {
    const startTime = process.hrtime.bigint();

    try {
      await this.checkSlugExists(categoryData.slug);

      const sortOrder = categoryData.sortOrder ?? await this.getNextSortOrder();

      const category = await prisma.category.create({
        data: {
          name: categoryData.name,
          nameAr: categoryData.nameAr,
          slug: categoryData.slug,
          description: categoryData.description,
          descriptionAr: categoryData.descriptionAr,
          icon: categoryData.icon,
          imageUrl: categoryData.imageUrl,
          sortOrder: sortOrder,
          isActive: categoryData.isActive ?? true,
          createdBy: userId,
          updatedBy: userId
        }
      });

      const result: Category = {
        id: category.id,
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        description: category.description,
        descriptionAr: category.descriptionAr,
        icon: category.icon,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive || true,
        productsCount: category.productsCount || 0,
        createdAt: category.createdAt || new Date(),
        updatedAt: category.updatedAt || new Date(),
        createdBy: category.createdBy,
        updatedBy: category.updatedBy
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CREATE_CATEGORY', duration, {
        categoryId: category.id,
        categoryName: categoryData.name
      });

      logger.auditDataAccess(
        userId,
        'categories',
        category.id,
        'CREATE',
        {
          categoryName: categoryData.name,
          slug: categoryData.slug,
          isActive: categoryData.isActive
        }
      );

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to create category', error, {
        categoryName: categoryData.name,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw ErrorFactory.conflict('Category', 'slug', categoryData.slug);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to create category');
    }
  }

  async getCategoryById(id: string, userId?: string): Promise<Category> {
    const startTime = process.hrtime.bigint();

    try {
      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      if (!category) {
        throw ErrorFactory.notFound('Category', id);
      }

      const result: Category = {
        id: category.id,
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        description: category.description,
        descriptionAr: category.descriptionAr,
        icon: category.icon,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive || true,
        productsCount: category._count.products,
        createdAt: category.createdAt || new Date(),
        updatedAt: category.updatedAt || new Date(),
        createdBy: category.createdBy,
        updatedBy: category.updatedBy
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('GET_CATEGORY_BY_ID', duration, {
        categoryId: id
      });

      if (userId) {
        logger.auditDataAccess(
          userId,
          'categories',
          id,
          'READ',
          {
            categoryName: category.name
          }
        );
      }

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get category by ID', error, {
        categoryId: id,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get category');
    }
  }

  async getCategoryBySlug(slug: string, userId?: string): Promise<Category> {
    const startTime = process.hrtime.bigint();

    try {
      const category = await prisma.category.findUnique({
        where: { slug },
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      if (!category) {
        throw ErrorFactory.notFound('Category', slug);
      }

      const result: Category = {
        id: category.id,
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        description: category.description,
        descriptionAr: category.descriptionAr,
        icon: category.icon,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive || true,
        productsCount: category._count.products,
        createdAt: category.createdAt || new Date(),
        updatedAt: category.updatedAt || new Date(),
        createdBy: category.createdBy,
        updatedBy: category.updatedBy
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('GET_CATEGORY_BY_SLUG', duration, {
        slug
      });

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get category by slug', error, {
        slug,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get category');
    }
  }

  async getCategories(queryOptions: CategoryQuery, userId?: string): Promise<{
    categories: Category[];
    pagination: PaginationMeta;
  }> {
    const startTime = process.hrtime.bigint();

    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        sortBy = 'sortOrder',
        sortOrder = 'asc'
      } = queryOptions;

      const skip = (page - 1) * limit;

      const where: Prisma.CategoryWhereInput = {};

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { descriptionAr: { contains: search, mode: 'insensitive' } }
        ];
      }

      const orderBy: Prisma.CategoryOrderByWithRelationInput = {};
      if (sortBy === 'name') {
        orderBy.name = sortOrder;
      } else if (sortBy === 'createdAt') {
        orderBy.createdAt = sortOrder;
      } else if (sortBy === 'productsCount') {
        orderBy.productsCount = sortOrder;
      } else {
        orderBy.sortOrder = sortOrder;
      }

      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            _count: {
              select: { products: true }
            }
          }
        }),
        prisma.category.count({ where })
      ]);

      const result = categories.map(category => ({
        id: category.id,
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        description: category.description,
        descriptionAr: category.descriptionAr,
        icon: category.icon,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive || true,
        productsCount: category._count.products,
        createdAt: category.createdAt || new Date(),
        updatedAt: category.updatedAt || new Date(),
        createdBy: category.createdBy,
        updatedBy: category.updatedBy
      }));

      const totalPages = Math.ceil(total / limit);
      const pagination: PaginationMeta = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('GET_CATEGORIES', duration, {
        resultCount: categories.length,
        page,
        limit,
        search
      });

      return { categories: result, pagination };

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get categories', error, {
        queryOptions,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get categories');
    }
  }

  async updateCategory(id: string, categoryData: CategoryUpdate, userId: string): Promise<Category> {
    const startTime = process.hrtime.bigint();

    try {
      const existingCategory = await this.getCategoryById(id);

      if (categoryData.slug && categoryData.slug !== existingCategory.slug) {
        await this.checkSlugExists(categoryData.slug);
      }

      const updateData: any = {
        ...categoryData,
        updatedBy: userId,
        updatedAt: new Date()
      };

      const category = await prisma.category.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: { products: true }
          }
        }
      });

      const result: Category = {
        id: category.id,
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        description: category.description,
        descriptionAr: category.descriptionAr,
        icon: category.icon,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive || true,
        productsCount: category._count.products,
        createdAt: category.createdAt || new Date(),
        updatedAt: category.updatedAt || new Date(),
        createdBy: category.createdBy,
        updatedBy: category.updatedBy
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('UPDATE_CATEGORY', duration, {
        categoryId: id
      });

      logger.auditBusinessOperation(
        'UPDATE_CATEGORY',
        userId,
        'categories',
        id,
        existingCategory,
        result
      );

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to update category', error, {
        categoryId: id,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw ErrorFactory.conflict('Category', 'slug', categoryData.slug);
        }
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Category', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to update category');
    }
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const existingCategory = await this.getCategoryById(id);

      const productsCount = await prisma.product.count({
        where: { categoryId: id }
      });

      if (productsCount > 0) {
        throw ErrorFactory.businessRule(
          'Cannot delete category with associated products',
          { categoryId: id, productsCount }
        );
      }

      await prisma.category.delete({
        where: { id }
      });

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('DELETE_CATEGORY', duration, {
        categoryId: id
      });

      logger.auditBusinessOperation(
        'DELETE_CATEGORY',
        userId,
        'categories',
        id,
        existingCategory,
        null
      );

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to delete category', error, {
        categoryId: id,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Category', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to delete category');
    }
  }

  private async checkSlugExists(slug: string): Promise<void> {
    const existingCategory = await prisma.category.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (existingCategory) {
      throw ErrorFactory.conflict('Category', 'slug', slug);
    }
  }

  private async getNextSortOrder(): Promise<number> {
    const lastCategory = await prisma.category.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    });

    return (lastCategory?.sortOrder || 0) + 1;
  }
}

export const categoryService = new CategoryService();