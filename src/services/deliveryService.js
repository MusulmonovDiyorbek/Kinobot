import { movieService } from './movieService.js';
import { movieActionsKeyboard } from '../bot/keyboards.js';
async function sendMovieToChat(bot, chatId, movie, saved = false) {
  const options = { caption: movieService.buildCaption(movie), parse_mode: 'HTML', reply_markup: movieActionsKeyboard(movie._id, saved) };
  if (movie.telegramFileId) return movie.isDocument ? bot.sendDocument(chatId, movie.telegramFileId, options) : bot.sendVideo(chatId, movie.telegramFileId, options);
  if (movie.sourceType === 'channel' && movie.channelId && movie.channelMessageId) return bot.copyMessage(chatId, movie.channelId, movie.channelMessageId, options);
  throw new Error('MOVIE_NO_SOURCE');
}
export const deliveryService = { sendMovieToChat };
