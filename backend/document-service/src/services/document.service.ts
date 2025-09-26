import prisma from '../config/database';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';

export interface DocumentUploadData {
  userId: string;
  categoryId: string;
  templateId?: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  metadata?: Record<string, any>;
}

export class DocumentService {
  async uploadDocument(data: DocumentUploadData) {
    const startTime = Date.now();
    let documentId: string;

    try {
      logger.info('Starting document upload process', {
        userId: data.userId,
        categoryId: data.categoryId,
        filename: data.originalFilename,
        fileSize: data.fileSize
      });

      // 1. Verify category exists and get its requirements
      const category = await prisma.documentCategory.findUnique({
        where: { id: data.categoryId }
      });

      if (!category) {
        throw new Error('Document category not found');
      }

      // 2. Check file format against category requirements
      const fileExtension = data.originalFilename.split('.').pop()?.toLowerCase();
      if (!category.allowedFormats.includes(fileExtension || '')) {
        throw new Error(`File format ${fileExtension} not allowed for this category`);
      }

      // 3. Check file size
      const fileSizeMB = data.fileSize / (1024 * 1024);
      if (fileSizeMB > category.maxFileSizeMb) {
        throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds limit of ${category.maxFileSizeMb}MB`);
      }

      // 4. Check for existing documents in this category (KYC requirement: 1 per category)
      const existingDocs = await prisma.document.findMany({
        where: {
          userId: data.userId,
          categoryId: data.categoryId,
          status: {
            not: 'archived'
          }
        }
      });

      // 5. Generate file hash for deduplication
      const fileBuffer = fs.readFileSync(data.filePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Check if same file already exists
      const existingFileWithHash = await prisma.document.findFirst({
        where: {
          fileHash,
          userId: data.userId,
          status: {
            not: 'archived'
          }
        }
      });

      if (existingFileWithHash) {
        throw new Error('This file has already been uploaded');
      }

      // 6. Use the actual file path as storage path
      const storagePath = data.filePath;
      const encryptionKeyId = uuidv4();

      // 7. Create document record
      const document = await prisma.document.create({
        data: {
          userId: data.userId,
          categoryId: data.categoryId,
          templateId: data.templateId,
          originalFilename: data.originalFilename,
          fileSizeBytes: BigInt(data.fileSize),
          mimeType: data.mimeType,
          fileHash,
          fileExtension: fileExtension || '',
          storageBucket: process.env.STORAGE_BUCKET || 'documents',
          storagePath,
          encryptionKeyId,
          uploadIpAddress: '127.0.0.1', // This should be passed from request
          status: 'pending',
          validationResults: {},
          extractedData: data.metadata || {},
          samaAuditLog: [
            {
              timestamp: new Date().toISOString(),
              action: 'document_uploaded',
              userId: data.userId,
              details: {
                filename: data.originalFilename,
                categoryId: data.categoryId,
                fileSize: data.fileSize
              }
            }
          ]
        }
      });

      documentId = document.id;

      // 8. Archive old documents in the same category
      if (existingDocs.length > 0) {
        await prisma.document.updateMany({
          where: {
            id: {
              in: existingDocs.map(doc => doc.id)
            }
          },
          data: {
            status: 'archived',
            archivedAt: new Date()
          }
        });

        logger.info('Archived old documents in category', {
          documentId,
          userId: data.userId,
          categoryId: data.categoryId,
          archivedCount: existingDocs.length
        });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Document upload completed successfully', {
        documentId,
        userId: data.userId,
        categoryId: data.categoryId,
        filename: data.originalFilename,
        processingTime
      });

      return {
        success: true,
        documentId,
        document: {
          id: document.id,
          originalFilename: document.originalFilename,
          fileSize: Number(document.fileSizeBytes),
          mimeType: document.mimeType,
          status: document.status,
          createdAt: document.createdAt,
          categoryId: document.categoryId
        },
        archivedDocuments: existingDocs.length
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      logger.error('Document upload failed', {
        userId: data.userId,
        categoryId: data.categoryId,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  async getDocumentsByUser(userId: string, categoryId?: string) {
    try {
      const where: any = {
        userId,
        status: {
          not: 'archived'
        }
      };

      if (categoryId) {
        where.categoryId = categoryId;
      }

      const documents = await prisma.document.findMany({
        where,
        include: {
          category: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return documents.map(doc => ({
        id: doc.id,
        originalFilename: doc.originalFilename,
        fileSize: Number(doc.fileSizeBytes),
        mimeType: doc.mimeType,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        category: {
          id: doc.category.id,
          name: doc.category.name,
          description: doc.category.description
        }
      }));

    } catch (error: any) {
      logger.error('Error fetching user documents', {
        userId,
        categoryId,
        error: error.message
      });
      throw error;
    }
  }

  private generateStoragePath(userId: string, categoryId: string, fileHash: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `documents/${year}/${month}/${day}/${userId}/${categoryId}/${fileHash}`;
  }

  async getDocumentById(documentId: string, userId: string) {
    try {
      logger.info('Fetching document by ID', { documentId, userId });

      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId, // Ensure user can only access their own documents
          status: {
            not: 'archived'
          }
        },
        include: {
          category: true
        }
      });

      if (!document) {
        logger.warn('Document not found or access denied', { documentId, userId });
        return null;
      }

      logger.info('Document fetched successfully', {
        documentId,
        userId,
        filename: document.originalFilename
      });

      return {
        id: document.id,
        originalFilename: document.originalFilename,
        fileSize: Number(document.fileSizeBytes),
        mimeType: document.mimeType,
        status: document.status,
        storagePath: document.storagePath,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        category: {
          id: document.category.id,
          name: document.category.name,
          description: document.category.description
        }
      };

    } catch (error: any) {
      logger.error('Error fetching document by ID', {
        documentId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  async validateCategoryForUser(categoryId: string, userType: 'USER' | 'CONTRACTOR'): Promise<boolean> {
    try {
      const category = await prisma.documentCategory.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return false;
      }

      // Check if category is for the correct user type
      return category.requiredForRole === userType;

    } catch (error: any) {
      logger.error('Error validating category for user', {
        categoryId,
        userType,
        error: error.message
      });
      return false;
    }
  }
}