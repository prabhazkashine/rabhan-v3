import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import logger from '../config/logger';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Created uploads directory', { path: uploadsDir });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const user = (req as any).user;
    const userType = user?.userType || 'unknown';
    const userId = user?.userId || 'anonymous';

    // Create user-specific directory
    const userDir = path.join(uploadsDir, userType.toLowerCase(), userId);

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
      logger.info('Created user directory', { path: userDir, userId, userType });
    }

    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const user = (req as any).user;
    const categoryId = req.body.categoryId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = path.extname(file.originalname);

    // Generate filename: timestamp_categoryId_originalName_uniqueId.ext
    const uniqueId = uuidv4().split('-')[0]; // First part of UUID for brevity
    const sanitizedOriginalName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_');

    const filename = `${timestamp}_${categoryId}_${sanitizedOriginalName}_${uniqueId}${fileExtension}`;

    logger.info('Generated filename', {
      originalName: file.originalname,
      generatedName: filename,
      userId: user?.userId,
      categoryId
    });

    cb(null, filename);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    logger.warn('File type not allowed', {
      mimetype: file.mimetype,
      extension: fileExtension,
      filename: file.originalname
    });
    cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 1024 * 1024, // 1MB for text fields
  }
});

export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    logger.warn('Multer upload error', {
      code: error.code,
      message: error.message,
      field: error.field
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large',
          code: 'FILE_TOO_LARGE',
          message: 'File size must be less than 10MB'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field',
          code: 'UNEXPECTED_FILE',
          message: 'Only one file is allowed in the "file" field'
        });
      default:
        return res.status(400).json({
          success: false,
          error: 'Upload error',
          code: 'UPLOAD_ERROR',
          message: error.message
        });
    }
  } else if (error.message.includes('Only PDF, JPG, JPEG, and PNG files are allowed')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      code: 'INVALID_FILE_TYPE',
      message: 'Only PDF, JPG, JPEG, and PNG files are allowed'
    });
  }

  next(error);
};