import mongoose from 'mongoose';

const adSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    photoFileId: { type: String, default: '' },
    parseMode: { type: String, enum: ['HTML', 'Markdown', 'MarkdownV2', ''], default: 'HTML' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Number, default: null },
  },
  { timestamps: true }
);

adSchema.index({ isActive: 1, createdAt: -1 });

export const Ad = mongoose.models.Ad || mongoose.model('Ad', adSchema);
