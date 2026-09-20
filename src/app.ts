import express from 'express';
import type { ErrorRequestHandler } from 'express';
import type { Repository } from './shared/contracts.js';
import { ApiError } from './http/errors.js';
import { createRoutes } from './http/routes.js';
export function createApp(repo: Repository, ready: () => boolean = () => true) {
  const app = express(); app.disable('x-powered-by'); app.disable('etag');
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/health', (_req, res) => { const ok = ready(); res.status(ok ? 200 : 503).json({ ready: ok }); });
  app.use('/api', (_req, res, next) => { if (ready()) next(); else res.status(503).json({ error: 'DATABASE_UNAVAILABLE' }); });
  app.use('/api', createRoutes(repo));
  app.use((_req, res) => { res.status(404).json({ error: 'ROUTE_NOT_FOUND' }); });
  const errors: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    if (err instanceof ApiError) { res.status(err.status).json({ error: err.code, message: err.message }); return; }
    console.error(err instanceof Error ? err.message : 'Unknown error');
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  };
  app.use(errors); return app;
}
