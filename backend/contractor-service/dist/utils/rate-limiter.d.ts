import { Request, Response, NextFunction } from 'express';
export declare const authRateLimit: (req: Request, res: Response, next: NextFunction) => void;
export declare const generalRateLimit: (req: Request, res: Response, next: NextFunction) => void;
