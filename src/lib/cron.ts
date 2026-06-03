import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { bot } from './bot';

const prisma = new PrismaClient();

export function startCronJobs() {
  console.log("Cron scheduler initialized.");

cron.schedule('0 8,18 * * *', async () => {
    try {
      const now = new Date();
      
      const tomorrow = new Date();
      console.log(`CRON CHECK: Searching for tasks due between ${now.toISOString()} and ${tomorrow.toISOString()}`);
      tomorrow.setDate(now.getDate() + 1);

      const assignmentsDueSoon = await prisma.assignment.findMany({
        where: {
          status: { not: 'COMPLETED' },
          deadline: {
            gte: now,
            lte: tomorrow
          }
          
        },
        
        include: {
          student: true,
          teacher: true
        }
      });

      if (assignmentsDueSoon.length > 0) {
        console.log(`Found ${assignmentsDueSoon.length} assignments due soon. Sending reminders...`);
      }

      for (const assignment of assignmentsDueSoon) {
        try {
          await bot.telegram.sendMessage(
            assignment.student.telegramId,
            `AUTOMATED REMINDER:\n\nHi ${assignment.student.name}, your assignment "${assignment.description}" from ${assignment.teacher.name} is due in less than 24 hours! Make sure to submit it soon.`
          );
        } catch (err) {
          console.error(`Failed to send reminder to ${assignment.student.name}`);
        }
      }
    } catch (error) {
      console.error("Cron Job Error:", error);
    }
    
  });
}