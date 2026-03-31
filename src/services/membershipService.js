// src/services/membershipService.js

/**
 * 🔹 User barcha kanallarga join qilganini tekshiradi
 * - public → Telegram orqali real check
 * - private → faqat joinedUsers orqali (Opened bosilgan)
 *
 * @param {import('node-telegram-bot-api')} bot
 * @param {number} userId
 * @param {Array<{ chatIdOrUsername: string, type: 'public'|'private', joinedUsers?: number[] }>} channels
 * @returns {Promise<boolean>}
 */
async function userJoinedAllChannels(bot, userId, channels) {
  if (!Array.isArray(channels) || channels.length === 0) return true;

  for (const ch of channels) {
    // 🔥 PUBLIC CHANNEL
    if (ch.type === 'public') {
      try {
        const member = await bot.getChatMember(ch.chatIdOrUsername, userId);
        const status = member.status;

        if (!['member', 'administrator', 'creator'].includes(status)) {
          return false;
        }
      } catch (e) {
        // Agar error bo‘lsa → user obuna emas deb hisoblanadi
        return false;
      }
    }

    // 🔥 PRIVATE CHANNEL
    if (ch.type === 'private') {
      // 🔑 MUHIM: faqat Opened bosilganini tekshiramiz
      if (!Array.isArray(ch.joinedUsers) || !ch.joinedUsers.includes(userId)) {
        return false;
      }
    }
  }

  return true;
}

export const membershipService = {
  userJoinedAllChannels,
};