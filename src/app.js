import express from 'express';
import { config } from './config/index.js';
import { createApiRouter } from './routes/index.js';
import { notFoundHandler, errorHandler } from './middlewares/errorMiddleware.js';

/**
 * @param {import('node-telegram-bot-api').default | null} bot — required for webhook mode
 */
export function createApp(bot) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(createApiRouter());

  if (config.webhookUrl && bot) {
    app.post(config.webhookPath, (req, res) => {
      try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
      } catch (e) {
        console.error('webhook processUpdate', e);
        res.sendStatus(500);
      }
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
