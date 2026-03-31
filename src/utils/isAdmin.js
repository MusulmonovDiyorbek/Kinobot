import { config } from '../config/index.js';

export function isAdmin(telegramId) {
  try {
    if (!telegramId) {
      console.warn('❌ isAdmin: telegramId yo‘q');
      return false;
    }

    const id = Number(telegramId);

    if (!Number.isFinite(id)) {
      console.warn('❌ isAdmin: noto‘g‘ri telegramId:', telegramId);
      return false;
    }

    if (!Array.isArray(config.adminIds) || config.adminIds.length === 0) {
      console.warn('❌ isAdmin: ADMIN_IDS bo‘sh yoki noto‘g‘ri');
      return false;
    }

    const isAdminUser = config.adminIds.includes(id);

    // 🔍 DEBUG (istasa o‘chirib qo‘yasan keyin)
    console.log(`isAdmin check -> ${id}: ${isAdminUser}`);

    return isAdminUser;
  } catch (err) {
    console.error('❌ isAdmin error:', err);
    return false;
  }
}