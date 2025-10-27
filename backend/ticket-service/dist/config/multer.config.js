"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMulterError = exports.formatFileSize = exports.getDocumentType = exports.uploadTicketDocuments = exports.uploadConfig = exports.MAX_FILES = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const error_handler_1 = require("../middleware/error-handler");
// Allowed file types: images and PDFs only (no videos)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
// File extensions mapping
const MIME_TYPE_EXTENSIONS = {
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
exports.MAX_FILES = 3;
// Storage configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Store files in uploads/tickets directory
        const uploadPath = path_1.default.join(process.cwd(), 'uploads', 'tickets');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-randomstring-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = MIME_TYPE_EXTENSIONS[file.mimetype] || path_1.default.extname(file.originalname);
        const sanitizedOriginalName = file.originalname
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 50); // Limit filename length
        const filename = `ticket-${uniqueSuffix}-${sanitizedOriginalName}${fileExtension}`;
        cb(null, filename);
    }
});
// File filter to validate file types
const fileFilter = (req, file, cb) => {
    // Check if file type is allowed
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new error_handler_1.AppError(`Invalid file type: ${file.mimetype}. Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed.`, 400));
    }
};
// Multer configuration
exports.uploadConfig = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE, // 5MB max per file
        files: exports.MAX_FILES, // Maximum 3 files at once
    }
});
// Middleware for handling multiple files (up to 3)
exports.uploadTicketDocuments = exports.uploadConfig.array('documents', exports.MAX_FILES);
// Helper function to get file type from mimetype
const getDocumentType = (mimetype) => {
    if (ALLOWED_IMAGE_TYPES.includes(mimetype)) {
        return 'image';
    }
    else if (mimetype === 'application/pdf') {
        return 'pdf';
    }
    return 'other';
};
exports.getDocumentType = getDocumentType;
// Helper function to format file size
const formatFileSize = (bytes) => {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};
exports.formatFileSize = formatFileSize;
// Error messages for multer errors
const handleMulterError = (error) => {
    if (error instanceof multer_1.default.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return `File size too large. Maximum allowed size is ${(0, exports.formatFileSize)(MAX_FILE_SIZE)} per file.`;
            case 'LIMIT_FILE_COUNT':
                return `Too many files. Maximum ${exports.MAX_FILES} files allowed at once.`;
            case 'LIMIT_UNEXPECTED_FILE':
                return 'Unexpected field name. Use "documents" as the field name.';
            default:
                return `Upload error: ${error.message}`;
        }
    }
    return error.message || 'File upload failed';
};
exports.handleMulterError = handleMulterError;
