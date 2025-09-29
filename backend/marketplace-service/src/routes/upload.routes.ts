import { Router, Request, Response, NextFunction } from 'express';
import { upload, generateFileUrl, deleteFile } from '../utils/upload';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { AuthenticatedRequest, ApiResponse } from '../types/common';

const router = Router();

// Upload single product image
router.post('/product-image', upload.single('image'), (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();

  try {
    if (!req.file) {
      throw new ValidationError('No image file provided');
    }

    const fileUrl = generateFileUrl(req, req.file.filename);

    const response: ApiResponse<any> = {
      success: true,
      data: {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileUrl: fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      },
      message: 'Image uploaded successfully',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        version: '1.0.0'
      }
    };

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.auditPerformance('UPLOAD_PRODUCT_IMAGE', duration, {
      fileName: req.file.filename,
      fileSize: req.file.size,
      success: true
    });

    res.status(201).json(response);

  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.error('Image upload failed', error, {
      requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
      performanceMetrics: { duration }
    });
    next(error);
  }
});

// Upload multiple product images
router.post('/product-images', upload.array('images', 10), (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();

  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new ValidationError('No image files provided');
    }

    const uploadedFiles = files.map(file => ({
      fileName: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileUrl: generateFileUrl(req, file.filename),
      fileSize: file.size,
      mimeType: file.mimetype
    }));

    const response: ApiResponse<any> = {
      success: true,
      data: {
        files: uploadedFiles,
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0)
      },
      message: `${files.length} images uploaded successfully`,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        version: '1.0.0'
      }
    };

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.auditPerformance('UPLOAD_PRODUCT_IMAGES', duration, {
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      success: true
    });

    res.status(201).json(response);

  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.error('Multiple images upload failed', error, {
      requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
      performanceMetrics: { duration }
    });
    next(error);
  }
});

// Delete product image
router.delete('/product-image/:filename', (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();

  try {
    const { filename } = req.params;

    if (!filename) {
      throw new ValidationError('Filename is required');
    }

    // Basic security check - only allow files in uploads directory
    if (filename.includes('../') || filename.includes('..\\')) {
      throw new ValidationError('Invalid filename');
    }

    deleteFile(filename);

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Image deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
        version: '1.0.0'
      }
    };

    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.auditPerformance('DELETE_PRODUCT_IMAGE', duration, {
      fileName: filename,
      success: true
    });

    res.json(response);

  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.error('Image deletion failed', error, {
      filename: req.params.filename,
      requestId: (req as AuthenticatedRequest).context?.requestId || 'unknown',
      performanceMetrics: { duration }
    });
    next(error);
  }
});

export { router as uploadRoutes };