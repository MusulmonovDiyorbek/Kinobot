import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  sourceChatId: { type: Number, required: true }, sourceMessageId: { type: Number, required: true },
  adminId: { type: Number, required: true },
  status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
  lastUserId: { type: Number, default: 0 }, sent: { type: Number, default: 0 }, failed: { type: Number, default: 0 },
  leaseUntil: Date,
}, { timestamps: true });
schema.index({ status: 1, createdAt: 1 });
schema.index({ sourceChatId: 1, sourceMessageId: 1, adminId: 1 }, { unique: true });
export const Broadcast = mongoose.models.Broadcast || mongoose.model('Broadcast', schema);
