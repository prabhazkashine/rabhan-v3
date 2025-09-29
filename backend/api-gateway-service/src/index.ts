import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import { createProxyMiddleware, Filter, Options, RequestHandler } from 'http-proxy-middleware';
import { authenticateToken } from './middleware/authMiddleware';
import { createPermissionMiddleware } from './middleware/dynamicPermissionMiddleware';
import adminRouter from './routes/adminRoutes';
import documentRouter from './routes/documentRoutes';
import productRouter from './routes/productRoutes';

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 8000;

const VENDOR_SERVICE_URL = process.env.VENDOR_SERVICE_URL;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

app.use(authenticateToken);


const createProxy = (target: string, pathRewrites: Record<string, string> = {}): RequestHandler => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: pathRewrites,
    logger: console, 
  });
};

app.use('/api/users/auth', createProxy(USER_SERVICE_URL!)); 
app.use('/api/vendors/auth', createProxy(VENDOR_SERVICE_URL!));
app.use('/api/admin/auth', createProxy(ADMIN_SERVICE_URL!));


// Use permission-based product router
app.use('/api', productRouter);


app.use('/api', documentRouter);
app.use('/api', adminRouter);


app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
  console.log(`Routes: 
  - /api/users/auth -> User Service
  - /api/vendors/auth -> Vendor Service
  - /api/admin/auth -> Admin Service
  - /api/products -> Product Service (Authenticated)
  - /api/documents -> Document Service (Authenticated)
  `);
});