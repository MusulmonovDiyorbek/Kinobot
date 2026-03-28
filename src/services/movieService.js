import { ratio, partial_ratio } from 'fuzzball';
import { Movie } from '../models/Movie.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { cacheService } from './cacheService.js';
import { statsService } from './statsService.js';

const TOP_KEY = 'movies:top';
const LAST_KEY = 'movies:last';
const CODE_PREFIX = 'movie:code:';

function normalizeCode(code) {
  return String(code).trim().toUpperCase();
}

function buildCaption(movie) {
  const lines = [
    `<b>${escapeHtml(movie.title)}</b>`,
    movie.description ? `${escapeHtml(movie.description)}` : '',
    [
      movie.language && `🌐 ${escapeHtml(movie.language)}`,
      movie.genre && `📁 ${escapeHtml(movie.genre)}`,
      movie.year && `📅 ${movie.year}`,
    ]
      .filter(Boolean)
      .join(' · '),
    `\n👁 ${movie.views ?? 0} ko‘rish`,
  ].filter(Boolean);
  return lines.join('\n\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const movieService = {
  normalizeCode,
  buildCaption,

  async create(data) {
    const doc = await Movie.create({
      title: data.title,
      code: normalizeCode(data.code),
      description: data.description || '',
      language: data.language || '',
      genre: data.genre || '',
      year: data.year ?? null,
      posterFileId: data.posterFileId || '',
      telegramFileId: data.telegramFileId || '',
      isDocument: Boolean(data.isDocument),
      sourceType: data.sourceType || 'direct',
      channelId: data.channelId || '',
      channelMessageId: data.channelMessageId ?? null,
    });
    this.invalidateLists();
    statsService.invalidate();
    cacheService.del(`${CODE_PREFIX}${doc.code}`);
    return doc;
  },

  async deleteByCode(code) {
    const c = normalizeCode(code);
    const res = await Movie.findOneAndDelete({ code: c });
    if (res) {
      this.invalidateLists();
      statsService.invalidate();
      cacheService.del(`${CODE_PREFIX}${c}`);
    }
    return Boolean(res);
  },

  invalidateLists() {
    cacheService.del(TOP_KEY);
    cacheService.del(LAST_KEY);
  },

  async findByCode(code) {
    const c = normalizeCode(code);
    const ck = `${CODE_PREFIX}${c}`;
    const cached = cacheService.get(ck);
    if (cached) return cached;

    const doc = await Movie.findOne({ code: c }).lean();
    if (doc) cacheService.set(ck, doc, 120);
    return doc;
  },

  async searchByName(query, limit = 20) {
    const q = String(query).trim();
    if (!q) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    const fuzzyCandidates = Math.max(limit * 8, 80);

    let docs = [];
    try {
      docs = await Movie.find(
        { $text: { $search: q } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(fuzzyCandidates)
        .lean();
    } catch {
      docs = [];
    }

    if (!docs.length) {
      const rx = new RegExp(tokens.map((t) => escapeRegex(t)).join('|'), 'i');
      docs = await Movie.find({ $or: [{ title: rx }, { description: rx }] })
        .limit(fuzzyCandidates)
        .lean();
    }

    const ranked = docs
      .map((d) => ({
        doc: d,
        score: Math.max(
          ratio(q.toLowerCase(), String(d.title).toLowerCase()),
          ...tokens.map((t) =>
            partial_ratio(t.toLowerCase(), String(d.title).toLowerCase())
          )
        ),
      }))
      .sort((a, b) => b.score - a.score || (b.doc.views ?? 0) - (a.doc.views ?? 0))
      .slice(0, limit)
      .map((r) => r.doc);

    return ranked;
  },

  async searchForInline(query, limit = 20) {
    const results = await this.searchByName(query, limit * 2);
    return results.filter((m) => Boolean(m.telegramFileId)).slice(0, limit);
  },

  async topMovies(limit = 10) {
    const hit = cacheService.get(TOP_KEY);
    if (hit) return hit;

    const docs = await Movie.find().sort({ views: -1, createdAt: -1 }).limit(limit).lean();
    cacheService.set(TOP_KEY, docs, 40);
    return docs;
  },

  async lastMovies(limit = 10) {
    const hit = cacheService.get(LAST_KEY);
    if (hit) return hit;

    const docs = await Movie.find().sort({ createdAt: -1 }).limit(limit).lean();
    cacheService.set(LAST_KEY, docs, 40);
    return docs;
  },

  async randomMovie() {
    const [doc] = await Movie.aggregate([{ $sample: { size: 1 } }]);
    return doc || null;
  },

  async incrementViewsById(movieId) {
    const doc = await Movie.findOneAndUpdate(
      { _id: movieId },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();
    if (doc) {
      statsService.invalidate();
      this.invalidateLists();
      cacheService.del(`${CODE_PREFIX}${doc.code}`);
    }
    return doc;
  },

  async findByIdLean(id) {
    return Movie.findById(id).lean();
  },
};
