import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  chatIdOrUsername: { type: String, required: true, unique: true },
  title: { type: String, required: true }, inviteLink: { type: String, required: true },
  type: { type: String, enum: ['public', 'private'], required: true },
  accessMode: { type: String, enum: ['member', 'request'], default: 'member' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ isActive: 1 });
export const Channel = mongoose.models.Channel || mongoose.model('Channel', schema);
