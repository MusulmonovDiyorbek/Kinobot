// src/bot/keyboards.js

/**
 * Matnni maksimal uzunlikka kesadi
 */
function truncateLabel(s, max = 52) {
  const t = String(s || '');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * 🔥 REQUIRED CHANNELS KEYBOARD
 * - Public → link orqali join
 * - Private → link + Opened (tracking uchun)
 */
export function requiredChannelsKeyboard(channels = []) {
  if (!Array.isArray(channels)) channels = [];

  const rows = channels.map((ch, index) => {
    const title = truncateLabel(ch.title || ch.chatIdOrUsername || 'Channel');

    return [
      {
        text: `➕ ${title}`,
        url: ch.inviteLink, // kanalga kirish
      },
      {
        text: '✔️ Opened',
        callback_data: `join_${index}`, // 🔥 PRIVATE TRACK
      },
    ];
  });

  // Tekshirish tugmasi
  rows.push([
    {
      text: '✅ Tekshirish',
      callback_data: 'verify_join',
    },
  ]);

  return { inline_keyboard: rows };
}

/**
 * ❗ NOT JOINED CHANNELS
 */
export function notJoinedKeyboard(channels = [], notJoinedIndexes = []) {
  if (!Array.isArray(channels)) channels = [];
  if (!Array.isArray(notJoinedIndexes)) notJoinedIndexes = [];

  const rows = notJoinedIndexes.map((i) => {
    const ch = channels[i] || {};
    const title = truncateLabel(ch.title || ch.chatIdOrUsername || 'Channel');

    return [
      {
        text: `❌ ${title}`,
        url: ch.inviteLink,
      },
    ];
  });

  rows.push([
    {
      text: '🔄 Qayta tekshirish',
      callback_data: 'verify_join',
    },
  ]);

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
 * Admin paneli
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
 * Channel admin menyu
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
 * Filmlar listi
 */
export function moviesListKeyboard(movies = [], prefix = 'mv:') {
  if (!Array.isArray(movies)) movies = [];

  const rows = movies.map((m) => [
    {
      text: truncateLabel(`${m.title || 'Movie'} (${m.code || ''})`),
      callback_data: `${prefix}${String(m._id)}`,
    },
  ]);

  return { inline_keyboard: rows };
}

/**
 * Cancel tugmasi
 */
export function cancelKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: '✖️ Cancel',
          callback_data: 'flow_cancel',
        },
      ],
    ],
  };
}