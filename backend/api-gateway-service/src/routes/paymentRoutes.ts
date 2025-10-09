import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL;

type PathRewriteMap = Record<string, string>;

const createProxy = (target: string, pathRewrites: PathRewriteMap = {}): HpmRequestHandler => {
  if (!target) {
    throw new Error('PAYMENT_SERVICE_URL is not defined in the environment.');
  }

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: pathRewrites,
    logger: console,
  });
};

const userAuth: RequestHandler = (req, res, next) => {
    if (!req.headers['x-user-role']) {
        return res.status(401).send('Unauthorized: Please log in.');
    }
    next();
};

const adminAuth: RequestHandler = (req, res, next) => {
    const userRole = req.headers['x-user-role'];

    if (userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).send('Forbidden: Only Admin can access this resource.');
    }
    next();
};

const paymentRouter = Router();

// User payment routes - proxy to payment service
const paymentsProxy = createProxy(PAYMENT_SERVICE_URL!, {
    '^/': '/api/payments/',
});

paymentRouter.use('/payments',
    userAuth,
    paymentsProxy
);

export default paymentRouter;
