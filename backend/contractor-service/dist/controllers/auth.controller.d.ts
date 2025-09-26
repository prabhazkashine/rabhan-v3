import { Request, Response } from 'express';
export declare class AuthController {
    private authService;
    private phoneVerificationService;
    constructor();
    contractorRegister: (req: Request, res: Response) => Promise<void>;
    contractorLogin: (req: Request, res: Response) => Promise<void>;
    refreshToken: (req: Request, res: Response) => Promise<void>;
    getProfile: (req: Request, res: Response) => Promise<void>;
    sendPhoneOTP: (req: Request, res: Response) => Promise<void>;
    verifyPhoneOTP: (req: Request, res: Response) => Promise<void>;
}
export declare const authController: AuthController;
