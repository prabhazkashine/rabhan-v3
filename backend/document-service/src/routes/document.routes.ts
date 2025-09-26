import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { uploadMiddleware, handleUploadError } from '../middleware/upload.middleware';
import { validateUploadRequest } from '../schemas/upload.schema';

const router = Router();
const documentController = new DocumentController();
const authMiddleware = new AuthMiddleware();

// Debug middleware to log request details
const debugMiddleware = (req: any, res: any, next: any) => {
  console.log('=== Upload Request Debug ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('File:', req.file ? 'Present' : 'Missing');
  console.log('User:', req.user);
  console.log('===========================');
  next();
};

// POST /api/documents/upload - Upload a document
router.post(
  '/upload',
  debugMiddleware,
  authMiddleware.authenticate,
  uploadMiddleware.single('file'),
  handleUploadError,
  validateUploadRequest,
  documentController.uploadDocument
);

// GET /api/documents - Get user's documents
router.get(
  '/',
  authMiddleware.authenticate,
  documentController.getUserDocuments
);

// GET /api/documents/:id/download - Download a specific document
router.get(
  '/:id/download',
  authMiddleware.authenticate,
  documentController.downloadDocument
);

export default router;