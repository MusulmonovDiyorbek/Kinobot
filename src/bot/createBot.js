import { config } from '../config/index.js';
export const ALLOWED_UPDATES = ['message', 'callback_query', 'inline_query', 'chat_join_request', 'chat_member', 'my_chat_member'];
export class TelegramClient {
  constructor(token, fetchImpl = fetch) { this.token = token; this.fetchImpl = fetchImpl; }
  async call(method, params = {}, { signal, timeout = 40000 } = {}) {
    let response;
    try {
      response = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
      });
    } catch (cause) { const e = new Error('Telegram transport failed'); e.code = cause.name; throw e; }
    const body = await response.json();
    if (!body.ok) {
      const e = new Error(body.description || 'Telegram API error');
      e.error_code = body.error_code; e.retryAfter = body.parameters?.retry_after; throw e;
    }
    return body.result;
  }
  sendMessage(chat_id, text, options = {}) { return this.call('sendMessage', { chat_id, text, ...options }); }
  sendPhoto(chat_id, photo, options = {}) { return this.call('sendPhoto', { chat_id, photo, ...options }); }
  sendVideo(chat_id, video, options = {}) { return this.call('sendVideo', { chat_id, video, ...options }); }
  sendDocument(chat_id, document, options = {}) { return this.call('sendDocument', { chat_id, document, ...options }); }
  sendAnimation(chat_id, animation, options = {}) { return this.call('sendAnimation', { chat_id, animation, ...options }); }
  copyMessage(chat_id, from_chat_id, message_id, options = {}) { return this.call('copyMessage', { chat_id, from_chat_id, message_id, ...options }); }
  getChatMember(chat_id, user_id) { return this.call('getChatMember', { chat_id, user_id }); }
  getChat(chat_id) { return this.call('getChat', { chat_id }); }
  answerCallbackQuery(callback_query_id, options = {}) { return this.call('answerCallbackQuery', { callback_query_id, ...options }); }
  answerInlineQuery(inline_query_id, results, options = {}) { return this.call('answerInlineQuery', { inline_query_id, results, ...options }); }
  approveChatJoinRequest(chat_id, user_id) { return this.call('approveChatJoinRequest', { chat_id, user_id }); }
  declineChatJoinRequest(chat_id, user_id) { return this.call('declineChatJoinRequest', { chat_id, user_id }); }
  createChatInviteLink(chat_id, options = {}) { return this.call('createChatInviteLink', { chat_id, ...options }); }
}
export function createBot() { return new TelegramClient(config.botToken); }
export async function syncWebhook(bot) {
  if (config.mode === 'webhook') return bot.call('setWebhook', {
    url: config.webhookUrl + config.webhookPath, secret_token: config.webhookSecret,
    allowed_updates: ALLOWED_UPDATES, drop_pending_updates: false, max_connections: 10,
  });
  return bot.call('deleteWebhook', { drop_pending_updates: false });
}
