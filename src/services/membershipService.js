import { JoinRequest } from '../models/JoinRequest.js';
export function isMember(member) {
  return ['member', 'administrator', 'creator'].includes(member?.status) || (member?.status === 'restricted' && member.is_member === true);
}
export async function getNotJoinedChannels(bot, userId, channels, findRequest = (chatId, uid) => JoinRequest.findOne({ chatId, userId: uid }).lean()) {
  const missing = [];
  for (const channel of channels) {
    let member;
    try { member = await bot.getChatMember(channel.chatIdOrUsername, userId); }
    catch { missing.push(channel); continue; } // Configuration/API failure never unlocks content.
    if (isMember(member)) continue;
    if (channel.type === 'private' && channel.accessMode === 'request' && member.status !== 'kicked') {
      const request = await findRequest(channel.chatIdOrUsername, userId);
      if (request?.status === 'pending' && new Date(request.requestedAt).getTime() > Date.now() - 86400000) continue;
    }
    missing.push(channel);
  }
  return missing;
}
export const membershipService = {
  getNotJoinedChannels,
  async userJoinedAllChannels(bot, uid, channels) { return !(await getNotJoinedChannels(bot, uid, channels)).length; },
};
