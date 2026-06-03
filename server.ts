import 'dotenv/config';

console.log("Checking Environment Variables...");
console.log("TELEGRAM_TOKEN:", process.env.TELEGRAM_TOKEN ? "Loaded" : "MISSING!");

import { bot } from './src/lib/bot';
import { startCronJobs } from './src/lib/cron';

if (!bot) {
    console.error("CRITICAL ERROR: The bot object is undefined. The export in src/lib/bot.ts failed.");
    process.exit(1);
}

console.log('Classroom Companion Bot is booting up...');
startCronJobs();
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));