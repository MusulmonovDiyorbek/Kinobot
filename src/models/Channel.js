// src/models/Channel.js
import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    /** Telegram channel ID yoki username, masalan: -100123 yoki @channel */
    chatIdOrUsername: { type: String, required: true, unique: true, trim: true },

    /** Kanal nomi */
    title: { type: String, default: '' },

    /** Invite link, public/private uchun ishlatiladi */
    inviteLink: { type: String, required: true, trim: true },

    /** Kanal turi: public yoki private */
    type: { type: String, enum: ['public', 'private'], required: true },

    /** Faol/aktiv kanal */
    isActive: { type: Boolean, default: true },

    /** Private kanallar uchun userlarni track qilish */
    joinedUsers: { type: [Number], default: [] },
  },
  { timestamps: true }
);

/** Faol kanallarni tez topish uchun index */
channelSchema.index({ isActive: 1 });

export const Channel = mongoose.models.Channel || mongoose.model('Channel', channelSchema);