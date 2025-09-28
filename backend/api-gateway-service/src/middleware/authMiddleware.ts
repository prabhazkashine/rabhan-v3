import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const VENDOR_SERVICE_URL = process.env.VENDOR_SERVICE_URL;
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL;

const AUTH_SERVICES = [
  { url: VENDOR_SERVICE_URL, role: 'Vendor' },
  { url: USER_SERVICE_URL, role: 'User' },
  { url: ADMIN_SERVICE_URL, role: 'Admin' },
];

interface AuthData {
  id: string;
  email: string;
  role: 'USER' | 'VENDOR' | 'ADMIN';
  sessionId: string;
  isValid: boolean;
}

interface AuthVerificationResponse {
  success: boolean;
  message: string;
  data: AuthData;
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer TOKEN"

  if (!token) {
    return next();
  }

  for (const service of AUTH_SERVICES) {
    if (!service.url) continue;


    try {
      const response = await axios.get<AuthVerificationResponse>(
        `${service.url}/api/auth/verify`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );


      if (response.status === 200 && response.data.success === true && response.data.data.isValid === true) {
        
        const userData = response.data.data;

        req.headers['x-user-id'] = userData.id;
        req.headers['x-user-role'] = userData.role.toLowerCase(); 
        
        req.headers['x-user-email'] = userData.email;
        req.headers['x-session-id'] = userData.sessionId;


        return next();
      }
    } catch (error) {
      console.error(`Error connecting to auth service at ${service.url}:`, (error as Error).message);
    }
  }

  return res.status(401).send('Unauthorized: Invalid or expired token.');
};