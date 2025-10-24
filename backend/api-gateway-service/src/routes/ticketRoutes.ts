import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';
import { autoPermissionCheck } from '../middleware/permissionMiddleware';

const TICKET_SERVICE_URL = process.env.TICKET_SERVICE_URL;

type PathRewriteMap = Record<string, string>;

const createProxy = (target: string, pathRewrites: PathRewriteMap = {}): HpmRequestHandler => {
  if (!target) {
    throw new Error('TICKET_SERVICE_URL is not defined in the environment.');
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

const ticketsRouter = Router();

const ticketsProxy = createProxy(TICKET_SERVICE_URL!, {
    '^/': '/api/tickets/',
});


ticketsRouter.use('/tickets',
    userAuth,
    ticketsProxy
);


export default ticketsRouter;