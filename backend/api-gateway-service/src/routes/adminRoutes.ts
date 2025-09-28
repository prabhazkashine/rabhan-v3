import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';
import { autoPermissionCheck } from '../middleware/permissionMiddleware';

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

const adminProxy = createProxy(ADMIN_SERVICE_URL!, {
    '^/': '/api/admins/',
});

const rolesProxy = createProxy(ADMIN_SERVICE_URL!, {
    '^/': '/api/roles/',
});

const permissionsProxy = createProxy(ADMIN_SERVICE_URL!, {
    '^/': '/api/permissions/',
});


adminRouter.use('/admins',
    superAdminAuth,
    autoPermissionCheck("ADMINS"),
    adminProxy
);


adminRouter.use('/roles',
    superAdminAuth,
    autoPermissionCheck("ROLES"),
    rolesProxy
);


adminRouter.use('/permissions',
    adminAuth,
    permissionsProxy
);

export default adminRouter;