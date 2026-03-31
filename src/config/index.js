// src/config/index.js
import 'dotenv/config';

/**
 * ADMIN_IDS qatorini arrayga aylantirish
 * @param {string} raw
 * @returns {number[]}
 */
function parseAdminIds(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  adminIds: parseAdminIds(process.env.ADMIN_IDS),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kinobot',
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  webhookUrl: (process.env.WEBHOOK_URL || '').trim(),
  webhookPath: process.env.WEBHOOK_PATH || '/telegram/webhook',
  adBroadcastIntervalMinutes: Number(process.env.AD_BROADCAST_INTERVAL_MINUTES) || 0,
};

/**
 * Configni tekshirish
 * @returns {string[]} xatolar ro‘yxati
 */
export function validateConfig() {
  const errors = [];
  if (!config.botToken) errors.push('BOT_TOKEN is required');
  if (!config.mongoUri) errors.push('MONGODB_URI is required');
  if (!config.adminIds.length) errors.push('ADMIN_IDS must contain at least one numeric ID');
  return errors;
}

/**
 * Ishga tushirishda avtomatik tekshirish
 */
const cfgErrors = validateConfig();
if (cfgErrors.length) {
  console.error('❌ Configuration errors:', cfgErrors.join('; '));
  process.exit(1);
}