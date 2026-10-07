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

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function buildCaption(movie) {
  const lines = [
    `<b>${escapeHtml(String(movie.title).slice(0, 120))}</b>`,
    escapeHtml(String(movie.description || '').slice(0, 500)),
    [movie.language && `🌐 ${escapeHtml(String(movie.language).slice(0, 40))}`, movie.genre && `📁 ${escapeHtml(String(movie.genre).slice(0, 60))}`, movie.year && `📅 ${movie.year}`].filter(Boolean).join(' · '),
    `🔢 Kod: <code>${escapeHtml(movie.code)}</code>`,
    movie.vipOnly ? '⭐ VIP kino' : '', `👁 ${movie.views ?? 0} ko‘rish`,
  ];
  return lines.filter(Boolean).join('\n\n');
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
      vipOnly: Boolean(data.vipOnly),
      posterUrl: data.posterUrl || '',
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
    for (const key of cacheService.keys()) if (key.startsWith('movies:top:') || key.startsWith('movies:last:')) cacheService.del(key);
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
    const q = String(query).trim().slice(0, 120);
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

    // A misspelled title may produce no text/regex candidates. Bound fuzzy fallback cost.
    if (!docs.length) docs = await Movie.find().sort({ views: -1 }).limit(500).lean();
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
      .filter(r => r.score >= 55)
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
    const key = `${TOP_KEY}:${limit}`;
    const hit = cacheService.get(key);
    if (hit) return hit;

    const docs = await Movie.find().sort({ views: -1, createdAt: -1 }).limit(limit).lean();
    cacheService.set(key, docs, 40);
    return docs;
  },

  async lastMovies(limit = 10) {
    const key = `${LAST_KEY}:${limit}`;
    const hit = cacheService.get(key);
    if (hit) return hit;

    const docs = await Movie.find().sort({ createdAt: -1 }).limit(limit).lean();
    cacheService.set(key, docs, 40);
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
