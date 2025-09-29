import { Request, Response, NextFunction } from 'express';

export function parseFormData(req: Request, res: Response, next: NextFunction): void {
  try {
    // Parse numeric fields
    if (req.body.price) {
      req.body.price = parseFloat(req.body.price);
    }

    if (req.body.stockQuantity) {
      req.body.stockQuantity = parseInt(req.body.stockQuantity, 10);
    }

    // Parse boolean fields
    if (req.body.vatIncluded) {
      req.body.vatIncluded = req.body.vatIncluded === 'true';
    }

    // Parse JSON fields
    if (req.body.categorySpecs && typeof req.body.categorySpecs === 'string') {
      try {
        req.body.categorySpecs = JSON.parse(req.body.categorySpecs);
      } catch (error) {
        // If parsing fails, leave as string and let validation handle it
      }
    }

    if (req.body.specifications && typeof req.body.specifications === 'string') {
      try {
        req.body.specifications = JSON.parse(req.body.specifications);
      } catch (error) {
        // If parsing fails, leave as string and let validation handle it
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}