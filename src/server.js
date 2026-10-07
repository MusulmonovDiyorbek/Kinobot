import mongoose from 'mongoose';
import { config, validateConfig } from './config/index.js';
import { createBot, syncWebhook, ALLOWED_UPDATES } from './bot/createBot.js';
import { createHandlers } from './bot/registerHandlers.js';
import { createUpdateProcessor } from './services/updateService.js';
import { createApp } from './app.js';
import { broadcastService } from './services/broadcastService.js';
import { errorSummary } from './utils/errors.js';
import { ensureIndexes } from './services/databaseService.js';
const state = { ready: false, telegram: false, phase: 'starting' };
const controller = new AbortController();
let bot, processUpdate, shuttingDown = false;
const app = createApp({ state, getDbState: () => mongoose.connection.readyState, processUpdate: update => processUpdate(update) });
const server = app.listen(config.port, '0.0.0.0', () => console.log(`HTTP listening on ${config.port}`));
const delay = async ms => {
  if (controller.signal.aborted) return;
  await new Promise(resolve => {
    const stop = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', stop); resolve(); };
    const timer = setTimeout(stop, ms);
    controller.signal.addEventListener('abort', stop, { once: true });
  });
};
async function poll() {
  let offset = 0;
  while (!controller.signal.aborted) {
    try {
      const updates = await bot.call('getUpdates', { offset, timeout: 25, allowed_updates: ALLOWED_UPDATES }, { signal: controller.signal });
      for (const update of updates) {
        if (controller.signal.aborted) break;
        await processUpdate(update); offset = update.update_id + 1;
      }
    } catch (e) {
      if (controller.signal.aborted) break;
      console.error('polling', errorSummary(e));
      if (e.error_code === 409) console.error('Another bot instance or webhook is active. Run only one polling instance.');
      await delay(3000);
    }
  }
}
async function broadcastLoop() {
  while (!controller.signal.aborted) {
    try { if (state.ready && mongoose.connection.readyState === 1) await broadcastService.runNext(bot, controller.signal); }
    catch (e) { console.error('broadcast_loop', errorSummary(e)); }
    await delay(5000);
  }
}
async function initialize() {
  const errors = validateConfig();
  if (errors.length) {
    state.phase = 'needs_configuration'; console.error('Configuration required:', errors.join('; '));
    // HTTP remains alive for deploy diagnostics; /health stays 503 until actually ready.
    return;
  }
  while (!controller.signal.aborted) {
    try {
      state.phase = 'connecting_database';
      mongoose.set('strictQuery', true);
      mongoose.set('autoIndex', false);
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
      await ensureIndexes();
      state.phase = 'connecting_telegram';
      bot = createBot(); bot.identity = await bot.call('getMe');
      const handlers = createHandlers(bot); processUpdate = createUpdateProcessor(handlers.handleUpdate);
      await bot.call('setMyCommands', { commands: [
        { command: 'start', description: 'Asosiy menyu' }, { command: 'top', description: 'Top filmlar' },
        { command: 'last', description: 'Yangi filmlar' }, { command: 'rand', description: 'Tasodifiy kino' },
        { command: 'saved', description: 'Saqlanganlar' }, { command: 'vip', description: 'VIP holati' },
        { command: 'help', description: 'Yordam' }, { command: 'dev', description: 'Dasturchi' },
        { command: 'cancel', description: 'Amalni bekor qilish' },
      ] });
      await syncWebhook(bot); state.telegram = true; state.ready = true; state.phase = 'ready';
      console.log(`Bot @${bot.identity.username} ready (${config.mode})`);
      if (!bot.identity.supports_inline_queries) console.warn('Enable inline mode in BotFather: /setinline');
      void broadcastLoop();
      if (config.mode === 'polling') void poll();
      return;
    } catch (e) {
      state.ready = false; state.telegram = false; state.phase = 'connection_failed';
      console.error('startup', errorSummary(e));
      await mongoose.disconnect().catch(() => {}); await delay(15000);
    }
  }
}
async function shutdown(signal) {
  if (shuttingDown) return; shuttingDown = true;
  console.log(`${signal}: shutting down`); state.ready = false; controller.abort();
  const forced = setTimeout(() => process.exit(1), 10000); forced.unref();
  await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT')); process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', e => { console.error('unhandled_rejection', errorSummary(e)); void shutdown('fatal'); });
void initialize();
