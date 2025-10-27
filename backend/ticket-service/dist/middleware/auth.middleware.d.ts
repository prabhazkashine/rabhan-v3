import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email?: string;
        role: string;
    };
}
declare class AuthMiddleware {
    authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    authorizeRole: (allowedRoles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
}
export declare const authMiddleware: AuthMiddleware;
export {};
