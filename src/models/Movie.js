import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    language: { type: String, default: '' },
    genre: { type: String, default: '' },
    year: { type: Number, default: null },
    views: { type: Number, default: 0, index: true },
    vipOnly: { type: Boolean, default: false },
    posterUrl: { type: String, default: '' },
    posterFileId: { type: String, default: '' },
    /** Primary file for inline / send (video or document file_id) */
    telegramFileId: { type: String, default: '' },
    /** If media is a document rather than video */
    isDocument: { type: Boolean, default: false },
    sourceType: { type: String, enum: ['direct', 'channel'], default: 'direct' },
    channelId: { type: String, default: '' },
    channelMessageId: { type: Number, default: null },
  },
  { timestamps: true }
);

movieSchema.index({ title: 'text', description: 'text' }, { default_language: 'none', language_override: 'searchLanguage' });
movieSchema.index({ createdAt: -1 });

export const Movie = mongoose.models.Movie || mongoose.model('Movie', movieSchema);
