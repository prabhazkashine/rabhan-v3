"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformFrontendToBackend = void 0;
const transformFrontendToBackend = (req, res, next) => {
    if (req.body) {
        // Transform camelCase from frontend to snake_case for backend
        const transformObject = (obj) => {
            if (Array.isArray(obj)) {
                return obj.map(transformObject);
            }
            else if (obj !== null && typeof obj === 'object') {
                return Object.keys(obj).reduce((acc, key) => {
                    const snakeKey = camelToSnake(key);
                    acc[snakeKey] = transformObject(obj[key]);
                    return acc;
                }, {});
            }
            return obj;
        };
        const camelToSnake = (str) => {
            return str.replace(/([A-Z])/g, '_$1').toLowerCase();
        };
        // Common transformations
        if (req.body.firstName)
            req.body.first_name = req.body.firstName;
        if (req.body.lastName)
            req.body.last_name = req.body.lastName;
        if (req.body.nationalId)
            req.body.national_id = req.body.nationalId;
        if (req.body.companyName)
            req.body.company_name = req.body.companyName;
        if (req.body.crNumber)
            req.body.cr_number = req.body.crNumber;
        if (req.body.vatNumber)
            req.body.vat_number = req.body.vatNumber;
        if (req.body.userType)
            req.body.user_type = req.body.userType;
        // Remove camelCase versions
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
exports.transformFrontendToBackend = transformFrontendToBackend;
