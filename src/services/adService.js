import { Ad } from '../models/Ad.js';

export const adService = {
  async create({ text, photoFileId, parseMode, createdBy }) {
    await Ad.updateMany({}, { $set: { isActive: false } });
    return Ad.create({
      text,
      photoFileId: photoFileId || '',
      parseMode: parseMode || 'HTML',
      isActive: true,
      createdBy: createdBy ?? null,
    });
  },

  async getLatestActive() {
    return Ad.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
  },

  async listRecent(limit = 10) {
    return Ad.find().sort({ createdAt: -1 }).limit(limit).lean();
  },
};
