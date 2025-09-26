import { Request, Response } from 'express';
export declare class PhoneVerificationController {
    private phoneVerificationService;
    sendOTP: (req: Request, res: Response) => Promise<void>;
    verifyOTP: (req: Request, res: Response) => Promise<void>;
    checkPhoneStatus: (req: Request, res: Response) => Promise<void>;
    sendOTPPublic: (req: Request, res: Response) => Promise<void>;
    verifyOTPPublic: (req: Request, res: Response) => Promise<void>;
}
export declare const phoneVerificationController: PhoneVerificationController;
