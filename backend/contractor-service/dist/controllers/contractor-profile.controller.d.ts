import { Request, Response } from 'express';
export declare class ContractorProfileController {
    getProfile: (req: Request, res: Response) => Promise<void>;
    createProfile: (req: Request, res: Response) => Promise<void>;
    updateProfile: (req: Request, res: Response) => Promise<void>;
    deleteProfile: (req: Request, res: Response) => Promise<void>;
}
export declare const contractorProfileController: ContractorProfileController;
