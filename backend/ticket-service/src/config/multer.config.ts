import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { AppError } from '../middleware/error-handler';

// Allowed file types: images and PDFs only (no videos)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

// File extensions mapping
const MIME_TYPE_EXTENSIONS: { [key: string]: string } = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// Max number of files: 3
export const MAX_FILES = 3;

// Storage configuration
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    // Store files in uploads/tickets directory
    const uploadPath = path.join(process.cwd(), 'uploads', 'tickets');
    cb(null, uploadPath);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = MIME_TYPE_EXTENSIONS[file.mimetype] || path.extname(file.originalname);

    // Remove existing extension from original filename to avoid double extensions
    const nameWithoutExt = path.parse(file.originalname).name;
    const sanitizedOriginalName = nameWithoutExt
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50); // Limit filename length

    const filename = `ticket-${uniqueSuffix}-${sanitizedOriginalName}${fileExtension}`;
    cb(null, filename);
  }
});

// File filter to validate file types
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check if file type is allowed
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(
      `Invalid file type: ${file.mimetype}. Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed.`,
      400
    ));
  }
};

// Multer configuration
export const uploadConfig = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // 5MB max per file
    files: MAX_FILES, // Maximum 3 files at once
  }
});

// Middleware for handling multiple files (up to 3)
export const uploadTicketDocuments = uploadConfig.array('documents', MAX_FILES);

// Helper function to get file type from mimetype
export const getDocumentType = (mimetype: string): string => {
  if (ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    return 'image';
  } else if (mimetype === 'application/pdf') {
    return 'pdf';
  }
  return 'other';
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// Error messages for multer errors
export const handleMulterError = (error: any): string => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return `File size too large. Maximum allowed size is ${formatFileSize(MAX_FILE_SIZE)} per file.`;
      case 'LIMIT_FILE_COUNT':
        return `Too many files. Maximum ${MAX_FILES} files allowed at once.`;
      case 'LIMIT_UNEXPECTED_FILE':
        return 'Unexpected field name. Use "documents" as the field name.';
      default:
        return `Upload error: ${error.message}`;
    }
  }
  return error.message || 'File upload failed';
};
