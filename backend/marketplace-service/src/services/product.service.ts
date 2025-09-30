import { Prisma } from '../generated/prisma';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import {
  ConflictError,
  NotFoundError,
  DatabaseError,
  ErrorFactory,
  ValidationError,
  BusinessRuleError
} from '../utils/errors';
import {
  Product,
  ProductImage,
  QueryOptions,
  PaginationMeta
} from '../types/common';
import {
  ProductCreate,
  ProductUpdate,
  ProductQuery,
  ProductApproval
} from '../schemas/product.schema';

export class ProductService {

  async createProduct(productData: ProductCreate, userId: string): Promise<Product> {
    const startTime = process.hrtime.bigint();

    try {
      await this.checkSlugExists(productData.slug);

      if (productData.sku) {
        await this.checkSkuExists(productData.sku);
      }

      await this.validateCategoryExists(productData.categoryId);

      const stockStatus = this.calculateStockStatus(productData.stockQuantity);

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            contractorId: userId,
            categoryId: productData.categoryId,
            contractorName: productData.contractorName,
            name: productData.name,
            nameAr: productData.nameAr,
            description: productData.description,
            descriptionAr: productData.descriptionAr,
            slug: productData.slug,
            brand: productData.brand,
            model: productData.model,
            sku: productData.sku,
            specifications: productData.specifications,
            categorySpecs: productData.categorySpecs,
            price: productData.price,
            currency: productData.currency,
            vatIncluded: productData.vatIncluded,
            stockQuantity: productData.stockQuantity,
            stockStatus: stockStatus,
            status: 'PENDING', // Always start as pending
            createdBy: userId,
            updatedBy: userId
          }
        });

        if (productData.images && productData.images.length > 0) {
          await tx.productImage.createMany({
            data: productData.images.map((image, index) => ({
              productId: product.id,
              fileName: image.fileName,
              filePath: image.filePath,
              fileUrl: image.fileUrl,
              sortOrder: image.sortOrder || index,
              isPrimary: image.isPrimary || index === 0 // First image is primary by default
            }))
          });
        }

        return product;
      });

      const createdProduct = await this.getProductById(result.id, userId);

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('CREATE_PRODUCT', duration, {
        productId: result.id,
        contractorId: userId
      });

      logger.auditDataAccess(
        userId,
        'products',
        result.id,
        'CREATE',
        {
          productName: productData.name,
          price: productData.price,
          categoryId: productData.categoryId,
          status: 'PENDING'
        }
      );

      return createdProduct;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to create product', error, {
        contractorId: userId,
        productName: productData.name,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = error.meta?.target as string[];
          if (field?.includes('slug')) {
            throw ErrorFactory.conflict('Product', 'slug', productData.slug);
          }
          if (field?.includes('sku')) {
            throw ErrorFactory.conflict('Product', 'sku', productData.sku);
          }
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to create product');
    }
  }

  async getProductBySlug(slug: string, userId?: string, includeDeleted = false): Promise<Product> {
    const startTime = process.hrtime.bigint();

    try {
      const whereCondition: Prisma.ProductWhereInput = { slug };
      if (!includeDeleted) {
        whereCondition.status = { not: 'DELETED' };
      }

      const product = await prisma.product.findFirst({
        where: whereCondition,
        include: {
          category: true,
          productImages: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      if (!product) {
        throw ErrorFactory.notFound('Product', slug);
      }

      const result: Product = {
        id: product.id,
        contractorId: product.contractorId,
        categoryId: product.categoryId,
        name: product.name,
        nameAr: product.nameAr,
        description: product.description,
        descriptionAr: product.descriptionAr,
        slug: product.slug,
        brand: product.brand,
        model: product.model,
        sku: product.sku,
        specifications: product.specifications as Record<string, any>,
        categorySpecs: product.categorySpecs as any,
        price: Number(product.price),
        currency: product.currency || 'SAR',
        vatIncluded: product.vatIncluded || true,
        stockQuantity: product.stockQuantity,
        stockStatus: product.stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
        status: product.status as 'PENDING' | 'ACTIVE' | 'INACTIVE',
        createdAt: product.createdAt || new Date(),
        updatedAt: product.updatedAt || new Date(),
        createdBy: product.createdBy,
        updatedBy: product.updatedBy,
        productImages: product.productImages.map(img => ({
          id: img.id,
          productId: img.productId,
          fileName: img.fileName,
          filePath: img.filePath,
          fileUrl: img.fileUrl,
          sortOrder: img.sortOrder || 0,
          isPrimary: img.isPrimary || false,
          createdAt: img.createdAt || new Date()
        })),
        category: product.category ? {
          id: product.category.id,
          name: product.category.name,
          nameAr: product.category.nameAr,
          slug: product.category.slug,
          description: product.category.description,
          descriptionAr: product.category.descriptionAr,
          icon: product.category.icon,
          imageUrl: product.category.imageUrl,
          sortOrder: product.category.sortOrder || 0,
          isActive: product.category.isActive || true,
          productsCount: product.category.productsCount || 0,
          createdAt: product.category.createdAt || new Date(),
          updatedAt: product.category.updatedAt || new Date(),
          createdBy: product.category.createdBy,
          updatedBy: product.category.updatedBy
        } : undefined
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('GET_PRODUCT_BY_SLUG', duration, {
        slug
      });

      if (userId) {
        logger.auditDataAccess(
          userId,
          'products',
          product.id,
          'READ',
          {
            productName: product.name,
            slug
          }
        );
      }

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get product by slug', error, {
        slug,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get product');
    }
  }

  async getProductById(id: string, userId?: string, includeDeleted = false): Promise<Product> {
    const startTime = process.hrtime.bigint();

    try {
      const whereCondition: Prisma.ProductWhereInput = { id };
      if (!includeDeleted) {
        whereCondition.status = { not: 'DELETED' };
      }

      const product = await prisma.product.findFirst({
        where: whereCondition,
        include: {
          category: true,
          productImages: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      if (!product) {
        throw ErrorFactory.notFound('Product', id);
      }

      const result: Product = {
        id: product.id,
        contractorId: product.contractorId,
        categoryId: product.categoryId,
        name: product.name,
        nameAr: product.nameAr,
        description: product.description,
        descriptionAr: product.descriptionAr,
        slug: product.slug,
        brand: product.brand,
        model: product.model,
        sku: product.sku,
        specifications: product.specifications as Record<string, any>,
        categorySpecs: product.categorySpecs as any,
        price: Number(product.price),
        currency: product.currency || 'SAR',
        vatIncluded: product.vatIncluded || true,
        stockQuantity: product.stockQuantity,
        stockStatus: product.stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
        status: product.status as 'PENDING' | 'ACTIVE' | 'INACTIVE',
        createdAt: product.createdAt || new Date(),
        updatedAt: product.updatedAt || new Date(),
        createdBy: product.createdBy,
        updatedBy: product.updatedBy,
        productImages: product.productImages.map(img => ({
          id: img.id,
          productId: img.productId,
          fileName: img.fileName,
          filePath: img.filePath,
          fileUrl: img.fileUrl,
          sortOrder: img.sortOrder || 0,
          isPrimary: img.isPrimary || false,
          createdAt: img.createdAt || new Date()
        })),
        category: product.category ? {
          id: product.category.id,
          name: product.category.name,
          nameAr: product.category.nameAr,
          slug: product.category.slug,
          description: product.category.description,
          descriptionAr: product.category.descriptionAr,
          icon: product.category.icon,
          imageUrl: product.category.imageUrl,
          sortOrder: product.category.sortOrder || 0,
          isActive: product.category.isActive || true,
          productsCount: product.category.productsCount || 0,
          createdAt: product.category.createdAt || new Date(),
          updatedAt: product.category.updatedAt || new Date(),
          createdBy: product.category.createdBy,
          updatedBy: product.category.updatedBy
        } : undefined
      };

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('GET_PRODUCT_BY_ID', duration, {
        productId: id
      });

      if (userId) {
        logger.auditDataAccess(
          userId,
          'products',
          id,
          'READ',
          {
            productName: product.name
          }
        );
      }

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get product by ID', error, {
        productId: id,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get product');
    }
  }

  async getProducts(queryOptions: ProductQuery, userId?: string): Promise<{
    products: Product[];
    pagination: PaginationMeta;
  }> {
    const startTime = process.hrtime.bigint();

    try {
      const {
        page = 1,
        limit = 10,
        search,
        categoryId,
        contractorId,
        status,
        stockStatus,
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = queryOptions;

      const skip = (page - 1) * limit;

      const where: Prisma.ProductWhereInput = {};

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (contractorId) {
        where.contractorId = contractorId;
      }

      if (status) {
        where.status = status;
      } else {
        where.status = { not: 'DELETED' };
      }

      if (stockStatus) {
        where.stockStatus = stockStatus;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined) {
          where.price.gte = minPrice;
        }
        if (maxPrice !== undefined) {
          where.price.lte = maxPrice;
        }
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { descriptionAr: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } }
        ];
      }

      const orderBy: Prisma.ProductOrderByWithRelationInput = {};
      if (sortBy === 'name') {
        orderBy.name = sortOrder;
      } else if (sortBy === 'price') {
        orderBy.price = sortOrder;
      } else if (sortBy === 'stockQuantity') {
        orderBy.stockQuantity = sortOrder;
      } else if (sortBy === 'brand') {
        orderBy.brand = sortOrder;
      } else {
        orderBy.createdAt = sortOrder;
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            category: true,
            productImages: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }),
        prisma.product.count({ where })
      ]);

      const result = products.map(product => ({
        id: product.id,
        contractorId: product.contractorId,
        contractorName: product.contractorName,
        categoryId: product.categoryId,
        name: product.name,
        nameAr: product.nameAr,
        description: product.description,
        descriptionAr: product.descriptionAr,
        slug: product.slug,
        brand: product.brand,
        model: product.model,
        sku: product.sku,
        specifications: product.specifications as Record<string, any>,
        categorySpecs: product.categorySpecs as any,
        price: Number(product.price),
        currency: product.currency || 'SAR',
        vatIncluded: product.vatIncluded || true,
        stockQuantity: product.stockQuantity,
        stockStatus: product.stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
        status: product.status as 'PENDING' | 'ACTIVE' | 'INACTIVE',
        createdAt: product.createdAt || new Date(),
        updatedAt: product.updatedAt || new Date(),
        createdBy: product.createdBy,
        updatedBy: product.updatedBy,
        productImages: product.productImages.map(img => ({
          id: img.id,
          productId: img.productId,
          fileName: img.fileName,
          filePath: img.filePath,
          fileUrl: img.fileUrl,
          sortOrder: img.sortOrder || 0,
          isPrimary: img.isPrimary || false,
          createdAt: img.createdAt || new Date()
        })),
        category: product.category ? {
          id: product.category.id,
          name: product.category.name,
          nameAr: product.category.nameAr,
          slug: product.category.slug,
          description: product.category.description,
          descriptionAr: product.category.descriptionAr,
          icon: product.category.icon,
          imageUrl: product.category.imageUrl,
          sortOrder: product.category.sortOrder || 0,
          isActive: product.category.isActive || true,
          productsCount: product.category.productsCount || 0,
          createdAt: product.category.createdAt || new Date(),
          updatedAt: product.category.updatedAt || new Date(),
          createdBy: product.category.createdBy,
          updatedBy: product.category.updatedBy
        } : undefined
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
      logger.auditPerformance('GET_PRODUCTS', duration, {
        resultCount: products.length,
        page,
        limit,
        search
      });

      return { products: result, pagination };

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get products', error, {
        queryOptions,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get products');
    }
  }

  async updateProduct(id: string, productData: ProductUpdate, userId: string): Promise<Product> {
    const startTime = process.hrtime.bigint();

    try {
      const existingProduct = await this.getProductById(id);

      if (productData.slug && productData.slug !== existingProduct.slug) {
        await this.checkSlugExists(productData.slug);
      }

      if (productData.sku && productData.sku !== existingProduct.sku) {
        await this.checkSkuExists(productData.sku);
      }

      if (productData.categoryId && productData.categoryId !== existingProduct.categoryId) {
        await this.validateCategoryExists(productData.categoryId);
      }

      const stockStatus = productData.stockQuantity !== undefined
        ? this.calculateStockStatus(productData.stockQuantity)
        : undefined;

      const result = await prisma.$transaction(async (tx) => {
        // Exclude images from product update data
        const { images, ...productUpdateData } = productData;

        const updateData: any = {
          ...productUpdateData,
          stockStatus,
          status: 'PENDING',
          updatedBy: userId,
          updatedAt: new Date()
        };

        const product = await tx.product.update({
          where: { id },
          data: updateData
        });

        if (images) {
          const imagesToDelete = images.filter(img => img.action === 'delete' && img.id);
          if (imagesToDelete.length > 0) {
            await tx.productImage.deleteMany({
              where: {
                id: { in: imagesToDelete.map(img => img.id!).filter(Boolean) }
              }
            });
          }

          const imagesToAdd = images.filter(img => img.action === 'add' || !img.action);
          if (imagesToAdd.length > 0) {
            await tx.productImage.createMany({
              data: imagesToAdd.map((image, index) => ({
                productId: id,
                fileName: image.fileName,
                filePath: image.filePath,
                fileUrl: image.fileUrl,
                sortOrder: image.sortOrder || index,
                isPrimary: image.isPrimary || false
              }))
            });
          }
        }

        return product;
      });

      const updatedProduct = await this.getProductById(id, userId);

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('UPDATE_PRODUCT', duration, {
        productId: id
      });

      logger.auditBusinessOperation(
        'UPDATE_PRODUCT',
        userId,
        'products',
        id,
        existingProduct,
        updatedProduct
      );

      return updatedProduct;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to update product', error, {
        productId: id,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = error.meta?.target as string[];
          if (field?.includes('slug')) {
            throw ErrorFactory.conflict('Product', 'slug', productData.slug);
          }
          if (field?.includes('sku')) {
            throw ErrorFactory.conflict('Product', 'sku', productData.sku);
          }
        }
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Product', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to update product');
    }
  }

  async deleteProduct(id: string, userId: string): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const existingProduct = await this.getProductById(id);

      await prisma.product.update({
        where: { id },
        data: {
          status: 'DELETED',
          updatedBy: userId,
          updatedAt: new Date()
        }
      });

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('SOFT_DELETE_PRODUCT', duration, {
        productId: id
      });

      logger.auditBusinessOperation(
        'SOFT_DELETE_PRODUCT',
        userId,
        'products',
        id,
        existingProduct,
        { status: 'DELETED' }
      );

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to soft delete product', error, {
        productId: id,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Product', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to soft delete product');
    }
  }

  async hardDeleteProduct(id: string, userId: string): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const existingProduct = await this.getProductById(id);

      // Hard delete: Remove from database completely
      await prisma.$transaction(async (tx) => {
        await tx.productImage.deleteMany({
          where: { productId: id }
        });

        await tx.product.delete({
          where: { id }
        });
      });

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('HARD_DELETE_PRODUCT', duration, {
        productId: id
      });

      logger.auditBusinessOperation(
        'HARD_DELETE_PRODUCT',
        userId,
        'products',
        id,
        existingProduct,
        null
      );

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to hard delete product', error, {
        productId: id,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Product', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to hard delete product');
    }
  }

  async approveProduct(id: string, approvalData: ProductApproval, userId: string): Promise<Product> {
    const startTime = process.hrtime.bigint();

    try {
      const existingProduct = await this.getProductById(id);

      if (existingProduct.status !== 'PENDING') {
        throw new BusinessRuleError('Only pending products can be approved or rejected');
      }

      const newStatus = approvalData.action === 'approve' ? 'ACTIVE' : 'INACTIVE';

      const product = await prisma.product.update({
        where: { id },
        data: {
          status: newStatus,
          reason: newStatus === 'INACTIVE' ? approvalData.reason : "",
          updatedBy: userId,
          updatedAt: new Date()
        }
      });

      const updatedProduct = await this.getProductById(id, userId);

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('APPROVE_PRODUCT', duration, {
        productId: id,
        action: approvalData.action
      });

      logger.auditBusinessOperation(
        `PRODUCT_${approvalData.action.toUpperCase()}`,
        userId,
        'products',
        id,
        existingProduct,
        updatedProduct
      );

      logger.auditDataAccess(
        userId,
        'products',
        id,
        'UPDATE',
        {
          action: approvalData.action,
          reason: approvalData.reason,
          adminNotes: approvalData.adminNotes,
          oldStatus: existingProduct.status,
          newStatus
        }
      );

      return updatedProduct;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to approve/reject product', error, {
        productId: id,
        action: approvalData.action,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Product', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to approve/reject product');
    }
  }

  // Helper methods
  private async checkSlugExists(slug: string): Promise<void> {
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (existingProduct) {
      throw ErrorFactory.conflict('Product', 'slug', slug);
    }
  }

  private async checkSkuExists(sku: string): Promise<void> {
    const existingProduct = await prisma.product.findUnique({
      where: { sku },
      select: { id: true }
    });

    if (existingProduct) {
      throw ErrorFactory.conflict('Product', 'sku', sku);
    }
  }

  private async validateCategoryExists(categoryId: string): Promise<void> {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true }
    });

    if (!category) {
      throw ErrorFactory.notFound('Category', categoryId);
    }

    if (!category.isActive) {
      throw new BusinessRuleError('Cannot create product in inactive category');
    }
  }

  private calculateStockStatus(stockQuantity: number): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
    if (stockQuantity === 0) {
      return 'OUT_OF_STOCK';
    } else if (stockQuantity <= 10) {
      return 'LOW_STOCK';
    } else {
      return 'IN_STOCK';
    }
  }

  async getProductStats(userId?: string, userRole: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    pendingProducts: number;
    outOfStockProducts: number;
    lowStockProducts: number;
    inStockProducts: number;
    topCategories: Array<{ name: string; nameAr?: string; count: number; }>;
    topBrands: Array<{ brand: string; count: number; }>;
    recentProducts: number;
    totalValue: number;
  }> {
    const startTime = process.hrtime.bigint();

    try {
      const baseWhere: Prisma.ProductWhereInput = {
        status: { not: 'DELETED' }
      };

      if (userId) {
        if (userRole === 'contractor') {
          baseWhere.contractorId = userId;
        }
      }

      const [
        totalProducts,
        activeProducts,
        inactiveProducts,
        pendingProducts,
        outOfStockProducts,
        lowStockProducts,
        inStockProducts,
        recentProducts
      ] = await Promise.all([
        prisma.product.count({ where: baseWhere }),
        prisma.product.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
        prisma.product.count({ where: { ...baseWhere, status: 'INACTIVE' } }),
        prisma.product.count({ where: { ...baseWhere, status: 'PENDING' } }),
        prisma.product.count({ where: { ...baseWhere, stockStatus: 'OUT_OF_STOCK' } }),
        prisma.product.count({ where: { ...baseWhere, stockStatus: 'LOW_STOCK' } }),
        prisma.product.count({ where: { ...baseWhere, stockStatus: 'IN_STOCK' } }),
        prisma.product.count({
          where: {
            ...baseWhere,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
          }
        })
      ]);

      // Get top categories
      const topCategoriesRaw = await prisma.product.groupBy({
        by: ['categoryId'],
        where: { ...baseWhere, status: 'ACTIVE' },
        _count: { categoryId: true },
        orderBy: { _count: { categoryId: 'desc' } },
        take: 5
      });

      const topCategories = await Promise.all(
        topCategoriesRaw.map(async (item) => {
          const category = await prisma.category.findUnique({
            where: { id: item.categoryId },
            select: { name: true, nameAr: true }
          });
          return {
            name: category?.name || 'Unknown',
            nameAr: category?.nameAr,
            count: item._count.categoryId
          };
        })
      );

      // Get top brands
      const topBrands = await prisma.product.groupBy({
        by: ['brand'],
        where: { ...baseWhere, status: 'ACTIVE' },
        _count: { brand: true },
        orderBy: { _count: { brand: 'desc' } },
        take: 5
      });

      const topBrandsFormatted = topBrands.map(item => ({
        brand: item.brand,
        count: item._count.brand
      }));

      // Calculate total value
      const totalValueResult = await prisma.product.aggregate({
        where: { ...baseWhere, status: 'ACTIVE' },
        _sum: { price: true }
      });

      const totalValue = Number(totalValueResult._sum.price || 0);

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('GET_PRODUCT_STATS', duration, {
        totalProducts,
        userId
      });

      return {
        totalProducts,
        activeProducts,
        inactiveProducts,
        pendingProducts,
        outOfStockProducts,
        lowStockProducts,
        inStockProducts,
        topCategories,
        topBrands: topBrandsFormatted,
        recentProducts,
        totalValue
      };

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get product stats', error, {
        userId,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get product stats');
    }
  }

  async getPendingProductStats(userId?: string, userRole: string): Promise<{
    totalPending: number;
    pendingByCategory: Array<{ categoryName: string; categoryNameAr?: string; count: number; }>;
    pendingByContractor: Array<{ contractorName: string; count: number; }>;
    oldestPending: Date | null;
    recentPending: number; // Last 7 days
    avgApprovalTime: number | null; // In days
  }> {
    const startTime = process.hrtime.bigint();

    try {
      const baseWhere: Prisma.ProductWhereInput = {
        status: 'PENDING'
      };

      if (userId) {
        if (userRole === 'contractor') {
          baseWhere.contractorId = userId;
        }
      }

      const totalPending = await prisma.product.count({ where: baseWhere });

      const pendingByCategoryRaw = await prisma.product.groupBy({
        by: ['categoryId'],
        where: baseWhere,
        _count: { categoryId: true },
        orderBy: { _count: { categoryId: 'desc' } }
      });

      const pendingByCategory = await Promise.all(
        pendingByCategoryRaw.map(async (item) => {
          const category = await prisma.category.findUnique({
            where: { id: item.categoryId },
            select: { name: true, nameAr: true }
          });
          return {
            categoryName: category?.name || 'Unknown',
            categoryNameAr: category?.nameAr,
            count: item._count.categoryId
          };
        })
      );

      let pendingByContractor: Array<{ contractorName: string; count: number; }> = [];
      if (!userId || userRole === 'admin' || userRole === 'super_admin') {
        const pendingByContractorRaw = await prisma.product.groupBy({
          by: ['contractorId', 'contractorName'],
          where: baseWhere,
          _count: { contractorId: true },
          orderBy: { _count: { contractorId: 'desc' } },
          take: 10
        });

        pendingByContractor = pendingByContractorRaw.map(item => ({
          contractorName: item.contractorName || 'Unknown Contractor',
          count: item._count.contractorId
        }));
      }

      const oldestPendingProduct = await prisma.product.findFirst({
        where: baseWhere,
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      });

      const recentPending = await prisma.product.count({
        where: {
          ...baseWhere,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      });

      const approvedProducts = await prisma.product.findMany({
        where: {
          status: { in: ['ACTIVE', 'INACTIVE'] },
          updatedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
        },
        select: {
          createdAt: true,
          updatedAt: true
        },
        take: 100
      });

      let avgApprovalTime: number | null = null;
      if (approvedProducts.length > 0) {
        const totalApprovalTime = approvedProducts.reduce((sum, product) => {
          const approvalTime = product.updatedAt!.getTime() - product.createdAt!.getTime();
          return sum + approvalTime;
        }, 0);
        avgApprovalTime = Math.round(totalApprovalTime / approvedProducts.length / (24 * 60 * 60 * 1000)); // Convert to days
      }

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('GET_PENDING_PRODUCT_STATS', duration, {
        totalPending,
        userId
      });

      return {
        totalPending,
        pendingByCategory,
        pendingByContractor,
        oldestPending: oldestPendingProduct?.createdAt || null,
        recentPending,
        avgApprovalTime
      };

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get pending product stats', error, {
        userId,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get pending product stats');
    }
  }

  async getAllProductsForAdmin(queryOptions: ProductQuery, userId: string): Promise<{
    products: Product[];
    pagination: PaginationMeta;
  }> {
    const startTime = process.hrtime.bigint();

    try {
      const {
        page = 1,
        limit = 10,
        search,
        categoryId,
        contractorId,
        status,
        stockStatus,
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = queryOptions;

      const skip = (page - 1) * limit;

      const where: Prisma.ProductWhereInput = {};

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (contractorId) {
        where.contractorId = contractorId;
      }

      // Include all statuses including DELETED
      if (status) {
        where.status = status;
      }

      if (stockStatus) {
        where.stockStatus = stockStatus;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined) {
          where.price.gte = minPrice;
        }
        if (maxPrice !== undefined) {
          where.price.lte = maxPrice;
        }
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { descriptionAr: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } }
        ];
      }

      const orderBy: Prisma.ProductOrderByWithRelationInput = {};
      if (sortBy === 'name') {
        orderBy.name = sortOrder;
      } else if (sortBy === 'price') {
        orderBy.price = sortOrder;
      } else if (sortBy === 'stockQuantity') {
        orderBy.stockQuantity = sortOrder;
      } else if (sortBy === 'brand') {
        orderBy.brand = sortOrder;
      } else {
        orderBy.createdAt = sortOrder;
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            category: true,
            productImages: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }),
        prisma.product.count({ where })
      ]);

      const result = products.map(product => ({
        id: product.id,
        contractorId: product.contractorId,
        contractorName: product.contractorName,
        categoryId: product.categoryId,
        name: product.name,
        nameAr: product.nameAr,
        description: product.description,
        descriptionAr: product.descriptionAr,
        slug: product.slug,
        brand: product.brand,
        model: product.model,
        sku: product.sku,
        specifications: product.specifications as Record<string, any>,
        categorySpecs: product.categorySpecs as any,
        price: Number(product.price),
        currency: product.currency || 'SAR',
        vatIncluded: product.vatIncluded || true,
        stockQuantity: product.stockQuantity,
        stockStatus: product.stockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
        status: product.status as 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'DELETED',
        createdAt: product.createdAt || new Date(),
        updatedAt: product.updatedAt || new Date(),
        createdBy: product.createdBy,
        updatedBy: product.updatedBy,
        productImages: product.productImages.map(img => ({
          id: img.id,
          productId: img.productId,
          fileName: img.fileName,
          filePath: img.filePath,
          fileUrl: img.fileUrl,
          sortOrder: img.sortOrder || 0,
          isPrimary: img.isPrimary || false,
          createdAt: img.createdAt || new Date()
        })),
        category: product.category ? {
          id: product.category.id,
          name: product.category.name,
          nameAr: product.category.nameAr,
          slug: product.category.slug,
          description: product.category.description,
          descriptionAr: product.category.descriptionAr,
          icon: product.category.icon,
          imageUrl: product.category.imageUrl,
          sortOrder: product.category.sortOrder || 0,
          isActive: product.category.isActive || true,
          productsCount: product.category.productsCount || 0,
          createdAt: product.category.createdAt || new Date(),
          updatedAt: product.category.updatedAt || new Date(),
          createdBy: product.category.createdBy,
          updatedBy: product.category.updatedBy
        } : undefined
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
      logger.auditPerformance('GET_ALL_PRODUCTS_ADMIN', duration, {
        resultCount: products.length,
        page,
        limit,
        search,
        userId
      });

      logger.auditDataAccess(
        userId,
        'products',
        'ALL',
        'READ',
        {
          action: 'admin_get_all_products',
          includesDeleted: true,
          resultCount: products.length
        }
      );

      return { products: result, pagination };

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to get all products for admin', error, {
        queryOptions,
        userId,
        performanceMetrics: { duration }
      });
      throw error instanceof Error ? error : new DatabaseError('Failed to get all products');
    }
  }

  async restoreDeletedProduct(id: string, userId: string): Promise<Product> {
    const startTime = process.hrtime.bigint();

    try {
      const existingProduct = await this.getProductById(id, userId, true);

      if (existingProduct.status !== 'DELETED') {
        throw new BusinessRuleError('Only deleted products can be restored');
      }

      const product = await prisma.product.update({
        where: { id },
        data: {
          status: 'PENDING',
          updatedBy: userId,
          updatedAt: new Date()
        }
      });

      const restoredProduct = await this.getProductById(id, userId);

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('RESTORE_PRODUCT', duration, {
        productId: id
      });

      logger.auditBusinessOperation(
        'RESTORE_PRODUCT',
        userId,
        'products',
        id,
        existingProduct,
        restoredProduct
      );

      logger.auditDataAccess(
        userId,
        'products',
        id,
        'UPDATE',
        {
          action: 'restore_deleted_product',
          oldStatus: 'DELETED',
          newStatus: 'PENDING'
        }
      );

      return restoredProduct;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to restore product', error, {
        productId: id,
        userId,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Product', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to restore product');
    }
  }
}

export const productService = new ProductService();