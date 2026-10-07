import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId: { type: Number, unique: true, required: true }, step: String,
  data: { type: mongoose.Schema.Types.Mixed, default: {} }, expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = mongoose.models.Session || mongoose.model('Session', schema);
