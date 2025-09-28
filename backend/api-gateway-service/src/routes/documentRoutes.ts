import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';
import { autoPermissionCheck } from '../middleware/permissionMiddleware';

const DOCUMENT_SERVICE_URL = process.env.DOCUMENT_SERVICE_URL;

type PathRewriteMap = Record<string, string>;

const createProxy = (target: string, pathRewrites: PathRewriteMap = {}): HpmRequestHandler => {
  if (!target) {
    throw new Error('DOCUMENT_SERVICE_URL is not defined in the environment.');
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

const documentRouter = Router();

// Create proxy for document service
const documentProxy = createProxy(DOCUMENT_SERVICE_URL!, {
    '^/': '/api/documents/',
});

const categoryProxy = createProxy(DOCUMENT_SERVICE_URL!, {
    '^/': '/api/document-categories/',
});



documentRouter.use('/documents',
    userAuth,
    autoPermissionCheck("DOCUMENTS"),
    documentProxy
);


documentRouter.use('/document-categories',
    userAuth,
    autoPermissionCheck("DOCUMENTS"),
    categoryProxy
);

export default documentRouter;