import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config/index.js';
import { errorSummary } from './utils/errors.js';
export function validWebhookSecret(actual, expected) {
  if (typeof actual !== 'string' || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createApp({ processUpdate, state, getDbState, cfg = config }) {
  const app = express(); app.disable('x-powered-by');
  app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kinobot</title><style>body{background:#0e1322;color:#f1f4fc;font:18px system-ui;max-width:620px;margin:12vh auto;padding:28px}h1{font-size:48px}a{color:#92b9ff}small{color:#aeb8cc}</style><h1>🎬 Kinobot</h1><p>Telegram kino katalogi: qidiruv, saqlanganlar, VIP va majburiy obuna.</p><p>${state.ready ? 'Bot ishga tushgan.' : 'Bot sozlamalari tayyorlanmoqda.'}</p><small>Texnik holat: <a href="/health">/health</a></small></html>`));
  app.get('/health', (_req, res) => {
    const ready = state.ready && getDbState() === 1;
    res.status(ready ? 200 : 503).json({ ok: ready, status: ready ? 'ready' : state.phase, database: getDbState() === 1 ? 'connected' : 'disconnected', telegram: state.telegram ? 'connected' : 'not_connected', mode: cfg.mode });
  });
  app.get('/live', (_req, res) => res.json({ ok: true }));
  if (cfg.mode === 'webhook') {
    app.post(cfg.webhookPath, (req, res, next) => {
      if (!validWebhookSecret(req.get('x-telegram-bot-api-secret-token'), cfg.webhookSecret)) return res.sendStatus(403);
      if (!state.ready || getDbState() !== 1) return res.sendStatus(503);
      next();
    }, express.json({ limit: '1mb' }), async (req, res) => {
      try { await processUpdate(req.body); res.sendStatus(200); }
      catch (e) { console.error('webhook', errorSummary(e)); res.sendStatus(e.status === 400 ? 400 : 503); }
    });
  }
  app.use((_req, res) => res.sendStatus(404));
  app.use((e, _req, res, _next) => { console.error('http', errorSummary(e)); res.sendStatus(e.status || 500); });
  return app;
}
