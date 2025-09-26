import { contractorRegisterSchema, contractorLoginSchema } from './contractor-schemas';
import { sendOTPSchema, verifyOTPSchema, checkPhoneStatusSchema } from './phone-verification.schemas';
import { contractorProfileCreateSchema, contractorProfileUpdateSchema } from './contractor-profile.schemas';

export const validationSchemas = {
  contractorRegister: contractorRegisterSchema,
  contractorLogin: contractorLoginSchema,
  sendOTP: sendOTPSchema,
  verifyOTP: verifyOTPSchema,
  checkPhoneStatus: checkPhoneStatusSchema,
  contractorProfileCreate: contractorProfileCreateSchema,
  contractorProfileUpdate: contractorProfileUpdateSchema
};