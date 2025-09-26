import { Request, Response, NextFunction } from 'express';

export const transformFrontendToBackend = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) {
    const transformObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(transformObject);
      } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
          const snakeKey = camelToSnake(key);
          acc[snakeKey] = transformObject(obj[key]);
          return acc;
        }, {} as any);
      }
      return obj;
    };

    const camelToSnake = (str: string): string => {
      return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    };

    if (req.body.firstName) req.body.first_name = req.body.firstName;
    if (req.body.lastName) req.body.last_name = req.body.lastName;
    if (req.body.nationalId) req.body.national_id = req.body.nationalId;
    if (req.body.companyName) req.body.company_name = req.body.companyName;
    if (req.body.crNumber) req.body.cr_number = req.body.crNumber;
    if (req.body.vatNumber) req.body.vat_number = req.body.vatNumber;
    if (req.body.userType) req.body.user_type = req.body.userType;

    delete req.body.firstName;
    delete req.body.lastName;
    delete req.body.nationalId;
    delete req.body.companyName;
    delete req.body.crNumber;
    delete req.body.vatNumber;
    delete req.body.userType;
  }

  next();
};