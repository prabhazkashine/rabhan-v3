import { Router, RequestHandler } from 'express';
import { createProxyMiddleware, RequestHandler as HpmRequestHandler } from 'http-proxy-middleware';

const SOLAR_CALCULATOR_SERVICE_URL = process.env.SOLAR_CALCULATOR_SERVICE_URL;

type PathRewriteMap = Record<string, string>;

const createProxy = (target: string, pathRewrites: PathRewriteMap = {}): HpmRequestHandler => {
  if (!target) {
    throw new Error('SOLAR_CALCULATOR_SERVICE_URL is not defined in the environment.');
  }
  
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: pathRewrites,
    logger: console, 
  });
};

const solarCalculatorRouter = Router();

const solarCalculatorProxy = createProxy(SOLAR_CALCULATOR_SERVICE_URL!, {
    '^/': '/api/solar/',
});

solarCalculatorRouter.use('/solar',
    solarCalculatorProxy
);


export default solarCalculatorRouter;