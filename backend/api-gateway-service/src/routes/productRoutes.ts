import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';
import { autoPermissionCheck } from '../middleware/permissionMiddleware';

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;

type PathRewriteMap = Record<string, string>;

const createProxy = (target: string, pathRewrites: PathRewriteMap = {}): HpmRequestHandler => {
  if (!target) {
    throw new Error('PRODUCT_SERVICE_URL is not defined in the environment.');
  }
  
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: pathRewrites,
    logger: console, 
  });
};

const superAdminAuth: RequestHandler = (req, res, next) => {
    const userRole = req.headers['x-user-role'];

    if (userRole !== 'super_admin') {
        return res.status(403).send('Forbidden: Only Super Admin can access this resource.');
    }
    next();
};


const adminAuth: RequestHandler = (req, res, next) => {
    const userRole = req.headers['x-user-role'];

    if (userRole !== 'admin') {
        return res.status(403).send('Forbidden: Only Super Admin can access this resource.');
    }
    next();
};


const productRouter = Router();

const productCategoryProxy = createProxy(PRODUCT_SERVICE_URL!, {
    '^/': '/api/product-categories/',
});


productRouter.use('/product-categories',
    superAdminAuth,
    autoPermissionCheck("ADMINS"),
    productCategoryProxy
);

export default productRouter;