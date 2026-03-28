import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/index.js';

export function createBot() {
  const useWebhook = Boolean(config.webhookUrl);
  return new TelegramBot(config.botToken, {
    polling: !useWebhook,
  });
}

/**
 * @param {TelegramBot} bot
 */
export async function syncWebhook(bot) {
  if (config.webhookUrl) {
    const url = `${config.webhookUrl.replace(/\/$/, '')}${config.webhookPath}`;
    await bot.setWebHook(url);
  } else {
    await bot.deleteWebHook({ drop_pending_updates: false });
  }
}
