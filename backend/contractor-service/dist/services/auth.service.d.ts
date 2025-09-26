import { ContractorRegisterRequest } from '../validation/contractor-schemas';
import { AuthTokens } from '../utils/jwt';
export declare class AuthService {
    private phoneVerificationService;
    register(data: ContractorRegisterRequest): Promise<AuthTokens>;
    login(email: string, password: string, ipAddress?: string): Promise<AuthTokens>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
}
