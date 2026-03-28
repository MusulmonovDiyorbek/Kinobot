// src/services/userService.js
import { User } from '../models/User.js';

export const userService = {
  async ensureUser(tgUser) {
    // Telegram foydalanuvchisini bazaga qo'shadi yoki yangilaydi
    const telegramId = tgUser.id;
    return User.findOneAndUpdate(
      { telegramId },
      {
        $set: {
          username: tgUser.username || '',
          firstName: tgUser.first_name || '',
          lastName: tgUser.last_name || '',
          languageCode: tgUser.language_code || '',
        },
        $setOnInsert: { telegramId },
      },
      { upsert: true, new: true }
    );
  },

  async markStart(telegramId) {
    await User.updateOne(
      { telegramId },
      { $set: { lastStartAt: new Date() } }
    );
  },

  async countUsers() {
    return User.countDocuments();
  },

  streamNonBlocked() {
    return User.find({ isBlocked: false }).lean().cursor();
  },

  async setBlocked(telegramId, blocked) {
    await User.updateOne({ telegramId }, { $set: { isBlocked: blocked } });
  },

  async updateLastAd(telegramId) {
    await User.updateOne({ telegramId }, { $set: { lastAdSentAt: new Date() } });
  },

  // agar kerak bo'lsa upsertFromTelegram eski nomi bilan ham qoladi
  upsertFromTelegram(tgUser) {
    return this.ensureUser(tgUser);
  },
};