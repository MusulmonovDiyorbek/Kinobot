import mongoose from 'mongoose';

export async function healthCheck(req, res) {
  const db =
    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ ok: true, db, ts: new Date().toISOString() });
}
