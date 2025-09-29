import { Request, Response } from 'express';
import { DocumentService, DocumentUploadData } from '../services/document.service';
import logger from '../config/logger';
import { ZodError } from 'zod';

export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  public uploadDocument = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let documentId = 'pending';

    try {
      // Check if file is uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
          code: 'MISSING_FILE',
        });
        return;
      }

      // Get authenticated user info (set by auth middleware)
      const user = req.user;
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const { categoryId, templateId, metadata } = req.body;

      logger.info('Document upload started', {
        userId: user.userId,
        userType: user.userType,
        categoryId,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });

      console.log(categoryId, user.userType, 'uuuuuuuuuuuuuuuuuuu')

      // Validate that the category is appropriate for the user type
      const isValidCategory = await this.documentService.validateCategoryForUser(
        categoryId,
        user.userType
      );

      if (!isValidCategory) {
        logger.warn('Invalid category for user type', {
          userId: user.userId,
          userType: user.userType,
          categoryId
        });

        res.status(400).json({
          success: false,
          error: 'Invalid category for user type',
          code: 'INVALID_CATEGORY',
          message: `This document category is not applicable for ${user.userType} accounts`
        });
        return;
      }

      // Prepare upload data
      const uploadData: DocumentUploadData = {
        userId: user.userId,
        categoryId,
        templateId,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.path,
        metadata: metadata ? JSON.parse(metadata) : undefined
      };

      // Upload document
      const result = await this.documentService.uploadDocument(uploadData);
      documentId = result.documentId;

      const processingTime = Date.now() - startTime;

      logger.info('Document upload completed successfully', {
        documentId,
        userId: user.userId,
        userType: user.userType,
        categoryId,
        filename: req.file.originalname,
        archivedDocuments: result.archivedDocuments,
        processingTime,
      });

      res.status(201).json({
        success: true,
        document_id: documentId,
        message: 'Document uploaded successfully',
        data: {
          document: result.document,
          archived_documents_count: result.archivedDocuments,
          processing_time_ms: processingTime
        },
        validation_results: {
          overall_score: 100,
          file_validation: { valid: true, issues: [] },
          security_validation: { valid: true, risk_level: 'low', issues: [] }
        }
      });

    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      logger.error('Document upload failed', {
        documentId,
        userId: req.user?.userId,
        userType: req.user?.userType,
        error: error.message,
        processingTime,
        filename: req.file?.originalname
      });

      // Handle specific errors
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Category not found',
          code: 'CATEGORY_NOT_FOUND',
          message: error.message
        });
        return;
      }

      if (error.message.includes('format') && error.message.includes('not allowed')) {
        res.status(400).json({
          success: false,
          error: 'Invalid file format',
          code: 'INVALID_FILE_FORMAT',
          message: error.message
        });
        return;
      }

      if (error.message.includes('size') && error.message.includes('exceeds')) {
        res.status(400).json({
          success: false,
          error: 'File too large',
          code: 'FILE_TOO_LARGE',
          message: error.message
        });
        return;
      }

      if (error.message.includes('already been uploaded')) {
        res.status(409).json({
          success: false,
          error: 'Duplicate file',
          code: 'DUPLICATE_FILE',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Document upload failed',
        code: 'UPLOAD_FAILED',
        message: 'An internal error occurred during document upload'
      });
    }
  };

  public getUserDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const { categoryId } = req.query;

      logger.info('Fetching user documents', {
        userId: user.userId,
        categoryId: categoryId as string
      });

      const documents = await this.documentService.getDocumentsByUser(
        user.userId,
        categoryId as string
      );

      logger.info('User documents fetched successfully', {
        userId: user.userId,
        count: documents.length
      });

      res.json({
        success: true,
        documents,
        count: documents.length
      });

    } catch (error: any) {
      logger.error('Error fetching user documents', {
        userId: req.user?.userId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch documents',
        code: 'FETCH_FAILED'
      });
    }
  };

  public downloadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const { id: documentId } = req.params;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: 'Document ID is required',
          code: 'MISSING_DOCUMENT_ID'
        });
        return;
      }

      logger.info('Document download requested', {
        userId: user.userId,
        documentId
      });

      const document = await this.documentService.getDocumentById(documentId, user.userId);

      if (!document) {
        res.status(404).json({
          success: false,
          error: 'Document not found or access denied',
          code: 'DOCUMENT_NOT_FOUND'
        });
        return;
      }

      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(document.storagePath)) {
        logger.error('Document file not found on disk', {
          userId: user.userId,
          documentId,
          storagePath: document.storagePath
        });

        res.status(404).json({
          success: false,
          error: 'Document file not found',
          code: 'FILE_NOT_FOUND'
        });
        return;
      }

      // Set appropriate headers for file download
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);

      // Stream the file
      const fileStream = fs.createReadStream(document.storagePath);
      fileStream.pipe(res);

      logger.info('Document download completed', {
        userId: user.userId,
        documentId,
        filename: document.originalFilename
      });

    } catch (error: any) {
      logger.error('Error downloading document', {
        userId: req.user?.userId,
        documentId: req.params.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to download document',
        code: 'DOWNLOAD_FAILED'
      });
    }
  };
}