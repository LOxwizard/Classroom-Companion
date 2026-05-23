import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { LLMService } from './llm';
import 'dotenv/config';

export const prisma = new PrismaClient();
export const bot = new Telegraf(process.env.TELEGRAM_TOKEN as string);
const llm = new LLMService('gemini');

bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const name = ctx.from.first_name;
  
  await prisma.user.upsert({
    where: { telegramId },
    update: { name },
    create: { telegramId, name, role: 'PENDING' },
  });

  await ctx.reply(`Welcome ${name}! Are you a TEACHER or a STUDENT? Reply with your role.`);
});

bot.on('text', async (ctx) => {
  try {
    const message = ctx.message.text.trim();
    const telegramId = ctx.from.id.toString();

    if (message.toUpperCase() === 'TEACHER' || message.toUpperCase() === 'STUDENT') {
      await prisma.user.update({
        where: { telegramId },
        data: { role: message.toUpperCase() },
      });
      await ctx.reply(`Awesome! Your role is officially set to ${message.toUpperCase()} in the database.`);
      return;
    }

    console.log(`[Bot] Received message from ${ctx.from.first_name}: ${message}`);
    const loadingMessage = await ctx.reply("Processing with AI...");
    
    const intent = await llm.parseIntent(message);
    console.log(`[Bot] AI parsed intent:`, intent);
    
    await ctx.telegram.editMessageText(
      ctx.chat.id, 
      loadingMessage.message_id, 
      undefined, 
      `System detected intent: ${intent.type}`
    );

  } catch (error) {
    console.error("FATAL AI ERROR:", error);
    await ctx.reply("Whoops! The AI connection failed. Check your VS Code terminal.");
  }
});