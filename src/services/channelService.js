import { Channel } from '../models/Channel.js';
import { cacheService } from './cacheService.js';
import { UserError } from '../utils/errors.js';
export function validateInviteLink(link) {
  try { const u = new URL(link); return u.protocol === 'https:' && ['t.me', 'telegram.me'].includes(u.hostname) && u.pathname.length > 1; } catch { return false; }
}
export const channelService = {
  invalidate() { cacheService.del('channels:required'); },
  async listActive() {
    const hit = cacheService.get('channels:required'); if (hit) return hit;
    const list = await Channel.find({ isActive: true }).sort({ createdAt: 1 }).lean();
    cacheService.set('channels:required', list, 30); return list;
  },
  async add({ chatIdOrUsername, title, inviteLink, type, accessMode = 'member' }) {
    if (!/^-[0-9]+$/.test(chatIdOrUsername) || !validateInviteLink(inviteLink)) throw new UserError('Kanal ID yoki Telegram havolasi noto‘g‘ri.');
    if (!['public', 'private'].includes(type) || !['member', 'request'].includes(accessMode)) throw new UserError('Kanal turi yoki tekshirish rejimi noto‘g‘ri.');
    if (type === 'public' && accessMode === 'request') throw new UserError('request rejimi faqat shaxsiy kanal uchun.');
    const doc = await Channel.findOneAndUpdate({ chatIdOrUsername }, { $set: { title, inviteLink, type, accessMode, isActive: true } }, { upsert: true, new: true, runValidators: true });
    this.invalidate(); return doc;
  },
  async removeById(id) { const result = await Channel.findByIdAndDelete(id); this.invalidate(); return Boolean(result); },
  async getByChatId(chatId) { return Channel.findOne({ chatIdOrUsername: String(chatId), isActive: true }).lean(); },
};
