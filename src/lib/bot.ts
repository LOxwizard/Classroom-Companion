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

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) return;

    const loadingMessage = await ctx.reply("Processing with AI...");
    const intent = await llm.parseIntent(message);
    
    if (intent.type === 'ASSIGN_WORK' && user.role === 'TEACHER') {
      
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + (intent.deadlineDays || 1));

      const firstStudent = await prisma.user.findFirst({ where: { role: 'STUDENT' } });

      if (!firstStudent) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
          `I understood the assignment, but you have no registered students in the database yet!`
        );
        return;
      }

      await prisma.assignment.create({
        data: {
          description: intent.description,
          deadline: deadlineDate,
          studentId: firstStudent.id,
          teacherId: user.id,
          status: 'PENDING'
        }
      });

      try {
        await ctx.telegram.sendMessage(
          firstStudent.telegramId,
          ` New Assignment from your Teacher!\n\nTask: ${intent.description}\nDue: ${deadlineDate.toDateString()}\n\nWhen you start, just reply here with "I started" or "Stuck" to update your status!`
        );
      } catch (err) {
        console.error("Could not message student:", err);
      }

      await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
        ` Assignment Created & Sent to ${firstStudent.name}!\n\nTask: ${intent.description}\nDue: ${deadlineDate.toDateString()}`
      );
      return;
    }

    await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
      `System detected intent: ${intent.type}. (More features coming soon!)`
    );

  } catch (error) {
    console.error("FATAL AI ERROR:", error);
    await ctx.reply("Whoops, The AI connection failed.");
  }
});