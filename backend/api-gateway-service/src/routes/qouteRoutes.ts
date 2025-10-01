import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';
import { autoPermissionCheck } from '../middleware/permissionMiddleware';

const QOUTE_SERVICE_URL = process.env.QOUTE_SERVICE_URL;

type PathRewriteMap = Record<string, string>;

const createProxy = (target: string, pathRewrites: PathRewriteMap = {}): HpmRequestHandler => {
  if (!target) {
    throw new Error('QOUTE_SERVICE_URL is not defined in the environment.');
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

const userAuth: RequestHandler = (req, res, next) => {
    if (!req.headers['x-user-role']) {
        return res.status(401).send('Unauthorized: Please log in.');
    }
    next();
};

const qouteRouter = Router();

const documentProxy = createProxy(QOUTE_SERVICE_URL!, {
    '^/': '/api/quotes/',
});



const businessConfigProxy = createProxy(QOUTE_SERVICE_URL!, {
    '^/': '/api/business-config/',
});

qouteRouter.use('/quotes',
    userAuth,
    documentProxy
);


qouteRouter.use('/business-config',
    superAdminAuth,
    businessConfigProxy
);


export default qouteRouter;