import { UpdateReceipt } from '../models/UpdateReceipt.js';
export function createUpdateProcessor(handler, receipts = UpdateReceipt) {
  return async update => {
    if (!Number.isSafeInteger(update?.update_id)) { const e = new Error('Invalid update'); e.status = 400; throw e; }
    const now = new Date();
    try {
      await receipts.create({ updateId: update.update_id, status: 'processing', leaseUntil: new Date(Date.now() + 120000), expiresAt: new Date(Date.now() + 7 * 86400000) });
    } catch (e) {
      if (e.code !== 11000) throw e;
      const current = await receipts.findOne({ updateId: update.update_id }).lean();
      if (current?.status === 'done') return;
      const claimed = await receipts.findOneAndUpdate({ updateId: update.update_id, status: 'processing', leaseUntil: { $lte: now } }, { $set: { leaseUntil: new Date(Date.now() + 120000) } }, { new: true });
      if (!claimed) { const busy = new Error('Update in progress'); busy.status = 503; throw busy; }
    }
    try {
      await handler(update);
      await receipts.updateOne({ updateId: update.update_id }, { $set: { status: 'done' } });
    } catch (e) {
      await receipts.updateOne({ updateId: update.update_id }, { $set: { leaseUntil: new Date(0) } }).catch(() => {});
      throw e;
    }
  };
}
