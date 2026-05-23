import * as dotenv from 'dotenv';
dotenv.config(); 

import { bot } from './src/lib/bot';

console.log('Classroom Companion Bot is booting up...');
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));