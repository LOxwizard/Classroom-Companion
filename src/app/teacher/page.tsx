import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Telegraf } from 'telegraf';

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '');

export default async function TeacherDashboard({ searchParams }: { searchParams: Promise<{ id?: string, filter?: string }> }) {
  const resolvedParams = await searchParams;
  const teacherId = parseInt(resolvedParams.id || '0');
  const currentFilter = resolvedParams.filter || 'all';

  async function submitGrade(formData: FormData) {
    'use server';
    
    const assignmentId = parseInt(formData.get('assignmentId') as string);
    const studentTelegramId = formData.get('studentTelegramId') as string;
    const feedback = formData.get('feedback') as string;

    if (!assignmentId || !studentTelegramId || !feedback) return;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: 'GRADED' }
    });

    try {
      await bot.telegram.sendMessage(
        studentTelegramId,
        `GRADING FEEDBACK:\n\nYour teacher just reviewed your assignment!\n\nFeedback: "${feedback}"`
      );
    } catch (error) {
      console.log("Database updated, but failed to ping Telegram:", error);
    }

    revalidatePath('/teacher');
  }

  async function replyToStuckStudent(formData: FormData) {
    'use server';
    
    const assignmentId = parseInt(formData.get('assignmentId') as string);
    const studentTelegramId = formData.get('studentTelegramId') as string;
    const message = formData.get('message') as string;

    if (!assignmentId || !studentTelegramId || !message) return;

    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: 'PENDING' }
    });

    try {
      await bot.telegram.sendMessage(
        studentTelegramId,
        `TEACHER REPLY:\n\nYour teacher sent you help for your assignment!\n\nMessage: "${message}"`
      );
    } catch (error) {
      console.log("Database updated, but failed to ping Telegram:", error);
    }

    revalidatePath('/teacher');
  }

  const rawAssignments = await prisma.assignment.findMany({
    where: { teacherId: teacherId },
    include: {
      student: true,
      teacher: true,
    }
  });


  const statusPriority: Record<string, number> = {
    'STUCK': 1,
    'COMPLETED': 2,
    'PENDING': 3,
    'GRADED': 4
  };

  const sortedAssignments = rawAssignments.sort((a, b) => {
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status];
    }
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  const assignments = sortedAssignments.filter((a) => {
    if (currentFilter === 'stuck') return a.status === 'STUCK';
    if (currentFilter === 'grading') return a.status === 'COMPLETED';
    if (currentFilter === 'pending') return a.status === 'PENDING';
    if (currentFilter === 'completed') return a.status === 'GRADED';
    return true; // 'all'
  });

  const isUrl = (text: string | null) => {
    if (!text) return false;
    return text.startsWith('http://') || text.startsWith('https://');
  };

  const totalCount = rawAssignments.length;
  const needsGradingCount = rawAssignments.filter(a => a.status === 'COMPLETED').length;
  const inProgressCount = rawAssignments.filter(a => a.status === 'PENDING').length;
  const stuckCount = rawAssignments.filter(a => a.status === 'STUCK').length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg font-bold text-xl">
            CC
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Teacher Command Center</h1>
        </div>
        <Link href="/" className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
          Log Out
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-8 mt-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Active Tasks</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-1">{totalCount}</p>
          </div>
          <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Needs Grading</p>
            <p className="text-3xl font-extrabold text-emerald-700 mt-1">{needsGradingCount}</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">In Progress</p>
            <p className="text-3xl font-extrabold text-blue-700 mt-1">{inProgressCount}</p>
          </div>
          <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-semibold text-rose-600 uppercase tracking-wider">Students Stuck</p>
            <p className="text-3xl font-extrabold text-rose-700 mt-1">{stuckCount}</p>
          </div>
        </div>

        <div className="flex gap-3 mb-8 border-b border-slate-200 pb-4 overflow-x-auto">
          <Link href={`/teacher?id=${teacherId}&filter=all`} className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${currentFilter === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
            View All
          </Link>
          <Link href={`/teacher?id=${teacherId}&filter=stuck`} className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${currentFilter === 'stuck' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200'}`}>
            Needs Help
            {stuckCount > 0 && <span className={`px-2 py-0.5 rounded-full text-xs ${currentFilter === 'stuck' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'}`}>{stuckCount}</span>}
          </Link>
          <Link href={`/teacher?id=${teacherId}&filter=grading`} className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${currentFilter === 'grading' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-emerald-600 hover:bg-emerald-50 border border-emerald-200'}`}>
            Needs Grading
            {needsGradingCount > 0 && <span className={`px-2 py-0.5 rounded-full text-xs ${currentFilter === 'grading' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{needsGradingCount}</span>}
          </Link>
          <Link href={`/teacher?id=${teacherId}&filter=pending`} className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${currentFilter === 'pending' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-blue-600 hover:bg-blue-50 border border-blue-200'}`}>
            In Progress
          </Link>
          <Link href={`/teacher?id=${teacherId}&filter=completed`} className={`px-5 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${currentFilter === 'completed' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'}`}>
            Finished
          </Link>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400 font-bold text-2xl">
              -
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Nothing to see here!</h3>
            <p className="text-slate-500 max-w-sm">There are no assignments matching this status.</p>
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
                    <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                      {assignment.student?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {assignment.student?.name || 'Unknown'}
                    </p>
                  </div>

                  {((assignment.status === 'COMPLETED' || assignment.status === 'GRADED') && (assignment as any).submission) && (
                    <div className="mt-auto mb-4 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                          Submitted Work
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
                            Open Attached File
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
                    <form action={submitGrade} className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <input type="hidden" name="studentTelegramId" value={assignment.student?.telegramId} />
                      <div className="relative">
                        <textarea 
                          name="feedback" 
                          required
                          placeholder="Enter grade & feedback..."
                          className="w-full text-slate-900 placeholder:text-slate-400 text-sm p-4 pb-12 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white resize-none shadow-inner"
                          rows={2}
                        ></textarea>
                        <button 
                          type="submit"
                          className="absolute bottom-2 right-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        >
                          Grade
                        </button>
                      </div>
                    </form>
                  )}

                  {assignment.status === 'STUCK' && (
                    <form action={replyToStuckStudent} className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <input type="hidden" name="studentTelegramId" value={assignment.student?.telegramId} />
                      <div className="relative">
                        <textarea 
                          name="message" 
                          required
                          placeholder="Type your help message here..."
                          className="w-full text-slate-900 placeholder:text-rose-400 text-sm p-4 pb-12 rounded-2xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50 resize-none shadow-inner"
                          rows={2}
                        ></textarea>
                        <button 
                          type="submit"
                          className="absolute bottom-2 right-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        >
                          Send Help
                        </button>
                      </div>
                    </form>
                  )}
                  
                  {(assignment.status === 'PENDING' || assignment.status === 'GRADED') && (
                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-end">
                      <p className="text-xs font-semibold text-slate-400 italic">
                        {assignment.status === 'GRADED' ? 'Feedback sent to student' : 'Awaiting student submission...'}
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