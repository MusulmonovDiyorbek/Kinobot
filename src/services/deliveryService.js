import { movieService } from './movieService.js';

/**
 * @param {import('node-telegram-bot-api')} bot
 * @param {number|string} chatId
 * @param {object} movie — lean movie doc after view increment
 */
async function sendMovieToChat(bot, chatId, movie) {
  const caption = movieService.buildCaption(movie);
  const opts = { caption, parse_mode: 'HTML' };

  if (movie.telegramFileId) {
    if (movie.isDocument) {
      await bot.sendDocument(chatId, movie.telegramFileId, opts);
    } else {
      await bot.sendVideo(chatId, movie.telegramFileId, opts);
    }
    return;
  }

  if (movie.sourceType === 'channel' && movie.channelId && movie.channelMessageId != null) {
    await bot.copyMessage(chatId, movie.channelId, movie.channelMessageId, {
      caption,
      parse_mode: 'HTML',
    });
    return;
  }

  throw new Error('MOVIE_NO_SOURCE');
}

export const deliveryService = { sendMovieToChat };
