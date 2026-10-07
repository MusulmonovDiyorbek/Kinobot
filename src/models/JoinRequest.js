import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  chatId: { type: String, required: true }, userId: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'declined', 'left'], default: 'pending' },
  requestedAt: { type: Date, required: true }, firstName: { type: String, default: '' },
}, { timestamps: true });
schema.index({ chatId: 1, userId: 1 }, { unique: true });
schema.index({ status: 1, requestedAt: -1 });
export const JoinRequest = mongoose.models.JoinRequest || mongoose.model('JoinRequest', schema);
