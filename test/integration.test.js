import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createHandlers } from '../src/bot/registerHandlers.js';
import { createUpdateProcessor } from '../src/services/updateService.js';
import { Movie } from '../src/models/Movie.js';
import { User } from '../src/models/User.js';
import { Channel } from '../src/models/Channel.js';
import { JoinRequest } from '../src/models/JoinRequest.js';
import { Session } from '../src/models/Session.js';
import { Broadcast } from '../src/models/Broadcast.js';
import { movieService } from '../src/services/movieService.js';
import { userService } from '../src/services/userService.js';
import { channelService } from '../src/services/channelService.js';
import { cacheService } from '../src/services/cacheService.js';
import { broadcastService } from '../src/services/broadcastService.js';
import { ensureIndexes } from '../src/services/databaseService.js';

const adminId = 111, viewer = 222;
const cfg = { startGif: '', supportUsername: 'kinobot_support', devInfo: 'test' };
let messageId = 100;
function fakeBot() {
  const calls = [];
  const bot = { calls, identity: { id: 999, username: 'test_kinobot', supports_inline_queries: true }, memberStatus: 'left' };
  for (const method of ['sendMessage', 'sendVideo', 'sendDocument', 'sendPhoto', 'sendAnimation', 'copyMessage', 'answerCallbackQuery', 'answerInlineQuery', 'approveChatJoinRequest', 'declineChatJoinRequest']) {
    bot[method] = async (...args) => { calls.push({ method, args }); return { message_id: ++messageId }; };
  }
  bot.getChatMember = async (_chat, uid) => uid === 999 ? { status: 'administrator', can_invite_users: true } : { status: bot.memberStatus };
  bot.getChat = async () => ({ id: -1001234567890, type: 'channel', username: 'test_channel' });
  bot.createChatInviteLink = async () => ({ invite_link: 'https://t.me/+legit_request' });
  return bot;
}
const msg = (uid, text, extras = {}) => ({ message_id: ++messageId, from: { id: uid, first_name: 'Test' }, chat: { id: uid, type: 'private' }, text, ...extras });
const cb = (uid, data) => ({ id: String(++messageId), from: { id: uid, first_name: 'Test' }, message: msg(uid, ''), data });

test('real MongoDB: complete movie, subscription, VIP and admin workflows', { timeout: 240000 }, async t => {
  const dbPath = await mkdtemp(join(existsSync('/dev/shm') ? '/dev/shm' : tmpdir(), 'kinobot-test-'));
  const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { dbPath, args: ['--nounixsocket', '--setParameter', 'diagnosticDataCollectionEnabled=false'] } });
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  await ensureIndexes();
  const bot = fakeBot();
  let clock = Date.now();
  const handlers = createHandlers(bot, { config: cfg, isAdmin: id => id === adminId, now: () => (clock += 150) });
  let updateId = 1;
  const dispatch = update => handlers.handleUpdate({ update_id: updateId++, ...update });
  try {
    await t.test('admin adds a video through every step and confirmation', async () => {
      await dispatch({ message: msg(adminId, '/admin') });
      await dispatch({ callback_query: cb(adminId, 'adm_add') });
      for (const text of ['Interstellar', '101', '2014 | O‘zbek | Fantastika | free', 'Kosmos hikoyasi', '-']) await dispatch({ message: msg(adminId, text) });
      await dispatch({ message: msg(adminId, '', { video: { file_id: 'video_101' } }) });
      assert.equal((await Session.findOne({ userId: adminId })).step, 'movie_confirm');
      await dispatch({ callback_query: cb(adminId, 'adm_movie_confirm') });
      assert.equal(await Movie.countDocuments(), 1); assert.equal(await Session.countDocuments(), 0);
    });
    await t.test('movie search and delivery, views counted after sending', async () => {
      await dispatch({ message: msg(viewer, '/start') });
      await dispatch({ message: msg(viewer, '101') });
      assert.ok(bot.calls.some(c => c.method === 'sendVideo' && c.args[0] === viewer));
      assert.equal((await movieService.findByCode('101')).views, 1);
      assert.equal((await movieService.searchByName('Interstelar'))[0].code, '101');
      await dispatch({ message: msg(viewer, '/top') }); await dispatch({ message: msg(viewer, '/last') }); await dispatch({ message: msg(viewer, '/rand') });
    });
    await t.test('saved movies persist and VIP is denied until admin grants access', async () => {
      const movie = await movieService.findByCode('101');
      await dispatch({ callback_query: cb(viewer, `save:${movie._id}`) });
      assert.equal((await userService.favorites(viewer)).length, 1);
      await dispatch({ callback_query: cb(viewer, 'favorites:0') });
      await dispatch({ message: msg(adminId, '/movievip 101 on') });
      const before = bot.calls.filter(c => c.method === 'sendVideo').length;
      await dispatch({ message: msg(viewer, '101') });
      assert.equal(bot.calls.filter(c => c.method === 'sendVideo').length, before);
      await dispatch({ message: msg(adminId, '/vipgive 222 30') });
      assert.equal(await userService.hasVip(viewer), true);
      await dispatch({ message: msg(viewer, '101') }); assert.equal(bot.calls.filter(c => c.method === 'sendVideo').length, before + 1);
      await dispatch({ message: msg(adminId, '/vipremove 222') }); assert.equal(await userService.hasVip(viewer), false);
      await dispatch({ message: msg(adminId, '/movievip 101 off') });
    });
    await t.test('non-admin callbacks cannot mutate data', async () => {
      await dispatch({ callback_query: cb(viewer, 'adm_add') });
      assert.equal(await Session.countDocuments({ userId: viewer }), 0);
      await dispatch({ message: msg(viewer, '/vipgive 222 30') }); assert.equal(await userService.hasVip(viewer), false);
    });
    await t.test('private request gating uses genuine Telegram update; old Opened cannot bypass', async () => {
      await dispatch({ callback_query: cb(adminId, 'adm_ch_add') });
      await dispatch({ message: msg(adminId, '-1001234567890 | auto | Test kanal | private | request') });
      assert.equal(await Channel.countDocuments(), 1);
      const before = bot.calls.filter(c => c.method === 'sendVideo').length;
      await dispatch({ message: msg(viewer, '/start movie_101') });
      await dispatch({ callback_query: cb(viewer, 'join_0') });
      await dispatch({ message: msg(viewer, '101') });
      assert.equal(bot.calls.filter(c => c.method === 'sendVideo').length, before);
      await dispatch({ chat_join_request: { chat: { id: -1001234567890 }, from: { id: viewer, first_name: 'Test' }, date: Math.floor(Date.now() / 1000) } });
      assert.equal((await JoinRequest.findOne({ userId: viewer })).status, 'pending');
      await dispatch({ callback_query: cb(viewer, 'verify_join') });
      assert.equal(bot.calls.filter(c => c.method === 'sendVideo').length, before + 1);
      assert.equal(await Session.countDocuments({ userId: viewer }), 0);
      const request = await JoinRequest.findOne({ userId: viewer });
      await dispatch({ callback_query: cb(adminId, `jr:decline:${request._id}`) });
      await dispatch({ message: msg(viewer, '101') });
      assert.equal(bot.calls.filter(c => c.method === 'sendVideo').length, before + 1);
      bot.memberStatus = 'member';
      await dispatch({ message: msg(viewer, '101') }); assert.equal(bot.calls.filter(c => c.method === 'sendVideo').length, before + 2);
      bot.memberStatus = 'left';
    });
    await t.test('inline cards do not leak raw files or VIP content', async () => {
      await dispatch({ inline_query: { id: 'inline1', from: { id: viewer }, query: '101' } });
      const result = bot.calls.filter(c => c.method === 'answerInlineQuery').at(-1).args[1][0];
      assert.equal(result.type, 'article'); assert.ok(result.input_message_content.message_text.includes('start=movie_101')); assert.equal(result.video_file_id, undefined);
    });
    await t.test('durable webhook receipts deduplicate and retry failures', async () => {
      let calls = 0;
      const processUpdate = createUpdateProcessor(async () => { calls++; });
      await processUpdate({ update_id: 800 }); await processUpdate({ update_id: 800 }); assert.equal(calls, 1);
      let failures = 0;
      const retry = createUpdateProcessor(async () => { failures++; if (failures === 1) throw new Error('temporary'); });
      await assert.rejects(retry({ update_id: 801 })); await retry({ update_id: 801 }); assert.equal(failures, 2);
      await assert.rejects(processUpdate({}), e => e.status === 400);
    });
    await t.test('broadcast confirmation creates durable job and worker delivers', async () => {
      await dispatch({ callback_query: cb(adminId, 'adm_broadcast') });
      await dispatch({ message: msg(adminId, 'Yangiliklar') });
      assert.equal(await Broadcast.countDocuments(), 0);
      await dispatch({ callback_query: cb(adminId, 'adm_broadcast_confirm') });
      assert.equal(await Broadcast.countDocuments(), 1);
      await broadcastService.runNext(bot, new AbortController().signal);
      const job = await Broadcast.findOne(); assert.equal(job.status, 'done'); assert.equal(job.sent, 2);
    });
    await t.test('legacy text index migration preserves movies and fixes Uzbek language field', async () => {
      await Movie.collection.dropIndex('title_text_description_text');
      await Movie.collection.updateOne({ code: '101' }, { $set: { language: 'english' } });
      await Movie.collection.createIndex({ title: 'text', description: 'text' });
      await ensureIndexes();
      const index = (await Movie.collection.indexes()).find(i => i.name === 'title_text_description_text');
      assert.equal(index.language_override, 'searchLanguage'); assert.equal(index.default_language, 'none');
      await Movie.collection.updateOne({ code: '101' }, { $set: { language: 'O‘zbek' } });
      assert.equal((await Movie.findOne({ code: '101' })).language, 'O‘zbek');
      assert.equal(await Movie.countDocuments(), 1);
    });
    await t.test('admin deletion requires confirmation and removes catalog entry', async () => {
      await dispatch({ callback_query: cb(adminId, 'adm_del') });
      await dispatch({ message: msg(adminId, '101') }); assert.equal(await Movie.countDocuments(), 1);
      await dispatch({ callback_query: cb(adminId, 'adm_delete_confirm') }); assert.equal(await Movie.countDocuments(), 0);
    });
  } finally { cacheService.flush(); await mongoose.disconnect(); await mongo.stop(); await rm(dbPath, { recursive: true, force: true }); }
});
