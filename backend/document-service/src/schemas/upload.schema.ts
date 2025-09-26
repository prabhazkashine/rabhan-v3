import { z } from 'zod';

export const uploadDocumentSchema = z.object({
  categoryId: z.string().uuid('Category ID must be a valid UUID'),
  templateId: z.string().uuid('Template ID must be a valid UUID').optional(),
  metadata: z.string().optional().refine((val) => {
    if (!val) return true;
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Metadata must be valid JSON string')
});

export const validateUploadRequest = (req: any, res: any, next: any) => {
  try {
    console.log('Validating request body:', req.body);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('CategoryId value:', req.body.categoryId);

    uploadDocumentSchema.parse(req.body);
    console.log('Validation passed successfully');
    next();
  } catch (error: any) {
    console.log('Validation failed:', error);

    if (error.errors || error.issues) {
      const details = error.errors || error.issues;
      console.log('Validation error details:', details);

      return res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: details,
        received_body: req.body
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Invalid request data',
      code: 'INVALID_REQUEST',
      received_body: req.body,
      error_message: error.message
    });
  }
};

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;