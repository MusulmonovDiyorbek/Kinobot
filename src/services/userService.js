import { User } from '../models/User.js';
import { Movie } from '../models/Movie.js';
import { statsService } from './statsService.js';
export const userService = {
  async ensureUser(tgUser) {
    const user = await User.findOneAndUpdate({ telegramId: tgUser.id }, {
      $set: { username: tgUser.username || '', firstName: tgUser.first_name || '', lastName: tgUser.last_name || '', languageCode: tgUser.language_code || '', isBlocked: false },
      $setOnInsert: { telegramId: tgUser.id },
    }, { upsert: true, new: true });
    statsService.invalidate(); return user;
  },
  async markStart(id) { await User.updateOne({ telegramId: id }, { $set: { lastStartAt: new Date() } }); },
  async setBlocked(id, blocked) { await User.updateOne({ telegramId: id }, { $set: { isBlocked: blocked } }); },
  async get(id) { return User.findOne({ telegramId: id }).lean(); },
  async setFavorite(id, movieId, add) {
    await User.updateOne({ telegramId: id }, add ? { $addToSet: { favorites: movieId } } : { $pull: { favorites: movieId } });
  },
  async favorites(id, page = 0) {
    const user = await this.get(id);
    return Movie.find({ _id: { $in: user?.favorites || [] } }).sort({ title: 1 }).skip(page * 10).limit(11).lean();
  },
  async grantVip(id, days) {
    const user = await this.get(id); if (!user) return null;
    const until = new Date(Math.max(Date.now(), user.vipUntil ? new Date(user.vipUntil).getTime() : 0) + days * 86400000);
    return User.findOneAndUpdate({ telegramId: id }, { $set: { vipUntil: until } }, { new: true });
  },
  async revokeVip(id) { return User.findOneAndUpdate({ telegramId: id }, { $set: { vipUntil: null } }, { new: true }); },
  async hasVip(id) { const user = await this.get(id); return !!user?.vipUntil && new Date(user.vipUntil) > new Date(); },
};
