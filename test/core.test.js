import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, validateConfig } from '../src/config/index.js';
import { getNotJoinedChannels, isMember } from '../src/services/membershipService.js';
import { TelegramClient, ALLOWED_UPDATES } from '../src/bot/createBot.js';
import { validWebhookSecret, createApp } from '../src/app.js';
import { movieService } from '../src/services/movieService.js';
import { validateInviteLink } from '../src/services/channelService.js';

const channel = { chatIdOrUsername: '-1001234567890', type: 'private', accessMode: 'member' };
test('configuration rejects invalid admins and unsecured webhooks', () => {
  const cfg = loadConfig({ BOT_TOKEN: '123456789:' + 'a'.repeat(35), ADMIN_IDS: '111,222', MONGODB_URI: 'mongodb://localhost/test', BOT_MODE: 'webhook', RENDER_EXTERNAL_URL: 'https://kinobot.onrender.com', WEBHOOK_SECRET: 'b'.repeat(40) });
  assert.deepEqual(validateConfig(cfg), []);
  assert.ok(validateConfig({ ...cfg, adminIds: [NaN] }).length);
  assert.ok(validateConfig({ ...cfg, webhookSecret: '' }).length);
  assert.ok(validateConfig({ ...cfg, webhookUrl: 'http://localhost' }).length);
  assert.ok(validateConfig(loadConfig({})).length);
});
test('membership never accepts a clicked button or legacy joinedUsers', async () => {
  const missing = await getNotJoinedChannels({ getChatMember: async () => ({ status: 'left' }) }, 123, [{ ...channel, joinedUsers: [123] }]);
  assert.equal(missing.length, 1);
  assert.equal(isMember({ status: 'restricted', is_member: false }), false);
  assert.equal(isMember({ status: 'restricted', is_member: true }), true);
});
test('request mode requires real pending request; errors and banned users fail closed', async () => {
  const pending = { status: 'pending', requestedAt: new Date() };
  const ch = { ...channel, accessMode: 'request' };
  const bot = { getChatMember: async () => ({ status: 'left' }) };
  assert.equal((await getNotJoinedChannels(bot, 123, [ch], async () => pending)).length, 0);
  for (const request of [null, { ...pending, status: 'declined' }, { ...pending, requestedAt: new Date(0) }]) {
    assert.equal((await getNotJoinedChannels(bot, 123, [ch], async () => request)).length, 1);
  }
  assert.equal((await getNotJoinedChannels({ getChatMember: async () => ({ status: 'kicked' }) }, 123, [ch], async () => pending)).length, 1);
  assert.equal((await getNotJoinedChannels({ getChatMember: async () => { throw new Error(); } }, 123, [ch], async () => pending)).length, 1);
});
test('Telegram client uses API method and propagates flood retry info safely', async () => {
  let request;
  const client = new TelegramClient('secret', async (url, opts) => { request = { url, body: JSON.parse(opts.body) }; return { json: async () => ({ ok: true, result: { message_id: 1 } }) }; });
  await client.sendMessage(123, 'hello');
  assert.ok(request.url.endsWith('/sendMessage')); assert.deepEqual(request.body, { chat_id: 123, text: 'hello' });
  const limited = new TelegramClient('secret', async () => ({ json: async () => ({ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 2 } }) }));
  await assert.rejects(limited.sendMessage(123, 'x'), e => e.error_code === 429 && e.retryAfter === 2);
  const network = new TelegramClient('secret', async () => { throw new Error('https://api.telegram.org/botsecret'); });
  await assert.rejects(network.sendMessage(1, 'x'), e => !e.message.includes('botsecret'));
  assert.ok(ALLOWED_UPDATES.includes('chat_join_request'));
});
test('HTML caption escapes user-controlled markup and includes movie code', () => {
  const caption = movieService.buildCaption({ title: '<script>', description: '&hello', code: '101', views: 1 });
  assert.ok(caption.includes('&lt;script&gt;')); assert.ok(caption.includes('&amp;hello')); assert.ok(caption.includes('<code>101</code>'));
  assert.equal(validateInviteLink('https://evil.example/a'), false);
  assert.equal(validateInviteLink('javascript:alert(1)'), false);
  assert.equal(validateInviteLink('https://t.me/+abcdef'), true);
});
test('HTTP health reports incomplete setup and webhook authentication blocks spoofed updates', async () => {
  assert.equal(validWebhookSecret('x', 'x'), true); assert.equal(validWebhookSecret(undefined, 'x'), false); assert.equal(validWebhookSecret('x', ''), false);
  let handled = 0;
  const state = { ready: false, phase: 'needs_configuration', telegram: false };
  const app = createApp({ state, getDbState: () => 1, processUpdate: async () => { handled++; }, cfg: { mode: 'webhook', webhookPath: '/hook', webhookSecret: 's'.repeat(40) } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(base + '/health'); assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
    response = await fetch(base + '/hook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); assert.equal(response.status, 403);
    state.ready = true; state.telegram = true;
    response = await fetch(base + '/health'); assert.equal(response.status, 200);
    response = await fetch(base + '/hook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 's'.repeat(40) }, body: '{"update_id":1}' });
    assert.equal(response.status, 200); assert.equal(handled, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
