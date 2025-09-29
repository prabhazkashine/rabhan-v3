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

  async getProductById(id: string, userId?: string): Promise<Product> {
    const startTime = process.hrtime.bigint();

    try {
      const product = await prisma.product.findUnique({
        where: { id },
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
        const updateData: any = {
          ...productData,
          stockStatus,
          status: 'PENDING', 
          updatedBy: userId,
          updatedAt: new Date()
        };

        const product = await tx.product.update({
          where: { id },
          data: updateData
        });

        if (productData.images) {
          const imagesToDelete = productData.images.filter(img => img.action === 'delete' && img.id);
          if (imagesToDelete.length > 0) {
            await tx.productImage.deleteMany({
              where: {
                id: { in: imagesToDelete.map(img => img.id!).filter(Boolean) }
              }
            });
          }

          const imagesToAdd = productData.images.filter(img => img.action === 'add' || !img.action);
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

      // Delete product and its images in a transaction
      await prisma.$transaction(async (tx) => {
        // Delete product images first
        await tx.productImage.deleteMany({
          where: { productId: id }
        });

        // Delete the product
        await tx.product.delete({
          where: { id }
        });
      });

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.auditPerformance('DELETE_PRODUCT', duration, {
        productId: id
      });

      logger.auditBusinessOperation(
        'DELETE_PRODUCT',
        userId,
        'products',
        id,
        existingProduct,
        null
      );

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      logger.error('Failed to delete product', error, {
        productId: id,
        performanceMetrics: { duration }
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ErrorFactory.notFound('Product', id);
        }
      }

      throw error instanceof Error ? error : new DatabaseError('Failed to delete product');
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
}

export const productService = new ProductService();