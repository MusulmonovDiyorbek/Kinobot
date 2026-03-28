import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    /** @chat_id form e.g. -100123 or username @channel */
    chatIdOrUsername: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: '' },
    inviteLink: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

channelSchema.index({ isActive: 1 });

export const Channel = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
