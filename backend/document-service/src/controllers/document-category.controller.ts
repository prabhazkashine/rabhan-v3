import { Request, Response } from 'express';
import { DocumentCategoryService } from '../services/document-category.service';
import { createMultipleCategoriesSchema } from '../schemas/document-category.schema';
import logger from '../config/logger';
import { ZodError } from 'zod';

export class DocumentCategoryController {
  private categoryService: DocumentCategoryService;

  constructor() {
    this.categoryService = new DocumentCategoryService();
  }

  async seedCategories(req: Request, res: Response) {
    try {
      logger.info('Seeding default document categories');

      const categories = await this.categoryService.seedDefaultCategories();

      const response = {
        success: true,
        message: 'Document categories seeded successfully',
        categories: categories.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description,
          allowed_formats: category.allowedFormats,
          max_file_size_mb: category.maxFileSizeMb,
          required_for_kyc: true,
          user_type: category.requiredForRole,
          validation_rules: {}
        })),
        count: categories.length
      };

      logger.info('Document categories seeded successfully', { count: categories.length });
      res.status(201).json(response);
    } catch (error: any) {
      logger.error('Error seeding document categories', { error: error.message });

      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'Some categories already exist',
          message: 'Document categories may have been seeded previously'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to seed document categories'
      });
    }
  }

  async createMultipleCategories(req: Request, res: Response) {
    try {
      const validatedData = createMultipleCategoriesSchema.parse(req.body);

      const categories = await this.categoryService.createMultipleCategories(validatedData);

      const response = {
        success: true,
        message: 'Document categories created successfully',
        categories: categories.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description,
          allowed_formats: category.allowedFormats,
          max_file_size_mb: category.maxFileSizeMb,
          required_for_kyc: true,
          user_type: category.requiredForRole,
          validation_rules: {}
        })),
        count: categories.length
      };

      logger.info('Multiple document categories created successfully', { count: categories.length });
      res.status(201).json(response);
    } catch (error: any) {
      logger.error('Error creating multiple document categories', { error: error.message });

      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues
        });
      }

      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: 'Duplicate category name',
          message: 'One or more categories with the same name already exist'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create document categories'
      });
    }
  }

  async getAllCategories(req: Request, res: Response) {
    try {
      logger.info('Fetching all document categories');

      const categories = await this.categoryService.getAllCategories();

      const response = {
        success: true,
        categories: categories.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description,
          allowed_formats: category.allowedFormats,
          max_file_size_mb: category.maxFileSizeMb,
          required_for_kyc: true,
          user_type: category.requiredForRole,
          validation_rules: {}
        }))
      };

      logger.info('Document categories fetched successfully', { count: categories.length });
      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching document categories', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch document categories'
      });
    }
  }

  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Category ID is required'
        });
      }

      const category = await this.categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      const response = {
        success: true,
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          allowed_formats: category.allowedFormats,
          max_file_size_mb: category.maxFileSizeMb,
          required_for_kyc: true,
          user_type: category.requiredForRole,
          validation_rules: {}
        }
      };

      logger.info('Document category fetched successfully', { id, name: category.name });
      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching document category by ID', { error: error.message, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch document category'
      });
    }
  }
}