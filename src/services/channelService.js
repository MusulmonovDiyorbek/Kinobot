// src/services/channelService.js
import { Channel } from '../models/Channel.js';
import { cacheService } from './cacheService.js';

const LIST_KEY = 'channels:required';

// 🔹 helper
function normalize(val) {
  return String(val).trim();
}

export const channelService = {
  /* ================= LIST ACTIVE ================= */
  async listActive() {
    const cached = cacheService.get(LIST_KEY);
    if (cached) return cached;

    const channels = await Channel.find({ isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    cacheService.set(LIST_KEY, channels, 60);
    return channels;
  },

  /* ================= INVALIDATE CACHE ================= */
  invalidate() {
    cacheService.del(LIST_KEY);
  },

  /* ================= ADD CHANNEL ================= */
  async add({ chatIdOrUsername, title, inviteLink, type }) {
    const id = normalize(chatIdOrUsername);
    const link = normalize(inviteLink);

    if (!id || !link) {
      throw new Error('chatIdOrUsername va inviteLink majburiy');
    }

    if (!['public', 'private'].includes(type)) {
      throw new Error('type faqat public yoki private bo‘lishi kerak');
    }

    const existing = await Channel.findOne({ chatIdOrUsername: id });
    if (existing) {
      throw new Error('Bu kanal allaqachon mavjud');
    }

    const channel = await Channel.create({
      chatIdOrUsername: id,
      title: title?.trim() || '',
      inviteLink: link,
      type,
      isActive: true,
      joinedUsers: [],
    });

    this.invalidate();
    return channel;
  },

  /* ================= REMOVE CHANNEL ================= */
  async removeByChatId(chatIdOrUsername) {
    const id = normalize(chatIdOrUsername);
    const res = await Channel.findOneAndDelete({ chatIdOrUsername: id });

    if (res) this.invalidate();
    return Boolean(res);
  },

  /* ================= GET ALL CHANNELS ================= */
  async listAll() {
    return Channel.find().sort({ createdAt: -1 }).lean();
  },

  /* ================= GET ONE CHANNEL ================= */
  async getByChatId(chatIdOrUsername) {
    const id = normalize(chatIdOrUsername);
    return Channel.findOne({ chatIdOrUsername: id }).lean();
  },

  /* ================= UPDATE CHANNEL ================= */
  async updateByChatId(chatIdOrUsername, data) {
    const id = normalize(chatIdOrUsername);

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.inviteLink !== undefined) updateData.inviteLink = data.inviteLink;
    if (data.type !== undefined) {
      if (!['public', 'private'].includes(data.type)) {
        throw new Error('type faqat public yoki private bo‘lishi kerak');
      }
      updateData.type = data.type;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.joinedUsers !== undefined) updateData.joinedUsers = data.joinedUsers;

    const updated = await Channel.findOneAndUpdate(
      { chatIdOrUsername: id },
      { $set: updateData },
      { new: true }
    );

    if (updated) this.invalidate();
    return updated;
  },

  /* ================= UPDATE JOINED USERS ================= */
  async updateJoinedUsers(chatIdOrUsername, joinedUsers) {
    const id = normalize(chatIdOrUsername);

    const updated = await Channel.findOneAndUpdate(
      { chatIdOrUsername: id },
      { $set: { joinedUsers } },
      { new: true }
    );

    if (updated) this.invalidate();
    return updated;
  },
};