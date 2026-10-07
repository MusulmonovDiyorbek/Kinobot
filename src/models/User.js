import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    languageCode: { type: String, default: '' },
    isBlocked: { type: Boolean, default: false },
    lastStartAt: { type: Date },
    lastAdSentAt: { type: Date },
    favorites: { type: [mongoose.Schema.Types.ObjectId], ref: 'Movie', default: [] },
    vipUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
