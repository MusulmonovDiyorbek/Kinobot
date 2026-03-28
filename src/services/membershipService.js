/**
 * @param {import('node-telegram-bot-api')} bot
 * @param {number} userId
 * @param {Array<{ chatIdOrUsername: string }>} channels
 */
async function userJoinedAllChannels(bot, userId, channels) {
  if (!channels.length) return true;

  for (const ch of channels) {
    try {
      const member = await bot.getChatMember(ch.chatIdOrUsername, userId);
      const status = member.status;
      if (status === 'left' || status === 'kicked') return false;
    } catch {
      return false;
    }
  }
  return true;
}

export const membershipService = { userJoinedAllChannels };
