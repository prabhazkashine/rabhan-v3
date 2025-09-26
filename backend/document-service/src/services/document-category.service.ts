import prisma from '../config/database';
import logger from '../config/logger';
import { CreateDocumentCategoryInput, CreateMultipleCategoriesInput } from '../schemas/document-category.schema';

export class DocumentCategoryService {
  async createCategory(data: CreateDocumentCategoryInput) {
    try {
      logger.info('Creating document category', { name: data.name });

      const category = await prisma.documentCategory.create({
        data: {
          name: data.name,
          description: data.description,
          requiredForRole: data.user_type,
          maxFileSizeMb: data.max_file_size_mb,
          allowedFormats: data.allowed_formats,
        },
      });

      logger.info('Document category created successfully', { id: category.id, name: category.name });
      return category;
    } catch (error: any) {
      logger.error('Error creating document category', { error: error.message, data });
      throw error;
    }
  }

  async createMultipleCategories(input: CreateMultipleCategoriesInput) {
    try {
      logger.info('Creating multiple document categories', { count: input.categories.length });

      const createdCategories = [];

      for (const categoryData of input.categories) {
        const category = await prisma.documentCategory.create({
          data: {
            name: categoryData.name,
            description: categoryData.description,
            requiredForRole: categoryData.user_type,
            maxFileSizeMb: categoryData.max_file_size_mb,
            allowedFormats: categoryData.allowed_formats,
          },
        });
        createdCategories.push(category);
      }

      logger.info('Multiple document categories created successfully', { count: createdCategories.length });
      return createdCategories;
    } catch (error: any) {
      logger.error('Error creating multiple document categories', { error: error.message });
      throw error;
    }
  }

  async getAllCategories() {
    try {
      logger.info('Fetching all document categories');

      const categories = await prisma.documentCategory.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      logger.info('Document categories fetched successfully', { count: categories.length });
      return categories;
    } catch (error: any) {
      logger.error('Error fetching document categories', { error: error.message });
      throw error;
    }
  }

  async getCategoryById(id: string) {
    try {
      logger.info('Fetching document category by ID', { id });

      const category = await prisma.documentCategory.findUnique({
        where: { id },
      });

      if (!category) {
        logger.warn('Document category not found', { id });
        return null;
      }

      logger.info('Document category fetched successfully', { id, name: category.name });
      return category;
    } catch (error: any) {
      logger.error('Error fetching document category by ID', { error: error.message, id });
      throw error;
    }
  }

  async seedDefaultCategories() {
    const defaultCategories = [
      {
        name: "cr_certificate",
        description: "C.R Certificate",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "CONTRACTOR" as const,
        validation_rules: {}
      },
      {
        name: "gosi_certificate",
        description: "GOSI Certificate",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "CONTRACTOR" as const,
        validation_rules: {}
      },
      {
        name: "saso_certificate",
        description: "SASO Certificate",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "CONTRACTOR" as const,
        validation_rules: {}
      },
      {
        name: "sec_license",
        description: "Saudi Electricity Company License",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "CONTRACTOR" as const,
        validation_rules: {}
      },
      {
        name: "vat_certificate",
        description: "VAT Certificate",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "CONTRACTOR" as const,
        validation_rules: {}
      },
      {
        name: "zakat_certificate",
        description: "ZAKAT Certificate",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "CONTRACTOR" as const,
        validation_rules: {}
      },
      {
        name: "national_id_back",
        description: "Saudi National ID (Back Side)",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "USER" as const,
        validation_rules: {}
      },
      {
        name: "national_id_front",
        description: "Saudi National ID (Front Side)",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "USER" as const,
        validation_rules: {}
      },
      {
        name: "proof_of_address",
        description: "Proof of address document",
        allowed_formats: ["pdf", "jpg", "jpeg", "png"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "USER" as const,
        validation_rules: {}
      },
      {
        name: "salary_certificate",
        description: "Salary certificate from employer",
        allowed_formats: ["pdf"] as ("pdf" | "jpg" | "jpeg" | "png")[],
        max_file_size_mb: 10,
        required_for_kyc: true,
        user_type: "USER" as const,
        validation_rules: {}
      }
    ];

    return await this.createMultipleCategories({ categories: defaultCategories });
  }
}