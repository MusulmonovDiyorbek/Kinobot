const label = s => String(s).slice(0, 54);
export const mainMenuKeyboard = () => ({ inline_keyboard: [
  [{ text: '🔍 Film qidiruv', callback_data: 'menu_search' }, { text: '🔎 Inline qidiruv', switch_inline_query_current_chat: '' }],
  [{ text: '🔥 Top filmlar', callback_data: 'menu_top' }, { text: '🆕 Yangi filmlar', callback_data: 'menu_last' }],
  [{ text: '🔖 Saqlanganlar', callback_data: 'favorites:0' }, { text: '🎲 Random', callback_data: 'menu_rand' }],
  [{ text: '⭐ VIP', callback_data: 'menu_vip' }, { text: '❓ Yordam olish', callback_data: 'menu_help' }],
] });
export const adminPanelKeyboard = () => ({ inline_keyboard: [
  [{ text: '➕ Kino qo‘shish', callback_data: 'adm_add' }, { text: '🗑 Kino o‘chirish', callback_data: 'adm_del' }],
  [{ text: '📢 Majburiy kanallar', callback_data: 'adm_channels' }, { text: '📊 Statistika', callback_data: 'adm_stats' }],
  [{ text: '📣 Broadcast', callback_data: 'adm_broadcast' }, { text: '⭐ VIP boshqarish', callback_data: 'adm_vip' }],
  [{ text: '👥 Kanal so‘rovlari', callback_data: 'adm_requests' }, { text: '🎞 Start GIF', callback_data: 'adm_gif' }],
  [{ text: '✖️ Yopish', callback_data: 'adm_close' }],
] });
export const adminChannelsKeyboard = channels => ({ inline_keyboard: [
  [{ text: '➕ Kanal qo‘shish', callback_data: 'adm_ch_add' }],
  ...channels.map(c => [{ text: `🗑 ${label(c.title)}`, callback_data: `chdel:${c._id}` }]),
  [{ text: '⬅️ Admin panel', callback_data: 'adm_back' }],
] });
export const requiredChannelsKeyboard = channels => ({ inline_keyboard: [
  ...channels.map(c => [{ text: `➕ ${label(c.title)}`, url: c.inviteLink }]),
  [{ text: '✅ Tekshirish', callback_data: 'verify_join' }],
] });
export const moviesListKeyboard = (movies, extra = []) => ({ inline_keyboard: [
  ...movies.map(m => [{ text: label(`${m.vipOnly ? '⭐ ' : ''}${m.title} (${m.code})`), callback_data: `mv:${m._id}` }]), ...extra,
  [{ text: '🏠 Menyu', callback_data: 'menu_home' }],
] });
export const cancelKeyboard = () => ({ inline_keyboard: [[{ text: '✖️ Bekor qilish', callback_data: 'flow_cancel' }]] });
export const confirmationKeyboard = action => ({ inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: action }, { text: '✖️ Bekor qilish', callback_data: 'flow_cancel' }]] });
export const movieActionsKeyboard = (id, saved = false) => ({ inline_keyboard: [
  [{ text: saved ? '🗑 Saqlanganlardan olish' : '🔖 Saqlash', callback_data: `${saved ? 'unsave' : 'save'}:${id}` }, { text: '📤 Ulashish', switch_inline_query: '' }],
  [{ text: '🏠 Menyu', callback_data: 'menu_home' }],
] });
