import { Channel } from '../models/Channel.js';
import { cacheService } from './cacheService.js';

const LIST_KEY = 'channels:required';

export const channelService = {
  async listActive() {
    const hit = cacheService.get(LIST_KEY);
    if (hit) return hit;

    const list = await Channel.find({ isActive: true }).sort({ createdAt: 1 }).lean();
    cacheService.set(LIST_KEY, list, 60);
    return list;
  },

  invalidate() {
    cacheService.del(LIST_KEY);
  },

  async add({ chatIdOrUsername, title, inviteLink }) {
    const doc = await Channel.create({
      chatIdOrUsername: String(chatIdOrUsername).trim(),
      title: title || '',
      inviteLink: String(inviteLink).trim(),
      isActive: true,
    });
    this.invalidate();
    return doc;
  },

  async removeByChatId(chatIdOrUsername) {
    const res = await Channel.findOneAndDelete({
      chatIdOrUsername: String(chatIdOrUsername).trim(),
    });
    if (res) this.invalidate();
    return Boolean(res);
  },

  async listAll() {
    return Channel.find().sort({ createdAt: -1 }).lean();
  },
};
