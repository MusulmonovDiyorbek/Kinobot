# Kinobot — Telegram movie bot

Production-oriented Telegram bot (Node.js ES modules, Express, MongoDB/Mongoose, `node-telegram-bot-api`) for publishing movies by code/name, inline search with cached `file_id`, mandatory channel membership, admin tools, and broadcast ads.

## Prerequisites

- Node.js **18+**
- MongoDB **6+** (local or Atlas)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Quick start

1. **Clone / copy** the project and install dependencies:

   ```bash
   cd Kinobot
   npm install
   ```

2. **Environment** — copy `.env.example` to `.env` and fill in real values:

   - `BOT_TOKEN` — from BotFather.
   - `ADMIN_IDS` — comma-separated numeric Telegram user IDs (Profile → copy id via bots such as [@userinfobot](https://t.me/userinfobot)).
   - `MONGODB_URI` — e.g. `mongodb://127.0.0.1:27017/kinobot` or an Atlas connection string.

3. **BotFather configuration**

   - Create the bot and save the token.
   - Enable **Inline mode** (Bot Settings → Inline Mode → Turn on). Without this, `@yourbot query` will not work.
   - Optional: set a bot profile picture and description.

4. **Run**

   ```bash
   npm start
   ```

   - Default **HTTP** port: `3000` (health: `GET /health`).
   - With `WEBHOOK_URL` empty, the bot uses **long polling** (simplest for a single process).
   - With `WEBHOOK_URL=https://your-domain.example.com` and a valid TLS certificate, the app calls `setWebHook` to `{WEBHOOK_URL}{WEBHOOK_PATH}` (default path `/telegram/webhook`). Your reverse proxy must forward POST requests to that path with a JSON body.

5. **Mandatory channels**

   - Open `/admin` in a **private chat** with the bot (only listed `ADMIN_IDS` get a response).
   - Use **Channels → Add channel** with format:
     `chat_id | https://t.me/+inviteOrPublicLink | Title`
   - The bot must be able to call `getChatMember` on `chat_id` (numeric `-100…` or `@username` as stored). Add the bot as member/admin in the channel if the API requires it.

6. **Add movies**

   - `/admin` → Add movie → follow prompts (title, code, metadata, poster photo optional, then **video/document** or **forward** from a channel).
   - **Inline results** require a non-empty `telegramFileId` (video/document). The admin upload/forward step fills this automatically.

## MongoDB collections (schemas)

| Collection  | Model    | Purpose |
|------------|----------|---------|
| `users`    | `User`   | Telegram users, blocked flag, last `/start` / ad timestamps. |
| `movies`   | `Movie`  | Metadata, views, `telegramFileId`, optional `channelId` + `channelMessageId`, `posterFileId`. |
| `channels` | `Channel`| Required subscriptions + invite links. |
| `ads`      | `Ad`     | Latest active broadcast template (text + optional photo). |

Indexes are created/updated on startup via `syncIndexes()`:

- `Movie`: **unique** `code`, **text** index on `title` + `description`, `views`, `createdAt`.
- Others: see `src/models/*.js`.

## Caching

- `node-cache` wraps hot reads: movie by code, top/last lists, required channels, stats summary (short TTLs). Mutations invalidate relevant keys.

## Security notes

- `/admin` and callbacks under the admin panel **do nothing** for users not in `ADMIN_IDS`.
- Prefer **webhook + HTTPS** in production; keep the token only in `.env`.
- Tune `AD_BROADCAST_INTERVAL_MINUTES` to avoid spam; `0` disables the scheduled ad loop (manual broadcast from admin panel still works).

## Project layout

```text
src/
  bot/           createBot, registerHandlers, keyboards
  config/        env loading + validation
  controllers/   HTTP helpers (health)
  middlewares/   Express error handlers
  models/        Mongoose schemas
  routes/        Express routes
  services/      movies, users, channels, ads, cache, broadcast, etc.
  app.js         Express app factory
  server.js      DB connect, bot, HTTP listen, scheduled jobs
```

## Troubleshooting

- **`getChatMember` fails** — wrong `chat_id`, bot not in channel, or channel is private without bot membership.
- **Inline shows nothing** — query empty, or movies missing `telegramFileId`.
- **404 on polling** — invalid `BOT_TOKEN`.
- **Mongo connection errors** — check `MONGODB_URI` and that MongoDB is reachable.
