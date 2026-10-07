import { Broadcast } from '../models/Broadcast.js';
import { User } from '../models/User.js';
import { userService } from './userService.js';
import { errorSummary } from '../utils/errors.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export const broadcastService = {
  async queue(sourceChatId, sourceMessageId, adminId) {
    return Broadcast.findOneAndUpdate({ sourceChatId, sourceMessageId, adminId }, { $setOnInsert: { sourceChatId, sourceMessageId, adminId } }, { upsert: true, new: true });
  },
  async runNext(bot, signal) {
    const now = new Date();
    const job = await Broadcast.findOneAndUpdate({ $or: [{ status: 'queued' }, { status: 'running', leaseUntil: { $lte: now } }] },
      { $set: { status: 'running', leaseUntil: new Date(Date.now() + 120000) } }, { new: true, sort: { createdAt: 1 } });
    if (!job) return false;
    let lastUserId = job.lastUserId;
    try {
      while (!signal.aborted) {
        const users = await User.find({ isBlocked: false, telegramId: { $gt: lastUserId } }).sort({ telegramId: 1 }).limit(50).lean();
        if (!users.length) break;
        for (const user of users) {
          if (signal.aborted) return true;
          let success = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try { await bot.copyMessage(user.telegramId, job.sourceChatId, job.sourceMessageId); success = true; break; }
            catch (e) {
              if (e.error_code === 403) { await userService.setBlocked(user.telegramId, true); break; }
              if (e.retryAfter) {
                await Broadcast.updateOne({ _id: job._id }, { $set: { leaseUntil: new Date(Date.now() + (e.retryAfter + 120) * 1000) } });
                await delay(Math.min(e.retryAfter, 3600) * 1000); continue;
              }
              if (!e.error_code || e.error_code >= 500) { await delay(1000 * (attempt + 1)); continue; }
              break;
            }
          }
          lastUserId = user.telegramId;
          await Broadcast.updateOne({ _id: job._id }, { $set: { lastUserId, leaseUntil: new Date(Date.now() + 120000) }, $inc: { [success ? 'sent' : 'failed']: 1 } });
          await delay(65); // Below Telegram's free broadcast rate.
        }
      }
      if (!signal.aborted) {
        await Broadcast.updateOne({ _id: job._id }, { $set: { status: 'done' } });
        const done = await Broadcast.findById(job._id).lean();
        await bot.sendMessage(job.adminId, `📣 Broadcast tugadi. Yuborildi: ${done.sent}; xato: ${done.failed}.`).catch(() => {});
      }
    } catch (e) { console.error('broadcast', errorSummary(e)); }
    return true;
  },
};
