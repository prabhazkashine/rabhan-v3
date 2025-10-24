import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import { createProxyMiddleware, Filter, Options, RequestHandler } from 'http-proxy-middleware';
import { authenticateToken } from './middleware/authMiddleware';
import adminRouter from './routes/adminRoutes';
import documentRouter from './routes/documentRoutes';
import productRouter from './routes/productRoutes';
import qouteRouter from './routes/qouteRoutes';
import solarCalculatorRouter from './routes/solarCalculatorRoutes';
import projectsRouter from './routes/projectRoutes';
import paymentRouter from './routes/paymentRoutes';
import cors from 'cors';
import ticketsRouter from './routes/ticketRoutes';

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 8000;

const VENDOR_SERVICE_URL = process.env.VENDOR_SERVICE_URL;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

app.use(cors());

const conditionalAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api/products/public') || req.path.startsWith('/api/product-categories/public') || req.path.startsWith('/api/solar/calculate')) {
    return next();
  }

  if (req.path.startsWith('/api/users/auth') ||
      req.path.startsWith('/api/vendors/auth') ||
      req.path.startsWith('/api/admin/auth')) {
    return next();
  }

  return authenticateToken(req, res, next);
};

app.use(conditionalAuth);

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

app.use('/api', qouteRouter);

app.use('/api', solarCalculatorRouter);

app.use('/api', projectsRouter);

app.use('/api', paymentRouter);

app.use('/api', ticketsRouter);



app.listen(PORT, () => {
  console.log(`✅ API Gateway running on port ${PORT}`);
  console.log(`Routes:
  - /api/users/auth -> User Service (No Auth)
  - /api/vendors/auth -> Vendor Service (No Auth)
  - /api/admin/auth -> Admin Service (No Auth)
  - /api/products/public -> Product Service (No Auth - Public)
  - /api/products -> Product Service (Authenticated)
  - /api/documents -> Document Service (Authenticated)
  - /api/quotes -> Qoute Service (Authenticated)
  - /api/solar/calculate -> Solar Calculator Service (No Auth)
  - /api/projects/ -> Projects Service (Authenticated)
  - /api/payments/ -> Payment Service (Authenticated)
  - /api/tickets/ -> Tickets Service (Authenticated)
  `);
});