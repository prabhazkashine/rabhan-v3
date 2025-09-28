import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL;

type PathRewriteMap = Record<string, string>;

const createProxy = (target: string, pathRewrites: PathRewriteMap = {}): HpmRequestHandler => {
  if (!target) {
    throw new Error('ADMIN_SERVICE_URL is not defined in the environment.');
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


const adminRouter = Router();

adminRouter.use('/admins', superAdminAuth, createProxy(ADMIN_SERVICE_URL!, {
    '^/': '/api/admins/', 
}));

adminRouter.use('/roles', superAdminAuth, createProxy(ADMIN_SERVICE_URL!, {
    '^/': '/api/roles/', 
}));

adminRouter.use('/permissions', adminAuth, createProxy(ADMIN_SERVICE_URL!, {
    '^/': '/api/permissions/', 
}));

export default adminRouter;