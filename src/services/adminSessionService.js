const sessions = new Map();

/** @typedef {{ step: string, data: Record<string, unknown> }} AdminSession */

/**
 * @param {number} telegramId
 * @returns {AdminSession | undefined}
 */
export function getSession(telegramId) {
  return sessions.get(telegramId);
}

export function setSession(telegramId, session) {
  sessions.set(telegramId, session);
}

export function clearSession(telegramId) {
  sessions.delete(telegramId);
}

export function updateSessionData(telegramId, patch) {
  const s = sessions.get(telegramId);
  if (!s) return;
  s.data = { ...s.data, ...patch };
  sessions.set(telegramId, s);
}
