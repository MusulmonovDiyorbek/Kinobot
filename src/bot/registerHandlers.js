import { config } from '../config/index.js';
import { isAdmin } from '../utils/isAdmin.js';
import { UserError, errorSummary } from '../utils/errors.js';
import { userService } from '../services/userService.js';
import { movieService, escapeHtml } from '../services/movieService.js';
import { channelService } from '../services/channelService.js';
import { membershipService, isMember } from '../services/membershipService.js';
import { deliveryService } from '../services/deliveryService.js';
import { statsService } from '../services/statsService.js';
import { broadcastService } from '../services/broadcastService.js';
import * as sessions from '../services/adminSessionService.js';
import { JoinRequest } from '../models/JoinRequest.js';
import { Setting } from '../models/Setting.js';
import { Broadcast } from '../models/Broadcast.js';
import { mainMenuKeyboard, adminPanelKeyboard, adminChannelsKeyboard, moviesListKeyboard, requiredChannelsKeyboard, cancelKeyboard, confirmationKeyboard } from './keyboards.js';

const HELP = '🎬 Kino nomi yoki kodini yozing.\n\n/top — mashhur kinolar\n/last — yangi kinolar\n/rand — tasodifiy kino\n/saved — saqlanganlar\n/vip — VIP holati\n/help — yordam\n/dev — dasturchi\n/cancel — amalni bekor qilish\n\nInline qidiruv: @BOT_USERNAME kino nomi. Natijadagi havola orqali botdan kinoni olasiz.';
const validId = id => /^[a-f0-9]{24}$/.test(String(id));
const validPage = p => /^\d{1,4}$/.test(String(p));
const adminCommands = '⭐ VIP berish: /vipgive USER_ID KUN\nVIP olib tashlash: /vipremove USER_ID\nKino VIP holati: /movievip KOD on yoki off\n\nFoydalanuvchi avval /start bosgan bo‘lishi kerak. To‘lov avtomatik yechilmaydi; VIP admin tomonidan beriladi.';

export function createHandlers(bot, overrides = {}) {
  const users = overrides.users || userService;
  const movies = overrides.movies || movieService;
  const channels = overrides.channels || channelService;
  const membership = overrides.membership || membershipService;
  const sessionStore = overrides.sessions || sessions;
  const deliver = overrides.delivery || deliveryService;
  const cfg = overrides.config || config;
  const admin = overrides.isAdmin || isAdmin;
  const perUser = new Map();
  const throttle = new Map();
  const say = (chat, text, keyboard) => bot.sendMessage(chat, text, keyboard ? { reply_markup: keyboard } : {});
  async function gate(uid, chat) {
    if (admin(uid)) return true;
    const list = await channels.listActive();
    const missing = await membership.getNotJoinedChannels(bot, uid, list);
    if (!missing.length) return true;
    await say(chat, '❗ Kinolarni olish uchun quyidagi kanallarga a’zo bo‘ling. So‘rovli kanal bo‘lsa, qo‘shilish so‘rovini yuboring va «Tekshirish»ni bosing.', requiredChannelsKeyboard(missing));
    return false;
  }
  async function menu(chat, user, greet = false) {
    const text = `Assalomu alaykum, ${user.first_name || 'kino muxlisi'}! 🎬\nKino nomi yoki kodini yozing.`;
    if (greet) {
      const gif = (await Setting.findOne({ key: 'startGif' }).lean())?.value || cfg.startGif;
      if (gif) {
        try { await bot.sendAnimation(chat, gif, { caption: text, reply_markup: mainMenuKeyboard() }); return; }
        catch (e) { console.error('start_gif', errorSummary(e)); }
      }
    }
    await say(chat, text, mainMenuKeyboard());
  }
  async function showMovie(chat, uid, id) {
    if (!validId(id)) return say(chat, 'Kino identifikatori noto‘g‘ri.');
    const movie = await movies.findByIdLean(id);
    if (!movie) return say(chat, 'Bu kino topilmadi yoki o‘chirilgan.');
    if (movie.vipOnly && !admin(uid) && !(await users.hasVip(uid))) return say(chat, '⭐ Bu kino VIP uchun. /vip orqali ma’lumot oling.');
    const user = await users.get(uid);
    const saved = (user?.favorites || []).some(item => String(item) === String(id));
    await deliver.sendMovieToChat(bot, chat, { ...movie, views: (movie.views || 0) + 1 }, saved);
    await movies.incrementViewsById(id); // Count only after successful delivery.
  }
  async function listMovies(chat, kind) {
    const list = await (kind === 'top' ? movies.topMovies() : movies.lastMovies());
    await say(chat, list.length ? (kind === 'top' ? '🔥 Top filmlar:' : '🆕 Yangi filmlar:') : 'Hozircha kino qo‘shilmagan.', moviesListKeyboard(list));
  }
  async function search(chat, uid, text) {
    await sessionStore.clearSession(uid);
    const exact = await movies.findByCode(text);
    if (exact) return showMovie(chat, uid, String(exact._id));
    const results = await movies.searchByName(text, 20);
    await say(chat, results.length ? '🔎 Qidiruv natijalari:' : 'Kino topilmadi. Nomini qisqaroq yozing yoki kodini tekshiring.', moviesListKeyboard(results));
  }
  async function vip(chat, uid) {
    const user = await users.get(uid);
    const until = user?.vipUntil && new Date(user.vipUntil) > new Date() ? new Date(user.vipUntil).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : null;
    const support = cfg.supportUsername ? `\nBog‘lanish: @${cfg.supportUsername}` : '\nVIP uchun bot adminiga murojaat qiling.';
    return say(chat, until ? `⭐ VIP faol: ${until} gacha.` : '⭐ VIP eksklyuziv kinolarga kirish beradi. Admin to‘lovni tekshirib VIP muddatini belgilaydi.' + support);
  }
  async function favorites(chat, uid, page) {
    const list = await users.favorites(uid, page);
    const navigation = [];
    if (page > 0) navigation.push({ text: '⬅️ Oldingi', callback_data: `favorites:${page - 1}` });
    if (list.length > 10) navigation.push({ text: 'Keyingi ➡️', callback_data: `favorites:${page + 1}` });
    return say(chat, list.length ? '🔖 Saqlangan kinolar:' : 'Saqlangan kino yo‘q. Kino ostidagi «Saqlash»ni bosing.', moviesListKeyboard(list.slice(0, 10), navigation.length ? [navigation] : []));
  }
  async function stats(chat) {
    const result = await statsService.getSummary();
    const jobs = await Broadcast.find().sort({ createdAt: -1 }).limit(3).lean();
    await say(chat, `📊 Statistika\nFoydalanuvchilar: ${result.users}\nKinolar: ${result.movies}\nKo‘rishlar: ${result.totalViews}` + (jobs.length ? '\n\nOxirgi broadcastlar:\n' + jobs.map(j => `${j.status}: ${j.sent} yuborildi / ${j.failed} xato`).join('\n') : ''));
  }
  async function requests(chat) {
    const list = await JoinRequest.find({ status: 'pending' }).sort({ requestedAt: -1 }).limit(10).lean();
    const active = await channels.listActive();
    const rows = [];
    for (const request of list) {
      const channel = active.find(c => c.chatIdOrUsername === request.chatId);
      if (!channel) continue;
      await say(chat, `👤 ${request.firstName || request.userId} (${request.userId})\nKanal: ${channel.title}`, { inline_keyboard: [[
        { text: '✅ Qabul qilish', callback_data: `jr:approve:${request._id}` },
        { text: '❌ Rad qilish', callback_data: `jr:decline:${request._id}` },
      ]] });
      rows.push(request);
    }
    if (!rows.length) await say(chat, 'Kutilayotgan so‘rovlar yo‘q.');
  }
  async function addChannel(chat, uid, text) {
    const parts = text.split('|').map(s => s.trim());
    if (parts.length < 4 || parts.length > 5) throw new UserError('Format: ID | auto yoki link | Nom | public/private | member/request');
    const [inputId, link, title, type, accessMode = 'member'] = parts;
    if (!/^(?:-\d{6,}|@[A-Za-z][A-Za-z0-9_]{4,})$/.test(inputId) || !title || title.length > 100) throw new UserError('Kanal ID yoki nomi noto‘g‘ri.');
    if (!['public', 'private'].includes(type) || !['member', 'request'].includes(accessMode)) throw new UserError('Tur: public/private; rejim: member/request.');
    if (type === 'public' && accessMode === 'request') throw new UserError('request faqat shaxsiy kanalda ishlaydi.');
    const info = await bot.getChat(inputId);
    if (info.type !== 'channel') throw new UserError('Faqat Telegram kanallari qo‘shiladi.');
    const rights = await bot.getChatMember(info.id, bot.identity.id);
    if (!['administrator', 'creator'].includes(rights.status)) throw new UserError('Avval botni kanalga admin qiling.');
    if (type === 'private' && rights.status !== 'creator' && !rights.can_invite_users) throw new UserError('Botga «Invite users» huquqini bering.');
    let inviteLink = link;
    if (link === 'auto') {
      if (type === 'public') {
        if (!info.username) throw new UserError('Bu kanal public emas. private turini tanlang.');
        inviteLink = `https://t.me/${info.username}`;
      } else {
        const invite = await bot.createChatInviteLink(info.id, { name: 'Kinobot', creates_join_request: true });
        inviteLink = invite.invite_link;
      }
    }
    await channels.add({ chatIdOrUsername: String(info.id), inviteLink, title, type, accessMode });
    await sessionStore.clearSession(uid);
    await say(chat, '✅ Kanal qo‘shildi. member rejimida a’zolik, request rejimida Telegram’dan kelgan so‘rov tekshiriladi.', adminPanelKeyboard());
  }
  async function adminFlow(chat, uid, msg, session) {
    const text = (msg.text || '').trim();
    const next = (step, data = session.data) => sessionStore.setSession(uid, { step, data });
    const prompt = (text, keyboard = cancelKeyboard()) => say(chat, text, keyboard);
    switch (session.step) {
      case 'movie_title':
        if (!text || text.length > 120) throw new UserError('Kino nomini 1–120 belgida yozing.');
        await next('movie_code', { title: text }); return prompt('🔢 Takrorlanmaydigan kod kiriting (masalan: 101).');
      case 'movie_code': {
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(text)) throw new UserError('Kod 1–32 ta harf, raqam, _ yoki - bo‘lsin.');
        if (await movies.findByCode(text)) throw new UserError('Bu kod mavjud. Boshqa kod yozing.');
        await next('movie_metadata', { ...session.data, code: text.toUpperCase() });
        return prompt('📋 Yil | Til | Janr | free/vip\nMasalan: 2024 | O‘zbek | Drama | free\nYil noma’lum bo‘lsa: -');
      }
      case 'movie_metadata': {
        const [yearText, language, genre, tier, ...extra] = text.split('|').map(s => s.trim());
        const year = yearText === '-' ? null : Number(yearText);
        if (extra.length || !language || language.length > 40 || !genre || genre.length > 60 || !['free', 'vip'].includes(tier) || (year !== null && (!Number.isInteger(year) || year < 1888 || year > new Date().getFullYear() + 5))) throw new UserError('Format yoki yil noto‘g‘ri. Yil | Til | Janr | free/vip');
        await next('movie_description', { ...session.data, year, language, genre, vipOnly: tier === 'vip' });
        return prompt('📝 Tavsif yozing (500 belgigacha), yoki «-».');
      }
      case 'movie_description':
        if (!text || text.length > 500) throw new UserError('Tavsif 500 belgigacha; o‘tkazish uchun «-».');
        await next('movie_poster', { ...session.data, description: text === '-' ? '' : text });
        return prompt('🖼 Poster fotosini yuboring, yoki ochiq HTTPS rasm URL, yoki «-».');
      case 'movie_poster': {
        const posterFileId = msg.photo?.at(-1)?.file_id || '';
        let posterUrl = '';
        if (!posterFileId && text !== '-') {
          try { const url = new URL(text); if (url.protocol !== 'https:') throw new Error(); posterUrl = url.toString(); }
          catch { throw new UserError('Foto, HTTPS rasm URL yoki «-» yuboring.'); }
        }
        await next('movie_file', { ...session.data, posterFileId, posterUrl });
        return prompt('🎞 Kino videosini yoki faylini yuboring. Kanaldan forward ham mumkin.');
      }
      case 'movie_file': {
        const media = msg.video || msg.document;
        if (!media) throw new UserError('Video yoki document yuboring.');
        const data = { ...session.data, telegramFileId: media.file_id, isDocument: !!msg.document };
        await next('movie_confirm', data);
        await bot.sendMessage(chat, movies.buildCaption({ ...data, views: 0 }), { parse_mode: 'HTML', reply_markup: confirmationKeyboard('adm_movie_confirm') });
        return;
      }
      case 'delete_code': {
        const movie = await movies.findByCode(text);
        if (!movie) throw new UserError('Bu kodli kino topilmadi.');
        await next('delete_confirm', { code: movie.code }); return prompt(`«${movie.title}» (${movie.code}) o‘chirilsinmi?`, confirmationKeyboard('adm_delete_confirm'));
      }
      case 'channel_add': return addChannel(chat, uid, text);
      case 'broadcast_message':
        if (!(msg.text || msg.photo || msg.video || msg.document || msg.animation)) throw new UserError('Matn, foto, video yoki fayl yuboring.');
        await bot.copyMessage(chat, chat, msg.message_id);
        await next('broadcast_confirm', { sourceChatId: chat, sourceMessageId: msg.message_id });
        return prompt('📣 Shu xabar barcha faol foydalanuvchilarga yuborilsinmi?', confirmationKeyboard('adm_broadcast_confirm'));
      case 'gif':
        if (!msg.animation) throw new UserError('GIFni animation sifatida yuboring.');
        await Setting.findOneAndUpdate({ key: 'startGif' }, { $set: { value: msg.animation.file_id } }, { upsert: true });
        await sessionStore.clearSession(uid); return prompt('✅ Start GIF saqlandi.', adminPanelKeyboard());
      default: return prompt('Tugma orqali tasdiqlang yoki /cancel yozing.');
    }
  }
  async function message(msg) {
    if (!msg.from || msg.chat?.type !== 'private') return;
    const uid = msg.from.id, chat = msg.chat.id;
    await users.ensureUser(msg.from);
    const text = (msg.text || '').trim();
    const match = text.match(/^\/([a-z]+)(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/s);
    const command = match?.[1], argument = (match?.[2] || '').trim();
    if (command === 'cancel') { await sessionStore.clearSession(uid); return say(chat, 'Amal bekor qilindi.', admin(uid) ? adminPanelKeyboard() : mainMenuKeyboard()); }
    if (command === 'admin') {
      if (!admin(uid)) return say(chat, 'Bu buyruq faqat admin uchun.');
      await sessionStore.clearSession(uid); return say(chat, '🔐 Admin panel', adminPanelKeyboard());
    }
    if (['vipgive', 'vipremove', 'movievip'].includes(command)) {
      if (!admin(uid)) return say(chat, 'Bu buyruq faqat admin uchun.');
      const args = argument.split(/\s+/);
      if (command === 'movievip') {
        if (!/^[A-Za-z0-9_-]{1,32}$/.test(args[0]) || !['on', 'off'].includes(args[1])) throw new UserError('/movievip KOD on yoki off');
        const { Movie } = await import('../models/Movie.js');
        const movie = await Movie.findOneAndUpdate({ code: args[0].toUpperCase() }, { $set: { vipOnly: args[1] === 'on' } }, { new: true });
        movies.invalidateLists(); const { cacheService } = await import('../services/cacheService.js'); cacheService.del(`movie:code:${args[0].toUpperCase()}`);
        return say(chat, movie ? '✅ Kino VIP holati yangilandi.' : 'Kino topilmadi.');
      }
      const id = Number(args[0]), days = Number(args[1]);
      if (!Number.isSafeInteger(id) || id <= 0 || (command === 'vipgive' && (!Number.isInteger(days) || days < 1 || days > 3650))) throw new UserError(adminCommands);
      const user = command === 'vipgive' ? await users.grantVip(id, days) : await users.revokeVip(id);
      return say(chat, user ? '✅ VIP yangilandi.' : 'Foydalanuvchi avval /start bosishi kerak.');
    }
    if (command === 'start') {
      await sessionStore.clearSession(uid); await users.markStart(uid);
      if (/^movie_[A-Za-z0-9_-]{1,32}$/.test(argument)) await sessionStore.setSession(uid, { step: 'pending_movie', data: { code: argument.slice(6) } });
      if (!(await gate(uid, chat))) return;
      if (argument.startsWith('movie_')) {
        await sessionStore.clearSession(uid); const movie = await movies.findByCode(argument.slice(6));
        return movie ? showMovie(chat, uid, String(movie._id)) : say(chat, 'Kino topilmadi.');
      }
      return menu(chat, msg.from, true);
    }
    if (command === 'help' || command === 'dev') return say(chat, command === 'help' ? HELP.replace('BOT_USERNAME', bot.identity.username) + (cfg.supportUsername ? `\nYordam: @${cfg.supportUsername}` : '') : cfg.devInfo);
    if (!(await gate(uid, chat))) return;
    if (command) {
      await sessionStore.clearSession(uid);
      if (command === 'top' || command === 'last') return listMovies(chat, command);
      if (command === 'rand') { const movie = await movies.randomMovie(); return movie ? showMovie(chat, uid, String(movie._id)) : say(chat, 'Hozircha kino yo‘q.'); }
      if (command === 'saved') return favorites(chat, uid, 0);
      if (command === 'vip') return vip(chat, uid);
      return say(chat, 'Noma’lum buyruq. /help orqali buyruqlarni ko‘ring.');
    }
    const session = await sessionStore.getSession(uid);
    if (session && admin(uid) && !['search', 'pending_movie'].includes(session.step)) return adminFlow(chat, uid, msg, session);
    if (text) return search(chat, uid, text.slice(0, 120));
    return say(chat, 'Kino nomi yoki kodini matn shaklida yozing.');
  }
  async function callback(q) {
    await bot.answerCallbackQuery(q.id).catch(() => {});
    if (!q.message || q.message.chat.type !== 'private') return;
    const chat = q.message.chat.id, uid = q.from.id, data = q.data || '';
    await users.ensureUser(q.from);
    if (data === 'flow_cancel') { await sessionStore.clearSession(uid); return say(chat, 'Bekor qilindi.', admin(uid) ? adminPanelKeyboard() : mainMenuKeyboard()); }
    if (data.startsWith('adm_') || data.startsWith('chdel:') || data.startsWith('jr:')) {
      if (!admin(uid)) return say(chat, 'Bu amal faqat admin uchun.');
      if (data === 'adm_back' || data === 'adm_close') { await sessionStore.clearSession(uid); return say(chat, data === 'adm_close' ? 'Admin panel yopildi.' : '🔐 Admin panel', data === 'adm_close' ? mainMenuKeyboard() : adminPanelKeyboard()); }
      if (data === 'adm_add') { await sessionStore.setSession(uid, { step: 'movie_title', data: {} }); return say(chat, '🎬 Kino nomini kiriting.', cancelKeyboard()); }
      if (data === 'adm_del') { await sessionStore.setSession(uid, { step: 'delete_code', data: {} }); return say(chat, 'O‘chiriladigan kino kodini yozing.', cancelKeyboard()); }
      if (data === 'adm_movie_confirm' || data === 'adm_delete_confirm' || data === 'adm_broadcast_confirm') {
        const session = await sessionStore.getSession(uid);
        const expected = { adm_movie_confirm: 'movie_confirm', adm_delete_confirm: 'delete_confirm', adm_broadcast_confirm: 'broadcast_confirm' }[data];
        if (session?.step !== expected) return say(chat, 'Bu tasdiqlash eskirgan. Amalni qayta boshlang.');
        if (data === 'adm_movie_confirm') { await movies.create(session.data); await say(chat, '✅ Kino qo‘shildi.', adminPanelKeyboard()); }
        if (data === 'adm_delete_confirm') { await movies.deleteByCode(session.data.code); await say(chat, '✅ Kino o‘chirildi.', adminPanelKeyboard()); }
        if (data === 'adm_broadcast_confirm') { const job = await broadcastService.queue(session.data.sourceChatId, session.data.sourceMessageId, uid); await say(chat, `✅ Broadcast navbatga qo‘yildi. ID: ${job._id}. Natija shu yerga keladi.`, adminPanelKeyboard()); }
        return sessionStore.clearSession(uid);
      }
      if (data === 'adm_channels') return say(chat, '📢 Majburiy kanallar:', adminChannelsKeyboard(await channels.listActive()));
      if (data === 'adm_ch_add') {
        await sessionStore.setSession(uid, { step: 'channel_add', data: {} });
        return say(chat, 'ID | auto yoki link | Nom | public/private | member/request\n\nPublic: @kanal | auto | Kanal | public | member\nPrivate: -1001234567890 | auto | Kanal | private | member\n\nmember — admin qabul qilgan a’zolar; request — haqiqiy so‘rov yuborganlarga 24 soat kirish. Bot kanal admini bo‘lishi va private uchun Invite users huquqiga ega bo‘lishi kerak.', cancelKeyboard());
      }
      if (data.startsWith('chdel:')) { if (!validId(data.slice(6))) return; await channels.removeById(data.slice(6)); return say(chat, '✅ Kanal olib tashlandi.', adminChannelsKeyboard(await channels.listActive())); }
      if (data === 'adm_stats') return stats(chat);
      if (data === 'adm_vip') return say(chat, adminCommands);
      if (data === 'adm_requests') return requests(chat);
      if (data === 'adm_gif') { await sessionStore.setSession(uid, { step: 'gif', data: {} }); return say(chat, 'Start uchun GIF yuboring.', cancelKeyboard()); }
      if (data === 'adm_broadcast') { await sessionStore.setSession(uid, { step: 'broadcast_message', data: {} }); return say(chat, '📣 Yuboriladigan xabarni yuboring. Keyin tasdiqlaysiz.', cancelKeyboard()); }
      if (data.startsWith('jr:')) {
        const [, action, id] = data.split(':'); if (!validId(id) || !['approve', 'decline'].includes(action)) return;
        const request = await JoinRequest.findById(id).lean();
        if (!request || request.status !== 'pending') return say(chat, 'So‘rov allaqachon qayta ishlangan.');
        if (!(await channels.getByChatId(request.chatId))) return say(chat, 'Bu kanal majburiy kanallar ro‘yxatida yo‘q.');
        await (action === 'approve' ? bot.approveChatJoinRequest(request.chatId, request.userId) : bot.declineChatJoinRequest(request.chatId, request.userId));
        await JoinRequest.updateOne({ _id: id }, { $set: { status: action === 'approve' ? 'approved' : 'declined' } });
        return say(chat, '✅ So‘rov qayta ishlandi.');
      }
      return;
    }
    if (!(await gate(uid, chat))) return;
    if (data === 'verify_join') {
      const session = await sessionStore.getSession(uid);
      if (session?.step === 'pending_movie') { await sessionStore.clearSession(uid); const movie = await movies.findByCode(session.data.code); return movie ? showMovie(chat, uid, String(movie._id)) : say(chat, 'Kino topilmadi.'); }
      return menu(chat, q.from);
    }
    if (data === 'menu_home') return menu(chat, q.from);
    if (data === 'menu_search') { await sessionStore.setSession(uid, { step: 'search', data: {} }); return say(chat, '🔍 Kino nomi yoki kodini yozing.', cancelKeyboard()); }
    if (data === 'menu_top' || data === 'menu_last') return listMovies(chat, data.slice(5));
    if (data === 'menu_rand') { const movie = await movies.randomMovie(); return movie ? showMovie(chat, uid, String(movie._id)) : say(chat, 'Hozircha kino yo‘q.'); }
    if (data === 'menu_help') return say(chat, HELP.replace('BOT_USERNAME', bot.identity.username));
    if (data === 'menu_vip') return vip(chat, uid);
    if (data.startsWith('mv:')) return showMovie(chat, uid, data.slice(3));
    if (data.startsWith('favorites:') && validPage(data.slice(10))) return favorites(chat, uid, Number(data.slice(10)));
    if (data.startsWith('save:') || data.startsWith('unsave:')) {
      const [action, id] = data.split(':'); if (!validId(id) || !(await movies.findByIdLean(id))) return say(chat, 'Kino topilmadi.');
      await users.setFavorite(uid, id, action === 'save'); return say(chat, action === 'save' ? '🔖 Saqlandi.' : '✅ Saqlanganlardan olindi.');
    }
    // Old join_N/Opened buttons deliberately do not unlock subscriptions.
  }
  async function inline(q) {
    const query = String(q.query || '').trim().slice(0, 120);
    const exact = query ? await movies.findByCode(query) : null;
    const list = exact ? [exact] : query ? await movies.searchByName(query, 20) : await movies.topMovies(20);
    const results = list.map(movie => {
      const url = `https://t.me/${bot.identity.username}?start=movie_${movie.code}`;
      return {
        type: 'article', id: String(movie._id), title: `${movie.vipOnly ? '⭐ ' : ''}${movie.title}${movie.year ? ` (${movie.year})` : ''}`,
        description: `${movie.language || ''} · ${movie.genre || ''} · Kod: ${movie.code}`,
        ...(movie.posterUrl ? { thumbnail_url: movie.posterUrl } : {}),
        input_message_content: { message_text: `<b>${escapeHtml(movie.title)}</b>\nKod: <code>${escapeHtml(movie.code)}</code>\n<a href="${url}">🎬 Kinoni botdan olish</a>`, parse_mode: 'HTML' },
        reply_markup: { inline_keyboard: [[{ text: '🎬 Kinoni olish', url }]] },
      };
    });
    await bot.answerInlineQuery(q.id, results, { cache_time: 5, is_personal: true, button: { text: 'Botni ochish', start_parameter: 'home' } });
  }
  async function join(request) {
    const channel = await channels.getByChatId(String(request.chat.id));
    if (!channel || channel.type !== 'private') return;
    await JoinRequest.findOneAndUpdate({ chatId: String(request.chat.id), userId: request.from.id }, { $set: {
      status: 'pending', requestedAt: new Date(request.date * 1000), firstName: request.from.first_name || '',
    } }, { upsert: true });
    // Do not message users/admins unexpectedly; requests are reviewed inside /admin.
  }
  async function member(update) {
    if (isMember(update.new_chat_member)) {
      await JoinRequest.updateOne({ chatId: String(update.chat.id), userId: update.new_chat_member.user.id }, { $set: { status: 'approved' } });
    } else {
      await JoinRequest.updateOne({ chatId: String(update.chat.id), userId: update.new_chat_member.user.id }, { $set: { status: 'left' } });
    }
    if (update.new_chat_member.user.id === bot.identity.id) channels.invalidate();
  }
  async function run(update) {
    const uid = update.message?.from?.id || update.callback_query?.from?.id || update.inline_query?.from?.id;
    const now = overrides.now ? overrides.now() : Date.now();
    if (uid) {
      const entry = throttle.get(uid);
      if (entry && now - entry.at < 1000 && entry.count >= 8) {
        if (update.callback_query) await bot.answerCallbackQuery(update.callback_query.id, { text: 'Biroz kuting.' }).catch(() => {});
        if (update.inline_query) await bot.answerInlineQuery(update.inline_query.id, [], { cache_time: 1, is_personal: true }).catch(() => {});
        return;
      }
      throttle.set(uid, entry && now - entry.at < 1000 ? { at: entry.at, count: entry.count + 1 } : { at: now, count: 1 });
      if (throttle.size > 10000) for (const [id, item] of throttle) if (now - item.at > 60000) throttle.delete(id);
    }
    try {
      if (update.message) return await message(update.message);
      if (update.callback_query) return await callback(update.callback_query);
      if (update.inline_query) return await inline(update.inline_query);
      if (update.chat_join_request) return await join(update.chat_join_request);
      if (update.chat_member || update.my_chat_member) return await member(update.chat_member || update.my_chat_member);
    } catch (e) {
      const msg = update.message || update.callback_query?.message;
      if (e instanceof UserError || e.code === 11000) {
        if (msg?.chat.type === 'private') await say(msg.chat.id, e.code === 11000 ? 'Bu kod allaqachon mavjud. Boshqa kod tanlang.' : e.message);
        return;
      }
      if (e.error_code === 403) { if (uid) await users.setBlocked(uid, true); return; }
      if (e.error_code === 400) { if (msg?.chat.type === 'private') await say(msg.chat.id, 'Telegram amalni bajara olmadi. Fayl, kanal ID va bot huquqlarini tekshiring yoki /cancel bilan qayta boshlang.'); return; }
      console.error('handler', errorSummary(e));
      throw e; // Webhook/polling retries transient failures.
    }
  }
  async function handleUpdate(update) {
    const key = update.message?.from?.id || update.callback_query?.from?.id || update.inline_query?.from?.id || update.chat_join_request?.from?.id || update.chat_member?.new_chat_member?.user?.id || 'system';
    const previous = perUser.get(key) || Promise.resolve();
    const task = previous.catch(() => {}).then(() => run(update));
    perUser.set(key, task);
    try { return await task; } finally { if (perUser.get(key) === task) perUser.delete(key); }
  }
  return { handleUpdate, message, callback, inline, gate };
}
export const registerHandlers = createHandlers;
