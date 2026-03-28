// src/bot/registerHandlers.js
import { isAdmin } from '../utils/isAdmin.js';
import { userService } from '../services/userService.js';
import { movieService } from '../services/movieService.js';
import { channelService } from '../services/channelService.js';
import { membershipService } from '../services/membershipService.js';
import { adService } from '../services/adService.js';
import { flowService } from '../services/flowService.js';
import * as adminSession from '../services/adminSessionService.js';
import {
  requiredChannelsKeyboard,
  mainMenuKeyboard,
  moviesListKeyboard,
} from './keyboards.js';

const MOV_PREFIX = 'mv:';

function devInfo() {
  return (
    process.env.DEV_INFO ||
    '👨‍💻 Dev: set DEV_INFO in .env (for example a @username or contact link).'
  );
}

async function sendLatestAd(bot, chatId) {
  const ad = await adService.getLatestActive();
  if (!ad) return;
  try {
    if (ad.photoFileId) {
      await bot.sendPhoto(chatId, ad.photoFileId, {
        caption: ad.text,
        parse_mode: ad.parseMode || undefined,
      });
    } else {
      await bot.sendMessage(chatId, ad.text, {
        parse_mode: ad.parseMode || undefined,
      });
    }
    await userService.updateLastAd(chatId);
  } catch (e) {
    console.error('sendLatestAd', e.message);
  }
}

async function ensureChannelsThen(bot, msg, channels, onOk, onFail) {
  const userId = msg.from.id;
  const ok = await membershipService.userJoinedAllChannels(bot, userId, channels);
  if (ok) {
    await onOk();
    return;
  }
  await onFail();
}

async function showForceJoin(bot, chatId, channels) {
  const text =
    'Botdan foydalanish uchun quyidagi kanallarga a‘zo bo‘ling.\n\n' +
    'Keyin «✅ Tekshirish» tugmasini bosing.';
  await bot.sendMessage(chatId, text, {
    reply_markup: requiredChannelsKeyboard(channels),
    disable_web_page_preview: true,
  });
}

async function showMainAfterJoin(bot, chatId, firstName) {
  await bot.sendMessage(
    chatId,
    `Assalomu alaykum, ${firstName || 'mehmon'}! 🎬\n\nAsosiy menyu:`,
    { reply_markup: mainMenuKeyboard() }
  );
}

/**
 * Yordamchi funksiyalar
 */
async function processStart(bot, msg, payload) {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name;

  // userni bazaga qo'shish yoki yangilash
  await userService.upsertFromTelegram(msg.from);

  // agar payload bo'lsa (referral yoki boshqa maqsad)
  if (payload) {
    console.log('Payload:', payload);
  }

  const channels = await channelService.listActive();
  const joined = await membershipService.userJoinedAllChannels(bot, msg.from.id, channels);

  if (!joined) {
    await showForceJoin(bot, chatId, channels);
  } else {
    await showMainAfterJoin(bot, chatId, firstName);
    await sendLatestAd(bot, chatId);
  }
}

async function openMovieByCallback(bot, chatId, movieId) {
  const movie = await movieService.getById(movieId);
  if (!movie) {
    await bot.sendMessage(chatId, 'Film topilmadi.');
    return;
  }
  const text = `🎬 ${movie.title}\n\n${movie.description || ''}`;
  await bot.sendMessage(chatId, text, {
    reply_markup: moviesListKeyboard([movieId]),
  });
}

/**
 * Handlerlarni ro'yxatga olish
 */
export function registerHandlers(bot) {
  bot.on('error', (err) => console.error('bot:error', err.message));
  bot.on('polling_error', (err) => console.error('bot:polling_error', err.message));

  bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
    try {
      const payload = match[1]?.trim() || '';
      await processStart(bot, msg, payload);
    } catch (e) {
      console.error('/start', e);
    }
  });

  bot.on('callback_query', async (q) => {
    try {
      const data = q.data || '';
      const chatId = q.message?.chat?.id;
      const fromId = q.from.id;
      const userMsg = { from: q.from, chat: q.message?.chat || { id: chatId } };

      // Admin flow cancel
      if (data === 'flow_cancel') {
        adminSession.clearSession(fromId);
        flowService.clear(fromId);
        await bot.answerCallbackQuery(q.id);
        if (chatId) await bot.sendMessage(chatId, 'Bekor qilindi.');
        return;
      }

      // Kanalga qo‘shilganini tekshirish
      if (data === 'verify_join') {
        const channels = await channelService.listActive();
        const ok = await membershipService.userJoinedAllChannels(bot, fromId, channels);
        if (!ok) {
          await bot.answerCallbackQuery(q.id, {
            text: "Barcha kanallarga a'zo bo'ling.",
            show_alert: true,
          });
          return;
        }
        await bot.answerCallbackQuery(q.id, { text: 'Rahmat!', show_alert: false });
        if (chatId) {
          await sendLatestAd(bot, chatId);
          await showMainAfterJoin(bot, chatId, q.from.first_name);
        }
        return;
      }

      // Kino callback
      if (data.startsWith(MOV_PREFIX)) {
        await bot.answerCallbackQuery(q.id);
        const id = data.slice(MOV_PREFIX.length);
        if (chatId) {
          const channels = await channelService.listActive();
          await ensureChannelsThen(
            bot,
            userMsg,
            channels,
            async () => openMovieByCallback(bot, chatId, id),
            async () => showForceJoin(bot, chatId, channels)
          );
        }
        return;
      }
    } catch (e) {
      console.error('callback_query', e);
      try {
        await bot.answerCallbackQuery(q.id, { text: 'Xatolik', show_alert: true });
      } catch {
        /* ignore */
      }
    }
  });
}