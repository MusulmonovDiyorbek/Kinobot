import 'dotenv/config';
export function loadConfig(env = process.env) {
  const adminIds = String(env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
  return {
    botToken: env.BOT_TOKEN || '', adminIds,
    mongoUri: env.MONGODB_URI || '', port: Number(env.PORT || 3000),
    nodeEnv: env.NODE_ENV || 'development',
    mode: env.BOT_MODE || (env.WEBHOOK_URL ? 'webhook' : 'polling'),
    webhookUrl: (env.WEBHOOK_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/$/, ''),
    webhookPath: env.WEBHOOK_PATH || '/telegram/webhook', webhookSecret: env.WEBHOOK_SECRET || '',
    startGif: env.START_GIF_FILE_ID || '', supportUsername: (env.SUPPORT_USERNAME || '').replace(/^@/, ''),
    devInfo: env.DEV_INFO || 'Kinobot — Node.js va MongoDB',
  };
}
export const config = loadConfig();
export function validateConfig(c = config) {
  const errors = [];
  if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(c.botToken)) errors.push('BOT_TOKEN is required and must be a valid BotFather token');
  if (!/^mongodb(?:\+srv)?:\/\//.test(c.mongoUri)) errors.push('MONGODB_URI is required');
  if (!c.adminIds.length || c.adminIds.some(n => !Number.isSafeInteger(n) || n <= 0)) errors.push('ADMIN_IDS must contain positive Telegram user IDs');
  if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) errors.push('PORT is invalid');
  if (!['polling', 'webhook'].includes(c.mode)) errors.push('BOT_MODE must be polling or webhook');
  if (c.mode === 'webhook') {
    if (!/^https:\/\//.test(c.webhookUrl)) errors.push('WEBHOOK_URL must use HTTPS (Render URL is detected automatically)');
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(c.webhookSecret)) errors.push('WEBHOOK_SECRET must contain 32–256 letters, digits, _ or -');
    if (!/^\/[A-Za-z0-9/_-]+$/.test(c.webhookPath)) errors.push('WEBHOOK_PATH is invalid');
  }
  return errors;
}
