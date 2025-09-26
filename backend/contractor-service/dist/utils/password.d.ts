export interface PasswordValidation {
    valid: boolean;
    errors: string[];
}
declare class PasswordUtils {
    private static readonly SALT_LENGTH;
    private static readonly HASH_ITERATIONS;
    private static readonly KEY_LENGTH;
    static validate(password: string): PasswordValidation;
    static hash(password: string): Promise<string>;
    static verify(password: string, hashedPassword: string): Promise<boolean>;
}
export { PasswordUtils };
