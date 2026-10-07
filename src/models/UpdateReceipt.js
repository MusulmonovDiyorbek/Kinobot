import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  updateId: { type: Number, unique: true, required: true },
  status: { type: String, enum: ['processing', 'done'], required: true },
  leaseUntil: Date, expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const UpdateReceipt = mongoose.models.UpdateReceipt || mongoose.model('UpdateReceipt', schema);
