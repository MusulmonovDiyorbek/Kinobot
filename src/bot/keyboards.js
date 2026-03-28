// src/bot/keyboards.js

/**
 * Matnni maksimal uzunlikka kesadi
 */
function truncateLabel(s, max = 52) {
  const t = String(s);
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Foydalanuvchini kanallarga a'zo bo'lishga majbur qiluvchi inline keyboard
 */
export function requiredChannelsKeyboard(channels) {
  const rows = channels.map((ch) => [
    {
      text: ch.title ? `➕ ${ch.title}` : `➕ ${ch.chatIdOrUsername}`,
      url: ch.inviteLink,
    },
  ]);
  rows.push([{ text: '✅ Tekshirish', callback_data: 'verify_join' }]);
  return { inline_keyboard: rows };
}

/**
 * Asosiy menyu
 */
export function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔍 Search by name', callback_data: 'menu_search_name' }],
      [{ text: '🔢 Search by code', callback_data: 'menu_search_code' }],
      [{ text: '🔥 Top movies', callback_data: 'menu_top' }],
      [{ text: '🆕 Last movies', callback_data: 'menu_last' }],
      [{ text: '🎲 Random', callback_data: 'menu_rand' }],
      [{ text: '❓ Help', callback_data: 'menu_help' }],
      [{ text: '👨‍💻 Dev', callback_data: 'menu_dev' }],
    ],
  };
}

/**
 * Admin paneli menyusi
 */
export function adminPanelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '➕ Add movie', callback_data: 'adm_add' }],
      [{ text: '➖ Delete movie', callback_data: 'adm_del' }],
      [{ text: '📣 Broadcast', callback_data: 'adm_broadcast' }],
      [{ text: '📢 Channels', callback_data: 'adm_channels' }],
      [{ text: '📊 Stats', callback_data: 'adm_stats' }],
      [{ text: '✖️ Close', callback_data: 'adm_close' }],
    ],
  };
}

/**
 * Admin kanallarini boshqarish menyusi
 */
export function adminChannelsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '➕ Add channel', callback_data: 'adm_ch_add' }],
      [{ text: '➖ Remove channel', callback_data: 'adm_ch_rem' }],
      [{ text: '⬅️ Back', callback_data: 'adm_back' }],
    ],
  };
}

/**
 * Film ro'yxati tugmalari
 */
export function moviesListKeyboard(movies, prefix = 'mv:') {
  const rows = movies.map((m) => [
    {
      text: truncateLabel(`${m.title} (${m.code || ''})`),
      callback_data: `${prefix}${String(m._id)}`,
    },
  ]);
  return { inline_keyboard: rows };
}

/**
 * Bekor qilish tugmasi
 */
export function cancelKeyboard() {
  return {
    inline_keyboard: [[{ text: '✖️ Cancel', callback_data: 'flow_cancel' }]],
  };
}