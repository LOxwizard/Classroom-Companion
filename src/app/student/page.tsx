import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Telegraf } from 'telegraf';

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '');

export default async function StudentDashboard({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const resolvedParams = await searchParams;
  const studentId = parseInt(resolvedParams.id || '0');

  async function submitWork(formData: FormData) {
    'use server';
    const assignmentId = parseInt(formData.get('assignmentId') as string);
    const teacherTelegramId = formData.get('teacherTelegramId') as string;
    const submission = formData.get('submission') as string;
    const studentName = formData.get('studentName') as string;

    if (!assignmentId || !teacherTelegramId || !submission) return;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { 
        status: 'COMPLETED',
        submission: submission 
      }
    });

    try {
      await bot.telegram.sendMessage(
        teacherTelegramId,
        `WORK SUBMITTED:\n\n${studentName} just submitted an assignment!\n\nLog into your dashboard to review it.`
      );
    } catch (error) {
      console.log("Database updated, but failed to ping Telegram:", error);
    }

    revalidatePath('/student');
  }

  async function markAsStuck(formData: FormData) {
    'use server';
    const assignmentId = parseInt(formData.get('assignmentId') as string);
    const teacherTelegramId = formData.get('teacherTelegramId') as string;
    const studentName = formData.get('studentName') as string;
    const reason = formData.get('reason') as string;

    if (!assignmentId || !teacherTelegramId || !reason) return;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: 'STUCK' }
    });

    try {
      await bot.telegram.sendMessage(
        teacherTelegramId,
        `STUDENT NEEDS HELP:\n\n${studentName} is stuck on their assignment.\n\nMessage: "${reason}"\n\nPlease check your dashboard to reply!`
      );
    } catch (error) {
      console.log("Database updated, but failed to ping Telegram:", error);
    }

    revalidatePath('/student');
  }

  const assignments = await prisma.assignment.findMany({
    where: { studentId: studentId },
    include: {
      student: true,
      teacher: true,
    },
    orderBy: {
      deadline: 'asc',
    },
  });

  const isUrl = (text: string | null) => {
    if (!text) return false;
    return text.startsWith('http://') || text.startsWith('https://');
  };
  const pendingCount = assignments.filter(a => a.status === 'PENDING').length;
  const completedCount = assignments.filter(a => a.status === 'COMPLETED').length;
  const gradedCount = assignments.filter(a => a.status === 'GRADED').length;
  const stuckCount = assignments.filter(a => a.status === 'STUCK').length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg font-bold text-xl">
            CC
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Student Portal</h1>
        </div>
        <Link href="/" className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
          Log Out
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-8 mt-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">To Do</p>
            <p className="text-3xl font-extrabold text-blue-700 mt-1">{pendingCount}</p>
          </div>
          <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-rose-600 uppercase tracking-wider">Needs Help</p>
            <p className="text-3xl font-extrabold text-rose-700 mt-1">{stuckCount}</p>
          </div>
          <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Awaiting Grade</p>
            <p className="text-3xl font-extrabold text-emerald-700 mt-1">{completedCount}</p>
          </div>
          <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Finished & Graded</p>
            <p className="text-3xl font-extrabold text-purple-700 mt-1">{gradedCount}</p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600 font-bold text-2xl">
              ✓
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">You are all caught up!</h3>
            <p className="text-slate-500 max-w-sm">Enjoy your free time. When your teacher assigns new work, it will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {assignments.map((assignment) => (
              <div 
                key={assignment.id} 
                className={`group flex flex-col bg-white rounded-3xl overflow-hidden transition-all duration-300 ${
                  assignment.status === 'GRADED' 
                    ? 'border border-slate-200 opacity-60 hover:opacity-100' 
                    : 'border border-slate-200 hover:border-transparent hover:shadow-2xl hover:-translate-y-1 ring-1 ring-black/5'
                }`}
              >
                <div className={`h-2 w-full ${
                  assignment.status === 'COMPLETED' ? 'bg-emerald-400' : 
                  assignment.status === 'STUCK' ? 'bg-rose-400' : 
                  assignment.status === 'GRADED' ? 'bg-purple-400' : 
                  'bg-blue-400'
                }`} />

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                      assignment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 
                      assignment.status === 'STUCK' ? 'bg-rose-100 text-rose-800 animate-pulse' : 
                      assignment.status === 'GRADED' ? 'bg-purple-100 text-purple-800' : 
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {assignment.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      Due: {new Date(assignment.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-slate-800 mb-4 leading-tight group-hover:text-blue-700 transition-colors">
                    {assignment.description}
                  </h2>

                  <div className="flex items-center gap-3 mb-6 bg-slate-50 py-2 px-3 rounded-xl border border-slate-100 w-fit">
                    <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold shadow-sm">
                      {assignment.teacher?.name?.charAt(0).toUpperCase() || 'T'}
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      Assigned by <span className="font-bold">{assignment.teacher?.name || 'Teacher'}</span>
                    </p>
                  </div>

                  {(assignment.status === 'PENDING' || assignment.status === 'STUCK') && (
                    <div className="mt-auto flex flex-col gap-6 pt-4 border-t border-slate-100">
                      
                      <form action={submitWork} className="flex flex-col gap-2">
                        <input type="hidden" name="assignmentId" value={assignment.id} />
                        <input type="hidden" name="teacherTelegramId" value={assignment.teacher?.telegramId} />
                        <input type="hidden" name="studentName" value={assignment.student?.name || 'A student'} />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submit your work</p>
                        <textarea 
                          name="submission" 
                          required
                          placeholder="Paste a link or write your answer here..."
                          className="w-full text-slate-900 placeholder:text-slate-400 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none shadow-inner"
                          rows={2}
                        ></textarea>
                        <button 
                          type="submit"
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm hover:shadow-md"
                        >
                          Submit Assignment
                        </button>
                      </form>
                      
                      {assignment.status !== 'STUCK' && (
                        <form action={markAsStuck} className="flex flex-col gap-2">
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <input type="hidden" name="teacherTelegramId" value={assignment.teacher?.telegramId} />
                          <input type="hidden" name="studentName" value={assignment.student?.name || 'A student'} />
                          <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Need assistance?</p>
                          <textarea 
                            name="reason" 
                            required
                            placeholder="What are you stuck on? Type your question here..."
                            className="w-full text-slate-900 placeholder:text-rose-400 text-sm p-3 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50 resize-none shadow-inner"
                            rows={2}
                          ></textarea>
                          <button 
                            type="submit"
                            className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                          >
                            Send Message to Teacher
                          </button>
                        </form>
                      )}

                      {assignment.status === 'STUCK' && (
                        <div className="flex justify-center">
                          <p className="text-xs font-semibold text-rose-600 bg-rose-50 px-4 py-2 rounded-full border border-rose-100">
                            Waiting for teacher reply...
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {((assignment.status === 'COMPLETED' || assignment.status === 'GRADED') && (assignment as any).submission) && (
                    <div className="mt-auto mb-4 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                          Your Submission
                        </p>
                      </div>
                      <div className="p-4">
                        {isUrl((assignment as any).submission) ? (
                          <a 
                            href={(assignment as any).submission} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-full py-2.5 bg-white hover:bg-blue-50 text-blue-600 font-semibold rounded-xl border border-blue-200 transition-colors shadow-sm"
                          >
                            View Attached File
                          </a>
                        ) : (
                          <div className="max-h-32 overflow-y-auto custom-scrollbar">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              "{(assignment as any).submission}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {assignment.status === 'COMPLETED' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
                      <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full flex items-center gap-2">
                        <span className="block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Waiting for teacher grading
                      </p>
                    </div>
                  )}
                  {assignment.status === 'GRADED' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm font-bold text-purple-700 bg-purple-50 px-4 py-3 rounded-xl border border-purple-100 text-center">
                        This assignment has been graded. Check Telegram for your feedback!
                      </p>
                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}