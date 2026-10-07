import { Session } from '../models/Session.js';
export async function getSession(userId) { return Session.findOne({ userId, expiresAt: { $gt: new Date() } }).lean(); }
export async function setSession(userId, session) {
  return Session.findOneAndUpdate({ userId }, { $set: { ...session, expiresAt: new Date(Date.now() + 30 * 60_000) } }, { upsert: true, new: true });
}
export async function clearSession(userId) { await Session.deleteOne({ userId }); }
