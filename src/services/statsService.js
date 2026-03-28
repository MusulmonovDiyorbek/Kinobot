import { User } from '../models/User.js';
import { Movie } from '../models/Movie.js';
import { cacheService } from './cacheService.js';

const KEY = 'stats:summary';
const TTL = 30;

export const statsService = {
  async getSummary() {
    const hit = cacheService.get(KEY);
    if (hit) return hit;

    const [users, agg, movies] = await Promise.all([
      User.countDocuments(),
      Movie.aggregate([{ $group: { _id: null, totalViews: { $sum: '$views' } } }]),
      Movie.countDocuments(),
    ]);
    const totalViews = agg[0]?.totalViews ?? 0;
    const summary = { users, totalViews, movies };
    cacheService.set(KEY, summary, TTL);
    return summary;
  },

  invalidate() {
    cacheService.del(KEY);
  },
};
