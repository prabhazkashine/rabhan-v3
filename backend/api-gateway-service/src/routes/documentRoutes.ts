import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';

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

documentRouter.use('/document-categories', userAuth, createProxy(DOCUMENT_SERVICE_URL!, {
    '^/': '/api/document-categories/', 
}));

documentRouter.use('/documents', userAuth, createProxy(DOCUMENT_SERVICE_URL!, {
    '^/': '/api/documents/', 
}));

export default documentRouter;