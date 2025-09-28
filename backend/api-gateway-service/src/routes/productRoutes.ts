import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createPermissionMiddleware } from '../middleware/dynamicPermissionMiddleware';

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;

const productRouter = Router();

const productProxy = createProxyMiddleware({
  target: PRODUCT_SERVICE_URL!,
  changeOrigin: true,
  pathRewrite: {
    '^/api/products': '/api/products',
  },
  logger: console,
});

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.headers['x-user-role']) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Please log in.'
    });
  }
  next();
};


productRouter.use('/document-categories',
    requireAuth,
    (req, res, next) => {
        const method = req.method.toUpperCase();
        let action: string;

        switch (method) {
            case 'GET':
                action = 'READ';
                break;
            case 'POST':
                action = 'create';
                break;
            case 'PUT':
            case 'PATCH':
                action = 'update';
                break;
            case 'DELETE':
                action = 'delete';
                break;
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }

        const permissionMiddleware = createPermissionMiddleware('PRODUCTS', action.toUpperCase());
        permissionMiddleware(req, res, next);
    },
    productProxy
);

export default productRouter;