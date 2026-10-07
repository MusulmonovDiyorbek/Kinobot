import mongoose from 'mongoose';
import { Movie } from '../models/Movie.js';
export async function ensureIndexes() {
  // Legacy text index treated movie.language ('O‘zbek') as MongoDB's stemmer language.
  // Rebuild only that known index; never sync/drop unrelated production indexes.
  let indexes = [];
  try { indexes = await Movie.collection.indexes(); } catch (e) { if (e.code !== 26) throw e; }
  for (const index of indexes) {
    if (index.name === 'title_text_description_text' && index.weights?.title && index.weights?.description && (index.language_override !== 'searchLanguage' || index.default_language !== 'none')) {
      await Movie.collection.dropIndex(index.name);
    }
  }
  await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
}
