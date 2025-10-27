import multer from 'multer';
export declare const MAX_FILES = 3;
export declare const uploadConfig: multer.Multer;
export declare const uploadTicketDocuments: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const getDocumentType: (mimetype: string) => string;
export declare const formatFileSize: (bytes: number) => string;
export declare const handleMulterError: (error: any) => string;
