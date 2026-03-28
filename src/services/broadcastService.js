import { userService } from './userService.js';

const CHUNK = 25;
const DELAY_MS = 50;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @param {(chatId: number) => Promise<void>} sender */
async function broadcastToUsers(sender) {
  const cursor = userService.streamNonBlocked();
  let sent = 0;
  let failed = 0;

  for await (const user of cursor) {
    try {
      await sender(user.telegramId);
      sent += 1;
      if (sent % CHUNK === 0) await sleep(DELAY_MS);
    } catch (e) {
      failed += 1;
      const desc = e?.response?.body?.description || e?.message || '';
      if (String(desc).includes('blocked') || String(desc).includes('deactivated')) {
        await userService.setBlocked(user.telegramId, true).catch(() => {});
      }
    }
  }

  return { sent, failed };
}

export const broadcastService = { broadcastToUsers };
