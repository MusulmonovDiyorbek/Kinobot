// src/bot/registerHandlers.js
import { isAdmin } from '../utils/isAdmin.js';
import { userService } from '../services/userService.js';
import { movieService } from '../services/movieService.js';
import { channelService } from '../services/channelService.js';
import { adService } from '../services/adService.js';
import * as adminSession from '../services/adminSessionService.js';
import {
  mainMenuKeyboard,
  adminPanelKeyboard,
  adminChannelsKeyboard,
  moviesListKeyboard,
  cancelKeyboard,
  requiredChannelsKeyboard,
  notJoinedKeyboard,
} from './keyboards.js';

// 🔥 RAM fallback private channels (DB bilan ishlaydi)
const openedPrivate = new Map();

/* ================= HELPERS ================= */
async function sendLatestAd(bot, chatId) {
  const ad = await adService.getLatestActive();
  if (!ad) return;

  try {
    if (ad.photoFileId) {
      await bot.sendPhoto(chatId, ad.photoFileId, {
        caption: ad.text,
        parse_mode: ad.parseMode || 'HTML',
      });
    } else {
      await bot.sendMessage(chatId, ad.text, {
        parse_mode: ad.parseMode || 'HTML',
      });
    }
    await userService.updateLastAd(chatId);
  } catch (e) {
    console.error(e.message);
  }
}

async function showForceJoin(bot, chatId, channels) {
  await bot.sendMessage(chatId, '❗ Kanallarga a’zo bo‘ling:', {
    reply_markup: requiredChannelsKeyboard(channels),
  });
}

async function showMainMenu(bot, chatId, name) {
  await bot.sendMessage(chatId, `Assalomu alaykum ${name || ''} 🎬`, {
    reply_markup: mainMenuKeyboard(),
  });
}

/* ================= CHECK NOT JOINED CHANNELS ================= */
async function getNotJoinedChannels(bot, userId, channels) {
  const notJoined = [];

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];

    if (ch.type === 'private') {
      const opened = openedPrivate.get(userId) || new Set();
      const dbJoined = ch.joinedUsers || [];

      if (!opened.has(i) && !dbJoined.includes(userId)) {
        notJoined.push(i);
      }
      continue;
    }

    try {
      const member = await bot.getChatMember(ch.chatIdOrUsername, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        notJoined.push(i);
      }
    } catch {
      notJoined.push(i);
    }
  }

  return notJoined;
}

/* ================= START HANDLER ================= */
async function processStart(bot, msg) {
  const chatId = msg.chat.id;

  await userService.upsertFromTelegram(msg.from);

  const channels = await channelService.listActive();
  const notJoinedIndexes = await getNotJoinedChannels(bot, msg.from.id, channels);

  if (notJoinedIndexes.length > 0) {
    const notJoined = notJoinedIndexes.map((i) => channels[i]);
    await showForceJoin(bot, chatId, notJoined);
  } else {
    await showMainMenu(bot, chatId, msg.from.first_name);
    await sendLatestAd(bot, chatId);
  }
}

/* ================= REGISTER HANDLERS ================= */
export function registerHandlers(bot) {
  console.log('✅ Handlers loaded');

  bot.on('polling_error', (e) => console.error(e.message));

  /* ---------- START ---------- */
  bot.onText(/^\/start$/, async (msg) => {
    await processStart(bot, msg);
  });

  /* ---------- ADMIN ---------- */
  bot.onText(/^\/admin$/, async (msg) => {
    if (!isAdmin(msg.from.id)) return;

    await bot.sendMessage(msg.chat.id, '🔐 Admin panel', {
      reply_markup: adminPanelKeyboard(),
    });
  });

  /* ---------- CALLBACK QUERIES ---------- */
  bot.on('callback_query', async (q) => {
    try {
      const data = q.data;
      const chatId = q.message.chat.id;
      const userId = q.from.id;

      await bot.answerCallbackQuery(q.id);

      /* 🔹 PRIVATE CHANNEL OPEN */
      if (data.startsWith('join_')) {
        const index = Number(data.split('_')[1]);

        if (!openedPrivate.has(userId)) openedPrivate.set(userId, new Set());
        openedPrivate.get(userId).add(index);

        const channels = await channelService.listActive();
        const ch = channels[index];

        if (ch && ch.type === 'private') {
          const joined = ch.joinedUsers || [];
          if (!joined.includes(userId)) {
            joined.push(userId);
            await channelService.updateJoinedUsers(ch.chatIdOrUsername, joined);
          }
        }

        await bot.sendMessage(chatId, '✅ Kanal ochildi');
        return;
      }

      /* 🔹 VERIFY JOIN */
      if (data === 'verify_join') {
        const channels = await channelService.listActive();
        const notJoinedIndexes = await getNotJoinedChannels(bot, userId, channels);

        if (notJoinedIndexes.length > 0) {
          const notJoined = notJoinedIndexes.map((i) => channels[i]);
          await bot.sendMessage(chatId, '❌ Hali a’zo emassiz:', {
            reply_markup: notJoinedKeyboard(notJoined, notJoined.map((_, i) => i)),
          });
          return;
        }

        await showMainMenu(bot, chatId, q.from.first_name);
        await sendLatestAd(bot, chatId);
        return;
      }

      /* 🔹 ADMIN CALLBACKS */
      if (!isAdmin(userId)) return;

      switch (data) {
        case 'adm_channels':
          await bot.sendMessage(chatId, '📢 Channels', {
            reply_markup: adminChannelsKeyboard(),
          });
          break;

        case 'adm_ch_add':
          adminSession.setSession(userId, { step: 'add' });
          await bot.sendMessage(chatId, 'Format:\n-100xxx | link | title | public/private', {
            reply_markup: cancelKeyboard(),
          });
          break;

        case 'adm_ch_rem': {
          adminSession.setSession(userId, { step: 'remove' });

          const list = await channelService.listActive();
          if (!list.length) {
            await bot.sendMessage(chatId, '❌ Kanal yo‘q');
            return;
          }

          await bot.sendMessage(
            chatId,
            list.map((c, i) => `${i + 1}. ${c.title}`).join('\n'),
            { reply_markup: cancelKeyboard() }
          );
          break;
        }

        case 'flow_cancel':
          adminSession.clearSession(userId);
          await bot.sendMessage(chatId, '❌ Bekor qilindi');
          break;
      }
    } catch (e) {
      console.error('callback error:', e);
    }
  });

  /* ---------- MESSAGE HANDLER ---------- */
  bot.on('message', async (msg) => {
    try {
      const userId = msg.from?.id;
      const chatId = msg.chat?.id;
      if (!userId || !chatId) return;

      const session = adminSession.getSession(userId);
      if (!session || !isAdmin(userId)) return;

      /* ADD CHANNEL */
      if (session.step === 'add' && msg.text) {
        const parts = msg.text.split('|').map((s) => s.trim());
        if (parts.length < 4) {
          await bot.sendMessage(chatId, '❌ Format noto‘g‘ri');
          return;
        }

        const [id, link, title, type] = parts;

        try {
          await channelService.add({ chatIdOrUsername: id, inviteLink: link, title, type });
          await bot.sendMessage(chatId, '✅ Qo‘shildi');
        } catch (e) {
          await bot.sendMessage(chatId, `❌ ${e.message}`);
        }

        adminSession.clearSession(userId);
        return;
      }

      /* REMOVE CHANNEL */
      if (session.step === 'remove' && msg.text) {
        const list = await channelService.listActive();
        const index = Number(msg.text) - 1;

        if (!list[index]) {
          await bot.sendMessage(chatId, '❌ Xato raqam');
          return;
        }

        const ch = list[index];
        await channelService.removeByChatId(ch.chatIdOrUsername);
        await bot.sendMessage(chatId, `✅ O‘chirildi: ${ch.title}`);

        adminSession.clearSession(userId);
        return;
      }
    } catch (e) {
      console.error('message error:', e);
    }
  });
}