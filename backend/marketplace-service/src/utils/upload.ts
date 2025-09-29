import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, 'uploads/products');
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: uuid-timestamp.extension
    const uniqueSuffix = uuidv4() + '-' + Date.now();
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

// Multer configuration
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024, // Default 10MB
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: fileFilter
});

// Helper function to generate file URL
export const generateFileUrl = (req: Request, filename: string): string => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/uploads/products/${filename}`;
};

// Helper function to delete file
export const deleteFile = (filename: string): void => {
  const fs = require('fs');
  const filePath = path.join('uploads/products', filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};