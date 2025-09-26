"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationSchemas = void 0;
const contractor_schemas_1 = require("./contractor-schemas");
const phone_verification_schemas_1 = require("./phone-verification.schemas");
const contractor_profile_schemas_1 = require("./contractor-profile.schemas");
exports.validationSchemas = {
    contractorRegister: contractor_schemas_1.contractorRegisterSchema,
    contractorLogin: contractor_schemas_1.contractorLoginSchema,
    sendOTP: phone_verification_schemas_1.sendOTPSchema,
    verifyOTP: phone_verification_schemas_1.verifyOTPSchema,
    checkPhoneStatus: phone_verification_schemas_1.checkPhoneStatusSchema,
    contractorProfileCreate: contractor_profile_schemas_1.contractorProfileCreateSchema,
    contractorProfileUpdate: contractor_profile_schemas_1.contractorProfileUpdateSchema
};
