import { config } from '../config/index.js';

export function isAdmin(telegramId) {
  const id = Number(telegramId);
  return config.adminIds.includes(id);
}
