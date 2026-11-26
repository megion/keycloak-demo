import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { pino } from 'pino';
import { config } from './config';
import { ApiError } from './errors';
import { warmUpOpenIdConfig } from './jwt';
import { apiRouter } from './routes';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/** Maps ApiError to a JSON body `{ code, message }`; everything else becomes a 500. */
function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    logger.warn({ code: err.code, status: err.status, path: req.path }, err.message);
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }
  logger.error(err, 'Unexpected internal error');
  res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
}

/** Builds the Express application (exported so unit tests can spin it up). */
export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: config.allowedOrigins }));
  app.use('/api', apiRouter);
  app.use((req, res) => res.status(404).json({ code: 'not_found', message: `No endpoint for ${req.method} ${req.path}` }));
  app.use(errorHandler);
  return app;
}

async function main(): Promise<void> {
  await warmUpOpenIdConfig();
  createApp().listen(config.port, () => {
    logger.info(`MyApp backend listening on http://localhost:${config.port}/api`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(err, 'Backend failed to start');
    process.exit(1);
  });
}
