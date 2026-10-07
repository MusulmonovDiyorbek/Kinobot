import mongoose from 'mongoose';
const schema = new mongoose.Schema({ key: { type: String, unique: true }, value: String });
export const Setting = mongoose.models.Setting || mongoose.model('Setting', schema);
