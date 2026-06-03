import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { LLMService } from './llm';

const prisma = new PrismaClient();
export const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '');

bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const name = ctx.from.first_name;
  
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: { name },
    create: { telegramId, name, role: 'PENDING' },
  });

  if (user.role === 'PENDING') {
    await ctx.reply(
      `Welcome ${name}!\n\nYour unique Login ID is: ${telegramId}\nKeep this safe, you will need it to access the web dashboard.\n\nAre you a TEACHER or a STUDENT? Reply with your role.`
    );
  } else {
    await ctx.reply(
      `Welcome back, ${name}!\n\nYou are registered as a ${user.role}.\nYou can jump right back into chatting with me, or log into your dashboard at: http://localhost:3000`
    );
  }
});

bot.command('login', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  await ctx.reply(
    `Your Login ID is: ${telegramId}\n\nYou can log in here: http://localhost:3000`
  );
});

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  const telegramId = ctx.from.id.toString();
  const user = await prisma.user.findUnique({ where: { telegramId } });
  
  if (!user) {
    await ctx.reply("Please type /start to initialize your account!");
    return;
  }

  if (user.role === 'PENDING') {
    if (userMessage.toUpperCase() === 'TEACHER' || userMessage.toUpperCase() === 'STUDENT') {
      await prisma.user.update({
        where: { telegramId },
        data: { role: userMessage.toUpperCase() }
      });
      await ctx.reply(`Role successfully set to ${userMessage.toUpperCase()}! You can now use the bot.`);
      return;
    } else {
      await ctx.reply("Please set your role first by replying 'TEACHER' or 'STUDENT'.");
      return;
    }
  }

  const loadingMessage = await ctx.reply("Thinking...");

  try {
    const intent = await LLMService.parseIntent(userMessage);

    if (intent.type === 'ASSIGN_WORK' && user.role === 'TEACHER') {
      if (!intent.studentName) {
         await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
          "I could not catch the student's name. Please try again!"
        );
        return;
      }

      const student = await prisma.user.findFirst({ 
        where: { name: { contains: intent.studentName }, role: 'STUDENT' } 
      });
      
      if (!student) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
          `I could not find a student named "${intent.studentName}" in the system. Make sure they have registered via the bot!`
        );
        return;
      }

      const existingTask = await prisma.assignment.findFirst({
        where: {
          studentId: student.id,
          description: intent.description,
          status: { not: 'COMPLETED' }
        }
      });

      if (existingTask) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
          `${student.name} already has this exact task assigned to them, and they have not completed it yet!`
        );
        return;
      }

      const deadline = new Date();
      const hoursToAdd = ((intent.deadlineDays || 1) * 24) - 1; 
      deadline.setHours(deadline.getHours() + hoursToAdd);

      await prisma.assignment.create({
        data: {
          description: intent.description,
          deadline: deadline,
          teacherId: user.id,
          studentId: student.id,
          status: 'PENDING'
        }
      });

      await ctx.telegram.sendMessage(
        student.telegramId, 
        `New Assignment from ${user.name}!\n\nTask: ${intent.description}\nDue in ${intent.deadlineDays} days.`
      );
      
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
        `Task successfully assigned to ${student.name}!`
      );
      return;
    }

    if (intent.type === 'STATUS_UPDATE' && user.role === 'STUDENT') {
      const activeAssignment = await prisma.assignment.findFirst({
        where: { studentId: user.id, status: { not: 'COMPLETED' } },
        orderBy: { deadline: 'asc' },
        include: { teacher: true }
      });
      
      if (!activeAssignment) throw new Error("No active assignments.");

      await prisma.assignment.update({
        where: { id: activeAssignment.id },
        data: { status: intent.status }
      });

      await ctx.telegram.sendMessage(
        activeAssignment.teacher.telegramId, 
        `Status Update!\n\n${user.name} is now marking their assignment as: ${intent.status}.`
      );
      
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
        `Status updated to ${intent.status} and your teacher has been notified!`
      );
      return;
    }

    if (intent.type === 'SUBMIT_WORK' && user.role === 'STUDENT') {
      const activeAssignment = await prisma.assignment.findFirst({
        where: { studentId: user.id, status: { not: 'COMPLETED' } },
        orderBy: { deadline: 'asc' },
        include: { teacher: true }
      });

      if (!activeAssignment) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
          "You do not have any active assignments to submit right now."
        );
        return;
      }

      await prisma.assignment.update({
        where: { id: activeAssignment.id },
        data: { 
          status: 'COMPLETED',
          submission: intent.submissionText 
        }
      });

      await ctx.telegram.sendMessage(
        activeAssignment.teacher.telegramId,
        `New Submission!\n\n${user.name} just submitted their work for: "${activeAssignment.description}"\n\nText: ${intent.submissionText}`
      );

      await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
        `Submission received! I have marked it as COMPLETED and sent it to your teacher.`
      );
      return;
    }

    if (intent.type === 'ANNOUNCEMENT' && user.role === 'TEACHER') {
      const allStudents = await prisma.user.findMany({ 
        where: { role: 'STUDENT' } 
      });

      if (allStudents.length === 0) {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
          "You do not have any students registered yet!"
        );
        return;
      }

      let successCount = 0;

      for (const student of allStudents) {
        try {
          await ctx.telegram.sendMessage(
            student.telegramId, 
            `CLASS ANNOUNCEMENT from ${user.name}:\n\n${intent.message}`
          );
          successCount++;
        } catch (error) {
          console.error(`Failed to message student ${student.name}`);
        }
      }

      await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
        `Announcement successfully sent to ${successCount} students!`
      );
      return;
    }

    await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
      "I did not quite catch that. Try rephrasing what you want to do!"
    );

  } catch (error) {
    console.error("Bot Error:", error);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
      "Sorry, I ran into an error processing that request."
    );
  }
});

bot.on(['photo', 'document'], async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const user = await prisma.user.findUnique({ where: { telegramId } });
    
    if (!user || user.role !== 'STUDENT') return;

    const activeAssignment = await prisma.assignment.findFirst({
      where: { studentId: user.id, status: { not: 'COMPLETED' } },
      orderBy: { deadline: 'asc' },
      include: { teacher: true }
    });

    if (!activeAssignment) {
      await ctx.reply("You do not have any active assignments to submit files for right now!");
      return;
    }

    const loadingMessage = await ctx.reply("Uploading file to dashboard...");

    let fileId = '';
    if ('photo' in ctx.message) {
      fileId = ctx.message.photo.pop()!.file_id; 
    } else if ('document' in ctx.message) {
      fileId = ctx.message.document.file_id;
    }

    const fileUrl = await ctx.telegram.getFileLink(fileId);

    await prisma.assignment.update({
      where: { id: activeAssignment.id },
      data: { 
        status: 'COMPLETED',
        submission: fileUrl.href 
      }
    });

    await ctx.telegram.sendMessage(
      activeAssignment.teacher.telegramId,
      `New File Submission!\n\n${user.name} just submitted a file for: "${activeAssignment.description}"`
    );

    await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined, 
      `File securely uploaded! I have marked your assignment as COMPLETED and notified your teacher.`
    );

  } catch (error) {
    console.error("File upload error:", error);
    await ctx.reply("Sorry, I had trouble processing that file.");
  }
});