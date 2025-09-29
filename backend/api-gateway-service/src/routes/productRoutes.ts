import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
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

const userAuth: RequestHandler = (req, res, next) => {
    if (req.headers['x-user-role'] !== "contractor") {
        return res.status(401).send('Unauthorized: Only contractor can access this.');
    }
    next();
};

const adminOrSuperAdminAuth: RequestHandler = (req, res, next) => {
    const userRole = req.headers['x-user-role'];

    if (userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).send('Forbidden: Only Admin or Super Admin can access this resource.');
    }
    next();
};


const productRouter = Router();

const productCategoryProxy = createProxy(PRODUCT_SERVICE_URL!, {
    '^/': '/api/product-categories/',
});

const productProxy = createProxy(PRODUCT_SERVICE_URL!, {
    '^/': '/api/products/',
});


// productRouter.use('/product-categories',
//     superAdminAuth,
//     autoPermissionCheck("PRODUCTS"),
//     productCategoryProxy
// );


productRouter.use('/product-categories',(req: Request, res: Response, next: NextFunction) => {
    const publicPaths = ['/public'];
    const isPublicPath = publicPaths.some(path => req.path.startsWith(path));

    if (isPublicPath) {
        return productCategoryProxy(req, res, next);
    } else {
        const protectedChain = Router({ mergeParams: true });
        protectedChain.use(superAdminAuth);
        protectedChain.use(productCategoryProxy);

        return protectedChain(req, res, next);
    }
});

productRouter.use('/products', (req: Request, res: Response, next: NextFunction) => {
    const publicPaths = ['/public'];
    const isPublicPath = publicPaths.some(path => req.path.startsWith(path));

    const adminPaths = ['/approve'];
    const isAdminOnlyPath = adminPaths.some(path => {
        const slugPattern = /^\/[^\/]+\/approve/;
        return slugPattern.test(req.path);
    });

    if (isPublicPath) {
        return productProxy(req, res, next);
    } else if (isAdminOnlyPath) {
        const adminChain = Router({ mergeParams: true });
        adminChain.use(adminOrSuperAdminAuth);

        adminChain.use((req: Request, res: Response, next: NextFunction) => {
            if (req.headers['x-user-role'] === 'super_admin') {
                return next();
            }
            return autoPermissionCheck("PRODUCTS")(req, res, next);
        });

        adminChain.use(productProxy);
        return adminChain(req, res, next);
    } else {
        const protectedChain = Router({ mergeParams: true });
        protectedChain.use(userAuth);
        protectedChain.use(productProxy);

        return protectedChain(req, res, next);
    }
});

export default productRouter;