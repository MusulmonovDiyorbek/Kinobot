import 'dotenv/config'; // 🔥 .env ni yuklash (ENG MUHIM)

import mongoose from 'mongoose';
import { config, validateConfig } from './config/index.js';
import { createBot, syncWebhook } from './bot/createBot.js';
import { registerHandlers } from './bot/registerHandlers.js';
import { createApp } from './app.js';
import { broadcastService } from './services/broadcastService.js';
import { adService } from './services/adService.js';

async function main() {
  // 🔍 Config tekshirish
  const errors = validateConfig();
  if (errors.length) {
    console.error('Config errors:', errors.join('; '));
    process.exit(1);
  }

  // 🔌 MongoDB ulanish
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  console.log('✅ MongoDB connected');

  // 📦 Index sync
  await Promise.all(
    Object.values(mongoose.models).map((m) =>
      m.syncIndexes().catch((e) =>
        console.error('syncIndexes', m.modelName, e.message)
      )
    )
  );

  // 🤖 Bot yaratish
  const bot = createBot();
  registerHandlers(bot);

  // 🌐 Express app
  const app = createApp(config.webhookUrl ? bot : null);

  app.listen(config.port, async () => {
    console.log(`🚀 HTTP listening on :${config.port}`);

    if (config.webhookUrl) {
      await syncWebhook(bot);
      console.log(
        `📡 Webhook: ${config.webhookUrl.replace(/\/$/, '')}${config.webhookPath}`
      );
    } else {
      console.log('🤖 Long polling enabled');
    }
  });

  // 📢 Reklama scheduler
  if (config.adBroadcastIntervalMinutes > 0) {
    const ms = config.adBroadcastIntervalMinutes * 60_000;

    setInterval(async () => {
      try {
        const ad = await adService.getLatestActive();
        if (!ad) return;

        const mode =
          ad.parseMode && ad.parseMode !== '' ? ad.parseMode : 'HTML';

        await broadcastService.broadcastToUsers(async (uid) => {
          if (ad.photoFileId) {
            await bot.sendPhoto(uid, ad.photoFileId, {
              caption: ad.text,
              parse_mode: mode,
            });
          } else {
            await bot.sendMessage(uid, ad.text, {
              parse_mode: mode,
            });
          }
        });
      } catch (e) {
        console.error('❌ scheduled_ads', e);
      }
    }, ms);

    console.log(
      `📢 Scheduled ads every ${config.adBroadcastIntervalMinutes} min`
    );
  }

  // 🛑 Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`⚠️ ${signal} received, shutting down...`);
    try {
      if (!config.webhookUrl) await bot.stopPolling();
    } catch {
      /* ignore */
    }
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// 🚨 Global error catch
main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});