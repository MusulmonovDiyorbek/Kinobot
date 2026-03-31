// src/bot/createBot.js
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/index.js';

/**
 * Telegram botni yaratish
 * @returns {TelegramBot}
 */
export function createBot() {
  if (!config.botToken) {
    throw new Error('Bot token is not set in config!');
  }

  const useWebhook = Boolean(config.webhookUrl);

  const bot = new TelegramBot(config.botToken, {
    polling: !useWebhook,
    // agar polling ishlatilsa, timeout va limitlarni sozlash mumkin
    ...( !useWebhook && { polling: { interval: 3000, autoStart: true } } ),
  });

  return bot;
}

/**
 * Webhookni sinxronizatsiya qilish
 * @param {TelegramBot} bot
 */
export async function syncWebhook(bot) {
  if (!bot) throw new Error('Bot instance is required for webhook sync');

  try {
    if (config.webhookUrl) {
      const url = `${config.webhookUrl.replace(/\/$/, '')}${config.webhookPath || ''}`;
      await bot.setWebHook(url);
      console.log('✅ Webhook set to:', url);
    } else {
      await bot.deleteWebHook({ drop_pending_updates: false });
      console.log('✅ Webhook removed, using long polling');
    }
  } catch (err) {
    console.error('Webhook sync error:', err);
  }
}